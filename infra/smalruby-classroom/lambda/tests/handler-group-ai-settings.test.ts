// このファイルをモジュールにするための宣言（#1144）。
export {};

/**
 * クラス（組）単位の「生成AI」「ルビティー」設定（issue #1275）。
 *
 * 守る性質:
 *
 * 1. `genai` = { enabled, service, url, confirmed }。service は gemini / chatgpt / other だけ
 *    （claude などの 18 歳以上限定サービスは 400）。url は https のみ。gemini / chatgpt は
 *    url を省くと既定の URL になる。enabled=true には service と confirmed=true が要る。
 * 2. `rubytee` = { enabled }。
 * 3. PATCH /classroom-groups/{id} は部分更新（送った項目だけ保存済みの値に重ねる）。
 *    条件を満たさない更新は 400 で書き込まない。送らない更新は設定を書き換えない。
 * 4. 先生向けの応答（一覧・作成・更新）は confirmed を含む全体を返す。
 * 5. 生徒向けの lookup / join / verify-session は enabled / service / url と rubytee.enabled を返す
 *    （confirmed は返さない）。設定が無い既存のクラス・クラスに属さない課題は「どちらも無効」。
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

const group = (over: Row = {}): Row => ({
  groupId: 'g1',
  teacherSub: 'dev-test-teacher',
  name: '2年1組',
  year: 2026,
  status: 'active',
  schemaVersion: 2,
  topics: [],
  studentCount: 30,
  createdAt: '2026-04-01T00:00:00.000Z',
  updatedAt: '2026-04-01T00:00:00.000Z',
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

/**
 * Mock DynamoDB with one class (group) and one assignment in it. The group
 * UpdateCommand echoes the stored item merged with the SET values.
 */
