// このファイルをモジュールにするための宣言（#1144）。
export {};

/**
 * 課題のレッスンの設定と進み具合（issue #1597 / EPIC #1592）の handler 分。
 *
 * 守る性質:
 *
 * 1. PUT /assignment は任意の `lesson` を保存する。送らない PUT（古い画面）は値を保ち、
 *    null で外す。GET /assignment・課題一覧・複製にも載る。lesson の無い課題は今までどおり。
 * 2. PUT /classrooms/{id}/lesson-progress（生徒のセッショントークン）は席 × 課題の 1 件を
 *    マージして保存する（対象外のチャレンジは捨てる・できたは消えない・時刻は動かない）。
 *    TTL は課題の TTL を写す。変わらない送信は書き込まない。アーカイブ済み・lesson の無い課題は拒む。
 * 3. GET /classrooms/{id}/lesson-progress（先生）は席ごとの一覧を返す。
 * 4. 不正な入力・送りすぎは 400。
 * 5. みんなの課題: 共有・取り込みにレッスンの設定を載せる。
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
    S3Client: jest.fn(() => ({ send: jest.fn(async () => ({ ContentLength: 10 })) })),
  };
});

type Row = Record<string, any>;

const DEV_TOKEN = 'test-dev-bypass';
const SESSION = 'student-session-token';
const CLASS_TTL = Math.floor(Date.now() / 1000) + 3600;
const ME = 'seat-03';
const PROGRESS_TABLE = 'ClassroomLessonProgress';

const lesson = (over: Row = {}): Row => ({
  courseId: 'kyou-kara-programmer',
  challengeIds: ['a1', 'a2', 'a3'],
  requiredChallengeIds: ['a2'],
  completion: { type: 'all' },
  submitWork: true,
  scoring: { total: 100, requiredPoints: 70, optionalPoints: 30 },
  ...over,
});

const classroom = (over: Row = {}): Row => ({
  classroomId: 'c1',
  status: 'active',
  teacherSub: 'dev-test-teacher',
  assignmentName: '第3回',
  className: '2年1組',
  studentCount: 30,
  joinCode: 'abcdef',
  createdAt: '2026-10-08T00:00:00.000Z',
  ttl: CLASS_TTL,
  ...over,
});

const makeEvent = (method: string, path: string, pathParameters: Record<string, string>, token: string, body?: unknown) => ({
  requestContext: { http: { method, path, sourceIp: '127.0.0.1' } },
  headers: { authorization: `Bearer ${token}`, origin: 'http://localhost:8601' },
  pathParameters,
  body: body === undefined ? undefined : JSON.stringify(body),
});

interface Data {
  item: Row;
  progress?: Row[];
  shared?: Row;
  group?: Row;
  /** 送信するセッションの席に、いま座っている生徒の参加時刻。 */
  joinedAt?: string;
  memberships?: Row[];
}

const JOINED = '2026-11-10T00:00:00.000Z';

