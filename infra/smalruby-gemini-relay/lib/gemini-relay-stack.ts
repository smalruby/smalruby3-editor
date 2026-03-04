import * as cdk from 'aws-cdk-lib/core';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as lambdaNodejs from 'aws-cdk-lib/aws-lambda-nodejs';
import * as apigatewayv2 from 'aws-cdk-lib/aws-apigatewayv2';
import * as apigatewayv2Integrations from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import * as path from 'path';
import { Construct } from 'constructs';

export class GeminiRelayStack extends cdk.Stack {
  public readonly table: dynamodb.Table;
  public readonly api: apigatewayv2.HttpApi;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Stage取得（優先順位: --context stage=..., .envのSTAGE, デフォルト: stg）
    const stage = this.node.tryGetContext('stage') || process.env.STAGE || 'stg';
    const stageSuffix = stage === 'prod' ? '' : `-${stage}`;

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
    cdk.Tags.of(this).add('Project', 'GeminiRelay');
    cdk.Tags.of(this).add('Stage', stage);
    cdk.Tags.of(this).add('Service', 'Lambda');
    cdk.Tags.of(this).add('ManagedBy', 'CDK');

    // DynamoDB Table for rate limiting
    this.table = new dynamodb.Table(this, 'RateLimitTable', {
      tableName: `GeminiRelayRateLimit${stageSuffix}`,
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
      timeToLiveAttribute: 'ttl',
    });

    cdk.Tags.of(this.table).add('ResourceType', 'DynamoDB');

    // Lambda function (esbuild bundling)
    const handlerFn = new lambdaNodejs.NodejsFunction(this, 'GeminiRelayHandler', {
      functionName: `GeminiRelayHandler${stageSuffix}`,
      runtime: lambda.Runtime.NODEJS_20_X,
      entry: path.join(__dirname, '../lambda/handler.ts'),
      handler: 'handler',
      timeout: cdk.Duration.seconds(60),
      memorySize: 256,
      environment: {
        RATE_LIMIT_TABLE_NAME: this.table.tableName,
        GEMINI_API_KEY: process.env.GEMINI_API_KEY || '',
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

    // API Gateway HTTP API
    this.api = new apigatewayv2.HttpApi(this, 'GeminiRelayApi', {
      apiName: `GeminiRelayApi${stageSuffix}`,
      corsPreflight: {
        allowOrigins: corsAllowOrigins,
        allowMethods: [apigatewayv2.CorsHttpMethod.POST, apigatewayv2.CorsHttpMethod.OPTIONS],
        allowHeaders: ['Content-Type'],
        maxAge: cdk.Duration.hours(24),
      },
    });

    // POST /generate route
    this.api.addRoutes({
      path: '/generate',
      methods: [apigatewayv2.HttpMethod.POST],
      integration: new apigatewayv2Integrations.HttpLambdaIntegration(
        'GeminiRelayIntegration',
        handlerFn
      ),
    });

    cdk.Tags.of(this.api).add('ResourceType', 'APIGatewayHTTPAPI');

    // Outputs
    new cdk.CfnOutput(this, 'ApiEndpoint', {
      value: this.api.apiEndpoint,
      description: 'Gemini Relay API endpoint (append /generate)',
    });

    new cdk.CfnOutput(this, 'RateLimitTableName', {
      value: this.table.tableName,
      description: 'DynamoDB table name for rate limiting',
    });
  }
}
