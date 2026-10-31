import { loadTeacherSession } from '../lib/classroom-teacher-session.js';
import { normalizeStudentGenai } from '../lib/genai-concierge-state.js';

const OPEN_MODAL = 'scratch-gui/classroom/OPEN_MODAL';
const CLOSE_MODAL = 'scratch-gui/classroom/CLOSE_MODAL';
const OPEN_TEACHER_MODAL = 'scratch-gui/classroom/OPEN_TEACHER_MODAL';
const CLOSE_TEACHER_MODAL = 'scratch-gui/classroom/CLOSE_TEACHER_MODAL';
const SET_SESSION = 'scratch-gui/classroom/SET_SESSION';
const CLEAR_SESSION = 'scratch-gui/classroom/CLEAR_SESSION';
const SET_SUBMISSION_STATUS = 'scratch-gui/classroom/SET_SUBMISSION_STATUS';
const SET_SUBMISSION_THUMBNAIL = 'scratch-gui/classroom/SET_SUBMISSION_THUMBNAIL';
const CLEAR_SUBMISSION_THUMBNAIL = 'scratch-gui/classroom/CLEAR_SUBMISSION_THUMBNAIL';
const REQUEST_RELOGIN = 'scratch-gui/classroom/REQUEST_RELOGIN';
const SET_TEACHER_SELECTION = 'scratch-gui/classroom/SET_TEACHER_SELECTION';
const CLEAR_TEACHER_SELECTION = 'scratch-gui/classroom/CLEAR_TEACHER_SELECTION';
const SET_TEACHER_LOGGED_IN = 'scratch-gui/classroom/SET_TEACHER_LOGGED_IN';
const SET_TEACHER_UNREAD_COUNT = 'scratch-gui/classroom/SET_TEACHER_UNREAD_COUNT';
const SET_TEACHER_LAST_SELECTION = 'scratch-gui/classroom/SET_TEACHER_LAST_SELECTION';
const REQUEST_TEACHER_NAVIGATION = 'scratch-gui/classroom/REQUEST_TEACHER_NAVIGATION';
const CLEAR_TEACHER_NAVIGATION = 'scratch-gui/classroom/CLEAR_TEACHER_NAVIGATION';
const SET_TEACHER_KICK_REQUESTS = 'scratch-gui/classroom/SET_TEACHER_KICK_REQUESTS';
const REMOVE_TEACHER_KICK_REQUEST = 'scratch-gui/classroom/REMOVE_TEACHER_KICK_REQUEST';
const OPEN_TEACHER_KICK_LIST = 'scratch-gui/classroom/OPEN_TEACHER_KICK_LIST';
const CLOSE_TEACHER_KICK_LIST = 'scratch-gui/classroom/CLOSE_TEACHER_KICK_LIST';
const OPEN_TEACHER_PANEL = 'scratch-gui/classroom/OPEN_TEACHER_PANEL';
const CLOSE_TEACHER_PANEL = 'scratch-gui/classroom/CLOSE_TEACHER_PANEL';
const SET_STUDENT_PEER_VIEW = 'scratch-gui/classroom/SET_STUDENT_PEER_VIEW';
const OPEN_STUDENT_PEER_PANEL = 'scratch-gui/classroom/OPEN_STUDENT_PEER_PANEL';
const CLOSE_STUDENT_PEER_PANEL = 'scratch-gui/classroom/CLOSE_STUDENT_PEER_PANEL';
const REQUEST_MESH_CONNECT = 'scratch-gui/classroom/REQUEST_MESH_CONNECT';
const CLEAR_MESH_CONNECT_REQUEST = 'scratch-gui/classroom/CLEAR_MESH_CONNECT_REQUEST';
const SET_STUDENT_GENAI = 'scratch-gui/classroom/SET_STUDENT_GENAI';
const SET_RUBYTEE_ENABLED = 'scratch-gui/classroom/SET_RUBYTEE_ENABLED';

