/**
 * smalruby-classroom 結合テスト
 *
 * 実際にデプロイされたエンドポイントに対してHTTPリクエストを送信し、
 * API の動作を検証します。
 *
 * ⚠️ 注意: このテストはAWSにデプロイされたリソースへリクエストを送信します。
 * CIでは実行しないでください。
 *
 * 実行方法:
 *   docker compose run --rm -w /app/infra/smalruby-classroom infra npm run test:integration
 *   （.env に CLASSROOM_API_ENDPOINT が設定されている必要があります）
 *
 *   教師フローのテストには GOOGLE_ID_TOKEN が必要です:
 *   GOOGLE_ID_TOKEN=eyJ... npm run test:integration
 *   （ブラウザの開発者ツールで取得: Smalruby でクラスモーダルを開き、教師ログイン後に
 *     コンソールで window._classroomIdToken を参照）
 */

const ENDPOINT = process.env.CLASSROOM_API_ENDPOINT || '';
const GOOGLE_ID_TOKEN = process.env.GOOGLE_ID_TOKEN || '';
// 教師フローの自動テスト用バイパストークン（stg のみ有効。.env.stg の DEV_BYPASS_TOKEN）
const DEV_BYPASS_TOKEN = process.env.DEV_BYPASS_TOKEN || '';

/** HTTP リクエストヘルパー */
async function request(
    method: string,
    path: string,
    body?: unknown,
    headers?: Record<string, string>,
): Promise<{ status: number; data: Record<string, unknown> }> {
    const url = `${ENDPOINT}${path}`;
    const opts: RequestInit = {
        method,
        headers: {
            'Content-Type': 'application/json',
            ...headers,
        },
    };
    if (body && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
        opts.body = JSON.stringify(body);
    }
    const res = await fetch(url, opts);
    if (res.status === 204) return { status: 204, data: {} };
    const data = (await res.json()) as Record<string, unknown>;
    return { status: res.status, data };
}

beforeAll(() => {
    if (!ENDPOINT) {
        throw new Error(
            'CLASSROOM_API_ENDPOINT が設定されていません。\n' +
                '.env に以下の行を追加してください:\n' +
                '  CLASSROOM_API_ENDPOINT=https://xxxx.execute-api.ap-northeast-1.amazonaws.com\n' +
                'その後 .env を .env.stg へのシンボリックリンクにしてから実行してください。',
        );
    }
});

// ---------------------------------------------------------------------------
// 認証エラー（教師エンドポイント）
// ---------------------------------------------------------------------------
describe('認証エラー', () => {
    test('GET /classrooms — Authorization ヘッダーなしで 401', async () => {
        const { status, data } = await request('GET', '/classrooms');
        expect(status).toBe(401);
        expect(data.error).toContain('Authorization');
    });

    test('GET /classrooms — 無効な Bearer トークンで 401', async () => {
        const { status, data } = await request('GET', '/classrooms', null, {
            Authorization: 'Bearer invalid-token',
        });
        expect(status).toBe(401);
        expect(data.error).toBeDefined();
    });

    test('POST /classrooms — 無効なトークンで 401', async () => {
        const { status } = await request(
            'POST',
            '/classrooms',
            { className: 'テスト', studentCount: 5 },
            { Authorization: 'Bearer invalid-token' },
        );
        expect(status).toBe(401);
    });
});

// ---------------------------------------------------------------------------
// Google Classroom エンドポイント — 認証エラー
// ---------------------------------------------------------------------------
describe('Google Classroom エンドポイント — 認証エラー', () => {
    test('GET /classrooms/google-courses — Authorization なしで 401', async () => {
        const { status } = await request('GET', '/classrooms/google-courses');
        expect(status).toBe(401);
    });

    test('GET /classrooms/google-courses — X-Google-Access-Token なしで 401', async () => {
        const { status } = await request(
            'GET',
            '/classrooms/google-courses',
            null,
            { Authorization: 'Bearer invalid-token' },
        );
        expect(status).toBe(401);
    });

    test('POST /classrooms/google-import — 無効なトークンで 401', async () => {
        const { status } = await request(
            'POST',
            '/classrooms/google-import',
            { courseId: 'test-course-id' },
            {
                Authorization: 'Bearer invalid-token',
                'X-Google-Access-Token': 'invalid-access-token',
            },
        );
        expect(status).toBe(401);
    });
});

// ---------------------------------------------------------------------------
// 生徒フロー（認証不要エンドポイント）
// ---------------------------------------------------------------------------
describe('生徒フロー — バリデーションエラー', () => {
    test('POST /classrooms/lookup — 空のコードで 400', async () => {
        const { status, data } = await request('POST', '/classrooms/lookup', {
            joinCode: '',
        });
        expect(status).toBe(400);
        expect(data.error).toBeDefined();
    });

    test('POST /classrooms/lookup — 不正な形式のコードで 400', async () => {
        const { status, data } = await request('POST', '/classrooms/lookup', {
            joinCode: 'abc', // 3文字（6文字必要）
        });
        expect(status).toBe(400);
        expect(data.error).toBeDefined();
    });

    test('POST /classrooms/lookup — 存在しないコードで 404', async () => {
        const { status, data } = await request('POST', '/classrooms/lookup', {
            joinCode: 'ZZZZZZ',
        });
        expect(status).toBe(404);
        expect(data.error).toBeDefined();
    });

    test('POST /classrooms/join — 空のコードで 400', async () => {
        const { status } = await request('POST', '/classrooms/join', {
            joinCode: '',
            seatNumber: 1,
            nickname: 'テスト',
        });
        expect(status).toBe(400);
    });

    test('POST /classrooms/join — 存在しないコードで 404', async () => {
        const { status } = await request('POST', '/classrooms/join', {
            joinCode: 'ZZZZZZ',
            seatNumber: 1,
            nickname: 'テスト',
        });
        expect(status).toBe(404);
    });
});

// ---------------------------------------------------------------------------
// セッション検証
// ---------------------------------------------------------------------------
describe('セッション検証', () => {
    test('POST /classrooms/verify-session — Authorization なしで 401', async () => {
        const { status } = await request('POST', '/classrooms/verify-session');
        expect(status).toBe(401);
    });

    test('POST /classrooms/verify-session — 無効なトークンで 401', async () => {
        const { status, data } = await request(
            'POST',
            '/classrooms/verify-session',
            null,
            { Authorization: 'Bearer invalid-session-token' },
        );
        expect(status).toBe(401);
        expect(data.error).toBeDefined();
    });
});

