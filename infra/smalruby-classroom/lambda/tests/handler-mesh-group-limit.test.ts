// このファイルをモジュールにするための宣言（#1144）。
export {};

/**
 * 課題のメッシュグループ人数上限 `meshGroupLimit`（issue #1255）。
 *
 * 守る性質:
 *
 * 1. 値は `6`（6 人まで）か `0`（制限なし）だけ。それ以外は 400（ValidationError）。
 * 2. 作成（POST /classrooms）と更新（PATCH /classrooms/{id}）で受け取って保存する。
 *    送らない作成も 6 を必ず書き込む。送らない更新は保存済みの値を変えない。
 * 3. 先生向けの一覧・詳細、生徒向けの lookup / join / verify-session の応答に含める。
 *    項目が無い既存の課題は制限なしとして 0 を返す（応答は常に 6 か 0）。
 * 4. 複製は元の保存値をそのまま写す（未設定なら未設定のまま = 制限なし）。
 * 5. 新しい課題を作るほかの経路（みんなの課題の取り込み）も 6 を書き込む。
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

const DEV_TOKEN = 'test-dev-bypass';
const FUTURE = () => Math.floor(Date.now() / 1000) + 3600;

const makeEvent = (method: string, path: string, body?: unknown, pathParameters: Record<string, string> = {}) => ({
  requestContext: { http: { method, path, sourceIp: `10.0.0.${Math.floor(Math.random() * 250)}` } },
  headers: { authorization: `Bearer ${DEV_TOKEN}`, origin: 'http://localhost:8601' },
  pathParameters,
  body: body === undefined ? undefined : JSON.stringify(body),
});

const classroom = (over: Row = {}): Row => ({
  classroomId: 'c1',
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

/**
 * Mock DynamoDB with one classroom. Lookups by id, by join code and by the
 * owner's teacherSub all find it; every other query is empty. UpdateCommand
 * echoes the stored item merged with the SET values (ReturnValues ALL_NEW).
 */
const useData = (item: Row) => {
  mockSend.mockImplementation((cmd: { constructor: { name: string }; input: Record<string, any> }) => {
    const name = cmd.constructor.name;
    const input = cmd.input;
    if (name === 'GetCommand' && input.TableName === 'Classrooms') {
      return Promise.resolve({ Item: input.Key.classroomId === item.classroomId ? item : undefined });
    }
    if (name === 'QueryCommand' && input.TableName === 'Classrooms'
      && (input.IndexName === 'teacherSub-index'
        || (input.IndexName === 'joinCode-index' && input.ExpressionAttributeValues[':jc'] === item.joinCode))) {
      return Promise.resolve({ Items: [item] });
    }
    if (name === 'QueryCommand') return Promise.resolve({ Items: [] });
    if (name === 'UpdateCommand' && input.TableName === 'Classrooms') {
      const attrs: Row = { ...item };
      for (const [nameKey, attr] of Object.entries(input.ExpressionAttributeNames || {})) {
        attrs[attr as string] = input.ExpressionAttributeValues[nameKey.replace('#attr', ':val')];
      }
      return Promise.resolve({ Attributes: attrs });
    }
    return Promise.resolve({});
  });
};

const commands = (name: string, table: string) =>
  mockSend.mock.calls.map((c) => c[0]).filter((cmd) => cmd.constructor.name === name && cmd.input.TableName === table);

let handler: (event: unknown) => Promise<{ statusCode?: number; body?: string }>;

beforeEach(() => {
  jest.resetModules();
  process.env.DEV_BYPASS_TOKEN = DEV_TOKEN;
  process.env.STAGE = 'stg';
  mockSend.mockReset();
  handler = require('../handler').handler;
});

const call = async (method: string, path: string, body?: unknown, params: Record<string, string> = {}) => {
  const res = await handler(makeEvent(method, path, body, params));
  return { status: res.statusCode, body: JSON.parse(res.body || '{}') };
};

