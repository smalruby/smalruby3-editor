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

export class SmalrubyBugReportStack extends cdk.Stack {
  public readonly reportsTable: dynamodb.Table;
  public readonly adminsTable: dynamodb.Table;
  public readonly reportsBucket: s3.Bucket;
  public readonly api: apigatewayv2.HttpApi;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const stage = this.node.tryGetContext('stage') || process.env.STAGE || 'stg';
    const stageSuffix = stage === 'prod' ? '' : `-${stage}`;

    const corsOriginsEnv = process.env.CORS_ALLOWED_ORIGINS ||
      'https://smalruby.app,https://smalruby.jp,http://localhost:8601';
    const corsAllowOrigins = corsOriginsEnv.split(',').map(o => o.trim());

    const googleClientId = process.env.GOOGLE_CLIENT_ID || '';
    const microsoftClientId = process.env.MICROSOFT_CLIENT_ID || '';
    const bootstrapAdminEmails = process.env.BOOTSTRAP_ADMIN_EMAILS || '';

    const devBypassToken = process.env.DEV_BYPASS_TOKEN || '';
    if (stage === 'prod' && devBypassToken) {
      throw new Error('DEV_BYPASS_TOKEN must not be set in production. Remove it from .env.prod.');
    }

    // Resolved reports auto-expire after this many days (open reports are kept).
    const resolvedTtlDays = parseInt(process.env.RESOLVED_TTL_DAYS || '30', 10);

    // Tags
    cdk.Tags.of(this).add('Project', 'BugReport');
    cdk.Tags.of(this).add('Stage', stage);
    cdk.Tags.of(this).add('Service', 'Lambda');
    cdk.Tags.of(this).add('ManagedBy', 'CDK');

    // --- DynamoDB Tables ---

