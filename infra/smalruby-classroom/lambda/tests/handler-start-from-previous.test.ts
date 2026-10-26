// このファイルをモジュールにするための宣言（#1144）。
export {};

/**
 * 課題設定「前回の提出物から始めさせる」(`startFromPrevious`, issue #1202).
 *
 * 守る性質:
 *
 * 1. PUT /assignment の `startFromPrevious` (boolean) を課題の item に保存する。
 *    ページもスターターも無い課題でも設定は残す (続きものの 2 時間目は説明が無いことがある)。
 * 2. `startFromPrevious` を送らない PUT (古いクライアント) は既存の値を変えない。
 * 3. boolean 以外は 400。
 * 4. GET /assignment と GET /continuable-submissions が値を返す (未設定は false)。
 */

const mockSend = jest.fn();
jest.mock('@aws-sdk/lib-dynamodb', () => {
  const actual = jest.requireActual('@aws-sdk/lib-dynamodb');
  return {
    ...actual,
    DynamoDBDocumentClient: { from: () => ({ send: mockSend }) },
  };
});
jest.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: jest.fn(async (_client: unknown, cmd: { input: { Key: string } }) => `https://signed.example/${cmd.input.Key}`),
}));
jest.mock('@aws-sdk/client-s3', () => {
  const actual = jest.requireActual('@aws-sdk/client-s3');
  return {
    ...actual,
    S3Client: jest.fn(() => ({ send: jest.fn(async () => ({})) })),
  };
});

type Row = Record<string, any>;

const DEV_TOKEN = 'test-dev-bypass';
const SESSION = 'student-session-token';

const makeEvent = (method: string, path: string, classroomId: string, token: string, body?: unknown) => ({
  requestContext: { http: { method, path, sourceIp: '127.0.0.1' } },
  headers: { authorization: `Bearer ${token}`, origin: 'http://localhost:8601' },
  pathParameters: { classroomId },
  body: body === undefined ? undefined : JSON.stringify(body),
});

const classroom = (over: Row = {}): Row => ({
  classroomId: 'c1',
  status: 'active',
  teacherSub: 'dev-test-teacher',
  assignmentName: '第2回',
  createdAt: '2026-10-08T00:00:00.000Z',
  ttl: Math.floor(Date.now() / 1000) + 3600,
  ...over,
});

const member = { classroomId: 'c1', memberId: 'seat-03', sessionToken: SESSION };

const useClassroom = (item: Row) => {
  mockSend.mockImplementation((cmd: { constructor: { name: string }; input: Record<string, any> }) => {
    const name = cmd.constructor.name;
    const input = cmd.input;
    if (name === 'GetCommand' && input.TableName === 'Classrooms') return Promise.resolve({ Item: item });
    if (name === 'QueryCommand' && input.IndexName === 'sessionToken-index') {
      return Promise.resolve({ Items: [member] });
    }
    if (name === 'QueryCommand') return Promise.resolve({ Items: [] });
    return Promise.resolve({});
  });
};

const updateCalls = () =>
  mockSend.mock.calls.map((c) => c[0]).filter((cmd) => cmd.constructor.name === 'UpdateCommand' && cmd.input.TableName === 'Classrooms');

