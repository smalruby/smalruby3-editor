/**
 * Handler-level authorization tests for the bug-report endpoints.
 *
 * These exercise the full request path (router → verifyIdToken → admin gate)
 * through the exported `handler`, with DynamoDB's docClient.send and the S3
 * presigner mocked. They prove the privacy/security guarantees from the design:
 *
 *   - a reporter only ever sees their OWN reports, and never receives S3
 *     keys/download URLs;
 *   - admin-only endpoints reject an authenticated non-admin with 403, before
 *     any data is read out;
 *   - bootstrap-env admins are accepted without an Admins-table row;
 *   - bootstrap admins cannot be removed via the API.
 *
 * The requester is the dev-bypass identity
 * ({sub:'dev-test-user', email:'dev-test-user@example.com'}). We make that
 * identity an admin (bootstrap) or not by toggling BOOTSTRAP_ADMIN_EMAILS.
 */

const mockSend = jest.fn();
jest.mock('@aws-sdk/lib-dynamodb', () => {
  const actual = jest.requireActual('@aws-sdk/lib-dynamodb');
  return {
    ...actual,
    DynamoDBDocumentClient: { from: () => ({ send: mockSend }) },
  };
});

// Stub the S3 presigner so no network/credentials are needed.
jest.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: jest.fn(async (_c: unknown, cmd: { input?: { Key?: string } }) =>
    `https://signed.example/${cmd?.input?.Key || 'x'}`),
}));

const DEV_TOKEN = 'dev-bypass';

const makeEvent = (
  method: string,
  path: string,
  pathParameters: Record<string, string> = {},
  body?: unknown,
  token?: string,
) => ({
  requestContext: { http: { method, path, sourceIp: '127.0.0.1' } },
  headers: {
    ...(token ? { authorization: `Bearer ${token}` } : {}),
    origin: 'http://localhost:8601',
  },
  pathParameters,
  queryStringParameters: {},
  body: body === undefined ? undefined : JSON.stringify(body),
});

const commandNames = () => mockSend.mock.calls.map(c => c[0]?.constructor?.name);

const loadHandler = () => {
  jest.resetModules();
  return require('../handler').handler as (e: unknown) => Promise<{ statusCode?: number; body?: string }>;
};

describe('reporter endpoints', () => {
  beforeEach(() => {
    process.env.DEV_BYPASS_TOKEN = DEV_TOKEN;
    process.env.STAGE = 'stg';
    process.env.BOOTSTRAP_ADMIN_EMAILS = ''; // dev-test-user is NOT an admin here
    process.env.CORS_ALLOWED_ORIGINS = 'http://localhost:8601';
    mockSend.mockReset();
  });

  test('POST /bug-reports requires authentication', async () => {
    const handler = loadHandler();
    const res = await handler(makeEvent('POST', '/bug-reports', {}, { description: 'x' }));
    expect(res.statusCode).toBe(401);
    expect(mockSend).not.toHaveBeenCalled();
  });

  test('POST /bug-reports validates description before writing', async () => {
    const handler = loadHandler();
    const res = await handler(makeEvent('POST', '/bug-reports', {}, { description: '' }, DEV_TOKEN));
    expect(res.statusCode).toBe(400);
    expect(commandNames()).not.toContain('PutCommand');
  });

  test('POST /bug-reports stores ownerSub and returns presigned upload URLs', async () => {
    mockSend.mockResolvedValue({});
    const handler = loadHandler();
    const res = await handler(makeEvent('POST', '/bug-reports', {}, { description: 'ブロックが消える', screenshotCount: 2 }, DEV_TOKEN));
    expect(res.statusCode).toBe(201);
    const out = JSON.parse(res.body as string);
    expect(out.reportId).toBeTruthy();
    expect(out.uploadUrl).toContain('project.sb3');
    expect(out.screenshotUploadUrls).toHaveLength(2);

    const putCall = mockSend.mock.calls.find(c => c[0]?.constructor?.name === 'PutCommand');
    expect(putCall[0].input.Item.ownerSub).toBe('dev-test-user');
    expect(putCall[0].input.Item.status).toBe('open');
    expect(putCall[0].input.Item.entityType).toBe('bugReport');
  });

  test('GET /bug-reports queries by ownerSub and never leaks S3 keys/URLs', async () => {
    mockSend.mockResolvedValue({
      Items: [
        {
          reportId: 'r1', ownerSub: 'dev-test-user', description: 'd', status: 'open',
          developerReply: 'なおったよ', createdAt: 't', updatedAt: 't',
          s3KeyProject: 'r1/project.sb3', s3KeyThumbnail: 'r1/thumbnail.png',
        },
      ],
    });
    const handler = loadHandler();
    const res = await handler(makeEvent('GET', '/bug-reports', {}, undefined, DEV_TOKEN));
    expect(res.statusCode).toBe(200);

    // Query must be scoped to the caller's ownerSub.
    const queryCall = mockSend.mock.calls.find(c => c[0]?.constructor?.name === 'QueryCommand');
    expect(queryCall[0].input.IndexName).toBe('ownerSub-createdAt-index');
    expect(queryCall[0].input.ExpressionAttributeValues[':sub']).toBe('dev-test-user');

    const bodyStr = res.body as string;
    expect(bodyStr).not.toContain('s3Key');
    expect(bodyStr).not.toContain('project.sb3');
    expect(bodyStr).not.toContain('signed.example');
    const out = JSON.parse(bodyStr);
    expect(out.reports[0].developerReply).toBe('なおったよ');
  });
});

