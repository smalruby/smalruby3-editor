
/**
 * 共同管理者の逆引き索引 (ClassroomCoTeacherIndex) の書き込み同期を固定する
 * テスト (issue #1146)。
 *
 * `GET /classrooms` はこの索引を読んで一覧を組み立てるので、**索引に書かない
 * 経路が 1 つでもあると、その共同管理者には資源が見えなくなる**。しかも
 * 権限 (`canManageClassroom`) は今も item 上の `coTeacherEmails` を見るため、
 * 直リンクでは操作できてしまい「一覧に出ないだけ」という気付きにくい壊れ方に
 * なる。そこで `coTeacherEmails` を書き換える経路すべてを列挙して固定する:
 *
 * 1. 課題の共同管理者 追加 (POST /classrooms/{id}/co-teachers)
 * 2. 課題の共同管理者 削除 (DELETE /classrooms/{id}/co-teachers/{email})
 * 3. 組の共同管理者 更新 (PATCH /classroom-groups/{id})
 * 4. v2 移行で課題の共同管理者を組へ引き上げる (POST /classroom-groups/migrate)
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
const INDEX_TABLE = 'ClassroomCoTeacherIndex';

type Row = Record<string, any>;

const makeEvent = (
    method: string,
    path: string,
    pathParameters: Record<string, string> = {},
    body?: unknown,
) => ({
    requestContext: { http: { method, path, sourceIp: '127.0.0.1' } },
    headers: { authorization: `Bearer ${DEV_TOKEN}`, origin: 'http://localhost:8601' },
    pathParameters,
    body: body === undefined ? undefined : JSON.stringify(body),
});

/** 最小の in-memory ルーティング。索引への書き込みだけを記録する。 */
const install = (tables: Record<string, Row[]>) => {
    const indexWrites: { op: 'put' | 'delete'; email: string; resourceKey: string; ttl?: unknown }[] = [];
    mockSend.mockImplementation((cmd: { constructor: { name: string }; input: Record<string, any> }) => {
        const name = cmd.constructor.name;
        const input = cmd.input;
        const rows = tables[String(input.TableName || '')] || [];

        if (name === 'PutCommand' && input.TableName === INDEX_TABLE) {
            indexWrites.push({
                op: 'put',
                email: input.Item.coTeacherEmail,
                resourceKey: input.Item.resourceKey,
                ttl: input.Item.ttl,
            });
            return Promise.resolve({});
        }
        if (name === 'DeleteCommand' && input.TableName === INDEX_TABLE) {
            indexWrites.push({ op: 'delete', email: input.Key.coTeacherEmail, resourceKey: input.Key.resourceKey });
            return Promise.resolve({});
        }
        if (name === 'GetCommand') {
            const [[keyName, keyValue]] = Object.entries(input.Key as Row);
            return Promise.resolve({ Item: rows.find((r) => r[keyName] === keyValue) });
        }
        if (name === 'QueryCommand') {
            const values = input.ExpressionAttributeValues || {};
            const condition = String(input.KeyConditionExpression || '');
            if (condition.includes('teacherSub')) {
                return Promise.resolve({ Items: rows.filter((r) => r.teacherSub === values[':ts']) });
            }
            if (condition.includes('groupId = :gid')) {
                return Promise.resolve({ Items: rows.filter((r) => r.groupId === values[':gid']) });
            }
            return Promise.resolve({ Items: [] });
        }
        if (name === 'UpdateCommand') {
            const [[keyName, keyValue]] = Object.entries(input.Key as Row);
            const row = rows.find((r) => r[keyName] === keyValue) || { ...(input.Key as Row) };
            return Promise.resolve({ Attributes: row });
        }
        return Promise.resolve({});
    });
    return indexWrites;
};

