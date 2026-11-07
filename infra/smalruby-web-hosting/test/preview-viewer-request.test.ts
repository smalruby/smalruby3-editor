import * as fs from 'fs';
import * as path from 'path';

// CloudFront Functions の実コードをそのまま評価して試す（ランタイムは cloudfront-js-2.0）。
const code = fs.readFileSync(
    path.join(__dirname, '../lib/functions/preview-viewer-request.js'),
    'utf8',
);
// eslint-disable-next-line @typescript-eslint/no-implied-eval
const handler = new Function(`${code}\nreturn handler;`)() as (event: unknown) => any;

const request = (uri: string, querystring: Record<string, unknown> = {}) =>
    handler({ request: { method: 'GET', uri, querystring, headers: {} } });

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
});
