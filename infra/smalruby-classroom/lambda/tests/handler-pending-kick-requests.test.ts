// このファイルをモジュールにするための宣言（#1144）。
export {};

/**
 * `GET /kick-requests/pending` (issue #1200).
 *
 * 先生がログイン中に 10 秒ごとに呼ぶ「未処理の退室依頼」まとめ取得。
 * 守る性質:
 *
 * 1. 見える課題は `GET /classrooms` と同じ — 他の先生の課題の依頼は返さない。
 * 2. 依頼テーブルは課題ごとのキー Query だけで引く（Scan しない）。
 * 3. トーストに要る情報（課題名・席番号・ひと言・いまの席のニックネーム）を返す。
 * 4. `since` 以降・TTL 切れでないものだけを返す。
 */

const mockSend = jest.fn();
jest.mock('@aws-sdk/lib-dynamodb', () => {
  const actual = jest.requireActual('@aws-sdk/lib-dynamodb');
  return {
    ...actual,
    DynamoDBDocumentClient: { from: () => ({ send: mockSend }) },
  };
});

const DEV_TOKEN = 'test-dev-bypass';
const SELF_SUB = 'dev-test-teacher';

type Row = Record<string, any>;

const makeEvent = (query?: Record<string, string>, token: string | null = DEV_TOKEN) => ({
  requestContext: { http: { method: 'GET', path: '/kick-requests/pending', sourceIp: '127.0.0.1' } },
  headers: {
    ...(token ? { authorization: `Bearer ${token}` } : {}),
    origin: 'http://localhost:8601',
  },
  pathParameters: {},
  queryStringParameters: query,
});

const future = () => Math.floor(Date.now() / 1000) + 3600;

const useTables = (assignments: Row[], kickRequests: Row[], members: Row[]) => {
  mockSend.mockImplementation((cmd: { constructor: { name: string }; input: Record<string, any> }) => {
    const name = cmd.constructor.name;
    const input = cmd.input;
    const values = input.ExpressionAttributeValues || {};
    if (name === 'GetCommand') {
      if (input.TableName === 'ClassroomMemberships') {
        return Promise.resolve({
          Item: members.find((m) => m.classroomId === input.Key.classroomId && m.memberId === input.Key.memberId),
        });
      }
      return Promise.resolve({});
    }
    if (name !== 'QueryCommand') return Promise.resolve({ Items: [] });
    if (input.TableName === 'Classrooms' && input.IndexName === 'teacherSub-index') {
      return Promise.resolve({ Items: assignments.filter((a) => a.teacherSub === values[':ts']) });
    }
    if (input.TableName === 'ClassroomKickRequests') {
      return Promise.resolve({ Items: kickRequests.filter((r) => r.classroomId === values[':cid']) });
    }
    return Promise.resolve({ Items: [] });
  });
};

describe('GET /kick-requests/pending (issue #1200)', () => {
  let handler: (event: unknown) => Promise<{ statusCode?: number; body?: string }>;

  beforeEach(() => {
    jest.resetModules();
    process.env.DEV_BYPASS_TOKEN = DEV_TOKEN;
    process.env.STAGE = 'stg';
    mockSend.mockReset();
    handler = require('../handler').handler;
  });

  const own = { classroomId: 'c-own', teacherSub: SELF_SUB, className: '1組', assignmentName: '迷路', status: 'active' };
  const foreign = { classroomId: 'c-foreign', teacherSub: 'other-teacher', className: '2組', status: 'active' };

  const request = (classroomId: string, requestId: string, over: Row = {}) => ({
    classroomId,
    requestId,
    seatNumber: 3,
    reason: '番号をまちがえた',
    createdAt: '2026-10-25T10:00:00.000Z',
    ttl: future(),
    ...over,
  });

  test('自分の課題の依頼を、トーストに要る情報つきで返す', async () => {
    useTables([own, foreign], [request('c-own', 'r1')], [
      { classroomId: 'c-own', memberId: 'seat-03', displayName: 'たろう' },
    ]);
    const res = await handler(makeEvent());
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body || '{}');
    expect(body.activeAssignmentCount).toBe(1);
    expect(body.requests).toEqual([{
      requestId: 'r1',
      classroomId: 'c-own',
      className: '1組',
      assignmentName: '迷路',
      groupId: null,
      seatNumber: 3,
      reason: '番号をまちがえた',
      occupantName: 'たろう',
      createdAt: '2026-10-25T10:00:00.000Z',
    }]);
  });

  test('他の先生の課題の依頼は見えず、その課題の依頼テーブルも引かない', async () => {
    useTables([own, foreign], [request('c-foreign', 'r-foreign')], []);
    const res = await handler(makeEvent());
    expect(JSON.parse(res.body || '{}').requests).toEqual([]);
    const kickQueries = mockSend.mock.calls
      .map((c) => c[0])
      .filter((c) => c.input.TableName === 'ClassroomKickRequests');
    expect(kickQueries.map((q) => q.input.ExpressionAttributeValues[':cid'])).toEqual(['c-own']);
    const scans = mockSend.mock.calls.filter((c) => c[0].constructor.name === 'ScanCommand');
    expect(scans).toHaveLength(0);
  });

  test('アーカイブ済みの課題は対象外', async () => {
    useTables([{ ...own, status: 'archived' }], [request('c-own', 'r1')], []);
    const body = JSON.parse((await handler(makeEvent())).body || '{}');
    expect(body.requests).toEqual([]);
    expect(body.activeAssignmentCount).toBe(0);
  });

  test('since 以降・TTL 切れでないものだけ。空席ならニックネームは null', async () => {
    useTables([own], [
      request('c-own', 'old', { createdAt: '2026-10-25T09:00:00.000Z' }),
      request('c-own', 'expired', { createdAt: '2026-10-25T11:00:00.000Z', ttl: 1 }),
      request('c-own', 'new', { createdAt: '2026-10-25T11:00:00.000Z' }),
    ], [{ classroomId: 'c-own', memberId: 'seat-03', displayName: 'x', kicked: true }]);
    const res = await handler(makeEvent({ since: '2026-10-25T10:00:00.000Z' }));
    const requests = JSON.parse(res.body || '{}').requests;
    expect(requests.map((r: Row) => r.requestId)).toEqual(['new']);
    expect(requests[0].occupantName).toBeNull();
  });

  test('since はタイムゾーン付きでも UTC に揃えて比べる', async () => {
    useTables([own], [
      request('c-own', 'before', { createdAt: '2026-10-25T00:59:00.000Z' }),
      request('c-own', 'after', { createdAt: '2026-10-25T01:01:00.000Z' }),
    ], []);
    // 10:00+09:00 = 01:00Z。文字列のまま比べると両方とも "2026-10-25T10" より前になってしまう。
    const res = await handler(makeEvent({ since: '2026-10-25T10:00:00+09:00' }));
    const requests = JSON.parse(res.body || '{}').requests;
    expect(requests.map((r: Row) => r.requestId)).toEqual(['after']);
  });

  test('since が日時でなければ 400', async () => {
    useTables([own], [], []);
    const res = await handler(makeEvent({ since: 'not-a-date' }));
    expect(res.statusCode).toBe(400);
  });

  test('未ログインは 401', async () => {
    useTables([own], [], []);
    const res = await handler(makeEvent(undefined, null));
    expect(res.statusCode).toBe(401);
  });
});
