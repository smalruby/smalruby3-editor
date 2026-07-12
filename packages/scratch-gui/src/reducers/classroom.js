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
    // Data URI of the stage frame the student manually picked as their submission
    // thumbnail. Transient (not persisted); null falls back to auto-capture at submit.
    submissionThumbnail: null,
    reloginRequested: false,
    teacherSelection: null,
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
            };
            if (action.role === 'student' && action.sessionToken) {
                saveSession(session);
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
                submissionThumbnail: null,
                reloginRequested: false,
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
};