const useData = (g: Row | undefined, c: Row = classroom()) => {
  mockSend.mockImplementation((cmd: { constructor: { name: string }; input: Record<string, any> }) => {
    const name = cmd.constructor.name;
    const input = cmd.input;
    if (name === 'GetCommand' && input.TableName === 'ClassroomGroups') {
      return Promise.resolve({ Item: g && input.Key.groupId === g.groupId ? g : undefined });
    }
    if (name === 'GetCommand' && input.TableName === 'Classrooms') {
      return Promise.resolve({ Item: input.Key.classroomId === c.classroomId ? c : undefined });
    }
    if (name === 'QueryCommand' && input.TableName === 'ClassroomGroups' && input.IndexName === 'teacherSub-index') {
      return Promise.resolve({ Items: g ? [g] : [] });
    }
    if (name === 'QueryCommand' && input.TableName === 'Classrooms'
      && input.IndexName === 'joinCode-index' && input.ExpressionAttributeValues[':jc'] === c.joinCode) {
      return Promise.resolve({ Items: [c] });
    }
    if (name === 'QueryCommand' && input.IndexName === 'sessionToken-index') {
      return Promise.resolve({ Items: [{ classroomId: c.classroomId, memberId: 'm1', sessionToken: 'st-1' }] });
    }
    if (name === 'QueryCommand') return Promise.resolve({ Items: [] });
    if (name === 'UpdateCommand' && input.TableName === 'ClassroomGroups') {
      const attrs: Row = { ...g };
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

const patch = (body: unknown) => call('PATCH', '/classroom-groups/g1', body, { groupId: 'g1' });

const DISABLED_GENAI = { enabled: false, service: null, url: null, confirmed: false };
const DISABLED_STUDENT = { genai: { enabled: false, service: null, url: null }, rubytee: { enabled: false } };

describe('validateGenaiSetting (issue #1275)', () => {
  const validate = (value: unknown, existing?: Row) => require('../handler').validateGenaiSetting(value, existing);

  test('gemini / chatgpt は url を省くと既定の URL になる', () => {
    expect(validate({ service: 'gemini' })).toEqual({
      enabled: false, service: 'gemini', url: 'https://gemini.google.com/app', confirmed: false,
    });
    expect(validate({ service: 'chatgpt', confirmed: true, enabled: true })).toEqual({
      enabled: true, service: 'chatgpt', url: 'https://chatgpt.com/', confirmed: true,
    });
  });

  test('https の url を受け付け、前後の空白を落とす', () => {
    expect(validate({ service: 'other', url: ' https://example.com/ai ' }).url).toBe('https://example.com/ai');
  });

  test('confirmed=false / service なしでは有効にできない', () => {
    expect(() => validate({ service: 'gemini', enabled: true })).toThrow('confirmed');
    expect(() => validate({ enabled: true, confirmed: true })).toThrow('service');
  });

  test('claude など受け付けない service は 400', () => {
    for (const bad of ['claude', 'Claude', 'copilot', 'toString', '', 1, true]) {
      expect(() => validate({ service: bad })).toThrow('service');
    }
  });

  test('http・不正な url、18 歳以上限定サービスの url は拒否する', () => {
    for (const url of ['http://example.com/', 'not a url', 'javascript:alert(1)', 1,
      'https://claude.ai/new', 'https://www.claude.ai/', 'https://claude.com/',
      'https://claude.ai./', 'https://www.anthropic.com../']) {
      expect(() => validate({ service: 'other', url })).toThrow('url');
    }
  });

  test('other を有効にするには url が要る', () => {
    expect(() => validate({ service: 'other', enabled: true, confirmed: true })).toThrow('url');
  });

  test('boolean 以外の enabled / confirmed、オブジェクト以外は拒否する', () => {
    expect(() => validate({ service: 'gemini', enabled: 'true' })).toThrow('enabled');
    expect(() => validate({ service: 'gemini', confirmed: 1 })).toThrow('confirmed');
    expect(() => validate(null)).toThrow('genai');
    expect(() => validate([])).toThrow('genai');
  });

  test('保存済みの設定に送った項目だけを重ねる', () => {
    const existing = { genai: { enabled: true, service: 'gemini', url: 'https://gemini.google.com/app', confirmed: true } };
    expect(validate({ enabled: false }, existing)).toEqual({ ...existing.genai, enabled: false });
    // service を変えて url を省いたら、新しい service の既定 URL に切り替える。
    expect(validate({ service: 'chatgpt', enabled: false }, existing).url).toBe('https://chatgpt.com/');
  });

  test('service や url を変えたら、確認を送らない限り確認をやり直させる', () => {
    const existing = { genai: { enabled: true, service: 'gemini', url: 'https://gemini.google.com/app', confirmed: true } };
    // 有効のまま別の生成AI に切り替えるには、その生成AI の確認が要る。
    expect(() => validate({ service: 'chatgpt' }, existing)).toThrow(/confirmed/);
    expect(validate({ service: 'chatgpt', enabled: false }, existing).confirmed).toBe(false);
    expect(validate({ service: 'chatgpt', confirmed: true }, existing)).toMatchObject({ enabled: true, confirmed: true });
    expect(() => validate({ url: 'https://gemini.google.com/u/1/app' }, existing)).toThrow(/confirmed/);
    // 同じ値を送り直しただけなら確認は残る。
    expect(validate({ service: 'gemini', url: 'https://gemini.google.com/app' }, existing).confirmed).toBe(true);
  });
});

describe('validateRubyteeSetting (issue #1275)', () => {
  test('boolean の enabled だけを受け付ける', () => {
    const { validateRubyteeSetting } = require('../handler');
    expect(validateRubyteeSetting({ enabled: true })).toEqual({ enabled: true });
    expect(validateRubyteeSetting({ enabled: false })).toEqual({ enabled: false });
    for (const bad of [null, [], {}, { enabled: 'yes' }, true]) {
      expect(() => validateRubyteeSetting(bad)).toThrow('rubytee');
    }
  });
});

describe('PATCH /classroom-groups/{id} (issue #1275)', () => {
  test('生成AI・ルビティーの設定を保存して全体を返す', async () => {
    useData(group());
    const { status, body } = await patch({
      genai: { enabled: true, service: 'gemini', confirmed: true },
      rubytee: { enabled: true },
    });
    expect(status).toBe(200);
    expect(body.genai).toEqual({ enabled: true, service: 'gemini', url: 'https://gemini.google.com/app', confirmed: true });
    expect(body.rubytee).toEqual({ enabled: true });
    const names = Object.values(commands('UpdateCommand', 'ClassroomGroups')[0].input.ExpressionAttributeNames);
    expect(names).toEqual(expect.arrayContaining(['genai', 'rubytee']));
  });

  test.each([
    ['confirmed=false で enabled=true', { genai: { enabled: true, service: 'gemini', confirmed: false } }],
    ['http の URL', { genai: { service: 'other', url: 'http://example.com/' } }],
    ['claude', { genai: { service: 'claude', confirmed: true, enabled: true } }],
    ['不正な rubytee', { rubytee: { enabled: 'on' } }],
  ])('%s は 400 で書き込まない', async (_label, body) => {
    useData(group());
    const res = await patch(body);
    expect(res.status).toBe(400);
    expect(commands('UpdateCommand', 'ClassroomGroups')).toHaveLength(0);
  });

  test('保存済みの設定に重ねる（無効にするだけなら service を送らなくてよい）', async () => {
    useData(group({ genai: { enabled: true, service: 'chatgpt', url: 'https://chatgpt.com/', confirmed: true } }));
    const { status, body } = await patch({ genai: { enabled: false } });
    expect(status).toBe(200);
    expect(body.genai).toEqual({ enabled: false, service: 'chatgpt', url: 'https://chatgpt.com/', confirmed: true });
  });

  test('共同の先生も更新できる', async () => {
    useData(group({ teacherSub: 'someone-else', coTeacherEmails: ['dev-test-teacher@example.com'] }));
    const res = await patch({ rubytee: { enabled: true } });
    expect(res.status).toBe(200);
    expect(res.body.rubytee).toEqual({ enabled: true });
  });

  test('関係の無い先生は 404', async () => {
    useData(group({ teacherSub: 'someone-else' }));
    expect((await patch({ rubytee: { enabled: true } })).status).toBe(404);
    expect(commands('UpdateCommand', 'ClassroomGroups')).toHaveLength(0);
  });

  test('送らない更新は設定を書き換えず、設定の無い既存のクラスは「どちらも無効」を返す', async () => {
    useData(group());
    const { body } = await patch({ name: '2年2組' });
    const names = Object.values(commands('UpdateCommand', 'ClassroomGroups')[0].input.ExpressionAttributeNames);
    expect(names).not.toContain('genai');
    expect(names).not.toContain('rubytee');
    expect(body.genai).toEqual(DISABLED_GENAI);
    expect(body.rubytee).toEqual({ enabled: false });
  });
});

describe('GET /classroom-groups (issue #1275)', () => {
  test('設定を返し、設定の無い既存のクラスは「どちらも無効」', async () => {
    const genai = { enabled: true, service: 'gemini', url: 'https://gemini.google.com/app', confirmed: true };
    useData(group({ genai, rubytee: { enabled: true } }));
    let [g] = (await call('GET', '/classroom-groups')).body.groups;
    expect(g.genai).toEqual(genai);
    expect(g.rubytee).toEqual({ enabled: true });

    mockSend.mockReset();
    useData(group());
    [g] = (await call('GET', '/classroom-groups')).body.groups;
    expect(g.genai).toEqual(DISABLED_GENAI);
    expect(g.rubytee).toEqual({ enabled: false });
  });
});

describe('生徒向けの lookup / join / verify-session (issue #1275)', () => {
  const enabledGroup = () => group({
    genai: { enabled: true, service: 'chatgpt', url: 'https://chatgpt.com/', confirmed: true },
    rubytee: { enabled: true },
  });
  const ENABLED_STUDENT = {
    genai: { enabled: true, service: 'chatgpt', url: 'https://chatgpt.com/' },
    rubytee: { enabled: true },
  };

  const verify = async () => {
    const res = await handler({
      ...makeEvent('POST', '/classrooms/verify-session'),
      headers: { authorization: 'Bearer st-1', origin: 'http://localhost:8601' },
    });
    return { status: res.statusCode, body: JSON.parse(res.body || '{}') };
  };
  const requests: Array<[string, () => Promise<{ status?: number; body: Row }>]> = [
    ['lookup', () => call('POST', '/classrooms/lookup', { joinCode: 'abc234' })],
    ['join', () => call('POST', '/classrooms/join', { joinCode: 'abc234', seatNumber: 3 })],
    ['verify-session', verify],
  ];

  test.each(requests)('%s はクラスの設定を返す（confirmed は返さない）', async (_label, request) => {
    useData(enabledGroup());
    const res = await request();
    expect(res.status).toBe(200);
    expect(res.body.genai).toEqual(ENABLED_STUDENT.genai);
    expect(res.body.rubytee).toEqual(ENABLED_STUDENT.rubytee);
  });

  test.each(requests)('%s は設定の無いクラス・クラスに属さない課題を「どちらも無効」で返す', async (_label, request) => {
    useData(group());
    let res = await request();
    expect({ genai: res.body.genai, rubytee: res.body.rubytee }).toEqual(DISABLED_STUDENT);

    mockSend.mockReset();
    useData(undefined, classroom({ groupId: undefined }));
    res = await request();
    expect(res.status).toBe(200);
    expect({ genai: res.body.genai, rubytee: res.body.rubytee }).toEqual(DISABLED_STUDENT);
  });

  test('先生が無効にした設定は（service が残っていても）無効として返す', async () => {
    useData(group({ genai: { enabled: false, service: 'gemini', url: 'https://gemini.google.com/app', confirmed: true } }));
    const res = await verify();
    expect(res.body.genai).toEqual({ enabled: false, service: 'gemini', url: 'https://gemini.google.com/app' });
  });
});