// ---------------------------------------------------------------------------
// 提出エンドポイント — 認証エラー
// ---------------------------------------------------------------------------
describe('提出エンドポイント — 認証エラー', () => {
    test('POST /classrooms/{id}/submissions — Authorization なしで 401', async () => {
        const { status } = await request(
            'POST',
            '/classrooms/dummy-id/submissions',
            { projectName: 'テスト' },
        );
        expect(status).toBe(401);
    });

    test('GET /classrooms/{id}/submissions — 無効なトークンで 401', async () => {
        const { status } = await request(
            'GET',
            '/classrooms/dummy-id/submissions',
            null,
            { Authorization: 'Bearer invalid-token' },
        );
        expect(status).toBe(401);
    });
});

// ---------------------------------------------------------------------------
// 課題コンテンツエンドポイント — 認証エラー
// ---------------------------------------------------------------------------
describe('課題コンテンツエンドポイント — 認証エラー', () => {
    test('PUT /classrooms/{id}/assignment — Authorization なしで 401', async () => {
        const { status } = await request('PUT', '/classrooms/dummy-id/assignment', {
            pages: [{ text: 'test' }],
        });
        expect(status).toBe(401);
    });

    test('GET /classrooms/{id}/assignment — Authorization なしで 401', async () => {
        const { status } = await request('GET', '/classrooms/dummy-id/assignment');
        expect(status).toBe(401);
    });

    test('GET /classrooms/{id}/assignment — 無効なセッショントークンで 404/401', async () => {
        const { status } = await request('GET', '/classrooms/dummy-id/assignment', null, {
            Authorization: 'Bearer invalid-session-token',
        });
        // 存在しないクラスは 404（存在秘匿）、実在クラスなら 401
        expect([401, 404]).toContain(status);
    });
});

// ---------------------------------------------------------------------------
// 課題コンテンツ — 教師/生徒フルフロー（DEV_BYPASS_TOKEN があるときのみ実行）
// ---------------------------------------------------------------------------
(DEV_BYPASS_TOKEN ? describe : describe.skip)('課題コンテンツ — フルフロー', () => {
    const teacherAuth = { Authorization: `Bearer ${DEV_BYPASS_TOKEN}` };
    let classroomId = '';
    let joinCode = '';
    let sessionToken = '';

    beforeAll(async () => {
        const { status, data } = await request(
            'POST',
            '/classrooms',
            {
                className: '結合テスト(assignment)',
                assignmentName: '課題配信テスト',
                studentCount: 3,
            },
            teacherAuth,
        );
        expect(status).toBe(201);
        classroomId = data.classroomId as string;
        joinCode = data.joinCode as string;
    });

    afterAll(async () => {
        if (classroomId) {
            await request('DELETE', `/classrooms/${classroomId}`, null, teacherAuth);
        }
    });

    test('課題未設定の GET は assignment: null（教師）', async () => {
        const { status, data } = await request(
            'GET',
            `/classrooms/${classroomId}/assignment`,
            null,
            teacherAuth,
        );
        expect(status).toBe(200);
        expect(data.assignment).toBeNull();
    });

    test('PUT で課題を設定し、Presigned upload URL が返る', async () => {
        const { status, data } = await request(
            'PUT',
            `/classrooms/${classroomId}/assignment`,
            {
                pages: [
                    { text: 'ねこを動かそう' },
                    { text: '画像つきページ', newImage: 'image/png' },
                ],
                newStarter: true,
            },
            teacherAuth,
        );
        expect(status).toBe(200);
        const assignment = data.assignment as Record<string, unknown>;
        const pages = assignment.pages as Record<string, unknown>[];
        expect(pages).toHaveLength(2);
        expect(pages[1].imageKey).toContain(`${classroomId}/assignment/image-`);
        expect(assignment.starterKey).toContain(`${classroomId}/assignment/starter-`);
        const imageUploadUrls = data.imageUploadUrls as (string | null)[];
        expect(imageUploadUrls[0]).toBeNull();
        expect(typeof imageUploadUrls[1]).toBe('string');
        expect(typeof data.starterUploadUrl).toBe('string');

        // Presigned URL に実際にアップロードする（1x1 PNG / ダミー sb3）
        const pngBytes = Buffer.from(
            'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
            'base64',
        );
        const imgRes = await fetch(imageUploadUrls[1] as string, {
            method: 'PUT',
            headers: { 'Content-Type': 'image/png' },
            body: pngBytes,
        });
        expect(imgRes.status).toBe(200);
        const sb3Res = await fetch(data.starterUploadUrl as string, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/octet-stream' },
            body: Buffer.from('PKdummy-sb3'),
        });
        expect(sb3Res.status).toBe(200);
    });

    test('lookup が hasAssignment: true を返す', async () => {
        const { status, data } = await request('POST', '/classrooms/lookup', { joinCode });
        expect(status).toBe(200);
        expect(data.hasAssignment).toBe(true);
    });

    test('join が hasAssignment: true を返し、生徒が課題を取得できる', async () => {
        const joinRes = await request('POST', '/classrooms/join', {
            joinCode,
            seatNumber: 1,
        });
        expect(joinRes.status).toBe(200);
        expect(joinRes.data.hasAssignment).toBe(true);
        sessionToken = joinRes.data.sessionToken as string;

        const { status, data } = await request(
            'GET',
            `/classrooms/${classroomId}/assignment`,
            null,
            { Authorization: `Bearer ${sessionToken}` },
        );
        expect(status).toBe(200);
        const assignment = data.assignment as Record<string, unknown>;
        const pages = assignment.pages as Record<string, unknown>[];
        expect(pages).toHaveLength(2);
        expect(pages[0].text).toBe('ねこを動かそう');
        expect(pages[0].imageUrl).toBeNull();
        expect(typeof pages[1].imageUrl).toBe('string');
        expect(typeof assignment.starterUrl).toBe('string');

        // 生徒がダウンロード URL から実際に取得できる
        const dl = await fetch(assignment.starterUrl as string);
        expect(dl.status).toBe(200);
    });

    test('verify-session が hasAssignment: true を返す', async () => {
        const { status, data } = await request('POST', '/classrooms/verify-session', null, {
            Authorization: `Bearer ${sessionToken}`,
        });
        expect(status).toBe(200);
        expect(data.hasAssignment).toBe(true);
    });

    test('別クラスの生徒セッションでは課題を取得できない (401)', async () => {
        // 同じ教師でもう1クラス作り、その生徒セッションで最初のクラスの課題を読む
        const other = await request(
            'POST',
            '/classrooms',
            { className: '結合テスト(assignment-他クラス)', assignmentName: 'x', studentCount: 2 },
            teacherAuth,
        );
        expect(other.status).toBe(201);
        try {
            const otherJoin = await request('POST', '/classrooms/join', {
                joinCode: other.data.joinCode as string,
                seatNumber: 1,
            });
            expect(otherJoin.status).toBe(200);
            const { status } = await request(
                'GET',
                `/classrooms/${classroomId}/assignment`,
                null,
                { Authorization: `Bearer ${otherJoin.data.sessionToken as string}` },
            );
            expect(status).toBe(401);
        } finally {
            await request('DELETE', `/classrooms/${other.data.classroomId as string}`, null, teacherAuth);
        }
    });

    test('keepStarter でページだけ更新でき、既存スターターが残る', async () => {
        const before = await request('GET', `/classrooms/${classroomId}/assignment`, null, teacherAuth);
        const beforeStarterKey = (before.data.assignment as Record<string, unknown>).starterKey;

        const { status, data } = await request(
            'PUT',
            `/classrooms/${classroomId}/assignment`,
            { pages: [{ text: '更新後のページ' }], keepStarter: true },
            teacherAuth,
        );
        expect(status).toBe(200);
        const assignment = data.assignment as Record<string, unknown>;
        expect((assignment.pages as unknown[]).length).toBe(1);
        expect(assignment.starterKey).toBe(beforeStarterKey);
    });

    test('空 body の PUT で課題がクリアされる', async () => {
        const { status, data } = await request(
            'PUT',
            `/classrooms/${classroomId}/assignment`,
            {},
            teacherAuth,
        );
        expect(status).toBe(200);
        expect(data.assignment).toBeNull();

        const after = await request('GET', `/classrooms/${classroomId}/assignment`, null, teacherAuth);
        expect(after.data.assignment).toBeNull();

        const lookup = await request('POST', '/classrooms/lookup', { joinCode });
        expect(lookup.data.hasAssignment).toBe(false);
    });
});

