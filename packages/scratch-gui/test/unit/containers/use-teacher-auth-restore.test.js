/* eslint-env jest */
/**
 * Teacher login restore after reload (#1199): silent re-auth through the
 * provider, the token stays in memory only, failure falls back silently.
 */
jest.mock('../../../src/lib/teacher-auth.js', () => ({
    cancelGoogleLogin: jest.fn(),
    isGoogleLoginInFlight: jest.fn(() => false),
    revealGoogleSignInButton: jest.fn(),
    loginWithGoogle: jest.fn(),
    requestMicrosoftIdToken: jest.fn(),
    isMicrosoftAuthAvailable: jest.fn(() => false),
    attemptSilentReauth: jest.fn(),
    clearAuthSession: jest.fn(),
    cleanupOnReload: jest.fn(),
}));

const TEACHER_KEY = 'smalruby:classroomTeacher';
const TOKEN_KEY = 'smalruby:classroomTeacherToken';

const loadModules = () => ({
    auth: require('../../../src/containers/use-teacher-auth.js'),
    teacherAuth: require('../../../src/lib/teacher-auth.js'),
});

describe('use-teacher-auth restore (#1199)', () => {
    beforeEach(() => {
        jest.resetModules();
        window.localStorage.clear();
        window.sessionStorage.clear();
    });

    test('keeps the MSAL cache on reload when a Microsoft login is persisted', () => {
        window.localStorage.setItem(TEACHER_KEY, JSON.stringify({ provider: 'microsoft' }));
        const { teacherAuth } = loadModules();
        expect(teacherAuth.cleanupOnReload).not.toHaveBeenCalled();
    });

    test('still clears stale MSAL sessions otherwise', () => {
        window.localStorage.setItem(TEACHER_KEY, JSON.stringify({ provider: 'google' }));
        const { teacherAuth } = loadModules();
        expect(teacherAuth.cleanupOnReload).toHaveBeenCalled();
    });

    test('restored token is cached in memory, never in localStorage', async () => {
        window.localStorage.setItem(TEACHER_KEY, JSON.stringify({ provider: 'google' }));
        const { auth } = loadModules();
        const token = await auth.restoreTeacherLogin('google', () => Promise.resolve('fresh-token'));
        expect(token).toBe('fresh-token');
        expect(auth.getCachedTeacherIdToken()).toBe('fresh-token');
        expect(auth.getCachedTeacherAuthProvider()).toBe('google');
        expect(window.localStorage.getItem(TEACHER_KEY)).not.toContain('fresh-token');
    });

    test('failed silent re-auth drops the persisted login without throwing', async () => {
        window.localStorage.setItem(TEACHER_KEY, JSON.stringify({ provider: 'google' }));
        const { auth } = loadModules();
        const token = await auth.restoreTeacherLogin('google', () => Promise.reject(new Error('dismissed')));
        expect(token).toBeNull();
        expect(auth.getCachedTeacherIdToken()).toBeNull();
        expect(window.localStorage.getItem(TEACHER_KEY)).toBeNull();
    });

    test('failed silent re-auth keeps a login made while it was pending', async () => {
        window.localStorage.setItem(TEACHER_KEY, JSON.stringify({ provider: 'google' }));
        const { auth } = loadModules();
        const token = await auth.restoreTeacherLogin('google', () => {
            // The teacher logged in from the modal before the silent attempt timed out.
            auth.setCachedTeacherIdToken('manual-token');
            return Promise.reject(new Error('Silent reauth timeout'));
        });
        expect(token).toBe('manual-token');
        expect(auth.getCachedTeacherIdToken()).toBe('manual-token');
        expect(JSON.parse(window.localStorage.getItem(TEACHER_KEY)).provider).toBe('google');
    });

    test('logoutCachedTeacher forgets token, provider session and persisted login', async () => {
        window.localStorage.setItem(TEACHER_KEY, JSON.stringify({ provider: 'microsoft' }));
        const { auth, teacherAuth } = loadModules();
        await auth.restoreTeacherLogin('microsoft', () => Promise.resolve('t'));
        auth.logoutCachedTeacher();
        expect(teacherAuth.clearAuthSession).toHaveBeenCalledWith('microsoft');
        expect(auth.getCachedTeacherIdToken()).toBeNull();
        expect(window.localStorage.getItem(TEACHER_KEY)).toBeNull();
    });

    test('a reload reuses the token kept in this tab without asking the provider (teacher review)', async () => {
        const token = `h.${btoa(JSON.stringify({ exp: Date.now() / 1000 + 3600 }))}.s`;
        window.localStorage.setItem(TEACHER_KEY, JSON.stringify({ provider: 'google' }));
        window.sessionStorage.setItem(TOKEN_KEY, JSON.stringify({ provider: 'google', idToken: token }));
        const { auth } = loadModules();
        const reauth = jest.fn(() => Promise.resolve(null));
        expect(await auth.restoreTeacherLogin('google', reauth)).toBe(token);
        expect(reauth).not.toHaveBeenCalled();
        expect(auth.getCachedTeacherAuthProvider()).toBe('google');
    });

    test('an expired kept token falls back to the silent re-auth and keeps the new one', async () => {
        const now = Date.now();
        const expired = `h.${btoa(JSON.stringify({ exp: now / 1000 - 10 }))}.s`;
        const fresh = `h.${btoa(JSON.stringify({ exp: now / 1000 + 3600 }))}.s`;
        window.localStorage.setItem(TEACHER_KEY, JSON.stringify({ provider: 'google' }));
        window.sessionStorage.setItem(TOKEN_KEY, JSON.stringify({ provider: 'google', idToken: expired }));
        const { auth } = loadModules();
        expect(await auth.restoreTeacherLogin('google', () => Promise.resolve(fresh), now)).toBe(fresh);
        expect(JSON.parse(window.sessionStorage.getItem(TOKEN_KEY)).idToken).toBe(fresh);
    });
});