const STORAGE_KEY = 'smalruby:classroom';

const hasLocalStorage = () => typeof window !== 'undefined' && !!window.localStorage;
const hasSessionStorage = () => typeof window !== 'undefined' && !!window.sessionStorage;

const parseStoredSession = (raw) => {
    if (!raw) return null;
    try {
        const data = JSON.parse(raw);
        if (data && data.sessionToken && data.classroomId) return data;
    } catch {
        // fall through
    }
    return null;
};

// One-shot migration from the legacy sessionStorage location to localStorage.
// Older builds persisted the student session to sessionStorage, which meant a
// fresh tab opened from a `?classcode=` link had no session and the student's
// own seat appeared occupied. We promote the legacy value to localStorage on
// load, and always clear the legacy key so it stops resurfacing.
const migrateLegacySessionStorage = () => {
    if (!hasSessionStorage()) return;
    let legacyRaw = null;
    try {
        legacyRaw = window.sessionStorage.getItem(STORAGE_KEY);
    } catch {
        return;
    }
    if (legacyRaw === null) return;
    try {
        window.sessionStorage.removeItem(STORAGE_KEY);
    } catch {
        // ignore
    }
    if (!hasLocalStorage()) return;
    const existing = (() => {
        try {
            return window.localStorage.getItem(STORAGE_KEY);
        } catch {
            return null;
        }
    })();
    if (existing) return;
    const parsed = parseStoredSession(legacyRaw);
    if (!parsed) return;
    try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
    } catch {
        // ignore
    }
};

const loadSession = () => {
    migrateLegacySessionStorage();
    if (!hasLocalStorage()) return null;
    try {
        return parseStoredSession(window.localStorage.getItem(STORAGE_KEY));
    } catch {
        return null;
    }
};

const saveSession = (session) => {
    if (!hasLocalStorage()) return;
    try {
        // submissionThumbnail is a (potentially large) transient in-memory data URI used
        // only for the current submission; it must never be persisted to localStorage.
        const persistable = { ...session };
        delete persistable.submissionThumbnail;
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(persistable));
    } catch {
        // Ignore storage errors
    }
};

const clearStoredSession = () => {
    if (hasLocalStorage()) {
        try {
            window.localStorage.removeItem(STORAGE_KEY);
        } catch {
            // ignore
        }
    }
    if (hasSessionStorage()) {
        try {
            window.sessionStorage.removeItem(STORAGE_KEY);
        } catch {
            // ignore
        }
    }
};

// teacherSelection is intentionally NOT persisted across page reloads. The
// teacher idToken (use-teacher-auth.js) is module-scope in-memory only and
// clears on reload, so persisting the selection in localStorage would leave
// the Mesh domain bound to a class the teacher is no longer logged in for.
const storedSession = loadSession();

// The teacher login itself (#1199) is restored by silent re-authentication
// (classroom-teacher-menu.jsx); only the last opened assignment is read here
// so the menu can offer "いまの課題を開く" once the login comes back.
const storedTeacherSession = loadTeacherSession();

