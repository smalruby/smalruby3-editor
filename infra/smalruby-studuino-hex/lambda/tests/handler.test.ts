import type { APIGatewayProxyEventV2 } from 'aws-lambda';
import type { CompileResult, Toolchain } from '../compiler';
import { createHandler, type HandlerDeps } from '../handler';
import { DEFAULT_LIMITS } from '../policy';

const ORIGIN = 'https://smalruby.app';
const HEX = ':100000000C9466000C948E000C948E000C948E0060\n:00000001FF\n';

const toolchain: Toolchain = {
  arduinoCli: '1.5.1',
  avrCore: 'arduino:avr@1.8.8',
  libraries: 'Servo@1.2.2|Adafruit NeoPixel@1.15.2',
  board: 'sha256:board',
  fqbn: 'studuino:avr:studuino',
  maxFlashBytes: 15872,
  studuinoLib: 'sha256:abc',
};

const makeDeps = (over: Partial<HandlerDeps> = {}) => {
  const logs: Record<string, unknown>[] = [];
  const compile = jest.fn(
    async (): Promise<CompileResult> => ({ ok: true, hex: HEX, source: 'void setup(){}', compileMs: 1200 }),
  );
  const deps: HandlerDeps = {
    stage: 'stg',
    allowedOrigins: [ORIGIN],
    limits: DEFAULT_LIMITS,
    toolchain,
    now: () => 1_700_000_000_000,
    countRequests: async () => [1, 1],
    loadSample: name => ({ [`${name}.ino`]: 'void setup(){}' }),
    compile,
    log: entry => logs.push(entry),
    ...over,
  };
  return { deps, logs, compile };
};

const event = (body: unknown, headers: Record<string, string> = { origin: ORIGIN }) =>
  ({
    body: typeof body === 'string' ? body : JSON.stringify(body),
    headers,
    isBase64Encoded: false,
    requestContext: { http: { sourceIp: '203.0.113.1' } },
  }) as unknown as APIGatewayProxyEventV2;

const metric = (logs: Record<string, unknown>[]) => logs.find(l => l.event === 'studuino_hex_request');

describe('POST /compile', () => {
  test('サンプルをコンパイルして hex を返す', async () => {
    const { deps, logs, compile } = makeDeps();
    const res = await createHandler(deps)(event({ sample: 'blink' }));
    expect(res.statusCode).toBe(200);
    expect(res.headers['Access-Control-Allow-Origin']).toBe(ORIGIN);
    const body = JSON.parse(res.body);
    expect(body).toMatchObject({ hex: HEX, size: 16, maxSize: 15872, source: 'void setup(){}', coldStart: true });
    expect(body.toolchain).toMatchObject({ arduinoCli: '1.5.1', fqbn: toolchain.fqbn, board: 'sha256:board' });
    expect(compile).toHaveBeenCalledWith('blink', { 'blink.ino': 'void setup(){}' });
    expect(metric(logs)).toMatchObject({ outcome: 'ok', sample: 'blink', compileMs: 1200, hexBytes: 16, coldStart: true });
  });

  test('2 回目はコールドスタートでない', async () => {
    const { deps, logs } = makeDeps();
    const h = createHandler(deps);
    await h(event({ sample: 'blink' }));
    await h(event({ sample: 'blink' }));
    expect(logs.filter(l => l.event === 'studuino_hex_request').map(l => l.coldStart)).toEqual([true, false]);
  });

  test('許可外の Origin は 403（コンパイルしない）', async () => {
    const { deps, compile } = makeDeps();
    const res = await createHandler(deps)(event({ sample: 'blink' }, { origin: 'https://evil.example' }));
    expect(res.statusCode).toBe(403);
    expect(JSON.parse(res.body).error).toBe('forbidden_origin');
    expect(compile).not.toHaveBeenCalled();
  });

  test('Origin が無いものも 403', async () => {
    const { deps } = makeDeps();
    expect((await createHandler(deps)(event({ sample: 'blink' }, {}))).statusCode).toBe(403);
  });

  test('本文が上限を超えたら 413（数えない）', async () => {
    const countRequests = jest.fn(async () => [1, 1]);
    const { deps } = makeDeps({ limits: { ...DEFAULT_LIMITS, maxRequestBytes: 10 }, countRequests });
    const res = await createHandler(deps)(event({ sample: 'blink', pad: 'xxxxxxxxxx' }));
    expect(res.statusCode).toBe(413);
    expect(countRequests).not.toHaveBeenCalled();
  });

  test('回数の上限を超えたら 429 と Retry-After', async () => {
    const { deps, compile } = makeDeps({ countRequests: async () => [13, 13] });
    const res = await createHandler(deps)(event({ sample: 'blink' }));
    expect(res.statusCode).toBe(429);
    expect(Number(res.headers['Retry-After'])).toBeGreaterThan(0);
    expect(compile).not.toHaveBeenCalled();
  });

  test('DynamoDB が使えないときは通し、ログに残す（fail-open）', async () => {
    const { deps, logs } = makeDeps({ countRequests: async () => [undefined, undefined] });
    const res = await createHandler(deps)(event({ sample: 'blink' }));
    expect(res.statusCode).toBe(200);
    expect(metric(logs)).toMatchObject({ rateLimitFailOpen: true });
  });

  test('知らないサンプル・壊れた JSON は 400', async () => {
    const { deps } = makeDeps();
    const h = createHandler(deps);
    expect(JSON.parse((await h(event({ sample: 'nope' }))).body)).toMatchObject({
      error: 'invalid_request',
      reason: 'unknown_sample',
    });
    expect((await h(event('{'))).statusCode).toBe(400);
  });

  test('ライブラリが入っていないコンテナでは studuino-led は 422 library_missing', async () => {
    const { deps, compile } = makeDeps({
      toolchain: { ...toolchain, studuinoLib: null, studuinoLibError: 'download failed' },
    });
    const res = await createHandler(deps)(event({ sample: 'studuino-led' }));
    expect(res.statusCode).toBe(422);
    expect(JSON.parse(res.body)).toMatchObject({ reason: 'library_missing', libraryError: 'download failed' });
    expect(compile).not.toHaveBeenCalled();
  });

  test('コンパイルの打ち切りは 504、失敗は 422（コンパイラの出力は返さずログにだけ）', async () => {
    const timeout = makeDeps({
      compile: async () => ({ ok: false, reason: 'timeout', compileMs: 25000, log: 'secret path' }),
    });
    const r1 = await createHandler(timeout.deps)(event({ sample: 'blink' }));
    expect(r1.statusCode).toBe(504);
    expect(r1.body).not.toContain('secret path');
    expect(timeout.logs.some(l => l.log === 'secret path')).toBe(true);

    const failed = makeDeps({
      compile: async () => ({ ok: false, reason: 'flash_overflow', compileMs: 3000, log: 'too big' }),
    });
    const r2 = await createHandler(failed.deps)(event({ sample: 'blink' }));
    expect(r2.statusCode).toBe(422);
    expect(JSON.parse(r2.body).reason).toBe('flash_overflow');
  });

  test('base64 の本文も読む', async () => {
    const { deps } = makeDeps();
    const e = event('');
    e.body = Buffer.from(JSON.stringify({ sample: 'blink' })).toString('base64');
    e.isBase64Encoded = true;
    expect((await createHandler(deps)(e)).statusCode).toBe(200);
  });
});