describe('validateMeshGroupLimit / meshGroupLimitOf (issue #1255)', () => {
  test('6 と 0 だけを受け付け、未送信は undefined', () => {
    const { validateMeshGroupLimit } = require('../handler');
    expect(validateMeshGroupLimit(undefined)).toBeUndefined();
    expect(validateMeshGroupLimit(6)).toBe(6);
    expect(validateMeshGroupLimit(0)).toBe(0);
    for (const bad of [null, 5, 7, -1, 6.5, '6', '0', 'none', true]) {
      expect(() => validateMeshGroupLimit(bad)).toThrow('meshGroupLimit');
    }
  });

  test('項目が無い・不正な値の課題は 0（制限なし）', () => {
    const { meshGroupLimitOf } = require('../handler');
    expect(meshGroupLimitOf({})).toBe(0);
    expect(meshGroupLimitOf(undefined)).toBe(0);
    expect(meshGroupLimitOf({ meshGroupLimit: 'x' })).toBe(0);
    expect(meshGroupLimitOf({ meshGroupLimit: 0 })).toBe(0);
    expect(meshGroupLimitOf({ meshGroupLimit: 6 })).toBe(6);
  });
});

describe('POST /classrooms (issue #1255)', () => {
  const base = { className: '2年1組', assignmentName: '第4回', studentCount: 30 };

  test('送らなくても 6 を必ず保存して返す', async () => {
    useData(classroom());
    const { status, body } = await call('POST', '/classrooms', base);
    expect(status).toBe(201);
    expect(body.meshGroupLimit).toBe(6);
    expect(commands('PutCommand', 'Classrooms')[0].input.Item.meshGroupLimit).toBe(6);
  });

  test('0（制限なし）を保存して返す', async () => {
    useData(classroom());
    const { status, body } = await call('POST', '/classrooms', { ...base, meshGroupLimit: 0 });
    expect(status).toBe(201);
    expect(body.meshGroupLimit).toBe(0);
    expect(commands('PutCommand', 'Classrooms')[0].input.Item.meshGroupLimit).toBe(0);
  });

  test('不正な値は 400 で作らない', async () => {
    useData(classroom());
    const { status, body } = await call('POST', '/classrooms', { ...base, meshGroupLimit: 4 });
    expect(status).toBe(400);
    expect(body.error).toContain('meshGroupLimit');
    expect(commands('PutCommand', 'Classrooms')).toHaveLength(0);
  });
});

describe('PATCH /classrooms/{id} (issue #1255)', () => {
  test('0 に変えて返す', async () => {
    useData(classroom());
    const { status, body } = await call('PATCH', '/classrooms/c1', { meshGroupLimit: 0 }, { classroomId: 'c1' });
    expect(status).toBe(200);
    expect(body.meshGroupLimit).toBe(0);
    const [update] = commands('UpdateCommand', 'Classrooms');
    expect(Object.values(update.input.ExpressionAttributeNames)).toContain('meshGroupLimit');
  });

  test('送らない更新は値を変えず、保存済みの値を返す（無ければ 0）', async () => {
    useData(classroom({ meshGroupLimit: 6 }));
    const res = await call('PATCH', '/classrooms/c1', { className: '2年2組' }, { classroomId: 'c1' });
    expect(res.body.meshGroupLimit).toBe(6);
    expect(Object.values(commands('UpdateCommand', 'Classrooms')[0].input.ExpressionAttributeNames))
      .not.toContain('meshGroupLimit');

    mockSend.mockReset();
    useData(classroom());
    expect((await call('PATCH', '/classrooms/c1', { className: '2年2組' }, { classroomId: 'c1' })).body.meshGroupLimit).toBe(0);
  });

  test('不正な値は 400 で更新しない', async () => {
    useData(classroom());
    const { status } = await call('PATCH', '/classrooms/c1', { meshGroupLimit: 'none' }, { classroomId: 'c1' });
    expect(status).toBe(400);
    expect(commands('UpdateCommand', 'Classrooms')).toHaveLength(0);
  });
});