// ---------------------------------------------------------------------------
// AI 評価 — 実 Claude 呼び出し（DEV_BYPASS_TOKEN があるときのみ実行）
// ---------------------------------------------------------------------------
(DEV_BYPASS_TOKEN ? describe : describe.skip)('AI 評価 — フルフロー', () => {
    const teacherAuth = { Authorization: `Bearer ${DEV_BYPASS_TOKEN}` };
    let classroomId = '';

    const submissions = [
        {
            seatNumber: 1,
            signals: { wiredScriptCount: 1, usesLoops: true, totalBlocks: 6 },
            pseudocode:
                '=== スプライト: ねこ ===\n◆ スクリプト:\n    緑の旗が押されたとき\n    ずっと\n        10 歩動かす\n        もし端に着いたら、跳ね返る',
        },
        {
            seatNumber: 2,
            signals: { wiredScriptCount: 0, totalBlocks: 1 },
            pseudocode: '=== スプライト: ねこ ===\n◇ スクリプト:\n    10 歩動かす',
        },
    ];

    beforeAll(async () => {
        const { status, data } = await request(
            'POST',
            '/classrooms',
            { className: '結合テスト(AI評価)', assignmentName: 'ねこを動かそう', studentCount: 3 },
            teacherAuth,
        );
        expect(status).toBe(201);
        classroomId = data.classroomId as string;
    });

    afterAll(async () => {
        if (classroomId) await request('DELETE', `/classrooms/${classroomId}`, null, teacherAuth);
    });

    test('grade モード: S/A/B/C + 根拠 + needsReview が返る', async () => {
        const { status, data } = await request(
            'POST',
            `/classrooms/${classroomId}/evaluate`,
            {
                mode: 'grade',
                assignmentName: 'ねこを動かそう',
                assignmentText: 'ねこが動き続けるプログラムを作ろう',
                rubricAxes: [
                    { name: '動くこと', description: 'イベントに接続されて実行される（◆）' },
                    { name: '繰り返しの活用', description: 'ずっと/繰り返すブロックを使っている' },
                ],
                strictness: 'standard',
                samples: [],
                submissions,
            },
            teacherAuth,
        );
        expect(status).toBe(200);
        const results = data.results as Record<string, unknown>[];
        expect(results).toHaveLength(2);
        for (const result of results) {
            expect(['S', 'A', 'B', 'C']).toContain(result.grade);
            expect(typeof result.reason).toBe('string');
            expect(typeof result.needsReview).toBe('boolean');
        }
        // 席2 は未接続（◇のみ）なので 席1 より良い評価にはならないはず
        const seat1 = results.find((r) => r.seatNumber === 1);
        const seat2 = results.find((r) => r.seatNumber === 2);
        expect(seat1).toBeDefined();
        expect(seat2).toBeDefined();
        const order = ['C', 'B', 'A', 'S'];
        expect(order.indexOf((seat2 as Record<string, unknown>).grade as string)).toBeLessThanOrEqual(
            order.indexOf((seat1 as Record<string, unknown>).grade as string),
        );
    }, 60000);

    test('comment モード: 生徒向けポジティブコメントが返る', async () => {
        const { status, data } = await request(
            'POST',
            `/classrooms/${classroomId}/evaluate`,
            {
                mode: 'comment',
                assignmentName: 'ねこを動かそう',
                assignmentText: '',
                rubricAxes: [],
                strictness: 'standard',
                samples: [],
                submissions: [submissions[0]],
            },
            teacherAuth,
        );
        expect(status).toBe(200);
        const results = data.results as Record<string, unknown>[];
        expect(results).toHaveLength(1);
        expect(typeof results[0].comment).toBe('string');
        expect((results[0].comment as string).length).toBeGreaterThan(10);
    }, 60000);

    test('バリデーション: mode 不正は 400、認証なしは 401', async () => {
        const bad = await request(
            'POST',
            `/classrooms/${classroomId}/evaluate`,
            { mode: 'rank', submissions },
            teacherAuth,
        );
        expect(bad.status).toBe(400);
        const noAuth = await request('POST', `/classrooms/${classroomId}/evaluate`, {
            mode: 'grade',
            submissions,
        });
        expect(noAuth.status).toBe(401);
    });
});

