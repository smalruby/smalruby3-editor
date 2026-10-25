// このファイルをモジュールにするための宣言。import/export を持たない .ts は TypeScript の
// グローバルスクリプト扱いになり、トップレベルの const がテストファイル間で衝突する（#1144）。
export {};

/**
 * verify-session の lastActiveAt 更新テスト (issue #1197).
 *
 * verifySessionToken は結果整合の GSI（sessionToken-index）を読むので、自主退出（行の削除）や
 * kick の直後に verify-session が届くことがある。lastActiveAt の更新が無条件だと、中身の無い行を
 * 作り直して席を塞いだり、kick の tombstone の短い TTL を延ばしたりする。更新は
 * 「行がまだこのセッションのもので、kick されていない」ことを条件にする。
 */

const mockSend = jest.fn();
jest.mock('@aws-sdk/lib-dynamodb', () => {
    const actual = jest.requireActual('@aws-sdk/lib-dynamodb');
    return {
        ...actual,
        DynamoDBDocumentClient: { from: () => ({ send: mockSend }) },
    };
});

const makeEvent = (token?: string) => ({
    requestContext: { http: { method: 'POST', path: '/classrooms/verify-session', sourceIp: '127.0.0.1' } },
    headers: {
        ...(token ? { authorization: `Bearer ${token}` } : {}),
        origin: 'http://localhost:8601',
    },
    pathParameters: {},
    body: undefined,
});

const activeClassroom = { classroomId: 'c1', status: 'active', className: '2年1組' };
const archivedClassroom = { classroomId: 'c1', status: 'archived' };

const membership = {
    classroomId: 'c1',
    memberId: 'seat-01',
    sessionToken: 'session-token-1',
};

type Command = { constructor: { name: string }; input?: Record<string, unknown> };

const sendFor = (classroom: Record<string, unknown> | undefined, member: Record<string, unknown> | null = membership) =>
    async (command: Command) => {
        const name = command.constructor.name;
        if (name === 'QueryCommand' && command.input?.IndexName === 'sessionToken-index') {
            return { Items: member ? [member] : [] };
        }
        if (name === 'QueryCommand') return { Items: [] };
        if (name === 'GetCommand') return { Item: classroom };
        return {};
    };

describe('POST /classrooms/verify-session — lastActiveAt update (issue #1197)', () => {
    let handler: (event: unknown) => Promise<{ statusCode?: number; body?: string }>;

    beforeEach(() => {
        jest.resetModules();
        process.env.STAGE = 'stg';
        mockSend.mockReset();
        handler = require('../handler').handler;
    });

    const commands = () => mockSend.mock.calls.map((c) => c[0] as Command);
    const commandNames = () => commands().map((c) => c.constructor.name);
    const updateInput = () => {
        const update = commands().find((c) => c.constructor.name === 'UpdateCommand');
        expect(update).toBeDefined();
        return update!.input as {
            Key: Record<string, string>;
            UpdateExpression: string;
            ConditionExpression?: string;
            ExpressionAttributeValues: Record<string, unknown>;
        };
    };

    test('updates lastActiveAt and extends the TTL', async () => {
        mockSend.mockImplementation(sendFor(activeClassroom));
        const before = Date.now();

        const res = await handler(makeEvent('session-token-1'));

        expect(res.statusCode).toBe(200);
        const input = updateInput();
        expect(input.Key).toEqual({ classroomId: 'c1', memberId: 'seat-01' });
        expect(input.UpdateExpression).toContain('lastActiveAt');
        const now = new Date(input.ExpressionAttributeValues[':now'] as string).getTime();
        expect(now).toBeGreaterThanOrEqual(before - 1000);
        expect(input.ExpressionAttributeValues[':ttl']).toBeGreaterThan(Math.floor(before / 1000));
    });

    test('the update is conditional on the row still belonging to this session and not kicked', async () => {
        mockSend.mockImplementation(sendFor(activeClassroom));
        await handler(makeEvent('session-token-1'));
        const input = updateInput();
        expect(input.ConditionExpression).toContain('sessionToken = :st');
        expect(input.ConditionExpression).toContain('kicked');
        expect(input.ExpressionAttributeValues[':st']).toBe('session-token-1');
    });

    test('row deleted / kicked after the GSI read (condition fails) → 401, no ghost row', async () => {
        const base = sendFor(activeClassroom);
        mockSend.mockImplementation(async (command: Command) => {
            if (command.constructor.name === 'UpdateCommand') {
                const err = new Error('The conditional request failed');
                err.name = 'ConditionalCheckFailedException';
                throw err;
            }
            return base(command);
        });
        const res = await handler(makeEvent('session-token-1'));
        expect(res.statusCode).toBe(401);
    });

    test('kicked student → 410 reason=kicked without an update', async () => {
        mockSend.mockImplementation(sendFor(activeClassroom, {
            ...membership,
            kicked: true,
            kickJoinCode: 'abc234',
            kickClassName: '2年1組',
            kickSeatNumber: 1,
        }));
        const res = await handler(makeEvent('session-token-1'));
        expect(res.statusCode).toBe(410);
        expect(JSON.parse(res.body as string).reason).toBe('kicked');
        expect(commandNames()).not.toContain('UpdateCommand');
    });

    test('archived classroom → 401 without refreshing the membership', async () => {
        mockSend.mockImplementation(sendFor(archivedClassroom));
        const res = await handler(makeEvent('session-token-1'));
        expect(res.statusCode).toBe(401);
        expect(commandNames()).not.toContain('UpdateCommand');
    });
});
