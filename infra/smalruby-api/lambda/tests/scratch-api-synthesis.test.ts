import { handler } from '../scratch-api-synthesis';

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

describe('scratch-api-synthesis handler', () => {
    test('returns 400 when locale is missing', async () => {
        const res = await handler(event({ gender: 'female', text: 'hi' }));
        expect(res.statusCode).toBe(400);
        const body = JSON.parse(res.body as string);
        expect(body.code).toBe('BadRequest');
        expect(mockFetch).not.toHaveBeenCalled();
    });

    test('returns 400 when gender is missing', async () => {
        const res = await handler(event({ locale: 'ja-JP', text: 'hi' }));
        expect(res.statusCode).toBe(400);
        expect(mockFetch).not.toHaveBeenCalled();
    });

    test('proxies synth request and returns Base64-encoded audio', async () => {
        const audio = Buffer.from([0x49, 0x44, 0x33, 0x04]); // fake mp3 bytes
        mockFetch.mockResolvedValueOnce(
            new Response(audio, {
                status: 200,
                headers: { 'content-type': 'audio/mpeg' },
            }),
        );

        const res = await handler(event({ locale: 'ja-JP', gender: 'female', text: 'こんにちは' }));

        expect(res.statusCode).toBe(200);
        expect(res.isBase64Encoded).toBe(true);
        expect(res.headers?.['Content-Type']).toBe('audio/mpeg');
        expect(res.body).toBe(audio.toString('base64'));

        expect(mockFetch).toHaveBeenCalledTimes(1);
        const calledUrl = mockFetch.mock.calls[0][0] as string;
        expect(calledUrl).toMatch(/^https:\/\/synthesis-service\.scratch\.mit\.edu\/synth\?/);
        expect(calledUrl).toContain('locale=ja-JP');
        expect(calledUrl).toContain('gender=female');
    });

    test('url-encodes special characters in text', async () => {
        mockFetch.mockResolvedValueOnce(
            new Response(Buffer.from([0]), {
                status: 200,
                headers: { 'content-type': 'audio/mpeg' },
            }),
        );
        await handler(event({ locale: 'en-US', gender: 'male', text: 'hello world & goodbye' }));
        const calledUrl = mockFetch.mock.calls[0][0] as string;
        expect(calledUrl).toContain('text=hello+world+%26+goodbye');
    });

    test('passes through upstream errors as JSON', async () => {
        mockFetch.mockResolvedValueOnce(new Response('boom', { status: 503 }));
        const res = await handler(event({ locale: 'ja-JP', gender: 'female', text: 'x' }));
        expect(res.statusCode).toBe(503);
        expect(res.isBase64Encoded).toBe(false);
        const body = JSON.parse(res.body as string);
        expect(body.code).toBe('UpstreamError');
    });

    test('returns 502 on network error', async () => {
        mockFetch.mockRejectedValueOnce(new Error('ETIMEDOUT'));
        const res = await handler(event({ locale: 'ja-JP', gender: 'female', text: 'x' }));
        expect(res.statusCode).toBe(502);
        const body = JSON.parse(res.body as string);
        expect(body.code).toBe('BadGateway');
    });
});
