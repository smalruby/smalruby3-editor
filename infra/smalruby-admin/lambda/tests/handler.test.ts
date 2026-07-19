/**
 * Admin API authorization tests (EPIC #1073, S1 #1081).
 *
 * The whole point of this service is the deny-by-default allowlist, so the
 * matrix is pinned exhaustively: unknown email → 403, first login pins the
 * Google sub, a matching pin passes, a mismatched pin (email reuse) → 403.
 */

const mockSend = jest.fn();
jest.mock('@aws-sdk/lib-dynamodb', () => {
  const actual = jest.requireActual('@aws-sdk/lib-dynamodb');
  return {
    ...actual,
    DynamoDBDocumentClient: { from: () => ({ send: mockSend }) },
  };
});

// google-auth-library is fully mocked: token → payload mapping per test.
jest.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: jest.fn(async () => 'https://signed.example/get'),
}));

// S3: snapshot reads (restore, S4) go through S3Client.send.
const mockS3Send = jest.fn();
jest.mock('@aws-sdk/client-s3', () => {
  const actual = jest.requireActual('@aws-sdk/client-s3');
  return {
    ...actual,
    S3Client: jest.fn(() => ({ send: mockS3Send })),
  };
});

const mockVerifyIdToken = jest.fn();
jest.mock('google-auth-library', () => ({
  OAuth2Client: jest.fn(() => ({ verifyIdToken: mockVerifyIdToken })),
}));

const DEV_TOKEN = 'test-dev-bypass';

const makeEvent = (method: string, path: string, token?: string) => ({
  requestContext: { http: { method, path, sourceIp: '127.0.0.1' } },
  headers: {
    ...(token ? { authorization: `Bearer ${token}` } : {}),
    origin: 'https://smalruby.app',
  },
});

const googlePayload = (over: Record<string, unknown> = {}) => ({
  sub: 'google-sub-1',
  email: 'admin@example.com',
  email_verified: true,
  name: '管理者',
  ...over,
});