describe('co-teacher reverse index write sync (issue #1146)', () => {
    let handler: (event: unknown) => Promise<{ statusCode?: number; body?: string }>;

    beforeEach(() => {
        jest.resetModules();
        process.env.DEV_BYPASS_TOKEN = DEV_TOKEN;
        process.env.STAGE = 'stg';
        mockSend.mockReset();
        handler = require('../handler').handler;
    });

    test('課題に共同管理者を追加すると索引に行が増える', async () => {
        const writes = install({
            Classrooms: [{
                classroomId: 'c1', teacherSub: SELF_SUB, className: 'x',
                status: 'active', coTeacherEmails: [], ttl: 1800000000,
            }],
        });

        const res = await handler(makeEvent('POST', '/classrooms/c1/co-teachers', { classroomId: 'c1' }, {
            email: 'New.Teacher@Example.COM',
        }));
        expect(res.statusCode).toBe(200);
        // 索引のキーは正規化済み email（Query 側も正規化して引くため）。
        expect(writes).toEqual([
            { op: 'put', email: 'new.teacher@example.com', resourceKey: 'assignment#c1', ttl: 1800000000 },
        ]);
    });

    test('課題の共同管理者を外すと索引の行も消える', async () => {
        const writes = install({
            Classrooms: [{
                classroomId: 'c1', teacherSub: SELF_SUB, className: 'x',
                status: 'active', coTeacherEmails: ['a@example.com', 'b@example.com'],
            }],
        });

        const res = await handler(makeEvent(
            'DELETE', '/classrooms/c1/co-teachers/a%40example.com',
            { classroomId: 'c1', email: 'a%40example.com' },
        ));
        expect(res.statusCode).toBe(200);
        expect(writes).toEqual([
            { op: 'delete', email: 'a@example.com', resourceKey: 'assignment#c1' },
        ]);
    });

    test('組の共同管理者を差し替えると差分だけ書く', async () => {
        const writes = install({
            ClassroomGroups: [{
                groupId: 'g1', teacherSub: SELF_SUB, name: '1組', year: 2026,
                status: 'active', schemaVersion: 2, topics: [],
                coTeacherEmails: ['keep@example.com', 'drop@example.com'], ttl: 1900000000,
            }],
        });

        const res = await handler(makeEvent('PATCH', '/classroom-groups/g1', { groupId: 'g1' }, {
            coTeacherEmails: ['keep@example.com', 'add@example.com'],
        }));
        expect(res.statusCode).toBe(200);
        // 据え置きの keep@ には何も書かない（同じ内容の上書きはしない）。
        expect(writes).toEqual([
            { op: 'put', email: 'add@example.com', resourceKey: 'group#g1', ttl: 1900000000 },
            { op: 'delete', email: 'drop@example.com', resourceKey: 'group#g1' },
        ]);
    });

    test('v2 移行で組へ引き上げた共同管理者も索引に載る', async () => {
        // 移行は課題の共同管理者を組へ union する = coTeacherEmails の書き手。
        // ここで同期しないと、移行済みアカウントの共同管理クラスが一覧から消える。
        const writes = install({
            Classrooms: [{
                classroomId: 'c1', teacherSub: SELF_SUB, className: '1組',
                assignmentName: '第1回', status: 'active', studentCount: 30,
                groupId: 'g1', createdAt: '2026-08-01T00:00:00.000Z',
                coTeacherEmails: ['lifted@example.com'],
            }],
            ClassroomGroups: [{
                groupId: 'g1', teacherSub: SELF_SUB, name: '1組', year: 2026,
                status: 'active', schemaVersion: 1, topics: [], studentCount: 30,
                coTeacherEmails: [], ttl: 1900000000,
            }],
        });

        const res = await handler(makeEvent('POST', '/classroom-groups/migrate'));
        expect(res.statusCode).toBe(200);
        expect(writes).toEqual([
            { op: 'put', email: 'lifted@example.com', resourceKey: 'group#g1', ttl: 1900000000 },
        ]);
    });
});

// import / export を持たないテストファイルは TS の「スクリプト」扱いになり、
// ts-jest が 1 プロセスで複数のテストを型付けすると `const mockSend` などが
// グローバルスコープで衝突して "Cannot redeclare block-scoped variable" になる。
export {};