const initialState = {
    modalVisible: false,
    teacherModalVisible: false,
    role: storedSession ? 'student' : null,
    classroomId: storedSession?.classroomId || null,
    className: storedSession?.className || null,
    classYear: typeof storedSession?.classYear === 'number' ? storedSession.classYear : null,
    assignmentName: storedSession?.assignmentName || null,
    joinCode: storedSession?.joinCode || null,
    seatNumber: storedSession?.seatNumber || null,
    memberId: storedSession?.memberId || null,
    sessionToken: storedSession?.sessionToken || null,
    joinedAt: storedSession?.joinedAt || null,
    submissionStatus: storedSession?.submissionStatus || null,
    lastSubmittedAt: storedSession?.lastSubmittedAt || null,
    // Whether the student's class lets them use Rubytee (#1278), from the
    // join / verify-session response (`rubytee.enabled`). Persisted with the
    // session so a reload keeps the Ruby tab's AI button until the next verify.
    rubyteeEnabled: storedSession?.rubyteeEnabled === true,
    // Data URI of the stage frame the student manually picked as their submission
    // thumbnail. Transient (not persisted); null falls back to auto-capture at submit.
    submissionThumbnail: null,
    reloginRequested: false,
    teacherSelection: null,
    // Teacher menu in the menu bar (#1199). teacherLoggedIn mirrors whether an
    // ID token is held in memory (use-teacher-auth.js) — the token itself is
    // never put in Redux.
    teacherLoggedIn: false,
    teacherUnreadCount: 0,
    teacherLastSelection:
        storedTeacherSession && storedTeacherSession.classroomId
            ? { classroomId: storedTeacherSession.classroomId, groupId: storedTeacherSession.groupId }
            : null,
    // Pending jump requested from the teacher menu, consumed by the teacher modal.
    teacherNavTarget: null,
    // Member to show once the jump above lands on the assignment (#1203).
    teacherNavMemberId: null,
    // Pending kick requests across the teacher's assignments, polled while
    // logged in (#1200), and whether the list opened from the menu is shown.
    teacherKickRequests: [],
    teacherKickListOpen: false,
    // Floating "いまの課題の状況" panel (#1203).
    teacherPanelOpen: false,
    // Student's "みんなの作品を見る" (#1210): the assignment's peer view setting
    // as last read from the server (null = not known yet; not persisted, so a
    // changed setting is picked up again) and whether the floating panel is shown.
    studentPeerView: null,
    studentPeerPanelOpen: false,
    // A class load of a mesh project asked for the mesh connection modal
    // (#1251); opened by ClassroomMeshConnectPrompt once no classroom modal
    // is in the way, then cleared so it is shown only once per load.
    meshConnectPending: false,
    // The class's generative AI as last told by join / verify-session (#1279).
    // Persisted with the session so the face is there again after a reload.
    studentGenai: normalizeStudentGenai(storedSession?.studentGenai),
};

