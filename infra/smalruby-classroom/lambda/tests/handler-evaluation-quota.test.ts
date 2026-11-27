// このファイルをモジュールにするための宣言。import/export を持たない .ts は TypeScript の
// グローバルスクリプト扱いになり、トップレベルの const がテストファイル間で衝突する（#1144）。
export {};

/**
 * AI 評価の今日の使用量（#2448）: evaluate の応答の `quota` と、数を読むだけの
 * `GET /teacher/evaluation-quota`。DynamoDB と Claude はモックする。
 */

const mockSend = jest.fn();
jest.mock('@aws-sdk/lib-dynamodb', () => {
  const actual = jest.requireActual('@aws-sdk/lib-dynamodb');
  return {
    ...actual,
    DynamoDBDocumentClient: { from: () => ({ send: mockSend }) },
  };
});

jest.mock('@aws-sdk/client-s3', () => {
  const actual = jest.requireActual('@aws-sdk/client-s3');
  return { ...actual, S3Client: jest.fn(() => ({ send: jest.fn() })) };
});

const mockCreate = jest.fn();
jest.mock('../anthropic-client', () => {
  const actual = jest.requireActual('../anthropic-client');
  return {
    ...actual,
    createAnthropicClient: () => ({ client: { messages: { create: mockCreate } } }),
  };
});

const DEV_TOKEN = 'test-dev-bypass';
const NOW = Date.UTC(2026, 10, 26, 5, 30, 0); // 2026-11-26T05:30:00Z = 14:30 JST

const makeEvent = (method: string, path: string, body?: unknown, pathParameters: Record<string, string> = {}) => ({
  requestContext: { http: { method, path, sourceIp: '127.0.0.1' } },
  headers: { authorization: `Bearer ${DEV_TOKEN}`, origin: 'http://localhost:8601' },
  pathParameters,
  queryStringParameters: undefined,
  body: body === undefined ? undefined : JSON.stringify(body),
});