describe('Smalruby Admin API (issue #1081)', () => {
  let handler: (event: unknown) => Promise<{ statusCode?: number; body?: string }>;
  let authorizationOutcome: (
    row: Record<string, unknown> | null,
    identity: { sub: string; email: string },
  ) => string;

  beforeEach(() => {
    jest.resetModules();
    process.env.DEV_BYPASS_TOKEN = DEV_TOKEN;
    process.env.STAGE = 'stg';
    process.env.ADMIN_GOOGLE_CLIENT_ID = 'admin-client-id';
    process.env.CORS_ALLOWED_ORIGINS = 'https://smalruby.app,http://localhost:8602';
    mockSend.mockReset();
    mockVerifyIdToken.mockReset();
    const mod = require('../handler');
    handler = mod.handler;
    authorizationOutcome = mod.authorizationOutcome;
  });

  const commandNames = () => mockSend.mock.calls.map((c) => c[0]?.constructor?.name);

  describe('authorizationOutcome (pure matrix)', () => {
    const identity = { sub: 'google-sub-1', email: 'admin@example.com', name: null };

    test('no allowlist row → denied', () => {
      expect(authorizationOutcome(null, identity)).toBe('denied');
    });

    test('row without a pinned sub → pin (first login)', () => {
      expect(authorizationOutcome({ email: 'admin@example.com' }, identity)).toBe('pin');
      expect(authorizationOutcome({ email: 'admin@example.com', sub: '' }, identity)).toBe('pin');
    });

    test('matching pinned sub → ok; mismatch (email reuse) → denied', () => {
      expect(authorizationOutcome({ sub: 'google-sub-1' }, identity)).toBe('ok');
      expect(authorizationOutcome({ sub: 'someone-else' }, identity)).toBe('denied');
    });
  });

  describe('GET /admin/me', () => {
    test('an allowlisted admin with a matching pin gets 200', async () => {
      mockVerifyIdToken.mockResolvedValue({ getPayload: () => googlePayload() });
      mockSend.mockResolvedValue({ Item: { email: 'admin@example.com', sub: 'google-sub-1' } });

      const res = await handler(makeEvent('GET', '/admin/me', 'good-token'));
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body as string);
      expect(body.email).toBe('admin@example.com');
      // Audience is the admin-dedicated client ID (decision B).
      expect(mockVerifyIdToken).toHaveBeenCalledWith(
        expect.objectContaining({ audience: 'admin-client-id' }),
      );
    });

    test('an authenticated stranger is denied (403, deny-by-default)', async () => {
      mockVerifyIdToken.mockResolvedValue({ getPayload: () => googlePayload() });
      mockSend.mockResolvedValue({}); // no allowlist row

      const res = await handler(makeEvent('GET', '/admin/me', 'good-token'));
      expect(res.statusCode).toBe(403);
      expect(commandNames()).not.toContain('UpdateCommand');
    });

    test('first login pins the Google sub onto the allowlist row', async () => {
      mockVerifyIdToken.mockResolvedValue({ getPayload: () => googlePayload() });
      let updateInput: Record<string, unknown> | undefined;
      mockSend.mockImplementation(async (command: {
        constructor: { name: string }; input?: Record<string, unknown>;
      }) => {
        if (command.constructor.name === 'GetCommand') {
          return { Item: { email: 'admin@example.com' } }; // registered, unpinned
        }
        if (command.constructor.name === 'UpdateCommand') {
          updateInput = command.input;
          return {};
        }
        return {};
      });

      const res = await handler(makeEvent('GET', '/admin/me', 'good-token'));
      expect(res.statusCode).toBe(200);
      expect((updateInput?.ExpressionAttributeValues as Record<string, unknown>)[':sub']).toBe('google-sub-1');
      expect(updateInput?.ConditionExpression).toContain('attribute_not_exists');
    });

    test('a pinned row rejects a different Google account with the same email', async () => {
      mockVerifyIdToken.mockResolvedValue({
        getPayload: () => googlePayload({ sub: 'attacker-sub' }),
      });
      mockSend.mockResolvedValue({ Item: { email: 'admin@example.com', sub: 'google-sub-1' } });

      const res = await handler(makeEvent('GET', '/admin/me', 'good-token'));
      expect(res.statusCode).toBe(403);
    });

    test('an invalid / unverified-email token is 401 before any table access', async () => {
      mockVerifyIdToken.mockRejectedValue(new Error('bad token'));
      const badToken = await handler(makeEvent('GET', '/admin/me', 'bad-token'));
      expect(badToken.statusCode).toBe(401);

      mockVerifyIdToken.mockResolvedValue({
        getPayload: () => googlePayload({ email_verified: false }),
      });
      const unverified = await handler(makeEvent('GET', '/admin/me', 'unverified'));
      expect(unverified.statusCode).toBe(401);

      const missing = await handler(makeEvent('GET', '/admin/me'));
      expect(missing.statusCode).toBe(401);
      expect(mockSend).not.toHaveBeenCalled();
    });

    test('the stg dev bypass authenticates but still needs the allowlist', async () => {
      mockSend.mockResolvedValue({}); // dev-admin not allowlisted
      const denied = await handler(makeEvent('GET', '/admin/me', DEV_TOKEN));
      expect(denied.statusCode).toBe(403);

      mockSend.mockResolvedValue({ Item: { email: 'dev-admin@example.com', sub: 'dev-admin' } });
      const allowed = await handler(makeEvent('GET', '/admin/me', DEV_TOKEN));
      expect(allowed.statusCode).toBe(200);
      expect(mockVerifyIdToken).not.toHaveBeenCalled();
    });

    test('unknown routes 404 only after authorization', async () => {
      mockVerifyIdToken.mockResolvedValue({ getPayload: () => googlePayload() });
      mockSend.mockResolvedValue({ Item: { email: 'admin@example.com', sub: 'google-sub-1' } });
      const res = await handler(makeEvent('GET', '/admin/nope', 'good-token'));
      expect(res.statusCode).toBe(404);
    });
  });

  describe('CORS', () => {
    test('OPTIONS preflight echoes an allowed origin without auth', async () => {
      const res = await handler({
        requestContext: { http: { method: 'OPTIONS', path: '/admin/me' } },
        headers: { origin: 'http://localhost:8602' },
      }) as { statusCode: number; headers: Record<string, string> };
      expect(res.statusCode).toBe(204);
      expect(res.headers['Access-Control-Allow-Origin']).toBe('http://localhost:8602');
      expect(mockSend).not.toHaveBeenCalled();
    });
  });
});

