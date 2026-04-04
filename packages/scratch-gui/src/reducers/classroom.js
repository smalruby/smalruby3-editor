const OPEN_MODAL = 'scratch-gui/classroom/OPEN_MODAL';
const CLOSE_MODAL = 'scratch-gui/classroom/CLOSE_MODAL';
const SET_SESSION = 'scratch-gui/classroom/SET_SESSION';
const CLEAR_SESSION = 'scratch-gui/classroom/CLEAR_SESSION';

const STORAGE_KEY = 'smalruby:classroom';

/**
 * Load classroom session from localStorage.
 * @returns {object|null} Stored session or null
 */
const loadSession = () => {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
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
    if (typeof window === 'undefined' || !window.localStorage) return;
    try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    } catch {
        // Ignore storage errors
    }
};

/**
 * Clear classroom session from localStorage.
 */
const clearStoredSession = () => {
    if (typeof window === 'undefined' || !window.localStorage) return;
    try {
        window.localStorage.removeItem(STORAGE_KEY);
    } catch {
        // Ignore storage errors
    }
};

const storedSession = loadSession();

const initialState = {
    modalVisible: false,
    role: storedSession ? 'student' : null,
    classroomId: storedSession?.classroomId || null,
    className: storedSession?.className || null,
    joinCode: storedSession?.joinCode || null,
    seatNumber: storedSession?.seatNumber || null,
    memberId: storedSession?.memberId || null,
    sessionToken: storedSession?.sessionToken || null,
    joinedAt: storedSession?.joinedAt || null,
};

const reducer = (state, action) => {
    if (typeof state === 'undefined') state = initialState;
    switch (action.type) {
        case OPEN_MODAL:
            return { ...state, modalVisible: true };
        case CLOSE_MODAL:
            return { ...state, modalVisible: false };
        case SET_SESSION: {
            const session = {
                role: action.role,
                classroomId: action.classroomId,
                className: action.className,
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
                joinCode: null,
                seatNumber: null,
                memberId: null,
                sessionToken: null,
                joinedAt: null,
            };
        default:
            return state;
    }
};

const openClassroomModal = () => ({ type: OPEN_MODAL });
const closeClassroomModal = () => ({ type: CLOSE_MODAL });

const setClassroomSession = ({ role, classroomId, className, joinCode, seatNumber, memberId, sessionToken, joinedAt }) => ({
    type: SET_SESSION,
    role,
    classroomId,
    className,
    joinCode,
    seatNumber,
    memberId,
    sessionToken,
    joinedAt,
});

const clearClassroomSession = () => ({ type: CLEAR_SESSION });

export default reducer;
export {
    initialState as classroomInitialState,
    openClassroomModal,
    closeClassroomModal,
    setClassroomSession,
    clearClassroomSession,
};