describe('AI 評価の今日の使用量 (#2448)', () => {
  let mod: {
    handler: (event: unknown) => Promise<{ statusCode?: number; body?: string }>;
    evalQuotaFromCount: (count: number, limit: number, nowMs: number) => unknown;
    jstDay: (nowMs: number) => string;
  };

  beforeEach(() => {
    jest.resetModules();
    jest.spyOn(Date, 'now').mockReturnValue(NOW);
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
    process.env.DEV_BYPASS_TOKEN = DEV_TOKEN;
    process.env.STAGE = 'stg';
    delete process.env.EVAL_DAILY_LIMIT;
    mockSend.mockReset();
    mockCreate.mockReset();
    mod = require('../handler');
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('evalQuotaFromCount', () => {
    test('次の日本時間の 0 時を resetsAt にする', () => {
      expect(mod.evalQuotaFromCount(3, 200, NOW)).toEqual({
        used: 3, limit: 200, resetsAt: '2026-11-26T15:00:00.000Z',
      });
    });

    test('月末・年末もくり上がる（日本時間で数える）', () => {
      // 12/31 23:59:59 JST
      const lastSecond = mod.evalQuotaFromCount(0, 200, Date.UTC(2026, 11, 31, 14, 59, 59)) as { resetsAt: string };
      expect(lastSecond.resetsAt).toBe('2026-12-31T15:00:00.000Z');
      // 1/1 0:00 JST は新しい日
      const newYear = mod.evalQuotaFromCount(0, 200, Date.UTC(2026, 11, 31, 15, 0, 0)) as { resetsAt: string };
      expect(newYear.resetsAt).toBe('2027-01-01T15:00:00.000Z');
    });

    test('日付のキーは日本の日付（UTC の 15 時で変わる）', () => {
      expect(mod.jstDay(Date.UTC(2026, 10, 26, 14, 59, 59))).toBe('2026-11-26');
      expect(mod.jstDay(Date.UTC(2026, 10, 26, 15, 0, 0))).toBe('2026-11-27');
    });

    test('used は limit を超えない', () => {
      expect(mod.evalQuotaFromCount(250, 200, NOW)).toMatchObject({ used: 200, limit: 200 });
    });
  });

  describe('GET /teacher/evaluation-quota', () => {
    test('今日のカウンタを読むだけで、増やさない', async () => {
      mockSend.mockImplementation(async (command) => {
        expect(command.constructor.name).toBe('GetCommand');
        expect(command.input.Key).toEqual({ classroomId: 'eval-quota#dev-test-teacher#2026-11-26' });
        return { Item: { classroomId: command.input.Key.classroomId, count: 52 } };
      });
      const res = await mod.handler(makeEvent('GET', '/teacher/evaluation-quota'));
      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.body!)).toEqual({
        quota: { used: 52, limit: 200, resetsAt: '2026-11-26T15:00:00.000Z' },
      });
      expect(mockSend).toHaveBeenCalledTimes(1);
    });

    test('まだ使っていない日は used 0', async () => {
      mockSend.mockResolvedValue({});
      const res = await mod.handler(makeEvent('GET', '/teacher/evaluation-quota'));
      expect(JSON.parse(res.body!).quota.used).toBe(0);
    });

    test('EVAL_DAILY_LIMIT で上限を変えられる', async () => {
      jest.resetModules();
      process.env.EVAL_DAILY_LIMIT = '7';
      mod = require('../handler');
      mockSend.mockResolvedValue({ Item: { count: 2 } });
      const res = await mod.handler(makeEvent('GET', '/teacher/evaluation-quota'));
      expect(JSON.parse(res.body!).quota).toMatchObject({ used: 2, limit: 7 });
    });

    test('トークンが無ければ 401', async () => {
      const event = makeEvent('GET', '/teacher/evaluation-quota');
      event.headers = { origin: 'http://localhost:8601' } as typeof event.headers;
      const res = await mod.handler(event);
      expect(res.statusCode).toBe(401);
      expect(mockSend).not.toHaveBeenCalled();
    });
  });

  describe('POST /classrooms/{id}/evaluate', () => {
    const body = {
      mode: 'describe',
      submissions: [{ seatNumber: 1, signals: {}, pseudocode: '◆ 旗' }],
    };

    const sendWithCount = (count: number) => async (command: { constructor: { name: string }; input: Record<string, unknown> }) => {
      if (command.constructor.name === 'GetCommand') {
        return { Item: { classroomId: 'c1', teacherSub: 'dev-test-teacher' } };
      }
      if (command.constructor.name === 'UpdateCommand') {
        expect(command.input.Key).toEqual({ classroomId: 'eval-quota#dev-test-teacher#2026-11-26' });
        return { Attributes: { count } };
      }
      throw new Error(`unexpected ${command.constructor.name}`);
    };

    test('応答に今までの項目と quota を返す', async () => {
      mockSend.mockImplementation(sendWithCount(48));
      mockCreate.mockResolvedValue({
        content: [{ type: 'text', text: '{"description":"ねこを動かす"}' }],
        usage: { input_tokens: 1, output_tokens: 1 },
      });
      const res = await mod.handler(makeEvent('POST', '/classrooms/c1/evaluate', body, { classroomId: 'c1' }));
      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.body!)).toEqual({
        mode: 'describe',
        description: 'ねこを動かす',
        quota: { used: 48, limit: 200, resetsAt: '2026-11-26T15:00:00.000Z' },
      });
    });

    test('上限を超えたら 400 で、Claude を呼ばない', async () => {
      mockSend.mockImplementation(sendWithCount(201));
      const res = await mod.handler(makeEvent('POST', '/classrooms/c1/evaluate', body, { classroomId: 'c1' }));
      expect(res.statusCode).toBe(400);
      expect(JSON.parse(res.body!).error).toContain('200 calls/day');
      expect(mockCreate).not.toHaveBeenCalled();
    });
  });
});