describe('admin endpoints — non-admin is forbidden', () => {
  beforeEach(() => {
    process.env.DEV_BYPASS_TOKEN = DEV_TOKEN;
    process.env.STAGE = 'stg';
    process.env.BOOTSTRAP_ADMIN_EMAILS = ''; // dev-test-user is NOT an admin
    process.env.CORS_ALLOWED_ORIGINS = 'http://localhost:8601';
    mockSend.mockReset();
    // isAdminIdentity → Admins GetCommand returns nothing.
    mockSend.mockResolvedValue({});
  });

  // Every row carries a body slot (possibly undefined) so the callback arity
  // matches the args jest-each passes — otherwise jest injects a `done`
  // callback for the missing 4th param and the test hangs.
  const adminRoutes: Array<[string, string, Record<string, string>, unknown]> = [
    ['GET', '/admin/bug-reports', {}, undefined],
    ['GET', '/admin/bug-reports/r1', { reportId: 'r1' }, undefined],
    ['PATCH', '/admin/bug-reports/r1', { reportId: 'r1' }, { status: 'resolved' }],
    ['GET', '/admin/admins', {}, undefined],
    ['POST', '/admin/admins', {}, { email: 'x@example.com' }],
    ['DELETE', '/admin/admins/x@example.com', { email: 'x@example.com' }, undefined],
  ];

  test.each(adminRoutes)('%s %s by a non-admin is 403 and performs no mutation', async (method, path, params, body) => {
    const handler = loadHandler();
    const res = await handler(makeEvent(method as string, path as string, params as Record<string, string>, body, DEV_TOKEN));
    expect(res.statusCode).toBe(403);
    expect(commandNames()).not.toContain('PutCommand');
    expect(commandNames()).not.toContain('UpdateCommand');
    expect(commandNames()).not.toContain('DeleteCommand');
    expect(commandNames()).not.toContain('ScanCommand');
  });

  test('an admin endpoint without a token is 401', async () => {
    const handler = loadHandler();
    const res = await handler(makeEvent('GET', '/admin/bug-reports'));
    expect(res.statusCode).toBe(401);
    expect(mockSend).not.toHaveBeenCalled();
  });
});

