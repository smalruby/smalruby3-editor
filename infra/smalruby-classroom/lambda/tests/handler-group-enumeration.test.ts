/**
 * クラス（組）単位の課題列挙が groupId 起点であることを固定するテスト（issue #1145）。
 *
 * #1138 でクラス単位の共同管理者が課題を扱えるようになったため、「クラスに属する
 * 課題を列挙する」処理をクラスのオーナーの `teacherSub` で引くと **共同管理者が
 * 作った課題を取りこぼす**。ここでは共同管理者が作った課題（オーナーとは別の
 * `teacherSub` を持つ行）を用意し、3 経路がそれを拾うことを固定する:
 *
 * 1. クラスの人数変更 → 課題への波及（PATCH /classroom-groups/{id}）
 * 2. 生徒 join 時の「前回のコメント」リキャップ
 * 3. 課題作成時の同名課題オートナンバリング
 *
 * 実装詳細（Query の形状）ではなく **テーブルの中身** をモックする形にしてある。
 */

// このファイルはモジュール（トップレベル宣言をファイルスコープに閉じる）。他のテスト
// ファイルも `mockSend` を宣言しているため、スクリプト扱いだと TS2451 で衝突する。
export {};

const mockSend = jest.fn();
jest.mock('@aws-sdk/lib-dynamodb', () => {
    const actual = jest.requireActual('@aws-sdk/lib-dynamodb');
    return {
        ...actual,
        DynamoDBDocumentClient: { from: () => ({ send: mockSend }) },
    };
});
jest.mock('@aws-sdk/client-s3', () => {
    const actual = jest.requireActual('@aws-sdk/client-s3');
    return { ...actual, S3Client: jest.fn(() => ({ send: jest.fn() })) };
});
jest.mock('@aws-sdk/s3-request-presigner', () => ({
    getSignedUrl: jest.fn(async () => 'https://signed.example/get'),
}));

const DEV_TOKEN = 'test-dev-bypass';
const DEV_SUB = 'dev-test-teacher';
const CO_TEACHER_SUB = 'co-teacher-B';

type Item = Record<string, any>;

/** クラス（組）: オーナーは dev-test-teacher。 */
const group = (): Item => ({
    groupId: 'g1',
    teacherSub: DEV_SUB,
    name: '2年1組',
    year: 2026,
    status: 'active',
    studentCount: 30,
    schemaVersion: 2,
    topics: [],
    coTeacherEmails: ['co-teacher@example.com'],
});

/** オーナーが作った課題。 */
const ownerAssignment = (): Item => ({
    classroomId: 'c-owner',
    teacherSub: DEV_SUB,
    className: '2年1組',
    assignmentName: '第1回',
    joinCode: 'aaaaaa',
    studentCount: 30,
    groupId: 'g1',
    status: 'active',
    createdAt: '2026-08-01T00:00:00.000Z',
});

/** 共同管理者が作った課題（teacherSub がオーナーと違う）。 */
const coTeacherAssignment = (): Item => ({
    classroomId: 'c-co',
    teacherSub: CO_TEACHER_SUB,
    className: '2年1組',
    assignmentName: '第2回',
    joinCode: 'bbbbbb',
    studentCount: 30,
    groupId: 'g1',
    status: 'active',
    createdAt: '2026-08-02T00:00:00.000Z',
});

/**
 * テーブルの中身をモックする DynamoDB スタブ。Query は GSI のキーで、Scan は
 * `contains(coTeacherEmails, :email)` と `groupId IN (...)` のフィルタだけを
 * 解釈する（handler が実際に使う形に限定した最小実装）。
 */
const installTables = (tables: Record<string, Item[]>) => {
    const updates: { table: string; key: Item; values: Item }[] = [];
    const puts: Item[] = [];

    const matchesScan = (input: Item, item: Item): boolean => {
        const filter = String(input.FilterExpression || '');
        const values = (input.ExpressionAttributeValues || {}) as Record<string, unknown>;
        if (filter.includes('contains(coTeacherEmails')) {
            const emails: string[] = Array.isArray(item.coTeacherEmails) ? item.coTeacherEmails : [];
            return emails.includes(String(values[':email']));
        }
        if (filter.includes('groupId IN')) {
            const wanted = Object.entries(values)
                .filter(([key]) => key.startsWith(':g'))
                .map(([, value]) => value);
            return wanted.includes(item.groupId);
        }
        return true;
    };

    mockSend.mockImplementation(async (command: { constructor: { name: string }; input: Item }) => {
        const name = command.constructor.name;
        const input = command.input;
        const table = String(input.TableName || '');
        const rows = tables[table] || [];

        if (name === 'GetCommand') {
            const [[keyName, keyValue]] = Object.entries(input.Key as Item);
            return { Item: rows.find(row => row[keyName] === keyValue) };
        }
        if (name === 'ScanCommand') {
            return { Items: rows.filter(row => matchesScan(input, row)) };
        }
        if (name === 'QueryCommand') {
            const values = (input.ExpressionAttributeValues || {}) as Record<string, unknown>;
            const condition = String(input.KeyConditionExpression || '');
            let items = rows.filter(row => {
                if (condition.includes('teacherSub')) return row.teacherSub === values[':ts'];
                if (condition.includes('joinCode')) return row.joinCode === values[':jc'];
                if (condition.includes('sessionToken')) return row.sessionToken === values[':st'];
                if (condition.includes('classroomId')) {
                    return row.classroomId === values[':cid']
                        && (values[':mid'] === undefined || row.memberId === values[':mid']);
                }
                return false;
            });
            const filter = String(input.FilterExpression || '');
            if (filter.includes('groupId = :gid')) {
                items = items.filter(row => row.groupId === values[':gid']);
            }
            if (filter.includes(':active')) {
                items = items.filter(row => row.status === values[':active']);
            }
            return { Items: items };
        }
        if (name === 'PutCommand') {
            puts.push(input.Item as Item);
            return {};
        }
        if (name === 'UpdateCommand') {
            updates.push({
                table,
                key: input.Key as Item,
                values: (input.ExpressionAttributeValues || {}) as Item,
            });
            const [[keyName, keyValue]] = Object.entries(input.Key as Item);
            const row = rows.find(item => item[keyName] === keyValue) || { ...(input.Key as Item) };
            return { Attributes: { ...row, studentCount: (input.ExpressionAttributeValues as Item)?.[':sc'] ?? row.studentCount } };
        }
        return {};
    });

    return { updates, puts };
};

