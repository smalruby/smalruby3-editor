// このファイルをモジュールにするための宣言（#1144）。
export {};

/**
 * 課題のレッスンの点（`lesson.scoring`）だけを更新する API（issue #1783）。
 *
 * 守る性質:
 *
 * 1. PATCH /classrooms/{id}/assignment/lesson-scoring は `lesson.scoring` だけを書く。
 *    ページ・画像・開始プロジェクト・lesson のほかの項目・課題の設定には触らない
 *    （UpdateExpression は `lesson.scoring` と `updatedAt` だけ・S3 の削除も署名 URL も無い）。
 * 2. `scoring: null` は既定（点の設定なし）に戻す。
 * 3. 検証は PUT /assignment の `lesson.scoring` と同じ。`scoring` を送らない本文は 400。
 * 4. lesson の無い課題は 400（読んだあとで lesson が外されたときも条件付き更新で 400）。
 * 5. 認可は PUT /assignment と同じ（先生 ID Token・所有者か共同管理者。ほかは 401、
 *    無い・アーカイブ済みは 404）。
 */

const mockSend = jest.fn();
const mockS3Send = jest.fn(async () => ({}));
const mockGetSignedUrl = jest.fn(async () => 'https://signed.example/x');
jest.mock('@aws-sdk/lib-dynamodb', () => {
  const actual = jest.requireActual('@aws-sdk/lib-dynamodb');
  return {
    ...actual,
    DynamoDBDocumentClient: { from: () => ({ send: mockSend }) },
  };
});
jest.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: (...args: unknown[]) => mockGetSignedUrl(...(args as [])),
}));
jest.mock('@aws-sdk/client-s3', () => {
  const actual = jest.requireActual('@aws-sdk/client-s3');
  return {
    ...actual,
    S3Client: jest.fn(() => ({ send: mockS3Send })),
  };
});

type Row = Record<string, any>;

const DEV_TOKEN = 'test-dev-bypass';
const SESSION = 'student-session-token';
const PATH = '/classrooms/c1/assignment/lesson-scoring';

const lesson = (over: Row = {}): Row => ({
  courseId: 'kyou-kara-programmer',
  challengeIds: ['a1', 'a2', 'a3'],
  requiredChallengeIds: ['a2'],
  completion: { type: 'count', count: 2 },
  submitWork: true,
  scoring: { total: 100, requiredPoints: 70, optionalPoints: 30 },
  ...over,
});

const assignment = {
  pages: [{ text: 'p1', imageKey: 'c1/assignment/image-old.png' }, { text: 'p2' }],
  starterKey: 'c1/assignment/starter-old.sb3',
  updatedAt: '2026-11-01T00:00:00.000Z',
};

const classroom = (over: Row = {}): Row => ({
  classroomId: 'c1',
  status: 'active',
  teacherSub: 'dev-test-teacher',
  assignmentName: '第3回',
  className: '2年1組',
  studentCount: 30,
  joinCode: 'abcdef',
  createdAt: '2026-10-08T00:00:00.000Z',
  startFromPrevious: true,
  peerView: 'always',
  assignment,
  lesson: lesson(),
  ...over,
});

/**
 * DynamoDB の UpdateItem を、この API が使う形（`SET a.b = :v, c = :w`）だけ
 * 手元の item に当てる。テストは「保存後の item」を比べて、ほかの属性が
 * 変わらないことを確かめる。
 */
function applyUpdate(item: Row, input: Row): Row {
  const next = JSON.parse(JSON.stringify(item));
  const expr: string = input.UpdateExpression;
  expect(expr).toMatch(/^SET [^]+$/);
  expect(expr).not.toMatch(/\b(REMOVE|ADD|DELETE)\b/);
  for (const clause of expr.replace(/^SET /, '').split(',')) {
    const [lhs, rhs] = clause.split('=').map(s => s.trim());
    const resolve = (name: string) => (input.ExpressionAttributeNames?.[name] ?? name);
    const path = lhs.split('.').map(resolve);
    const value = input.ExpressionAttributeValues[rhs];
    let target = next;
    for (const key of path.slice(0, -1)) target = target[key];
    target[path[path.length - 1]] = value;
  }
  return next;
}

