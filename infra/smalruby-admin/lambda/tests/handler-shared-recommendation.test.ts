/**
 * Admin 推薦 API tests — EPIC #1110.
 *
 * Recommending a shared assignment marks it (recommendedAt/recommendedBy)
 * and notifies the author through the notification center (#1111).
 * Withdrawal removes the mark silently. Both are idempotent.
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

const makeEvent = (method: string, path: string, sharedId: string) => ({
  requestContext: { http: { method, path, sourceIp: '127.0.0.1' } },
  headers: { authorization: `Bearer ${DEV_TOKEN}`, origin: 'https://smalruby.app' },
  pathParameters: { sharedId },
});

const limitedItem = (over: Record<string, unknown> = {}) => ({
  sharedId: 's1',
  title: 'ねこあつめ入門',
  authorSub: 'teacher-sub-9',
  visibility: 'limited',
  passcode: 'abc234',
  status: 'published',
  reuseCount: 0,
  createdAt: '2026-07-20T00:00:00.000Z',
  updatedAt: '2026-07-20T00:00:00.000Z',
  ...over,
});

describe('POST/DELETE /admin/shared-assignments/{id}/recommend (EPIC #1110)', () => {
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
   * Route DynamoDB commands for the recommend flow.
   * @param shared - the SharedAssignments item (null = missing)
   * @returns collected {updates, puts} command inputs
   */
  const wireMocks = (shared: Record<string, unknown> | null) => {
    const updates: Array<Record<string, unknown>> = [];
    const puts: Array<Record<string, unknown>> = [];
    mockSend.mockImplementation(async (command: {
      constructor: { name: string }; input?: Record<string, unknown>;
    }) => {
      const name = command.constructor.name;
      const table = command.input?.TableName as string | undefined;
      if (name === 'GetCommand' && table?.startsWith('SmalrubyAdmins')) {
        return { Item: { email: 'dev-admin@example.com', sub: 'dev-admin' } };
      }
      if (name === 'GetCommand' && table?.startsWith('SharedAssignments')) {
        return { Item: shared };
      }
      if (name === 'UpdateCommand') {
        updates.push(command.input as Record<string, unknown>);
        return {};
      }
      if (name === 'PutCommand') {
        puts.push(command.input as Record<string, unknown>);
        return {};
      }
      return {};
    });
    return { updates, puts };
  };

  test('recommend marks the item and notifies the author (#1111 inbox)', async () => {
    const { updates, puts } = wireMocks(limitedItem());
    const commandOrder: string[] = [];
    const prevImpl = mockSend.getMockImplementation()!;
    mockSend.mockImplementation(async (command: {
      constructor: { name: string }; input?: Record<string, unknown>;
    }) => {
      commandOrder.push(command.constructor.name);
      return prevImpl(command);
    });
    const res = await handler(makeEvent('POST', '/admin/shared-assignments/s1/recommend', 's1'));
    expect(res.statusCode).toBe(200);

    expect(updates).toHaveLength(1);
    expect(updates[0].UpdateExpression).toContain('SET recommendedAt');
    // 冪等判定は原子的（同時 POST の二重通知防止）。
    expect(updates[0].ConditionExpression).toContain('attribute_not_exists(recommendedAt)');
    // 通知が主目的なので Put（通知）→ Update（印付け）の順。逆だと印付け後の
    // 通知失敗をリトライで回復できない。
    expect(commandOrder.indexOf('PutCommand')).toBeLessThan(commandOrder.indexOf('UpdateCommand'));

    expect(puts).toHaveLength(1);
    const notice = puts[0].Item as Record<string, unknown>;
    expect(notice.teacherSub).toBe('teacher-sub-9');
    expect(notice.type).toBe('shared_recommended');
    expect(String(notice.body)).toContain('ねこあつめ入門');
    expect(notice.link).toEqual({ kind: 'shared-mine', sharedId: 's1' });

    const body = JSON.parse(res.body as string);
    expect(body.recommended).toBe(true);
    expect(body.recommendedBy).toBe('dev-admin@example.com');
    // passcode never crosses to the SPA even for operators.
    expect(res.body).not.toContain('abc234');
    expect(res.body).not.toContain('authorSub');
  });

  test('recommending an already-recommended item is a no-op (no re-notify)', async () => {
    const { updates, puts } = wireMocks(limitedItem({
      recommendedAt: '2026-07-21T00:00:00.000Z', recommendedBy: 'dev-admin@example.com',
    }));
    const res = await handler(makeEvent('POST', '/admin/shared-assignments/s1/recommend', 's1'));
    expect(res.statusCode).toBe(200);
    expect(updates).toHaveLength(0);
    expect(puts).toHaveLength(0);
    expect(JSON.parse(res.body as string).recommended).toBe(true);
  });

  test('withdrawal removes the mark without notifying', async () => {
    const { updates, puts } = wireMocks(limitedItem({
      recommendedAt: '2026-07-21T00:00:00.000Z', recommendedBy: 'dev-admin@example.com',
    }));
    const res = await handler(makeEvent('DELETE', '/admin/shared-assignments/s1/recommend', 's1'));
    expect(res.statusCode).toBe(200);
    expect(updates).toHaveLength(1);
    expect(updates[0].UpdateExpression).toContain('REMOVE recommendedAt, recommendedBy');
    expect(puts).toHaveLength(0);
    expect(JSON.parse(res.body as string).recommended).toBe(false);
  });

  test('400 when recommending a public item (発展の働きかけ先ではない)', async () => {
    const { updates, puts } = wireMocks(limitedItem({ visibility: 'public', passcode: undefined }));
    const res = await handler(makeEvent('POST', '/admin/shared-assignments/s1/recommend', 's1'));
    expect(res.statusCode).toBe(400);
    expect(updates).toHaveLength(0);
    expect(puts).toHaveLength(0);
  });

  test('withdrawal still works after the item became public (推薦は残っている)', async () => {
    const { updates } = wireMocks(limitedItem({
      visibility: 'public',
      passcode: undefined,
      recommendedAt: '2026-07-21T00:00:00.000Z',
      recommendedBy: 'dev-admin@example.com',
    }));
    const res = await handler(makeEvent('DELETE', '/admin/shared-assignments/s1/recommend', 's1'));
    expect(res.statusCode).toBe(200);
    expect(updates).toHaveLength(1);
  });

  test('404 for missing or unlisted items (author withdrew it)', async () => {
    for (const item of [null, limitedItem({ status: 'unlisted' })]) {
      wireMocks(item);
      const res = await handler(makeEvent('POST', '/admin/shared-assignments/s1/recommend', 's1'));
      expect(res.statusCode).toBe(404);
    }
  });

  test('visibility filter narrows the admin list (#1110 候補の母集団)', async () => {
    mockSend.mockImplementation(async (command: {
      constructor: { name: string }; input?: Record<string, unknown>;
    }) => {
      const name = command.constructor.name;
      const table = command.input?.TableName as string | undefined;
      if (name === 'GetCommand' && table?.startsWith('SmalrubyAdmins')) {
        return { Item: { email: 'dev-admin@example.com', sub: 'dev-admin' } };
      }
      if (name === 'ScanCommand') {
        return {
          Items: [
            limitedItem(),
            limitedItem({ sharedId: 's2', visibility: 'public', passcode: undefined }),
            limitedItem({ sharedId: 's3' }), // visibility 'limited'
          ],
        };
      }
      return {};
    });
    const res = await handler({
      requestContext: { http: { method: 'GET', path: '/admin/shared-assignments', sourceIp: '127.0.0.1' } },
      headers: { authorization: `Bearer ${DEV_TOKEN}`, origin: 'https://smalruby.app' },
      queryStringParameters: { visibility: 'limited' },
    });
    expect(res.statusCode).toBe(200);
    const { items } = JSON.parse(res.body as string);
    expect(items.map((i: { sharedId: string }) => i.sharedId).sort()).toEqual(['s1', 's3']);
    expect(items.every((i: { visibility: string }) => i.visibility === 'limited')).toBe(true);
  });
});
