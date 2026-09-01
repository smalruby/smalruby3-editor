
/**
 * `GET /classrooms` の読み取り構成を固定するテスト (issue #1146)。
 *
 * 3 つの性質を守る:
 *
 * 1. **Scan を使わない** — 一覧経路から Classrooms / ClassroomGroups への Scan を
 *    全廃した。RCU も 1MB 上限もフィルタ適用「前」に効くため、Scan のコストは
 *    「その先生に見える量」ではなく「テーブル全体の量」に比例して増える。
 *    共同管理は逆引き索引テーブル（email → 資源）、クラス経由の課題は
 *    Classrooms の `groupId-index` GSI で引く。
 * 2. **ページング** — 索引を引く Query も `LastEvaluatedKey` を辿らなければ
 *    エラー無しで取りこぼす。一覧系の Query は最後のページまで辿る。
 * 3. **索引を信用しすぎない** — 逆引き索引は資源本体と結果整合なので、
 *    引いた資源の `coTeacherEmails` を読み直して権限を再確認する
 *    （認可の真実は今も item 上のリストであり、索引ではない）。
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
 * ページングする in-memory テーブル。`pageSize` を指定すると Query が
 * `LastEvaluatedKey` を返し、実装がページを辿らないと一部しか見えない。
 *
 * 逆引き索引テーブルの中身は資源の `coTeacherEmails` から導出する
 * ＝ dual-write が正しく走った状態を表す。索引を別に与えないことで
 * 「索引と資源が食い違ったまま green になるテスト」を避ける。
 */
