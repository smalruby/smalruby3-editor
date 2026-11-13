/**
 * Pure helpers for the student seat-selection screen (#1198).
 *
 * In a real lesson a student whose seat was already taken did not know how
 * to get it back and stayed out of the class until late. The screen now
 * accepts a typed seat number, explains how to ask for an occupied seat,
 * and joins automatically once the teacher frees it. The decisions behind
 * that flow live here so they can be unit-tested without React.
 */

// After this long without picking a seat, a guide appears next to the grid
// and the occupied seats glow once: some students do not dare to press a
// seat marked "in use" even when it is their own (#1796).
const SEAT_IDLE_HINT_MS = 30 * 1000;

// Lookup polling while a kick request is pending. It only runs while the
// request is alive (at most the 1h TTL) and the tab is visible, so the
// worst case is 720 requests per pending request.
const KICK_REQUEST_POLL_INTERVAL_MS = 5 * 1000;

// Full-width digits typed through a Japanese IME ("１２") are common on
// school PCs; normalize them before parsing.
const toHalfWidthDigits = (text) => text.replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0));

/**
 * Parse the seat number typed by the student.
 * @param {string|number|null} value - raw input value.
 * @param {number} seatCount - number of seats in the class.
 * @returns {{seat: (number|null), error: (string|null)}} `error` is one of
 *     `empty` / `invalid` / `outOfRange` when `seat` is null.
 */
const parseSeatNumberInput = (value, seatCount) => {
    const text = toHalfWidthDigits(String(value ?? '')).trim();
    if (text === '') return { seat: null, error: 'empty' };
    if (!/^\d+$/.test(text)) return { seat: null, error: 'invalid' };
    const seat = parseInt(text, 10);
    if (seat < 1 || seat > seatCount) return { seat: null, error: 'outOfRange' };
    return { seat, error: null };
};

/**
 * Decide what happens when the student picks a seat (typed or tapped).
 * @param {number} seat - chosen seat number.
 * @param {number[]} takenSeats - seats already in use.
 * @param {?object} pendingKickRequest - the outstanding kick request, if any.
 * @returns {string} `select` (free seat), `requestKick` (ask the teacher to
 *     free it) or `alreadyRequested` (one request at a time).
 */
const decideSeatAction = (seat, takenSeats, pendingKickRequest = null) => {
    if (!(takenSeats || []).includes(seat)) return 'select';
    if (pendingKickRequest) return 'alreadyRequested';
    return 'requestKick';
};

/**
 * Interpret a lookup response for a pending kick request.
 * @param {?object} pending - the pending request ({requestId, seatNumber}).
 * @param {object} lookup - lookupClassroom response.
 * @returns {?string} `approved` (seat freed), `rejected` (request gone but
 *     the seat is still taken: rejected or TTL expired), `waiting`, or null
 *     when there is no pending request.
 */
const evaluateKickRequestPoll = (pending, lookup) => {
    if (!pending) return null;
    const takenSeats = (lookup && lookup.takenSeats) || [];
    const activeIds = (lookup && lookup.activeKickRequestIds) || [];
    if (!takenSeats.includes(pending.seatNumber)) return 'approved';
    if (!activeIds.includes(pending.requestId)) return 'rejected';
    return 'waiting';
};

/**
 * Whether to keep polling for the teacher's answer. Forty students share a
 * classroom, so new periodic traffic is kept to the minimum: only while a
 * request is alive, the tab is visible and the student has not joined.
 * @param {object} args - arguments.
 * @param {?object} args.pending - the pending request.
 * @param {boolean} args.visible - document is visible.
 * @param {boolean} args.hasSession - the student already joined a class.
 * @returns {boolean} true to poll.
 */
const shouldPollKickRequest = ({ pending, visible, hasSession }) => !!pending && !!visible && !hasSession;

/**
 * Whether the 30s idle count runs: only while the seat grid is shown and the
 * student is not waiting for anything (confirmation, kick dialog, pending
 * request). The count restarts each time this turns true again (#1796).
 * @param {object} args - arguments.
 * @param {?number} args.selectedSeat - seat in the join confirmation.
 * @param {?number} args.kickRequestDialogSeat - seat in the kick dialog.
 * @param {?object} args.kickRequestPending - the outstanding kick request.
 * @returns {boolean} true while counting.
 */
const isSeatIdleCounting = ({ selectedSeat, kickRequestDialogSeat, kickRequestPending }) =>
    !selectedSeat && !kickRequestDialogSeat && !kickRequestPending;

