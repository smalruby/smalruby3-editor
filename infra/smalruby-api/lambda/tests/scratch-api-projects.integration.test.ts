/**
 * smalruby-api / scratch-api-proxy/projects/{projectId} 結合テスト
 *
 * 実際にデプロイされたエンドポイント (デフォルトは stg) に対して
 * HTTP リクエストを送信し、ステータスコード透過とレスポンス内容を検証する。
 *
 * このエンドポイントは [Scratch API](https://api.scratch.mit.edu) の
 * `/projects/{id}` をそのまま中継するシンプルなプロキシ。旧 SAM 実装は
 * 常に 200 を返すバグを持っていたため、ステータスコード透過の確認が
 * このテストの主目的。Issue #573 の回帰防止。
 *
 * 実行方法:
 *   docker compose run --rm -w /app/infra/smalruby-api infra npm run test:integration
 *
 * 必要な環境変数 (.env で設定):
 *   SMALRUBY_API_ENDPOINT=https://stg.api.smalruby.app
 */

const ENDPOINT = process.env.SMALRUBY_API_ENDPOINT || '';

interface JsonResponse {
    status: number;
    body: Record<string, unknown> | string;
    headers: Record<string, string>;
}

const get = async (path: string, init?: RequestInit): Promise<JsonResponse> => {
    const res = await fetch(`${ENDPOINT}${path}`, init);
    const text = await res.text();
    let body: Record<string, unknown> | string;
    try {
        body = JSON.parse(text) as Record<string, unknown>;
    } catch {
        body = text;
    }
    const headers: Record<string, string> = {};
    res.headers.forEach((v, k) => {
        headers[k.toLowerCase()] = v;
    });
    return { status: res.status, body, headers };
};

beforeAll(() => {
    if (!ENDPOINT) {
        throw new Error(
            'SMALRUBY_API_ENDPOINT が設定されていません。\n' +
                '.env.stg に SMALRUBY_API_ENDPOINT=https://stg.api.smalruby.app を追加してください。',
        );
    }
});

describe('GET /scratch-api-proxy/projects/{projectId}', () => {
    test('公開プロジェクトは 200 + project_token を含む JSON', async () => {
        const { status, body } = await get('/scratch-api-proxy/projects/1209008277');
        expect(status).toBe(200);
        expect(typeof body).toBe('object');
        const json = body as Record<string, unknown>;
        expect(json.id).toBe(1209008277);
        expect(typeof json.project_token).toBe('string');
        expect((json.project_token as string).length).toBeGreaterThan(0);
    });

    test('存在しない / 共有解除されたプロジェクトは 404 (旧実装は 200 を返したバグ)', async () => {
        const { status, body } = await get('/scratch-api-proxy/projects/9999999999');
        expect(status).toBe(404);
        expect(typeof body).toBe('object');
        const json = body as Record<string, unknown>;
        expect(json.code).toBe('NotFound');
    });

    test('Content-Type は application/json で透過される', async () => {
        const { headers } = await get('/scratch-api-proxy/projects/1209008277');
        expect(headers['content-type']).toMatch(/application\/json/);
    });

    test('CORS preflight (OPTIONS) は 204 + CORS ヘッダー', async () => {
        const res = await fetch(`${ENDPOINT}/scratch-api-proxy/projects/1209008277`, {
            method: 'OPTIONS',
            headers: {
                Origin: 'http://localhost:8601',
                'Access-Control-Request-Method': 'GET',
            },
        });
        expect(res.status).toBe(204);
        expect(res.headers.get('access-control-allow-origin')).toBe('http://localhost:8601');
        expect(res.headers.get('access-control-allow-methods')?.toUpperCase()).toContain('GET');
    });

    test('許可されていない Origin は CORS ヘッダーを返さない', async () => {
        const res = await fetch(`${ENDPOINT}/scratch-api-proxy/projects/1209008277`, {
            method: 'OPTIONS',
            headers: {
                Origin: 'https://evil.example.com',
                'Access-Control-Request-Method': 'GET',
            },
        });
        // HTTP API v2 は許可されない origin に対しては Access-Control-Allow-Origin を返さない
        expect(res.headers.get('access-control-allow-origin')).not.toBe('https://evil.example.com');
    });
});
