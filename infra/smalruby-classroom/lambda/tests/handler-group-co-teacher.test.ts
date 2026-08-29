/**
 * Class-level (group) co-teacher authorization tests (issue #1138).
 *
 * A co-teacher registered on a class (`ClassroomGroups.coTeacherEmails`) must be
 * able to work inside that class just like its owner: see the assignments in it
 * and create new ones. Before this, the group gate was owner-only, so the
 * co-teacher saw an empty assignment list and got `Group not found` on create.
 *
 * The requester is the dev-bypass identity
 * ({sub: 'dev-test-teacher', email: 'dev-test-teacher@example.com'}); the class
 * stores the same address in a different case, which also pins the email
 * normalization requirement.
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
const OWNER_SUB = 'owner-A';

// The class the dev-test-teacher co-manages. The stored address differs in case
// from the identity's email on purpose.
const coManagedGroup = {
    groupId: 'g1',
    teacherSub: OWNER_SUB,
    name: 'CoderDojo しまね',
    year: 2026,
    status: 'active',
    studentCount: 10,
    topics: [],
    coTeacherEmails: ['Dev-Test-Teacher@Example.com'],
};

// A class the dev-test-teacher has nothing to do with.
const foreignGroup = {
    groupId: 'g2',
    teacherSub: OWNER_SUB,
    name: '他人のクラス',
    year: 2026,
    status: 'active',
    topics: [],
    coTeacherEmails: ['someone-else@example.com'],
};

// An assignment the owner created inside the co-managed class.
const assignmentInGroup = {
    classroomId: 'c1',
    teacherSub: OWNER_SUB,
    className: 'CoderDojo しまね',
    assignmentName: '第1回',
    joinCode: 'abcdef',
    studentCount: 10,
    groupId: 'g1',
    status: 'active',
    createdAt: '2026-08-01T00:00:00.000Z',
};

const groups: Record<string, Record<string, unknown>> = {
    g1: coManagedGroup,
    g2: foreignGroup,
};

const makeEvent = (
    method: string,
    path: string,
    pathParameters: Record<string, string>,
    body?: unknown,
    queryStringParameters?: Record<string, string>,
) => ({
    requestContext: { http: { method, path, sourceIp: '127.0.0.1' } },
    headers: { authorization: `Bearer ${DEV_TOKEN}`, origin: 'http://localhost:8601' },
    pathParameters,
    queryStringParameters,
    body: body === undefined ? undefined : JSON.stringify(body),
});

describe('class-level co-teacher authorization (issue #1138)', () => {
    let handler: (event: unknown) => Promise<{ statusCode?: number; body?: string }>;

    beforeEach(() => {
        jest.resetModules();
        process.env.DEV_BYPASS_TOKEN = DEV_TOKEN;
        process.env.STAGE = 'stg';
        mockSend.mockReset();
        // Default routing: groups by key, everything else empty.
        mockSend.mockImplementation((cmd: { constructor: { name: string }; input: Record<string, any> }) => {
            const name = cmd.constructor.name;
            const input = cmd.input;
            if (name === 'GetCommand') {
                if (input.TableName === 'ClassroomGroups') {
                    return Promise.resolve({ Item: groups[input.Key.groupId] });
                }
                return Promise.resolve({});
            }
            if (name === 'QueryCommand' || name === 'ScanCommand') {
                return Promise.resolve({ Items: [] });
            }
            return Promise.resolve({});
        });
        handler = require('../handler').handler;
    });

    const commands = () => mockSend.mock.calls.map((c) => c[0]);
    const commandNames = () => commands().map((c) => c?.constructor?.name);

    test('a class co-teacher can create an assignment in that class (201)', async () => {
        const res = await handler(
            makeEvent('POST', '/classrooms', {}, {
                className: 'CoderDojo しまね',
                assignmentName: '第2回',
                groupId: 'g1',
            }),
        );
        expect(res.statusCode).toBe(201);
        const put = commands().find((c) => c?.constructor?.name === 'PutCommand');
        expect(put?.input?.Item?.groupId).toBe('g1');
        // The class's studentCount is inherited (v2 behaviour) — proves the
        // group record was actually read, not skipped.
        expect(put?.input?.Item?.studentCount).toBe(10);
    });

    test('a teacher who is neither owner nor co-teacher still gets 404 (existence hiding)', async () => {
        const res = await handler(
            makeEvent('POST', '/classrooms', {}, {
                className: '他人のクラス',
                assignmentName: '第1回',
                groupId: 'g2',
                studentCount: 5,
            }),
        );
        expect(res.statusCode).toBe(404);
        expect(JSON.parse(res.body || '{}').error).toBe('Group not found');
        expect(commandNames()).not.toContain('PutCommand');
    });

    test('GET /classrooms lists assignments that live in a co-managed class', async () => {
        mockSend.mockImplementation((cmd: { constructor: { name: string }; input: Record<string, any> }) => {
            const name = cmd.constructor.name;
            const input = cmd.input;
            if (name === 'ScanCommand' && input.TableName === 'ClassroomGroups') {
                return Promise.resolve({ Items: [coManagedGroup] });
            }
            if (name === 'ScanCommand') {
                return Promise.resolve({ Items: [] });
            }
            if (name === 'QueryCommand' && input.TableName === 'Classrooms') {
                // Owned assignments for the requester: none. The owner's query
                // (issued for the co-managed class) returns the assignment.
                const ts = input.ExpressionAttributeValues?.[':ts'];
                return Promise.resolve({ Items: ts === OWNER_SUB ? [assignmentInGroup] : [] });
            }
            return Promise.resolve({ Items: [] });
        });

        const res = await handler(makeEvent('GET', '/classrooms', {}));
        expect(res.statusCode).toBe(200);
        const { classrooms } = JSON.parse(res.body || '{}');
        expect(classrooms).toHaveLength(1);
        expect(classrooms[0].classroomId).toBe('c1');
        expect(classrooms[0].role).toBe('co-teacher');
    });

    test('a class co-teacher can rename the class (200)', async () => {
        const res = await handler(
            makeEvent('PATCH', '/classroom-groups/g1', { groupId: 'g1' }, { name: '新しい名前' }),
        );
        expect(res.statusCode).toBe(200);
        expect(commandNames()).toContain('UpdateCommand');
    });

    test('a class co-teacher cannot edit the co-teacher list (401, owner only)', async () => {
        const res = await handler(
            makeEvent('PATCH', '/classroom-groups/g1', { groupId: 'g1' }, {
                coTeacherEmails: ['intruder@example.com'],
            }),
        );
        expect(res.statusCode).toBe(401);
        expect(commandNames()).not.toContain('UpdateCommand');
    });

    test('a stranger cannot update a class (404, existence hiding)', async () => {
        const res = await handler(
            makeEvent('PATCH', '/classroom-groups/g2', { groupId: 'g2' }, { name: '乗っ取り' }),
        );
        expect(res.statusCode).toBe(404);
        expect(commandNames()).not.toContain('UpdateCommand');
    });

    test('a class co-teacher can manage the class topic list (200)', async () => {
        const res = await handler(
            makeEvent('PATCH', '/classroom-groups/g1/topics', { groupId: 'g1' }, {
                action: 'add',
                name: 'ゲームづくり',
            }),
        );
        expect(res.statusCode).toBe(200);
    });
});

describe('canManageGroup / canManageClassroom email normalization (issue #1138)', () => {
    let mod: typeof import('../handler');

    beforeEach(() => {
        jest.resetModules();
        mod = require('../handler');
    });

    test('canManageGroup matches a co-teacher regardless of email case', () => {
        expect(mod.canManageGroup(coManagedGroup, { sub: 'x', email: 'dev-test-teacher@example.com' })).toBe(true);
        expect(mod.canManageGroup(coManagedGroup, { sub: 'x', email: 'DEV-TEST-TEACHER@EXAMPLE.COM' })).toBe(true);
    });

    test('canManageGroup accepts the owner and rejects everyone else', () => {
        expect(mod.canManageGroup(coManagedGroup, { sub: OWNER_SUB, email: null })).toBe(true);
        expect(mod.canManageGroup(coManagedGroup, { sub: 'x', email: 'stranger@example.com' })).toBe(false);
        expect(mod.canManageGroup(undefined, { sub: 'x', email: 'dev-test-teacher@example.com' })).toBe(false);
    });

    test('canManageClassroom matches a co-teacher regardless of email case', () => {
        const classroom = { classroomId: 'c9', teacherSub: OWNER_SUB, coTeacherEmails: ['Foo.Bar@Example.COM'] };
        expect(mod.canManageClassroom(classroom, { sub: 'x', email: 'foo.bar@example.com' })).toBe(true);
        expect(mod.canManageClassroom(classroom, { sub: 'x', email: 'other@example.com' })).toBe(false);
    });
});