/**
 * Which guide to show to the right of the grid, and whether the occupied
 * seats glow once (#1796). A previous seat that is now in use is most often
 * the student's own seat left over from the last lesson, so its guide shows
 * at once instead of after 30 seconds.
 * @param {object} args - arguments.
 * @param {?number} args.previousSeat - seat this PC joined last time.
 * @param {number[]} args.takenSeats - seats in use.
 * @param {boolean} args.idle - SEAT_IDLE_HINT_MS passed without a pick.
 * @param {boolean} args.counting - see isSeatIdleCounting.
 * @returns {{guide: (string|null), flashTaken: boolean}} `guide` is
 *     `previousTaken`, `idle` or null.
 */
const seatGuideFor = ({ previousSeat, takenSeats, idle, counting }) => {
    const taken = takenSeats || [];
    if (!counting || taken.length === 0) return { guide: null, flashTaken: false };
    const flashTaken = !!idle;
    if (previousSeat && taken.includes(previousSeat)) return { guide: 'previousTaken', flashTaken };
    return { guide: idle ? 'idle' : null, flashTaken };
};

// --- Previous seat on this PC (localStorage `smalruby:classroom:lastSeats`) ---

// A shared PC sees a few classes a year; keep the map from growing forever
// with one entry per assignment that is not in a class.
const MAX_LAST_SEATS = 100;

const isSeatNumber = (seat) => Number.isInteger(seat) && seat > 0;

/**
 * Key under which a seat is remembered: the class (group) so the number
 * carries over to the next assignment of the same class, or the assignment
 * itself when it is not in a class.
 * @param {?object} lookup - POST /classrooms/lookup response.
 * @returns {?string} `group:<groupId>`, `assignment:<classroomId>` or null.
 */
const lastSeatKeyFor = (lookup) => {
    if (!lookup) return null;
    if (lookup.groupId) return `group:${lookup.groupId}`;
    if (lookup.classroomId) return `assignment:${lookup.classroomId}`;
    return null;
};

/**
 * Parse the stored map, dropping anything that is not a seat number.
 * @param {?string} raw - stored JSON.
 * @returns {object} key to seat number.
 */
const parseLastSeats = (raw) => {
    if (!raw) return {};
    let data;
    try {
        data = JSON.parse(raw);
    } catch {
        return {};
    }
    if (!data || typeof data !== 'object' || Array.isArray(data)) return {};
    const seats = {};
    Object.keys(data).forEach((key) => {
        if (isSeatNumber(data[key])) seats[key] = data[key];
    });
    return seats;
};

/**
 * The seat remembered for this class, if it still exists in it.
 * @param {object} seats - key to seat number.
 * @param {?string} key - see lastSeatKeyFor.
 * @param {number} seatCount - seats in the class now.
 * @returns {?number} seat number or null.
 */
const recallSeatFrom = (seats, key, seatCount) => {
    if (!key || !seats) return null;
    const seat = seats[key];
    if (!isSeatNumber(seat) || seat > seatCount) return null;
    return seat;
};

/**
 * Remember the seat the student joined with (most recent last).
 * @param {object} seats - key to seat number.
 * @param {?string} key - see lastSeatKeyFor.
 * @param {number} seat - joined seat.
 * @returns {object} new map.
 */
const rememberSeatIn = (seats, key, seat) => {
    if (!key || !isSeatNumber(seat)) return seats;
    const next = { ...seats };
    delete next[key];
    next[key] = seat;
    const keys = Object.keys(next);
    keys.slice(0, Math.max(0, keys.length - MAX_LAST_SEATS)).forEach((k) => delete next[k]);
    return next;
};

/**
 * Forget a seat the student freed with "wrong number", so the next seat
 * screen does not point at the wrong seat again.
 * @param {object} seats - key to seat number.
 * @param {?string} key - see lastSeatKeyFor.
 * @param {number} seat - freed seat.
 * @returns {object} new map.
 */
const forgetSeatIn = (seats, key, seat) => {
    if (!key || seats[key] !== seat) return seats;
    const next = { ...seats };
    delete next[key];
    return next;
};

export {
    KICK_REQUEST_POLL_INTERVAL_MS,
    SEAT_IDLE_HINT_MS,
    decideSeatAction,
    evaluateKickRequestPoll,
    forgetSeatIn,
    isSeatIdleCounting,
    lastSeatKeyFor,
    parseLastSeats,
    parseSeatNumberInput,
    recallSeatFrom,
    rememberSeatIn,
    seatGuideFor,
    shouldPollKickRequest,
};