describe('admin endpoints — bootstrap admin is allowed', () => {
  beforeEach(() => {
    process.env.DEV_BYPASS_TOKEN = DEV_TOKEN;
    process.env.STAGE = 'stg';
    // dev-test-user@example.com IS a bootstrap admin here.
    process.env.BOOTSTRAP_ADMIN_EMAILS = 'dev-test-user@example.com';
    process.env.CORS_ALLOWED_ORIGINS = 'http://localhost:8601';
    mockSend.mockReset();
  });

  test('GET /admin/bug-reports lists all reports with download URLs', async () => {
    mockSend.mockResolvedValue({
      Items: [
        { reportId: 'r1', ownerEmail: 'kid@example.com', description: 'd', status: 'open', s3KeyThumbnail: 'r1/thumbnail.png', screenshotCount: 0, createdAt: 't', updatedAt: 't', entityType: 'bugReport' },
      ],
    });
    const handler = loadHandler();
    const res = await handler(makeEvent('GET', '/admin/bug-reports', {}, undefined, DEV_TOKEN));
    expect(res.statusCode).toBe(200);
    const out = JSON.parse(res.body as string);
    expect(out.reports[0].reportId).toBe('r1');
    expect(out.reports[0].thumbnailUrl).toContain('signed.example');
    // The all-reports GSI must be used.
    const queryCall = mockSend.mock.calls.find(c => c[0]?.constructor?.name === 'QueryCommand');
    expect(queryCall[0].input.IndexName).toBe('entityType-createdAt-index');
  });

  test('PATCH /admin/bug-reports/{id} to resolved sets a TTL', async () => {
    mockSend.mockImplementation(async (cmd: { constructor: { name: string } }) => {
      if (cmd.constructor.name === 'UpdateCommand') return {};
      return { Item: { reportId: 'r1', status: 'open' } }; // GetCommand
    });
    const handler = loadHandler();
    const res = await handler(makeEvent('PATCH', '/admin/bug-reports/r1', { reportId: 'r1' }, { status: 'resolved', developerReply: 'fixed' }, DEV_TOKEN));
    expect(res.statusCode).toBe(200);
    const updateCall = mockSend.mock.calls.find(c => c[0]?.constructor?.name === 'UpdateCommand');
    expect(updateCall[0].input.UpdateExpression).toContain('#ttl = :ttl');
    expect(updateCall[0].input.ExpressionAttributeValues[':ttl']).toBeGreaterThan(0);
  });

  test('DELETE /admin/admins refuses to remove a bootstrap admin', async () => {
    const handler = loadHandler();
    const res = await handler(makeEvent('DELETE', '/admin/admins/dev-test-user@example.com', { email: 'dev-test-user@example.com' }, undefined, DEV_TOKEN));
    expect(res.statusCode).toBe(400);
    expect(commandNames()).not.toContain('DeleteCommand');
  });

  test('POST /admin/admins adds an admin row', async () => {
    mockSend.mockResolvedValue({});
    const handler = loadHandler();
    const res = await handler(makeEvent('POST', '/admin/admins', {}, { email: 'New.Admin@Example.com' }, DEV_TOKEN));
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body as string).email).toBe('new.admin@example.com');
    const putCall = mockSend.mock.calls.find(c => c[0]?.constructor?.name === 'PutCommand');
    expect(putCall[0].input.Item.email).toBe('new.admin@example.com');
    expect(putCall[0].input.Item.addedBy).toBe('dev-test-user@example.com');
  });
});

describe('admin endpoints — table-registered admin (non-bootstrap) is allowed', () => {
  beforeEach(() => {
    process.env.DEV_BYPASS_TOKEN = DEV_TOKEN;
    process.env.STAGE = 'stg';
    process.env.BOOTSTRAP_ADMIN_EMAILS = '';
    process.env.CORS_ALLOWED_ORIGINS = 'http://localhost:8601';
    mockSend.mockReset();
  });

  test('GET /admin/admins works when caller has an Admins row', async () => {
    mockSend.mockImplementation(async (cmd: { constructor: { name: string } }) => {
      if (cmd.constructor.name === 'GetCommand') return { Item: { email: 'dev-test-user@example.com' } };
      if (cmd.constructor.name === 'ScanCommand') return { Items: [{ email: 'dev-test-user@example.com', addedAt: 't' }] };
      return {};
    });
    const handler = loadHandler();
    const res = await handler(makeEvent('GET', '/admin/admins', {}, undefined, DEV_TOKEN));
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body as string).admins.length).toBeGreaterThanOrEqual(1);
  });
});

