// このファイルをモジュールにするための宣言（#1144）。
export {};

/**
 * `GET /classrooms/{classroomId}/members` の任意フィールド `aiUsage` (issue #1311)。
 *
 * 1. relay の表（席の「今の状況」+ 集計表）から席ごとの上限と今日の回数を返す。
 * 2. relay の表が読めないときは `aiUsage: null` でメンバー一覧はふつうに返す（fail-open）。
 * 3. 既存のフィールドは変えない。
 */

const mockSend = jest.fn();
jest.mock('@aws-sdk/lib-dynamodb', () => {
  const actual = jest.requireActual('@aws-sdk/lib-dynamodb');
  return {
    ...actual,
    DynamoDBDocumentClient: { from: () => ({ send: mockSend }) },
  };
});

const DEV_TOKEN = 'test-dev-bypass';
const SELF_SUB = 'dev-test-teacher';

type Row = Record<string, any>;

const makeEvent = (classroomId: string) => ({
  requestContext: { http: { method: 'GET', path: `/classrooms/${classroomId}/members`, sourceIp: '127.0.0.1' } },
  headers: { authorization: `Bearer ${DEV_TOKEN}`, origin: 'http://localhost:8601' },
  pathParameters: { classroomId },
});

const classroom = { classroomId: 'c1', teacherSub: SELF_SUB, className: '1組', status: 'active', studentCount: 40 };
const members = [
  { classroomId: 'c1', memberId: 'seat-03', displayName: 'A', role: 'student', joinedAt: '2026-11-01T00:00:00Z' },
  { classroomId: 'c1', memberId: 'seat-04', displayName: 'B', role: 'student', joinedAt: '2026-11-01T00:00:00Z' },
];

const useTables = (opts: { relayFails?: boolean } = {}) => {
  const resetAt = Math.floor(Date.now() / 1000) + 600;
  mockSend.mockImplementation((cmd: { constructor: { name: string }; input: Record<string, any> }) => {
    const name = cmd.constructor.name;
    const input = cmd.input;
    if (name === 'GetCommand' && input.TableName === 'Classrooms') return Promise.resolve({ Item: classroom });
    if (name === 'QueryCommand' && input.TableName === 'ClassroomMemberships') return Promise.resolve({ Items: members });
    if (name === 'QueryCommand' && input.TableName === 'ClassroomSubmissions') return Promise.resolve({ Items: [] });
    if (name === 'BatchGetCommand') {
      if (opts.relayFails) return Promise.reject(new Error('AccessDenied'));
      const keys = input.RequestItems.RubyteeRelayRateLimit.Keys as Row[];
      expect(keys).toEqual([
        { sourceIp: 'seat#c1:3#current', windowStart: 0 },
        { sourceIp: 'seat#c1:4#current', windowStart: 0 },
      ]);
      return Promise.resolve({
        Responses: {
          RubyteeRelayRateLimit: [
            { sourceIp: 'seat#c1:3#current', windowStart: 0, count: 12, limit: 40, windowMinutes: 35, resetAt },
          ],
        },
      });
    }
    if (name === 'QueryCommand' && input.TableName === 'RubyteeRelayUsage') {
      expect(input.ExpressionAttributeValues[':pk']).toBe('classroom#c1');
      return Promise.resolve({
        Items: [{ pk: 'classroom#c1', sk: `${input.ExpressionAttributeValues[':today']}seat#3#genai-takeover`, requests: 15, succeeded: 14, failed: 1 }],
      });
    }
    return Promise.resolve({});
  });
};

describe('GET /classrooms/{id}/members aiUsage (issue #1311)', () => {
  let handler: (event: unknown) => Promise<{ statusCode?: number; body?: string }>;

  beforeEach(() => {
    jest.resetModules();
    process.env.DEV_BYPASS_TOKEN = DEV_TOKEN;
    process.env.STAGE = 'stg';
    process.env.RUBYTEE_RATE_LIMIT_TABLE_NAME = 'RubyteeRelayRateLimit';
    process.env.RUBYTEE_USAGE_TABLE_NAME = 'RubyteeRelayUsage';
    mockSend.mockReset();
    handler = require('../handler').handler;
  });

  afterEach(() => {
    delete process.env.RUBYTEE_RATE_LIMIT_TABLE_NAME;
    delete process.env.RUBYTEE_USAGE_TABLE_NAME;
  });

  test('席ごとの上限と今日の回数を返す', async () => {
    useTables();
    const res = await handler(makeEvent('c1'));
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body!);
    const [a, b] = body.members;
    expect(a.memberId).toBe('seat-03');
    expect(a.aiUsage.takeover).toMatchObject({ used: 12, limit: 40, windowMinutes: 35, limited: false });
    expect(a.aiUsage.takeover.resetAt).toMatch(/\+09:00$/);
    expect(a.aiUsage.today.takeover).toEqual({ requests: 15, rateLimited: 0, succeeded: 14, failed: 1 });
    expect(a.aiUsage.today.chat).toEqual({ requests: 0, rateLimited: 0, succeeded: 0, failed: 0 });
    expect(b.aiUsage.takeover).toEqual({ used: 0, limit: 40, windowMinutes: 35, resetAt: null, limited: false });
    // 既存フィールドは今のまま
    expect(a).toMatchObject({ displayName: 'A', role: 'student', hasSubmission: false, submissionStatus: null });
    expect(body.studentCount).toBe(40);
  });

  test('relay の表が読めないときは aiUsage: null でメンバー一覧を返す', async () => {
    useTables({ relayFails: true });
    jest.spyOn(console, 'error').mockImplementation(() => {});
    const res = await handler(makeEvent('c1'));
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body!);
    expect(body.members).toHaveLength(2);
    expect(body.members.every((m: Row) => m.aiUsage === null)).toBe(true);
  });

  test('relay の表名が設定されていなければ relay を読まずに aiUsage: null', async () => {
    delete process.env.RUBYTEE_RATE_LIMIT_TABLE_NAME;
    jest.resetModules();
    handler = require('../handler').handler;
    useTables();
    const res = await handler(makeEvent('c1'));
    const body = JSON.parse(res.body!);
    expect(body.members.every((m: Row) => m.aiUsage === null)).toBe(true);
    expect(mockSend.mock.calls.some(c => c[0].constructor.name === 'BatchGetCommand')).toBe(false);
  });
});
