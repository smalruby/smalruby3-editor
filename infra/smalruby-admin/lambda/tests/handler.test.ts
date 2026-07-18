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
