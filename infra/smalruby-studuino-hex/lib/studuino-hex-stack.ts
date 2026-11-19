import * as cdk from 'aws-cdk-lib/core';
import * as apigatewayv2 from 'aws-cdk-lib/aws-apigatewayv2';
import * as apigatewayv2Integrations from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as ecrAssets from 'aws-cdk-lib/aws-ecr-assets';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as logs from 'aws-cdk-lib/aws-logs';
import { buildSync } from 'esbuild';
import * as fs from 'fs';
import * as path from 'path';
import { Construct } from 'constructs';
import { resolveCorsOrigins } from './cors-origins';

/** container/third-party.json の形。 */
export interface ThirdParty {
  arduinoCli: { version: string; url: string; sha256: string };
  avrCore: { id: string; version: string };
  servo: { name: string; version: string };
  board: { fqbn: string; maxFlashBytes: number };
  studuinoLib: { url: string; sha256: string; libraries: string[] };
}

const CONTAINER_DIR = path.join(__dirname, '../container');

export const readThirdParty = (): ThirdParty =>
  JSON.parse(fs.readFileSync(path.join(CONTAINER_DIR, 'third-party.json'), 'utf8')) as ThirdParty;

/**
 * Docker の build args を作る（版とハッシュは third-party.json だけで決める）。
 * @param tp - third-party.json
 * @returns build args
 */
export const dockerBuildArgs = (tp: ThirdParty): Record<string, string> => {
  if (tp.studuinoLib.url && !/^[0-9a-f]{64}$/.test(tp.studuinoLib.sha256)) {
    throw new Error('third-party.json: studuinoLib.url を書いたら sha256（64 桁の 16 進）も書く');
  }
  return {
    ARDUINO_CLI_URL: tp.arduinoCli.url,
    ARDUINO_CLI_SHA256: tp.arduinoCli.sha256,
    ARDUINO_CLI_VERSION: tp.arduinoCli.version,
    AVR_CORE_ID: tp.avrCore.id,
    AVR_CORE_VERSION: tp.avrCore.version,
    SERVO_NAME: tp.servo.name,
    SERVO_VERSION: tp.servo.version,
    STUDUINO_FQBN: tp.board.fqbn,
    STUDUINO_MAX_FLASH_BYTES: String(tp.board.maxFlashBytes),
    STUDUINO_LIB_URL: tp.studuinoLib.url,
    STUDUINO_LIB_SHA256: tp.studuinoLib.sha256,
    STUDUINO_LIBRARIES: tp.studuinoLib.libraries.join(','),
  };
};

/**
 * ハンドラを 1 つの JS にまとめて container/build/ に置く（Dockerfile が COPY する）。
 * AWS SDK v3 は Lambda の Node.js 22 のベースイメージに入っているので同梱しない。
 * @param stage - ステージ
 */
const bundleHandler = (stage: string): void => {
  buildSync({
    entryPoints: [path.join(__dirname, '../lambda/handler.ts')],
    outfile: path.join(CONTAINER_DIR, 'build/handler.js'),
    bundle: true,
    platform: 'node',
    target: 'node22',
    format: 'cjs',
    minify: true,
    sourcemap: stage !== 'prod' ? 'inline' : false,
    external: ['@aws-sdk/*'],
    logLevel: 'error',
  });
};

export class StuduinoHexStack extends cdk.Stack {
  public readonly api: apigatewayv2.HttpApi;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const stage = this.node.tryGetContext('stage') || process.env.STAGE || 'stg';
    const stageSuffix = stage === 'prod' ? '' : `-${stage}`;
    const env = process.env;

    // smalruby.app（と非 prod では開発環境・ブランチプレビュー）だけ
    const corsOrigins = resolveCorsOrigins(stage, ['https://smalruby.app'], env.CORS_ALLOWED_ORIGINS);

    cdk.Tags.of(this).add('Project', 'SmalrubyStuduinoHex');
    cdk.Tags.of(this).add('Stage', stage);
    cdk.Tags.of(this).add('Service', 'Lambda');
    cdk.Tags.of(this).add('ManagedBy', 'CDK');

    // IP ごとの回数（固定窓）。TTL で消えるので DESTROY でよい
    const rateLimitTable = new dynamodb.Table(this, 'RateLimitTable', {
      tableName: `smalruby-studuino-hex-rate-limit${stageSuffix}`,
      partitionKey: { name: 'key', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      timeToLiveAttribute: 'ttl',
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    const functionName = `smalruby-studuino-hex-compile${stageSuffix}`;
    const logGroup = new logs.LogGroup(this, 'CompileLogGroup', {
      logGroupName: `/aws/lambda/${functionName}`,
      retention: stage === 'prod' ? logs.RetentionDays.ONE_MONTH : logs.RetentionDays.ONE_WEEK,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    bundleHandler(stage);
    const thirdParty = readThirdParty();

    // API Gateway（HTTP API）の統合は 30 秒で切れるので、Lambda もそれに合わせる
    const compileFn = new lambda.DockerImageFunction(this, 'CompileFunction', {
      functionName,
      code: lambda.DockerImageCode.fromImageAsset(CONTAINER_DIR, {
        platform: ecrAssets.Platform.LINUX_AMD64,
        buildArgs: dockerBuildArgs(thirdParty),
        exclude: ['README.md'],
      }),
      architecture: lambda.Architecture.X86_64,
      memorySize: 2048,
      ephemeralStorageSize: cdk.Size.mebibytes(1024),
      timeout: cdk.Duration.seconds(30),
      logGroup,
      environment: {
        STAGE: stage,
        CORS_ALLOWED_ORIGINS: corsOrigins.join(','),
        RATE_LIMIT_TABLE_NAME: rateLimitTable.tableName,
        MAX_REQUEST_BYTES: env.STUDUINO_MAX_REQUEST_BYTES || String(128 * 1024),
        COMPILE_TIMEOUT_MS: env.STUDUINO_COMPILE_TIMEOUT_MS || '25000',
        RATE_LIMIT_PER_MINUTE: env.STUDUINO_RATE_LIMIT_PER_MINUTE || '12',
        RATE_LIMIT_PER_DAY: env.STUDUINO_RATE_LIMIT_PER_DAY || '600',
      },
    });
    rateLimitTable.grantReadWriteData(compileFn);

    this.api = new apigatewayv2.HttpApi(this, 'StuduinoHexApi', {
      apiName: `SmalrubyStuduinoHex${stageSuffix}`,
      corsPreflight: {
        allowOrigins: corsOrigins,
        allowMethods: [apigatewayv2.CorsHttpMethod.POST, apigatewayv2.CorsHttpMethod.OPTIONS],
        allowHeaders: ['Content-Type'],
        maxAge: cdk.Duration.hours(24),
      },
    });

    this.api.addRoutes({
      path: '/compile',
      methods: [apigatewayv2.HttpMethod.POST],
      integration: new apigatewayv2Integrations.HttpLambdaIntegration('CompileIntegration', compileFn),
    });

    // API 全体の上限（IP ごとの上限は Lambda が DynamoDB で数える）
    const defaultStage = this.api.defaultStage?.node.defaultChild as apigatewayv2.CfnStage;
    if (defaultStage) {
      defaultStage.defaultRouteSettings = {
        throttlingRateLimit: stage === 'prod' ? 10 : 5,
        throttlingBurstLimit: stage === 'prod' ? 20 : 10,
      };
    }

    new cdk.CfnOutput(this, 'HttpApiEndpoint', {
      value: this.api.apiEndpoint,
      description: 'Studuino hex API endpoint (POST /compile)',
    });
  }
}
