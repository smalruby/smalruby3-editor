const OPEN_MODAL = 'scratch-gui/classroom/OPEN_MODAL';
const CLOSE_MODAL = 'scratch-gui/classroom/CLOSE_MODAL';
const OPEN_TEACHER_MODAL = 'scratch-gui/classroom/OPEN_TEACHER_MODAL';
const CLOSE_TEACHER_MODAL = 'scratch-gui/classroom/CLOSE_TEACHER_MODAL';
const SET_SESSION = 'scratch-gui/classroom/SET_SESSION';
const CLEAR_SESSION = 'scratch-gui/classroom/CLEAR_SESSION';
const SET_SUBMISSION_STATUS = 'scratch-gui/classroom/SET_SUBMISSION_STATUS';
const REQUEST_RELOGIN = 'scratch-gui/classroom/REQUEST_RELOGIN';

const STORAGE_KEY = 'smalruby:classroom';

/**
 * Load classroom session from localStorage.
 * @returns {object|null} Stored session or null
 */
const loadSession = () => {
    if (typeof window === 'undefined' || !window.sessionStorage) return null;
    try {
        const raw = window.sessionStorage.getItem(STORAGE_KEY);
        if (!raw) return null;
        const data = JSON.parse(raw);
        if (data && data.sessionToken && data.classroomId) return data;
        return null;
    } catch {
        return null;
    }
};

/**
 * Save classroom session to localStorage.
 * @param {object} session - Session data to save
 */
const saveSession = session => {
    if (typeof window === 'undefined' || !window.sessionStorage) return;
    try {
        window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    } catch {
        // Ignore storage errors
    }
};

/**
 * Clear classroom session from localStorage.
 */
const clearStoredSession = () => {
    if (typeof window === 'undefined' || !window.sessionStorage) return;
    try {
        window.sessionStorage.removeItem(STORAGE_KEY);
    } catch {
        // Ignore storage errors
    }
};

const storedSession = loadSession();

const initialState = {
    modalVisible: false,
    teacherModalVisible: false,
    role: storedSession ? 'student' : null,
    classroomId: storedSession?.classroomId || null,
    className: storedSession?.className || null,
    assignmentName: storedSession?.assignmentName || null,
    joinCode: storedSession?.joinCode || null,
    seatNumber: storedSession?.seatNumber || null,
    memberId: storedSession?.memberId || null,
    sessionToken: storedSession?.sessionToken || null,
    joinedAt: storedSession?.joinedAt || null,
    submissionStatus: storedSession?.submissionStatus || null,
    lastSubmittedAt: storedSession?.lastSubmittedAt || null,
    reloginRequested: false,
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
                assignmentName: null,
                joinCode: null,
                seatNumber: null,
                memberId: null,
                sessionToken: null,
                joinedAt: null,
                submissionStatus: null,
                lastSubmittedAt: null,
                reloginRequested: false,
            };
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
};
