// A dummy value: the real DEV_BYPASS_TOKEN must never appear in tests (#1393).
const DUMMY_TOKEN = 'dummy-dev-login-token';

// google-auth.js keeps the token in module memory, so each test loads a fresh copy.
const loadGetDevLoginToken = () => {
    let fn;
    jest.isolateModules(() => {
        fn = require('../../src/lib/google-auth.js').getDevLoginToken;
    });
    return fn;
};

describe('getDevLoginToken', () => {
    afterEach(() => {
        window.history.replaceState(null, '', '/');
    });

    test('returns the token and removes only devlogin from the URL', () => {
        window.history.replaceState(null, '', `/admin/?x=1&devlogin=${DUMMY_TOKEN}&y=2#/classrooms`);
        const getDevLoginToken = loadGetDevLoginToken();
        expect(getDevLoginToken()).toBe(DUMMY_TOKEN);
        expect(window.location.pathname).toBe('/admin/');
        expect(window.location.search).toBe('?x=1&y=2');
        expect(window.location.hash).toBe('#/classrooms');
        expect(window.location.href).not.toContain(DUMMY_TOKEN);
    });

    test('does not leave a bare "?" behind', () => {
        window.history.replaceState(null, '', `/admin/?devlogin=${DUMMY_TOKEN}`);
        loadGetDevLoginToken()();
        expect(window.location.href).toBe(`${window.location.origin}/admin/`);
    });

    test('keeps the token in memory after it left the URL', () => {
        window.history.replaceState(null, '', `/admin/?devlogin=${DUMMY_TOKEN}`);
        const getDevLoginToken = loadGetDevLoginToken();
        getDevLoginToken();
        expect(getDevLoginToken()).toBe(DUMMY_TOKEN);
    });

    test('returns null and leaves the URL alone without devlogin', () => {
        window.history.replaceState(null, '', '/admin/?x=1#/bugs');
        const spy = jest.spyOn(window.history, 'replaceState');
        expect(loadGetDevLoginToken()()).toBeNull();
        expect(spy).not.toHaveBeenCalled();
        spy.mockRestore();
        expect(window.location.search).toBe('?x=1');
    });
});
