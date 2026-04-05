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
    if (body && (method === 'POST' || method === 'PATCH')) {
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

    test('POST /classrooms — クラス作成', async () => {
        const { status, data } = await request(
            'POST',
            '/classrooms',
            { className: 'Integration Test クラス', studentCount: 5 },
            teacherHeaders,
        );
        expect(status).toBe(201);
        expect(data.classroomId).toBeDefined();
        expect(data.className).toBe('Integration Test クラス');
        expect(data.studentCount).toBe(5);
        expect(data.joinCode).toBeDefined();
        classroomId = data.classroomId as string;
        joinCode = data.joinCode as string;
    });

    test('GET /classrooms — クラス一覧に含まれる', async () => {
        const { status, data } = await request('GET', '/classrooms', null, teacherHeaders);
        expect(status).toBe(200);
        const classrooms = data.classrooms as Array<{ classroomId: string }>;
        expect(classrooms.some(c => c.classroomId === classroomId)).toBe(true);
    });

    test('GET /classrooms/{id} — クラス詳細', async () => {
        const { status, data } = await request(
            'GET',
            `/classrooms/${classroomId}`,
            null,
            teacherHeaders,
        );
        expect(status).toBe(200);
        expect(data.className).toBe('Integration Test クラス');
        expect(data.studentCount).toBe(5);
    });

    test('POST /classrooms — googleClassroomCourseId 付きで作成', async () => {
        const { status, data } = await request(
            'POST',
            '/classrooms',
            {
                className: 'GC Import Test',
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

    test('POST /classrooms/lookup — 参加コードで検索', async () => {
        const { status, data } = await request('POST', '/classrooms/lookup', {
            joinCode,
        });
        expect(status).toBe(200);
        expect(data.classroomId).toBe(classroomId);
        expect(data.className).toBe('Integration Test クラス');
        expect(data.takenSeats).toEqual([]);
    });

    test('POST /classrooms/join — 生徒参加', async () => {
        const { status, data } = await request('POST', '/classrooms/join', {
            joinCode,
            seatNumber: 1,
            nickname: 'テスト生徒',
        });
        expect(status).toBe(200);
        expect(data.sessionToken).toBeDefined();
        expect(data.seatNumber).toBe(1);
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
