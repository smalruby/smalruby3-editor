import * as cdk from 'aws-cdk-lib/core';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as lambdaNodejs from 'aws-cdk-lib/aws-lambda-nodejs';
import * as apigatewayv2 from 'aws-cdk-lib/aws-apigatewayv2';
import * as apigatewayv2Integrations from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as route53 from 'aws-cdk-lib/aws-route53';
import * as route53Targets from 'aws-cdk-lib/aws-route53-targets';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import * as path from 'path';
import { Construct } from 'constructs';

export class RubyteeRelayStack extends cdk.Stack {
  public readonly table: dynamodb.Table;
  public readonly jobsTable: dynamodb.Table;
  public readonly usageTable: dynamodb.Table;
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

    // 「ルビティーにまかせる」(takeover) の非同期ジョブ。置くのは状態・答え・エラーコードだけ
    // （入力は保存しない）。答えを取りに来る時間だけ残せばよいので TTL 1 時間。
    this.jobsTable = new dynamodb.Table(this, 'JobsTable', {
      tableName: `RubyteeJobs${stageSuffix}`,
      partitionKey: { name: 'jobId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      timeToLiveAttribute: 'ttl',
    });
    cdk.Tags.of(this.jobsTable).add('ResourceType', 'DynamoDB');

    // 集計表（誰が何回使ったか）。集計の元データなので RETAIN・TTL なし。
    // 残すのは classroom / seat / purpose / 日付 / 回数 / トークン数だけ（名前・IP・入力は無い）。
    this.usageTable = new dynamodb.Table(this, 'UsageTable', {
      tableName: `RubyteeRelayUsage${stageSuffix}`,
      partitionKey: { name: 'pk', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'sk', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });
    cdk.Tags.of(this.usageTable).add('ResourceType', 'DynamoDB');

    // CloudWatch Log Group (explicit, for retention control)
    const logGroup = new logs.LogGroup(this, 'RubyteeRelayHandlerLogGroup', {
      logGroupName: `/aws/lambda/RubyteeRelayHandler${stageSuffix}`,
      retention: stage === 'prod' ? logs.RetentionDays.ONE_MONTH : logs.RetentionDays.ONE_WEEK,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // takeover worker: API Lambda から非同期で呼ばれるだけ（HTTP のルートは付けない）。
    // 再試行 0 回（Claude を二重に呼ばない）・同時実行数の上限で費用が青天井にならないようにする。
    const workerLogGroup = new logs.LogGroup(this, 'RubyteeRelayTakeoverWorkerLogGroup', {
      logGroupName: `/aws/lambda/RubyteeRelayTakeoverWorker${stageSuffix}`,
      retention: stage === 'prod' ? logs.RetentionDays.ONE_MONTH : logs.RetentionDays.ONE_WEEK,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });
    const workerFn = new lambdaNodejs.NodejsFunction(this, 'RubyteeRelayTakeoverWorker', {
      functionName: `RubyteeRelayTakeoverWorker${stageSuffix}`,
      runtime: lambda.Runtime.NODEJS_22_X,
      entry: path.join(__dirname, '../lambda/takeover-worker.ts'),
      handler: 'handler',
      timeout: cdk.Duration.seconds(180),
      memorySize: 256,
      retryAttempts: 0,
      reservedConcurrentExecutions: parseInt(
        process.env.TAKEOVER_WORKER_RESERVED_CONCURRENCY || (stage === 'prod' ? '50' : '10'), 10),
      logGroup: workerLogGroup,
      environment: {
        JOBS_TABLE_NAME: this.jobsTable.tableName,
        USAGE_TABLE_NAME: this.usageTable.tableName,
        ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY || '',
        CLAUDE_TAKEOVER_MODEL: process.env.CLAUDE_TAKEOVER_MODEL || 'claude-sonnet-5-5',
        STAGE: stage,
      },
      bundling: {
        minify: true,
        sourceMap: stage !== 'prod',
        externalModules: [],
      },
    });
    // worker の権限は「jobs 表と usage 表への UpdateItem」だけ
    workerFn.addToRolePolicy(new iam.PolicyStatement({
      actions: ['dynamodb:UpdateItem'],
      resources: [this.jobsTable.tableArn, this.usageTable.tableArn],
    }));

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
        JOBS_TABLE_NAME: this.jobsTable.tableName,
        USAGE_TABLE_NAME: this.usageTable.tableName,
        TAKEOVER_WORKER_FUNCTION_NAME: workerFn.functionName,
        ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY || '',
        CLAUDE_MODEL: process.env.CLAUDE_MODEL || 'claude-haiku-4-5-20251001',
        CLAUDE_TAKEOVER_MODEL: process.env.CLAUDE_TAKEOVER_MODEL || 'claude-sonnet-5-5',
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
    // takeover: ジョブを作る・読む / 集計を足す / worker 1 つだけを非同期で起動する
    handlerFn.addToRolePolicy(new iam.PolicyStatement({
      actions: ['dynamodb:PutItem', 'dynamodb:GetItem'],
      resources: [this.jobsTable.tableArn],
    }));
    handlerFn.addToRolePolicy(new iam.PolicyStatement({
      actions: ['dynamodb:UpdateItem'],
      resources: [this.usageTable.tableArn],
    }));
    workerFn.grantInvoke(handlerFn);

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
        allowMethods: [
          apigatewayv2.CorsHttpMethod.POST,
          apigatewayv2.CorsHttpMethod.GET,
          apigatewayv2.CorsHttpMethod.OPTIONS,
        ],
        allowHeaders: ['Content-Type'],
        maxAge: cdk.Duration.hours(24),
      },
      // Map custom domain to the default stage
      defaultDomainMapping: domainName ? {
        domainName,
      } : undefined,
    });

    // POST /generate route
    const relayIntegration = new apigatewayv2Integrations.HttpLambdaIntegration(
      'RubyteeRelayIntegration',
      handlerFn
    );
    this.api.addRoutes({
      path: '/generate',
      methods: [apigatewayv2.HttpMethod.POST],
      integration: relayIntegration,
    });

    // GET /jobs/{jobId} route (takeover の答えを取りに来る)
    this.api.addRoutes({
      path: '/jobs/{jobId}',
      methods: [apigatewayv2.HttpMethod.GET],
      integration: relayIntegration,
    });

    // Stage-level throttling: DoS protection without WAF
    // prod: 10 RPS sustained / 30 burst; stg: 5 RPS / 10 burst
    const defaultStage = this.api.defaultStage?.node.defaultChild as apigatewayv2.CfnStage;
    if (defaultStage) {
      defaultStage.defaultRouteSettings = {
        throttlingRateLimit: stage === 'prod' ? 10 : 5,
        throttlingBurstLimit: stage === 'prod' ? 30 : 10,
      };
      // クラス全員がジョブを問い合わせても stage 全体の上限に当たらないよう、GET だけ広げる
      defaultStage.routeSettings = {
        'GET /jobs/{jobId}': {
          ThrottlingRateLimit: stage === 'prod' ? 40 : 10,
          ThrottlingBurstLimit: stage === 'prod' ? 80 : 20,
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

    // クラス管理（infra/smalruby-classroom）がメンバー一覧の aiUsage を読むための表の場所。
    // クラス管理には読み取り権限だけを付ける。
    new cdk.CfnOutput(this, 'RateLimitTableArn', {
      value: this.table.tableArn,
      description: 'DynamoDB table ARN for rate limiting (seat status rows)',
    });
    new cdk.CfnOutput(this, 'UsageTableName', {
      value: this.usageTable.tableName,
      description: 'DynamoDB table name for usage aggregation (RETAIN)',
    });
    new cdk.CfnOutput(this, 'UsageTableArn', {
      value: this.usageTable.tableArn,
      description: 'DynamoDB table ARN for usage aggregation (RETAIN)',
    });
    new ssm.StringParameter(this, 'RateLimitTableArnParam', {
      parameterName: `/smalruby/rubytee-relay/${stage}/rate-limit-table-arn`,
      stringValue: this.table.tableArn,
    });
    new ssm.StringParameter(this, 'UsageTableArnParam', {
      parameterName: `/smalruby/rubytee-relay/${stage}/usage-table-arn`,
      stringValue: this.usageTable.tableArn,
    });
  }
}
