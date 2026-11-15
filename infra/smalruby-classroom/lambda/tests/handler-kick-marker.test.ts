// このファイルをモジュールにするための宣言（#1144）。
export {};

/**
 * 退室させた事実を、席の行とは別に残す（issue #1821）。
 *
 * 会員の行のキーは席（`seat-NN`）なので、退室依頼を承認したあと依頼した生徒がすぐ
 * その席に参加すると、退室させた生徒の墓標の行を上書きしていた。そのため、退室させた
 * 生徒の verify-session が 410（退室させられた）ではなく 401 になり、バナーが出なかった。
 *
 * 守る性質:
 *
 * 1. 承認 → 依頼した生徒が同じ席に参加 → 退室させた生徒の verify-session は 410。
 * 2. 席が使われなくても、退室させた生徒の verify-session は 410（従来どおり）。
 * 3. 退室させた生徒がもう一度参加すると、新しいセッションはふつうに使える。
 * 4. 印の行は席の一覧（lookup の takenSeats）に出ない。
 * 5. 印を書けなくても、退室そのものは成功する（付随的な書き込み）。
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

type Row = Record<string, any>;

const FUTURE = () => Math.floor(Date.now() / 1000) + 3600;

const classroom: Row = {
  classroomId: 'c1',
  status: 'active',
  teacherSub: 'dev-test-teacher',
  className: '2年1組',
  assignmentName: '第3回',
  joinCode: 'abc234',
  studentCount: 30,
  ttl: FUTURE(),
};

const conditionFailed = () => Object.assign(new Error('The conditional request failed'), {
  name: 'ConditionalCheckFailedException',
});

/** 会員の表（PK classroomId / SK memberId + GSI sessionToken-index）と退室依頼の表を手元で持つ。 */
const useTables = (opts: { failMarkerPut?: boolean } = {}) => {
  const members = new Map<string, Row>();
  const kickRequests: Row[] = [];
  const keyOf = (k: Row) => `${k.classroomId}|${k.memberId}`;

  mockSend.mockImplementation((cmd: { constructor: { name: string }; input: Record<string, any> }) => {
    const name = cmd.constructor.name;
    const input = cmd.input;
    const values = input.ExpressionAttributeValues || {};

    if (input.TableName === 'Classrooms') {
      if (name === 'GetCommand') {
        return Promise.resolve({ Item: input.Key.classroomId === classroom.classroomId ? classroom : undefined });
      }
      if (name === 'QueryCommand' && input.IndexName === 'joinCode-index') {
        return Promise.resolve({ Items: values[':jc'] === classroom.joinCode ? [classroom] : [] });
      }
      return Promise.resolve({ Items: [] });
    }

    if (input.TableName === 'ClassroomMemberships') {
      if (name === 'PutCommand') {
        const existing = members.get(keyOf(input.Item));
        if (input.ConditionExpression) {
          // join: 'attribute_not_exists(memberId) OR kicked = :kicked'
          if (existing && existing.kicked !== true) return Promise.reject(conditionFailed());
        } else if (opts.failMarkerPut && String(input.Item.classroomId).startsWith('kicked#')) {
          return Promise.reject(new Error('ProvisionedThroughputExceededException'));
        }
        members.set(keyOf(input.Item), { ...input.Item });
        return Promise.resolve({});
      }
      if (name === 'UpdateCommand') {
        const existing = members.get(keyOf(input.Key));
        if (String(input.UpdateExpression).includes('kicked = :true')) {
          // kick: 'attribute_exists(memberId)'
          if (!existing) return Promise.reject(conditionFailed());
          Object.assign(existing, {
            kicked: true,
            kickedAt: values[':now'],
            kickJoinCode: values[':jc'],
            kickClassName: values[':cn'],
            kickSeatNumber: values[':sn'],
            ttl: values[':ttl'],
          });
          return Promise.resolve({ Attributes: { ...existing } });
        }
        // activity touch: 'sessionToken = :st AND (attribute_not_exists(kicked) OR kicked <> :true)'
        if (!existing || existing.sessionToken !== values[':st'] || existing.kicked === true) {
          return Promise.reject(conditionFailed());
        }
        Object.assign(existing, { lastActiveAt: values[':now'], ttl: values[':ttl'] });
        return Promise.resolve({ Attributes: { ...existing } });
      }
      if (name === 'GetCommand') {
        return Promise.resolve({ Item: members.get(keyOf(input.Key)) });
      }
      if (name === 'QueryCommand') {
        if (input.IndexName === 'sessionToken-index') {
          return Promise.resolve({
            Items: [...members.values()].filter((m) => m.sessionToken === values[':st']).slice(0, 1),
          });
        }
        let rows = [...members.values()].filter((m) => m.classroomId === values[':cid']);
        if (String(input.FilterExpression || '').includes('kicked')) {
          rows = rows.filter((m) => m.kicked !== true);
        }
        return Promise.resolve({ Items: rows });
      }
    }

    if (input.TableName === 'ClassroomKickRequests') {
      if (name === 'PutCommand') {
        kickRequests.push({ ...input.Item });
        return Promise.resolve({});
      }
      if (name === 'GetCommand') {
        return Promise.resolve({
          Item: kickRequests.find((r) => r.classroomId === input.Key.classroomId && r.requestId === input.Key.requestId),
        });
      }
      if (name === 'QueryCommand') {
        return Promise.resolve({
          Items: kickRequests.filter((r) => r.classroomId === values[':cid']
            && (values[':sn'] === undefined || r.seatNumber === values[':sn'])),
        });
      }
      if (name === 'BatchWriteCommand') {
        for (const req of input.RequestItems.ClassroomKickRequests) {
          const i = kickRequests.findIndex((r) => r.requestId === req.DeleteRequest.Key.requestId);
          if (i >= 0) kickRequests.splice(i, 1);
        }
        return Promise.resolve({});
      }
    }

    if (name === 'QueryCommand') return Promise.resolve({ Items: [] });
    return Promise.resolve({});
  });
  return { members };
};

