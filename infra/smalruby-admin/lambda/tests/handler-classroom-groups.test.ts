/**
 * クラス（学級）検索・アーカイブ解除 API tests — EPIC #1129 C (#1133).
 *
 * これまで `ClassroomGroups.status` を `active` に戻せるのは先生用 UI だけで、
 * 先生がその画面に到達できない問い合わせに運用者が対応できなかった。ここでは
 * 「同名クラスを区別できる材料が一覧に載ること」「アーカイブ解除が TTL を
 * 実行時点から数え直すこと」「中の課題の status を巻き添えにしないこと」を
 * 固定する（いずれも壊れると運用事故になる不変条件）。
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

const makeEvent = (
  method: string, path: string,
  extra: { groupId?: string; query?: Record<string, string>; body?: unknown } = {},
) => ({
  requestContext: { http: { method, path, sourceIp: '127.0.0.1' } },
  headers: { authorization: `Bearer ${DEV_TOKEN}`, origin: 'https://smalruby.app' },
  ...(extra.groupId ? { pathParameters: { groupId: extra.groupId } } : {}),
  ...(extra.query ? { queryStringParameters: extra.query } : {}),
  ...(extra.body === undefined ? {} : { body: JSON.stringify(extra.body) }),
});

// 同名クラスが実際に並ぶ（Google Classroom 連携での二重作成）。区別に必要な
// 年度・人数・作成日時・中の課題名を意図的に散らしてある。
const groupRows = () => [
  {
    groupId: 'g-old',
    name: '5年1組',
    year: 2025,
    status: 'archived',
    studentCount: 30,
    topics: ['ゲーム'],
    createdAt: '2025-04-01T00:00:00.000Z',
    updatedAt: '2025-08-01T00:00:00.000Z',
    ttl: 1800000000,
  },
  {
    groupId: 'g-new',
    name: '5年1組',
    year: 2026,
    status: 'active',
    studentCount: 28,
    createdAt: '2026-04-01T00:00:00.000Z',
  },
  {
    groupId: 'g-other',
    name: '6年2組',
    year: 2026,
    status: 'active',
    createdAt: '2026-04-02T00:00:00.000Z',
  },
];

const classroomRows = () => [
  {
    classroomId: 'c1', groupId: 'g-old', className: '5年1組', assignmentName: 'ねこ迷路',
    joinCode: 'abc234', status: 'active', createdAt: '2025-05-01T00:00:00.000Z',
  },
  {
    classroomId: 'c2', groupId: 'g-old', className: '5年1組', assignmentName: 'たいこ',
    joinCode: 'bcd345', status: 'archived', createdAt: '2025-06-01T00:00:00.000Z',
  },
  {
    classroomId: 'c3', groupId: 'g-new', className: '5年1組', assignmentName: 'しりとり',
    joinCode: 'cde456', status: 'active', createdAt: '2026-05-01T00:00:00.000Z',
  },
  // Quota counter rows share the key space and must never surface.
  { classroomId: 'teacher-1-quota#2026', groupId: 'g-new' },
];

describe('クラス（学級）の検索・詳細・アーカイブ解除 (#1133)', () => {
  let handler: (event: unknown) => Promise<{ statusCode?: number; body?: string }>;

  beforeEach(() => {
    jest.resetModules();
    process.env.DEV_BYPASS_TOKEN = DEV_TOKEN;
    process.env.STAGE = 'stg';
    process.env.ADMIN_GOOGLE_CLIENT_ID = 'admin-client-id';
    process.env.CORS_ALLOWED_ORIGINS = 'https://smalruby.app,http://localhost:8602';
    mockSend.mockReset();
    mockVerifyIdToken.mockReset();
    handler = require('../handler').handler;
  });

  const wireMocks = (over: {
    groups?: Record<string, unknown>[];
    classrooms?: Record<string, unknown>[];
    group?: Record<string, unknown> | null;
  } = {}) => {
    const updates: Array<Record<string, unknown>> = [];
    mockSend.mockImplementation(async (command: {
      constructor: { name: string }; input?: Record<string, unknown>;
    }) => {
      const name = command.constructor.name;
      const table = command.input?.TableName as string | undefined;
      if (name === 'GetCommand' && table?.startsWith('SmalrubyAdmins')) {
        return { Item: { email: 'dev-admin@example.com', sub: 'dev-admin' } };
      }
      if (name === 'GetCommand' && table?.startsWith('ClassroomGroups')) {
        return { Item: over.group === undefined ? groupRows()[0] : over.group };
      }
      if (name === 'ScanCommand' && table?.startsWith('ClassroomGroups')) {
        return { Items: over.groups || groupRows() };
      }
      if (name === 'ScanCommand' && table?.startsWith('Classrooms')) {
        return { Items: over.classrooms || classroomRows() };
      }
      if (name === 'UpdateCommand') {
        updates.push(command.input as Record<string, unknown>);
        return { Attributes: { ...(over.group || groupRows()[0]), status: 'active' } };
      }
      return {};
    });
    return { updates };
  };

  describe('GET /admin/classroom-groups', () => {
    test('同名クラスを年度・人数・中の課題名・作成日時で区別できる', async () => {
      wireMocks();
      const res = await handler(makeEvent('GET', '/admin/classroom-groups', { query: { q: '5年1組' } }));
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body as string);
      expect(body.items.map((i: { groupId: string }) => i.groupId)).toEqual(['g-new', 'g-old']);

      const old = body.items.find((i: { groupId: string }) => i.groupId === 'g-old');
      expect(old).toMatchObject({
        name: '5年1組',
        year: 2025,
        studentCount: 30,
        status: 'archived',
        createdAt: '2025-04-01T00:00:00.000Z',
        assignmentCount: 2,
      });
      // 新しい課題から順に（運用者が直近の授業から見当を付けられるように）。
      expect(old.assignmentNames).toEqual(['たいこ', 'ねこ迷路']);
      expect(old.expiresAt).toBe(new Date(1800000000 * 1000).toISOString());

      const fresh = body.items.find((i: { groupId: string }) => i.groupId === 'g-new');
      // Quota rows share the classrooms key space — never counted as assignments.
      expect(fresh.assignmentCount).toBe(1);
      expect(fresh.assignmentNames).toEqual(['しりとり']);
      expect(fresh.expiresAt).toBeNull();
    });

    test('中の課題名でもクラスを引ける（運用者は課題名しか知らないことがある）', async () => {
      wireMocks();
      const res = await handler(makeEvent('GET', '/admin/classroom-groups', { query: { q: 'たいこ' } }));
      const body = JSON.parse(res.body as string);
      expect(body.items.map((i: { groupId: string }) => i.groupId)).toEqual(['g-old']);
    });

    test('status で絞り込める（アーカイブ済みだけ見たい）', async () => {
      wireMocks();
      const res = await handler(makeEvent('GET', '/admin/classroom-groups', { query: { status: 'archived' } }));
      const body = JSON.parse(res.body as string);
      expect(body.items.map((i: { groupId: string }) => i.groupId)).toEqual(['g-old']);
    });

    test('q 無しは全件（新しい順）', async () => {
      wireMocks();
      const res = await handler(makeEvent('GET', '/admin/classroom-groups'));
      const body = JSON.parse(res.body as string);
      expect(body.items.map((i: { groupId: string }) => i.groupId)).toEqual(['g-other', 'g-new', 'g-old']);
    });
  });

  describe('GET /admin/classroom-groups/{groupId}', () => {
    test('クラスの詳細と中の課題一覧を返す', async () => {
      wireMocks({ group: groupRows()[0] });
      const res = await handler(makeEvent('GET', '/admin/classroom-groups/g-old', { groupId: 'g-old' }));
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body as string);
      expect(body).toMatchObject({ groupId: 'g-old', name: '5年1組', status: 'archived', year: 2025 });
      expect(body.assignments).toEqual([
        expect.objectContaining({ classroomId: 'c2', assignmentName: 'たいこ', status: 'archived' }),
        expect.objectContaining({ classroomId: 'c1', assignmentName: 'ねこ迷路', status: 'active' }),
      ]);
      expect(body.assignmentCount).toBe(2);
    });

    test('存在しないクラスは 404', async () => {
      wireMocks({ group: null });
      const res = await handler(makeEvent('GET', '/admin/classroom-groups/nope', { groupId: 'nope' }));
      expect(res.statusCode).toBe(404);
    });
  });

  describe('PATCH /admin/classroom-groups/{groupId}', () => {
    test('アーカイブ解除は TTL を実行時点から数え直し restoredAt を刻む', async () => {
      const { updates } = wireMocks({ group: groupRows()[0] });
      const before = Math.floor(Date.now() / 1000);
      const res = await handler(makeEvent('PATCH', '/admin/classroom-groups/g-old', {
        groupId: 'g-old', body: { status: 'active' },
      }));
      expect(res.statusCode).toBe(200);
      expect(updates).toHaveLength(1);
      const values = updates[0].ExpressionAttributeValues as Record<string, unknown>;
      const written = Object.entries(updates[0].ExpressionAttributeNames as Record<string, string>)
        .reduce((acc: Record<string, unknown>, [placeholder, attr]) => {
          const valueKey = (updates[0].UpdateExpression as string)
            .match(new RegExp(`${placeholder} = (:\\w+)`))?.[1] as string;
          acc[attr] = values[valueKey];
          return acc;
        }, {});
      expect(written.status).toBe('active');
      expect(typeof written.restoredAt).toBe('string');
      // 過去の TTL のまま書くと即再削除される（docs/classroom/operations.md）。
      expect(written.ttl as number).toBeGreaterThanOrEqual(before + 399 * 24 * 60 * 60);
      // 中の課題は巻き添えにしない: 書き込みは ClassroomGroups の 1 回だけ。
      expect(updates[0].TableName).toMatch(/^ClassroomGroups/);
    });

    test('アーカイブ（利用中 → アーカイブ）は TTL を延長しない', async () => {
      const { updates } = wireMocks({ group: { ...groupRows()[1], status: 'active' } });
      const res = await handler(makeEvent('PATCH', '/admin/classroom-groups/g-new', {
        groupId: 'g-new', body: { status: 'archived' },
      }));
      expect(res.statusCode).toBe(200);
      expect(JSON.stringify(updates[0].ExpressionAttributeNames)).not.toContain('ttl');
      expect(JSON.stringify(updates[0].ExpressionAttributeNames)).not.toContain('restoredAt');
    });

    test('status が active/archived 以外は 400', async () => {
      const { updates } = wireMocks({ group: groupRows()[0] });
      const res = await handler(makeEvent('PATCH', '/admin/classroom-groups/g-old', {
        groupId: 'g-old', body: { status: 'deleted' },
      }));
      expect(res.statusCode).toBe(400);
      expect(updates).toHaveLength(0);
    });

    test('Get と Update の間に TTL で消えた行は復活させず 404', async () => {
      // UpdateItem は upsert。条件を外すと teacherSub も name も無い抜け殻の行を
      // 400 日の TTL 付きで作ってしまい、先生には見えないまま Admin 一覧に残る。
      const { updates } = wireMocks({ group: groupRows()[0] });
      const inner = mockSend.getMockImplementation() as (cmd: unknown) => Promise<unknown>;
      mockSend.mockImplementation(async (command: { constructor: { name: string } }) => {
        if (command.constructor.name === 'UpdateCommand') {
          const err = new Error('The conditional request failed');
          err.name = 'ConditionalCheckFailedException';
          throw err;
        }
        return inner(command);
      });
      const res = await handler(makeEvent('PATCH', '/admin/classroom-groups/g-old', {
        groupId: 'g-old', body: { status: 'active' },
      }));
      expect(res.statusCode).toBe(404);
      expect(updates).toHaveLength(0);
    });

    test('書き込みは行の存在を条件にする', async () => {
      const { updates } = wireMocks({ group: groupRows()[0] });
      await handler(makeEvent('PATCH', '/admin/classroom-groups/g-old', {
        groupId: 'g-old', body: { status: 'active' },
      }));
      expect(updates[0].ConditionExpression).toBe('attribute_exists(groupId)');
    });

    test('存在しないクラスは 404（書き込まない）', async () => {
      const { updates } = wireMocks({ group: null });
      const res = await handler(makeEvent('PATCH', '/admin/classroom-groups/nope', {
        groupId: 'nope', body: { status: 'active' },
      }));
      expect(res.statusCode).toBe(404);
      expect(updates).toHaveLength(0);
    });
  });

  describe('監査ログ', () => {
    test('クラスの状態変更は audit に残る', async () => {
      wireMocks({ group: groupRows()[0] });
      const logs: unknown[][] = [];
      const spy = jest.spyOn(console, 'log').mockImplementation((...args: unknown[]) => {
        logs.push(args);
      });
      await handler(makeEvent('PATCH', '/admin/classroom-groups/g-old', {
        groupId: 'g-old', body: { status: 'active' },
      }));
      spy.mockRestore();
      const audited = logs.map(a => String(a[0])).filter(line => line.includes('classroomGroup.setStatus'));
      expect(audited).toHaveLength(1);
      expect(audited[0]).toContain('g-old');
      expect(audited[0]).toContain('dev-admin@example.com');
    });
  });

  describe('純関数', () => {
    test('matchesGroupQuery は クラス名・groupId・年度・中の課題名 で当たる', () => {
      const { matchesGroupQuery } = require('../handler');
      const group = { groupId: 'g-1', name: '5年1組', year: 2026, section: 'A' };
      expect(matchesGroupQuery(group, ['ねこ迷路'], '5年')).toBe(true);
      expect(matchesGroupQuery(group, [], 'g-1')).toBe(true);
      expect(matchesGroupQuery(group, [], '2026')).toBe(true);
      expect(matchesGroupQuery(group, ['ねこ迷路'], 'めいろ')).toBe(false);
      expect(matchesGroupQuery(group, ['ねこ迷路'], 'ねこ')).toBe(true);
      expect(matchesGroupQuery(group, [], '6年')).toBe(false);
      // 空クエリは常に一致（一覧のデフォルト）
      expect(matchesGroupQuery(group, [], '')).toBe(true);
    });

    test('buildGroupStatusUpdate は解除時だけ TTL と restoredAt を足す', () => {
      const { buildGroupStatusUpdate } = require('../handler');
      const nowMs = 1_800_000_000_000;
      expect(buildGroupStatusUpdate('archived', nowMs)).toEqual({
        status: 'archived',
        updatedAt: new Date(nowMs).toISOString(),
      });
      expect(buildGroupStatusUpdate('active', nowMs, 400)).toEqual({
        status: 'active',
        updatedAt: new Date(nowMs).toISOString(),
        restoredAt: new Date(nowMs).toISOString(),
        ttl: Math.floor(nowMs / 1000) + 400 * 24 * 60 * 60,
      });
    });
  });
});
