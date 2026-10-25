/**
 * Teacher login persistence across page reloads (#1199).
 *
 * Two records survive a reload:
 *
 * - localStorage `smalruby:classroomTeacher`: the fact that a teacher *was*
 *   logged in, with which provider, and which class / assignment they last had
 *   open. No token. Used to try the provider's silent re-authentication.
 * - sessionStorage `smalruby:classroomTeacherToken`: the ID token itself,
 *   restored only while it has not expired. Silent re-authentication alone
 *   proved unreliable on reload (Google's FedCM auto re-authentication is
 *   rate-limited and needs a single returning account), so the teacher was
 *   logged out after a plain reload. sessionStorage is per tab and is gone when
 *   the tab closes, which keeps the token off a shared PC once the teacher
 *   leaves; the token's own `exp` (about an hour) bounds it otherwise. An XSS
 *   could read it, but the same XSS could already use the in-memory token.
 *
 * When neither works the records are dropped and the teacher is simply logged
 * out.
 */

const STORAGE_KEY = 'smalruby:classroomTeacher';
const TOKEN_STORAGE_KEY = 'smalruby:classroomTeacherToken';

// A token this close to its expiry is not worth restoring: the first API call
// would 401 and fall back to the silent re-authentication anyway.
const TOKEN_EXPIRY_MARGIN_MS = 60 * 1000;

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

const hasSessionStorage = () => typeof window !== 'undefined' && !!window.sessionStorage;

/**
 * Expiry of an OIDC ID token (Google / Microsoft JWT).
 * @param {string} idToken - raw ID token
 * @returns {number|null} expiry in ms epoch, or null for opaque / malformed tokens
 */
const idTokenExpiresAt = (idToken) => {
    if (typeof idToken !== 'string') return null;
    const parts = idToken.split('.');
    if (parts.length !== 3) return null;
    try {
        const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
        return typeof payload.exp === 'number' ? payload.exp * 1000 : null;
    } catch {
        return null;
    }
};

/**
 * The stored token, if it belongs to `provider` and is still usable at `now`.
 * @param {object} params - inputs
 * @param {string|null} params.raw - JSON from sessionStorage
 * @param {string} params.provider - provider of the persisted login
 * @param {number} params.now - current time in ms epoch
 * @returns {string|null} the ID token, or null when it cannot be restored
 */
const usableTeacherToken = ({ raw, provider, now }) => {
    if (!raw) return null;
    let data;
    try {
        data = JSON.parse(raw);
    } catch {
        return null;
    }
    if (!data || data.provider !== provider || !RESTORABLE_PROVIDERS.includes(provider)) return null;
    const expiresAt = idTokenExpiresAt(data.idToken);
    if (!expiresAt || expiresAt - TOKEN_EXPIRY_MARGIN_MS <= now) return null;
    return data.idToken;
};

/**
 * Keep the teacher's ID token for the next reload of this tab. Opaque tokens
 * (the `?devlogin=` bypass) have no expiry and are never stored.
 * @param {string|null} provider - 'google' | 'microsoft' (others are ignored)
 * @param {string|null} idToken - raw ID token
 */
const saveTeacherToken = (provider, idToken) => {
    if (!RESTORABLE_PROVIDERS.includes(provider) || !idTokenExpiresAt(idToken)) return;
    if (!hasSessionStorage()) return;
    try {
        window.sessionStorage.setItem(TOKEN_STORAGE_KEY, JSON.stringify({ provider, idToken }));
    } catch {
        // quota / private mode — the silent re-authentication remains.
    }
};

/**
 * @param {string} provider - provider of the persisted login
 * @param {number} now - current time in ms epoch
 * @returns {string|null} the stored ID token while it is still valid
 */
const loadTeacherToken = (provider, now) => {
    if (!hasSessionStorage()) return null;
    try {
        return usableTeacherToken({ raw: window.sessionStorage.getItem(TOKEN_STORAGE_KEY), provider, now });
    } catch {
        return null;
    }
};

const clearTeacherSession = () => {
    try {
        if (hasLocalStorage()) window.localStorage.removeItem(STORAGE_KEY);
        if (hasSessionStorage()) window.sessionStorage.removeItem(TOKEN_STORAGE_KEY);
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
    TOKEN_STORAGE_KEY,
    parseTeacherSession,
    loadTeacherSession,
    saveTeacherLogin,
    saveTeacherLastSelection,
    idTokenExpiresAt,
    usableTeacherToken,
    saveTeacherToken,
    loadTeacherToken,
    clearTeacherSession,
    decideTeacherRestore,
    classroomMenuVisibility,
    teacherMenuItems,
    resolveTeacherNavigation,
};