const reducer = (state, action) => {
    if (typeof state === 'undefined') state = initialState;
    switch (action.type) {
        case OPEN_MODAL:
            return { ...state, modalVisible: true };
        case CLOSE_MODAL:
            return { ...state, modalVisible: false };
        case OPEN_TEACHER_MODAL:
            return { ...state, teacherModalVisible: true };
        case CLOSE_TEACHER_MODAL:
            return { ...state, teacherModalVisible: false };
        case SET_SESSION: {
            const session = {
                role: action.role,
                classroomId: action.classroomId,
                className: action.className,
                classYear: typeof action.classYear === 'number' ? action.classYear : null,
                assignmentName: action.assignmentName,
                joinCode: action.joinCode,
                seatNumber: action.seatNumber,
                memberId: action.memberId,
                sessionToken: action.sessionToken,
                joinedAt: action.joinedAt || new Date().toISOString(),
                // Another class has its own setting; join / verify-session tells it.
                studentGenai:
                    action.classroomId === state.classroomId ? state.studentGenai : normalizeStudentGenai(null),
                rubyteeEnabled: action.rubyteeEnabled === true,
            };
            if (action.role === 'student' && action.sessionToken) {
                saveSession(session);
            }
            if (action.classroomId !== state.classroomId) {
                return { ...state, ...session, studentPeerView: null, studentPeerPanelOpen: false };
            }
            return { ...state, ...session };
        }
        case CLEAR_SESSION:
            clearStoredSession();
            return {
                ...state,
                role: null,
                classroomId: null,
                className: null,
                classYear: null,
                assignmentName: null,
                joinCode: null,
                seatNumber: null,
                memberId: null,
                sessionToken: null,
                joinedAt: null,
                submissionStatus: null,
                lastSubmittedAt: null,
                rubyteeEnabled: false,
                submissionThumbnail: null,
                reloginRequested: false,
                studentPeerView: null,
                studentPeerPanelOpen: false,
                meshConnectPending: false,
                studentGenai: normalizeStudentGenai(null),
            };
        case SET_SUBMISSION_THUMBNAIL:
            return { ...state, submissionThumbnail: action.submissionThumbnail };
        case CLEAR_SUBMISSION_THUMBNAIL:
            return { ...state, submissionThumbnail: null };
        case SET_SUBMISSION_STATUS: {
            const updates = {
                submissionStatus: action.submissionStatus,
                lastSubmittedAt: action.lastSubmittedAt || state.lastSubmittedAt,
            };
            // Persist to localStorage
            if (state.role === 'student' && state.sessionToken) {
                saveSession({ ...state, ...updates });
            }
            return { ...state, ...updates };
        }
        case SET_RUBYTEE_ENABLED: {
            const updates = { rubyteeEnabled: action.enabled === true };
            if (state.role === 'student' && state.sessionToken) {
                saveSession({ ...state, ...updates });
            }
            return { ...state, ...updates };
        }
        case REQUEST_RELOGIN:
            return { ...state, reloginRequested: true };
        case SET_TEACHER_SELECTION: {
            const selection = {
                classroomId: action.classroomId,
                joinCode: action.joinCode,
                className: action.className || null,
                assignmentName: action.assignmentName || null,
            };
            return { ...state, teacherSelection: selection };
        }
        case CLEAR_TEACHER_SELECTION:
            return { ...state, teacherSelection: null };
        case SET_TEACHER_LOGGED_IN:
            if (action.loggedIn) return { ...state, teacherLoggedIn: true };
            return {
                ...state,
                teacherLoggedIn: false,
                teacherUnreadCount: 0,
                teacherLastSelection: null,
                teacherNavTarget: null,
                teacherNavMemberId: null,
                teacherKickRequests: [],
                teacherKickListOpen: false,
                teacherPanelOpen: false,
            };
        case SET_TEACHER_UNREAD_COUNT:
            return { ...state, teacherUnreadCount: action.unreadCount || 0 };
        case SET_TEACHER_LAST_SELECTION:
            return { ...state, teacherLastSelection: action.selection };
        case REQUEST_TEACHER_NAVIGATION:
            return {
                ...state,
                teacherModalVisible: true,
                teacherNavTarget: action.target,
                teacherNavMemberId: action.memberId || null,
            };
        case CLEAR_TEACHER_NAVIGATION:
            return { ...state, teacherNavTarget: null, teacherNavMemberId: null };
        case SET_TEACHER_KICK_REQUESTS:
            return { ...state, teacherKickRequests: action.requests || [] };
        case REMOVE_TEACHER_KICK_REQUEST: {
            // Approving frees the seat and the backend deletes every request
            // for it, so the seat's other requests go too (not just this one).
            const { seat } = action;
            const sameSeat = (r) => !!seat && r.classroomId === seat.classroomId && r.seatNumber === seat.seatNumber;
            return {
                ...state,
                teacherKickRequests: state.teacherKickRequests.filter(
                    (r) => r.requestId !== action.requestId && !sameSeat(r),
                ),
            };
        }
        case OPEN_TEACHER_KICK_LIST:
            return { ...state, teacherKickListOpen: true };
        case CLOSE_TEACHER_KICK_LIST:
            return { ...state, teacherKickListOpen: false };
        case OPEN_TEACHER_PANEL:
            return { ...state, teacherPanelOpen: true };
        case CLOSE_TEACHER_PANEL:
            return { ...state, teacherPanelOpen: false };
        case SET_STUDENT_PEER_VIEW:
            return { ...state, studentPeerView: action.peerView || null };
        case OPEN_STUDENT_PEER_PANEL:
            return { ...state, studentPeerPanelOpen: true };
        case CLOSE_STUDENT_PEER_PANEL:
            return { ...state, studentPeerPanelOpen: false };
        case REQUEST_MESH_CONNECT:
            return { ...state, meshConnectPending: true };
        case CLEAR_MESH_CONNECT_REQUEST:
            return { ...state, meshConnectPending: false };
        case SET_STUDENT_GENAI: {
            const studentGenai = normalizeStudentGenai(action.genai);
            if (state.role === 'student' && state.sessionToken) {
                saveSession({ ...state, studentGenai });
            }
            return { ...state, studentGenai };
        }
        default:
            return state;
    }
};

