// このファイルをモジュールにするための宣言。import/export を持たない .ts は TypeScript の
// グローバルスクリプト扱いになり、トップレベルの const がテストファイル間で衝突する（#1144）。
export {};

/**
 * お知らせ (notification center) tests — EPIC #1111.
 *
 * Exercises the teacher-facing inbox (list + mark-read) through the full
 * request path (router → auth → handlers) with DynamoDB mocked. Items are
 * written by the admin stack, so there is no create path here.
 */

const mockSend = jest.fn();
jest.mock('@aws-sdk/lib-dynamodb', () => {
  const actual = jest.requireActual('@aws-sdk/lib-dynamodb');
  return {
    ...actual,
    DynamoDBDocumentClient: { from: () => ({ send: mockSend }) },
  };
});

const mockS3Send = jest.fn();
jest.mock('@aws-sdk/client-s3', () => {
  const actual = jest.requireActual('@aws-sdk/client-s3');
  return {
    ...actual,
    S3Client: jest.fn(() => ({ send: mockS3Send })),
  };
});

jest.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: jest.fn(async () => 'https://signed.example/get'),
}));

const DEV_TOKEN = 'test-dev-bypass';

interface MakeEventOptions {
  body?: unknown;
  token?: string;
}

const makeEvent = (
  method: string,
  path: string,
  { body, token }: MakeEventOptions = {},
) => ({
  requestContext: { http: { method, path, sourceIp: '127.0.0.1' } },
  headers: {
    ...(token ? { authorization: `Bearer ${token}` } : {}),
    origin: 'http://localhost:8601',
  },
  pathParameters: {},
  queryStringParameters: undefined,
  body: body === undefined ? undefined : JSON.stringify(body),
});

const notice = (id: string, extra: Record<string, unknown> = {}) => ({
  teacherSub: 'dev-test-teacher',
  notificationId: id,
  type: 'admin_message',
  title: 'お知らせタイトル',
  body: 'お知らせ本文',
  link: { kind: 'classroom', classroomId: 'c1' },
  createdBy: 'admin@example.com',
  createdAt: id.slice(0, 24),
  ...extra,
});

