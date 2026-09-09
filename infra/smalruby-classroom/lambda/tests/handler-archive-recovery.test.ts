// このファイルをモジュールにするための宣言。import/export を持たない .ts は TypeScript の
// グローバルスクリプト扱いになり、トップレベルの const がテストファイル間で衝突する（#1144）。
export {};

/**
 * Archive recoverability tests (issue #1050 / EPIC #1049).
 *
 * These pin the "archive is reversible" contract through the exported
 * `handler` with DynamoDB's docClient.send mocked:
 *
 * - DELETE /classrooms/{id} archives WITHOUT purging memberships (D1), so a
 *   later restore brings back seat numbers / nicknames / sessions intact.
 * - Student access to an archived classroom is blocked by status guards
 *   instead of membership deletion: verify-session → 401, submission → 404.
 * - GET /classrooms?includeArchived=1 opts in to archived items (D2); the
 *   default response stays active-only for deployed-frontend compatibility.
 * - PATCH {status:'active'} restores an archived classroom / group (pins the
 *   already-working update path so it cannot regress into an active-only
 *   guard).
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

// Presigned URL generation needs real credentials; stub it so the submission
// flow can run end-to-end in unit tests.
jest.mock('@aws-sdk/s3-request-presigner', () => ({
    getSignedUrl: jest.fn(async () => 'https://signed.example/upload'),
}));

// The S3 client is only used via getSignedUrl (mocked above) and best-effort
// DeleteObject calls; stub send so no network is touched.
jest.mock('@aws-sdk/client-s3', () => {
    const actual = jest.requireActual('@aws-sdk/client-s3');
    return {
        ...actual,
        S3Client: jest.fn(() => ({ send: jest.fn(async () => ({})) })),
    };
});

const DEV_TOKEN = 'test-dev-bypass';

interface MakeEventOptions {
    body?: unknown;
    token?: string;
    query?: Record<string, string>;
}

const makeEvent = (
    method: string,
    path: string,
    pathParameters: Record<string, string>,
    { body, token, query }: MakeEventOptions = {},
) => ({
    requestContext: { http: { method, path, sourceIp: '127.0.0.1' } },
    headers: {
        ...(token ? { authorization: `Bearer ${token}` } : {}),
        origin: 'http://localhost:8601',
    },
    pathParameters,
    queryStringParameters: query,
    body: body === undefined ? undefined : JSON.stringify(body),
});

const activeClassroom = {
    classroomId: 'c1',
    status: 'active',
    teacherSub: 'dev-test-teacher',
    className: '2年1組',
    assignmentName: 'ねこあつめ',
    joinCode: 'abc234',
    studentCount: 30,
    createdAt: '2026-07-01T00:00:00.000Z',
    ttl: 1790000000,
};

const archivedClassroom = { ...activeClassroom, status: 'archived' };

const membership = {
    classroomId: 'c1',
    memberId: 'seat-01',
    sessionToken: 'session-token-1',
    displayName: 'たろう',
};

describe('archive recoverability (issue #1050)', () => {
    let handler: (event: unknown) => Promise<{ statusCode?: number; body?: string }>;

    beforeEach(() => {
        jest.resetModules();
        process.env.DEV_BYPASS_TOKEN = DEV_TOKEN;
        process.env.STAGE = 'stg';
        mockSend.mockReset();
        handler = require('../handler').handler;
    });

    const commandNames = () => mockSend.mock.calls.map((c) => c[0]?.constructor?.name);

    describe('DELETE /classrooms/{id} — archive keeps memberships (D1)', () => {
        test('archives the classroom without querying or batch-deleting members', async () => {
            mockSend.mockImplementation(async (command: { constructor: { name: string } }) => {
                if (command.constructor.name === 'GetCommand') return { Item: activeClassroom };
                return {};
            });

            const res = await handler(
                makeEvent('DELETE', '/classrooms/c1', { classroomId: 'c1' }, { token: DEV_TOKEN }),
            );

            expect(res.statusCode).toBe(204);
            expect(commandNames()).toContain('UpdateCommand');
            // The old implementation purged memberships (Query + BatchWrite).
            // Keeping them is what makes a restore lossless.
            expect(commandNames()).not.toContain('QueryCommand');
            expect(commandNames()).not.toContain('BatchWriteCommand');
        });
    });

    describe('student access to an archived classroom is blocked by status', () => {
        const sendForStudentFlow = (classroom: Record<string, unknown>) =>
            async (command: { constructor: { name: string }; input?: { IndexName?: string } }) => {
                const name = command.constructor.name;
                if (name === 'QueryCommand' && command.input?.IndexName === 'sessionToken-index') {
                    return { Items: [membership] };
                }
                if (name === 'QueryCommand' && command.input?.IndexName === 'classroomId-memberId-index') {
                    return { Items: [] };
                }
                if (name === 'GetCommand') return { Item: classroom };
                return {};
            };

        test('verify-session on an archived classroom → 401 without extending the session TTL', async () => {
            mockSend.mockImplementation(sendForStudentFlow(archivedClassroom));

            const res = await handler(
                makeEvent('POST', '/classrooms/verify-session', {}, { token: 'session-token-1' }),
            );

            expect(res.statusCode).toBe(401);
            expect(commandNames()).not.toContain('UpdateCommand');
        });

        test('verify-session on an active classroom stays valid (positive control)', async () => {
            mockSend.mockImplementation(sendForStudentFlow(activeClassroom));

            const res = await handler(
                makeEvent('POST', '/classrooms/verify-session', {}, { token: 'session-token-1' }),
            );

            expect(res.statusCode).toBe(200);
            expect(JSON.parse(res.body as string).valid).toBe(true);
            expect(commandNames()).toContain('UpdateCommand');
        });

        test('creating a submission on an archived classroom → 404 without any write', async () => {
            mockSend.mockImplementation(sendForStudentFlow(archivedClassroom));

            const res = await handler(
                makeEvent('POST', '/classrooms/c1/submissions', { classroomId: 'c1' }, {
                    token: 'session-token-1',
                    body: { projectName: 'さくひん', screenshotCount: 0 },
                }),
            );

            expect(res.statusCode).toBe(404);
            expect(JSON.parse(res.body as string).error).toContain('no longer active');
            expect(commandNames()).not.toContain('PutCommand');
        });

        test('creating a submission on an active classroom succeeds (positive control)', async () => {
            mockSend.mockImplementation(sendForStudentFlow(activeClassroom));

            const res = await handler(
                makeEvent('POST', '/classrooms/c1/submissions', { classroomId: 'c1' }, {
                    token: 'session-token-1',
                    body: { projectName: 'さくひん', screenshotCount: 0 },
                }),
            );

            expect(res.statusCode).toBe(201);
            expect(commandNames()).toContain('PutCommand');
        });
    });

    describe('GET /classrooms — includeArchived opt-in (D2)', () => {
        const listMocks = () => {
            mockSend.mockImplementation(async (command: { constructor: { name: string } }) => {
                const name = command.constructor.name;
                if (name === 'QueryCommand') {
                    return { Items: [activeClassroom, { ...archivedClassroom, classroomId: 'c2' }] };
                }
                if (name === 'ScanCommand') return { Items: [] };
                return {};
            });
        };

        test('default response contains only active classrooms (backward compatible)', async () => {
            listMocks();

            const res = await handler(makeEvent('GET', '/classrooms', {}, { token: DEV_TOKEN }));

            expect(res.statusCode).toBe(200);
            const { classrooms } = JSON.parse(res.body as string);
            expect(classrooms).toHaveLength(1);
            expect(classrooms[0].classroomId).toBe('c1');
            expect(classrooms[0].status).toBe('active');
        });

        test('includeArchived=1 also returns archived classrooms with status and expiresAt', async () => {
            listMocks();

            const res = await handler(
                makeEvent('GET', '/classrooms', {}, { token: DEV_TOKEN, query: { includeArchived: '1' } }),
            );

            expect(res.statusCode).toBe(200);
            const { classrooms } = JSON.parse(res.body as string);
            expect(classrooms).toHaveLength(2);
            const archived = classrooms.find((c: { classroomId: string }) => c.classroomId === 'c2');
            expect(archived.status).toBe('archived');
            expect(archived.expiresAt).toBe(new Date(1790000000 * 1000).toISOString());
        });
    });

    describe('restore (archived → active) keeps working', () => {
        test('PATCH /classrooms/{id} restores an archived classroom', async () => {
            mockSend.mockImplementation(async (command: { constructor: { name: string } }) => {
                if (command.constructor.name === 'GetCommand') return { Item: archivedClassroom };
                if (command.constructor.name === 'UpdateCommand') {
                    return { Attributes: { ...archivedClassroom, status: 'active' } };
                }
                return {};
            });

            const res = await handler(
                makeEvent('PATCH', '/classrooms/c1', { classroomId: 'c1' }, {
                    token: DEV_TOKEN,
                    body: { status: 'active' },
                }),
            );

            expect(res.statusCode).toBe(200);
            expect(JSON.parse(res.body as string).status).toBe('active');
        });

        test('PATCH /classroom-groups/{id} restores an archived group', async () => {
            const archivedGroup = {
                groupId: 'g1',
                teacherSub: 'dev-test-teacher',
                name: '2年1組',
                status: 'archived',
                schemaVersion: 2,
            };
            mockSend.mockImplementation(async (command: { constructor: { name: string } }) => {
                if (command.constructor.name === 'GetCommand') return { Item: archivedGroup };
                if (command.constructor.name === 'UpdateCommand') {
                    return { Attributes: { ...archivedGroup, status: 'active' } };
                }
                return {};
            });

            const res = await handler(
                makeEvent('PATCH', '/classroom-groups/g1', { groupId: 'g1' }, {
                    token: DEV_TOKEN,
                    body: { status: 'active' },
                }),
            );

            expect(res.statusCode).toBe(200);
            expect(JSON.parse(res.body as string).status).toBe('active');
        });
    });

    describe('join/lookup guards stay in place (regression pins)', () => {
        test('lookup of an archived classroom → 404 "no longer active"', async () => {
            mockSend.mockImplementation(async (command: { constructor: { name: string } }) => {
                if (command.constructor.name === 'QueryCommand') return { Items: [archivedClassroom] };
                return {};
            });

            const res = await handler(
                makeEvent('POST', '/classrooms/lookup', {}, { body: { joinCode: 'abc234' } }),
            );

            expect(res.statusCode).toBe(404);
            expect(JSON.parse(res.body as string).error).toContain('no longer active');
        });
    });
});

