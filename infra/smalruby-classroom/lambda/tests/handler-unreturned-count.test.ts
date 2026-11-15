// このファイルをモジュールにするための宣言（#1144）。
export {};

/**
 * 課題の一覧の `unreturnedCount`（返却していない提出の数・issue #1972）。
 *
 * 数は課題の item に持ち、提出・返却・退室・参加のときに増減する（一覧の取得で
 * 課題ごとに提出を読み直さない）。守る性質:
 *
 * 1. 新しい課題は 0 から数え、提出で +1、返却で -1。
 * 2. 同じ席の出し直しは 2 回数えない。返却済みへの出し直しはまた数える。
 * 3. 同じ提出を 2 回返却しても 1 回しか減らない。
 * 4. 退室した席（自分で退室・先生が退室させた）の提出は数えない。同じ席に次の生徒が入るとまた数える。
 * 5. 数を持っていない古い課題は項目を出さず、数も作らない。レッスンの課題も項目を出さない。
 * 6. 数の書き込みに失敗しても、提出そのものは成功する（fail-open）。
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
  getSignedUrl: jest.fn(async () => 'https://signed.example/x'),
}));
jest.mock('@aws-sdk/client-s3', () => {
  const actual = jest.requireActual('@aws-sdk/client-s3');
  return { ...actual, S3Client: jest.fn(() => ({ send: jest.fn(async () => ({})) })) };
});

const DEV_TOKEN = 'test-dev-bypass';
type Row = Record<string, any>;

const conditionFailed = () => Object.assign(new Error('The conditional request failed'), {
  name: 'ConditionalCheckFailedException',
});

/**
 * 課題・メンバー・提出の表を手元で持つ。ReturnValues（ALL_OLD / UPDATED_OLD）と
 * 条件付き書き込みは実 DynamoDB と同じ意味で返す。
 */
const useTables = (classroomOverrides: Row = {}, opts: { failCounter?: boolean } = {}) => {
  const classrooms = new Map<string, Row>();
  const members = new Map<string, Row>();
  const subs = new Map<string, Row>();
  const keyOf = (k: Row) => `${k.classroomId}|${k.memberId}`;

  mockSend.mockImplementation((cmd: { constructor: { name: string }; input: Record<string, any> }) => {
    const name = cmd.constructor.name;
    const input = cmd.input;
    const values = input.ExpressionAttributeValues || {};

    if (input.TableName === 'Classrooms') {
      if (name === 'PutCommand') {
        classrooms.set(input.Item.classroomId, { ...input.Item, ...classroomOverrides });
        return Promise.resolve({});
      }
      if (name === 'GetCommand') return Promise.resolve({ Item: classrooms.get(input.Key.classroomId) });
      if (name === 'QueryCommand') {
        const rows = [...classrooms.values()];
        if (input.IndexName === 'joinCode-index') return Promise.resolve({ Items: rows.filter(r => r.joinCode === values[':jc']) });
        if (input.IndexName === 'teacherSub-index') return Promise.resolve({ Items: rows.filter(r => r.teacherSub === values[':ts']) });
        return Promise.resolve({ Items: [] });
      }
      if (name === 'UpdateCommand' && input.ExpressionAttributeNames?.['#u'] === 'unreturnedCount') {
        if (opts.failCounter) return Promise.reject(new Error('ProvisionedThroughputExceededException'));
        const row = classrooms.get(input.Key.classroomId);
        if (!row || typeof row.unreturnedCount !== 'number') return Promise.reject(conditionFailed());
        if (values[':abs'] !== undefined && row.unreturnedCount < values[':abs']) return Promise.reject(conditionFailed());
        row.unreturnedCount += values[':d'];
        return Promise.resolve({});
      }
      return Promise.resolve({});
    }

    if (input.TableName === 'ClassroomMemberships') {
      if (name === 'PutCommand') {
        const existing = members.get(keyOf(input.Item));
        if (input.ConditionExpression && existing && existing.kicked !== true) return Promise.reject(conditionFailed());
        members.set(keyOf(input.Item), { ...input.Item });
        return Promise.resolve({});
      }
      if (name === 'UpdateCommand' && String(input.UpdateExpression).includes('kicked = :true')) {
        const existing = members.get(keyOf(input.Key));
        if (!existing) return Promise.reject(conditionFailed());
        const old = { ...existing };
        Object.assign(existing, { kicked: true, ttl: values[':ttl'] });
        return Promise.resolve({ Attributes: input.ReturnValues === 'ALL_OLD' ? old : { ...existing } });
      }
      if (name === 'DeleteCommand') {
        const old = members.get(keyOf(input.Key));
        members.delete(keyOf(input.Key));
        return Promise.resolve(input.ReturnValues === 'ALL_OLD' && old ? { Attributes: old } : {});
      }
      if (name === 'GetCommand') return Promise.resolve({ Item: members.get(keyOf(input.Key)) });
      if (name === 'QueryCommand') {
        if (input.IndexName === 'sessionToken-index') {
          return Promise.resolve({ Items: [...members.values()].filter(m => m.sessionToken === values[':st']).slice(0, 1) });
        }
        return Promise.resolve({ Items: [...members.values()].filter(m => m.classroomId === values[':cid']) });
      }
      return Promise.resolve({});
    }

    if (input.TableName === 'ClassroomSubmissions') {
      if (name === 'PutCommand') {
        subs.set(input.Item.submissionId, { ...input.Item });
        return Promise.resolve({});
      }
      if (name === 'DeleteCommand') {
        const old = subs.get(input.Key.submissionId);
        subs.delete(input.Key.submissionId);
        return Promise.resolve(input.ReturnValues === 'ALL_OLD' && old ? { Attributes: old } : {});
      }
      if (name === 'GetCommand') return Promise.resolve({ Item: subs.get(input.Key.submissionId) });
      if (name === 'UpdateCommand') {
        const row = subs.get(input.Key.submissionId)!;
        const old = { status: row.status };
        if (values[':st']) row.status = values[':st'];
        if (values[':tc'] !== undefined) row.teacherComment = values[':tc'];
        return Promise.resolve(input.ReturnValues === 'UPDATED_OLD' ? { Attributes: old } : {});
      }
      if (name === 'QueryCommand') {
        let rows = [...subs.values()].filter(s => s.classroomId === values[':cid']);
        if (values[':mid'] !== undefined) rows = rows.filter(s => s.memberId === values[':mid']);
        return Promise.resolve({ Items: rows });
      }
      return Promise.resolve({});
    }

    if (name === 'QueryCommand') return Promise.resolve({ Items: [] });
    return Promise.resolve({});
  });
  return { classrooms, members, subs };
};

