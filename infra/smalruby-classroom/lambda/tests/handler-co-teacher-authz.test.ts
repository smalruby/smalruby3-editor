// このファイルをモジュールにするための宣言。import/export を持たない .ts は TypeScript の
// グローバルスクリプト扱いになり、トップレベルの const がテストファイル間で衝突する（#1144）。
export {};

/**
 * Handler-level authorization tests for the co-teacher endpoints.
 *
 * These exercise the full request path (router → verifyTeacherIdToken →
 * canManageClassroom gate) through the exported `handler`, with DynamoDB's
 * docClient.send mocked. The point is to prove that an *authenticated* teacher
 * who is neither the owner nor a co-teacher of a classroom cannot read or
 * mutate its co-teacher list (cross-tenant isolation) — the one dimension we
 * could not exercise live with a single dev identity.
 *
 * The requester is the dev-bypass identity
 * ({sub: 'dev-test-teacher', email: 'dev-test-teacher@example.com'}), which is
 * a legitimately authenticated teacher but a stranger to the mocked classroom.
 */

// Replace only the DynamoDB document client's send(); keep the real command
// classes so the handler can still build Get/Update/Query/Scan commands.
const mockSend = jest.fn();
jest.mock('@aws-sdk/lib-dynamodb', () => {
    const actual = jest.requireActual('@aws-sdk/lib-dynamodb');
    return {
        ...actual,
        DynamoDBDocumentClient: { from: () => ({ send: mockSend }) },
    };
});

const DEV_TOKEN = 'test-dev-bypass';

const makeEvent = (method: string, path: string, pathParameters: Record<string, string>, body?: unknown, token?: string) => ({
    requestContext: { http: { method, path, sourceIp: '127.0.0.1' } },
    headers: {
        ...(token ? { authorization: `Bearer ${token}` } : {}),
        origin: 'http://localhost:8601',
    },
    pathParameters,
    body: body === undefined ? undefined : JSON.stringify(body),
});

// A classroom owned by someone else, with an unrelated co-teacher. The
// dev-test-teacher is a stranger to it.
const foreignClassroom = {
    classroomId: 'c1',
    status: 'active',
    teacherSub: 'owner-A',
    coTeacherEmails: ['someone-else@example.com'],
};

describe('co-teacher endpoints — cross-tenant authorization', () => {
    let handler: (event: unknown) => Promise<{ statusCode?: number; body?: string }>;

    beforeEach(() => {
        jest.resetModules();
        process.env.DEV_BYPASS_TOKEN = DEV_TOKEN;
        process.env.STAGE = 'stg';
        mockSend.mockReset();
        handler = require('../handler').handler;
    });

    const commandNames = () => mockSend.mock.calls.map((c) => c[0]?.constructor?.name);

    test('POST /co-teachers by a stranger is rejected (401) and performs no write', async () => {
        mockSend.mockResolvedValue({ Item: foreignClassroom }); // GetCommand
        const res = await handler(
            makeEvent('POST', '/classrooms/c1/co-teachers', { classroomId: 'c1' }, { email: 'new@example.com' }, DEV_TOKEN),
        );
        expect(res.statusCode).toBe(401);
        // The gate must run before any mutation: no UpdateCommand was issued.
        expect(commandNames()).not.toContain('UpdateCommand');
    });

    test('GET /co-teachers by a stranger is rejected (401)', async () => {
        mockSend.mockResolvedValue({ Item: foreignClassroom });
        const res = await handler(
            makeEvent('GET', '/classrooms/c1/co-teachers', { classroomId: 'c1' }, undefined, DEV_TOKEN),
        );
        expect(res.statusCode).toBe(401);
    });

    test('DELETE /co-teachers/{email} by a stranger is rejected (401) and performs no write', async () => {
        mockSend.mockResolvedValue({ Item: foreignClassroom });
        const res = await handler(
            makeEvent(
                'DELETE',
                '/classrooms/c1/co-teachers/someone-else@example.com',
                { classroomId: 'c1', email: 'someone-else@example.com' },
                undefined,
                DEV_TOKEN,
            ),
        );
        expect(res.statusCode).toBe(401);
        expect(commandNames()).not.toContain('UpdateCommand');
    });

    test('an unauthenticated request (no token) is rejected (401)', async () => {
        const res = await handler(
            makeEvent('POST', '/classrooms/c1/co-teachers', { classroomId: 'c1' }, { email: 'new@example.com' }),
        );
        expect(res.statusCode).toBe(401);
        expect(mockSend).not.toHaveBeenCalled(); // rejected before touching the DB
    });

    test('the owner CAN add a co-teacher (200, write performed) — positive control', async () => {
        const ownedClassroom = { classroomId: 'c1', status: 'active', teacherSub: 'dev-test-teacher' };
        mockSend.mockImplementation(async (command: { constructor: { name: string } }) => {
            if (command.constructor.name === 'UpdateCommand') return {};
            return { Item: ownedClassroom }; // GetCommand
        });
        const res = await handler(
            makeEvent('POST', '/classrooms/c1/co-teachers', { classroomId: 'c1' }, { email: 'New@Example.com' }, DEV_TOKEN),
        );
        expect(res.statusCode).toBe(200);
        expect(JSON.parse(res.body as string).coTeacherEmails).toEqual(['new@example.com']); // normalized
        expect(commandNames()).toContain('UpdateCommand');
    });

    test('an existing co-teacher (matched by verified email) CAN manage (200)', async () => {
        const coManaged = {
            classroomId: 'c1',
            status: 'active',
            teacherSub: 'owner-A',
            coTeacherEmails: ['dev-test-teacher@example.com'],
        };
        mockSend.mockResolvedValue({ Item: coManaged }); // GetCommand for the GET list
        const res = await handler(
            makeEvent('GET', '/classrooms/c1/co-teachers', { classroomId: 'c1' }, undefined, DEV_TOKEN),
        );
        expect(res.statusCode).toBe(200);
        expect(JSON.parse(res.body as string).coTeacherEmails).toContain('dev-test-teacher@example.com');
    });
});