// ---------------------------------------------------------------------------
// 組 (グループ) — フルフロー（DEV_BYPASS_TOKEN があるときのみ実行）
// ---------------------------------------------------------------------------
(DEV_BYPASS_TOKEN ? describe : describe.skip)('組 (グループ) — フルフロー', () => {
    const teacherAuth = { Authorization: `Bearer ${DEV_BYPASS_TOKEN}` };
    let groupId = '';
    let firstClassroomId = '';
    let firstJoinCode = '';
    let secondClassroomId = '';
    let secondJoinCode = '';
    let duplicatedClassroomId = '';

    afterAll(async () => {
        for (const id of [firstClassroomId, secondClassroomId, duplicatedClassroomId]) {
            if (id) await request('DELETE', `/classrooms/${id}`, null, teacherAuth);
        }
        if (groupId) {
            await request('PATCH', `/classroom-groups/${groupId}`, { status: 'archived' }, teacherAuth);
        }
    });

    test('POST /classroom-groups — 組を作成できる', async () => {
        const { status, data } = await request(
            'POST',
            '/classroom-groups',
            { name: '結合テスト2年1組', year: 2026 },
            teacherAuth,
        );
        expect(status).toBe(201);
        expect(data.name).toBe('結合テスト2年1組');
        expect(data.year).toBe(2026);
        expect(data.status).toBe('active');
        groupId = data.groupId as string;
    });

    test('GET /classroom-groups — 一覧に作成した組が含まれる', async () => {
        const { status, data } = await request('GET', '/classroom-groups', null, teacherAuth);
        expect(status).toBe(200);
        const groups = data.groups as Record<string, unknown>[];
        expect(groups.some((g) => g.groupId === groupId)).toBe(true);
    });

    test('POST /classrooms — groupId 付きでクラスを作成できる', async () => {
        const { status, data } = await request(
            'POST',
            '/classrooms',
            { className: '結合テスト2年1組', assignmentName: '第1回', studentCount: 3, groupId },
            teacherAuth,
        );
        expect(status).toBe(201);
        expect(data.groupId).toBe(groupId);
        firstClassroomId = data.classroomId as string;
        firstJoinCode = data.joinCode as string;
    });

    test('存在しない groupId でのクラス作成は 404', async () => {
        const { status } = await request(
            'POST',
            '/classrooms',
            { className: 'x', assignmentName: 'x', studentCount: 2, groupId: 'no-such-group' },
            teacherAuth,
        );
        expect(status).toBe(404);
    });

    test('前回コメント: 第1回で返却コメント→第2回 join で previousComment が返る', async () => {
        // 生徒が第1回に参加して提出
        const join1 = await request('POST', '/classrooms/join', { joinCode: firstJoinCode, seatNumber: 2 });
        expect(join1.status).toBe(200);
        expect(join1.data.previousComment).toBeNull();
        const sub = await request(
            'POST',
            `/classrooms/${firstClassroomId}/submissions`,
            { projectName: '第1回作品' },
            { Authorization: `Bearer ${join1.data.sessionToken as string}` },
        );
        expect(sub.status).toBe(201);

        // 先生が返却コメント
        const ret = await request(
            'PATCH',
            `/classrooms/${firstClassroomId}/submissions/${sub.data.submissionId as string}`,
            { status: 'returned', teacherComment: '音をイベントにつなげられたね！' },
            teacherAuth,
        );
        expect(ret.status).toBe(200);

        // 第2回のクラスを同じ組に作成し、同じ席で join
        const create2 = await request(
            'POST',
            '/classrooms',
            { className: '結合テスト2年1組', assignmentName: '第2回', studentCount: 3, groupId },
            teacherAuth,
        );
        expect(create2.status).toBe(201);
        secondClassroomId = create2.data.classroomId as string;
        secondJoinCode = create2.data.joinCode as string;

        const join2 = await request('POST', '/classrooms/join', { joinCode: secondJoinCode, seatNumber: 2 });
        expect(join2.status).toBe(200);
        const prev = join2.data.previousComment as Record<string, unknown>;
        expect(prev).not.toBeNull();
        expect(prev.teacherComment).toBe('音をイベントにつなげられたね！');
        expect(prev.assignmentName).toBe('第1回');

        // 別の席で join した場合は前回コメントなし
        const join3 = await request('POST', '/classrooms/join', { joinCode: secondJoinCode, seatNumber: 3 });
        expect(join3.status).toBe(200);
        expect(join3.data.previousComment).toBeNull();
    });

    test('POST /classrooms/{id}/duplicate — 課題ごと複製できる', async () => {
        // 第1回に課題を付けてから複製
        const setAssign = await request(
            'PUT',
            `/classrooms/${firstClassroomId}/assignment`,
            { pages: [{ text: '複製テストページ' }] },
            teacherAuth,
        );
        expect(setAssign.status).toBe(200);

        const { status, data } = await request(
            'POST',
            `/classrooms/${firstClassroomId}/duplicate`,
            { groupId, assignmentName: '第1回(翌年度)' },
            teacherAuth,
        );
        expect(status).toBe(201);
        expect(data.groupId).toBe(groupId);
        expect(data.hasAssignment).toBe(true);
        expect(data.joinCode).not.toBe(firstJoinCode);
        duplicatedClassroomId = data.classroomId as string;

        // 複製先の課題が読める（ページ内容が引き継がれている）
        const dup = await request('GET', `/classrooms/${duplicatedClassroomId}/assignment`, null, teacherAuth);
        expect(dup.status).toBe(200);
        const pages = (dup.data.assignment as Record<string, unknown>).pages as Record<string, unknown>[];
        expect(pages[0].text).toBe('複製テストページ');
    });

    test('PATCH /classroom-groups/{id} — リネームとアーカイブ', async () => {
        const rename = await request(
            'PATCH',
            `/classroom-groups/${groupId}`,
            { name: '結合テスト2年1組(改)' },
            teacherAuth,
        );
        expect(rename.status).toBe(200);
        expect(rename.data.name).toBe('結合テスト2年1組(改)');

        const archive = await request(
            'PATCH',
            `/classroom-groups/${groupId}`,
            { status: 'archived' },
            teacherAuth,
        );
        expect(archive.status).toBe(200);
        expect(archive.data.status).toBe('archived');
    });
});

// ---------------------------------------------------------------------------
// CORS
// ---------------------------------------------------------------------------
describe('CORS', () => {
    test('OPTIONS プリフライトが正しい CORS ヘッダーを返す', async () => {
        const url = `${ENDPOINT}/classrooms`;
        const res = await fetch(url, {
            method: 'OPTIONS',
            headers: {
                Origin: 'https://smalruby.jp',
                'Access-Control-Request-Method': 'GET',
                'Access-Control-Request-Headers': 'Authorization,X-Google-Access-Token',
            },
        });
        expect(res.status).toBe(204);
        expect(res.headers.get('access-control-allow-origin')).toBe('https://smalruby.jp');
        expect(res.headers.get('access-control-allow-headers')).toContain('x-google-access-token');
    });

    test('許可されていないオリジンからの CORS プリフライト', async () => {
        const url = `${ENDPOINT}/classrooms`;
        const res = await fetch(url, {
            method: 'OPTIONS',
            headers: {
                Origin: 'https://evil.example.com',
                'Access-Control-Request-Method': 'GET',
            },
        });
        // API Gateway は 204 を返すが、Allow-Origin は許可リストの先頭
        expect(res.status).toBe(204);
        const allowOrigin = res.headers.get('access-control-allow-origin');
        expect(allowOrigin).not.toBe('https://evil.example.com');
    });
});

// ---------------------------------------------------------------------------
// 404
// ---------------------------------------------------------------------------
describe('存在しないルート', () => {
    test('GET /nonexistent — 404', async () => {
        const { status } = await request('GET', '/nonexistent');
        expect(status).toBe(404);
    });
});