describe('みんなの課題 management (issue #1083)', () => {
  const adminRow = { Item: { email: 'dev-admin@example.com', sub: 'dev-admin' } };
  const sharedItem = {
    sharedId: 's1',
    title: 'ねこあつめ入門',
    schoolLevel: 'junior-high',
    subject: '技術・家庭（技術分野）',
    authorName: 'るびお',
    authorSub: 'secret-sub',
    status: 'published',
    reuseCount: 2,
    content: { pages: [{ text: 'ページ1', imageKey: 'shared/s1/image.png' }], starterKey: 'shared/s1/starter.sb3' },
    createdAt: '2026-07-18T00:00:00.000Z',
    updatedAt: '2026-07-18T00:00:00.000Z',
  };

  let handler: (event: unknown) => Promise<{ statusCode?: number; body?: string }>;
  let buildReportQueue: (reports: Record<string, unknown>[]) => {
    sharedId: string; count: number; reports: { reason: string; createdAt: string }[];
  }[];

  beforeEach(() => {
    jest.resetModules();
    process.env.DEV_BYPASS_TOKEN = DEV_TOKEN;
    process.env.STAGE = 'stg';
    process.env.ADMIN_GOOGLE_CLIENT_ID = 'admin-client-id';
    mockSend.mockReset();
    mockVerifyIdToken.mockReset();
    const mod = require('../handler');
    handler = mod.handler;
    buildReportQueue = mod.buildReportQueue;
  });

  test('buildReportQueue groups by item, most-reported first, without reporterSub', () => {
    const queue = buildReportQueue([
      { sharedId: 'a', reason: 'r1', createdAt: '2026-07-18T01:00:00Z', reporterSub: 'x' },
      { sharedId: 'b', reason: 'r2', createdAt: '2026-07-18T02:00:00Z', reporterSub: 'y' },
      { sharedId: 'b', reason: 'r3', createdAt: '2026-07-18T03:00:00Z', reporterSub: 'z' },
    ]);
    expect(queue.map(q => q.sharedId)).toEqual(['b', 'a']);
    expect(queue[0].reports.map(r => r.reason)).toEqual(['r3', 'r2']);
    expect(JSON.stringify(queue)).not.toContain('reporterSub');
  });

  test('GET /admin/shared-assignments lists fleet-wide items without authorSub', async () => {
    mockSend.mockImplementation(async (command: {
      constructor: { name: string }; input?: Record<string, unknown>;
    }) => {
      if (command.constructor.name === 'GetCommand') return adminRow;
      if (command.constructor.name === 'ScanCommand') return { Items: [sharedItem] };
      return {};
    });

    const res = await handler({
      requestContext: { http: { method: 'GET', path: '/admin/shared-assignments' } },
      headers: { authorization: `Bearer ${DEV_TOKEN}`, origin: 'https://smalruby.app' },
    });
    expect(res.statusCode).toBe(200);
    const { items } = JSON.parse(res.body as string);
    expect(items[0].title).toBe('ねこあつめ入門');
    expect(items[0].hasStarter).toBe(true);
    expect(items[0].authorSub).toBeUndefined();
  });

  test('GET /admin/shared-assignments/reports joins the reported items', async () => {
    mockSend.mockImplementation(async (command: {
      constructor: { name: string }; input?: { TableName?: string };
    }) => {
      const name = command.constructor.name;
      if (name === 'GetCommand' && command.input?.TableName?.includes('Admins')) return adminRow;
      if (name === 'GetCommand') return { Item: sharedItem };
      if (name === 'ScanCommand') {
        return { Items: [{ sharedId: 's1', reason: '不適切', createdAt: '2026-07-18T00:00:00Z' }] };
      }
      return {};
    });

    const res = await handler({
      requestContext: { http: { method: 'GET', path: '/admin/shared-assignments/reports' } },
      headers: { authorization: `Bearer ${DEV_TOKEN}`, origin: 'https://smalruby.app' },
    });
    expect(res.statusCode).toBe(200);
    const { queue } = JSON.parse(res.body as string);
    expect(queue[0].count).toBe(1);
    expect(queue[0].item.title).toBe('ねこあつめ入門');
  });

  test('GET detail presigns page images and the starter project', async () => {
    mockSend.mockImplementation(async (command: {
      constructor: { name: string }; input?: { TableName?: string };
    }) => {
      const name = command.constructor.name;
      if (name === 'GetCommand' && command.input?.TableName?.includes('Admins')) return adminRow;
      if (name === 'GetCommand') return { Item: sharedItem };
      return {};
    });

    const res = await handler({
      requestContext: { http: { method: 'GET', path: '/admin/shared-assignments/s1' } },
      pathParameters: { sharedId: 's1' },
      headers: { authorization: `Bearer ${DEV_TOKEN}`, origin: 'https://smalruby.app' },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body as string);
    expect(body.pages[0].imageUrl).toBe('https://signed.example/get');
    // The starter is moderated content too — the operator gets a download URL.
    expect(body.starterUrl).toBe('https://signed.example/get');

    // Without a starterKey the field is null, not a broken link.
    mockSend.mockImplementation(async (command: {
      constructor: { name: string }; input?: { TableName?: string };
    }) => {
      const name = command.constructor.name;
      if (name === 'GetCommand' && command.input?.TableName?.includes('Admins')) return adminRow;
      if (name === 'GetCommand') return { Item: { ...sharedItem, content: { pages: [] } } };
      return {};
    });
    const bare = await handler({
      requestContext: { http: { method: 'GET', path: '/admin/shared-assignments/s1' } },
      pathParameters: { sharedId: 's1' },
      headers: { authorization: `Bearer ${DEV_TOKEN}`, origin: 'https://smalruby.app' },
    });
    expect(JSON.parse(bare.body as string).starterUrl).toBeNull();
  });

  test('PATCH flips the status and audits the action', async () => {
    const logs: string[] = [];
    const spy = jest.spyOn(console, 'log').mockImplementation((line: string) => {
      logs.push(String(line));
    });
    mockSend.mockImplementation(async (command: {
      constructor: { name: string }; input?: { TableName?: string };
    }) => {
      const name = command.constructor.name;
      if (name === 'GetCommand' && command.input?.TableName?.includes('Admins')) return adminRow;
      if (name === 'GetCommand') return { Item: sharedItem };
      return {};
    });

    const res = await handler({
      requestContext: { http: { method: 'PATCH', path: '/admin/shared-assignments/s1' } },
      pathParameters: { sharedId: 's1' },
      headers: { authorization: `Bearer ${DEV_TOKEN}`, origin: 'https://smalruby.app' },
      body: JSON.stringify({ status: 'unlisted' }),
    });
    spy.mockRestore();

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body as string).status).toBe('unlisted');
    expect(logs.some(line => line.includes('"action":"shared.setStatus"') && line.includes('"status":"unlisted"'))).toBe(true);
  });

  test('PATCH rejects an unknown status (400) and an unknown item (404)', async () => {
    mockSend.mockImplementation(async (command: {
      constructor: { name: string }; input?: { TableName?: string };
    }) => {
      if (command.constructor.name === 'GetCommand' && command.input?.TableName?.includes('Admins')) return adminRow;
      return {};
    });

    const bad = await handler({
      requestContext: { http: { method: 'PATCH', path: '/admin/shared-assignments/s1' } },
      pathParameters: { sharedId: 's1' },
      headers: { authorization: `Bearer ${DEV_TOKEN}`, origin: 'https://smalruby.app' },
      body: JSON.stringify({ status: 'deleted' }),
    });
    expect(bad.statusCode).toBe(400);

    const missing = await handler({
      requestContext: { http: { method: 'PATCH', path: '/admin/shared-assignments/s1' } },
      pathParameters: { sharedId: 's1' },
      headers: { authorization: `Bearer ${DEV_TOKEN}`, origin: 'https://smalruby.app' },
      body: JSON.stringify({ status: 'unlisted' }),
    });
    expect(missing.statusCode).toBe(404);
  });
});

