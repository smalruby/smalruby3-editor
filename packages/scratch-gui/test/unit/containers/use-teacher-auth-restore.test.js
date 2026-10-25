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

const loadModules = () => ({
    auth: require('../../../src/containers/use-teacher-auth.js'),
    teacherAuth: require('../../../src/lib/teacher-auth.js'),
});

describe('use-teacher-auth restore (#1199)', () => {
    beforeEach(() => {
        jest.resetModules();
        window.localStorage.clear();
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

    test('logoutCachedTeacher forgets token, provider session and persisted login', async () => {
        window.localStorage.setItem(TEACHER_KEY, JSON.stringify({ provider: 'microsoft' }));
        const { auth, teacherAuth } = loadModules();
        await auth.restoreTeacherLogin('microsoft', () => Promise.resolve('t'));
        auth.logoutCachedTeacher();
        expect(teacherAuth.clearAuthSession).toHaveBeenCalledWith('microsoft');
        expect(auth.getCachedTeacherIdToken()).toBeNull();
        expect(window.localStorage.getItem(TEACHER_KEY)).toBeNull();
    });
});
