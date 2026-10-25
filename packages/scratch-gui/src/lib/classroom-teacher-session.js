/**
 * Teacher login persistence across page reloads (#1199).
 *
 * The teacher's ID token itself lives only in memory (use-teacher-auth.js):
 * a token in localStorage would be readable by any XSS and outlive the
 * provider's own session. What survives a reload is just the fact that a
 * teacher *was* logged in, with which provider, and which class / assignment
 * they last had open. On load we use that to try the provider's existing
 * silent re-authentication path; if it fails the record is dropped and the
 * teacher is simply logged out.
 */

const STORAGE_KEY = 'smalruby:classroomTeacher';

// Providers that have a silent re-authentication path. The dev bypass token
// (?devlogin=) restores itself from the URL and is never persisted.
const RESTORABLE_PROVIDERS = ['google', 'microsoft'];

const hasLocalStorage = () => typeof window !== 'undefined' && !!window.localStorage;

/**
 * Validate and normalise a stored record.
 * @param {string|null} raw - JSON from localStorage
 * @returns {{provider: string, classroomId: (string|null), groupId: (string|null)}|null} record
 */
const parseTeacherSession = (raw) => {
    if (!raw) return null;
    let data;
    try {
        data = JSON.parse(raw);
    } catch {
        return null;
    }
    if (!data || !RESTORABLE_PROVIDERS.includes(data.provider)) return null;
    return {
        provider: data.provider,
        classroomId: typeof data.classroomId === 'string' ? data.classroomId : null,
        groupId: typeof data.groupId === 'string' ? data.groupId : null,
    };
};

/**
 * @returns {{provider: string, classroomId: (string|null), groupId: (string|null)}|null} the
 *   persisted teacher login, or null when none is stored
 */
const loadTeacherSession = () => {
    if (!hasLocalStorage()) return null;
    try {
        return parseTeacherSession(window.localStorage.getItem(STORAGE_KEY));
    } catch {
        return null;
    }
};

const writeTeacherSession = (session) => {
    if (!hasLocalStorage()) return;
    try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    } catch {
        // quota / private mode — restoring the login is best-effort.
    }
};

/**
 * Remember that a teacher logged in with `provider`. The last selection is
 * kept only when the provider is unchanged (a different provider is most
 * likely a different teacher on a shared PC).
 * @param {string|null} provider - 'google' | 'microsoft' (others are ignored)
 */
const saveTeacherLogin = (provider) => {
    if (!RESTORABLE_PROVIDERS.includes(provider)) return;
    const current = loadTeacherSession();
    if (current && current.provider === provider) return;
    writeTeacherSession({ provider, classroomId: null, groupId: null });
};

/**
 * Remember the class / assignment the teacher last opened ("いまの課題を開く").
 * No-op when no login is persisted.
 * @param {object} selection - last selection
 * @param {string|null} selection.classroomId - assignment id
 * @param {string|null} selection.groupId - owning class id
 */
const saveTeacherLastSelection = ({ classroomId, groupId }) => {
    const current = loadTeacherSession();
    if (!current) return;
    writeTeacherSession({ ...current, classroomId: classroomId || null, groupId: groupId || null });
};

const clearTeacherSession = () => {
    if (!hasLocalStorage()) return;
    try {
        window.localStorage.removeItem(STORAGE_KEY);
    } catch {
        // ignore
    }
};

/**
 * How to bring the teacher back after a reload.
 * @param {object} params - inputs
 * @param {object|null} params.session - persisted record (loadTeacherSession)
 * @param {string|null} params.cachedToken - in-memory token, if any
 * @param {string|null} params.devlogin - `?devlogin=` value, if any
 * @returns {'none'|'devlogin'|'silent'} restore strategy
 */
const decideTeacherRestore = ({ session, cachedToken, devlogin }) => {
    if (cachedToken) return 'none';
    if (devlogin) return 'devlogin';
    if (session && RESTORABLE_PROVIDERS.includes(session.provider)) return 'silent';
    return 'none';
};

/**
 * Which classroom entries the menu bar shows.
 *
 * A logged-in teacher gets the teacher menu in place of the student button.
 * When the same browser is also joined to a class as a student (a teacher
 * trying the student flow on their own PC) both are shown, so the student
 * session stays reachable.
 * @param {object} params - inputs
 * @param {boolean} params.teacherLoggedIn - teacher is logged in
 * @param {boolean} params.studentJoined - a student session exists
 * @returns {{showStudent: boolean, showTeacher: boolean}} visibility
 */
const classroomMenuVisibility = ({ teacherLoggedIn, studentJoined }) => ({
    showTeacher: !!teacherLoggedIn,
    showStudent: !teacherLoggedIn || !!studentJoined,
});

/**
 * Items of the teacher menu, in display order.
 * @param {object} params - inputs
 * @param {string|null} params.lastClassroomId - last opened assignment
 * @param {number} params.unreadCount - unread お知らせ
 * @returns {Array<{id: string, badge: boolean}>} menu items
 */
const teacherMenuItems = ({ lastClassroomId, unreadCount }) => {
    const items = [];
    if (lastClassroomId) items.push({ id: 'current-assignment', badge: false });
    items.push({ id: 'class-list', badge: false });
    items.push({ id: 'notifications', badge: unreadCount > 0 });
    items.push({ id: 'logout', badge: false });
    return items;
};

/**
 * Resolve a navigation request from the teacher menu once the modal is open.
 * @param {object} params - inputs
 * @param {string|null} params.target - 'current-assignment' | 'class-list' | 'notifications'
 * @param {{classroomId: (string|null), groupId: (string|null)}|null} params.lastSelection - last selection
 * @param {Array<object>} params.groups - loaded classes ([] until loaded)
 * @param {boolean} params.groupsLoaded - whether the class list has arrived
 * @returns {{action: string, group?: (object|null), classroomId?: string}} what to do:
 *   'none' (no request), 'wait' (data not ready), 'assignment', 'class-list', 'notifications'
 */
const resolveTeacherNavigation = ({ target, lastSelection, groups, groupsLoaded }) => {
    if (!target) return { action: 'none' };
    if (target === 'notifications') return { action: 'notifications' };
    if (target === 'current-assignment' && lastSelection && lastSelection.classroomId) {
        if (lastSelection.groupId && !groupsLoaded) return { action: 'wait' };
        const group = (groups || []).find((g) => g.groupId === lastSelection.groupId) || null;
        return { action: 'assignment', group, classroomId: lastSelection.classroomId };
    }
    return { action: 'class-list' };
};

export {
    STORAGE_KEY,
    parseTeacherSession,
    loadTeacherSession,
    saveTeacherLogin,
    saveTeacherLastSelection,
    clearTeacherSession,
    decideTeacherRestore,
    classroomMenuVisibility,
    teacherMenuItems,
    resolveTeacherNavigation,
};