describe('クラス管理 + 期限切れ復元 (issue #1084)', () => {
  const adminRow = { Item: { email: 'dev-admin@example.com', sub: 'dev-admin' } };
  const classroomItem = {
    classroomId: 'c1',
    className: '5年1組',
    assignmentName: 'ねこあつめ',
    joinCode: 'ABC123',
    studentCount: 30,
    groupId: 'g1',
    status: 'active',
    createdAt: '2026-07-01T00:00:00.000Z',
    ttl: 1800000000,
  };

  /** An S3 GetObject result whose Body parses as the given snapshot. */
  const s3Json = (item: Record<string, unknown>, deletedAt = '2026-07-10T00:00:00.000Z') => ({
    Body: { transformToString: async () => JSON.stringify({ table: 'x', deletedAt, eventId: null, item }) },
  });

  let handler: (event: unknown) => Promise<{ statusCode?: number; body?: string }>;

  const makeAuthedEvent = (
    method: string, path: string,
    extra: Record<string, unknown> = {},
  ) => ({
    requestContext: { http: { method, path } },
    headers: { authorization: `Bearer ${DEV_TOKEN}`, origin: 'https://smalruby.app' },
    ...extra,
  });

  beforeEach(() => {
    jest.resetModules();
    process.env.DEV_BYPASS_TOKEN = DEV_TOKEN;
    process.env.STAGE = 'stg';
    process.env.ADMIN_GOOGLE_CLIENT_ID = 'admin-client-id';
    mockSend.mockReset();
    mockS3Send.mockReset();
    mockVerifyIdToken.mockReset();
    handler = require('../handler').handler;
  });

  test('GET /admin/classrooms filters quota rows and matches join code / names', async () => {
    mockSend.mockImplementation(async (command: {
      constructor: { name: string }; input?: { TableName?: string };
    }) => {
      if (command.constructor.name === 'GetCommand') return adminRow;
      if (command.constructor.name === 'ScanCommand') {
        return { Items: [
          classroomItem,
          { ...classroomItem, classroomId: 'c2', className: '6年2組', joinCode: 'XYZ999' },
          { classroomId: 'eval-quota#t1#2026-07-18', count: 3 },
          { classroomId: 'share-quota#t1#2026-07-18', count: 1 },
        ] };
      }
      return {};
    });

    const all = await handler(makeAuthedEvent('GET', '/admin/classrooms'));
    expect(all.statusCode).toBe(200);
    expect(JSON.parse(all.body as string).items).toHaveLength(2);

    const byCode = await handler(makeAuthedEvent('GET', '/admin/classrooms', {
      queryStringParameters: { q: 'abc123' },
    }));
    const { items } = JSON.parse(byCode.body as string);
    expect(items).toHaveLength(1);
    expect(items[0].className).toBe('5年1組');
    // The ttl epoch is surfaced as a readable expiry.
    expect(items[0].expiresAt).toBe(new Date(1800000000 * 1000).toISOString());
  });

  test('GET /admin/classrooms/{id} joins member/submission counts', async () => {
    mockSend.mockImplementation(async (command: {
      constructor: { name: string }; input?: { TableName?: string };
    }) => {
      const name = command.constructor.name;
      if (name === 'GetCommand' && command.input?.TableName?.includes('Admins')) return adminRow;
      if (name === 'GetCommand') return { Item: classroomItem };
      if (name === 'QueryCommand') return { Count: 7 };
      return {};
    });

    const res = await handler(makeAuthedEvent('GET', '/admin/classrooms/c1', {
      pathParameters: { classroomId: 'c1' },
    }));
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body as string);
    expect(body.memberCount).toBe(7);
    expect(body.submissionCount).toBe(7);
  });

  test('PATCH /admin/classrooms/{id} flips the status and audits it', async () => {
    const logs: string[] = [];
    const spy = jest.spyOn(console, 'log').mockImplementation((line: string) => {
      logs.push(String(line));
    });
    mockSend.mockImplementation(async (command: {
      constructor: { name: string }; input?: { TableName?: string };
    }) => {
      const name = command.constructor.name;
      if (name === 'GetCommand' && command.input?.TableName?.includes('Admins')) return adminRow;
      if (name === 'GetCommand') return { Item: classroomItem };
      return {};
    });

    const res = await handler(makeAuthedEvent('PATCH', '/admin/classrooms/c1', {
      pathParameters: { classroomId: 'c1' },
      body: JSON.stringify({ status: 'archived' }),
    }));
    spy.mockRestore();

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body as string).status).toBe('archived');
    expect(logs.some(line =>
      line.includes('"action":"classroom.setStatus"') && line.includes('"status":"archived"'))).toBe(true);

    const bad = await handler(makeAuthedEvent('PATCH', '/admin/classrooms/c1', {
      pathParameters: { classroomId: 'c1' },
      body: JSON.stringify({ status: 'deleted' }),
    }));
    expect(bad.statusCode).toBe(400);
  });

  test('GET /admin/classrooms/overview aggregates the dashboard', async () => {
    mockSend.mockImplementation(async (command: {
      constructor: { name: string }; input?: { TableName?: string };
    }) => {
      const name = command.constructor.name;
      if (name === 'GetCommand') return adminRow;
      if (name === 'ScanCommand' && command.input?.TableName?.includes('SharedAssignments')) {
        return { Items: [{ title: '共有済みの課題' }] };
      }
      if (name === 'ScanCommand') {
        return { Items: [
          { classroomId: 'c1', className: '5年1組', assignmentName: 'ねこ迷路ゲーム', teacherSub: 't1',
            status: 'active', createdAt: '2026-07-10T00:00:00.000Z',
            content: { pages: [{ text: 'a', imageKey: 'k' }, { text: 'b' }], starterKey: 's' } },
          { classroomId: 'eval-quota#t1#2026-07-19', status: 'active' },
        ] };
      }
      return {};
    });

    const res = await handler(makeAuthedEvent('GET', '/admin/classrooms/overview'));
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body as string);
    expect(body.summary.total).toBe(1); // quota row excluded
    expect(body.candidates[0].classroomId).toBe('c1');
    expect(body.candidates[0].hasStarter).toBe(true);
    expect(body.creationTrend[0].month).toBe('2026-07');
  });

  test('GET restore-candidates browses all with facets, filters by q', async () => {
    mockSend.mockResolvedValue(adminRow);
    mockS3Send.mockImplementation(async (command: { constructor: { name: string }; input?: { Key?: string } }) => {
      if (command.constructor.name === 'ListObjectsV2Command') {
        return { Contents: [
          { Key: 'ddb-archive/classrooms/c1.json' },
          { Key: 'ddb-archive/classrooms/c2.json' },
        ] };
      }
      if (command.input?.Key === 'ddb-archive/classrooms/c1.json') {
        return s3Json({ ...classroomItem, teacherSub: 't1' });
      }
      return s3Json({ ...classroomItem, classroomId: 'c2', className: '6年2組', joinCode: 'XYZ999', teacherSub: 't2' });
    });

    // No q → browse everything, with facets (削除時期/先生) for narrowing.
    const all = await handler(makeAuthedEvent('GET', '/admin/classrooms/restore-candidates'));
    expect(all.statusCode).toBe(200);
    const allBody = JSON.parse(all.body as string);
    expect(allBody.items).toHaveLength(2);
    expect(allBody.facets.byTeacher.map((t: { teacherSub: string }) => t.teacherSub).sort()).toEqual(['t1', 't2']);
    expect(allBody.facets.byMonth[0].month).toBe('2026-07');

    // q filters the item list (facets still reflect the whole set).
    const res = await handler(makeAuthedEvent('GET', '/admin/classrooms/restore-candidates', {
      queryStringParameters: { q: '5年' },
    }));
    expect(res.statusCode).toBe(200);
    const { items } = JSON.parse(res.body as string);
    expect(items).toHaveLength(1);
    expect(items[0].classroomId).toBe('c1');
    expect(items[0].deletedAt).toBe('2026-07-10T00:00:00.000Z');
  });

  test('GET restore-plan reports a live classroom instead of planning', async () => {
    mockSend.mockImplementation(async (command: {
      constructor: { name: string }; input?: { TableName?: string };
    }) => {
      const name = command.constructor.name;
      if (name === 'GetCommand' && command.input?.TableName?.includes('Admins')) return adminRow;
      if (name === 'GetCommand') return { Item: { ...classroomItem, status: 'archived' } };
      return {};
    });

    const res = await handler(makeAuthedEvent('GET', '/admin/classrooms/c1/restore-plan', {
      pathParameters: { classroomId: 'c1' },
    }));
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body as string)).toEqual({ alive: true, status: 'archived' });
    expect(mockS3Send).not.toHaveBeenCalled();
  });

  test('POST restore rehydrates group→classroom→children with a no-clobber condition', async () => {
    const puts: { TableName: string; Item: Record<string, unknown>; ConditionExpression?: string }[] = [];
    mockSend.mockImplementation(async (command: {
      constructor: { name: string }; input?: { TableName?: string };
    }) => {
      const name = command.constructor.name;
      if (name === 'GetCommand' && command.input?.TableName?.includes('Admins')) return adminRow;
      if (name === 'GetCommand') return {}; // classroom and group both swept
      if (name === 'PutCommand') {
        puts.push(command.input as typeof puts[number]);
        return {};
      }
      return {};
    });
    mockS3Send.mockImplementation(async (command: {
      constructor: { name: string }; input?: { Key?: string; Prefix?: string };
    }) => {
      const name = command.constructor.name;
      if (name === 'ListObjectsV2Command') {
        if (command.input?.Prefix?.startsWith('ddb-archive/memberships/')) {
          return { Contents: [{ Key: 'ddb-archive/memberships/c1/seat-01.json' }] };
        }
        return { Contents: [{ Key: 'ddb-archive/submissions/c1/s1.json' }] };
      }
      if (name === 'HeadObjectCommand') {
        const err = new Error('gone');
        err.name = 'NotFound';
        throw err; // the submission binary was lifecycle-swept
      }
      const key = command.input?.Key || '';
      if (key === 'ddb-archive/classrooms/c1.json') return s3Json(classroomItem);
      if (key === 'ddb-archive/groups/g1.json') return s3Json({ groupId: 'g1', status: 'archived' });
      if (key.includes('memberships')) return s3Json({ classroomId: 'c1', memberId: 'seat-01' });
      return s3Json({ classroomId: 'c1', submissionId: 's1', s3Key: 'submissions/c1/s1/project.sb3' });
    });

    const res = await handler(makeAuthedEvent('POST', '/admin/classrooms/c1/restore', {
      pathParameters: { classroomId: 'c1' },
    }));
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body as string);
    expect(body.restored).toBe(4); // group + classroom + membership + submission
    expect(body.missingFiles).toBe(1);
    expect(body.classroom.status).toBe('active');

    expect(puts.map(p => p.TableName)).toEqual([
      'ClassroomGroups', 'Classrooms', 'ClassroomMemberships', 'ClassroomSubmissions',
    ]);
    // The classroom put must never clobber a live row (raced restore).
    expect(puts[1].ConditionExpression).toContain('attribute_not_exists');
    expect(puts[1].Item.status).toBe('active');
    expect(puts[1].Item.restoredAt).toBeTruthy();
  });

  test('POST restore refuses a live classroom and 404s a missing snapshot', async () => {
    mockSend.mockImplementation(async (command: {
      constructor: { name: string }; input?: { TableName?: string };
    }) => {
      const name = command.constructor.name;
      if (name === 'GetCommand' && command.input?.TableName?.includes('Admins')) return adminRow;
      if (name === 'GetCommand') return { Item: classroomItem }; // alive
      return {};
    });

    const alive = await handler(makeAuthedEvent('POST', '/admin/classrooms/c1/restore', {
      pathParameters: { classroomId: 'c1' },
    }));
    expect(alive.statusCode).toBe(400);

    // Now: not alive, but no snapshot either.
    mockSend.mockImplementation(async (command: {
      constructor: { name: string }; input?: { TableName?: string };
    }) => {
      if (command.constructor.name === 'GetCommand' && command.input?.TableName?.includes('Admins')) return adminRow;
      return {};
    });
    mockS3Send.mockImplementation(async () => {
      const err = new Error('missing');
      err.name = 'NoSuchKey';
      throw err;
    });
    const missing = await handler(makeAuthedEvent('POST', '/admin/classrooms/c1/restore', {
      pathParameters: { classroomId: 'c1' },
    }));
    expect(missing.statusCode).toBe(404);
  });
});
