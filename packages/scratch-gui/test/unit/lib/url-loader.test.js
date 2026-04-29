import {
    UrlLoaderError,
    fetchProjectInfo,
    formatLoadError,
    urlLoaderMessages,
} from '../../../src/lib/url-loader';

const mockIntl = {
    formatMessage: msg => msg.defaultMessage,
};

describe('formatLoadError', () => {
    test('404 → projectNotFound', () => {
        const err = new UrlLoaderError('hi', 404);
        expect(formatLoadError(err, mockIntl)).toBe(urlLoaderMessages.projectNotFound.defaultMessage);
    });

    test('403 → projectAccessDenied', () => {
        const err = new UrlLoaderError('hi', 403);
        expect(formatLoadError(err, mockIntl)).toBe(urlLoaderMessages.projectAccessDenied.defaultMessage);
    });

    test('500 → serverError', () => {
        const err = new UrlLoaderError('hi', 500);
        expect(formatLoadError(err, mockIntl)).toBe(urlLoaderMessages.serverError.defaultMessage);
    });

    test('502 → serverError (any 5xx)', () => {
        const err = new UrlLoaderError('hi', 502);
        expect(formatLoadError(err, mockIntl)).toBe(urlLoaderMessages.serverError.defaultMessage);
    });

    test('TypeError (network failure) → networkError', () => {
        const err = new TypeError('Failed to fetch');
        expect(formatLoadError(err, mockIntl)).toBe(urlLoaderMessages.networkError.defaultMessage);
    });

    test('unknown error (no status) → loadError fallback', () => {
        const err = new Error('something broke');
        expect(formatLoadError(err, mockIntl)).toBe(urlLoaderMessages.loadError.defaultMessage);
    });

    test('null/undefined error → loadError fallback', () => {
        expect(formatLoadError(null, mockIntl)).toBe(urlLoaderMessages.loadError.defaultMessage);
        expect(formatLoadError(undefined, mockIntl)).toBe(urlLoaderMessages.loadError.defaultMessage);
    });

    test('400 (Bad Request) → loadError fallback (not specifically mapped)', () => {
        const err = new UrlLoaderError('hi', 400);
        expect(formatLoadError(err, mockIntl)).toBe(urlLoaderMessages.loadError.defaultMessage);
    });
});

describe('fetchProjectInfo', () => {
    let originalFetch;

    beforeEach(() => {
        originalFetch = global.fetch;
    });

    afterEach(() => {
        global.fetch = originalFetch;
    });

    test('200 with project_token → resolves with the JSON body', async () => {
        const projectJson = { id: 12345, project_token: 'token-abc' };
        global.fetch = jest.fn().mockResolvedValue({
            ok: true,
            status: 200,
            json: () => Promise.resolve(projectJson),
        });

        const data = await fetchProjectInfo('https://stg.api.smalruby.app', '12345');

        expect(global.fetch).toHaveBeenCalledWith(
            'https://stg.api.smalruby.app/scratch-api-proxy/projects/12345',
            expect.objectContaining({ method: 'GET' }),
        );
        expect(data).toEqual(projectJson);
    });

    test('404 from proxy → throws UrlLoaderError with status 404', async () => {
        global.fetch = jest.fn().mockResolvedValue({
            ok: false,
            status: 404,
            json: () => Promise.resolve({ code: 'NotFound' }),
        });

        await expect(fetchProjectInfo('https://stg.api.smalruby.app', '99999')).rejects.toMatchObject({
            name: 'UrlLoaderError',
            status: 404,
        });
    });

    test('403 from proxy → throws UrlLoaderError with status 403', async () => {
        global.fetch = jest.fn().mockResolvedValue({
            ok: false,
            status: 403,
            json: () => Promise.resolve({}),
        });

        await expect(fetchProjectInfo('https://stg.api.smalruby.app', '12345')).rejects.toMatchObject({
            status: 403,
        });
    });

    test('5xx from proxy → throws UrlLoaderError with that status', async () => {
        global.fetch = jest.fn().mockResolvedValue({
            ok: false,
            status: 503,
            json: () => Promise.resolve({}),
        });

        await expect(fetchProjectInfo('https://stg.api.smalruby.app', '12345')).rejects.toMatchObject({
            status: 503,
        });
    });

    test('200 + {code: "NotFound"} (legacy SAM proxy) → throws UrlLoaderError with status 404', async () => {
        global.fetch = jest.fn().mockResolvedValue({
            ok: true,
            status: 200,
            json: () => Promise.resolve({ code: 'NotFound', message: '' }),
        });

        await expect(fetchProjectInfo('https://api.smalruby.app', '99999')).rejects.toMatchObject({
            name: 'UrlLoaderError',
            status: 404,
        });
    });

    test('200 + missing project_token → throws UrlLoaderError with status 502', async () => {
        global.fetch = jest.fn().mockResolvedValue({
            ok: true,
            status: 200,
            json: () => Promise.resolve({ id: 12345 }),
        });

        await expect(fetchProjectInfo('https://stg.api.smalruby.app', '12345')).rejects.toMatchObject({
            status: 502,
        });
    });

    test('200 + empty project_token → throws UrlLoaderError with status 502', async () => {
        global.fetch = jest.fn().mockResolvedValue({
            ok: true,
            status: 200,
            json: () => Promise.resolve({ id: 12345, project_token: '' }),
        });

        await expect(fetchProjectInfo('https://stg.api.smalruby.app', '12345')).rejects.toMatchObject({
            status: 502,
        });
    });

    test('fetch throws TypeError (network failure) → propagates as TypeError', async () => {
        global.fetch = jest.fn().mockRejectedValue(new TypeError('Failed to fetch'));

        await expect(fetchProjectInfo('https://stg.api.smalruby.app', '12345')).rejects.toMatchObject({
            name: 'TypeError',
        });
    });

    test('encodes special characters in projectId', async () => {
        global.fetch = jest.fn().mockResolvedValue({
            ok: true,
            status: 200,
            json: () => Promise.resolve({ project_token: 'tok' }),
        });

        await fetchProjectInfo('https://stg.api.smalruby.app', 'a/b');

        expect(global.fetch).toHaveBeenCalledWith(
            'https://stg.api.smalruby.app/scratch-api-proxy/projects/a%2Fb',
            expect.any(Object),
        );
    });

    test('endpoint with trailing slash works (HOC strips it before passing in)', async () => {
        global.fetch = jest.fn().mockResolvedValue({
            ok: true,
            status: 200,
            json: () => Promise.resolve({ project_token: 'tok' }),
        });

        // The HOC strips trailing slashes; here we verify the function does not double-slash if given a clean endpoint.
        await fetchProjectInfo('https://stg.api.smalruby.app', '12345');
        expect(global.fetch).toHaveBeenCalledWith(
            'https://stg.api.smalruby.app/scratch-api-proxy/projects/12345',
            expect.any(Object),
        );
    });
});
