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
 */

const ENDPOINT = process.env.CLASSROOM_API_ENDPOINT || '';

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
