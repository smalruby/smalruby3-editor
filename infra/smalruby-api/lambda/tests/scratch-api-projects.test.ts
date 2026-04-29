import { handler } from '../scratch-api-projects';

const mockFetch = jest.fn();
global.fetch = mockFetch as unknown as typeof fetch;

const event = (projectId?: string) =>
    ({
        pathParameters: projectId ? { projectId } : undefined,
        requestContext: { http: { sourceIp: '1.2.3.4' } },
    }) as never;

beforeEach(() => {
    mockFetch.mockReset();
});

describe('scratch-api-projects handler', () => {
    test('returns 400 when projectId is missing', async () => {
        const res = await handler(event(undefined));
        expect(res.statusCode).toBe(400);
        const body = JSON.parse(res.body as string);
        expect(body.code).toBe('BadRequest');
        expect(mockFetch).not.toHaveBeenCalled();
    });

    test('passes through 200 with project_token', async () => {
        const projectJson = { id: 1, project_token: 'tok' };
        mockFetch.mockResolvedValueOnce(
            new Response(JSON.stringify(projectJson), {
                status: 200,
                headers: { 'content-type': 'application/json' },
            }),
        );

        const res = await handler(event('123'));
        expect(res.statusCode).toBe(200);
        expect(JSON.parse(res.body as string)).toEqual(projectJson);
        expect(mockFetch).toHaveBeenCalledWith(
            'https://api.scratch.mit.edu/projects/123',
        );
    });

    test('passes through 404 from upstream (regression: was 200 in old proxy)', async () => {
        mockFetch.mockResolvedValueOnce(
            new Response('{"code":"NotFound","message":""}', {
                status: 404,
                headers: { 'content-type': 'application/json' },
            }),
        );

        const res = await handler(event('99999'));
        expect(res.statusCode).toBe(404);
        const body = JSON.parse(res.body as string);
        expect(body.code).toBe('NotFound');
    });

    test('passes through 5xx from upstream', async () => {
        mockFetch.mockResolvedValueOnce(
            new Response('upstream down', {
                status: 503,
                headers: { 'content-type': 'text/plain' },
            }),
        );

        const res = await handler(event('123'));
        expect(res.statusCode).toBe(503);
    });

    test('returns 502 on network error', async () => {
        mockFetch.mockRejectedValueOnce(new Error('connect ECONNREFUSED'));

        const res = await handler(event('123'));
        expect(res.statusCode).toBe(502);
        const body = JSON.parse(res.body as string);
        expect(body.code).toBe('BadGateway');
        expect(body.message).toContain('ECONNREFUSED');
    });

    test('encodes projectId for URL safety', async () => {
        mockFetch.mockResolvedValueOnce(
            new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } }),
        );
        await handler(event('a/b'));
        expect(mockFetch).toHaveBeenCalledWith(
            'https://api.scratch.mit.edu/projects/a%2Fb',
        );
    });
});