describe('reporter hide/unhide (PATCH /bug-reports/{id})', () => {
  beforeEach(() => {
    process.env.DEV_BYPASS_TOKEN = DEV_TOKEN;
    process.env.STAGE = 'stg';
    process.env.BOOTSTRAP_ADMIN_EMAILS = '';
    process.env.CORS_ALLOWED_ORIGINS = 'http://localhost:8601';
    mockSend.mockReset();
  });

  test('owner can hide their own report (200, writes hiddenByOwner=true)', async () => {
    mockSend.mockImplementation(async (cmd: { constructor: { name: string } }) => {
      if (cmd.constructor.name === 'UpdateCommand') return {};
      return { Item: { reportId: 'r1', ownerSub: 'dev-test-user', status: 'open' } }; // GetCommand
    });
    const handler = loadHandler();
    const res = await handler(makeEvent('PATCH', '/bug-reports/r1', { reportId: 'r1' }, { hidden: true }, DEV_TOKEN));
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body as string).hiddenByOwner).toBe(true);
    const upd = mockSend.mock.calls.find(c => c[0]?.constructor?.name === 'UpdateCommand');
    expect(upd[0].input.UpdateExpression).toContain('hiddenByOwner = :h');
    expect(upd[0].input.ExpressionAttributeValues[':h']).toBe(true);
  });

  test('owner can unhide (hidden=false)', async () => {
    mockSend.mockImplementation(async (cmd: { constructor: { name: string } }) => {
      if (cmd.constructor.name === 'UpdateCommand') return {};
      return { Item: { reportId: 'r1', ownerSub: 'dev-test-user' } };
    });
    const handler = loadHandler();
    const res = await handler(makeEvent('PATCH', '/bug-reports/r1', { reportId: 'r1' }, { hidden: false }, DEV_TOKEN));
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body as string).hiddenByOwner).toBe(false);
  });

  test('hiding someone else\'s report is 404 and performs no write (IDOR)', async () => {
    mockSend.mockResolvedValue({ Item: { reportId: 'r1', ownerSub: 'another-user' } });
    const handler = loadHandler();
    const res = await handler(makeEvent('PATCH', '/bug-reports/r1', { reportId: 'r1' }, { hidden: true }, DEV_TOKEN));
    expect(res.statusCode).toBe(404);
    expect(commandNames()).not.toContain('UpdateCommand');
  });

  test('hiding a non-existent report is 404', async () => {
    mockSend.mockResolvedValue({}); // no Item
    const handler = loadHandler();
    const res = await handler(makeEvent('PATCH', '/bug-reports/missing', { reportId: 'missing' }, { hidden: true }, DEV_TOKEN));
    expect(res.statusCode).toBe(404);
  });

  test('non-boolean hidden is rejected (400) before any read/write', async () => {
    const handler = loadHandler();
    const res = await handler(makeEvent('PATCH', '/bug-reports/r1', { reportId: 'r1' }, { hidden: 'yes' }, DEV_TOKEN));
    expect(res.statusCode).toBe(400);
    expect(commandNames()).not.toContain('UpdateCommand');
  });

  test('unauthenticated PATCH is 401', async () => {
    const handler = loadHandler();
    const res = await handler(makeEvent('PATCH', '/bug-reports/r1', { reportId: 'r1' }, { hidden: true }));
    expect(res.statusCode).toBe(401);
    expect(mockSend).not.toHaveBeenCalled();
  });

  test('GET /bug-reports omits reports hidden by the owner', async () => {
    mockSend.mockResolvedValue({
      Items: [
        { reportId: 'visible', ownerSub: 'dev-test-user', description: 'a', status: 'open', createdAt: 't2' },
        { reportId: 'hidden', ownerSub: 'dev-test-user', description: 'b', status: 'open', createdAt: 't1', hiddenByOwner: true },
      ],
    });
    const handler = loadHandler();
    const res = await handler(makeEvent('GET', '/bug-reports', {}, undefined, DEV_TOKEN));
    expect(res.statusCode).toBe(200);
    const ids = JSON.parse(res.body as string).reports.map((r: { reportId: string }) => r.reportId);
    expect(ids).toEqual(['visible']);
  });
});