const useData = ({ item, progress = [], shared, group, joinedAt = JOINED, memberships = [] }: Data) => {
  mockSend.mockImplementation((cmd: { constructor: { name: string }; input: Record<string, any> }) => {
    const name = cmd.constructor.name;
    const input = cmd.input;
    if (name === 'GetCommand' && input.TableName === 'Classrooms') {
      return Promise.resolve({ Item: input.Key.classroomId === item.classroomId ? item : undefined });
    }
    if (name === 'GetCommand' && input.TableName === PROGRESS_TABLE) {
      return Promise.resolve({
        Item: progress.find(p => p.classroomId === input.Key.classroomId && p.memberId === input.Key.memberId),
      });
    }
    if (name === 'GetCommand' && input.TableName === 'SharedAssignments') {
      return Promise.resolve({ Item: shared });
    }
    if (name === 'GetCommand' && input.TableName === 'ClassroomGroups') {
      return Promise.resolve({ Item: group });
    }
    if (name === 'QueryCommand' && input.IndexName === 'sessionToken-index') {
      return Promise.resolve({ Items: [{ classroomId: 'c1', memberId: ME, sessionToken: SESSION, joinedAt }] });
    }
    if (name === 'QueryCommand' && input.TableName === 'ClassroomMemberships') {
      return Promise.resolve({ Items: memberships.filter(m => m.classroomId === input.ExpressionAttributeValues[':cid']) });
    }
    if (name === 'QueryCommand' && input.TableName === PROGRESS_TABLE) {
      return Promise.resolve({ Items: progress.filter(p => p.classroomId === input.ExpressionAttributeValues[':cid']) });
    }
    if (name === 'QueryCommand') return Promise.resolve({ Items: [] });
    if (name === 'UpdateCommand') return Promise.resolve({ Attributes: { ...item } });
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
  process.env.LESSON_PROGRESS_TABLE_NAME = PROGRESS_TABLE;
  mockSend.mockReset();
  handler = require('../handler').handler;
});

const call = async (method: string, path: string, token: string, body?: unknown, params: Record<string, string> = {}) => {
  const res = await handler(makeEvent(method, path, { classroomId: 'c1', ...params }, token, body));
  return { status: res.statusCode, body: JSON.parse(res.body || '{}') };
};

describe('assignment lesson setting', () => {
  test('PUT で保存し、レスポンスに返す', async () => {
    useData({ item: classroom() });
    const { status, body } = await call('PUT', '/classrooms/c1/assignment', DEV_TOKEN, { pages: [], lesson: lesson() });
    expect(status).toBe(200);
    expect(body.lesson).toEqual(lesson());
    const [update] = commands('UpdateCommand', 'Classrooms');
    expect(update.input.UpdateExpression).toContain('lesson = :lesson');
    expect(update.input.ExpressionAttributeValues[':lesson']).toEqual(lesson());
  });

  test('送らない PUT（古い画面）は保存値を変えない', async () => {
    useData({ item: classroom({ lesson: lesson() }) });
    const { body } = await call('PUT', '/classrooms/c1/assignment', DEV_TOKEN, { pages: [{ text: 'p' }] });
    expect(body.lesson).toEqual(lesson());
    const [update] = commands('UpdateCommand', 'Classrooms');
    expect(update.input.UpdateExpression).not.toContain('lesson');
  });

  test('null で外す', async () => {
    useData({ item: classroom({ lesson: lesson() }) });
    const { body } = await call('PUT', '/classrooms/c1/assignment', DEV_TOKEN, { pages: [{ text: 'p' }], lesson: null });
    expect(body.lesson).toBeNull();
    const [update] = commands('UpdateCommand', 'Classrooms');
    expect(update.input.UpdateExpression).toContain('REMOVE lesson');
  });

  test('不正な設定は 400 で保存しない', async () => {
    useData({ item: classroom() });
    const { status } = await call('PUT', '/classrooms/c1/assignment', DEV_TOKEN, {
      pages: [], lesson: lesson({ requiredChallengeIds: ['zz'] }),
    });
    expect(status).toBe(400);
    expect(commands('UpdateCommand', 'Classrooms')).toHaveLength(0);
  });

  test('lesson の無い課題（いままでの課題）は GET で lesson: null、ほかは今までどおり', async () => {
    useData({ item: classroom({ assignment: { pages: [{ text: 'p' }], updatedAt: 'x' } }) });
    const { status, body } = await call('GET', '/classrooms/c1/assignment', DEV_TOKEN);
    expect(status).toBe(200);
    expect(body.lesson).toBeNull();
    expect(body.assignment.pages).toEqual([{ text: 'p', imageKey: null, imageUrl: null }]);
  });

  test('ページの無いレッスンだけの課題も GET（生徒）で lesson を返す', async () => {
    useData({ item: classroom({ lesson: lesson() }) });
    const { body } = await call('GET', '/classrooms/c1/assignment', SESSION);
    expect(body.assignment).toBeNull();
    expect(body.lesson).toEqual(lesson());
  });

  test('課題の詳細に hasLesson が載る', async () => {
    useData({ item: classroom({ lesson: lesson() }) });
    const { body } = await call('GET', '/classrooms/c1', DEV_TOKEN);
    expect(body.hasLesson).toBe(true);
  });

  test('複製はレッスンの設定も写す（進み具合は写さない）', async () => {
    useData({ item: classroom({ lesson: lesson() }) });
    const { status } = await call('POST', '/classrooms/c1/duplicate', DEV_TOKEN, {});
    expect(status).toBe(201);
    const puts = commands('PutCommand', 'Classrooms');
    expect(puts[0].input.Item.lesson).toEqual(lesson());
    expect(JSON.parse((await handler(makeEvent('POST', '/classrooms/c1/duplicate', { classroomId: 'c1' }, DEV_TOKEN, {}))).body || '{}').hasLesson).toBe(true);
    expect(commands('PutCommand', PROGRESS_TABLE)).toHaveLength(0);
  });
});

describe('PUT /classrooms/{id}/lesson-progress (student)', () => {
  test('はじめての送信: 対象外のチャレンジを捨て、課題の TTL を写して保存する', async () => {
    useData({ item: classroom({ lesson: lesson() }) });
    const { status, body } = await call('PUT', '/classrooms/c1/lesson-progress', SESSION, {
      challenges: {
        a1: { completedAt: '2026-11-10T02:00:00Z', before: true },
        other: { completedAt: '2026-11-10T02:00:00Z' },
      },
      current: { challengeId: 'a2', openedAt: '2026-11-10T02:10:00Z' },
    });
    expect(status).toBe(200);
    expect(body.challenges).toEqual({ a1: { completedAt: '2026-11-10T02:00:00.000Z', before: true } });
    expect(body.current).toEqual({ challengeId: 'a2', openedAt: '2026-11-10T02:10:00.000Z' });
    const [put] = commands('PutCommand', PROGRESS_TABLE);
    expect(put.input.Item).toMatchObject({ classroomId: 'c1', memberId: ME, ttl: CLASS_TTL, version: 1, occupantJoinedAt: JOINED });
    expect(put.input.ConditionExpression).toBe('attribute_not_exists(memberId)');
  });

  test('2 回目: できたは消えず、時刻は動かない（version で楽観ロック）', async () => {
    useData({
      item: classroom({ lesson: lesson() }),
      progress: [{
        classroomId: 'c1', memberId: ME, version: 4, ttl: CLASS_TTL, occupantJoinedAt: JOINED,
        challenges: { a1: { completedAt: '2026-11-10T02:00:00.000Z', before: false } },
        current: null, updatedAt: '2026-11-10T02:00:00.000Z',
      }],
    });
    const { body } = await call('PUT', '/classrooms/c1/lesson-progress', SESSION, {
      challenges: {
        a1: { completedAt: '2026-11-10T02:30:00Z' },
        a2: { completedAt: '2026-11-10T02:40:00Z' },
      },
    });
    expect(body.challenges.a1.completedAt).toBe('2026-11-10T02:00:00.000Z');
    expect(body.challenges.a2.completedAt).toBe('2026-11-10T02:40:00.000Z');
    const [put] = commands('PutCommand', PROGRESS_TABLE);
    expect(put.input.Item.version).toBe(5);
    expect(put.input.ConditionExpression).toBe('version = :prev');
    expect(put.input.ExpressionAttributeValues[':prev']).toBe(4);
  });

  test('同じ内容の送信は書き込まない', async () => {
    useData({
      item: classroom({ lesson: lesson() }),
      progress: [{
        classroomId: 'c1', memberId: ME, version: 1, ttl: CLASS_TTL, occupantJoinedAt: JOINED,
        challenges: { a1: { completedAt: '2026-11-10T02:00:00.000Z', before: false } },
        current: null, updatedAt: '2026-11-10T02:00:00.000Z',
      }],
    });
    const { status, body } = await call('PUT', '/classrooms/c1/lesson-progress', SESSION, {
      challenges: { a1: { completedAt: '2026-11-10T02:00:00Z' } },
    });
    expect(status).toBe(200);
    expect(body.updatedAt).toBe('2026-11-10T02:00:00.000Z');
    expect(commands('PutCommand', PROGRESS_TABLE)).toHaveLength(0);
  });

  test('はじめての {} は空の行を書かずに空の記録を返す', async () => {
    useData({ item: classroom({ lesson: lesson() }) });
    const { status, body } = await call('PUT', '/classrooms/c1/lesson-progress', SESSION, {});
    expect(status).toBe(200);
    expect(body).toEqual({ memberId: ME, seatNumber: 3, challenges: {}, current: null, updatedAt: null });
    expect(commands('PutCommand', PROGRESS_TABLE)).toHaveLength(0);
  });

  test('はじめての送信が対象外のチャレンジだけなら書かない', async () => {
    useData({ item: classroom({ lesson: lesson() }) });
    await call('PUT', '/classrooms/c1/lesson-progress', SESSION, {
      challenges: { other: { completedAt: '2026-11-10T02:00:00Z' } },
    });
    expect(commands('PutCommand', PROGRESS_TABLE)).toHaveLength(0);
  });

  test('席に別の生徒が座ったら、前の人の進み具合を引き継がず作り直す', async () => {
    useData({
      item: classroom({ lesson: lesson() }),
      joinedAt: '2026-11-12T00:00:00.000Z',
      progress: [{
        classroomId: 'c1', memberId: ME, version: 7, ttl: CLASS_TTL, occupantJoinedAt: JOINED,
        challenges: { a1: { completedAt: '2026-11-10T02:00:00.000Z', before: false } },
        current: { challengeId: 'a3', openedAt: '2026-11-10T02:00:00.000Z' }, updatedAt: '2026-11-10T02:00:00.000Z',
      }],
    });
    const { status, body } = await call('PUT', '/classrooms/c1/lesson-progress', SESSION, {
      challenges: { a2: { completedAt: '2026-11-12T01:00:00Z' } },
    });
    expect(status).toBe(200);
    expect(body.challenges).toEqual({ a2: { completedAt: '2026-11-12T01:00:00.000Z', before: false } });
    expect(body.current).toBeNull();
    const [put] = commands('PutCommand', PROGRESS_TABLE);
    expect(put.input.Item.occupantJoinedAt).toBe('2026-11-12T00:00:00.000Z');
    expect(put.input.Item.version).toBe(8);
    expect(put.input.ConditionExpression).toBe('version = :prev');
  });

  test('席に別の生徒が座ったあとの {} は前の人の記録を返さない', async () => {
    useData({
      item: classroom({ lesson: lesson() }),
      joinedAt: '2026-11-12T00:00:00.000Z',
      progress: [{
        classroomId: 'c1', memberId: ME, version: 1, ttl: CLASS_TTL, occupantJoinedAt: JOINED,
        challenges: { a1: { completedAt: '2026-11-10T02:00:00.000Z', before: false } }, current: null, updatedAt: 'u',
      }],
    });
    const { body } = await call('PUT', '/classrooms/c1/lesson-progress', SESSION, {});
    expect(body.challenges).toEqual({});
    expect(commands('PutCommand', PROGRESS_TABLE)).toHaveLength(0);
  });

  test('チャレンジ ID constructor も保存でき、__proto__ は 400', async () => {
    useData({ item: classroom({ lesson: lesson({ challengeIds: ['constructor', 'a1'], requiredChallengeIds: [] }) }) });
    const ok = await call('PUT', '/classrooms/c1/lesson-progress', SESSION, {
      challenges: { constructor: { completedAt: '2026-11-10T02:00:00Z' } },
    });
    expect(ok.body.challenges).toEqual({ constructor: { completedAt: '2026-11-10T02:00:00.000Z', before: false } });
    const res = await handler(makeEvent('PUT', '/classrooms/c1/lesson-progress', { classroomId: 'c1' }, SESSION, undefined));
    expect(res.statusCode).toBe(200);
    const bad = await handler({
      ...makeEvent('PUT', '/classrooms/c1/lesson-progress', { classroomId: 'c1' }, SESSION),
      body: '{"challenges":{"__proto__":{"completedAt":"2026-11-10T02:00:00Z"}}}',
    });
    expect(bad.statusCode).toBe(400);
  });

  test('ぶつかったら読み直して 1 回やり直す', async () => {
    useData({ item: classroom({ lesson: lesson() }) });
    const base = mockSend.getMockImplementation()!;
    let puts = 0;
    mockSend.mockImplementation((cmd: { constructor: { name: string }; input: Record<string, any> }) => {
      if (cmd.constructor.name === 'PutCommand' && cmd.input.TableName === PROGRESS_TABLE && puts++ === 0) {
        const err = new Error('conditional');
        err.name = 'ConditionalCheckFailedException';
        return Promise.reject(err);
      }
      return base(cmd);
    });
    const { status } = await call('PUT', '/classrooms/c1/lesson-progress', SESSION, {
      challenges: { a1: { completedAt: '2026-11-10T02:00:00Z' } },
    });
    expect(status).toBe(200);
    expect(commands('PutCommand', PROGRESS_TABLE)).toHaveLength(2);
  });

  test('lesson の無い課題には送れない（400）', async () => {
    useData({ item: classroom() });
    const { status } = await call('PUT', '/classrooms/c1/lesson-progress', SESSION, { challenges: {} });
    expect(status).toBe(400);
  });

  test('アーカイブ済みの課題には送れない（404）', async () => {
    useData({ item: classroom({ lesson: lesson(), status: 'archived' }) });
    const { status } = await call('PUT', '/classrooms/c1/lesson-progress', SESSION, { challenges: {} });
    expect(status).toBe(404);
  });

  test('ほかの課題のセッションでは送れない（401）', async () => {
    useData({ item: classroom({ classroomId: 'c2', lesson: lesson() }) });
    const res = await handler(makeEvent('PUT', '/classrooms/c2/lesson-progress', { classroomId: 'c2' }, SESSION, {}));
    expect(res.statusCode).toBe(401);
  });

  test('不正な入力は 400 で書き込まない', async () => {
    useData({ item: classroom({ lesson: lesson() }) });
    const { status } = await call('PUT', '/classrooms/c1/lesson-progress', SESSION, {
      challenges: { a1: { completedAt: 'yesterday' } },
    });
    expect(status).toBe(400);
    expect(commands('PutCommand', PROGRESS_TABLE)).toHaveLength(0);
  });

  test('送りすぎは 400（席ごとの回数の上限）', async () => {
    process.env.LESSON_PROGRESS_RATE_LIMIT_MAX = '2';
    jest.resetModules();
    handler = require('../handler').handler;
    useData({ item: classroom({ lesson: lesson() }) });
    expect((await call('PUT', '/classrooms/c1/lesson-progress', SESSION, {})).status).toBe(200);
    expect((await call('PUT', '/classrooms/c1/lesson-progress', SESSION, {})).status).toBe(200);
    const third = await call('PUT', '/classrooms/c1/lesson-progress', SESSION, {});
    expect(third.status).toBe(400);
    expect(third.body.error).toMatch(/Too many/);
    delete process.env.LESSON_PROGRESS_RATE_LIMIT_MAX;
  });
});

describe('GET /classrooms/{id}/lesson-progress (teacher)', () => {
  test('席ごとの一覧を席の順に返す（期限切れの行は除く）', async () => {
    useData({
      item: classroom({ lesson: lesson() }),
      progress: [
        { classroomId: 'c1', memberId: 'seat-10', ttl: CLASS_TTL, version: 1, challenges: {}, current: null, updatedAt: 'u10' },
        { classroomId: 'c1', memberId: 'seat-02', ttl: CLASS_TTL, version: 1,
          challenges: { a1: { completedAt: '2026-11-10T02:00:00.000Z', before: false } },
          current: { challengeId: 'a2', openedAt: '2026-11-10T02:10:00.000Z' }, updatedAt: 'u2' },
        { classroomId: 'c1', memberId: 'seat-05', ttl: 1, version: 1, challenges: {}, current: null, updatedAt: 'old' },
      ],
    });
    const { status, body } = await call('GET', '/classrooms/c1/lesson-progress', DEV_TOKEN);
    expect(status).toBe(200);
    expect(body.lesson).toEqual(lesson());
    expect(body.progress.map((p: Row) => p.seatNumber)).toEqual([2, 10]);
    expect(body.progress[0]).toEqual({
      memberId: 'seat-02',
      seatNumber: 2,
      challenges: { a1: { completedAt: '2026-11-10T02:00:00.000Z', before: false } },
      current: { challengeId: 'a2', openedAt: '2026-11-10T02:10:00.000Z' },
      updatedAt: 'u2',
    });
  });

  test('席にいま別の生徒が座っている行（前の人の記録）は返さない', async () => {
    useData({
      item: classroom({ lesson: lesson() }),
      memberships: [
        { classroomId: 'c1', memberId: 'seat-01', joinedAt: 'J-new' },
        { classroomId: 'c1', memberId: 'seat-02', joinedAt: 'J-same' },
        { classroomId: 'c1', memberId: 'seat-04', joinedAt: 'J-kicked', kicked: true },
      ],
      progress: [
        { classroomId: 'c1', memberId: 'seat-01', ttl: CLASS_TTL, occupantJoinedAt: 'J-old', challenges: {}, current: null, updatedAt: 'u1' },
        { classroomId: 'c1', memberId: 'seat-02', ttl: CLASS_TTL, occupantJoinedAt: 'J-same', challenges: {}, current: null, updatedAt: 'u2' },
        // 退出した生徒（席の行が無い）と kick された生徒の記録は残して見せる
        { classroomId: 'c1', memberId: 'seat-03', ttl: CLASS_TTL, occupantJoinedAt: 'J-left', challenges: {}, current: null, updatedAt: 'u3' },
        { classroomId: 'c1', memberId: 'seat-04', ttl: CLASS_TTL, occupantJoinedAt: 'J-kicked', challenges: {}, current: null, updatedAt: 'u4' },
      ],
    });
    const { body } = await call('GET', '/classrooms/c1/lesson-progress', DEV_TOKEN);
    expect(body.progress.map((p: Row) => p.seatNumber)).toEqual([2, 3, 4]);
  });

  test('生徒のセッショントークンでは見られない', async () => {
    useData({ item: classroom({ lesson: lesson() }) });
    const { status } = await call('GET', '/classrooms/c1/lesson-progress', SESSION);
    expect(status).toBe(401);
  });
});

describe('みんなの課題とレッスンの設定', () => {
  test('共有するとレッスンの設定を写す（ページの無いレッスンだけの課題も共有できる）', async () => {
    useData({ item: classroom({ lesson: lesson() }) });
    const { status, body } = await call('POST', '/shared-assignments', DEV_TOKEN, {
      classroomId: 'c1', title: 'レッスン', visibility: 'limited',
    });
    expect(status).toBe(201);
    expect(body.hasLesson).toBe(true);
    const [put] = commands('PutCommand', 'SharedAssignments');
    expect(put.input.Item.lesson).toEqual(lesson());
  });

  test('ページも作品もレッスンも無い課題はいままでどおり共有できない', async () => {
    useData({ item: classroom() });
    const { status } = await call('POST', '/shared-assignments', DEV_TOKEN, {
      classroomId: 'c1', title: 'x', visibility: 'limited',
    });
    expect(status).toBe(400);
  });

  test('取り込むとレッスンの設定も課題に載る', async () => {
    useData({
      item: classroom(),
      shared: { sharedId: 's1', status: 'published', visibility: 'public', title: 'L', content: { pages: [] }, lesson: lesson() },
      group: { groupId: 'g1', teacherSub: 'dev-test-teacher', name: '2年1組', studentCount: 30, status: 'active' },
    });
    const { status, body } = await call('POST', '/shared-assignments/s1/import', DEV_TOKEN, { groupId: 'g1' }, { sharedId: 's1' });
    expect(status).toBe(201);
    expect(body.hasLesson).toBe(true);
    const [put] = commands('PutCommand', 'Classrooms');
    expect(put.input.Item.lesson).toEqual(lesson());
  });

  test('詳細にレッスンの設定が載る', async () => {
    useData({
      item: classroom(),
      shared: { sharedId: 's1', status: 'published', visibility: 'public', title: 'L', content: { pages: [] }, lesson: lesson() },
    });
    const { body } = await call('GET', '/shared-assignments/s1', DEV_TOKEN, undefined, { sharedId: 's1' });
    expect(body.lesson).toEqual(lesson());
    expect(body.hasLesson).toBe(true);
  });
});
