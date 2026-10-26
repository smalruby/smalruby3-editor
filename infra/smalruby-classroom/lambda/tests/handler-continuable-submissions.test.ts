// このファイルをモジュールにするための宣言（#1144）。
export {};

/**
 * `GET /classrooms/{classroomId}/continuable-submissions` (issue #1201).
 *
 * 生徒が「続きに使える提出物」を取る。守る性質:
 *
 * 1. セッショントークン必須。パスの課題とセッションの課題が違えば 401。
 * 2. current = いまの課題での自分 (同じ席) の提出物。
 * 3. previous = 同じクラス (組) の直前の課題での、同じ席番号の提出物
 *    (previousComment と同じ探し方)。別の席・別のクラスの提出物は返さない。
 * 4. TTL 切れの提出物・課題は返さない。
 * 5. project.sb3 の presigned GET URL を返す。
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

type Row = Record<string, any>;

const SESSION = 'student-session-token';

const makeEvent = (classroomId: string, token: string | null = SESSION) => ({
  requestContext: {
    http: { method: 'GET', path: `/classrooms/${classroomId}/continuable-submissions`, sourceIp: '127.0.0.1' },
  },
  headers: {
    ...(token ? { authorization: `Bearer ${token}` } : {}),
    origin: 'http://localhost:8601',
  },
  pathParameters: { classroomId },
});

const future = () => Math.floor(Date.now() / 1000) + 3600;

const useTables = ({ members, classrooms, submissions }: { members: Row[]; classrooms: Row[]; submissions: Row[] }) => {
  mockSend.mockImplementation((cmd: { constructor: { name: string }; input: Record<string, any> }) => {
    const name = cmd.constructor.name;
    const input = cmd.input;
    const values = input.ExpressionAttributeValues || {};
    if (name === 'GetCommand' && input.TableName === 'Classrooms') {
      return Promise.resolve({ Item: classrooms.find((c) => c.classroomId === input.Key.classroomId) });
    }
    if (name !== 'QueryCommand') return Promise.resolve({});
    if (input.TableName === 'ClassroomMemberships' && input.IndexName === 'sessionToken-index') {
      return Promise.resolve({ Items: members.filter((m) => m.sessionToken === values[':st']) });
    }
    if (input.TableName === 'Classrooms' && input.IndexName === 'groupId-index') {
      return Promise.resolve({ Items: classrooms.filter((c) => c.groupId === values[':gid']) });
    }
    if (input.TableName === 'ClassroomSubmissions' && input.IndexName === 'classroomId-memberId-index') {
      return Promise.resolve({
        Items: submissions.filter((s) => s.classroomId === values[':cid'] && s.memberId === values[':mid']),
      });
    }
    return Promise.resolve({ Items: [] });
  });
};

const classroom = (classroomId: string, over: Row = {}) => ({
  classroomId,
  groupId: 'g1',
  assignmentName: classroomId,
  status: 'active',
  createdAt: '2026-10-01T00:00:00.000Z',
  ttl: future(),
  ...over,
});

const submission = (classroomId: string, memberId: string, over: Row = {}) => ({
  classroomId,
  submissionId: `sub-${classroomId}-${memberId}`,
  memberId,
  projectName: `作品-${classroomId}`,
  s3Key: `${classroomId}/sub-${classroomId}-${memberId}/project.sb3`,
  status: 'submitted',
  submittedAt: '2026-10-01T10:00:00.000Z',
  ttl: future(),
  ...over,
});

const member = { classroomId: 'c-now', memberId: 'seat-03', sessionToken: SESSION };

describe('GET /classrooms/{id}/continuable-submissions (issue #1201)', () => {
  let handler: (event: unknown) => Promise<{ statusCode?: number; body?: string }>;

  beforeEach(() => {
    jest.resetModules();
    mockSend.mockReset();
    handler = require('../handler').handler;
  });

  const call = async (classroomId = 'c-now', token: string | null = SESSION) => {
    const res = await handler(makeEvent(classroomId, token));
    return { status: res.statusCode, body: JSON.parse(res.body || '{}') };
  };

  test('いまの課題の自分の提出物と、同じクラスの直前の課題の同じ席の提出物を返す', async () => {
    useTables({
      members: [member],
      classrooms: [
        classroom('c-now', { createdAt: '2026-10-08T00:00:00.000Z', assignmentName: '第2回' }),
        classroom('c-prev', { createdAt: '2026-10-01T00:00:00.000Z', assignmentName: '第1回' }),
      ],
      submissions: [
        submission('c-now', 'seat-03', { projectName: '今週', submittedAt: '2026-10-08T10:00:00.000Z' }),
        submission('c-prev', 'seat-03', { projectName: '先週', status: 'returned' }),
      ],
    });
    const { status, body } = await call();
    expect(status).toBe(200);
    expect(body.current).toEqual({
      classroomId: 'c-now',
      assignmentName: '第2回',
      projectName: '今週',
      submittedAt: '2026-10-08T10:00:00.000Z',
      projectUrl: 'https://signed.example/c-now/sub-c-now-seat-03/project.sb3',
    });
    expect(body.previous).toEqual({
      classroomId: 'c-prev',
      assignmentName: '第1回',
      projectName: '先週',
      submittedAt: '2026-10-01T10:00:00.000Z',
      projectUrl: 'https://signed.example/c-prev/sub-c-prev-seat-03/project.sb3',
    });
  });

  test('別の席の提出物は返さない', async () => {
    useTables({
      members: [member],
      classrooms: [classroom('c-now', { createdAt: '2026-10-08T00:00:00.000Z' }), classroom('c-prev')],
      submissions: [submission('c-now', 'seat-04'), submission('c-prev', 'seat-04')],
    });
    const { body } = await call();
    expect(body).toEqual({ current: null, previous: null, startFromPrevious: false });
  });

  test('別のクラス (組) の課題の提出物は返さない', async () => {
    useTables({
      members: [member],
      classrooms: [
        classroom('c-now', { createdAt: '2026-10-08T00:00:00.000Z' }),
        classroom('c-other', { groupId: 'g2' }),
      ],
      submissions: [submission('c-other', 'seat-03')],
    });
    const { body } = await call();
    expect(body.previous).toBeNull();
    const queriedCids = mockSend.mock.calls
      .map((c) => c[0].input)
      .filter((i) => i.TableName === 'ClassroomSubmissions')
      .map((i) => i.ExpressionAttributeValues[':cid']);
    expect(queriedCids).not.toContain('c-other');
  });

  test('いまより後に作られた課題は「前回」にしない', async () => {
    useTables({
      members: [member],
      classrooms: [
        classroom('c-now', { createdAt: '2026-10-08T00:00:00.000Z' }),
        classroom('c-later', { createdAt: '2026-10-15T00:00:00.000Z' }),
      ],
      submissions: [submission('c-later', 'seat-03')],
    });
    const { body } = await call();
    expect(body.previous).toBeNull();
  });

  test('直前の課題に提出が無ければ、その前の課題の提出物を返す', async () => {
    useTables({
      members: [member],
      classrooms: [
        classroom('c-now', { createdAt: '2026-10-15T00:00:00.000Z' }),
        classroom('c-prev', { createdAt: '2026-10-08T00:00:00.000Z' }),
        classroom('c-prev2', { createdAt: '2026-10-01T00:00:00.000Z' }),
      ],
      submissions: [submission('c-prev2', 'seat-03')],
    });
    const { body } = await call();
    expect(body.previous.classroomId).toBe('c-prev2');
  });

  test('TTL 切れの提出物・課題は返さない', async () => {
    useTables({
      members: [member],
      classrooms: [
        classroom('c-now', { createdAt: '2026-10-15T00:00:00.000Z' }),
        classroom('c-prev', { createdAt: '2026-10-08T00:00:00.000Z' }),
        classroom('c-prev2', { createdAt: '2026-10-01T00:00:00.000Z', ttl: 1 }),
      ],
      submissions: [
        submission('c-now', 'seat-03', { ttl: 1 }),
        submission('c-prev', 'seat-03', { ttl: 1 }),
        submission('c-prev2', 'seat-03'),
      ],
    });
    const { body } = await call();
    expect(body).toEqual({ current: null, previous: null, startFromPrevious: false });
  });

  test('project.sb3 の無い提出記録は返さない', async () => {
    useTables({
      members: [member],
      classrooms: [classroom('c-now')],
      submissions: [submission('c-now', 'seat-03', { s3Key: undefined })],
    });
    const { body } = await call();
    expect(body.current).toBeNull();
  });

  test('組に属さない課題では previous は null', async () => {
    useTables({
      members: [member],
      classrooms: [classroom('c-now', { groupId: undefined })],
      submissions: [submission('c-now', 'seat-03')],
    });
    const { body } = await call();
    expect(body.current.classroomId).toBe('c-now');
    expect(body.previous).toBeNull();
  });

  test('セッションの課題とパスの課題が違えば 401', async () => {
    useTables({ members: [member], classrooms: [classroom('c-now'), classroom('c-prev')], submissions: [] });
    const { status } = await call('c-prev');
    expect(status).toBe(401);
  });

  test('トークンなし・無効なトークンは 401', async () => {
    useTables({ members: [member], classrooms: [classroom('c-now')], submissions: [] });
    expect((await call('c-now', null)).status).toBe(401);
    expect((await call('c-now', 'bogus')).status).toBe(401);
  });

  test('アーカイブ済みの課題は 404', async () => {
    useTables({ members: [member], classrooms: [classroom('c-now', { status: 'archived' })], submissions: [] });
    expect((await call()).status).toBe(404);
  });
});
