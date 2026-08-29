// このファイルをモジュールにするための宣言。import/export を持たない .ts は TypeScript の
// グローバルスクリプト扱いになり、トップレベルの const がテストファイル間で衝突する（#1144）。
export {};

/**
 * 共有推奨 API tests — EPIC #1106.
 *
 * Flagging an assignment as "worth sharing to みんなの課題" notifies the
 * owning teacher (#1111) so they can share it themselves (CC BY consent
 * stays with the author — admins never publish on a teacher's behalf).
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

const makeEvent = (method: string, path: string, classroomId: string) => ({
  requestContext: { http: { method, path, sourceIp: '127.0.0.1' } },
  headers: { authorization: `Bearer ${DEV_TOKEN}`, origin: 'https://smalruby.app' },
  pathParameters: { classroomId },
});

const classroomItem = (over: Record<string, unknown> = {}) => ({
  classroomId: 'c1',
  className: '2年1組',
  assignmentName: 'ねこ迷路ゲーム',
  teacherSub: 'teacher-sub-9',
  joinCode: 'abc234',
  studentCount: 30,
  assignment: { pages: [{ text: 'ページ1' }], starterKey: 'c1/assignment/starter.sb3' },
  status: 'active',
  createdAt: '2026-07-10T00:00:00.000Z',
  ...over,
});

describe('POST/DELETE /admin/classrooms/{id}/recommend-sharing (EPIC #1106)', () => {
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

  const wireMocks = (classroom: Record<string, unknown> | null) => {
    const updates: Array<Record<string, unknown>> = [];
    const puts: Array<Record<string, unknown>> = [];
    const order: string[] = [];
    mockSend.mockImplementation(async (command: {
      constructor: { name: string }; input?: Record<string, unknown>;
    }) => {
      const name = command.constructor.name;
      order.push(name);
      const table = command.input?.TableName as string | undefined;
      if (name === 'GetCommand' && table?.startsWith('SmalrubyAdmins')) {
        return { Item: { email: 'dev-admin@example.com', sub: 'dev-admin' } };
      }
      if (name === 'GetCommand' && table?.startsWith('Classrooms')) {
        return { Item: classroom };
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
    return { updates, puts, order };
  };

  test('flags the assignment and notifies the owning teacher (通知→印付けの順)', async () => {
    const { updates, puts, order } = wireMocks(classroomItem());
    const res = await handler(makeEvent('POST', '/admin/classrooms/c1/recommend-sharing', 'c1'));
    expect(res.statusCode).toBe(200);

    expect(puts).toHaveLength(1);
    const notice = puts[0].Item as Record<string, unknown>;
    expect(notice.teacherSub).toBe('teacher-sub-9');
    expect(notice.type).toBe('share_suggestion');
    expect(String(notice.title)).toContain('共有しませんか');
    expect(String(notice.body)).toContain('ねこ迷路ゲーム');
    expect(notice.link).toEqual({ kind: 'classroom', classroomId: 'c1' });

    expect(updates).toHaveLength(1);
    expect(updates[0].UpdateExpression).toContain('SET recommendedForSharingAt');
    expect(updates[0].ConditionExpression).toContain('attribute_not_exists(recommendedForSharingAt)');
    expect(order.indexOf('PutCommand')).toBeLessThan(order.indexOf('UpdateCommand'));

    const body = JSON.parse(res.body as string);
    expect(body.recommendedForSharing).toBe(true);
    // teacherSub never crosses to the SPA.
    expect(res.body).not.toContain('teacher-sub-9');
  });

  test('already-flagged is a no-op (no re-notify)', async () => {
    const { updates, puts } = wireMocks(classroomItem({
      recommendedForSharingAt: '2026-07-20T00:00:00.000Z',
      recommendedForSharingBy: 'dev-admin@example.com',
    }));
    const res = await handler(makeEvent('POST', '/admin/classrooms/c1/recommend-sharing', 'c1'));
    expect(res.statusCode).toBe(200);
    expect(updates).toHaveLength(0);
    expect(puts).toHaveLength(0);
  });

  test('withdrawal removes the flag silently', async () => {
    const { updates, puts } = wireMocks(classroomItem({
      recommendedForSharingAt: '2026-07-20T00:00:00.000Z',
      recommendedForSharingBy: 'dev-admin@example.com',
    }));
    const res = await handler(makeEvent('DELETE', '/admin/classrooms/c1/recommend-sharing', 'c1'));
    expect(res.statusCode).toBe(200);
    expect(updates).toHaveLength(1);
    expect(updates[0].UpdateExpression).toContain('REMOVE recommendedForSharingAt, recommendedForSharingBy');
    expect(puts).toHaveLength(0);
    expect(JSON.parse(res.body as string).recommendedForSharing).toBe(false);
  });

  test('400 when the assignment has no content (共有の行き止まり防止)', async () => {
    const { updates, puts } = wireMocks(classroomItem({ assignment: undefined }));
    const res = await handler(makeEvent('POST', '/admin/classrooms/c1/recommend-sharing', 'c1'));
    expect(res.statusCode).toBe(400);
    expect(updates).toHaveLength(0);
    expect(puts).toHaveLength(0);
  });

  test('withdrawal works even after the classroom was archived (復元時の古いバナー防止)', async () => {
    const { updates, puts } = wireMocks(classroomItem({
      status: 'archived',
      recommendedForSharingAt: '2026-07-20T00:00:00.000Z',
      recommendedForSharingBy: 'dev-admin@example.com',
    }));
    const res = await handler(makeEvent('DELETE', '/admin/classrooms/c1/recommend-sharing', 'c1'));
    expect(res.statusCode).toBe(200);
    expect(updates).toHaveLength(1);
    expect(puts).toHaveLength(0);
  });

  test('404 for missing / archived / quota-row classrooms', async () => {
    for (const [item, id] of [
      [null, 'missing'],
      [classroomItem({ status: 'archived' }), 'c1'],
      [classroomItem({ classroomId: 'eval-quota#t#2026' }), 'eval-quota#t#2026'],
    ] as const) {
      wireMocks(item as Record<string, unknown> | null);
      const res = await handler(makeEvent(
        'POST', `/admin/classrooms/${id}/recommend-sharing`, String(id),
      ));
      expect(res.statusCode).toBe(404);
    }
  });
});
