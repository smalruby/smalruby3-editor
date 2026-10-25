// このファイルをモジュールにするための宣言。import/export を持たない .ts は TypeScript の
// グローバルスクリプト扱いになり、トップレベルの const がテストファイル間で衝突する（#1144）。
export {};

/**
 * Student heartbeat tests (issue #1197).
 *
 * POST /classrooms/heartbeat keeps a student's `lastActiveAt` fresh while the
 * editor stays open, so the teacher's "seated" indicator reflects who is
 * actually working. It must be cheaper than verify-session (no submissions
 * query) but keep the same guards: unknown token → 401, kicked → 410,
 * archived classroom → 401 without touching the membership row.
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
    requestContext: { http: { method: 'POST', path: '/classrooms/heartbeat', sourceIp: '127.0.0.1' } },
    headers: {
        ...(token ? { authorization: `Bearer ${token}` } : {}),
        origin: 'http://localhost:8601',
    },
    pathParameters: {},
    body: undefined,
});

const activeClassroom = { classroomId: 'c1', status: 'active' };
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
        if (name === 'GetCommand') return { Item: classroom };
        return {};
    };

describe('POST /classrooms/heartbeat (issue #1197)', () => {
    let handler: (event: unknown) => Promise<{ statusCode?: number; body?: string }>;

    beforeEach(() => {
        jest.resetModules();
        process.env.STAGE = 'stg';
        mockSend.mockReset();
        handler = require('../handler').handler;
    });

    const commands = () => mockSend.mock.calls.map((c) => c[0] as Command);
    const commandNames = () => commands().map((c) => c.constructor.name);

    test('updates lastActiveAt and extends the TTL, then answers 204', async () => {
        mockSend.mockImplementation(sendFor(activeClassroom));
        const before = Date.now();

        const res = await handler(makeEvent('session-token-1'));

        expect(res.statusCode).toBe(204);
        const update = commands().find((c) => c.constructor.name === 'UpdateCommand');
        expect(update).toBeDefined();
        const input = update!.input as {
            Key: Record<string, string>;
            UpdateExpression: string;
            ExpressionAttributeValues: Record<string, unknown>;
        };
        expect(input.Key).toEqual({ classroomId: 'c1', memberId: 'seat-01' });
        expect(input.UpdateExpression).toContain('lastActiveAt');
        const now = new Date(input.ExpressionAttributeValues[':now'] as string).getTime();
        expect(now).toBeGreaterThanOrEqual(before - 1000);
        expect(input.ExpressionAttributeValues[':ttl']).toBeGreaterThan(Math.floor(before / 1000));
    });

    test('is lighter than verify-session: no submissions query, status-only classroom read', async () => {
        mockSend.mockImplementation(sendFor(activeClassroom));

        await handler(makeEvent('session-token-1'));

        const queries = commands().filter((c) => c.constructor.name === 'QueryCommand');
        expect(queries).toHaveLength(1);
        expect(queries[0].input?.IndexName).toBe('sessionToken-index');
        const get = commands().find((c) => c.constructor.name === 'GetCommand');
        expect(get?.input?.ProjectionExpression).toBeDefined();
    });

    test('missing Authorization header → 401 without any DynamoDB call', async () => {
        const res = await handler(makeEvent());
        expect(res.statusCode).toBe(401);
        expect(mockSend).not.toHaveBeenCalled();
    });

    test('unknown session token → 401 without an update', async () => {
        mockSend.mockImplementation(sendFor(activeClassroom, null));
        const res = await handler(makeEvent('nope'));
        expect(res.statusCode).toBe(401);
        expect(commandNames()).not.toContain('UpdateCommand');
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

    test('the update is conditional on the row still belonging to this session and not kicked', async () => {
        mockSend.mockImplementation(sendFor(activeClassroom));
        await handler(makeEvent('session-token-1'));
        const update = commands().find((c) => c.constructor.name === 'UpdateCommand');
        const input = update!.input as { ConditionExpression?: string; ExpressionAttributeValues: Record<string, unknown> };
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

    test('deleted classroom → 401 without refreshing the membership', async () => {
        mockSend.mockImplementation(sendFor(undefined));
        const res = await handler(makeEvent('session-token-1'));
        expect(res.statusCode).toBe(401);
        expect(commandNames()).not.toContain('UpdateCommand');
    });
});