// ---------------------------------------------------------------------------
// 教師フロー（GOOGLE_ID_TOKEN が設定されている場合のみ実行）
// ---------------------------------------------------------------------------
const describeIfToken = GOOGLE_ID_TOKEN ? describe : describe.skip;
const teacherHeaders = { Authorization: `Bearer ${GOOGLE_ID_TOKEN}` };

describeIfToken('教師フロー — クラス CRUD', () => {
    let classroomId: string;
    let joinCode: string;

    test('POST /classrooms — クラス作成（className + assignmentName）', async () => {
        const { status, data } = await request(
            'POST',
            '/classrooms',
            { className: 'Integration Test クラス', assignmentName: 'テスト課題', studentCount: 5 },
            teacherHeaders,
        );
        expect(status).toBe(201);
        expect(data.classroomId).toBeDefined();
        expect(data.className).toBe('Integration Test クラス');
        expect(data.assignmentName).toBe('テスト課題');
        expect(data.studentCount).toBe(5);
        expect(data.joinCode).toBeDefined();
        classroomId = data.classroomId as string;
        joinCode = data.joinCode as string;
    });

    test('GET /classrooms — クラス一覧に assignmentName が含まれる', async () => {
        const { status, data } = await request('GET', '/classrooms', null, teacherHeaders);
        expect(status).toBe(200);
        const classrooms = data.classrooms as Array<{ classroomId: string; assignmentName: string | null }>;
        const found = classrooms.find(c => c.classroomId === classroomId);
        expect(found).toBeDefined();
        expect(found!.assignmentName).toBe('テスト課題');
    });

    test('GET /classrooms/{id} — クラス詳細に assignmentName が含まれる', async () => {
        const { status, data } = await request(
            'GET',
            `/classrooms/${classroomId}`,
            null,
            teacherHeaders,
        );
        expect(status).toBe(200);
        expect(data.className).toBe('Integration Test クラス');
        expect(data.assignmentName).toBe('テスト課題');
        expect(data.studentCount).toBe(5);
    });

    test('PATCH /classrooms/{id} — assignmentName を更新', async () => {
        const { status, data } = await request(
            'PATCH',
            `/classrooms/${classroomId}`,
            { assignmentName: '更新後の課題名' },
            teacherHeaders,
        );
        expect(status).toBe(200);
        expect(data.assignmentName).toBe('更新後の課題名');
    });

    test('GET /classrooms/{id} — 更新後の assignmentName を確認', async () => {
        const { status, data } = await request(
            'GET',
            `/classrooms/${classroomId}`,
            null,
            teacherHeaders,
        );
        expect(status).toBe(200);
        expect(data.assignmentName).toBe('更新後の課題名');
    });

    test('POST /classrooms — googleClassroomCourseId 付きで作成', async () => {
        const { status, data } = await request(
            'POST',
            '/classrooms',
            {
                className: 'GC Import Test',
                assignmentName: 'GC 課題',
                studentCount: 10,
                googleClassroomCourseId: 'test-course-123',
            },
            teacherHeaders,
        );
        expect(status).toBe(201);
        expect(data.googleClassroomCourseId).toBe('test-course-123');

        // Clean up
        await request('DELETE', `/classrooms/${data.classroomId}`, null, teacherHeaders);
    });

    test('GET /classrooms/{id}/members — メンバー一覧（空）', async () => {
        const { status, data } = await request(
            'GET',
            `/classrooms/${classroomId}/members`,
            null,
            teacherHeaders,
        );
        expect(status).toBe(200);
        expect(data.members).toEqual([]);
        expect(data.studentCount).toBe(5);
    });

    // --- 生徒参加 → 提出 → 返却 の E2E フロー ---
    let sessionToken: string;

    test('POST /classrooms/lookup — 参加コードで検索（className/assignmentName は含まない）', async () => {
        const { status, data } = await request('POST', '/classrooms/lookup', {
            joinCode,
        });
        expect(status).toBe(200);
        expect(data.classroomId).toBe(classroomId);
        expect(data.className).toBeUndefined();
        expect(data.assignmentName).toBeUndefined();
        expect(data.studentCount).toBeDefined();
        expect(data.takenSeats).toEqual([]);
    });

    test('POST /classrooms/join — 生徒参加（assignmentName を含む）', async () => {
        const { status, data } = await request('POST', '/classrooms/join', {
            joinCode,
            seatNumber: 1,
            nickname: 'テスト生徒',
        });
        expect(status).toBe(200);
        expect(data.sessionToken).toBeDefined();
        expect(data.seatNumber).toBe(1);
        expect(data.assignmentName).toBe('更新後の課題名');
        sessionToken = data.sessionToken as string;
    });

    test('POST /classrooms/verify-session — セッション検証', async () => {
        const { status, data } = await request(
            'POST',
            '/classrooms/verify-session',
            null,
            { Authorization: `Bearer ${sessionToken}` },
        );
        expect(status).toBe(200);
        expect(data.valid).toBe(true);
    });

    test('POST /classrooms/{id}/submissions — 提出（presigned URL 取得）', async () => {
        const { status, data } = await request(
            'POST',
            `/classrooms/${classroomId}/submissions`,
            { projectName: 'テストプロジェクト', screenshotCount: 1 },
            { Authorization: `Bearer ${sessionToken}` },
        );
        expect(status).toBe(201);
        expect(data.uploadUrl).toBeDefined();
        expect(data.thumbnailUploadUrl).toBeDefined();
        expect(data.screenshotUploadUrls).toBeDefined();
        expect((data.screenshotUploadUrls as string[]).length).toBe(1);
    });

    test('GET /classrooms/{id}/submissions — 教師が提出一覧を確認', async () => {
        const { status, data } = await request(
            'GET',
            `/classrooms/${classroomId}/submissions`,
            null,
            teacherHeaders,
        );
        expect(status).toBe(200);
        const submissions = data.submissions as Array<{
            memberId: string;
            projectName: string;
            status: string;
        }>;
        expect(submissions.length).toBeGreaterThanOrEqual(1);
        const sub = submissions.find(s => s.memberId === 'seat-01');
        expect(sub).toBeDefined();
        expect(sub!.projectName).toBe('テストプロジェクト');
        expect(sub!.status).toBe('submitted');
    });

    test('PATCH /classrooms/{id}/submissions/{subId} — 返却', async () => {
        // Get submission ID first
        const listRes = await request(
            'GET',
            `/classrooms/${classroomId}/submissions`,
            null,
            teacherHeaders,
        );
        const submissions = listRes.data.submissions as Array<{
            submissionId: string;
            memberId: string;
        }>;
        const sub = submissions.find(s => s.memberId === 'seat-01');
        expect(sub).toBeDefined();

        const { status, data } = await request(
            'PATCH',
            `/classrooms/${classroomId}/submissions/${sub!.submissionId}`,
            { teacherComment: 'よくできました', status: 'returned' },
            teacherHeaders,
        );
        expect(status).toBe(200);
        expect(data.teacherComment).toBe('よくできました');
    });

    test('POST /classrooms/verify-session — 返却状態が反映される', async () => {
        const { status, data } = await request(
            'POST',
            '/classrooms/verify-session',
            null,
            { Authorization: `Bearer ${sessionToken}` },
        );
        expect(status).toBe(200);
        const submission = data.submission as { status: string; teacherComment: string } | null;
        expect(submission).toBeDefined();
        expect(submission!.status).toBe('returned');
        expect(submission!.teacherComment).toBe('よくできました');
    });

    test('DELETE /classrooms/{id}/members/me — 生徒退出', async () => {
        const { status } = await request(
            'DELETE',
            `/classrooms/${classroomId}/members/me`,
            null,
            { Authorization: `Bearer ${sessionToken}` },
        );
        expect(status).toBe(204);
    });

    // Cleanup
    test('DELETE /classrooms/{id} — クラス削除', async () => {
        const { status } = await request(
            'DELETE',
            `/classrooms/${classroomId}`,
            null,
            teacherHeaders,
        );
        expect(status).toBe(204);
    });
});

