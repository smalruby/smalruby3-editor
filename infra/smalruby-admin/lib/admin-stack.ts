import * as cdk from 'aws-cdk-lib/core';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as lambdaNodejs from 'aws-cdk-lib/aws-lambda-nodejs';
import * as apigatewayv2 from 'aws-cdk-lib/aws-apigatewayv2';
import * as apigatewayv2Integrations from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as route53 from 'aws-cdk-lib/aws-route53';
import * as route53Targets from 'aws-cdk-lib/aws-route53-targets';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import * as path from 'path';
import { Construct } from 'constructs';

/**
 * Smalruby Admin service (EPIC #1073): the operator-only management API.
 *
 * Deliberately the most locked-down stack in the fleet:
 * - allowlist table populated by a human in the AWS console (F4) — RETAIN so
 *   a stack replacement can never drop the operator registry
 * - admin-dedicated Google client ID (decision B)
 * - audit log retention of ONE YEAR in prod (longer than the fleet's
 *   ONE_MONTH convention — admin actions must stay reviewable)
 * - tight throttling (a single-operator tool needs no headroom)
 */
export class SmalrubyAdminStack extends cdk.Stack {
  public readonly adminsTable: dynamodb.Table;
  public readonly api: apigatewayv2.HttpApi;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const stage = this.node.tryGetContext('stage') || process.env.STAGE || 'stg';
    const stageSuffix = stage === 'prod' ? '' : `-${stage}`;

    const corsOriginsEnv = process.env.CORS_ALLOWED_ORIGINS ||
      (stage === 'prod'
        ? 'https://smalruby.app'
        : 'https://smalruby.app,http://localhost:8602');
    const corsAllowOrigins = corsOriginsEnv.split(',').map(o => o.trim());

    // Admin-dedicated Google OAuth client (decision B). An empty client ID
    // would disable the audience check, so prod refuses to deploy without it
    // (stg may run on the dev bypass before the OAuth client exists).
    const adminGoogleClientId = process.env.ADMIN_GOOGLE_CLIENT_ID || '';
    if (stage === 'prod' && !adminGoogleClientId) {
      throw new Error('ADMIN_GOOGLE_CLIENT_ID is required in production. Set it in .env.prod.');
    }

    // Dev bypass token (stg only — automated testing). Same guard as the
    // classroom / bug-report stacks: refuse to deploy it to prod.
    const devBypassToken = process.env.DEV_BYPASS_TOKEN || '';
    if (stage === 'prod' && devBypassToken) {
      throw new Error('DEV_BYPASS_TOKEN must not be set in production. Remove it from .env.prod.');
    }

    // Tags
    cdk.Tags.of(this).add('Project', 'Admin');
    cdk.Tags.of(this).add('Stage', stage);
    cdk.Tags.of(this).add('Service', 'Lambda');
    cdk.Tags.of(this).add('ManagedBy', 'CDK');

    // --- Allowlist table (manually populated, decision C/F4) ---

    this.adminsTable = new dynamodb.Table(this, 'AdminsTable', {
      tableName: `SmalrubyAdmins${stageSuffix}`,
      partitionKey: {
        name: 'email',
        type: dynamodb.AttributeType.STRING,
      },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      // The operator registry must survive stack replacements (same policy
      // as BugReportAdmins).
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      pointInTimeRecoverySpecification: {
        pointInTimeRecoveryEnabled: false,
      },
    });

    cdk.Tags.of(this.adminsTable).add('ResourceType', 'DynamoDB');

    // --- Lambda ---