const openClassroomModal = () => ({ type: OPEN_MODAL });
const closeClassroomModal = () => ({ type: CLOSE_MODAL });
const openTeacherModal = () => ({ type: OPEN_TEACHER_MODAL });
const closeTeacherModal = () => ({ type: CLOSE_TEACHER_MODAL });

const setClassroomSession = ({
    role,
    classroomId,
    className,
    classYear,
    assignmentName,
    joinCode,
    seatNumber,
    memberId,
    sessionToken,
    joinedAt,
    rubyteeEnabled,
}) => ({
    type: SET_SESSION,
    role,
    classroomId,
    className,
    classYear,
    assignmentName,
    joinCode,
    seatNumber,
    memberId,
    sessionToken,
    joinedAt,
    rubyteeEnabled,
});

const clearClassroomSession = () => ({ type: CLEAR_SESSION });
const requestRelogin = () => ({ type: REQUEST_RELOGIN });

const setSubmissionStatus = (submissionStatus, lastSubmittedAt) => ({
    type: SET_SUBMISSION_STATUS,
    submissionStatus,
    lastSubmittedAt,
});

const setSubmissionThumbnail = (submissionThumbnail) => ({
    type: SET_SUBMISSION_THUMBNAIL,
    submissionThumbnail,
});

const clearSubmissionThumbnail = () => ({ type: CLEAR_SUBMISSION_THUMBNAIL });

const setTeacherSelection = ({ classroomId, joinCode, className, assignmentName }) => ({
    type: SET_TEACHER_SELECTION,
    classroomId,
    joinCode,
    className,
    assignmentName,
});

const clearTeacherSelection = () => ({ type: CLEAR_TEACHER_SELECTION });

const setTeacherLoggedIn = (loggedIn) => ({ type: SET_TEACHER_LOGGED_IN, loggedIn: !!loggedIn });
const setTeacherUnreadCount = (unreadCount) => ({ type: SET_TEACHER_UNREAD_COUNT, unreadCount });
const setTeacherLastSelection = (selection) => ({ type: SET_TEACHER_LAST_SELECTION, selection });
/**
 * Ask the teacher modal to open at `target` (#1199).
 * @param {string} target - 'current-assignment' | 'class-list' | 'notifications'
 * @param {?string} [memberId] - with 'current-assignment', the member to show (#1203)
 * @returns {object} action
 */
const requestTeacherNavigation = (target, memberId = null) => ({
    type: REQUEST_TEACHER_NAVIGATION,
    target,
    memberId,
});
const clearTeacherNavigation = () => ({ type: CLEAR_TEACHER_NAVIGATION });
const setTeacherKickRequests = (requests) => ({ type: SET_TEACHER_KICK_REQUESTS, requests });
/**
 * Drop a handled kick request from the teacher's pending list (#1200).
 * @param {string} requestId - the handled request
 * @param {{classroomId: string, seatNumber: number}} [seat] - when approved, the
 *   freed seat: its other requests are removed too
 * @returns {object} action
 */
const removeTeacherKickRequest = (requestId, seat = null) => ({ type: REMOVE_TEACHER_KICK_REQUEST, requestId, seat });
const openTeacherKickList = () => ({ type: OPEN_TEACHER_KICK_LIST });
const closeTeacherKickList = () => ({ type: CLOSE_TEACHER_KICK_LIST });
const openTeacherPanel = () => ({ type: OPEN_TEACHER_PANEL });
const closeTeacherPanel = () => ({ type: CLOSE_TEACHER_PANEL });
/**
 * @param {?string} peerView - the assignment's peer view setting read from the server
 * @returns {object} action
 */
