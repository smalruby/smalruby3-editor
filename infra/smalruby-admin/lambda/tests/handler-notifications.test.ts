/**
 * お知らせ送信 API tests — EPIC #1111.
 *
 * The admin stack is the single writer of teacher notices. The SPA only
 * ever sends a classroomId — the recipient teacherSub is resolved here and
 * never crosses the wire (same principle as authorSub in the shared
 * projections).
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
  getSignedUrl: jest.fn(async () => 'https://signed.example/get'),
}));

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

const makeEvent = (method: string, path: string, token?: string, body?: unknown) => ({
  requestContext: { http: { method, path, sourceIp: '127.0.0.1' } },
  headers: {
    ...(token ? { authorization: `Bearer ${token}` } : {}),
    origin: 'https://smalruby.app',
  },
  body: body === undefined ? undefined : JSON.stringify(body),
});

describe('POST /admin/notifications (EPIC #1111)', () => {
  let handler: (event: unknown) => Promise<{ statusCode?: number; body?: string }>;

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
  });

  /**
   * Route DynamoDB commands: the allowlist Get (SmalrubyAdmins), the
   * classroom Get, and the notification Put.
   * @param classroom - the Classrooms item returned for the lookup (null = missing)
   * @returns collected PutCommand inputs
   */
  const wireMocks = (classroom: Record<string, unknown> | null) => {
    const puts: Array<Record<string, unknown>> = [];
    mockSend.mockImplementation(async (command: {
      constructor: { name: string }; input?: Record<string, unknown>;
    }) => {
      const name = command.constructor.name;
      const table = command.input?.TableName as string | undefined;
      if (name === 'GetCommand' && table?.startsWith('SmalrubyAdmins')) {
        return { Item: { email: 'dev-admin@example.com', sub: 'dev-admin' } };
      }
      if (name === 'GetCommand' && table?.startsWith('Classrooms')) {
        return { Item: classroom };
      }
      if (name === 'PutCommand') {
        puts.push(command.input as Record<string, unknown>);
        return {};
      }
      return {};
    });
    return puts;
  };

  test('writes a notice addressed to the classroom owner, 201', async () => {
    const puts = wireMocks({ classroomId: 'c1', teacherSub: 'teacher-sub-9' });
    const res = await handler(makeEvent('POST', '/admin/notifications', DEV_TOKEN, {
      classroomId: 'c1',
      title: '運営からのお知らせ',
      message: 'この課題、みんなの課題に共有しませんか？',
    }));
    expect(res.statusCode).toBe(201);
    expect(JSON.parse(res.body as string).notificationId).toBeTruthy();
    expect(puts).toHaveLength(1);
    const item = puts[0].Item as Record<string, unknown>;
    expect(item.teacherSub).toBe('teacher-sub-9');
    expect(item.type).toBe('admin_message');
    expect(item.title).toBe('運営からのお知らせ');
    expect(item.body).toBe('この課題、みんなの課題に共有しませんか？');
    expect(item.link).toEqual({ kind: 'classroom', classroomId: 'c1' });
    expect(item.createdBy).toBe('dev-admin@example.com');
    // createdAt-prefixed sort key (chronological inbox) + TTL stamped.
    expect(String(item.notificationId)).toMatch(/^\d{4}-\d{2}-\d{2}T.*#[0-9a-f-]+$/);
    expect(typeof item.ttl).toBe('number');
  });

  test('404 when the classroom does not exist (nothing written)', async () => {
    const puts = wireMocks(null);
    const res = await handler(makeEvent('POST', '/admin/notifications', DEV_TOKEN, {
      classroomId: 'missing',
      title: 't',
      message: 'm',
    }));
    expect(res.statusCode).toBe(404);
    expect(puts).toHaveLength(0);
  });

  test('400 on missing/oversized fields', async () => {
    wireMocks({ classroomId: 'c1', teacherSub: 'teacher-sub-9' });
    const cases = [
      { title: 't', message: 'm' }, // no classroomId
      { classroomId: 'c1', message: 'm' }, // no title
      { classroomId: 'c1', title: 't' }, // no message
      { classroomId: 'c1', title: 'x'.repeat(101), message: 'm' },
      { classroomId: 'c1', title: 't', message: 'x'.repeat(1001) },
    ];
    for (const body of cases) {
      const res = await handler(makeEvent('POST', '/admin/notifications', DEV_TOKEN, body));
      expect(res.statusCode).toBe(400);
    }
  });

  test('401 without a token, 403 for a non-admin', async () => {
    let res = await handler(makeEvent('POST', '/admin/notifications', undefined, {}));
    expect(res.statusCode).toBe(401);

    mockVerifyIdToken.mockResolvedValue({
      getPayload: () => ({
        sub: 'stranger', email: 'stranger@example.com', email_verified: true, name: null,
      }),
    });
    mockSend.mockResolvedValue({}); // no allowlist row
    res = await handler(makeEvent('POST', '/admin/notifications', 'stranger-token', {
      classroomId: 'c1', title: 't', message: 'm',
    }));
    expect(res.statusCode).toBe(403);
  });

  test('audit log records the send', async () => {
    wireMocks({ classroomId: 'c1', teacherSub: 'teacher-sub-9' });
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => undefined);
    try {
      await handler(makeEvent('POST', '/admin/notifications', DEV_TOKEN, {
        classroomId: 'c1', title: 't', message: 'm',
      }));
      const auditLines = logSpy.mock.calls
        .map(args => String(args[0]))
        .filter(line => line.includes('"audit":true'));
      expect(auditLines.some(line => line.includes('"action":"notification.send"'))).toBe(true);
    } finally {
      logSpy.mockRestore();
    }
  });
});