let handler: (event: unknown) => Promise<{ statusCode?: number; body?: string }>;

beforeEach(() => {
  jest.resetModules();
  process.env.DEV_BYPASS_TOKEN = DEV_TOKEN;
  process.env.STAGE = 'stg';
  mockSend.mockReset();
  handler = require('../handler').handler;
});

let ipCounter = 0;
const call = async (
  method: string, path: string,
  opts: { body?: Row; token?: string; pathParameters?: Row } = {},
) => {
  ipCounter += 1;
  const res = await handler({
    requestContext: { http: { method, path, sourceIp: `10.0.2.${ipCounter % 250}` } },
    headers: {
      origin: 'http://localhost:8601',
      ...(opts.token ? { authorization: `Bearer ${opts.token}` } : {}),
    },
    pathParameters: opts.pathParameters || {},
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  return { status: res.statusCode, body: JSON.parse(res.body || '{}') };
};

const join = async (seatNumber: number, nickname: string) => {
  const res = await call('POST', '/classrooms/join', { body: { joinCode: 'abc234', seatNumber, nickname } });
  expect(res.status).toBe(200);
  return res.body.sessionToken as string;
};

const verify = (sessionToken: string) => call('POST', '/classrooms/verify-session', { token: sessionToken });

const requestKick = async (seatNumber: number) => {
  const res = await call('POST', '/classrooms/lookup/kick-request', {
    body: { joinCode: 'abc234', seatNumber, reason: '自分の番号です' },
  });
  expect(res.status).toBe(201);
  return res.body.requestId as string;
};

const approve = (requestId: string) => call('POST', `/classrooms/c1/kick-requests/${requestId}/approve`, {
  token: DEV_TOKEN,
  pathParameters: { classroomId: 'c1', requestId },
});

const kick = (memberId: string) => call('DELETE', `/classrooms/c1/members/${memberId}`, {
  token: DEV_TOKEN,
  pathParameters: { classroomId: 'c1', memberId },
});

const expectKicked = (res: { status?: number; body: Row }, seatNumber: number) => {
  expect(res.status).toBe(410);
  expect(res.body).toMatchObject({ reason: 'kicked', joinCode: 'abc234', className: '2年1組', seatNumber });
};

describe('退室させた事実を席の行とは別に残す (issue #1821)', () => {
  test('承認 → 依頼した生徒が同じ席に参加しても、退室させた生徒の verify-session は 410', async () => {
    useTables();
    const kickedToken = await join(3, 'たろう');
    const requestId = await requestKick(3);

    expect((await approve(requestId)).status).toBe(204);
    const requesterToken = await join(3, 'はなこ');

    expectKicked(await verify(kickedToken), 3);
    // 依頼した生徒のセッションはふつうに使える
    const requester = await verify(requesterToken);
    expect(requester.status).toBe(200);
    expect(requester.body.valid).toBe(true);
  });

  test('先生が直接退室させたあと別の生徒が同じ席に参加しても 410', async () => {
    useTables();
    const kickedToken = await join(5, 'たろう');
    expect((await kick('seat-05')).status).toBe(204);
    await join(5, 'はなこ');

    expectKicked(await verify(kickedToken), 5);
  });

  test('席が使われないままでも、退室させた生徒の verify-session は 410（従来どおり）', async () => {
    useTables();
    const kickedToken = await join(4, 'たろう');
    expect((await kick('seat-04')).status).toBe(204);

    expectKicked(await verify(kickedToken), 4);
  });

  test('退室させた生徒がもう一度参加すると、新しいセッションはふつうに使える', async () => {
    useTables();
    const kickedToken = await join(3, 'たろう');
    expect((await kick('seat-03')).status).toBe(204);

    const rejoinToken = await join(3, 'たろう');
    const res = await verify(rejoinToken);
    expect(res.status).toBe(200);
    expect(res.body.valid).toBe(true);
    // 古いセッションは退室のまま
    expectKicked(await verify(kickedToken), 3);
  });

  test('印の行は別の区画に置き、席の一覧（lookup の takenSeats）に出ない', async () => {
    const { members } = useTables();
    await join(3, 'たろう');
    expect((await kick('seat-03')).status).toBe(204);

    const marker = [...members.values()].find((m) => String(m.classroomId).startsWith('kicked#'));
    expect(marker).toMatchObject({ classroomId: 'kicked#c1', kicked: true, kickSeatNumber: 3 });
    expect(marker!.memberId).toMatch(/^seat-03#[0-9a-f]{16}$/);

    const lookup = await call('POST', '/classrooms/lookup', { body: { joinCode: 'abc234' } });
    expect(lookup.status).toBe(200);
    expect(lookup.body.takenSeats).toEqual([]);
  });

  test('印を書けなくても退室そのものは成功する', async () => {
    useTables({ failMarkerPut: true });
    const errSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const kickedToken = await join(3, 'たろう');
    expect((await kick('seat-03')).status).toBe(204);
    // 席が使われていない間は墓標の行で 410
    expectKicked(await verify(kickedToken), 3);
    errSpy.mockRestore();
  });
});