    this.reportsTable = new dynamodb.Table(this, 'ReportsTable', {
      tableName: `BugReports${stageSuffix}`,
      partitionKey: { name: 'reportId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      pointInTimeRecoverySpecification: { pointInTimeRecoveryEnabled: false },
      timeToLiveAttribute: 'ttl',
    });

    // GSI: a reporter's own reports, newest-first.
    this.reportsTable.addGlobalSecondaryIndex({
      indexName: 'ownerSub-createdAt-index',
      partitionKey: { name: 'ownerSub', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'createdAt', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // GSI: all reports newest-first (constant entityType partition) for admins.
    this.reportsTable.addGlobalSecondaryIndex({
      indexName: 'entityType-createdAt-index',
      partitionKey: { name: 'entityType', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'createdAt', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    cdk.Tags.of(this.reportsTable).add('ResourceType', 'DynamoDB');

    // Admins registry — keyed by verified email (mirrors classroom co-teachers).
    this.adminsTable = new dynamodb.Table(this, 'AdminsTable', {
      tableName: `BugReportAdmins${stageSuffix}`,
      partitionKey: { name: 'email', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.RETAIN, // admin list must survive stack churn
      pointInTimeRecoverySpecification: { pointInTimeRecoveryEnabled: false },
    });

    cdk.Tags.of(this.adminsTable).add('ResourceType', 'DynamoDB');

    // --- S3 Bucket for attached projects ---

    this.reportsBucket = new s3.Bucket(this, 'ReportsBucket', {
      bucketName: `smalruby-bug-report${stageSuffix}`,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: stage !== 'prod',
      // No blanket lifecycle expiration: open reports must keep their project
      // until resolved. DynamoDB TTL on resolved rows handles cleanup; orphaned
      // objects are swept after a generous window.
      lifecycleRules: [
        { expiration: cdk.Duration.days(Math.max(resolvedTtlDays * 6, 180)) },
      ],
      cors: [
        {
          allowedMethods: [s3.HttpMethods.PUT, s3.HttpMethods.GET],
          allowedOrigins: corsAllowOrigins,
          allowedHeaders: ['Content-Type'],
          maxAge: 3600,
        },
      ],
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
    });

    cdk.Tags.of(this.reportsBucket).add('ResourceType', 'S3');

    // --- Lambda ---

    const logGroup = new logs.LogGroup(this, 'BugReportHandlerLogGroup', {
      logGroupName: `/aws/lambda/BugReportHandler${stageSuffix}`,
      retention: stage === 'prod' ? logs.RetentionDays.ONE_MONTH : logs.RetentionDays.ONE_WEEK,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    const handlerFn = new lambdaNodejs.NodejsFunction(this, 'BugReportHandler', {
      functionName: `BugReportHandler${stageSuffix}`,
      runtime: lambda.Runtime.NODEJS_22_X,
      entry: path.join(__dirname, '../lambda/handler.ts'),
      handler: 'handler',
      timeout: cdk.Duration.seconds(30),
      memorySize: 256,
      logGroup,
      environment: {
        REPORTS_TABLE_NAME: this.reportsTable.tableName,
        ADMINS_TABLE_NAME: this.adminsTable.tableName,
        REPORTS_BUCKET_NAME: this.reportsBucket.bucketName,
        GOOGLE_CLIENT_ID: googleClientId,
        MICROSOFT_CLIENT_ID: microsoftClientId,
        BOOTSTRAP_ADMIN_EMAILS: bootstrapAdminEmails,
        DEV_BYPASS_TOKEN: devBypassToken,
        CORS_ALLOWED_ORIGINS: corsOriginsEnv,
        RESOLVED_TTL_DAYS: String(resolvedTtlDays),
        PRESIGNED_URL_UPLOAD_EXPIRY: process.env.PRESIGNED_URL_UPLOAD_EXPIRY || '900',
        PRESIGNED_URL_DOWNLOAD_EXPIRY: process.env.PRESIGNED_URL_DOWNLOAD_EXPIRY || '600',
        STAGE: stage,
      },
      bundling: {
        minify: true,
        sourceMap: stage !== 'prod',
        externalModules: [],
      },
    });

    // Least privilege: the handler reads/writes only its own tables and bucket.
    this.reportsTable.grantReadWriteData(handlerFn);
    this.adminsTable.grantReadWriteData(handlerFn);
    this.reportsBucket.grantPut(handlerFn);
    this.reportsBucket.grantRead(handlerFn);

    // --- Custom Domain ---

    const parentZoneName = process.env.ROUTE53_PARENT_ZONE_NAME || 'api.smalruby.app';
    const defaultCustomDomain = stage === 'prod'
      ? `bug-report.${parentZoneName}`
      : `${stage}.bug-report.${parentZoneName}`;
    const customDomain = process.env.BUG_REPORT_CUSTOM_DOMAIN === 'false'
      ? undefined
      : (process.env.BUG_REPORT_CUSTOM_DOMAIN || defaultCustomDomain);

    let domainName: apigatewayv2.DomainName | undefined;
    let zone: route53.IHostedZone | undefined;

    if (customDomain) {
      zone = route53.HostedZone.fromLookup(this, 'HostedZone', { domainName: parentZoneName });

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

    this.api = new apigatewayv2.HttpApi(this, 'BugReportApi', {
      apiName: `BugReportApi${stageSuffix}`,
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
      defaultDomainMapping: domainName ? { domainName } : undefined,
    });

    const integration = new apigatewayv2Integrations.HttpLambdaIntegration(
      'BugReportIntegration',
      handlerFn,
    );

    this.api.addRoutes({
      path: '/bug-reports',
      methods: [apigatewayv2.HttpMethod.POST, apigatewayv2.HttpMethod.GET],
      integration,
    });

    // Reporter hide/unhide of their own report (sets hiddenByOwner).
    this.api.addRoutes({
      path: '/bug-reports/{reportId}',
      methods: [apigatewayv2.HttpMethod.PATCH],
      integration,
    });

    this.api.addRoutes({
      path: '/admin/bug-reports',
      methods: [apigatewayv2.HttpMethod.GET],
      integration,
    });

    this.api.addRoutes({
      path: '/admin/bug-reports/{reportId}',
      methods: [apigatewayv2.HttpMethod.GET, apigatewayv2.HttpMethod.PATCH],
      integration,
    });

    this.api.addRoutes({
      path: '/admin/admins',
      methods: [apigatewayv2.HttpMethod.GET, apigatewayv2.HttpMethod.POST],
      integration,
    });

    this.api.addRoutes({
      path: '/admin/admins/{email}',
      methods: [apigatewayv2.HttpMethod.DELETE],
      integration,
    });

    // Throttling — stricter on the unauthenticated-volume create endpoint.
    const defaultStage = this.api.defaultStage?.node.defaultChild as apigatewayv2.CfnStage;
    if (defaultStage) {
      defaultStage.defaultRouteSettings = {
        throttlingRateLimit: stage === 'prod' ? 100 : 50,
        throttlingBurstLimit: stage === 'prod' ? 100 : 50,
      };
      defaultStage.routeSettings = {
        'POST /bug-reports': {
          ThrottlingRateLimit: stage === 'prod' ? 10 : 5,
          ThrottlingBurstLimit: stage === 'prod' ? 20 : 10,
        },
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
          ),
        ),
      });
    }

    // Outputs
    if (customDomain) {
      new cdk.CfnOutput(this, 'CustomDomainUrl', {
        value: `https://${customDomain}`,
        description: 'Bug Report API custom domain URL',
      });
    }

    new cdk.CfnOutput(this, 'ApiEndpoint', {
      value: this.api.apiEndpoint,
      description: 'Bug Report API Gateway endpoint',
    });

    new cdk.CfnOutput(this, 'ReportsTableName', {
      value: this.reportsTable.tableName,
      description: 'DynamoDB table name for bug reports',
    });

    new cdk.CfnOutput(this, 'AdminsTableName', {
      value: this.adminsTable.tableName,
      description: 'DynamoDB table name for admins',
    });

    new cdk.CfnOutput(this, 'ReportsBucketName', {
      value: this.reportsBucket.bucketName,
      description: 'S3 bucket name for attached projects',
    });
  }
}