describe('先生向けの一覧・詳細 (issue #1255)', () => {
  test('GET /classrooms は値を返し、項目の無い既存の課題は 0（制限なし）', async () => {
    useData(classroom({ meshGroupLimit: 6 }));
    expect((await call('GET', '/classrooms')).body.classrooms[0].meshGroupLimit).toBe(6);
    mockSend.mockReset();
    useData(classroom());
    expect((await call('GET', '/classrooms')).body.classrooms[0].meshGroupLimit).toBe(0);
  });

  test('GET /classrooms/{id} は値を返し、項目の無い既存の課題は 0（制限なし）', async () => {
    useData(classroom({ meshGroupLimit: 6 }));
    expect((await call('GET', '/classrooms/c1', undefined, { classroomId: 'c1' })).body.meshGroupLimit).toBe(6);
    mockSend.mockReset();
    useData(classroom());
    expect((await call('GET', '/classrooms/c1', undefined, { classroomId: 'c1' })).body.meshGroupLimit).toBe(0);
  });
});

describe('生徒向けの lookup / join / verify-session (issue #1255)', () => {
  test('lookup は値を返し、項目の無い既存の課題は 0（制限なし）', async () => {
    useData(classroom({ meshGroupLimit: 6 }));
    const res = await call('POST', '/classrooms/lookup', { joinCode: 'abc234' });
    expect(res.status).toBe(200);
    expect(res.body.meshGroupLimit).toBe(6);
    mockSend.mockReset();
    useData(classroom());
    expect((await call('POST', '/classrooms/lookup', { joinCode: 'abc234' })).body.meshGroupLimit).toBe(0);
  });

  test('join は値を返し、項目の無い既存の課題は 0（制限なし）', async () => {
    useData(classroom({ meshGroupLimit: 6 }));
    const res = await call('POST', '/classrooms/join', { joinCode: 'abc234', seatNumber: 3 });
    expect(res.status).toBe(200);
    expect(res.body.meshGroupLimit).toBe(6);
    mockSend.mockReset();
    useData(classroom());
    expect((await call('POST', '/classrooms/join', { joinCode: 'abc234', seatNumber: 3 })).body.meshGroupLimit).toBe(0);
  });

  test('verify-session は値を返し（参加後の先生の変更が届く）、項目の無い既存の課題は 0（制限なし）', async () => {
    const verify = async (item: Row) => {
      mockSend.mockReset();
      useData(item);
      const base = mockSend.getMockImplementation()!;
      mockSend.mockImplementation((cmd: { constructor: { name: string }; input: Record<string, any> }) =>
        (cmd.constructor.name === 'QueryCommand' && cmd.input.IndexName === 'sessionToken-index'
          ? Promise.resolve({ Items: [{ classroomId: item.classroomId, memberId: 'm1', sessionToken: 'st-1' }] })
          : base(cmd)));
      const res = await handler({
        ...makeEvent('POST', '/classrooms/verify-session'),
        headers: { authorization: 'Bearer st-1', origin: 'http://localhost:8601' },
      });
      return { status: res.statusCode, body: JSON.parse(res.body || '{}') };
    };
    const res = await verify(classroom({ meshGroupLimit: 6 }));
    expect(res.status).toBe(200);
    expect(res.body.meshGroupLimit).toBe(6);
    expect((await verify(classroom())).body.meshGroupLimit).toBe(0);
  });
});

describe('複製 (issue #1255)', () => {
  test('保存値をそのまま写す（0 も 6 も）', async () => {
    for (const value of [0, 6]) {
      mockSend.mockReset();
      useData(classroom({ meshGroupLimit: value }));
      const res = await call('POST', '/classrooms/c1/duplicate', {}, { classroomId: 'c1' });
      expect(res.status).toBe(201);
      expect(commands('PutCommand', 'Classrooms')[0].input.Item.meshGroupLimit).toBe(value);
      // 先生の画面は複製の応答をそのまま一覧に足すので、応答にも含める。
      expect(res.body.meshGroupLimit).toBe(value);
    }
  });

  test('未設定の課題（制限なし）は未設定のまま写し、応答は 0', async () => {
    useData(classroom());
    const res = await call('POST', '/classrooms/c1/duplicate', {}, { classroomId: 'c1' });
    expect(commands('PutCommand', 'Classrooms')[0].input.Item).not.toHaveProperty('meshGroupLimit');
    expect(res.body.meshGroupLimit).toBe(0);
  });
});
