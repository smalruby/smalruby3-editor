import {fetchMe, hasIdToken, request, setIdToken} from '../../src/lib/admin-api.js';

describe('admin-api', () => {
    beforeEach(() => {
        setIdToken(null);
        global.fetch = jest.fn();
    });

    test('keeps the token in memory only', () => {
        expect(hasIdToken()).toBe(false);
        setIdToken('token-1');
        expect(hasIdToken()).toBe(true);
        expect(window.localStorage.length).toBe(0);
    });

    test('sends the bearer token and parses JSON', async () => {
        setIdToken('token-1');
        global.fetch.mockResolvedValue({
            ok: true,
            status: 200,
            json: () => Promise.resolve({email: 'admin@example.com'})
        });

        const me = await fetchMe();
        expect(me.email).toBe('admin@example.com');
        const [url, options] = global.fetch.mock.calls[0];
        expect(url).toContain('/admin/me');
        expect(options.headers.Authorization).toBe('Bearer token-1');
    });

    test('surfaces API errors with their status', async () => {
        setIdToken('token-1');
        global.fetch.mockResolvedValue({
            ok: false,
            status: 403,
            json: () => Promise.resolve({error: 'Not an administrator'})
        });

        await expect(fetchMe()).rejects.toMatchObject({
            message: 'Not an administrator',
            status: 403
        });
    });

    test('returns null on 204', async () => {
        setIdToken('token-1');
        global.fetch.mockResolvedValue({ok: true, status: 204});
        expect(await request('DELETE', '/admin/whatever')).toBeNull();
    });
});

describe('session expiry broadcast (401)', () => {
    beforeEach(() => {
        setIdToken('token-1');
        global.fetch = jest.fn();
    });

    test('a 401 dispatches smalruby-admin:unauthorized before rejecting', async () => {
        global.fetch.mockResolvedValue({
            ok: false,
            status: 401,
            json: () => Promise.resolve({error: 'Invalid ID token'})
        });
        const listener = jest.fn();
        window.addEventListener('smalruby-admin:unauthorized', listener);

        await expect(request('GET', '/admin/me')).rejects.toMatchObject({status: 401});
        expect(listener).toHaveBeenCalledTimes(1);
        window.removeEventListener('smalruby-admin:unauthorized', listener);
    });

    test('non-401 errors do not broadcast', async () => {
        global.fetch.mockResolvedValue({
            ok: false,
            status: 403,
            json: () => Promise.resolve({error: 'Not an administrator'})
        });
        const listener = jest.fn();
        window.addEventListener('smalruby-admin:unauthorized', listener);

        await expect(request('GET', '/admin/me')).rejects.toMatchObject({status: 403});
        expect(listener).not.toHaveBeenCalled();
        window.removeEventListener('smalruby-admin:unauthorized', listener);
    });
});
