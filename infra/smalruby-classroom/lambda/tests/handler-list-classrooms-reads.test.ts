
/**
 * `GET /classrooms` の読み取り構成を固定するテスト (issue #1146)。
 *
 * 2 つの性質を守る:
 *
 * 1. **読み取り回数** — Classrooms テーブルへのフルスキャンは 1 リクエスト
 *    あたり 1 回まで（課題単位の共同管理と、クラス経由の課題を 1 つの
 *    `contains(coTeacherEmails) OR groupId IN (...)` に統合している）。
 *    RCU はフィルタ適用「前」に読んだ項目に課金されるため、Scan 回数が
 *    そのまま課金に効く。
 * 2. **ページング** — DynamoDB の 1MB 上限もフィルタ適用「前」に効くので、
 *    `LastEvaluatedKey` を辿らないとテーブル肥大時にエラー無しで取りこぼす。
 *    一覧系の Scan / Query は最後のページまで辿る。
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
const SELF_EMAIL = 'dev-test-teacher@example.com';

const makeEvent = () => ({
    requestContext: { http: { method: 'GET', path: '/classrooms', sourceIp: '127.0.0.1' } },
    headers: { authorization: `Bearer ${DEV_TOKEN}`, origin: 'http://localhost:8601' },
    pathParameters: {},
});

type Row = Record<string, any>;

/**
 * FilterExpression の最小評価器。実装が使う 2 つの述語
 * (`contains(coTeacherEmails, :email)` と `groupId IN (...)`) と、その OR 結合
 * だけを解釈する。統合前後どちらの形でも同じ結果になるので、テストは
 * 「フィルタの書き方」ではなく「返る項目」を固定できる。
 */
const matchesFilter = (row: Row, filter: string, values: Record<string, any>): boolean => {
    if (!filter) {
        return true;
    }
    return filter.split(' OR ').some((clause) => {
        const trimmed = clause.trim();
        const contains = /^contains\(coTeacherEmails,\s*(:\w+)\)$/.exec(trimmed);
        if (contains) {
            return (row.coTeacherEmails || []).includes(values[contains[1]]);
        }
        const inList = /^groupId IN \(([^)]*)\)$/.exec(trimmed);
        if (inList) {
            const wanted = inList[1].split(',').map((p) => values[p.trim()]);
            return wanted.includes(row.groupId);
        }
        throw new Error(`unsupported filter clause: ${trimmed}`);
    });
};

/**
 * ページングする in-memory テーブル。`pageSize` を指定すると
 * `LastEvaluatedKey` を返し、実装がページを辿らないと一部しか見えない。
 */
const useTables = (
    groups: Row[],
    assignments: Row[],
    pageSize = 0,
) => {
    mockSend.mockImplementation((cmd: { constructor: { name: string }; input: Record<string, any> }) => {
        const name = cmd.constructor.name;
        const input = cmd.input;
        const rows: Row[] = input.TableName === 'ClassroomGroups' ? groups : assignments;
        const values = input.ExpressionAttributeValues || {};

        if (name === 'GetCommand') {
            if (input.TableName === 'ClassroomGroups') {
                return Promise.resolve({ Item: groups.find((g) => g.groupId === input.Key.groupId) });
            }
            return Promise.resolve({});
        }
        if (name !== 'QueryCommand' && name !== 'ScanCommand') {
            return Promise.resolve({});
        }

        // フィルタ適用「前」のページ切り出し — 実 DynamoDB と同じ順序
        // (1MB 読む → フィルタ) を再現する。
        const start = input.ExclusiveStartKey ? (input.ExclusiveStartKey.index as number) : 0;
        const end = pageSize > 0 ? Math.min(start + pageSize, rows.length) : rows.length;
        const page = rows.slice(start, end);

        const matched =
            name === 'QueryCommand'
                ? page.filter((r) => r.teacherSub === values[':ts'])
                : page.filter((r) => matchesFilter(r, input.FilterExpression || '', values));

        return Promise.resolve({
            Items: matched,
            ...(end < rows.length ? { LastEvaluatedKey: { index: end } } : {}),
        });
    });
};