describe('assignment setting startFromPrevious (issue #1202)', () => {
  let handler: (event: unknown) => Promise<{ statusCode?: number; body?: string }>;

  beforeEach(() => {
    jest.resetModules();
    process.env.DEV_BYPASS_TOKEN = DEV_TOKEN;
    process.env.STAGE = 'stg';
    mockSend.mockReset();
    handler = require('../handler').handler;
  });

  const put = async (body: unknown) => {
    const res = await handler(makeEvent('PUT', '/classrooms/c1/assignment', 'c1', DEV_TOKEN, body));
    return { status: res.statusCode, body: JSON.parse(res.body || '{}') };
  };

  const get = async (path: string, token: string) => {
    const res = await handler(makeEvent('GET', path, 'c1', token));
    return { status: res.statusCode, body: JSON.parse(res.body || '{}') };
  };

  test('PUT で ON にすると課題の item に保存し、レスポンスにも返す', async () => {
    useClassroom(classroom());
    const { status, body } = await put({ pages: [{ text: '続きを作ろう' }], startFromPrevious: true });
    expect(status).toBe(200);
    expect(body.startFromPrevious).toBe(true);
    const [update] = updateCalls();
    expect(update.input.UpdateExpression).toContain('startFromPrevious = :sfp');
    expect(update.input.ExpressionAttributeValues[':sfp']).toBe(true);
  });

  test('PUT で OFF にすると false を保存する', async () => {
    useClassroom(classroom({ startFromPrevious: true }));
    const { body } = await put({ pages: [{ text: 'p' }], startFromPrevious: false });
    expect(body.startFromPrevious).toBe(false);
    expect(updateCalls()[0].input.ExpressionAttributeValues[':sfp']).toBe(false);
  });

  test('startFromPrevious を送らない PUT は既存の値を変えない', async () => {
    useClassroom(classroom({ startFromPrevious: true }));
    const { body } = await put({ pages: [{ text: 'p' }] });
    expect(body.startFromPrevious).toBe(true);
    expect(updateCalls()[0].input.UpdateExpression).not.toContain('startFromPrevious');
  });

  test('ページもスターターも無くても設定は残す', async () => {
    useClassroom(classroom());
    const { status, body } = await put({ pages: [], startFromPrevious: true });
    expect(status).toBe(200);
    expect(body.assignment).toBeNull();
    expect(body.startFromPrevious).toBe(true);
    const [update] = updateCalls();
    expect(update.input.UpdateExpression).toContain('REMOVE assignment');
    expect(update.input.ExpressionAttributeValues[':sfp']).toBe(true);
  });

  test('boolean 以外は 400', async () => {
    useClassroom(classroom());
    const { status } = await put({ pages: [{ text: 'p' }], startFromPrevious: 'yes' });
    expect(status).toBe(400);
    expect(updateCalls()).toHaveLength(0);
  });

  test('GET /assignment は先生にも生徒にも値を返す (課題の中身が無くても)', async () => {
    useClassroom(classroom({ startFromPrevious: true }));
    const teacher = await get('/classrooms/c1/assignment', DEV_TOKEN);
    expect(teacher.status).toBe(200);
    expect(teacher.body.assignment).toBeNull();
    expect(teacher.body.startFromPrevious).toBe(true);
    const student = await get('/classrooms/c1/assignment', SESSION);
    expect(student.body.startFromPrevious).toBe(true);
  });

  test('GET /continuable-submissions は値を返し、未設定は false', async () => {
    useClassroom(classroom({ startFromPrevious: true }));
    const on = await get('/classrooms/c1/continuable-submissions', SESSION);
    expect(on.status).toBe(200);
    expect(on.body.startFromPrevious).toBe(true);

    useClassroom(classroom());
    const off = await get('/classrooms/c1/continuable-submissions', SESSION);
    expect(off.body.startFromPrevious).toBe(false);
  });
});

describe('POST /classrooms/{id}/duplicate carries startFromPrevious (issue #1202)', () => {
  test('再利用した課題にも設定を引き継ぐ', async () => {
    jest.resetModules();
    process.env.DEV_BYPASS_TOKEN = DEV_TOKEN;
    process.env.STAGE = 'stg';
    mockSend.mockReset();
    const { handler } = require('../handler');
    useClassroom(classroom({ startFromPrevious: true, className: '2年1組', studentCount: 30 }));
    const res = await handler(makeEvent('POST', '/classrooms/c1/duplicate', 'c1', DEV_TOKEN, {}));
    expect(res.statusCode).toBe(201);
    const put = mockSend.mock.calls.map((c) => c[0]).find((cmd) => cmd.constructor.name === 'PutCommand');
    expect(put.input.Item.startFromPrevious).toBe(true);
  });
});