// ---------------------------------------------------------------------------
// 教師フロー — 強制退室 (kick) と verify-session の reason 透過
// ---------------------------------------------------------------------------
describeIfToken('教師フロー — 強制退室 (kick) と verify-session の reason 透過', () => {
    let classroomId: string;
    let joinCode: string;
    let sessionTokenA: string;
    let memberIdA: string;

    test('セットアップ: クラス作成', async () => {
        const { status, data } = await request(
            'POST',
            '/classrooms',
            { className: 'Kick Test クラス', assignmentName: 'Kick 課題', studentCount: 5 },
            teacherHeaders,
        );
        expect(status).toBe(201);
        classroomId = data.classroomId as string;
        joinCode = data.joinCode as string;
    });

    test('セットアップ: 生徒A が席1で参加', async () => {
        const { status, data } = await request('POST', '/classrooms/join', {
            joinCode,
            seatNumber: 1,
            nickname: '生徒A',
        });
        expect(status).toBe(200);
        sessionTokenA = data.sessionToken as string;
        memberIdA = data.memberId as string;
    });

    test('生徒A の verify-session は 200', async () => {
        const { status } = await request('POST', '/classrooms/verify-session', null, {
            Authorization: `Bearer ${sessionTokenA}`,
        });
        expect(status).toBe(200);
    });

    test('教師が生徒A を kick (DELETE /classrooms/{id}/members/{memberId}) → 204', async () => {
        const { status } = await request(
            'DELETE',
            `/classrooms/${classroomId}/members/${memberIdA}`,
            null,
            teacherHeaders,
        );
        expect(status).toBe(204);
    });

    test('生徒A の verify-session は 410 reason=kicked + joinCode/className/seatNumber を返す', async () => {
        const { status, data } = await request('POST', '/classrooms/verify-session', null, {
            Authorization: `Bearer ${sessionTokenA}`,
        });
        expect(status).toBe(410);
        expect(data.reason).toBe('kicked');
        expect(data.joinCode).toBe(joinCode);
        expect(data.className).toBe('Kick Test クラス');
        expect(data.seatNumber).toBe(1);
    });

    test('kick された席はメンバー一覧 (listMembers) には出てこない', async () => {
        const { status, data } = await request(
            'GET',
            `/classrooms/${classroomId}/members`,
            null,
            teacherHeaders,
        );
        expect(status).toBe(200);
        const members = data.members as Array<{ memberId: string }>;
        expect(members.find(m => m.memberId === memberIdA)).toBeUndefined();
    });

    test('kick された席は lookup の takenSeats に含まれない (席が空く)', async () => {
        const { status, data } = await request('POST', '/classrooms/lookup', { joinCode });
        expect(status).toBe(200);
        const takenSeats = data.takenSeats as number[];
        expect(takenSeats).not.toContain(1);
    });

    test('別の生徒B が同じ席1で join できる (kicked 行が上書きされる)', async () => {
        const { status, data } = await request('POST', '/classrooms/join', {
            joinCode,
            seatNumber: 1,
            nickname: '生徒B',
        });
        expect(status).toBe(200);
        expect(data.seatNumber).toBe(1);
        expect(data.sessionToken).toBeDefined();
        expect(data.sessionToken).not.toBe(sessionTokenA);
    });

    test('上書き後、元の sessionToken (A) は 401 になる (tombstone は B の join で消滅)', async () => {
        const { status } = await request('POST', '/classrooms/verify-session', null, {
            Authorization: `Bearer ${sessionTokenA}`,
        });
        expect(status).toBe(401);
    });

    // Cleanup
    test('クリーンアップ: クラス削除', async () => {
        const { status } = await request(
            'DELETE',
            `/classrooms/${classroomId}`,
            null,
            teacherHeaders,
        );
        expect(status).toBe(204);
    });
});

