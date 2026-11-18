import * as fs from 'fs';
import * as path from 'path';

// CloudFront Functions の実コードをそのまま評価して試す（ランタイムは cloudfront-js-2.0）。
const code = fs.readFileSync(
    path.join(__dirname, '../lib/functions/preview-viewer-response.js'),
    'utf8',
);
// eslint-disable-next-line @typescript-eslint/no-implied-eval
const handler = new Function(`${code}\nreturn handler;`)() as (event: unknown) => any;

const respond = (headers: Record<string, { value: string }> = {}) =>
    handler({
        request: { method: 'GET', uri: '/my-branch/gui.js.br', querystring: {}, headers: {} },
        response: { statusCode: 200, statusDescription: 'OK', headers },
    });

describe('preview viewer-response function', () => {
    test.each(['br', 'gzip'])('adds Vary: Accept-Encoding to Content-Encoding: %s', (enc) => {
        const res = respond({ 'content-encoding': { value: enc } });
        expect(res.headers['vary']).toEqual({ value: 'Accept-Encoding' });
    });

    test('does not add Vary to responses without Content-Encoding', () => {
        expect(respond().headers['vary']).toBeUndefined();
    });

    test('does not duplicate Accept-Encoding in Vary', () => {
        const res = respond({
            'content-encoding': { value: 'br' },
            vary: { value: 'Origin, Accept-Encoding' },
        });
        expect(res.headers['vary']).toEqual({ value: 'Origin, Accept-Encoding' });
    });

    test('keeps the preview headers as they are (no HSTS / nosniff)', () => {
        const res = respond({
            'content-encoding': { value: 'br' },
            'cache-control': { value: 'max-age=0, s-maxage=60' },
        });
        expect(res.statusCode).toBe(200);
        expect(res.headers['cache-control']).toEqual({ value: 'max-age=0, s-maxage=60' });
        expect(res.headers['strict-transport-security']).toBeUndefined();
        expect(res.headers['x-content-type-options']).toBeUndefined();
    });
});
