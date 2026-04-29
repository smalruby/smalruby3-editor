import * as cdk from 'aws-cdk-lib/core';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
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

export class RubyteeRelayStack extends cdk.Stack {
  public readonly table: dynamodb.Table;
  public readonly api: apigatewayv2.HttpApi;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Stage取得（優先順位: --context stage=..., .envのSTAGE, デフォルト: stg）
    const stage = this.node.tryGetContext('stage') || process.env.STAGE || 'stg';
    const stageSuffix = stage === 'prod' ? '' : `-${stage}`;

    // Custom Domain configuration
    const parentZoneName = process.env.ROUTE53_PARENT_ZONE_NAME || 'api.smalruby.app';
    const defaultCustomDomain = stage === 'prod'
      ? `rubytee.${parentZoneName}`
      : `${stage}.rubytee.${parentZoneName}`;
    const customDomain = process.env.RUBYTEE_CUSTOM_DOMAIN === 'false'
      ? undefined
      : (process.env.RUBYTEE_CUSTOM_DOMAIN || defaultCustomDomain);

    // CORS設定（カンマ区切り環境変数 or デフォルト）
    const corsOriginsEnv = process.env.CORS_ALLOWED_ORIGINS ||
      'https://smalruby.app,https://smalruby.jp,http://localhost:8601';
    const corsAllowOrigins = corsOriginsEnv.split(',').map(o => o.trim());

    // Rate limit config
    const rateLimitWindowMinutes = parseInt(process.env.RATE_LIMIT_WINDOW_MINUTES || '35', 10);
    const rateLimitMaxRequests = parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '40', 10);
    const maxUserMessageLength = parseInt(process.env.MAX_USER_MESSAGE_LENGTH || '250', 10);
    const minUserMessageLength = parseInt(process.env.MIN_USER_MESSAGE_LENGTH || '10', 10);

    // Stack全体にタグ付与
    cdk.Tags.of(this).add('Project', 'RubyteeRelay');
    cdk.Tags.of(this).add('Stage', stage);
    cdk.Tags.of(this).add('Service', 'Lambda');
    cdk.Tags.of(this).add('ManagedBy', 'CDK');

    // DynamoDB Table for rate limiting
    this.table = new dynamodb.Table(this, 'RateLimitTable', {
      tableName: `RubyteeRelayRateLimit${stageSuffix}`,
      partitionKey: {
        name: 'sourceIp',
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: 'windowStart',
        type: dynamodb.AttributeType.NUMBER,
      },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      pointInTimeRecoverySpecification: {
        pointInTimeRecoveryEnabled: false, // Disable for cost optimization
      },
      timeToLiveAttribute: 'ttl',
    });

    cdk.Tags.of(this.table).add('ResourceType', 'DynamoDB');

    // CloudWatch Log Group (explicit, for retention control)
    const logGroup = new logs.LogGroup(this, 'RubyteeRelayHandlerLogGroup', {
      logGroupName: `/aws/lambda/RubyteeRelayHandler${stageSuffix}`,
      retention: stage === 'prod' ? logs.RetentionDays.ONE_MONTH : logs.RetentionDays.ONE_WEEK,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // Lambda function (esbuild bundling)
    const handlerFn = new lambdaNodejs.NodejsFunction(this, 'RubyteeRelayHandler', {
      functionName: `RubyteeRelayHandler${stageSuffix}`,
      runtime: lambda.Runtime.NODEJS_22_X,
      entry: path.join(__dirname, '../lambda/handler.ts'),
      handler: 'handler',
      timeout: cdk.Duration.seconds(60),
      memorySize: 256,
      logGroup,
      environment: {
        RATE_LIMIT_TABLE_NAME: this.table.tableName,
        ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY || '',
        CLAUDE_MODEL: process.env.CLAUDE_MODEL || 'claude-haiku-4-5-20251001',
        RATE_LIMIT_WINDOW_MINUTES: String(rateLimitWindowMinutes),
        RATE_LIMIT_MAX_REQUESTS: String(rateLimitMaxRequests),
        MAX_USER_MESSAGE_LENGTH: String(maxUserMessageLength),
        MIN_USER_MESSAGE_LENGTH: String(minUserMessageLength),
        CORS_ALLOWED_ORIGINS: corsOriginsEnv,
        STAGE: stage,
      },
      bundling: {
        minify: true,
        sourceMap: stage !== 'prod',
        externalModules: [],
      },
    });

    // DynamoDB read/write permission for the Lambda
    this.table.grantReadWriteData(handlerFn);

    // --- Custom Domain for API Gateway HTTP API ---
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

    // API Gateway HTTP API
    this.api = new apigatewayv2.HttpApi(this, 'RubyteeRelayApi', {
      apiName: `RubyteeRelayApi${stageSuffix}`,
      corsPreflight: {
        allowOrigins: corsAllowOrigins,
        allowMethods: [apigatewayv2.CorsHttpMethod.POST, apigatewayv2.CorsHttpMethod.OPTIONS],
        allowHeaders: ['Content-Type'],
        maxAge: cdk.Duration.hours(24),
      },
      // Map custom domain to the default stage
      defaultDomainMapping: domainName ? {
        domainName,
      } : undefined,
    });

    // POST /generate route
    this.api.addRoutes({
      path: '/generate',
      methods: [apigatewayv2.HttpMethod.POST],
      integration: new apigatewayv2Integrations.HttpLambdaIntegration(
        'RubyteeRelayIntegration',
        handlerFn
      ),
    });

    // Stage-level throttling: DoS protection without WAF
    // prod: 10 RPS sustained / 30 burst; stg: 5 RPS / 10 burst
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
        description: 'Rubytee Relay custom domain URL (append /generate)',
      });
    }

    new cdk.CfnOutput(this, 'ApiEndpoint', {
      value: this.api.apiEndpoint,
      description: 'Rubytee Relay API Gateway endpoint (append /generate)',
    });

    new cdk.CfnOutput(this, 'RateLimitTableName', {
      value: this.table.tableName,
      description: 'DynamoDB table name for rate limiting',
    });
  }
}
