// このファイルをモジュールにするための宣言。import/export を持たない .ts は TypeScript の
// グローバルスクリプト扱いになり、トップレベルの const がテストファイル間で衝突する（#1144）。
export {};

/**
 * 先生側 API と Admin 推薦 (#1110) の境界のテスト。
 *
 * - 一覧/詳細の投影は boolean の recommended だけ（recommendedBy は内部情報）
 * - 先生の PATCH からは recommendedAt/recommendedBy を書けない（whitelist）
 * - 限定公開 → 全体公開の PATCH で明示的な null（クリア）が既存値に
 *   巻き戻らない（レビュー指摘の回帰テスト）
 */

// モジュール化。トップレベル宣言をファイルスコープに閉じる（他のテストファイルと
// 同名の mockSend / DEV_TOKEN / makeEvent があり、スクリプト扱いだと TS2451 で衝突する）。
export {};

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

const makeEvent = (
  method: string,
  path: string,
  pathParameters: Record<string, string>,
  body?: unknown,
  query?: Record<string, string>,
) => ({
  requestContext: { http: { method, path, sourceIp: '127.0.0.1' } },
  headers: { authorization: `Bearer ${DEV_TOKEN}`, origin: 'http://localhost:8601' },
  pathParameters,
  queryStringParameters: query,
  body: body === undefined ? undefined : JSON.stringify(body),
});

const myLimitedItem = (over: Record<string, unknown> = {}) => ({
  sharedId: 's1',
  title: 'ねこあつめ入門',
  summary: '説明',
  content: { pages: [{ text: 'ページ1' }] },
  schoolLevel: 'junior-high',
  grades: [1],
  subject: '技術・家庭（技術分野）',
  tags: ['甲子園'],
  lessonCount: 3,
  supplementUrl: null,
  authorName: 'るびお',
  authorAffiliation: '島根県',
  authorSub: 'dev-test-teacher',
  visibility: 'limited',
  passcode: 'abc234',
  status: 'published',
  reuseCount: 0,
  recommendedAt: '2026-07-21T00:00:00.000Z',
  recommendedBy: 'admin@example.com',
  createdAt: '2026-07-20T00:00:00.000Z',
  updatedAt: '2026-07-20T00:00:00.000Z',
  ...over,
});

describe('先生側 API と Admin 推薦の境界 (#1110)', () => {
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

  test('詳細投影は recommended (boolean) のみ — recommendedBy を出さない', async () => {
    mockSend.mockImplementation(async (command) => {
      if (command.constructor.name === 'GetCommand') return { Item: myLimitedItem() };
      return {};
    });
    const res = await handler(makeEvent('GET', '/shared-assignments/s1', { sharedId: 's1' }));
    expect(res.statusCode).toBe(200);
    const data = JSON.parse(res.body || '{}');
    expect(data.recommended).toBe(true);
    expect(res.body).not.toContain('recommendedBy');
    expect(res.body).not.toContain('admin@example.com');
  });

  test('先生の PATCH は recommendedAt/recommendedBy を無視する (whitelist)', async () => {
    const updates: Array<Record<string, unknown>> = [];
    mockSend.mockImplementation(async (command) => {
      if (command.constructor.name === 'GetCommand') {
        return { Item: myLimitedItem({ recommendedAt: undefined, recommendedBy: undefined }) };
      }
      if (command.constructor.name === 'UpdateCommand') {
        updates.push(command.input);
        return {};
      }
      return {};
    });
    const res = await handler(makeEvent('PATCH', '/shared-assignments/s1', { sharedId: 's1' }, {
      title: '改題',
      recommendedAt: '2026-07-25T00:00:00.000Z',
      recommendedBy: 'attacker@example.com',
    }));
    expect(res.statusCode).toBe(200);
    expect(updates).toHaveLength(1);
    const expr = String(updates[0].UpdateExpression);
    expect(expr).not.toContain('recommended');
    expect(JSON.stringify(updates[0].ExpressionAttributeValues)).not.toContain('attacker');
  });

  test('限定公開→全体公開: 明示的な null クリアが既存値へ巻き戻らない', async () => {
    const updates: Array<Record<string, unknown>> = [];
    mockSend.mockImplementation(async (command) => {
      if (command.constructor.name === 'GetCommand') return { Item: myLimitedItem() };
      if (command.constructor.name === 'UpdateCommand') {
        updates.push(command.input);
        return {};
      }
      return {};
    });
    const res = await handler(makeEvent('PATCH', '/shared-assignments/s1', { sharedId: 's1' }, {
      visibility: 'public',
      licenseConsent: true,
      schoolLevel: 'junior-high',
      subject: '技術・家庭（技術分野）',
      grades: [1],
      tags: ['甲子園'],
      // クリア（発展フォームで空にした想定）
      lessonCount: null,
      authorAffiliation: null,
      authorName: 'るびお',
    }));
    expect(res.statusCode).toBe(200);
    expect(updates).toHaveLength(1);
    const values = updates[0].ExpressionAttributeValues as Record<string, unknown>;
    const names = updates[0].ExpressionAttributeNames as Record<string, string> | undefined;
    const expr = String(updates[0].UpdateExpression);
    // クリアした値が旧値 (3 / 島根県) に戻っていないこと。
    const serialized = JSON.stringify({ expr, values, names });
    expect(serialized).toContain('public');
    const lessonKey = Object.entries(values).find(([, v]) => v === 3);
    expect(lessonKey).toBeUndefined();
    expect(serialized).not.toContain('島根県');
  });

  test('一覧 (mine) 投影にも recommended が載る', async () => {
    mockSend.mockImplementation(async (command) => {
      if (command.constructor.name === 'QueryCommand') return { Items: [myLimitedItem()] };
      return {};
    });
    const res = await handler(makeEvent('GET', '/shared-assignments', {}, undefined, { mine: '1' }));
    expect(res.statusCode).toBe(200);
    const { items } = JSON.parse(res.body || '{}');
    expect(items[0].recommended).toBe(true);
    expect(res.body).not.toContain('recommendedBy');
  });
});