let stored: Row | undefined;
/** 読み出し（GetItem）のあと、書き込みの前に item を差し替える（競合の再現）。 */
let storedAtWrite: Row | undefined | null;

const useData = (item: Row | undefined, { group, atWrite }: { group?: Row; atWrite?: Row | null } = {}) => {
  stored = item;
  storedAtWrite = atWrite === undefined ? null : atWrite;
  mockSend.mockImplementation((cmd: { constructor: { name: string }; input: Record<string, any> }) => {
    const name = cmd.constructor.name;
    const input = cmd.input;
    if (name === 'GetCommand' && input.TableName === 'Classrooms') {
      return Promise.resolve({ Item: stored && input.Key.classroomId === stored.classroomId ? stored : undefined });
    }
    if (name === 'GetCommand' && input.TableName === 'ClassroomGroups') {
      return Promise.resolve({ Item: group });
    }
    if (name === 'QueryCommand') return Promise.resolve({ Items: [] });
    if (name === 'UpdateCommand' && input.TableName === 'Classrooms') {
      const current = storedAtWrite === null ? stored : storedAtWrite;
      // 条件式は「lesson がある・active」。テストで使う 2 つだけを評価する。
      const cond: string = input.ConditionExpression || '';
      const ok = !!current &&
        (!cond.includes('attribute_exists(lesson.courseId)') || !!current.lesson?.courseId) &&
        (!cond.includes(':active') || current.status === input.ExpressionAttributeValues[':active']);
      if (!ok) {
        const err = new Error('The conditional request failed');
        err.name = 'ConditionalCheckFailedException';
        return Promise.reject(err);
      }
      stored = applyUpdate(current!, input);
      return Promise.resolve({ Attributes: input.ReturnValues === 'ALL_NEW' ? stored : undefined });
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
  mockS3Send.mockClear();
  mockGetSignedUrl.mockClear();
  handler = require('../handler').handler;
});

const call = async (token: string, body?: unknown, method = 'PATCH', path = PATH) => {
  const res = await handler({
    requestContext: { http: { method, path, sourceIp: '127.0.0.1' } },
    headers: { authorization: `Bearer ${token}`, origin: 'http://localhost:8601' },
    pathParameters: { classroomId: 'c1' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: res.statusCode, body: JSON.parse(res.body || '{}') };
};

describe('PATCH /classrooms/{id}/assignment/lesson-scoring', () => {
  test('lesson.scoring だけを更新し、ほかの属性（ページ・画像・開始プロジェクト・lesson のほか）は変えない', async () => {
    const before = classroom();
    useData(before);
    const scoring = { total: 50, requiredPoints: 40, optionalPoints: 10 };
    const { status, body } = await call(DEV_TOKEN, { scoring });
    expect(status).toBe(200);
    expect(body.lesson).toEqual(lesson({ scoring }));

    const [update] = commands('UpdateCommand', 'Classrooms');
    expect(update.input.Key).toEqual({ classroomId: 'c1' });
    expect(update.input.UpdateExpression).toBe('SET lesson.scoring = :scoring, updatedAt = :now');
    expect(update.input.ConditionExpression).toContain('attribute_exists(lesson.courseId)');

    const { updatedAt, ...rest } = stored!;
    const { updatedAt: _ignored, ...restBefore } = before;
    expect(rest).toEqual({ ...restBefore, lesson: lesson({ scoring }) });
    expect(typeof updatedAt).toBe('string');
    // 課題コンテンツ（imageKey・starterKey・その updatedAt）は同じもののまま。
    expect(stored!.assignment).toEqual(assignment);
    // PUT /assignment と違い、S3 の orphan の後片付けも署名 URL の発行もしない。
    expect(mockS3Send).not.toHaveBeenCalled();
    expect(mockGetSignedUrl).not.toHaveBeenCalled();
    expect(commands('PutCommand', 'Classrooms')).toHaveLength(0);
  });

  test('scoring: null で既定（点の設定なし）に戻す', async () => {
    useData(classroom());
    const { status, body } = await call(DEV_TOKEN, { scoring: null });
    expect(status).toBe(200);
    expect(body.lesson).toEqual(lesson({ scoring: null }));
    expect(stored!.lesson).toEqual(lesson({ scoring: null }));
    expect(stored!.assignment).toEqual(assignment);
  });

  test('点の設定の無いレッスンにも点を付けられる', async () => {
    useData(classroom({ lesson: lesson({ scoring: null }) }));
    const scoring = { total: 10, requiredPoints: 10, optionalPoints: 0 };
    const { status } = await call(DEV_TOKEN, { scoring });
    expect(status).toBe(200);
    expect(stored!.lesson.scoring).toEqual(scoring);
  });

  test('正規化した値だけを保存する（余計なキーは捨てる）', async () => {
    useData(classroom());
    await call(DEV_TOKEN, { scoring: { total: 20, requiredPoints: 5, optionalPoints: 15, extra: 'x' } });
    const [update] = commands('UpdateCommand', 'Classrooms');
    expect(update.input.ExpressionAttributeValues[':scoring']).toEqual({ total: 20, requiredPoints: 5, optionalPoints: 15 });
  });

  test.each([
    ['scoring を送らない', {}],
    ['total が 0', { scoring: { total: 0, requiredPoints: 0, optionalPoints: 0 } }],
    ['total が上限より大きい', { scoring: { total: 1001, requiredPoints: 0, optionalPoints: 0 } }],
    ['requiredPoints が total より大きい', { scoring: { total: 10, requiredPoints: 11, optionalPoints: 0 } }],
    ['optionalPoints が負', { scoring: { total: 10, requiredPoints: 0, optionalPoints: -1 } }],
    ['scoring が配列', { scoring: [] }],
    ['scoring が文字列', { scoring: '100' }],
  ])('%s は 400 で保存しない', async (_label, reqBody) => {
    useData(classroom());
    const { status } = await call(DEV_TOKEN, reqBody);
    expect(status).toBe(400);
    expect(commands('UpdateCommand', 'Classrooms')).toHaveLength(0);
  });

  test('lesson の無い課題は 400', async () => {
    useData(classroom({ lesson: undefined }));
    const { status, body } = await call(DEV_TOKEN, { scoring: { total: 10, requiredPoints: 10, optionalPoints: 0 } });
    expect(status).toBe(400);
    expect(body.error).toMatch(/no lesson/);
    expect(commands('UpdateCommand', 'Classrooms')).toHaveLength(0);
  });

  test('読んだあとで lesson が外されたら、条件付き更新で 400（lesson を作り直さない）', async () => {
    const without = classroom({ lesson: undefined });
    useData(classroom(), { atWrite: without });
    const { status } = await call(DEV_TOKEN, { scoring: { total: 10, requiredPoints: 10, optionalPoints: 0 } });
    expect(status).toBe(400);
    expect(stored).toEqual(classroom());
  });

  test('ほかの先生（所有者でも共同管理者でもない）は 401', async () => {
    useData(classroom({ teacherSub: 'someone-else' }));
    const { status } = await call(DEV_TOKEN, { scoring: null });
    expect(status).toBe(401);
    expect(commands('UpdateCommand', 'Classrooms')).toHaveLength(0);
  });

  test('生徒のセッショントークンは 401', async () => {
    useData(classroom());
    const { status } = await call(SESSION, { scoring: null });
    expect(status).toBe(401);
    expect(commands('UpdateCommand', 'Classrooms')).toHaveLength(0);
  });

  test('共同管理者は更新できる（PUT /assignment と同じ認可）', async () => {
    useData(classroom({ teacherSub: 'someone-else', coTeacherEmails: ['dev-test-teacher@example.com'] }));
    const { status } = await call(DEV_TOKEN, { scoring: null });
    expect(status).toBe(200);
  });

  test('無い課題・アーカイブ済みの課題は 404', async () => {
    useData(undefined);
    expect((await call(DEV_TOKEN, { scoring: null })).status).toBe(404);
    useData(classroom({ status: 'archived' }));
    expect((await call(DEV_TOKEN, { scoring: null })).status).toBe(404);
    expect(commands('UpdateCommand', 'Classrooms')).toHaveLength(0);
  });

  test('PUT /assignment の経路はいままでどおり（別のルートに当たらない）', async () => {
    useData(classroom());
    const { status, body } = await call(DEV_TOKEN, { pages: [], keepStarter: true }, 'PUT', '/classrooms/c1/assignment');
    expect(status).toBe(200);
    expect(body.lesson).toEqual(lesson());
  });
});
