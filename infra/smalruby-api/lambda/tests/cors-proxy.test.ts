import { handler } from '../cors-proxy';

const mockFetch = jest.fn();
global.fetch = mockFetch as unknown as typeof fetch;

const event = (qs?: Record<string, string>) =>
    ({
        queryStringParameters: qs,
    }) as never;

beforeEach(() => {
    mockFetch.mockReset();
});

describe('cors-proxy handler', () => {
    test('returns 400 when url is missing', async () => {
        const res = await handler(event({}));
        expect(res.statusCode).toBe(400);
        const body = JSON.parse(res.body as string);
        expect(body.code).toBe('Bad Request');
        expect(mockFetch).not.toHaveBeenCalled();
    });

    test('proxies text content as-is', async () => {
        mockFetch.mockResolvedValueOnce(
            new Response('Hello world', {
                status: 200,
                headers: { 'content-type': 'text/plain; charset=utf-8' },
            }),
        );

        const res = await handler(event({ url: 'https://example.com/foo.txt' }));
        expect(res.statusCode).toBe(200);
        expect(res.body).toBe('Hello world');
        expect(res.isBase64Encoded).toBe(false);
    });

    test('proxies JSON as text', async () => {
        mockFetch.mockResolvedValueOnce(
            new Response('{"a":1}', {
                status: 200,
                headers: { 'content-type': 'application/json' },
            }),
        );

        const res = await handler(event({ url: 'https://example.com/foo.json' }));
        expect(res.statusCode).toBe(200);
        expect(res.body).toBe('{"a":1}');
        expect(res.isBase64Encoded).toBe(false);
    });

    test('base64-encodes binary content', async () => {
        const buf = Buffer.from([0x89, 0x50, 0x4e, 0x47]); // PNG header
        mockFetch.mockResolvedValueOnce(
            new Response(buf, {
                status: 200,
                headers: { 'content-type': 'image/png' },
            }),
        );

        const res = await handler(event({ url: 'https://example.com/x.png' }));
        expect(res.statusCode).toBe(200);
        expect(res.isBase64Encoded).toBe(true);
        expect(Buffer.from(res.body as string, 'base64')).toEqual(buf);
    });

    test('converts Google Drive file URL to direct download URL', async () => {
        mockFetch.mockResolvedValueOnce(
            new Response('content', {
                status: 200,
                headers: { 'content-type': 'text/plain' },
            }),
        );

        const driveUrl = 'https://drive.google.com/file/d/abc123_-/view';
        await handler(event({ url: driveUrl }));
        expect(mockFetch).toHaveBeenCalledWith(
            'https://drive.google.com/uc?export=download&id=abc123_-',
            expect.any(Object),
        );
    });

    test('follows redirects (Location header)', async () => {
        mockFetch
            .mockResolvedValueOnce(
                new Response(null, { status: 302, headers: { location: 'https://final.example.com/x' } }),
            )
            .mockResolvedValueOnce(
                new Response('final', {
                    status: 200,
                    headers: { 'content-type': 'text/plain' },
                }),
            );

        const res = await handler(event({ url: 'https://start.example.com/x' }));
        expect(res.statusCode).toBe(200);
        expect(res.body).toBe('final');
        expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    test('returns 500 on fetch error', async () => {
        mockFetch.mockRejectedValueOnce(new Error('network down'));
        const res = await handler(event({ url: 'https://example.com/x' }));
        expect(res.statusCode).toBe(500);
        const body = JSON.parse(res.body as string);
        expect(body.code).toBe('Internal Server Error');
    });

    test('rejects non-http(s) URL schemes', async () => {
        const res = await handler(event({ url: 'file:///etc/passwd' }));
        expect(res.statusCode).toBe(500);
        const body = JSON.parse(res.body as string);
        expect(body.message).toContain('Invalid URL scheme');
        expect(mockFetch).not.toHaveBeenCalled();
    });
});
