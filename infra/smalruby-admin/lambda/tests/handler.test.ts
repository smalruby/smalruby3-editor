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
