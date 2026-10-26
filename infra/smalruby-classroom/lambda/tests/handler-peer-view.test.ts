// このファイルをモジュールにするための宣言（#1144）。
export {};

/**
 * 他者参照（issue #1239 / GUI #1208）の infra 分。
 *
 * 守る性質:
 *
 * 1. 課題の設定 `peerView`（'none' | 'always' | 'afterSubmit'）を PUT /assignment で保存する。
 *    送らない PUT（古い画面）は値を保ち、値が無い古い課題は 'none'。GET /assignment と複製にも載る。
 * 2. GET /classrooms/{id}/peer-submissions（生徒のセッショントークン）は、同じ課題の
 *    提出済みクラスメイトの席番号・提出日時・サムネイル/ブロック画像の URL・スプライト名だけを返す。
 *    `.sb3` の URL・ニックネーム・先生のコメントは返さない。自分・非表示の提出は除く。
 * 3. 'none' は 403 `peer-view-off`、'afterSubmit' で本人未提出は 403 `not-submitted`。
 * 4. 提出 API は任意の `screenshotLabels` を保存する（無ければ保存しない）。
 * 5. 先生は PATCH で提出ごとの `hiddenFromPeers` を切り替えられ、提出一覧にも載る。
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
const FUTURE = () => Math.floor(Date.now() / 1000) + 3600;

const makeEvent = (method: string, path: string, pathParameters: Record<string, string>, token: string, body?: unknown) => ({
  requestContext: { http: { method, path, sourceIp: '127.0.0.1' } },
  headers: { authorization: `Bearer ${token}`, origin: 'http://localhost:8601' },
  pathParameters,
  body: body === undefined ? undefined : JSON.stringify(body),
});

const classroom = (over: Row = {}): Row => ({
  classroomId: 'c1',
  status: 'active',
  teacherSub: 'dev-test-teacher',
  assignmentName: '第3回',
  className: '2年1組',
  studentCount: 30,
  createdAt: '2026-10-08T00:00:00.000Z',
  ttl: FUTURE(),
  ...over,
});

const submission = (memberId: string, over: Row = {}): Row => ({
  classroomId: 'c1',
  submissionId: `sub-${memberId}`,
  memberId,
  projectName: `${memberId} の作品`,
  s3Key: `c1/sub-${memberId}/project.sb3`,
  thumbnailS3Key: `c1/sub-${memberId}/thumbnail.png`,
  screenshotCount: 2,
  status: 'submitted',
  submittedAt: '2026-10-08T01:00:00.000Z',
  teacherComment: 'よくできました',
  ttl: FUTURE(),
  ...over,
});

const ME = 'seat-03';

/**
 * Mock DynamoDB with one classroom and its submissions. The submission
 * GetCommand / queries are answered from `subs` (filtered by classroomId
 * and memberId the way the real index would).
 */