// ---------------------------------------------------------------------------
// 教師フロー — 退室リクエスト (kick request)
// ---------------------------------------------------------------------------
describeIfToken('教師フロー — 退室リクエスト (kick request)', () => {
    let classroomId: string;
    let joinCode: string;
    let sessionTokenA: string;
    let requestId: string;
    let request2Id: string;

    test('セットアップ: クラス作成', async () => {
        const { status, data } = await request(
            'POST',
            '/classrooms',
            { className: 'Kick Request Test', assignmentName: '退室依頼テスト', studentCount: 5 },
            teacherHeaders,
        );
        expect(status).toBe(201);
        classroomId = data.classroomId as string;
        joinCode = data.joinCode as string;
    });

    test('セットアップ: 生徒A が席1で参加', async () => {
        const { status, data } = await request('POST', '/classrooms/join', {
            joinCode,
            seatNumber: 1,
            nickname: '生徒A',
        });
        expect(status).toBe(200);
        sessionTokenA = data.sessionToken as string;
    });

    test('GET /classrooms/{id}/kick-requests — 初期状態は空', async () => {
        const { status, data } = await request(
            'GET',
            `/classrooms/${classroomId}/kick-requests`,
            null,
            teacherHeaders,
        );
        expect(status).toBe(200);
        expect(data.requests).toEqual([]);
    });

    test('POST /classrooms/lookup/kick-request — joinCode + seatNumber でリクエスト送信 (認証不要)', async () => {
        const { status, data } = await request('POST', '/classrooms/lookup/kick-request', {
            joinCode,
            seatNumber: 1,
            reason: 'これは私の席です',
        });
        expect(status).toBe(201);
        expect(data.requestId).toBeDefined();
        expect(data.classroomId).toBe(classroomId);
        expect(data.seatNumber).toBe(1);
        requestId = data.requestId as string;
    });

    test('POST /classrooms/lookup/kick-request — 不正な joinCode で 404', async () => {
        const { status } = await request('POST', '/classrooms/lookup/kick-request', {
            joinCode: 'zzzzzz',
            seatNumber: 1,
        });
        expect(status).toBe(404);
    });

    test('POST /classrooms/lookup/kick-request — 範囲外の seatNumber で 400', async () => {
        const { status } = await request('POST', '/classrooms/lookup/kick-request', {
            joinCode,
            seatNumber: 99,
        });
        expect(status).toBe(400);
    });

    test('GET /classrooms/{id}/kick-requests — リクエスト 1 件返る (reason 付き)', async () => {
        const { status, data } = await request(
            'GET',
            `/classrooms/${classroomId}/kick-requests`,
            null,
            teacherHeaders,
        );
        expect(status).toBe(200);
        const requests = data.requests as Array<{
            requestId: string;
            seatNumber: number;
            reason: string | null;
            createdAt: string;
        }>;
        expect(requests).toHaveLength(1);
        expect(requests[0].requestId).toBe(requestId);
        expect(requests[0].seatNumber).toBe(1);
        expect(requests[0].reason).toBe('これは私の席です');
    });

    test('POST /classrooms/lookup/kick-request — 同じ席に対する 2 回目のリクエストは別レコードとして許可される (abuse 規制なし、複数件許可仕様)', async () => {
        const { status, data } = await request('POST', '/classrooms/lookup/kick-request', {
            joinCode,
            seatNumber: 1,
        });
        expect(status).toBe(201);
        expect(data.requestId).toBeDefined();
        expect(data.requestId).not.toBe(requestId);
        request2Id = data.requestId as string;
    });

    test('GET /classrooms/{id}/kick-requests — リクエスト 2 件返る', async () => {
        const { status, data } = await request(
            'GET',
            `/classrooms/${classroomId}/kick-requests`,
            null,
            teacherHeaders,
        );
        expect(status).toBe(200);
        const requests = data.requests as Array<{ requestId: string }>;
        expect(requests.map(r => r.requestId).sort()).toEqual([requestId, request2Id].sort());
    });

    test('DELETE /classrooms/{id}/kick-requests/{requestId} — 教師が却下 → リクエスト削除のみでメンバー残る', async () => {
        const { status } = await request(
            'DELETE',
            `/classrooms/${classroomId}/kick-requests/${request2Id}`,
            null,
            teacherHeaders,
        );
        expect(status).toBe(204);

        // 却下後: リクエストは 1 件に減る
        const list = await request(
            'GET',
            `/classrooms/${classroomId}/kick-requests`,
            null,
            teacherHeaders,
        );
        const requests = list.data.requests as Array<{ requestId: string }>;
        expect(requests.map(r => r.requestId)).toEqual([requestId]);

        // メンバー A はまだ参加中 (kick されていない)
        const verifyA = await request('POST', '/classrooms/verify-session', null, {
            Authorization: `Bearer ${sessionTokenA}`,
        });
        expect(verifyA.status).toBe(200);
    });

    test('POST /classrooms/{id}/kick-requests/{requestId}/approve — 教師が承認 → 該当メンバー kick + リクエスト削除', async () => {
        const { status } = await request(
            'POST',
            `/classrooms/${classroomId}/kick-requests/${requestId}/approve`,
            null,
            teacherHeaders,
        );
        expect(status).toBe(204);

        // 承認後: リクエスト一覧は空
        const list = await request(
            'GET',
            `/classrooms/${classroomId}/kick-requests`,
            null,
            teacherHeaders,
        );
        expect(list.data.requests).toEqual([]);

        // メンバー A の verify-session は 410 reason=kicked を返す (Phase 1 と同じ挙動)
        const verifyA = await request('POST', '/classrooms/verify-session', null, {
            Authorization: `Bearer ${sessionTokenA}`,
        });
        expect(verifyA.status).toBe(410);
        expect(verifyA.data.reason).toBe('kicked');
    });

    test('POST /classrooms/lookup — activeKickRequestIds に未承認/未却下のリクエスト ID が含まれる', async () => {
        // セットアップ: A は既に kick 済み (前のテストで承認された) → 新しい状況を作るため
        // B を新しい席に参加させて kick request を作る
        const joinB = await request('POST', '/classrooms/join', {
            joinCode,
            seatNumber: 4,
            nickname: 'B-for-active-ids',
        });
        expect(joinB.status).toBe(200);

        const reqC = await request('POST', '/classrooms/lookup/kick-request', {
            joinCode,
            seatNumber: 4,
        });
        expect(reqC.status).toBe(201);
        const reqId = reqC.data.requestId as string;

        const lookup = await request('POST', '/classrooms/lookup', { joinCode });
        expect(lookup.status).toBe(200);
        expect(lookup.data.activeKickRequestIds).toEqual(expect.arrayContaining([reqId]));

        // 却下 → activeKickRequestIds から消える
        const rejectRes = await request(
            'DELETE',
            `/classrooms/${classroomId}/kick-requests/${reqId}`,
            null,
            teacherHeaders,
        );
        expect(rejectRes.status).toBe(204);

        const lookup2 = await request('POST', '/classrooms/lookup', { joinCode });
        expect(lookup2.data.activeKickRequestIds).not.toContain(reqId);
    });

    test('POST /classrooms/lookup/kick-request — kick 済みの席に対するリクエストは席が空くので拒否される (404 — 席に占有者なし)', async () => {
        const { status } = await request('POST', '/classrooms/lookup/kick-request', {
            joinCode,
            seatNumber: 1,
        });
        expect(status).toBe(404);
    });

    test('認証エラー: 生徒がリクエスト一覧を見ようとすると 401', async () => {
        const { status } = await request(
            'GET',
            `/classrooms/${classroomId}/kick-requests`,
            null,
            { Authorization: `Bearer ${sessionTokenA}` },
        );
        expect(status).toBe(401);
    });

    test('認証エラー: 生徒が承認エンドポイントを叩こうとすると 401', async () => {
        const { status } = await request(
            'POST',
            `/classrooms/${classroomId}/kick-requests/anything/approve`,
            null,
            { Authorization: `Bearer ${sessionTokenA}` },
        );
        expect(status).toBe(401);
    });

    test('認証エラー: 別教師トークンで kick-requests を見ようとすると 401', async () => {
        // 別 teacherSub をシミュレートできないので、無効トークンで代替
        const { status } = await request(
            'GET',
            `/classrooms/${classroomId}/kick-requests`,
            null,
            { Authorization: 'Bearer invalid-teacher-token' },
        );
        expect(status).toBe(401);
    });

    // Cleanup
    test('クリーンアップ: クラス削除', async () => {
        const { status } = await request('DELETE', `/classrooms/${classroomId}`, null, teacherHeaders);
        expect(status).toBe(204);
    });
});

