import * as fs from 'fs';
import * as path from 'path';

// CloudFront Functions の実コードをそのまま評価して試す（ランタイムは cloudfront-js-2.0）。
const code = fs.readFileSync(path.join(__dirname, '../lib/functions/site-viewer-request.js'), 'utf8');
// eslint-disable-next-line @typescript-eslint/no-implied-eval
const loaded = new Function(`${code}\nreturn { handler, SITE_DIRECTORIES };`)() as {
    handler: (event: unknown) => any;
    SITE_DIRECTORIES: string[];
};
const { handler, SITE_DIRECTORIES } = loaded;

const request = (uri: string, querystring: Record<string, unknown> = {}) =>
    handler({ request: { method: 'GET', uri, querystring, headers: {} } });

const REPO_ROOT = path.join(__dirname, '../../..');

describe('smalruby.app viewer-request function', () => {
    test('resolves / and directories to index.html', () => {
        expect(request('/').uri).toBe('/index.html');
        expect(request('/admin/').uri).toBe('/admin/index.html');
        expect(request('/foo/').uri).toBe('/foo/index.html');
    });

    test('serves /<page> as /<page>.html like GitHub Pages (no redirect)', () => {
        for (const page of ['about', 'privacy-policy', 'terms-of-service', 'mesh-self-sensor']) {
            const res = request(`/${page}`);
            expect(res.statusCode).toBeUndefined();
            expect(res.uri).toBe(`/${page}.html`);
        }
    });

    test('keeps the query string on rewrite (CloudFront forwards it as is)', () => {
        const res = request('/about', { lang: { value: 'ja' } });
        expect(res.uri).toBe('/about.html');
        expect(res.querystring).toEqual({ lang: { value: 'ja' } });
    });

    test('redirects directories with index.html to the trailing-slash URL', () => {
        for (const dir of ['admin', 'assignments']) {
            const res = request(`/${dir}`);
            expect(res.statusCode).toBe(301);
            expect(res.headers.location.value).toBe(`/${dir}/`);
        }
    });

    test('keeps the query string on redirect', () => {
        const res = request('/admin', {
            a: { value: '1' },
            f: { value: 'a', multiValue: [{ value: 'a' }, { value: 'b c' }] },
        });
        expect(res.headers.location.value).toBe('/admin/?a=1&f=a&f=b%20c');
    });

    test('passes files with an extension through unchanged', () => {
        expect(request('/x.js').uri).toBe('/x.js');
        expect(request('/about.html').uri).toBe('/about.html');
        expect(request('/gui.0123abcd.js').uri).toBe('/gui.0123abcd.js');
        expect(request('/.well-known/microsoft-identity-association.json').uri).toBe(
            '/.well-known/microsoft-identity-association.json',
        );
        expect(request('/admin/admin.0123abcd.js').uri).toBe('/admin/admin.0123abcd.js');
    });

    test('passes nested extensionless files through unchanged', () => {
        // assignments/LICENSE のように、下の階層には拡張子の無いファイルがある。
        expect(request('/assignments/LICENSE').uri).toBe('/assignments/LICENSE');
        expect(request('/chunks/mediapipe').uri).toBe('/chunks/mediapipe');
    });

    test('never redirects to another host (no protocol-relative Location)', () => {
        expect(request('//admin').headers.location.value).toBe('/admin/');
        expect(request('/\\admin').headers.location.value).toBe('/admin/');
        expect(request('//evil.example/x').uri).toBe('//evil.example/x');
        expect(request('//evil.example/x').statusCode).toBeUndefined();
        expect(request('//about').uri).toBe('/about.html');
    });

    test('lists every top-level directory the build serves with an index.html', () => {
        // 本番に出すもの: scratch-gui のビルド（pages/ と legal/ は `.` へコピー）、
        // リポジトリの assignments/（smalruby.app/assignments/）、packages/admin（smalruby.app/admin/）。
        const found = new Set<string>();
        for (const dir of ['packages/scratch-gui/pages', 'packages/scratch-gui/legal']) {
            for (const entry of fs.readdirSync(path.join(REPO_ROOT, dir), { withFileTypes: true })) {
                if (entry.isDirectory() && fs.existsSync(path.join(REPO_ROOT, dir, entry.name, 'index.html'))) {
                    found.add(entry.name);
                }
            }
        }
        if (fs.existsSync(path.join(REPO_ROOT, 'assignments/index.html'))) {
            found.add('assignments');
        }
        if (fs.existsSync(path.join(REPO_ROOT, 'packages/admin/webpack.config.js'))) {
            found.add('admin');
        }
        expect([...found].sort()).toEqual([...SITE_DIRECTORIES].sort());
    });

    test('pages/ and legal/ only ship top-level .html pages', () => {
        // `.html` を補うのはトップレベルだけなので、下の階層にページがあると開けない。
        const nested: string[] = [];
        const walk = (base: string, rel: string) => {
            for (const entry of fs.readdirSync(path.join(base, rel), { withFileTypes: true })) {
                const child = path.join(rel, entry.name);
                if (entry.isDirectory()) walk(base, child);
                else if (rel !== '' && entry.name.endsWith('.html')) nested.push(child);
            }
        };
        for (const dir of ['packages/scratch-gui/pages', 'packages/scratch-gui/legal']) {
            walk(path.join(REPO_ROOT, dir), '');
        }
        expect(nested).toEqual([]);
    });
});