const makeEvent = (
    method: string,
    path: string,
    pathParameters: Record<string, string>,
    body?: unknown,
    withAuth = true,
) => ({
    requestContext: { http: { method, path, sourceIp: '127.0.0.1' } },
    headers: {
        ...(withAuth ? { authorization: `Bearer ${DEV_TOKEN}` } : {}),
        origin: 'http://localhost:8601',
    },
    pathParameters,
    body: body === undefined ? undefined : JSON.stringify(body),
});

describe('クラス単位の課題列挙は groupId 起点（issue #1145）', () => {
    let handler: (event: unknown) => Promise<{ statusCode?: number; body?: string }>;

    beforeEach(() => {
        jest.resetModules();
        process.env.DEV_BYPASS_TOKEN = DEV_TOKEN;
        process.env.STAGE = 'stg';
        process.env.CORS_ALLOWED_ORIGINS = 'http://localhost:8601';
        mockSend.mockReset();
        handler = require('../handler').handler;
    });

    test('クラスの人数変更は共同管理者が作った課題にも波及する', async () => {
        const { updates } = installTables({
            ClassroomGroups: [group()],
            Classrooms: [ownerAssignment(), coTeacherAssignment()],
        });

        const res = await handler(
            makeEvent('PATCH', '/classroom-groups/g1', { groupId: 'g1' }, { studentCount: 35 }),
        );

        expect(res.statusCode).toBe(200);
        const classroomUpdates = updates
            .filter(update => update.table === 'Classrooms')
            .map(update => ({ classroomId: update.key.classroomId, studentCount: update.values[':sc'] }));
        expect(classroomUpdates).toEqual([
            { classroomId: 'c-owner', studentCount: 35 },
            { classroomId: 'c-co', studentCount: 35 },
        ]);
    });

    test('人数の波及対象は同じクラスのアクティブな課題だけ', async () => {
        const otherGroupAssignment = { ...coTeacherAssignment(), classroomId: 'c-other', groupId: 'g2' };
        const archived = { ...coTeacherAssignment(), classroomId: 'c-archived', status: 'archived' };
        const { updates } = installTables({
            ClassroomGroups: [group()],
            Classrooms: [ownerAssignment(), otherGroupAssignment, archived],
        });

        await handler(makeEvent('PATCH', '/classroom-groups/g1', { groupId: 'g1' }, { studentCount: 35 }));

        const touched = updates
            .filter(update => update.table === 'Classrooms')
            .map(update => update.key.classroomId);
        expect(touched).toEqual(['c-owner']);
    });

    test('前回のコメントは共同管理者が作った前回授業からも拾う', async () => {
        // 今回の授業はオーナー作。前回授業は共同管理者作（teacherSub が別）。
        const current = { ...ownerAssignment(), classroomId: 'c-current', joinCode: 'cccccc', createdAt: '2026-08-03T00:00:00.000Z' };
        installTables({
            ClassroomGroups: [group()],
            Classrooms: [current, coTeacherAssignment()],
            ClassroomSubmissions: [{
                classroomId: 'c-co',
                memberId: 'seat-05',
                status: 'returned',
                teacherComment: 'よくできました',
                submittedAt: '2026-08-02T01:00:00.000Z',
            }],
            ClassroomMemberships: [],
        });

        const res = await handler(
            makeEvent('POST', '/classrooms/join', {}, { joinCode: 'cccccc', seatNumber: 5, nickname: 'たろう' }, false),
        );

        expect(res.statusCode).toBe(200);
        const payload = JSON.parse(String(res.body));
        expect(payload.previousComment).toEqual({
            assignmentName: '第2回',
            teacherComment: 'よくできました',
            submittedAt: '2026-08-02T01:00:00.000Z',
        });
    });

    test('同名課題のオートナンバリングは共同管理者が作った課題も数える', async () => {
        const { puts } = installTables({
            ClassroomGroups: [group()],
            Classrooms: [coTeacherAssignment()],
        });

        const res = await handler(
            makeEvent('POST', '/classrooms', {}, {
                className: '2年1組',
                assignmentName: '第2回',
                groupId: 'g1',
            }),
        );

        expect(res.statusCode).toBe(201);
        const created = puts.find(item => item.classroomId && item.groupId === 'g1');
        expect(created?.assignmentName).toBe('第2回 (2)');
    });
});