// ---------------------------------------------------------------------------
// データモデル v2 — migration・トピック・クラス人数（DEV_BYPASS_TOKEN 必須）
// ---------------------------------------------------------------------------
(DEV_BYPASS_TOKEN ? describe : describe.skip)('v2 移行とトピック — フルフロー', () => {
    const teacherAuth = { Authorization: `Bearer ${DEV_BYPASS_TOKEN}` };
    const marker = `v2移行 ${Date.now().toString().slice(-6)}`;
    let ungroupedClassroomId = '';
    let migratedGroupId = '';
    let topicClassroomId = '';
    let joinCode = '';

    test('v1 相当のクラス無し課題を作成できる', async () => {
        const { status, data } = await request('POST', '/classrooms', {
            className: marker,
            assignmentName: 'ねこを動かそう',
            studentCount: 5,
        }, teacherAuth);
        expect(status).toBe(201);
        ungroupedClassroomId = data.classroomId as string;
        joinCode = data.joinCode as string;
        expect(data.groupId).toBeNull();
    });

    test('migrate が className からクラスを自動作成して課題を割り当てる', async () => {
        const { status, data } = await request('POST', '/classroom-groups/migrate', {}, teacherAuth);
        expect(status).toBe(200);
        expect(data.schemaVersion).toBe(2);
        expect(data.assignedClassrooms as number).toBeGreaterThanOrEqual(1);

        const groups = await request('GET', '/classroom-groups', null, teacherAuth);
        const created = (groups.data.groups as Record<string, unknown>[]).find(g => g.name === marker);
        expect(created).toBeDefined();
        expect(created!.schemaVersion).toBe(2);
        expect(created!.studentCount).toBe(5);
        migratedGroupId = created!.groupId as string;

        const classroom = await request('GET', `/classrooms/${ungroupedClassroomId}`, null, teacherAuth);
        expect(classroom.data.groupId).toBe(migratedGroupId);
    });

    test('migrate は冪等（同名クラスを重複作成しない）', async () => {
        const { status } = await request('POST', '/classroom-groups/migrate', {}, teacherAuth);
        expect(status).toBe(200);
        const groups = await request('GET', '/classroom-groups', null, teacherAuth);
        const sameName = (groups.data.groups as Record<string, unknown>[]).filter(g => g.name === marker);
        expect(sameName).toHaveLength(1);
    });

    test('トピックを追加でき、課題作成時の新規トピックはクラスへ自動追加される', async () => {
        const add = await request('PATCH', `/classroom-groups/${migratedGroupId}/topics`, {
            action: 'add',
            name: '単元A',
        }, teacherAuth);
        expect(add.status).toBe(200);
        expect(add.data.topics).toContain('単元A');

        const create = await request('POST', '/classrooms', {
            className: marker,
            assignmentName: 'トピック課題',
            groupId: migratedGroupId,
            topic: '単元B',
            sortDate: '2026-07-01T00:00:00Z',
        }, teacherAuth);
        expect(create.status).toBe(201);
        expect(create.data.topic).toBe('単元B');
        // studentCount 省略時はクラスから継承される
        expect(create.data.studentCount).toBe(5);
        topicClassroomId = create.data.classroomId as string;

        const groups = await request('GET', '/classroom-groups', null, teacherAuth);
        const group = (groups.data.groups as Record<string, unknown>[]).find(g => g.groupId === migratedGroupId);
        expect(group!.topics).toEqual(expect.arrayContaining(['単元A', '単元B']));
    });

    test('トピックの rename が課題側へ追従する', async () => {
        const rename = await request('PATCH', `/classroom-groups/${migratedGroupId}/topics`, {
            action: 'rename',
            name: '単元B',
            to: '単元C',
        }, teacherAuth);
        expect(rename.status).toBe(200);
        expect(rename.data.topics).toContain('単元C');
        expect(rename.data.topics).not.toContain('単元B');

        const classroom = await request('GET', `/classrooms/${topicClassroomId}`, null, teacherAuth);
        expect(classroom.data.topic).toBe('単元C');
    });

    test('トピックの remove で課題側のトピックが外れる', async () => {
        const remove = await request('PATCH', `/classroom-groups/${migratedGroupId}/topics`, {
            action: 'remove',
            name: '単元C',
        }, teacherAuth);
        expect(remove.status).toBe(200);

        const classroom = await request('GET', `/classrooms/${topicClassroomId}`, null, teacherAuth);
        expect(classroom.data.topic).toBeNull();
    });

    test('クラスの人数が生徒の lookup に反映される（増加方向）', async () => {
        const update = await request('PATCH', `/classroom-groups/${migratedGroupId}`, {
            studentCount: 8,
        }, teacherAuth);
        expect(update.status).toBe(200);

        const lookup = await request('POST', '/classrooms/lookup', { joinCode });
        expect(lookup.status).toBe(200);
        expect(lookup.data.studentCount).toBe(8);
    });

    test('セクションを設定・クリアでき、classYear が生徒の lookup に載る', async () => {
        const withSection = await request('PATCH', `/classroom-groups/${migratedGroupId}`, {
            section: '2年1組',
        }, teacherAuth);
        expect(withSection.status).toBe(200);
        expect(withSection.data.section).toBe('2年1組');

        const lookup = await request('POST', '/classrooms/lookup', { joinCode });
        expect(lookup.status).toBe(200);
        expect(lookup.data.classYear as number).toBeGreaterThanOrEqual(2020);
        expect(lookup.data.className).toBe(marker);

        const cleared = await request('PATCH', `/classroom-groups/${migratedGroupId}`, {
            section: null,
        }, teacherAuth);
        expect(cleared.data.section).toBeNull();
    });

    test('複製が topic を引き継ぎ、対象クラスのトピック一覧にも追加される', async () => {
        await request('PATCH', `/classroom-groups/${migratedGroupId}/topics`, {
            action: 'add',
            name: '複製元トピック',
        }, teacherAuth);
        await request('PATCH', `/classrooms/${topicClassroomId}`, { topic: '複製元トピック' }, teacherAuth);

        const dup = await request('POST', `/classrooms/${topicClassroomId}/duplicate`, {
            groupId: migratedGroupId,
            assignmentName: '複製された課題',
        }, teacherAuth);
        expect(dup.status).toBe(201);
        expect(dup.data.topic).toBe('複製元トピック');
        // cleanup the duplicate right away
        await request('DELETE', `/classrooms/${dup.data.classroomId}`, null, teacherAuth);
    });

    test('クリーンアップ: 課題削除 + クラスをアーカイブ', async () => {
        for (const id of [ungroupedClassroomId, topicClassroomId]) {
            const { status } = await request('DELETE', `/classrooms/${id}`, null, teacherAuth);
            expect(status).toBe(204);
        }
        const archive = await request('PATCH', `/classroom-groups/${migratedGroupId}`, {
            status: 'archived',
        }, teacherAuth);
        expect(archive.status).toBe(200);
    });
});
