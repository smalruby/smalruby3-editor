import { handler } from '../scratch-api-translate';

const mockFetch = jest.fn();
global.fetch = mockFetch as unknown as typeof fetch;

const event = (qs?: Record<string, string>) =>
    ({
        queryStringParameters: qs,
        requestContext: { http: { sourceIp: '1.2.3.4' } },
    }) as never;

beforeEach(() => {
    mockFetch.mockReset();
});

describe('scratch-api-translate handler', () => {
    test('returns 400 when language is missing', async () => {
        const res = await handler(event({}));
        expect(res.statusCode).toBe(400);
        const body = JSON.parse(res.body as string);
        expect(body.code).toBe('BadRequest');
        expect(mockFetch).not.toHaveBeenCalled();
    });

    test('proxies translate request with language and text', async () => {
        mockFetch.mockResolvedValueOnce(
            new Response('{"result":"こんにちは"}', {
                status: 200,
                headers: { 'content-type': 'application/json' },
            }),
        );

        const res = await handler(event({ language: 'ja', text: 'hello' }));
        expect(res.statusCode).toBe(200);
        expect(mockFetch).toHaveBeenCalledTimes(1);
        const calledUrl = mockFetch.mock.calls[0][0] as string;
        expect(calledUrl).toMatch(/^https:\/\/translate-service\.scratch\.mit\.edu\/translate\?/);
        expect(calledUrl).toContain('language=ja');
        expect(calledUrl).toContain('text=hello');
    });

    test('properly url-encodes special characters in text', async () => {
        mockFetch.mockResolvedValueOnce(
            new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } }),
        );
        await handler(event({ language: 'ja', text: 'hello world & goodbye' }));
        const calledUrl = mockFetch.mock.calls[0][0] as string;
        expect(calledUrl).toContain('text=hello+world+%26+goodbye');
    });

    test('passes through upstream errors', async () => {
        mockFetch.mockResolvedValueOnce(new Response('boom', { status: 503 }));
        const res = await handler(event({ language: 'ja', text: 'x' }));
        expect(res.statusCode).toBe(503);
    });

    test('returns 502 on network error', async () => {
        mockFetch.mockRejectedValueOnce(new Error('ETIMEDOUT'));
        const res = await handler(event({ language: 'ja', text: 'x' }));
        expect(res.statusCode).toBe(502);
        const body = JSON.parse(res.body as string);
        expect(body.code).toBe('BadGateway');
    });
});
