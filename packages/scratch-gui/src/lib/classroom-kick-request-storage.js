/**
 * Pending kick request persistence (student side).
 *
 * The student may submit a request to free up an occupied seat, then close
 * the tab or reload before the teacher acts. We persist {joinCode,
 * seatNumber, requestId, createdAt} to localStorage so the seat-selection
 * screen can keep showing the "依頼中" banner across reloads.
 *
 * The record expires after KICK_REQUEST_FRESH_WINDOW_MS (default 1 hour) to
 * match the backend KICK_REQUEST_TTL_SECONDS. After that, the seat may
 * still be occupied but the local record is no longer useful — drop it.
 */

const STORAGE_KEY = 'smalruby:classroom:kickRequest';
const KICK_REQUEST_FRESH_WINDOW_MS = 60 * 60 * 1000;

const hasLocalStorage = () => typeof window !== 'undefined' && !!window.localStorage;

const loadPendingKickRequest = () => {
    if (!hasLocalStorage()) return null;
    let raw;
    try {
        raw = window.localStorage.getItem(STORAGE_KEY);
    } catch {
        return null;
    }
    if (!raw) return null;
    let data;
    try {
        data = JSON.parse(raw);
    } catch {
        try {
            window.localStorage.removeItem(STORAGE_KEY);
        } catch {
            // ignore
        }
        return null;
    }
    if (!data || !data.requestId || !data.joinCode || !data.seatNumber || !data.createdAt) {
        return null;
    }
    const age = Date.now() - new Date(data.createdAt).getTime();
    if (Number.isNaN(age) || age > KICK_REQUEST_FRESH_WINDOW_MS || age < 0) {
        // Stale beyond the backend TTL — drop it.
        try {
            window.localStorage.removeItem(STORAGE_KEY);
        } catch {
            // ignore
        }
        return null;
    }
    return data;
};

const savePendingKickRequest = (request) => {
    if (!hasLocalStorage()) return;
    if (!request || !request.requestId || !request.joinCode || !request.seatNumber) return;
    const payload = {
        requestId: request.requestId,
        joinCode: request.joinCode,
        seatNumber: request.seatNumber,
        reason: request.reason || null,
        createdAt: request.createdAt || new Date().toISOString(),
    };
    try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch {
        // ignore quota errors etc.
    }
};

const clearPendingKickRequest = () => {
    if (!hasLocalStorage()) return;
    try {
        window.localStorage.removeItem(STORAGE_KEY);
    } catch {
        // ignore
    }
};

export {
    STORAGE_KEY as KICK_REQUEST_STORAGE_KEY,
    KICK_REQUEST_FRESH_WINDOW_MS,
    loadPendingKickRequest,
    savePendingKickRequest,
    clearPendingKickRequest,
};
