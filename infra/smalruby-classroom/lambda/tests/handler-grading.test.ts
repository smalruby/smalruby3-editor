// このファイルをモジュールにするための宣言（#1144）。
export {};

/**
 * 課題ごとの採点の保存（#2422）。
 *
 * 守る性質:
 *
 * 1. GET /grading は保存した採点を返し、無ければ `{ grading: null }`。
 * 2. PUT /grading は送ったキー（rubric / grades / confirmedAt）だけを書く。
 * 3. 大きさ・形の検査（席 200・reason 300 字・text 500 字・examples 20 件・code 4000 字・group 80 字）。
 * 4. 権限は PUT /assignment と同じ（所有者か共同管理者・ほかは 401、無い課題は 404）。
 * 5. 課題の再利用では rubric だけをコピーする。
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
  return {
    ...actual,
    S3Client: jest.fn(() => ({ send: jest.fn(async () => ({})) })),
  };
});

type Row = Record<string, any>;

const DEV_TOKEN = 'test-dev-bypass';

const makeEvent = (method: string, path: string, classroomId: string, body?: unknown) => ({
  requestContext: { http: { method, path, sourceIp: '127.0.0.1' } },
  headers: { authorization: `Bearer ${DEV_TOKEN}`, origin: 'http://localhost:8601' },
  pathParameters: { classroomId },
  body: body === undefined ? undefined : JSON.stringify(body),
});

const TTL = Math.floor(Date.now() / 1000) + 3600;
const classroom = (over: Row = {}): Row => ({
  classroomId: 'c1',
  status: 'active',
  teacherSub: 'dev-test-teacher',
  className: '2年1組',
  assignmentName: '02_LED',
  studentCount: 30,
  ttl: TTL,
  ...over,
});

const rubric = {
  levels: [{ grade: 'S', text: '順につけて待つ時間も変えた' }, { grade: 'A', text: '順につけた' }],
  examples: [{ seatNumber: 4, grade: 'A', reason: '順につけた', group: '順につける', code: '◆ 旗' }],
};

const useItems = (items: { classroom?: Row; grading?: Row }) => {
  mockSend.mockImplementation((cmd: { constructor: { name: string }; input: Record<string, any> }) => {
    const name = cmd.constructor.name;
    const input = cmd.input;
    if (name === 'GetCommand') {
      const key = input.Key.classroomId as string;
      if (key.startsWith('grading#')) return Promise.resolve({ Item: items.grading });
      return Promise.resolve({ Item: key === 'c1' ? items.classroom : undefined });
    }
    if (name === 'UpdateCommand' && String(input.Key.classroomId).startsWith('grading#')) {
      // ALL_NEW: the stored item with the SET values applied.
      const next: Row = { ...(items.grading || { classroomId: input.Key.classroomId }) };
      for (const [placeholder, attr] of Object.entries(input.ExpressionAttributeNames as Record<string, string>)) {
        const value = input.ExpressionAttributeValues[`:${placeholder.slice(1)}`]
          ?? input.ExpressionAttributeValues[placeholder.replace('#', ':')];
        if (attr === 'updatedAt') next.updatedAt = input.ExpressionAttributeValues[':now'];
        else next[attr] = value;
      }
      return Promise.resolve({ Attributes: next });
    }
    if (name === 'QueryCommand') return Promise.resolve({ Items: [] });
    return Promise.resolve({});
  });
};

const sent = (name: string) => mockSend.mock.calls.map(c => c[0]).filter(cmd => cmd.constructor.name === name);

describe('grading pure functions (#2422)', () => {
  const lib = require('../handler');

  test('validateGradingUpdate keeps only the sent keys', () => {
    expect(lib.validateGradingUpdate({ confirmedAt: null })).toEqual({ confirmedAt: null });
    const update = lib.validateGradingUpdate({
      grades: { 3: { grade: 'A', reason: 'r', source: 'ai', needsReview: true, group: 'g' } },
    });
    expect(Object.keys(update)).toEqual(['grades']);
    expect(update.grades['3']).toEqual({ grade: 'A', reason: 'r', source: 'ai', needsReview: true, group: 'g' });
  });

  test('validateGradingUpdate rejects an empty body and bad shapes', () => {
    expect(() => lib.validateGradingUpdate({})).toThrow('at least one');
    expect(() => lib.validateGradingUpdate({ grades: { x: { grade: 'A', source: 'ai' } } })).toThrow('seat number');
    expect(() => lib.validateGradingUpdate({ grades: { 1: { grade: 'D', source: 'ai' } } })).toThrow('grade');
    expect(() => lib.validateGradingUpdate({ grades: { 1: { grade: 'A', source: 'robot' } } })).toThrow('source');
    expect(() => lib.validateGradingUpdate({ confirmedAt: 'yesterday' })).toThrow('confirmedAt');
    expect(() => lib.validateGradingUpdate({ rubric: [] })).toThrow('rubric');
    expect(() => lib.validateGradingUpdate({ rubric: { levels: [{ grade: 'S', text: 'a' }, { grade: 'S', text: 'b' }] } }))
      .toThrow('duplicated');
  });

  test('validateGradingUpdate enforces the size caps', () => {
    const seats = Object.fromEntries(Array.from({ length: 201 }, (_, i) => [String(i + 1), { grade: 'A', source: 'ai' }]));
    expect(() => lib.validateGradingUpdate({ grades: seats })).toThrow('at most 200');
    expect(() => lib.validateGradingUpdate({ grades: { 1: { grade: 'A', source: 'ai', reason: 'あ'.repeat(301) } } }))
      .toThrow('300');
    expect(() => lib.validateGradingUpdate({ grades: { 1: { grade: 'A', source: 'ai', group: 'g'.repeat(81) } } }))
      .toThrow('80');
    expect(() => lib.validateGradingUpdate({ rubric: { levels: [{ grade: 'S', text: 'あ'.repeat(501) }] } })).toThrow('500');
    const example = { seatNumber: 1, grade: 'A' };
    expect(() => lib.validateGradingUpdate({ rubric: { examples: Array(21).fill(example) } })).toThrow('at most 20');
    expect(() => lib.validateGradingUpdate({ rubric: { examples: [{ ...example, code: 'a'.repeat(4001) }] } })).toThrow('4000');
    expect(lib.validateGradingUpdate({ rubric: { examples: [{ ...example, code: 'a'.repeat(4000) }] } }).rubric.examples[0].code)
      .toHaveLength(4000);
  });

  test('mergeGrading replaces provided keys and stamps the rubric', () => {
    const existing = lib.gradingOf({ rubric: { ...rubric, updatedAt: 'old' }, grades: { 1: { grade: 'A' } }, confirmedAt: 'c', updatedAt: 'old' });
    const merged = lib.mergeGrading(existing, { grades: {} }, 'now');
    expect(merged).toEqual({ rubric: { ...rubric, updatedAt: 'old' }, grades: {}, confirmedAt: 'c', updatedAt: 'now' });
    expect(lib.mergeGrading(null, { rubric }, 'now').rubric.updatedAt).toBe('now');
    expect(lib.mergeGrading(existing, { rubric: null }, 'now').rubric).toBeNull();
  });

  test('gradingOf fills defaults and returns null without an item', () => {
    expect(lib.gradingOf(undefined)).toBeNull();
    expect(lib.gradingOf({ grades: {} })).toEqual({ rubric: null, grades: {}, confirmedAt: null, updatedAt: '' });
  });

  test('the worst case of the caps is over the item size, so the total is checked', () => {
    const big = lib.mergeGrading(null, {
      grades: Object.fromEntries(Array.from({ length: 200 }, (_, i) => [String(i + 1), {
        grade: 'A', reason: 'あ'.repeat(300), source: 'ai', group: 'ぐ'.repeat(80),
      }])),
      rubric: { levels: [], examples: Array.from({ length: 20 }, (_, i) => ({
        seatNumber: i + 1, grade: 'A', reason: 'り'.repeat(300), group: 'g', code: 'こ'.repeat(4000),
      })) },
    }, 'now');
    expect(lib.gradingByteSize(big)).toBeGreaterThan(lib.GRADING_MAX_BYTES);
  });

  test('gradingForDuplicate carries only the rubric', () => {
    const source = lib.gradingOf({ rubric: { ...rubric, updatedAt: 'old' }, grades: { 1: { grade: 'A' } }, confirmedAt: 'c' });
    expect(lib.gradingForDuplicate(source, 'now')).toEqual({
      rubric: { ...rubric, updatedAt: 'old' }, grades: {}, confirmedAt: null, updatedAt: 'now',
    });
    expect(lib.gradingForDuplicate(lib.gradingOf({ grades: { 1: {} } }), 'now')).toBeNull();
    expect(lib.gradingForDuplicate(null, 'now')).toBeNull();
  });
});

describe('GET / PUT /classrooms/{id}/grading (#2422)', () => {
  let handler: (event: unknown) => Promise<{ statusCode?: number; body?: string }>;

  beforeEach(() => {
    jest.resetModules();
    process.env.DEV_BYPASS_TOKEN = DEV_TOKEN;
    process.env.STAGE = 'stg';
    mockSend.mockReset();
    jest.spyOn(console, 'error').mockImplementation(() => {});
    handler = require('../handler').handler;
  });

  afterEach(() => jest.restoreAllMocks());

  const call = async (method: string, body?: unknown, classroomId = 'c1') => {
    const res = await handler(makeEvent(method, `/classrooms/${classroomId}/grading`, classroomId, body));
    return { status: res.statusCode, body: JSON.parse(res.body || '{}') };
  };

  test('GET without a stored grading returns null', async () => {
    useItems({ classroom: classroom() });
    expect(await call('GET')).toEqual({ status: 200, body: { grading: null } });
  });

  test('GET returns the stored grading (archived assignments too)', async () => {
    useItems({ classroom: classroom({ status: 'archived' }), grading: { classroomId: 'grading#c1', rubric: { ...rubric, updatedAt: 't' }, grades: {}, updatedAt: 't' } });
    const { status, body } = await call('GET');
    expect(status).toBe(200);
    expect(body.grading.rubric.levels).toHaveLength(2);
    expect(body.grading.confirmedAt).toBeNull();
  });

  test('PUT writes only the sent keys, copies the ttl, and returns the grading', async () => {
    useItems({ classroom: classroom(), grading: { classroomId: 'grading#c1', rubric: { ...rubric, updatedAt: 't' }, grades: {}, updatedAt: 't' } });
    const { status, body } = await call('PUT', { grades: { 3: { grade: 'B', reason: 'r', source: 'teacher' } } });
    expect(status).toBe(200);
    const [update] = sent('UpdateCommand');
    expect(update.input.Key).toEqual({ classroomId: 'grading#c1' });
    expect(update.input.UpdateExpression).toContain('#grades = :grades');
    expect(update.input.UpdateExpression).not.toContain('#rubric');
    expect(update.input.UpdateExpression).not.toContain('#confirmedAt');
    expect(update.input.ExpressionAttributeValues[':ttl']).toBe(TTL);
    expect(body.grading.grades['3'].grade).toBe('B');
    expect(body.grading.rubric.levels).toHaveLength(2);
  });

  test('PUT rejects bad bodies before writing', async () => {
    useItems({ classroom: classroom() });
    expect((await call('PUT', {})).status).toBe(400);
    expect((await call('PUT', { grades: { 1: { grade: 'Z', source: 'ai' } } })).status).toBe(400);
    expect(sent('UpdateCommand')).toHaveLength(0);
  });

  test('PUT on an archived or missing assignment is 404', async () => {
    useItems({ classroom: classroom({ status: 'archived' }) });
    expect((await call('PUT', { confirmedAt: null })).status).toBe(404);
    useItems({});
    expect((await call('GET')).status).toBe(404);
  });

  test('someone who cannot manage the assignment gets 401', async () => {
    useItems({ classroom: classroom({ teacherSub: 'someone-else' }) });
    expect((await call('GET')).status).toBe(401);
    expect((await call('PUT', { confirmedAt: null })).status).toBe(401);
    expect(sent('UpdateCommand')).toHaveLength(0);
  });

  test('duplicating an assignment copies the rubric only', async () => {
    useItems({
      classroom: classroom(),
      grading: { classroomId: 'grading#c1', rubric: { ...rubric, updatedAt: 't' }, grades: { 1: { grade: 'A' } }, confirmedAt: 'c' },
    });
    const res = await handler(makeEvent('POST', '/classrooms/c1/duplicate', 'c1', {}));
    expect(res.statusCode).toBe(201);
    const puts = sent('PutCommand');
    const grading = puts.find(cmd => String(cmd.input.Item.classroomId).startsWith('grading#'));
    const assignment = puts.find(cmd => !String(cmd.input.Item.classroomId).startsWith('grading#'));
    expect(grading.input.Item.classroomId).toBe(`grading#${assignment.input.Item.classroomId}`);
    expect(grading.input.Item.rubric.levels).toHaveLength(2);
    expect(grading.input.Item.grades).toEqual({});
    expect(grading.input.Item.confirmedAt).toBeNull();
    expect(grading.input.Item.ttl).toBe(assignment.input.Item.ttl);
  });

  test('duplicating an assignment without a rubric writes no grading', async () => {
    useItems({ classroom: classroom() });
    const res = await handler(makeEvent('POST', '/classrooms/c1/duplicate', 'c1', {}));
    expect(res.statusCode).toBe(201);
    expect(sent('PutCommand').filter(cmd => String(cmd.input.Item.classroomId).startsWith('grading#'))).toHaveLength(0);
  });
});