describe('GET /classrooms — DynamoDB 読み取り構成 (issue #1146)', () => {
    let handler: (event: unknown) => Promise<{ statusCode?: number; body?: string }>;

    beforeEach(() => {
        jest.resetModules();
        process.env.DEV_BYPASS_TOKEN = DEV_TOKEN;
        process.env.STAGE = 'stg';
        mockSend.mockReset();
        handler = require('../handler').handler;
    });

    const scansAgainst = (table: string) =>
        mockSend.mock.calls
            .map((c) => c[0])
            .filter((c) => c?.constructor?.name === 'ScanCommand' && c?.input?.TableName === table);

    const listIds = async () => {
        const res = await handler(makeEvent());
        expect(res.statusCode).toBe(200);
        return JSON.parse(res.body || '{}').classrooms.map((c: { classroomId: string }) => c.classroomId).sort();
    };

    const ownGroup = { groupId: 'g-own', teacherSub: SELF_SUB, name: '1組', status: 'active' };
    const coGroup = {
        groupId: 'g-co',
        teacherSub: 'other-teacher',
        coTeacherEmails: [SELF_EMAIL],
        name: '2組',
        status: 'active',
    };

    const assignment = (id: string, over: Row = {}): Row => ({
        classroomId: id,
        teacherSub: 'other-teacher',
        className: 'x',
        status: 'active',
        ...over,
    });

    test('Classrooms テーブルへの Scan は 1 リクエストにつき 1 回まで', async () => {
        useTables([ownGroup, coGroup], [
            assignment('c-own', { teacherSub: SELF_SUB }),
            assignment('c-co-assignment', { coTeacherEmails: [SELF_EMAIL] }),
            assignment('c-in-own-group', { groupId: 'g-own' }),
            assignment('c-in-co-group', { groupId: 'g-co' }),
            assignment('c-foreign', { groupId: 'g-foreign' }),
        ]);

        expect(await listIds()).toEqual(['c-co-assignment', 'c-in-co-group', 'c-in-own-group', 'c-own']);
        expect(scansAgainst('Classrooms')).toHaveLength(1);
        // 組テーブル側も共同管理クラスの Scan 1 回だけ。
        expect(scansAgainst('ClassroomGroups')).toHaveLength(1);
    });

    test('2 つの述語が 1 つの Scan に OR 結合される', async () => {
        useTables([ownGroup], [assignment('c-in-own-group', { groupId: 'g-own' })]);

        expect(await listIds()).toEqual(['c-in-own-group']);
        const scans = scansAgainst('Classrooms');
        expect(scans).toHaveLength(1);
        // 統合されている＝1 本の FilterExpression に両方が載っていること。
        // （分割されていれば Scan が 2 回になり上の assert で落ちる。）
        const filter: string = scans[0].input.FilterExpression;
        expect(filter).toContain('contains(coTeacherEmails');
        expect(filter).toContain('groupId IN');
        expect(filter).toContain(' OR ');
    });

    test('DDB_MAX_PAGES が不正値でも既定にフォールバックして全件返す', async () => {
        // 不正値をそのまま上限に使うと 1 ページも読まずに空を返し、
        // ページングが防ごうとしている「黙って取りこぼす」状態になる。
        jest.resetModules();
        process.env.DDB_MAX_PAGES = 'not-a-number';
        handler = require('../handler').handler;
        useTables(
            [],
            [
                assignment('c-1', { teacherSub: SELF_SUB }),
                assignment('c-2', { teacherSub: SELF_SUB }),
            ],
            1,
        );

        try {
            expect(await listIds()).toEqual(['c-1', 'c-2']);
        } finally {
            delete process.env.DDB_MAX_PAGES;
        }
    });

    test('LastEvaluatedKey が返るときは全ページを辿る (Scan)', async () => {
        // 1 ページ 1 件しか返らないので、辿らなければ 1 件しか見えない。
        useTables(
            [ownGroup, coGroup],
            [
                assignment('c-1', { coTeacherEmails: [SELF_EMAIL] }),
                assignment('c-2', { groupId: 'g-own' }),
                assignment('c-3', { groupId: 'g-co' }),
            ],
            1,
        );

        expect(await listIds()).toEqual(['c-1', 'c-2', 'c-3']);
    });

    test('LastEvaluatedKey が返るときは全ページを辿る (Query: 自分の課題)', async () => {
        useTables(
            [],
            [
                assignment('c-1', { teacherSub: SELF_SUB }),
                assignment('c-2', { teacherSub: SELF_SUB }),
                assignment('c-3', { teacherSub: SELF_SUB }),
            ],
            1,
        );

        expect(await listIds()).toEqual(['c-1', 'c-2', 'c-3']);
    });

    test('共同管理クラスの Scan もページングする (ClassroomGroups)', async () => {
        const manyGroups = Array.from({ length: 5 }, (_, i) => ({
            groupId: `g${i}`,
            teacherSub: 'other-teacher',
            coTeacherEmails: [SELF_EMAIL],
            status: 'active',
        }));
        useTables(manyGroups, [assignment('c-last', { groupId: 'g4' })], 1);

        expect(await listIds()).toEqual(['c-last']);
    });

    test('クラスが 100 件を超えても IN 上限でチャンク分割して全件拾う', async () => {
        const groups = Array.from({ length: 150 }, (_, i) => ({
            groupId: `g${i}`,
            teacherSub: SELF_SUB,
            status: 'active',
        }));
        useTables(groups, [assignment('c-first', { groupId: 'g0' }), assignment('c-last', { groupId: 'g149' })]);

        expect(await listIds()).toEqual(['c-first', 'c-last']);
        // IN のオペランドは 100 個までなので 2 チャンク = 2 Scan。
        expect(scansAgainst('Classrooms')).toHaveLength(2);
        for (const scan of scansAgainst('Classrooms')) {
            const operands = /groupId IN \(([^)]*)\)/.exec(scan.input.FilterExpression)![1].split(',');
            expect(operands.length).toBeLessThanOrEqual(100);
        }
    });

    test('無限ループ防止のページ上限で打ち切る', async () => {
        // LastEvaluatedKey を返し続ける壊れたテーブル。
        mockSend.mockImplementation((cmd: { constructor: { name: string } }) => {
            const name = cmd.constructor.name;
            if (name === 'QueryCommand' || name === 'ScanCommand') {
                return Promise.resolve({ Items: [], LastEvaluatedKey: { index: 1 } });
            }
            return Promise.resolve({});
        });

        const res = await handler(makeEvent());
        expect(res.statusCode).toBe(200);
        // 打ち切られること（＝ハングしない）が要件。上限は実装定数。
        expect(mockSend.mock.calls.length).toBeLessThan(500);
    });
});

// import / export を持たないテストファイルは TS の「スクリプト」扱いになり、
// ts-jest が 1 プロセスで複数のテストを型付けすると `const mockSend` などが
// グローバルスコープで衝突して "Cannot redeclare block-scoped variable" になる。
// 空 export でモジュール化してファイルごとのスコープに閉じる。
export {};