const setStudentPeerView = (peerView) => ({ type: SET_STUDENT_PEER_VIEW, peerView });
const openStudentPeerPanel = () => ({ type: OPEN_STUDENT_PEER_PANEL });
const closeStudentPeerPanel = () => ({ type: CLOSE_STUDENT_PEER_PANEL });
const requestMeshConnect = () => ({ type: REQUEST_MESH_CONNECT });
const clearMeshConnectRequest = () => ({ type: CLEAR_MESH_CONNECT_REQUEST });
/**
 * @param {?object} genai - `genai` of the join / verify-session response (#1275)
 * @returns {object} action
 */
const setStudentGenai = (genai) => ({ type: SET_STUDENT_GENAI, genai });

/**
 * Follow the class's Rubytee setting read again from verify-session (#1278).
 * @param {boolean} enabled - `rubytee.enabled` of the student's class
 * @returns {object} action
 */
const setRubyteeEnabled = (enabled) => ({ type: SET_RUBYTEE_ENABLED, enabled: enabled === true });

/**
 * Rubytee is offered only to a student who has joined a class whose teacher
 * turned it on (#1278). A teacher who has a class open is not offered it:
 * requests are recorded per seat and a teacher has none — to see what the
 * students get, the teacher joins the class as a student.
 * @param {object} state - root redux state
 * @returns {boolean} whether the Ruby tab shows the Rubytee button
 */
const selectRubyteeAvailable = (state) => {
    const classroom = state.scratchGui.classroom;
    return classroom.role === 'student' && !!classroom.sessionToken && classroom.rubyteeEnabled === true;
};

/**
 * What a Rubytee request carries for the relay's usage log (#1278 / #1276):
 * the class (assignment) id and the seat number only — never an e-mail or a name.
 * @param {object} state - root redux state
 * @returns {?{classroom: string, seat: string}} null outside a class
 */
let lastRubyteeUsage = null;
const selectRubyteeUsage = (state) => {
    if (!selectRubyteeAvailable(state)) return null;
    const { classroomId, seatNumber } = state.scratchGui.classroom;
    if (!classroomId) return null;
    const classroom = String(classroomId);
    const seat = seatNumber === null || typeof seatNumber === 'undefined' ? '' : String(seatNumber);
    // Hand back the same object while the class and seat stay the same, so that
    // connect() does not re-render the Ruby tab's HOC on every store update.
    if (!lastRubyteeUsage || lastRubyteeUsage.classroom !== classroom || lastRubyteeUsage.seat !== seat) {
        lastRubyteeUsage = { classroom, seat };
    }
    return lastRubyteeUsage;
};

export default reducer;
export {
    initialState as classroomInitialState,
    openClassroomModal,
    closeClassroomModal,
    openTeacherModal,
    closeTeacherModal,
    setClassroomSession,
    clearClassroomSession,
    requestRelogin,
    setSubmissionStatus,
    setSubmissionThumbnail,
    clearSubmissionThumbnail,
    setTeacherSelection,
    clearTeacherSelection,
    setTeacherLoggedIn,
    setTeacherUnreadCount,
    setTeacherLastSelection,
    requestTeacherNavigation,
    clearTeacherNavigation,
    setTeacherKickRequests,
    removeTeacherKickRequest,
    openTeacherKickList,
    closeTeacherKickList,
    openTeacherPanel,
    closeTeacherPanel,
    setStudentPeerView,
    openStudentPeerPanel,
    closeStudentPeerPanel,
    requestMeshConnect,
    clearMeshConnectRequest,
    setStudentGenai,
    setRubyteeEnabled,
    selectRubyteeAvailable,
    selectRubyteeUsage,
};
