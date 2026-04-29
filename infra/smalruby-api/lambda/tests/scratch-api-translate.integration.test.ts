/**
 * smalruby-api / scratch-api-proxy/translate 結合テスト
 *
 * 実際にデプロイされた stg エンドポイントに対し、Scratch translate サービスへの
 * 中継動作を検証する。
 */

const ENDPOINT = process.env.SMALRUBY_API_ENDPOINT || '';

beforeAll(() => {
    if (!ENDPOINT) {
        throw new Error(
            'SMALRUBY_API_ENDPOINT が設定されていません。\n' +
                '.env.stg に SMALRUBY_API_ENDPOINT=https://stg.api.smalruby.app を追加してください。',
        );
    }
});

describe('GET /scratch-api-proxy/translate', () => {
    test('language と text を渡すと翻訳結果が返る', async () => {
        const params = new URLSearchParams({ language: 'ja', text: 'hello' });
        const res = await fetch(`${ENDPOINT}/scratch-api-proxy/translate?${params}`);
        expect(res.status).toBe(200);
        const data = (await res.json()) as Record<string, unknown>;
        expect(typeof data.result).toBe('string');
        expect((data.result as string).length).toBeGreaterThan(0);
    });

    test('language が無いと 400 (バリデーションエラー)', async () => {
        const res = await fetch(`${ENDPOINT}/scratch-api-proxy/translate`);
        expect(res.status).toBe(400);
        const data = (await res.json()) as Record<string, unknown>;
        expect(data.code).toBe('BadRequest');
    });

    test('text が空でも language があれば 200', async () => {
        const params = new URLSearchParams({ language: 'ja', text: '' });
        const res = await fetch(`${ENDPOINT}/scratch-api-proxy/translate?${params}`);
        expect(res.status).toBe(200);
    });

    test('特殊文字が URL エンコードされて渡される', async () => {
        const params = new URLSearchParams({
            language: 'ja',
            text: 'hello & goodbye',
        });
        const res = await fetch(`${ENDPOINT}/scratch-api-proxy/translate?${params}`);
        expect(res.status).toBe(200);
        const data = (await res.json()) as Record<string, unknown>;
        expect(typeof data.result).toBe('string');
    });

    test('CORS preflight (OPTIONS) は 204 + CORS ヘッダー', async () => {
        const res = await fetch(`${ENDPOINT}/scratch-api-proxy/translate`, {
            method: 'OPTIONS',
            headers: {
                Origin: 'http://localhost:8601',
                'Access-Control-Request-Method': 'GET',
            },
        });
        expect(res.status).toBe(204);
        expect(res.headers.get('access-control-allow-origin')).toBe('http://localhost:8601');
    });
});
