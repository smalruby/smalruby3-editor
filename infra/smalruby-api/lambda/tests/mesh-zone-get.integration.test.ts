/**
 * smalruby-api / mesh-domain 結合テスト
 *
 * sourceIp + 環境変数 MESH_ZONE_SECRET_KEY から CRC32 で導出した
 * 16進数文字列が `domain` として返されることを検証する。
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

describe('GET /mesh-domain', () => {
    test('domain が 16 進数文字列で返る', async () => {
        const res = await fetch(`${ENDPOINT}/mesh-domain`);
        expect(res.status).toBe(200);
        const data = (await res.json()) as Record<string, unknown>;
        expect(typeof data.domain).toBe('string');
        expect(data.domain).toMatch(/^[0-9a-f]+$/);
    });

    test('連続呼び出しで同じ source IP からは同じ domain が返る (CRC32 決定性)', async () => {
        const r1 = await (await fetch(`${ENDPOINT}/mesh-domain`)).json();
        const r2 = await (await fetch(`${ENDPOINT}/mesh-domain`)).json();
        expect((r1 as Record<string, unknown>).domain).toBe(
            (r2 as Record<string, unknown>).domain,
        );
    });

    test('CORS preflight (OPTIONS) は 204', async () => {
        const res = await fetch(`${ENDPOINT}/mesh-domain`, {
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
