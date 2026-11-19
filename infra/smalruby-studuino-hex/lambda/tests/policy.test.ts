import {
  DEFAULT_LIMITS,
  errorResponse,
  findSample,
  hexDataBytes,
  isAllowedOrigin,
  metricLog,
  parseLimits,
  parseOrigins,
  rateDecision,
  rateWindows,
} from '../policy';

describe('parseLimits', () => {
  test('既定は S12 の値（コンパイルは API Gateway の 30 秒に収まる 25 秒）', () => {
    expect(parseLimits({})).toEqual({
      maxRequestBytes: 131072,
      compileTimeoutMs: 25000,
      perMinute: 12,
      perDay: 600,
    });
  });

  test('環境変数で変えられ、壊れた値は既定に戻す', () => {
    const limits = parseLimits({
      MAX_REQUEST_BYTES: '1000',
      COMPILE_TIMEOUT_MS: 'abc',
      RATE_LIMIT_PER_MINUTE: '-1',
      RATE_LIMIT_PER_DAY: '50',
    });
    expect(limits).toEqual({ ...DEFAULT_LIMITS, maxRequestBytes: 1000, perDay: 50 });
  });
});

describe('Origin', () => {
  const allowed = parseOrigins('https://smalruby.app, https://preview.smalruby.app');

  test('許可したオリジンだけ通す', () => {
    expect(isAllowedOrigin('https://smalruby.app', allowed)).toBe(true);
    expect(isAllowedOrigin('https://evil.example', allowed)).toBe(false);
  });

  test('Origin が無いもの（ブラウザ以外）も通さない', () => {
    expect(isAllowedOrigin(undefined, allowed)).toBe(false);
  });
});

describe('findSample', () => {
  test('決まったサンプルだけ', () => {
    expect(findSample('blink')?.needsStuduinoLib).toBe(false);
    expect(findSample('studuino-led')?.needsStuduinoLib).toBe(true);
    expect(findSample('../etc/passwd')).toBeUndefined();
    expect(findSample(1)).toBeUndefined();
  });
});

describe('rateWindows / rateDecision', () => {
  const now = Date.UTC(2026, 10, 19, 3, 4, 30);

  test('1 分と 1 日の窓を IP ごとに作る', () => {
    const [min, day] = rateWindows('abc', now, DEFAULT_LIMITS);
    const nowSec = now / 1000;
    expect(min.key).toBe(`ip#abc#min#${nowSec - 30}`);
    expect(min.resetAt).toBe(nowSec + 30);
    expect(min.limit).toBe(12);
    expect(day.limit).toBe(600);
    expect(day.resetAt % 86400).toBe(0);
  });

  test('上限までは通し、超えたら窓が終わるまでの秒数を返す', () => {
    const windows = rateWindows('abc', now, DEFAULT_LIMITS);
    expect(rateDecision([12, 100], windows, now)).toEqual({ allowed: true });
    expect(rateDecision([13, 100], windows, now)).toEqual({ allowed: false, retryAfter: 30 });
  });

  test('1 日の上限を超えたら長い方を返す', () => {
    const windows = rateWindows('abc', now, DEFAULT_LIMITS);
    const d = rateDecision([13, 601], windows, now);
    expect(d.allowed).toBe(false);
    expect(d.retryAfter).toBeGreaterThan(3600);
  });

  test('数えられなかった窓（DynamoDB の障害）は通す（fail-open）', () => {
    const windows = rateWindows('abc', now, DEFAULT_LIMITS);
    expect(rateDecision([undefined, undefined], windows, now)).toEqual({ allowed: true });
  });
});

describe('errorResponse', () => {
  test('docs の表のステータスと形', () => {
    const res = errorResponse('rate_limited', 'https://smalruby.app', { retryAfter: 30 });
    expect(res.statusCode).toBe(429);
    expect(res.headers['Retry-After']).toBe('30');
    expect(res.headers['Access-Control-Allow-Origin']).toBe('https://smalruby.app');
    expect(JSON.parse(res.body)).toMatchObject({ error: 'rate_limited', retryAfter: 30 });
  });

  test('許可外の Origin には CORS のヘッダを付けない', () => {
    const res = errorResponse('forbidden_origin');
    expect(res.statusCode).toBe(403);
    expect(res.headers['Access-Control-Allow-Origin']).toBeUndefined();
  });

  test.each([
    ['invalid_request', 400],
    ['too_large', 413],
    ['compile_failed', 422],
    ['timeout', 504],
    ['internal', 500],
  ] as const)('%s は %d', (code, status) => {
    expect(errorResponse(code).statusCode).toBe(status);
  });
});

describe('hexDataBytes', () => {
  test('データレコードのバイト数だけを数える', () => {
    const hex = ':100000000C9466000C948E000C948E000C948E0060\n:02001000FFFFF0\n:00000001FF\n';
    expect(hexDataBytes(hex)).toBe(18);
  });
});

describe('metricLog', () => {
  test('EMF の形でメトリクスを出す（成功）', () => {
    const log = metricLog(
      { outcome: 'ok', sample: 'blink', requestBytes: 20, compileMs: 1500, hexBytes: 1000, totalMs: 1600, coldStart: true },
      'stg',
      1000,
    );
    const aws = log._aws as { CloudWatchMetrics: { Namespace: string; Metrics: { Name: string }[] }[] };
    expect(aws.CloudWatchMetrics[0].Namespace).toBe('Smalruby/StuduinoHex');
    const names = aws.CloudWatchMetrics[0].Metrics.map(m => m.Name);
    expect(names).toEqual(expect.arrayContaining(['Requests', 'Failed', 'Rejected', 'CompileTime', 'HexBytes']));
    expect(log).toMatchObject({ Stage: 'stg', Requests: 1, Succeeded: 1, Failed: 0, Rejected: 0, CompileTime: 1500 });
  });

  test('拒否（429 など）と失敗（コンパイル）を分けて数える', () => {
    const base = { requestBytes: 1, totalMs: 1, coldStart: false };
    expect(metricLog({ ...base, outcome: 'rate_limited' }, 'stg', 0)).toMatchObject({ Rejected: 1, Failed: 0 });
    expect(metricLog({ ...base, outcome: 'timeout' }, 'stg', 0)).toMatchObject({ Rejected: 0, Failed: 1 });
  });
});
