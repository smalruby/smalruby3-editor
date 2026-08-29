
/**
 * Class-level (group) co-teacher authorization tests (issue #1138).
 *
 * A co-teacher registered on a class (`ClassroomGroups.coTeacherEmails`) must be
 * able to work inside that class just like its owner: see the assignments in it
 * and create new ones. Before this, the group gate was owner-only, so the
 * co-teacher saw an empty assignment list and got `Group not found` on create.
 *
 * The requester is the dev-bypass identity
 * ({sub: 'dev-test-teacher', email: 'dev-test-teacher@example.com'}). Stored
 * co-teacher addresses are normalized on write (validateCoTeacherEmail), and
 * the mocked Scan below matches `contains()` case-sensitively like DynamoDB
 * does, so the handler tests exercise the real discovery path; the
 * case-insensitivity of the authorization comparison is pinned separately on
 * canManageGroup / canManageClassroom.
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

// The class the dev-test-teacher co-manages.
const coManagedGroup = {
    groupId: 'g1',
    teacherSub: OWNER_SUB,
    name: 'CoderDojo しまね',
    year: 2026,
    status: 'active',
    studentCount: 10,
    topics: [],
    coTeacherEmails: ['dev-test-teacher@example.com'],
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

    /**
     * Route reads against in-memory tables so the list tests assert on the
     * result rather than on the exact query shape (which class/assignment scan
     * runs in which order is an implementation detail).
     */
    const useTables = (allGroups: Record<string, unknown>[], allAssignments: Record<string, unknown>[]) => {
        mockSend.mockImplementation((cmd: { constructor: { name: string }; input: Record<string, any> }) => {
            const name = cmd.constructor.name;
            const input = cmd.input;
            const rows = input.TableName === 'ClassroomGroups' ? allGroups : allAssignments;
            const values = input.ExpressionAttributeValues || {};
            if (name === 'GetCommand') {
                if (input.TableName === 'ClassroomGroups') {
                    return Promise.resolve({
                        Item: allGroups.find((g: any) => g.groupId === input.Key.groupId),
                    });
                }
                return Promise.resolve({});
            }
            if (name === 'QueryCommand') {
                // Every GSI query in the list path keys off teacherSub.
                return Promise.resolve({ Items: rows.filter((r: any) => r.teacherSub === values[':ts']) });
            }
            if (name === 'ScanCommand') {
                const filter: string = input.FilterExpression || '';
                if (!filter) {
                    return Promise.resolve({ Items: rows });
                }
                // The list path ORs the two predicates into a single Scan
                // (#1146), so evaluate each clause and union the matches.
                const matches = (row: any, clause: string): boolean => {
                    if (clause.startsWith('contains(coTeacherEmails')) {
                        // DynamoDB's contains() is an exact, case-sensitive
                        // element match — do not soften it here, or the mock
                        // would certify a case-insensitivity the real table
                        // does not have.
                        return (row.coTeacherEmails || []).includes(values[':email']);
                    }
                    if (clause.startsWith('groupId IN')) {
                        const wanted = /\(([^)]*)\)/
                            .exec(clause)![1]
                            .split(',')
                            .map((p: string) => values[p.trim()]);
                        return wanted.includes(row.groupId);
                    }
                    throw new Error(`unsupported filter clause: ${clause}`);
                };
                const clauses = filter.split(' OR ').map((c: string) => c.trim());
                return Promise.resolve({
                    Items: rows.filter((r: any) => clauses.some((c: string) => matches(r, c))),
                });
            }
            return Promise.resolve({});
        });
    };

    test('GET /classrooms lists assignments that live in a co-managed class', async () => {
        useTables([coManagedGroup, foreignGroup], [assignmentInGroup]);

        const res = await handler(makeEvent('GET', '/classrooms', {}));
        expect(res.statusCode).toBe(200);
        const { classrooms } = JSON.parse(res.body || '{}');
        expect(classrooms).toHaveLength(1);
        expect(classrooms[0].classroomId).toBe('c1');
        expect(classrooms[0].role).toBe('co-teacher');
    });

    test('GET /classrooms does not leak assignments from a class the teacher has no part in', async () => {
        const foreignAssignment = { ...assignmentInGroup, classroomId: 'c9', groupId: 'g2' };
        useTables([coManagedGroup, foreignGroup], [assignmentInGroup, foreignAssignment]);

        const res = await handler(makeEvent('GET', '/classrooms', {}));
        const { classrooms } = JSON.parse(res.body || '{}');
        expect(classrooms.map((c: { classroomId: string }) => c.classroomId)).toEqual(['c1']);
    });

    test('the class owner sees an assignment a co-teacher created in their class', async () => {
        // Mirror image of the reported bug: now that co-teachers can create
        // assignments, keying the list off teacherSub would hide them from the
        // owner. The dev-test-teacher owns the class here.
        const ownedGroup = { ...coManagedGroup, teacherSub: 'dev-test-teacher', coTeacherEmails: ['co@example.com'] };
        const byCoTeacher = { ...assignmentInGroup, classroomId: 'c2', teacherSub: 'co-teacher-sub' };
        useTables([ownedGroup], [byCoTeacher]);

        const res = await handler(makeEvent('GET', '/classrooms', {}));
        expect(res.statusCode).toBe(200);
        const { classrooms } = JSON.parse(res.body || '{}');
        expect(classrooms.map((c: { classroomId: string }) => c.classroomId)).toEqual(['c2']);
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

    test('renaming a topic also follows assignments a co-teacher created', async () => {
        // The cascade has to enumerate by groupId: this assignment sits in the
        // class but carries the co-teacher's own teacherSub, so an owner-keyed
        // query would leave it pointing at a topic the class no longer has.
        const groupWithTopic = { ...coManagedGroup, topics: ['むかしのなまえ'] };
        const byCoTeacher = {
            ...assignmentInGroup,
            classroomId: 'c3',
            teacherSub: 'dev-test-teacher',
            topic: 'むかしのなまえ',
        };
        useTables([groupWithTopic], [byCoTeacher]);

        const res = await handler(
            makeEvent('PATCH', '/classroom-groups/g1/topics', { groupId: 'g1' }, {
                action: 'rename',
                name: 'むかしのなまえ',
                to: 'あたらしいなまえ',
            }),
        );
        expect(res.statusCode).toBe(200);
        const cascade = commands().find(
            (c) => c?.constructor?.name === 'UpdateCommand' && c?.input?.TableName === 'Classrooms',
        );
        expect(cascade?.input?.Key?.classroomId).toBe('c3');
        expect(cascade?.input?.ExpressionAttributeValues?.[':to']).toBe('あたらしいなまえ');
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

// import / export を持たないテストファイルは TS の「スクリプト」扱いになり、
// ts-jest が 1 プロセスで複数のテストを型付けすると `const mockSend` などが
// グローバルスコープで衝突して "Cannot redeclare block-scoped variable" になる。
// 空 export でモジュール化してファイルごとのスコープに閉じる。
export {};