describe('お知らせセンター (EPIC #1111)', () => {
  let handler: (event: unknown) => Promise<{ statusCode?: number; body?: string }>;

  beforeEach(() => {
    jest.resetModules();
    process.env.DEV_BYPASS_TOKEN = DEV_TOKEN;
    process.env.STAGE = 'stg';
    mockSend.mockReset();
    mockS3Send.mockReset();
    const mod = require('../handler');
    handler = mod.handler;
  });

  describe('GET /notifications', () => {
    test('401 without a token', async () => {
      const res = await handler(makeEvent('GET', '/notifications'));
      expect(res.statusCode).toBe(401);
    });

    test('returns the caller-scoped inbox with unreadCount', async () => {
      mockSend.mockImplementation(async (command) => {
        expect(command.constructor.name).toBe('QueryCommand');
        expect(command.input.ExpressionAttributeValues[':sub']).toBe('dev-test-teacher');
        expect(command.input.ScanIndexForward).toBe(false);
        return {
          Items: [
            notice('2026-07-25T01:00:00.000Z#b'),
            notice('2026-07-24T01:00:00.000Z#a', { readAt: '2026-07-24T02:00:00.000Z' }),
          ],
        };
      });
      const res = await handler(makeEvent('GET', '/notifications', { token: DEV_TOKEN }));
      expect(res.statusCode).toBe(200);
      const data = JSON.parse(res.body || '{}');
      expect(data.unreadCount).toBe(1);
      expect(data.notifications).toHaveLength(2);
      expect(data.notifications[0]).toEqual({
        notificationId: '2026-07-25T01:00:00.000Z#b',
        type: 'admin_message',
        title: 'お知らせタイトル',
        body: 'お知らせ本文',
        link: { kind: 'classroom', classroomId: 'c1' },
        readAt: null,
        createdAt: '2026-07-25T01:00:00.000Z',
      });
      // Internal fields never leak to the editor.
      expect(res.body).not.toContain('createdBy');
      expect(res.body).not.toContain('teacherSub');
    });

    test('empty inbox returns zero unread', async () => {
      mockSend.mockResolvedValue({ Items: [] });
      const res = await handler(makeEvent('GET', '/notifications', { token: DEV_TOKEN }));
      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.body || '{}')).toEqual({ notifications: [], unreadCount: 0 });
    });
  });

  describe('POST /notifications/mark-read', () => {
    test('401 without a token', async () => {
      const res = await handler(makeEvent('POST', '/notifications/mark-read', { body: {} }));
      expect(res.statusCode).toBe(401);
    });

    test('marks the given ids read, keyed to the caller', async () => {
      const updates: Array<Record<string, unknown>> = [];
      mockSend.mockImplementation(async (command) => {
        if (command.constructor.name === 'UpdateCommand') {
          updates.push(command.input);
          return {};
        }
        return {};
      });
      const res = await handler(makeEvent('POST', '/notifications/mark-read', {
        token: DEV_TOKEN,
        body: { notificationIds: ['n1', 'n2'] },
      }));
      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.body || '{}')).toEqual({ updated: 2 });
      expect(updates).toHaveLength(2);
      expect(updates[0].Key).toEqual({ teacherSub: 'dev-test-teacher', notificationId: 'n1' });
      // Never create phantom rows; never overwrite an earlier readAt.
      expect(updates[0].ConditionExpression).toContain('attribute_exists');
      expect(updates[0].UpdateExpression).toContain('if_not_exists(readAt');
    });

    test('without ids marks everything currently unread', async () => {
      const updates: Array<Record<string, unknown>> = [];
      mockSend.mockImplementation(async (command) => {
        if (command.constructor.name === 'QueryCommand') {
          return {
            Items: [
              notice('n3'),
              notice('n2', { readAt: '2026-07-24T02:00:00.000Z' }),
              notice('n1'),
            ],
          };
        }
        updates.push(command.input);
        return {};
      });
      const res = await handler(makeEvent('POST', '/notifications/mark-read', {
        token: DEV_TOKEN,
        body: {},
      }));
      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.body || '{}')).toEqual({ updated: 2 });
      expect(updates.map(u => (u.Key as Record<string, unknown>).notificationId)).toEqual(['n3', 'n1']);
    });

    test('ids that vanished (TTL race) are skipped, not errors', async () => {
      mockSend.mockImplementation(async (command) => {
        if (command.constructor.name === 'UpdateCommand') {
          const err = new Error('conditional failed') as Error & { name: string };
          err.name = 'ConditionalCheckFailedException';
          throw err;
        }
        return {};
      });
      const res = await handler(makeEvent('POST', '/notifications/mark-read', {
        token: DEV_TOKEN,
        body: { notificationIds: ['gone'] },
      }));
      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.body || '{}')).toEqual({ updated: 0 });
    });

    test('400 on malformed notificationIds', async () => {
      const bads = [
        'x',
        [1, 2],
        Array.from({ length: 51 }, (_, i) => `n${i}`),
        ['x'.repeat(201)], // overlong id → 400, not a DynamoDB 500
      ];
      for (const bad of bads) {
        const res = await handler(makeEvent('POST', '/notifications/mark-read', {
          token: DEV_TOKEN,
          body: { notificationIds: bad },
        }));
        expect(res.statusCode).toBe(400);
      }
    });

    test('400 when the whole body is a JSON array (would silently mark all)', async () => {
      const res = await handler(makeEvent('POST', '/notifications/mark-read', {
        token: DEV_TOKEN,
        body: ['n1', 'n2'],
      }));
      expect(res.statusCode).toBe(400);
      expect(mockSend).not.toHaveBeenCalled();
    });
  });
});
