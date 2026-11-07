// Dummy value only — never put a real DEV_BYPASS_TOKEN in tests.
const DUMMY_TOKEN = 'dummy-devlogin-token';

const loadFresh = () => {
    let mod;
    jest.isolateModules(() => {
        mod = require('../../../src/lib/url-params.js');
    });
    return mod;
};

describe('url-params devlogin', () => {
    afterEach(() => {
        window.history.replaceState(null, '', '/');
    });

    test('keeps the devlogin value in memory after it is read', () => {
        window.history.replaceState(null, '', `/?devlogin=${DUMMY_TOKEN}`);
        const { getUrlParams } = loadFresh();
        expect(getUrlParams().devlogin).toBe(DUMMY_TOKEN);
        expect(getUrlParams().devlogin).toBe(DUMMY_TOKEN);
    });

    test('removes only devlogin from the URL and keeps the other params and the hash', () => {
        window.history.replaceState(null, '', `/editor?tab=ruby&devlogin=${DUMMY_TOKEN}&no_beforeunload=1#123`);
        const { getUrlParams } = loadFresh();
        getUrlParams();
        expect(window.location.pathname).toBe('/editor');
        expect(window.location.search).toBe('?tab=ruby&no_beforeunload=1');
        expect(window.location.hash).toBe('#123');
        expect(window.location.href).not.toContain(DUMMY_TOKEN);
    });

    test('drops the question mark when devlogin was the only param', () => {
        window.history.replaceState(null, '', `/?devlogin=${DUMMY_TOKEN}`);
        const { getUrlParams } = loadFresh();
        getUrlParams();
        expect(window.location.search).toBe('');
        expect(window.location.href).not.toContain('devlogin');
    });

    test('leaves the URL alone when there is no devlogin', () => {
        window.history.replaceState(null, '', '/?tab=ruby#7');
        const spy = jest.spyOn(window.history, 'replaceState');
        const { getUrlParams } = loadFresh();
        expect(getUrlParams().devlogin).toBeNull();
        expect(spy).not.toHaveBeenCalled();
        spy.mockRestore();
        expect(window.location.search).toBe('?tab=ruby');
    });
});

describe('removeUrlParam', () => {
    test('removes the named param and keeps the rest', () => {
        const { removeUrlParam } = loadFresh();
        expect(removeUrlParam('https://example.test/a?x=1&devlogin=v&y=2#h', 'devlogin')).toBe(
            'https://example.test/a?x=1&y=2#h',
        );
    });

    test('returns null when the param is not present', () => {
        const { removeUrlParam } = loadFresh();
        expect(removeUrlParam('https://example.test/a?x=1', 'devlogin')).toBeNull();
    });
});
