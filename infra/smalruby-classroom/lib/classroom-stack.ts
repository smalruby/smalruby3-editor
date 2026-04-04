import * as cdk from 'aws-cdk-lib/core';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as lambdaNodejs from 'aws-cdk-lib/aws-lambda-nodejs';
import * as apigatewayv2 from 'aws-cdk-lib/aws-apigatewayv2';
import * as apigatewayv2Integrations from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as route53 from 'aws-cdk-lib/aws-route53';
import * as route53Targets from 'aws-cdk-lib/aws-route53-targets';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import * as path from 'path';
import { Construct } from 'constructs';

export class ClassroomStack extends cdk.Stack {
  public readonly classroomsTable: dynamodb.Table;
  public readonly membershipsTable: dynamodb.Table;
  public readonly submissionsTable: dynamodb.Table;
  public readonly submissionsBucket: s3.Bucket;
  public readonly api: apigatewayv2.HttpApi;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const stage = this.node.tryGetContext('stage') || process.env.STAGE || 'stg';
    const stageSuffix = stage === 'prod' ? '' : `-${stage}`;

    // CORS設定
    const corsOriginsEnv = process.env.CORS_ALLOWED_ORIGINS ||
      'https://smalruby.app,https://smalruby.jp,http://localhost:8601';
    const corsAllowOrigins = corsOriginsEnv.split(',').map(o => o.trim());

    // Google Client ID for id_token verification
    const googleClientId = process.env.GOOGLE_CLIENT_ID || '';

    // Tags
    cdk.Tags.of(this).add('Project', 'Classroom');
    cdk.Tags.of(this).add('Stage', stage);
    cdk.Tags.of(this).add('Service', 'Lambda');
    cdk.Tags.of(this).add('ManagedBy', 'CDK');

    // --- DynamoDB Tables ---

    // Classrooms table
    this.classroomsTable = new dynamodb.Table(this, 'ClassroomsTable', {
      tableName: `Classrooms${stageSuffix}`,
      partitionKey: {
        name: 'classroomId',
        type: dynamodb.AttributeType.STRING,
      },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      pointInTimeRecoverySpecification: {
        pointInTimeRecoveryEnabled: false,
      },
      timeToLiveAttribute: 'ttl',
    });