    const logGroup = new logs.LogGroup(this, 'AdminHandlerLogGroup', {
      logGroupName: `/aws/lambda/SmalrubyAdminHandler${stageSuffix}`,
      // Audit trail: keep prod admin logs for a full year (deliberate
      // deviation from the fleet's ONE_MONTH — these are audit records).
      retention: stage === 'prod' ? logs.RetentionDays.ONE_YEAR : logs.RetentionDays.ONE_WEEK,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    const handlerFn = new lambdaNodejs.NodejsFunction(this, 'AdminHandler', {
      functionName: `SmalrubyAdminHandler${stageSuffix}`,
      runtime: lambda.Runtime.NODEJS_22_X,
      entry: path.join(__dirname, '../lambda/handler.ts'),
      handler: 'handler',
      timeout: cdk.Duration.seconds(30),
      memorySize: 256,
      logGroup,
      environment: {
        ADMINS_TABLE_NAME: this.adminsTable.tableName,
        ADMIN_GOOGLE_CLIENT_ID: adminGoogleClientId,
        DEV_BYPASS_TOKEN: devBypassToken,
        CORS_ALLOWED_ORIGINS: corsOriginsEnv,
        SHARED_ASSIGNMENTS_TABLE_NAME: `SharedAssignments${stageSuffix}`,
        SHARED_REPORTS_TABLE_NAME: `SharedAssignmentReports${stageSuffix}`,
        SHARED_BUCKET_NAME: `smalruby-shared-assignments${stageSuffix}`,
        CLASSROOMS_TABLE_NAME: `Classrooms${stageSuffix}`,
        MEMBERSHIPS_TABLE_NAME: `ClassroomMemberships${stageSuffix}`,
        SUBMISSIONS_TABLE_NAME: `ClassroomSubmissions${stageSuffix}`,
        GROUPS_TABLE_NAME: `ClassroomGroups${stageSuffix}`,
        SUBMISSIONS_BUCKET_NAME: `smalruby-classroom-submissions${stageSuffix}`,
        STAGE: stage,
      },
      bundling: {
        minify: true,
        sourceMap: stage !== 'prod',
        externalModules: [],
      },
    });

    // The allowlist check reads; the first-login sub pin writes.
    this.adminsTable.grantReadWriteData(handlerFn);

    // --- Cross-service access (decision A / N2) ---
    // Managed resources are IMPORTED by the fleet's stage naming convention —
    // the classroom stack is never modified by this project. Grants on
    // imported tables include their GSIs (grantIndexPermissions).

    const sharedAssignmentsTable = dynamodb.Table.fromTableAttributes(this, 'SharedAssignmentsRef', {
      tableName: `SharedAssignments${stageSuffix}`,
      grantIndexPermissions: true,
    });
    const sharedReportsTable = dynamodb.Table.fromTableAttributes(this, 'SharedReportsRef', {
      tableName: `SharedAssignmentReports${stageSuffix}`,
      grantIndexPermissions: true,
    });
    const sharedBucket = s3.Bucket.fromBucketName(
      this, 'SharedBucketRef', `smalruby-shared-assignments${stageSuffix}`,
    );

    // Moderation: read everything, write only the status flip (RW grant —
    // DynamoDB IAM cannot scope to attributes; the handler enforces it).
    sharedAssignmentsTable.grantReadWriteData(handlerFn);
    sharedReportsTable.grantReadData(handlerFn);
    sharedBucket.grantRead(handlerFn);

    // Classroom management + expired restore (S4 #1084): the restore
    // rehydrates archived items back INTO the classroom tables, so all four
    // need RW; the submissions bucket is read-only (snapshot JSON under
    // ddb-archive/ + HeadObject existence checks on submission binaries).
    const classroomsTable = dynamodb.Table.fromTableAttributes(this, 'ClassroomsRef', {
      tableName: `Classrooms${stageSuffix}`,
      grantIndexPermissions: true,
    });
    const membershipsTable = dynamodb.Table.fromTableAttributes(this, 'MembershipsRef', {
      tableName: `ClassroomMemberships${stageSuffix}`,
      grantIndexPermissions: true,
    });
    const submissionsTable = dynamodb.Table.fromTableAttributes(this, 'SubmissionsRef', {
      tableName: `ClassroomSubmissions${stageSuffix}`,
      grantIndexPermissions: true,
    });
    const groupsTable = dynamodb.Table.fromTableAttributes(this, 'GroupsRef', {
      tableName: `ClassroomGroups${stageSuffix}`,
      grantIndexPermissions: true,
    });
    const submissionsBucket = s3.Bucket.fromBucketName(
      this, 'SubmissionsBucketRef', `smalruby-classroom-submissions${stageSuffix}`,
    );

    classroomsTable.grantReadWriteData(handlerFn);
    membershipsTable.grantReadWriteData(handlerFn);
    submissionsTable.grantReadWriteData(handlerFn);
    groupsTable.grantReadWriteData(handlerFn);
    submissionsBucket.grantRead(handlerFn);

    // --- Custom Domain ---

    const parentZoneName = process.env.ROUTE53_PARENT_ZONE_NAME || 'api.smalruby.app';
    const defaultCustomDomain = stage === 'prod'
      ? `admin.${parentZoneName}`
      : `${stage}.admin.${parentZoneName}`;
    const customDomain = process.env.ADMIN_CUSTOM_DOMAIN === 'false'
      ? undefined
      : (process.env.ADMIN_CUSTOM_DOMAIN || defaultCustomDomain);

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

    this.api = new apigatewayv2.HttpApi(this, 'AdminApi', {
      apiName: `SmalrubyAdminApi${stageSuffix}`,
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
      'AdminIntegration',
      handlerFn,
    );

    this.api.addRoutes({
      path: '/admin/me',
      methods: [apigatewayv2.HttpMethod.GET],
      integration,
    });

    // みんなの課題 moderation (S3 #1083)
    this.api.addRoutes({
      path: '/admin/shared-assignments',
      methods: [apigatewayv2.HttpMethod.GET],
      integration,
    });
    this.api.addRoutes({
      path: '/admin/shared-assignments/reports',
      methods: [apigatewayv2.HttpMethod.GET],
      integration,
    });
    this.api.addRoutes({
      path: '/admin/shared-assignments/{sharedId}',
      methods: [apigatewayv2.HttpMethod.GET, apigatewayv2.HttpMethod.PATCH],
      integration,
    });

    // Classroom management + expired restore (S4 #1084). HTTP API prefers
    // the literal restore-candidates route over {classroomId} by specificity.
    this.api.addRoutes({
      path: '/admin/classrooms',
      methods: [apigatewayv2.HttpMethod.GET],
      integration,
    });
    this.api.addRoutes({
      path: '/admin/classrooms/restore-candidates',
      methods: [apigatewayv2.HttpMethod.GET],
      integration,
    });
    this.api.addRoutes({
      path: '/admin/classrooms/{classroomId}',
      methods: [apigatewayv2.HttpMethod.GET, apigatewayv2.HttpMethod.PATCH],
      integration,
    });
    this.api.addRoutes({
      path: '/admin/classrooms/{classroomId}/restore-plan',
      methods: [apigatewayv2.HttpMethod.GET],
      integration,
    });
    this.api.addRoutes({
      path: '/admin/classrooms/{classroomId}/restore',
      methods: [apigatewayv2.HttpMethod.POST],
      integration,
    });

    // Single-operator tool: keep throttling tight.
    const defaultStage = this.api.defaultStage?.node.defaultChild as apigatewayv2.CfnStage;
    if (defaultStage) {
      defaultStage.defaultRouteSettings = {
        throttlingRateLimit: 10,
        throttlingBurstLimit: 20,
      };
    }

    cdk.Tags.of(this.api).add('ResourceType', 'APIGatewayHTTPAPI');

    // Route53 alias for the custom domain
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
        description: 'Admin API custom domain URL',
      });
    }

    new cdk.CfnOutput(this, 'ApiEndpoint', {
      value: this.api.apiEndpoint,
      description: 'Admin API Gateway endpoint',
    });

    new cdk.CfnOutput(this, 'AdminsTableName', {
      value: this.adminsTable.tableName,
      description: 'DynamoDB table name for the admin allowlist',
    });
  }
}
