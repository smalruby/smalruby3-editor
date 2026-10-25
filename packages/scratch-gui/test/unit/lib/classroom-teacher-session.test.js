import {
    STORAGE_KEY,
    loadTeacherSession,
    saveTeacherLogin,
    saveTeacherLastSelection,
    clearTeacherSession,
    decideTeacherRestore,
    classroomMenuVisibility,
    teacherMenuItems,
    resolveTeacherNavigation,
} from '../../../src/lib/classroom-teacher-session';

describe('classroom-teacher-session persistence', () => {
    beforeEach(() => {
        window.localStorage.clear();
    });

    test('returns null when nothing is stored', () => {
        expect(loadTeacherSession()).toBeNull();
    });

    test('saves the provider without any token', () => {
        saveTeacherLogin('google');
        const raw = JSON.parse(window.localStorage.getItem(STORAGE_KEY));
        expect(raw).toEqual({ provider: 'google', classroomId: null, groupId: null });
        expect(JSON.stringify(raw)).not.toMatch(/token/i);
    });

    test('ignores providers without a silent re-auth path', () => {
        saveTeacherLogin(null);
        saveTeacherLogin('dev');
        expect(loadTeacherSession()).toBeNull();
    });

    test('keeps the last selection when the same provider logs in again', () => {
        saveTeacherLogin('microsoft');
        saveTeacherLastSelection({ classroomId: 'c1', groupId: 'g1' });
        saveTeacherLogin('microsoft');
        expect(loadTeacherSession()).toEqual({ provider: 'microsoft', classroomId: 'c1', groupId: 'g1' });
    });

    test('drops the last selection when the provider changes', () => {
        saveTeacherLogin('microsoft');
        saveTeacherLastSelection({ classroomId: 'c1', groupId: 'g1' });
        saveTeacherLogin('google');
        expect(loadTeacherSession()).toEqual({ provider: 'google', classroomId: null, groupId: null });
    });

    test('does not record a selection without a persisted login', () => {
        saveTeacherLastSelection({ classroomId: 'c1', groupId: 'g1' });
        expect(loadTeacherSession()).toBeNull();
    });

    test('clears the record', () => {
        saveTeacherLogin('google');
        clearTeacherSession();
        expect(loadTeacherSession()).toBeNull();
    });

    test('treats broken or unknown records as absent', () => {
        window.localStorage.setItem(STORAGE_KEY, '{not json');
        expect(loadTeacherSession()).toBeNull();
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ provider: 'facebook' }));
        expect(loadTeacherSession()).toBeNull();
    });
});

describe('decideTeacherRestore', () => {
    const session = { provider: 'google', classroomId: null, groupId: null };

    test('does nothing when a token is already in memory', () => {
        expect(decideTeacherRestore({ session, cachedToken: 'tok', devlogin: 'x' })).toBe('none');
    });

    test('uses the dev bypass token from the URL first', () => {
        expect(decideTeacherRestore({ session, cachedToken: null, devlogin: 'secret' })).toBe('devlogin');
    });

    test('tries silent re-auth for a persisted login', () => {
        expect(decideTeacherRestore({ session, cachedToken: null, devlogin: null })).toBe('silent');
    });

    test('does nothing without a persisted login', () => {
        expect(decideTeacherRestore({ session: null, cachedToken: null, devlogin: null })).toBe('none');
    });
});

describe('classroomMenuVisibility', () => {
    test('student button only when no teacher is logged in', () => {
        expect(classroomMenuVisibility({ teacherLoggedIn: false, studentJoined: false })).toEqual({
            showStudent: true,
            showTeacher: false,
        });
        expect(classroomMenuVisibility({ teacherLoggedIn: false, studentJoined: true })).toEqual({
            showStudent: true,
            showTeacher: false,
        });
    });

    test('teacher menu replaces the student button', () => {
        expect(classroomMenuVisibility({ teacherLoggedIn: true, studentJoined: false })).toEqual({
            showStudent: false,
            showTeacher: true,
        });
    });

    test('both are shown when a student session also exists', () => {
        expect(classroomMenuVisibility({ teacherLoggedIn: true, studentJoined: true })).toEqual({
            showStudent: true,
            showTeacher: true,
        });
    });
});

describe('teacherMenuItems', () => {
    const ids = (items) => items.map((i) => i.id);

    test('omits "current assignment" when nothing was opened yet', () => {
        expect(ids(teacherMenuItems({ lastClassroomId: null, unreadCount: 0 }))).toEqual([
            'class-list',
            'notifications',
            'logout',
        ]);
    });

    test('lists "current assignment" first when one was opened', () => {
        expect(ids(teacherMenuItems({ lastClassroomId: 'c1', unreadCount: 0 }))).toEqual([
            'current-assignment',
            'class-list',
            'notifications',
            'logout',
        ]);
    });

    test('badges notifications only when unread', () => {
        const badge = (n) =>
            teacherMenuItems({ lastClassroomId: null, unreadCount: n }).find((i) => i.id === 'notifications').badge;
        expect(badge(0)).toBe(false);
        expect(badge(3)).toBe(true);
    });
});

describe('resolveTeacherNavigation', () => {
    const groups = [{ groupId: 'g1', name: '1-1' }];

    test('no request', () => {
        expect(resolveTeacherNavigation({ target: null, lastSelection: null, groups, groupsLoaded: true })).toEqual({
            action: 'none',
        });
    });

    test('notifications', () => {
        expect(
            resolveTeacherNavigation({ target: 'notifications', lastSelection: null, groups, groupsLoaded: true }),
        ).toEqual({ action: 'notifications' });
    });

    test('class list', () => {
        expect(
            resolveTeacherNavigation({ target: 'class-list', lastSelection: null, groups, groupsLoaded: true }),
        ).toEqual({ action: 'class-list' });
    });

    test('waits for classes before opening the current assignment', () => {
        expect(
            resolveTeacherNavigation({
                target: 'current-assignment',
                lastSelection: { classroomId: 'c1', groupId: 'g1' },
                groups: [],
                groupsLoaded: false,
            }),
        ).toEqual({ action: 'wait' });
    });

    test('opens the current assignment inside its class', () => {
        expect(
            resolveTeacherNavigation({
                target: 'current-assignment',
                lastSelection: { classroomId: 'c1', groupId: 'g1' },
                groups,
                groupsLoaded: true,
            }),
        ).toEqual({ action: 'assignment', group: groups[0], classroomId: 'c1' });
    });

    test('does not wait forever once the class list has loaded empty', () => {
        // The last class was deleted (or listGroups failed): go on without it.
        expect(
            resolveTeacherNavigation({
                target: 'current-assignment',
                lastSelection: { classroomId: 'c1', groupId: 'g1' },
                groups: [],
                groupsLoaded: true,
            }),
        ).toEqual({ action: 'assignment', group: null, classroomId: 'c1' });
    });

    test('opens an assignment without a class directly', () => {
        expect(
            resolveTeacherNavigation({
                target: 'current-assignment',
                lastSelection: { classroomId: 'c1', groupId: null },
                groups: [],
                groupsLoaded: false,
            }),
        ).toEqual({ action: 'assignment', group: null, classroomId: 'c1' });
    });

    test('falls back to the class list without a last selection', () => {
        expect(
            resolveTeacherNavigation({
                target: 'current-assignment',
                lastSelection: null,
                groups,
                groupsLoaded: true,
            }),
        ).toEqual({ action: 'class-list' });
    });
});