    // GSI: joinCode lookup (for student joining)
    this.classroomsTable.addGlobalSecondaryIndex({
      indexName: 'joinCode-index',
      partitionKey: {
        name: 'joinCode',
        type: dynamodb.AttributeType.STRING,
      },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // GSI: teacherSub lookup (for listing teacher's classes)
    this.classroomsTable.addGlobalSecondaryIndex({
      indexName: 'teacherSub-index',
      partitionKey: {
        name: 'teacherSub',
        type: dynamodb.AttributeType.STRING,
      },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    cdk.Tags.of(this.classroomsTable).add('ResourceType', 'DynamoDB');

    // Memberships table
    this.membershipsTable = new dynamodb.Table(this, 'MembershipsTable', {
      tableName: `ClassroomMemberships${stageSuffix}`,
      partitionKey: {
        name: 'classroomId',
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: 'memberId',
        type: dynamodb.AttributeType.STRING,
      },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      pointInTimeRecoverySpecification: {
        pointInTimeRecoveryEnabled: false,
      },
      timeToLiveAttribute: 'ttl',
    });

    // GSI: sessionToken lookup (for student submission auth)
    this.membershipsTable.addGlobalSecondaryIndex({
      indexName: 'sessionToken-index',
      partitionKey: {
        name: 'sessionToken',
        type: dynamodb.AttributeType.STRING,
      },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    cdk.Tags.of(this.membershipsTable).add('ResourceType', 'DynamoDB');

    // Submissions table
    this.submissionsTable = new dynamodb.Table(this, 'SubmissionsTable', {
      tableName: `ClassroomSubmissions${stageSuffix}`,
      partitionKey: {
        name: 'classroomId',
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: 'submissionId',
        type: dynamodb.AttributeType.STRING,
      },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      pointInTimeRecoverySpecification: {
        pointInTimeRecoveryEnabled: false,
      },
      timeToLiveAttribute: 'ttl',
    });

    // GSI: lookup submissions by member
    this.submissionsTable.addGlobalSecondaryIndex({
      indexName: 'classroomId-memberId-index',
      partitionKey: {
        name: 'classroomId',
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: 'memberId',
        type: dynamodb.AttributeType.STRING,
      },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    cdk.Tags.of(this.submissionsTable).add('ResourceType', 'DynamoDB');

    // --- S3 Bucket for submissions ---

    this.submissionsBucket = new s3.Bucket(this, 'SubmissionsBucket', {
      bucketName: `smalruby-classroom-submissions${stageSuffix}`,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: stage !== 'prod',
      lifecycleRules: [
        {
          expiration: cdk.Duration.days(90),
        },
      ],
      cors: [
        {
          allowedMethods: [s3.HttpMethods.PUT],
          allowedOrigins: corsAllowOrigins,
          allowedHeaders: ['Content-Type'],
          maxAge: 3600,
        },
      ],
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
    });

    cdk.Tags.of(this.submissionsBucket).add('ResourceType', 'S3');

    // --- Lambda ---

    const logGroup = new logs.LogGroup(this, 'ClassroomHandlerLogGroup', {
      logGroupName: `/aws/lambda/ClassroomHandler${stageSuffix}`,
      retention: stage === 'prod' ? logs.RetentionDays.ONE_MONTH : logs.RetentionDays.ONE_WEEK,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    const handlerFn = new lambdaNodejs.NodejsFunction(this, 'ClassroomHandler', {
      functionName: `ClassroomHandler${stageSuffix}`,
      runtime: lambda.Runtime.NODEJS_20_X,
      entry: path.join(__dirname, '../lambda/handler.ts'),
      handler: 'handler',
      timeout: cdk.Duration.seconds(30),
      memorySize: 256,
      logGroup,
      environment: {
        CLASSROOMS_TABLE_NAME: this.classroomsTable.tableName,
        MEMBERSHIPS_TABLE_NAME: this.membershipsTable.tableName,
        SUBMISSIONS_TABLE_NAME: this.submissionsTable.tableName,
        SUBMISSIONS_BUCKET_NAME: this.submissionsBucket.bucketName,
        GOOGLE_CLIENT_ID: googleClientId,
        CORS_ALLOWED_ORIGINS: corsOriginsEnv,
        STAGE: stage,
      },
      bundling: {
        minify: true,
        sourceMap: stage !== 'prod',
        externalModules: [],
      },
    });

    this.classroomsTable.grantReadWriteData(handlerFn);
    this.membershipsTable.grantReadWriteData(handlerFn);
    this.submissionsTable.grantReadWriteData(handlerFn);
    this.submissionsBucket.grantPut(handlerFn);
    this.submissionsBucket.grantRead(handlerFn);

    // --- Custom Domain ---

    const parentZoneName = process.env.ROUTE53_PARENT_ZONE_NAME || 'api.smalruby.app';
    const defaultCustomDomain = stage === 'prod'
      ? `classroom.${parentZoneName}`
      : `${stage}.classroom.${parentZoneName}`;
    const customDomain = process.env.CLASSROOM_CUSTOM_DOMAIN === 'false'
      ? undefined
      : (process.env.CLASSROOM_CUSTOM_DOMAIN || defaultCustomDomain);

    let domainName: apigatewayv2.DomainName | undefined;
    let zone: route53.IHostedZone | undefined;

    if (customDomain) {
      zone = route53.HostedZone.fromLookup(this, 'HostedZone', {
        domainName: parentZoneName,
      });

      const certificate = new acm.Certificate(this, 'ApiCertificate', {
        domainName: customDomain,
        validation: acm.CertificateValidation.fromDns(zone),
      });

      domainName = new apigatewayv2.DomainName(this, 'ApiDomainName', {
        domainName: customDomain,
        certificate,
      });
    }

    // --- API Gateway ---

    this.api = new apigatewayv2.HttpApi(this, 'ClassroomApi', {
      apiName: `ClassroomApi${stageSuffix}`,
      corsPreflight: {
        allowOrigins: corsAllowOrigins,
        allowMethods: [
          apigatewayv2.CorsHttpMethod.GET,
          apigatewayv2.CorsHttpMethod.POST,
          apigatewayv2.CorsHttpMethod.PATCH,
          apigatewayv2.CorsHttpMethod.DELETE,
          apigatewayv2.CorsHttpMethod.OPTIONS,
        ],
        allowHeaders: ['Content-Type', 'Authorization'],
        maxAge: cdk.Duration.hours(24),
      },
      defaultDomainMapping: domainName ? {
        domainName,
      } : undefined,
    });

    const integration = new apigatewayv2Integrations.HttpLambdaIntegration(
      'ClassroomIntegration',
      handlerFn
    );

    // Routes
    this.api.addRoutes({
      path: '/classrooms',
      methods: [apigatewayv2.HttpMethod.POST, apigatewayv2.HttpMethod.GET],
      integration,
    });

    this.api.addRoutes({
      path: '/classrooms/{classroomId}',
      methods: [apigatewayv2.HttpMethod.GET, apigatewayv2.HttpMethod.PATCH],
      integration,
    });

    this.api.addRoutes({
      path: '/classrooms/join',
      methods: [apigatewayv2.HttpMethod.POST],
      integration,
    });

    this.api.addRoutes({
      path: '/classrooms/{classroomId}/members',
      methods: [apigatewayv2.HttpMethod.GET],
      integration,
    });

    this.api.addRoutes({
      path: '/classrooms/{classroomId}/members/{memberId}',
      methods: [apigatewayv2.HttpMethod.DELETE],
      integration,
    });

    this.api.addRoutes({
      path: '/classrooms/{classroomId}/submissions',
      methods: [apigatewayv2.HttpMethod.POST, apigatewayv2.HttpMethod.GET],
      integration,
    });

    // Throttling
    const defaultStage = this.api.defaultStage?.node.defaultChild as apigatewayv2.CfnStage;
    if (defaultStage) {
      defaultStage.defaultRouteSettings = {
        throttlingRateLimit: stage === 'prod' ? 10 : 5,
        throttlingBurstLimit: stage === 'prod' ? 30 : 10,
      };
    }

    cdk.Tags.of(this.api).add('ResourceType', 'APIGatewayHTTPAPI');

    // Route53 Alias record for Custom Domain
    if (customDomain && zone && domainName) {
      const subdomain = customDomain.replace(`.${parentZoneName}`, '');

      new route53.ARecord(this, 'ApiAliasRecord', {
        zone,
        recordName: subdomain,
        target: route53.RecordTarget.fromAlias(
          new route53Targets.ApiGatewayv2DomainProperties(
            domainName.regionalDomainName,
            domainName.regionalHostedZoneId,
          )
        ),
      });
    }

    // Outputs
    if (customDomain) {
      new cdk.CfnOutput(this, 'CustomDomainUrl', {
        value: `https://${customDomain}`,
        description: 'Classroom API custom domain URL',
      });
    }

    new cdk.CfnOutput(this, 'ApiEndpoint', {
      value: this.api.apiEndpoint,
      description: 'Classroom API Gateway endpoint',
    });

    new cdk.CfnOutput(this, 'ClassroomsTableName', {
      value: this.classroomsTable.tableName,
      description: 'DynamoDB table name for classrooms',
    });

    new cdk.CfnOutput(this, 'MembershipsTableName', {
      value: this.membershipsTable.tableName,
      description: 'DynamoDB table name for memberships',
    });

    new cdk.CfnOutput(this, 'SubmissionsTableName', {
      value: this.submissionsTable.tableName,
      description: 'DynamoDB table name for submissions',
    });

    new cdk.CfnOutput(this, 'SubmissionsBucketName', {
      value: this.submissionsBucket.bucketName,
      description: 'S3 bucket name for submission files',
    });
  }
}
