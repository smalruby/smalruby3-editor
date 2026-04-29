/**
 * smalruby-api / cors-proxy 結合テスト
 *
 * 任意の URL を中継するプロキシ。
 * - text/json はそのまま返す
 * - バイナリは base64 エンコードして isBase64Encoded=true で返す
 *   (HTTP API v2 + Lambda の構造化レスポンス互換)
 * - Google Drive URL は uc?export=download 形式に自動変換
 * - リダイレクト追従
 * - 不正な URL スキームはエラー
 */

const ENDPOINT = process.env.SMALRUBY_API_ENDPOINT || '';

const proxy = async (url: string) => {
    const params = new URLSearchParams({ url });
    return fetch(`${ENDPOINT}/cors-proxy?${params}`);
};

beforeAll(() => {
    if (!ENDPOINT) {
        throw new Error(
            'SMALRUBY_API_ENDPOINT が設定されていません。\n' +
                '.env.stg に SMALRUBY_API_ENDPOINT=https://stg.api.smalruby.app を追加してください。',
        );
    }
});

describe('GET /cors-proxy', () => {
    test('url パラメータが無いと 400', async () => {
        const res = await fetch(`${ENDPOINT}/cors-proxy`);
        expect(res.status).toBe(400);
        const data = (await res.json()) as Record<string, unknown>;
        expect(data.code).toBe('Bad Request');
    });

    test('テキストコンテンツをそのまま中継する', async () => {
        // Scratch project の json を直接取りに行く (公開済みの軽いデータ)
        // → application/json なのでテキストとしてそのまま返るはず
        const r = await proxy('https://api.scratch.mit.edu/projects/1209008277');
        expect(r.status).toBe(200);
        const text = await r.text();
        const json = JSON.parse(text) as Record<string, unknown>;
        expect(json.id).toBe(1209008277);
    });

    test('PNG など画像は base64 エンコードされて返る (binary content)', async () => {
        // 軽量のテスト用 PNG (Scratch のサムネイル画像)
        const imageUrl = 'https://cdn2.scratch.mit.edu/get_image/project/1209008277_100x80.png';
        const r = await proxy(imageUrl);
        expect(r.status).toBe(200);
        // Lambda の isBase64Encoded を API Gateway が解釈するため、
        // クライアント側ではバイナリとして受け取れる (Content-Type: image/png)
        expect(r.headers.get('content-type')).toMatch(/^image\/png/);
        const buf = Buffer.from(await r.arrayBuffer());
        // PNG マジックナンバーを検証 (89 50 4E 47 0D 0A 1A 0A)
        expect(buf[0]).toBe(0x89);
        expect(buf[1]).toBe(0x50);
        expect(buf[2]).toBe(0x4e);
        expect(buf[3]).toBe(0x47);
    });

    test('不正な URL スキーム (file://) は 500 エラー', async () => {
        const r = await proxy('file:///etc/passwd');
        expect(r.status).toBe(500);
        const data = (await r.json()) as Record<string, unknown>;
        expect(data.code).toBe('Internal Server Error');
        expect(data.message as string).toMatch(/Invalid URL scheme/i);
    });

    test('CORS preflight (OPTIONS) は 204', async () => {
        const res = await fetch(`${ENDPOINT}/cors-proxy`, {
            method: 'OPTIONS',
            headers: {
                Origin: 'https://smalruby.app',
                'Access-Control-Request-Method': 'GET',
            },
        });
        expect(res.status).toBe(204);
        expect(res.headers.get('access-control-allow-origin')).toBe('https://smalruby.app');
    });
});