const useData = (item: Row, subs: Row[] = []) => {
  mockSend.mockImplementation((cmd: { constructor: { name: string }; input: Record<string, any> }) => {
    const name = cmd.constructor.name;
    const input = cmd.input;
    if (name === 'GetCommand' && input.TableName === 'Classrooms') {
      return Promise.resolve({ Item: input.Key.classroomId === item.classroomId ? item : undefined });
    }
    if (name === 'GetCommand' && input.TableName === 'ClassroomSubmissions') {
      return Promise.resolve({ Item: subs.find(s => s.submissionId === input.Key.submissionId) });
    }
    if (name === 'QueryCommand' && input.IndexName === 'sessionToken-index') {
      return Promise.resolve({ Items: [{ classroomId: 'c1', memberId: ME, sessionToken: SESSION, displayName: 'たろう' }] });
    }
    if (name === 'QueryCommand' && input.TableName === 'ClassroomSubmissions') {
      const values = input.ExpressionAttributeValues || {};
      const rows = subs.filter(s => s.classroomId === values[':cid'] && (values[':mid'] === undefined || s.memberId === values[':mid']));
      return Promise.resolve({ Items: rows });
    }
    if (name === 'QueryCommand') return Promise.resolve({ Items: [] });
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

const call = async (method: string, path: string, token: string, body?: unknown, params: Record<string, string> = {}) => {
  const res = await handler(makeEvent(method, path, { classroomId: 'c1', ...params }, token, body));
  return { status: res.statusCode, body: JSON.parse(res.body || '{}') };
};

describe('assignment setting peerView (issue #1239)', () => {
  test('PUT で保存し、レスポンスにも返す', async () => {
    useData(classroom());
    const { status, body } = await call('PUT', '/classrooms/c1/assignment', DEV_TOKEN, { pages: [{ text: 'p' }], peerView: 'afterSubmit' });
    expect(status).toBe(200);
    expect(body.peerView).toBe('afterSubmit');
    const [update] = commands('UpdateCommand', 'Classrooms');
    expect(update.input.UpdateExpression).toContain('peerView = :pv');
    expect(update.input.ExpressionAttributeValues[':pv']).toBe('afterSubmit');
  });

  test('送らない PUT は既存の値を変えない', async () => {
    useData(classroom({ peerView: 'always' }));
    const { body } = await call('PUT', '/classrooms/c1/assignment', DEV_TOKEN, { pages: [] });
    expect(body.peerView).toBe('always');
    expect(commands('UpdateCommand', 'Classrooms')[0].input.UpdateExpression).not.toContain('peerView');
  });

  test('3 値以外は 400', async () => {
    useData(classroom());
    const { status } = await call('PUT', '/classrooms/c1/assignment', DEV_TOKEN, { pages: [], peerView: 'sometimes' });
    expect(status).toBe(400);
    expect(commands('UpdateCommand', 'Classrooms')).toHaveLength(0);
  });

  test('GET /assignment は値を返し、値が無い古い課題は none', async () => {
    useData(classroom({ peerView: 'always' }));
    expect((await call('GET', '/classrooms/c1/assignment', SESSION)).body.peerView).toBe('always');
    useData(classroom());
    expect((await call('GET', '/classrooms/c1/assignment', DEV_TOKEN)).body.peerView).toBe('none');
  });

  test('複製で引き継ぐ', async () => {
    useData(classroom({ peerView: 'afterSubmit' }));
    const res = await call('POST', '/classrooms/c1/duplicate', DEV_TOKEN, {});
    expect(res.status).toBe(201);
    expect(commands('PutCommand', 'Classrooms')[0].input.Item.peerView).toBe('afterSubmit');
  });

  test('none は複製に書かない（古い課題と同じ形）', async () => {
    useData(classroom());
    await call('POST', '/classrooms/c1/duplicate', DEV_TOKEN, {});
    expect(commands('PutCommand', 'Classrooms')[0].input.Item).not.toHaveProperty('peerView');
  });
});

describe('GET /classrooms/{id}/peer-submissions (issue #1239)', () => {
  const peers = () => [
    submission(ME),
    submission('seat-01', { screenshotLabels: ['ねこ', 'いぬ'] }),
    submission('seat-12', { screenshotCount: 1, thumbnailS3Key: undefined }),
    submission('seat-05', { hiddenFromPeers: true }),
    submission('seat-07', { ttl: Math.floor(Date.now() / 1000) - 10 }),
    submission('seat-09', { classroomId: 'c2' }),
  ];

  test('いつでも見られる: 自分・非表示・期限切れ・別課題を除き、席番号順に返す', async () => {
    useData(classroom({ peerView: 'always' }), peers());
    const { status, body } = await call('GET', '/classrooms/c1/peer-submissions', SESSION);
    expect(status).toBe(200);
    expect(body.peerView).toBe('always');
    expect(body.submissions.map((s: Row) => s.seatNumber)).toEqual([1, 12]);
    expect(body.submissions[0]).toEqual({
      seatNumber: 1,
      submittedAt: '2026-10-08T01:00:00.000Z',
      thumbnailUrl: 'https://signed.example/c1/sub-seat-01/thumbnail.png',
      screenshotUrls: [
        'https://signed.example/c1/sub-seat-01/screenshot-0.png',
        'https://signed.example/c1/sub-seat-01/screenshot-1.png',
      ],
      screenshotLabels: ['ねこ', 'いぬ'],
    });
    // 名前の無い古い提出は null（GUI 側で「スプライト 1, 2…」にする）
    expect(body.submissions[1].screenshotLabels).toBeNull();
    expect(body.submissions[1].thumbnailUrl).toBeNull();
  });

  test('.sb3 の URL・ニックネーム・先生のコメントを含まない', async () => {
    useData(classroom({ peerView: 'always' }), peers());
    const res = await handler(makeEvent('GET', '/classrooms/c1/peer-submissions', { classroomId: 'c1' }, SESSION));
    const raw = res.body || '';
    expect(raw).not.toContain('project.sb3');
    expect(raw).not.toContain('projectUrl');
    expect(raw).not.toContain('よくできました');
    expect(raw).not.toContain('の作品');
    expect(raw).not.toContain('たろう');
    expect(raw).not.toContain('memberId');
    expect(raw).not.toContain('submissionId');
  });

  test('しない（既定）は 403 peer-view-off', async () => {
    useData(classroom(), peers());
    const { status, body } = await call('GET', '/classrooms/c1/peer-submissions', SESSION);
    expect(status).toBe(403);
    expect(body.reason).toBe('peer-view-off');
  });

  test('自分が提出したら: 未提出は 403 not-submitted', async () => {
    useData(classroom({ peerView: 'afterSubmit' }), peers().filter(s => s.memberId !== ME));
    const { status, body } = await call('GET', '/classrooms/c1/peer-submissions', SESSION);
    expect(status).toBe(403);
    expect(body.reason).toBe('not-submitted');
  });

  test('自分が提出したら: 提出済みなら見られる', async () => {
    useData(classroom({ peerView: 'afterSubmit' }), peers());
    const { status, body } = await call('GET', '/classrooms/c1/peer-submissions', SESSION);
    expect(status).toBe(200);
    expect(body.submissions.map((s: Row) => s.seatNumber)).toEqual([1, 12]);
  });

  test('別の課題のセッションは 401', async () => {
    useData(classroom({ classroomId: 'c2', peerView: 'always' }), peers());
    const res = await handler(makeEvent('GET', '/classrooms/c2/peer-submissions', { classroomId: 'c2' }, SESSION));
    expect(res.statusCode).toBe(401);
  });

  test('アーカイブ・期限切れの課題は 404（提出を読まない）', async () => {
    for (const over of [{ status: 'archived' }, { ttl: Math.floor(Date.now() / 1000) - 10 }]) {
      mockSend.mockClear();
      useData(classroom({ peerView: 'always', ...over }), peers());
      const { status } = await call('GET', '/classrooms/c1/peer-submissions', SESSION);
      expect(status).toBe(404);
      expect(commands('QueryCommand', 'ClassroomSubmissions')).toHaveLength(0);
    }
  });
});

describe('screenshotLabels on submit (issue #1239)', () => {
  test('送られた名前を保存する', async () => {
    useData(classroom());
    const { status } = await call('POST', '/classrooms/c1/submissions', SESSION, {
      projectName: 'p', screenshotCount: 2, screenshotLabels: ['ねこ', ' いぬ '],
    });
    expect(status).toBe(201);
    expect(commands('PutCommand', 'ClassroomSubmissions')[0].input.Item.screenshotLabels).toEqual(['ねこ', 'いぬ']);
  });

  test('送らない古い提出は保存しない', async () => {
    useData(classroom());
    await call('POST', '/classrooms/c1/submissions', SESSION, { projectName: 'p', screenshotCount: 1 });
    expect(commands('PutCommand', 'ClassroomSubmissions')[0].input.Item).not.toHaveProperty('screenshotLabels');
  });

  test('配列でない・文字列でない・枚数より多いは 400', async () => {
    useData(classroom());
    for (const screenshotLabels of ['ねこ', [1], ['a', 'b']]) {
      const { status } = await call('POST', '/classrooms/c1/submissions', SESSION, {
        projectName: 'p', screenshotCount: 1, screenshotLabels,
      });
      expect(status).toBe(400);
    }
    expect(commands('PutCommand', 'ClassroomSubmissions')).toHaveLength(0);
  });
});

describe('hiddenFromPeers per submission (issue #1239)', () => {
  const patch = (body: unknown) =>
    call('PATCH', '/classrooms/c1/submissions/sub-seat-01', DEV_TOKEN, body, { submissionId: 'sub-seat-01' });

  test('PATCH で切り替えて保存する', async () => {
    useData(classroom(), [submission('seat-01')]);
    const { status, body } = await patch({ hiddenFromPeers: true });
    expect(status).toBe(200);
    expect(body.hiddenFromPeers).toBe(true);
    const [update] = commands('UpdateCommand', 'ClassroomSubmissions');
    expect(update.input.ExpressionAttributeValues[':hfp']).toBe(true);
  });

  test('boolean 以外は 400', async () => {
    useData(classroom(), [submission('seat-01')]);
    expect((await patch({ hiddenFromPeers: 'yes' })).status).toBe(400);
  });

  test('再提出しても非表示は引き継ぐ（生徒が出し直して外せない）', async () => {
    useData(classroom(), [submission(ME, { hiddenFromPeers: true })]);
    const { status } = await call('POST', '/classrooms/c1/submissions', SESSION, { projectName: 'p', screenshotCount: 1 });
    expect(status).toBe(201);
    expect(commands('PutCommand', 'ClassroomSubmissions')[0].input.Item.hiddenFromPeers).toBe(true);
  });

  test('非表示でない提出の再提出・初めての提出はフラグを書かない', async () => {
    useData(classroom(), [submission(ME)]);
    await call('POST', '/classrooms/c1/submissions', SESSION, { projectName: 'p', screenshotCount: 1 });
    useData(classroom());
    await call('POST', '/classrooms/c1/submissions', SESSION, { projectName: 'p', screenshotCount: 1 });
    for (const put of commands('PutCommand', 'ClassroomSubmissions')) {
      expect(put.input.Item).not.toHaveProperty('hiddenFromPeers');
    }
  });

  test('先生の提出一覧にフラグと名前を含める（無い古い提出は false / null）', async () => {
    useData(classroom(), [submission('seat-01', { hiddenFromPeers: true, screenshotLabels: ['ねこ'] }), submission('seat-02')]);
    const { status, body } = await call('GET', '/classrooms/c1/submissions', DEV_TOKEN);
    expect(status).toBe(200);
    const bySeat = Object.fromEntries(body.submissions.map((s: Row) => [s.memberId, s]));
    expect(bySeat['seat-01'].hiddenFromPeers).toBe(true);
    expect(bySeat['seat-01'].screenshotLabels).toEqual(['ねこ']);
    expect(bySeat['seat-02'].hiddenFromPeers).toBe(false);
    expect(bySeat['seat-02'].screenshotLabels).toBeNull();
  });
});