const useTables = (groups: Row[], assignments: Row[], pageSize = 0) => {
    const indexRows: Row[] = [
        ...groups.flatMap((g) => ((g.coTeacherEmails || []) as string[]).map((email) => ({
            coTeacherEmail: email, resourceKey: `group#${g.groupId}`,
            resourceType: 'group', resourceId: g.groupId,
        }))),
        ...assignments.flatMap((a) => ((a.coTeacherEmails || []) as string[]).map((email) => ({
            coTeacherEmail: email, resourceKey: `assignment#${a.classroomId}`,
            resourceType: 'assignment', resourceId: a.classroomId,
        }))),
    ];
    const rowsOf = (table: string): Row[] => {
        if (table === 'ClassroomGroups') return groups;
        if (table === 'ClassroomCoTeacherIndex') return indexRows;
        return assignments;
    };

    mockSend.mockImplementation((cmd: { constructor: { name: string }; input: Record<string, any> }) => {
        const name = cmd.constructor.name;
        const input = cmd.input;
        const values = input.ExpressionAttributeValues || {};

        if (name === 'GetCommand') {
            if (input.TableName === 'ClassroomGroups') {
                return Promise.resolve({ Item: groups.find((g) => g.groupId === input.Key.groupId) });
            }
            return Promise.resolve({});
        }
        if (name === 'BatchGetCommand') {
            const responses: Record<string, Row[]> = {};
            for (const [table, spec] of Object.entries(input.RequestItems as Record<string, { Keys: Row[] }>)) {
                expect(spec.Keys.length).toBeLessThanOrEqual(100);
                const target = rowsOf(table);
                responses[table] = spec.Keys
                    .map((key) => {
                        const [[keyName, keyValue]] = Object.entries(key);
                        return target.find((r) => r[keyName] === keyValue);
                    })
                    .filter((r): r is Row => !!r);
            }
            return Promise.resolve({ Responses: responses });
        }
        if (name !== 'QueryCommand') {
            // Scan はもう一覧経路に無い。呼ばれた事実は scansAgainst() で assert する。
            return Promise.resolve({ Items: [] });
        }

        const rows = rowsOf(input.TableName);
        const condition: string = input.KeyConditionExpression || '';
        const keyMatch = (r: Row): boolean => {
            if (condition.includes('coTeacherEmail')) {
                return r.coTeacherEmail === values[':email']
                    && String(r.resourceKey).startsWith(values[':prefix']);
            }
            if (condition.includes('groupId = :gid')) return r.groupId === values[':gid'];
            return r.teacherSub === values[':ts'];
        };
        // キー条件に合う行だけをページに切り出す（実 Query と同じで、
        // Query は一致するキー範囲のみを読む）。
        const matched = rows.filter(keyMatch);
        const start = input.ExclusiveStartKey ? (input.ExclusiveStartKey.index as number) : 0;
        const end = pageSize > 0 ? Math.min(start + pageSize, matched.length) : matched.length;

        return Promise.resolve({
            Items: matched.slice(start, end),
            ...(end < matched.length ? { LastEvaluatedKey: { index: end } } : {}),
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

    const commandsOf = (commandName: string, table?: string) =>
        mockSend.mock.calls
            .map((c) => c[0])
            .filter((c) => c?.constructor?.name === commandName
                && (table === undefined || c?.input?.TableName === table));

    const scansAgainst = (table: string) => commandsOf('ScanCommand', table);

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

    test('一覧経路は Classrooms / ClassroomGroups を Scan しない', async () => {
        useTables([ownGroup, coGroup], [
            assignment('c-own', { teacherSub: SELF_SUB }),
            assignment('c-co-assignment', { coTeacherEmails: [SELF_EMAIL] }),
            assignment('c-in-own-group', { groupId: 'g-own' }),
            assignment('c-in-co-group', { groupId: 'g-co' }),
            assignment('c-foreign', { groupId: 'g-foreign' }),
        ]);

        expect(await listIds()).toEqual(['c-co-assignment', 'c-in-co-group', 'c-in-own-group', 'c-own']);
        expect(scansAgainst('Classrooms')).toHaveLength(0);
        expect(scansAgainst('ClassroomGroups')).toHaveLength(0);
    });

    test('共同管理は逆引き索引、クラス経由は groupId-index で引く', async () => {
        useTables([coGroup], [
            assignment('c-co-assignment', { coTeacherEmails: [SELF_EMAIL] }),
            assignment('c-in-co-group', { groupId: 'g-co' }),
        ]);

        expect(await listIds()).toEqual(['c-co-assignment', 'c-in-co-group']);

        // 逆引き索引は課題用と組用の 2 本（接頭辞で撃ち分ける）。
        const indexQueries = commandsOf('QueryCommand', 'ClassroomCoTeacherIndex');
        expect(indexQueries.map((q) => q.input.ExpressionAttributeValues[':prefix']).sort())
            .toEqual(['assignment#', 'group#']);
        for (const query of indexQueries) {
            expect(query.input.ExpressionAttributeValues[':email']).toBe(SELF_EMAIL);
        }

        // クラス経由の課題は GSI の Query（旧 `groupId IN (...)` の Scan を置換）。
        const groupIdQueries = commandsOf('QueryCommand', 'Classrooms')
            .filter((q) => q.input.IndexName === 'groupId-index');
        expect(groupIdQueries.map((q) => q.input.ExpressionAttributeValues[':gid'])).toEqual(['g-co']);
    });

    test('索引が消し忘れを返しても、資源本体のリストで再確認して除外する', async () => {
        // 逆引き索引は資源と結果整合。共同管理者から外れた課題の行が残っていても、
        // item 上の coTeacherEmails が真実なので一覧に混ぜてはいけない。
        useTables([], [assignment('c-stale')]);
        const stale = {
            coTeacherEmail: SELF_EMAIL, resourceKey: 'assignment#c-stale',
            resourceType: 'assignment', resourceId: 'c-stale',
        };
        const inner = mockSend.getMockImplementation()!;
        mockSend.mockImplementation((cmd: any) => {
            if (cmd?.constructor?.name === 'QueryCommand'
                && cmd.input.TableName === 'ClassroomCoTeacherIndex'
                && cmd.input.ExpressionAttributeValues[':prefix'] === 'assignment#') {
                return Promise.resolve({ Items: [stale] });
            }
            return inner(cmd);
        });

        expect(await listIds()).toEqual([]);
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

    test('LastEvaluatedKey が返るときは全ページを辿る (逆引き索引 / groupId-index)', async () => {
        // 1 ページ 1 件しか返らないので、辿らなければ 1 件しか見えない。
        useTables(
            [ownGroup, coGroup],
            [
                assignment('c-1', { coTeacherEmails: [SELF_EMAIL] }),
                assignment('c-2', { coTeacherEmails: [SELF_EMAIL] }),
                assignment('c-3', { groupId: 'g-own' }),
                assignment('c-4', { groupId: 'g-own' }),
                assignment('c-5', { groupId: 'g-co' }),
            ],
            1,
        );

        expect(await listIds()).toEqual(['c-1', 'c-2', 'c-3', 'c-4', 'c-5']);
    });

    test('共同管理クラスが 100 件を超えても BatchGet を分割して全件拾う', async () => {
        // 旧実装の `groupId IN (...)` は 100 オペランド上限でチャンク分割していた。
        // 索引経由になったので、上限は BatchGetItem の 100 キー（mock 側で assert）。
        const manyGroups = Array.from({ length: 150 }, (_, i) => ({
            groupId: `g${i}`,
            teacherSub: 'other-teacher',
            coTeacherEmails: [SELF_EMAIL],
            status: 'active',
        }));
        useTables(manyGroups, [assignment('c-first', { groupId: 'g0' }), assignment('c-last', { groupId: 'g149' })]);

        expect(await listIds()).toEqual(['c-first', 'c-last']);
        expect(commandsOf('BatchGetCommand')).toHaveLength(2);
        expect(scansAgainst('ClassroomGroups')).toHaveLength(0);
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
