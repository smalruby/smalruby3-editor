import * as fs from 'fs';
import * as path from 'path';

// CloudFront Functions の実コードをそのまま評価して試す（ランタイムは cloudfront-js-2.0）。
const code = fs.readFileSync(
    path.join(__dirname, '../lib/functions/preview-viewer-request.js'),
    'utf8',
);
// eslint-disable-next-line @typescript-eslint/no-implied-eval
const handler = new Function(`${code}\nreturn handler;`)() as (event: unknown) => any;

const request = (
    uri: string,
    querystring: Record<string, unknown> = {},
    headers: Record<string, unknown> = {},
) => handler({ request: { method: 'GET', uri, querystring, headers } });

// ビューアの Accept-Encoding を付けて gui の JS などを要求する。
const withEncoding = (uri: string, value?: string) =>
    request(uri, {}, value === undefined ? {} : { 'accept-encoding': { value } }).uri;

describe('preview viewer-request function', () => {
    test('resolves /<slug>/ to index.html', () => {
        expect(request('/my-branch/').uri).toBe('/my-branch/index.html');
    });

    test('resolves nested directories /<slug>/x/ to index.html', () => {
        expect(request('/my-branch/x/').uri).toBe('/my-branch/x/index.html');
    });

    test('passes files through unchanged', () => {
        expect(request('/my-branch/gui.0123abcd.js').uri).toBe('/my-branch/gui.0123abcd.js');
        expect(request('/auth-redirect.html').uri).toBe('/auth-redirect.html');
        expect(request('/auth-redirect.js').uri).toBe('/auth-redirect.js');
    });

    test('redirects /<slug> to /<slug>/ so relative assets resolve', () => {
        const res = request('/my-branch');
        expect(res.statusCode).toBe(301);
        expect(res.headers.location.value).toBe('/my-branch/');
    });

    test('keeps the query string on redirect', () => {
        const res = request('/my-branch', {
            tab: { value: 'ruby' },
            no_beforeunload: { value: '1' },
            f: { value: 'a', multiValue: [{ value: 'a' }, { value: 'b c' }] },
        });
        expect(res.headers.location.value).toBe('/my-branch/?tab=ruby&no_beforeunload=1&f=a&f=b%20c');
    });

    test('never redirects to another host (no protocol-relative Location)', () => {
        expect(request('//evil.example/x').headers.location.value).toBe('/evil.example/x/');
        expect(request('/\\evil.example/x').headers.location.value).toBe('/evil.example/x/');
        expect(request('///evil.example/x').headers.location.value).toBe('/evil.example/x/');
    });

    describe('old language entry /ja.html', () => {
        test('redirects /ja.html to / with 301', () => {
            const res = request('/ja.html');
            expect(res.statusCode).toBe(301);
            expect(res.headers.location.value).toBe('/');
        });

        test('keeps the query string', () => {
            const res = request('/ja.html', { mesh: { value: '1' } });
            expect(res.statusCode).toBe(301);
            expect(res.headers.location.value).toBe('/?mesh=1');
        });

        test('leaves other html files and nested ja.html alone', () => {
            expect(request('/index.html').uri).toBe('/index.html');
            expect(request('/about.html').uri).toBe('/about.html');
            expect(request('/my-branch/ja.html').uri).toBe('/my-branch/ja.html');
            expect(request('/en.html').uri).toBe('/en.html');
        });
    });

    describe('pre-compressed gui JS', () => {
        const GUI_URIS = [
            '/gui.6edcb0b762080afd68f0.js', // 本番
            '/gui.js',
            '/my-branch/gui.js', // プレビュー
            '/my-branch/gui.0123abcd.js',
        ];

        test.each(GUI_URIS)('serves %s.br when the viewer accepts br', (uri) => {
            expect(withEncoding(uri, 'br')).toBe(`${uri}.br`);
            expect(withEncoding(uri, 'gzip, deflate, br, zstd')).toBe(`${uri}.br`);
        });

        test.each(GUI_URIS)('serves %s.gz when the viewer accepts only gzip', (uri) => {
            expect(withEncoding(uri, 'gzip')).toBe(`${uri}.gz`);
            expect(withEncoding(uri, 'gzip, deflate')).toBe(`${uri}.gz`);
        });

        test('prefers br over gzip whatever the order and q values', () => {
            expect(withEncoding('/gui.js', 'gzip;q=1.0, br;q=0.5')).toBe('/gui.js.br');
            expect(withEncoding('/gui.js', ' GZIP , BR ')).toBe('/gui.js.br');
        });

        test('reads q=0 as "not acceptable"', () => {
            expect(withEncoding('/gui.js', 'br;q=0, gzip')).toBe('/gui.js.gz');
            expect(withEncoding('/gui.js', 'br;q=0.0, gzip;q=0')).toBe('/gui.js');
            expect(withEncoding('/gui.js', 'gzip; q=0.001')).toBe('/gui.js.gz');
        });

        test('reads multi-value Accept-Encoding headers', () => {
            const res = request('/gui.js', {}, {
                'accept-encoding': {
                    value: 'gzip',
                    multiValue: [{ value: 'gzip' }, { value: 'br' }],
                },
            });
            expect(res.uri).toBe('/gui.js.br');
        });

        test('does not rewrite without Accept-Encoding (proxies that drop it get the plain file)', () => {
            expect(withEncoding('/gui.js')).toBe('/gui.js');
            expect(withEncoding('/my-branch/gui.js', '')).toBe('/my-branch/gui.js');
            expect(withEncoding('/my-branch/gui.js', 'identity')).toBe('/my-branch/gui.js');
            expect(withEncoding('/my-branch/gui.js', 'deflate, zstd')).toBe('/my-branch/gui.js');
            expect(withEncoding('/my-branch/gui.js', '*')).toBe('/my-branch/gui.js');
        });

        test('leaves the other files to CloudFront compression', () => {
            for (const uri of [
                '/index.html',
                '/vendors~gui.0123abcd.js',
                '/tfjs.0123abcd.js',
                '/gui.0123abcd.js.map',
                '/guide.js',
                '/my-gui.js',
                '/static/monaco/0.57.0/vs/editor-BdtEMBbM.js',
                '/my-branch/static/gui.js', // CI はトップレベルの gui の JS しか圧縮しない
                '/a/b/gui.js',
                '/gui.ABCDEF12.js', // ハッシュは小文字の 16 進
                '/gui.0123.js', // 8 文字未満はハッシュではない
                '/admin/admin.1840686ef06c6d8f7b9f.js',
            ]) {
                expect(withEncoding(uri, 'gzip, deflate, br')).toBe(uri);
            }
        });

        test('does not touch an already rewritten URI', () => {
            expect(withEncoding('/gui.js.br', 'br')).toBe('/gui.js.br');
            expect(withEncoding('/gui.js.gz', 'gzip')).toBe('/gui.js.gz');
        });

        test('keeps the directory and redirect rules regardless of Accept-Encoding', () => {
            expect(withEncoding('/', 'br')).toBe('/index.html');
            expect(withEncoding('/admin/', 'br')).toBe('/admin/index.html');
            const res = request('/admin', {}, { 'accept-encoding': { value: 'br' } });
            expect(res.statusCode).toBe(301);
            expect(res.headers.location.value).toBe('/admin/');
        });
    });
});
