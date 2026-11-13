// このファイルをモジュールにするための宣言（#1144）。
export {};

/**
 * 生徒の参加コードの確認（POST /classrooms/lookup）は、課題が属するクラス（学級）の
 * `groupId` を返す（issue #1800）。生徒が同じ学級の別の課題に入ったときに、前回の番号を
 * 引けるようにするため。
 *
 * 守る性質:
 *
 * 1. クラスに属する課題は、そのクラスの groupId を返す。
 * 2. クラスに属さない課題・クラスが見つからない課題は null を返す。
 * 3. 足すのはフィールドだけ（既存のフィールドはそのまま）。
 */

const mockSend = jest.fn();
jest.mock('@aws-sdk/lib-dynamodb', () => {
  const actual = jest.requireActual('@aws-sdk/lib-dynamodb');
  return {
    ...actual,
    DynamoDBDocumentClient: { from: () => ({ send: mockSend }) },
  };
});

type Row = Record<string, any>;

const FUTURE = () => Math.floor(Date.now() / 1000) + 3600;

const group = (over: Row = {}): Row => ({
  groupId: 'g1',
  teacherSub: 'dev-test-teacher',
  name: '2年1組',
  year: 2026,
  status: 'active',
  schemaVersion: 2,
  topics: [],
  studentCount: 30,
  ttl: FUTURE(),
  ...over,
});

const classroom = (over: Row = {}): Row => ({
  classroomId: 'c1',
  groupId: 'g1',
  status: 'active',
  teacherSub: 'dev-test-teacher',
  assignmentName: '第3回',
  className: '2年1組',
  joinCode: 'abc234',
  studentCount: 30,
  createdAt: '2026-10-08T00:00:00.000Z',
  ttl: FUTURE(),
  ...over,
});

const useData = (g: Row | undefined, c: Row) => {
  mockSend.mockImplementation((cmd: { constructor: { name: string }; input: Record<string, any> }) => {
    const name = cmd.constructor.name;
    const input = cmd.input;
    if (name === 'GetCommand' && input.TableName === 'ClassroomGroups') {
      return Promise.resolve({ Item: g && input.Key.groupId === g.groupId ? g : undefined });
    }
    if (name === 'QueryCommand' && input.TableName === 'Classrooms'
      && input.IndexName === 'joinCode-index' && input.ExpressionAttributeValues[':jc'] === c.joinCode) {
      return Promise.resolve({ Items: [c] });
    }
    if (name === 'QueryCommand') return Promise.resolve({ Items: [] });
    return Promise.resolve({});
  });
};

let handler: (event: unknown) => Promise<{ statusCode?: number; body?: string }>;

beforeEach(() => {
  jest.resetModules();
  process.env.STAGE = 'stg';
  mockSend.mockReset();
  handler = require('../handler').handler;
});

const lookup = async () => {
  const res = await handler({
    requestContext: {
      http: { method: 'POST', path: '/classrooms/lookup', sourceIp: `10.0.1.${Math.floor(Math.random() * 250)}` },
    },
    headers: { origin: 'http://localhost:8601' },
    pathParameters: {},
    body: JSON.stringify({ joinCode: 'abc234' }),
  });
  return { status: res.statusCode, body: JSON.parse(res.body || '{}') };
};

describe('POST /classrooms/lookup の groupId (issue #1800)', () => {
  test('クラスに属する課題はクラスの groupId を返す', async () => {
    useData(group(), classroom());
    const res = await lookup();
    expect(res.status).toBe(200);
    expect(res.body.groupId).toBe('g1');
    // 既存のフィールドはそのまま
    expect(res.body.classroomId).toBe('c1');
    expect(res.body.className).toBe('2年1組');
    expect(res.body.classYear).toBe(2026);
  });

  test('クラスに属さない課題は null を返す', async () => {
    useData(undefined, classroom({ groupId: undefined }));
    const res = await lookup();
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('groupId', null);
    expect(res.body.classroomId).toBe('c1');
  });

  test('クラスが見つからない課題は null を返す', async () => {
    useData(undefined, classroom({ groupId: 'g-missing' }));
    const res = await lookup();
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('groupId', null);
  });
});
