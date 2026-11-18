import * as fs from 'fs';
import * as path from 'path';

// CloudFront Functions の実コードをそのまま評価して試す（ランタイムは cloudfront-js-2.0）。
const code = fs.readFileSync(
    path.join(__dirname, '../lib/functions/site-viewer-response.js'),
    'utf8',
);
// eslint-disable-next-line @typescript-eslint/no-implied-eval
const handler = new Function(`${code}\nreturn handler;`)() as (event: unknown) => any;

const respond = (headers: Record<string, { value: string }> = {}) =>
    handler({
        request: { method: 'GET', uri: '/index.html', querystring: {}, headers: {} },
        response: { statusCode: 200, statusDescription: 'OK', headers },
    });

describe('site viewer-response function', () => {
    // 以前のレスポンスヘッダーポリシー（SiteResponseHeaders）が返していた値と同じ。
    test('adds HSTS for 365 days without includeSubDomains or preload', () => {
        expect(respond().headers['strict-transport-security']).toEqual({
            value: 'max-age=31536000',
        });
    });

    test('adds X-Content-Type-Options: nosniff', () => {
        expect(respond().headers['x-content-type-options']).toEqual({ value: 'nosniff' });
    });

    test('overrides the values from the origin', () => {
        const res = respond({
            'strict-transport-security': { value: 'max-age=60; includeSubDomains' },
            'x-content-type-options': { value: 'bogus' },
        });
        expect(res.headers['strict-transport-security']).toEqual({ value: 'max-age=31536000' });
        expect(res.headers['x-content-type-options']).toEqual({ value: 'nosniff' });
    });

    test('keeps the other headers and the status', () => {
        const res = respond({ 'cache-control': { value: 'max-age=0, s-maxage=60' } });
        expect(res.statusCode).toBe(200);
        expect(res.headers['cache-control']).toEqual({ value: 'max-age=0, s-maxage=60' });
    });

    test('does not add headers that would block embedding smalruby.app in an iframe', () => {
        const res = respond();
        expect(res.headers['x-frame-options']).toBeUndefined();
        expect(res.headers['content-security-policy']).toBeUndefined();
    });

    describe('Vary for the pre-compressed gui JS', () => {
        test.each(['br', 'gzip'])('adds Vary: Accept-Encoding to Content-Encoding: %s', (enc) => {
            const res = respond({ 'content-encoding': { value: enc } });
            expect(res.headers['vary']).toEqual({ value: 'Accept-Encoding' });
            expect(res.headers['content-encoding']).toEqual({ value: enc });
            // HSTS / nosniff はそのまま付く
            expect(res.headers['strict-transport-security']).toEqual({ value: 'max-age=31536000' });
            expect(res.headers['x-content-type-options']).toEqual({ value: 'nosniff' });
        });

        test('does not add Vary to responses without Content-Encoding', () => {
            expect(respond().headers['vary']).toBeUndefined();
        });

        test('does not duplicate Accept-Encoding in Vary', () => {
            const res = respond({
                'content-encoding': { value: 'br' },
                vary: { value: 'accept-encoding' },
            });
            expect(res.headers['vary']).toEqual({ value: 'accept-encoding' });
        });

        test('appends Accept-Encoding to the other Vary values', () => {
            const res = respond({
                'content-encoding': { value: 'gzip' },
                vary: { value: 'Origin' },
            });
            expect(res.headers['vary']).toEqual({ value: 'Origin, Accept-Encoding' });
        });
    });
});