let handler: (event: unknown) => Promise<{ statusCode?: number; body?: string }>;

beforeEach(() => {
  jest.resetModules();
  process.env.DEV_BYPASS_TOKEN = DEV_TOKEN;
  process.env.STAGE = 'stg';
  mockSend.mockReset();
  handler = require('../handler').handler;
});

let ipCounter = 0;
const call = async (
  method: string, path: string,
  opts: { body?: Row; token?: string; pathParameters?: Row } = {},
) => {
  ipCounter += 1;
  const res = await handler({
    requestContext: { http: { method, path, sourceIp: `10.0.3.${ipCounter % 250}` } },
    headers: {
      origin: 'http://localhost:8601',
      ...(opts.token ? { authorization: `Bearer ${opts.token}` } : {}),
    },
    pathParameters: opts.pathParameters || {},
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  return { status: res.statusCode, body: JSON.parse(res.body || '{}') };
};

const createClassroom = async () => {
  const res = await call('POST', '/classrooms', {
    token: DEV_TOKEN,
    body: { className: '2年1組', assignmentName: '第1回', studentCount: 30 },
  });
  expect(res.status).toBe(201);
  return res.body as Row;
};

const join = async (joinCode: string, seatNumber: number) => {
  const res = await call('POST', '/classrooms/join', { body: { joinCode, seatNumber, nickname: `n${seatNumber}` } });
  expect(res.status).toBe(200);
  return res.body.sessionToken as string;
};

const submit = async (classroomId: string, token: string) => {
  const res = await call('POST', `/classrooms/${classroomId}/submissions`, {
    token, pathParameters: { classroomId }, body: { projectName: 'p' },
  });
  expect(res.status).toBe(201);
  return res.body.submissionId as string;
};

const giveBack = async (classroomId: string, submissionId: string) => {
  const res = await call('PATCH', `/classrooms/${classroomId}/submissions/${submissionId}`, {
    token: DEV_TOKEN, pathParameters: { classroomId, submissionId }, body: { status: 'returned' },
  });
  expect(res.status).toBe(200);
};

const listed = async (classroomId: string) => {
  const res = await call('GET', '/classrooms', { token: DEV_TOKEN });
  expect(res.status).toBe(200);
  return (res.body.classrooms as Row[]).find(c => c.classroomId === classroomId)!;
};

describe('GET /classrooms の unreturnedCount (issue #1972)', () => {
  test('新しい課題は 0。提出で +1、返却で -1', async () => {
    useTables();
    const c = await createClassroom();
    expect((await listed(c.classroomId)).unreturnedCount).toBe(0);

    const s1 = await join(c.joinCode, 1);
    const s2 = await join(c.joinCode, 2);
    const sub1 = await submit(c.classroomId, s1);
    await submit(c.classroomId, s2);
    expect((await listed(c.classroomId)).unreturnedCount).toBe(2);

    await giveBack(c.classroomId, sub1);
    expect((await listed(c.classroomId)).unreturnedCount).toBe(1);
  });

  test('出し直しは 2 回数えない。返却済みへの出し直しはまた数える', async () => {
    useTables();
    const c = await createClassroom();
    const s1 = await join(c.joinCode, 1);
    await submit(c.classroomId, s1);
    const again = await submit(c.classroomId, s1);
    expect((await listed(c.classroomId)).unreturnedCount).toBe(1);

    await giveBack(c.classroomId, again);
    expect((await listed(c.classroomId)).unreturnedCount).toBe(0);
    await submit(c.classroomId, s1);
    expect((await listed(c.classroomId)).unreturnedCount).toBe(1);
  });

  test('同じ提出を 2 回返却しても 1 回しか減らない', async () => {
    useTables();
    const c = await createClassroom();
    const sub1 = await submit(c.classroomId, await join(c.joinCode, 1));
    await submit(c.classroomId, await join(c.joinCode, 2));
    await giveBack(c.classroomId, sub1);
    await giveBack(c.classroomId, sub1);
    expect((await listed(c.classroomId)).unreturnedCount).toBe(1);
  });

  test('自分で退室した席の提出は数えず、同じ席に次の生徒が入るとまた数える', async () => {
    useTables();
    const c = await createClassroom();
    const s1 = await join(c.joinCode, 1);
    await submit(c.classroomId, s1);

    const leave = await call('DELETE', `/classrooms/${c.classroomId}/members/me`, {
      token: s1, pathParameters: { classroomId: c.classroomId, memberId: 'me' },
    });
    expect(leave.status).toBe(204);
    expect((await listed(c.classroomId)).unreturnedCount).toBe(0);

    await join(c.joinCode, 1);
    expect((await listed(c.classroomId)).unreturnedCount).toBe(1);
  });

  test('先生が退室させた席の提出は数えない。2 回退室させても 1 回しか減らない', async () => {
    useTables();
    const c = await createClassroom();
    await submit(c.classroomId, await join(c.joinCode, 1));
    await submit(c.classroomId, await join(c.joinCode, 2));
    const kick = () => call('DELETE', `/classrooms/${c.classroomId}/members/seat-01`, {
      token: DEV_TOKEN, pathParameters: { classroomId: c.classroomId, memberId: 'seat-01' },
    });
    expect((await kick()).status).toBe(204);
    expect((await kick()).status).toBe(204);
    expect((await listed(c.classroomId)).unreturnedCount).toBe(1);
  });

  test('退室した席の提出を返却しても数は変わらない', async () => {
    const { members } = useTables();
    const c = await createClassroom();
    const sub1 = await submit(c.classroomId, await join(c.joinCode, 1));
    await submit(c.classroomId, await join(c.joinCode, 2));
    await call('DELETE', `/classrooms/${c.classroomId}/members/seat-01`, {
      token: DEV_TOKEN, pathParameters: { classroomId: c.classroomId, memberId: 'seat-01' },
    });
    expect(members.get(`${c.classroomId}|seat-01`)?.kicked).toBe(true);
    await giveBack(c.classroomId, sub1);
    expect((await listed(c.classroomId)).unreturnedCount).toBe(1);
  });

  test('数を持っていない古い課題は項目を出さず、提出でも数を作らない', async () => {
    const { classrooms } = useTables();
    const c = await createClassroom();
    delete classrooms.get(c.classroomId)!.unreturnedCount;
    await submit(c.classroomId, await join(c.joinCode, 1));
    const row = await listed(c.classroomId);
    expect(row).not.toHaveProperty('unreturnedCount');
    expect(classrooms.get(c.classroomId)).not.toHaveProperty('unreturnedCount');
    // 既存の項目はそのまま
    expect(row).toMatchObject({ classroomId: c.classroomId, joinCode: c.joinCode, status: 'active' });
  });

  test('レッスンの課題は項目を出さない', async () => {
    const { classrooms } = useTables();
    const c = await createClassroom();
    classrooms.get(c.classroomId)!.lesson = { courseId: 'jhs-intro', challengeIds: ['c1'] };
    const row = await listed(c.classroomId);
    expect(row.hasLesson).toBe(true);
    expect(row).not.toHaveProperty('unreturnedCount');
  });

  test('数の書き込みに失敗しても提出は成功する（fail-open）', async () => {
    useTables({}, { failCounter: true });
    const c = await createClassroom();
    const errSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    await submit(c.classroomId, await join(c.joinCode, 1));
    errSpy.mockRestore();
  });
});
