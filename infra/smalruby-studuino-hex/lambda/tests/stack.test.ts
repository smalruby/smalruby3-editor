import * as cdk from 'aws-cdk-lib/core';
import { Match, Template } from 'aws-cdk-lib/assertions';
import { dockerBuildArgs, readThirdParty, StuduinoHexStack } from '../../lib/studuino-hex-stack';

const synth = (stage: string) => {
  const app = new cdk.App({ context: { stage } });
  const stack = new StuduinoHexStack(app, `StuduinoHexStack-${stage}`, {
    env: { account: '123456789012', region: 'ap-northeast-1' },
  });
  return Template.fromStack(stack);
};

describe('StuduinoHexStack', () => {
  const prevCors = process.env.CORS_ALLOWED_ORIGINS;
  beforeAll(() => {
    delete process.env.CORS_ALLOWED_ORIGINS;
  });
  afterAll(() => {
    if (prevCors !== undefined) process.env.CORS_ALLOWED_ORIGINS = prevCors;
  });

  const stg = synth('stg');

  test('コンテナの Lambda（x86_64・30 秒・2GB）', () => {
    stg.hasResourceProperties('AWS::Lambda::Function', {
      FunctionName: 'smalruby-studuino-hex-compile-stg',
      PackageType: 'Image',
      Architectures: ['x86_64'],
      Timeout: 30,
      MemorySize: 2048,
      Environment: {
        Variables: Match.objectLike({
          STAGE: 'stg',
          MAX_REQUEST_BYTES: '131072',
          COMPILE_TIMEOUT_MS: '25000',
          RATE_LIMIT_PER_MINUTE: '12',
          RATE_LIMIT_PER_DAY: '600',
          MAX_IR_NODES: '10000',
          MAX_IR_DEPTH: '100',
          MAX_IR_VARIABLES: '64',
          CORS_ALLOWED_ORIGINS: Match.stringLikeRegexp('https://smalruby\\.app.*https://preview\\.smalruby\\.app'),
        }),
      },
    });
  });

  test('POST /compile と CORS（stg はブランチプレビューも）', () => {
    stg.hasResourceProperties('AWS::ApiGatewayV2::Route', { RouteKey: 'POST /compile' });
    stg.hasResourceProperties('AWS::ApiGatewayV2::Api', {
      CorsConfiguration: Match.objectLike({
        AllowOrigins: Match.arrayWith(['https://smalruby.app', 'https://preview.smalruby.app']),
        AllowMethods: ['POST', 'OPTIONS'],
      }),
    });
  });

  test('API 全体のスロットリング', () => {
    stg.hasResourceProperties('AWS::ApiGatewayV2::Stage', {
      DefaultRouteSettings: { ThrottlingRateLimit: 5, ThrottlingBurstLimit: 10 },
    });
  });

  test('回数の表は TTL つきで DESTROY', () => {
    stg.hasResource('AWS::DynamoDB::Table', {
      Properties: Match.objectLike({
        TableName: 'smalruby-studuino-hex-rate-limit-stg',
        TimeToLiveSpecification: { AttributeName: 'ttl', Enabled: true },
      }),
      DeletionPolicy: 'Delete',
    });
  });

  test('ロググループの保存は stg 1 週間', () => {
    stg.hasResourceProperties('AWS::Logs::LogGroup', {
      LogGroupName: '/aws/lambda/smalruby-studuino-hex-compile-stg',
      RetentionInDays: 7,
    });
  });

  test('prod は smalruby.app だけ・関数名は無印', () => {
    const prod = synth('prod');
    prod.hasResourceProperties('AWS::Lambda::Function', {
      FunctionName: 'smalruby-studuino-hex-compile',
      Environment: { Variables: Match.objectLike({ CORS_ALLOWED_ORIGINS: 'https://smalruby.app' }) },
    });
    prod.hasResourceProperties('AWS::Logs::LogGroup', { RetentionInDays: 30 });
  });
});

describe('third-party.json', () => {
  test('arduino-cli は版と sha256 を固定している', () => {
    const tp = readThirdParty();
    expect(tp.arduinoCli.url).toContain(`/v${tp.arduinoCli.version}/`);
    expect(tp.arduinoCli.sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(tp.avrCore.version).toMatch(/^\d+\.\d+\.\d+$/);
    for (const lib of tp.arduinoLibraries) expect(lib.version).toMatch(/^\d+\.\d+\.\d+$/);
  });

  test('ボード定義はアーテック社の配布元の zip（sha256 を固定）', () => {
    const { board } = readThirdParty();
    expect(board.url).toMatch(/^https:\/\/www\.artec-kk\.co\.jp\/studuino\/data\/.+\.zip$/);
    expect(board.sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(board.fqbn).toBe('studuino:avr:studuino');
    expect(board.maxFlashBytes).toBe(15872);
  });

  test('使うライブラリは 5 つだけ', () => {
    expect(readThirdParty().studuinoLib.libraries).toEqual([
      'Studuino',
      'MMA8653',
      'MPU6050',
      'IRremoteForStuduino',
      'ColorSensor',
    ]);
  });

  test('ライブラリの URL を書いたら sha256 も要る', () => {
    const tp = readThirdParty();
    expect(() =>
      dockerBuildArgs({ ...tp, studuinoLib: { ...tp.studuinoLib, url: 'https://example.com/a.zip', sha256: '' } }),
    ).toThrow(/sha256/);
    expect(dockerBuildArgs(tp).STUDUINO_LIBRARIES).toBe('Studuino,MMA8653,MPU6050,IRremoteForStuduino,ColorSensor');
    expect(dockerBuildArgs(tp).ARDUINO_LIBRARIES).toBe('Servo@1.2.2|Adafruit NeoPixel@1.15.2');
    expect(() => dockerBuildArgs({ ...tp, board: { ...tp.board, sha256: '' } })).toThrow(/board/);
  });
});
