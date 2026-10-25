/**
 * Pure helpers for the student seat-selection screen (#1198).
 *
 * In a real lesson a student whose seat was already taken did not know how
 * to get it back and stayed out of the class until late. The screen now
 * accepts a typed seat number, explains how to ask for an occupied seat,
 * and joins automatically once the teacher frees it. The decisions behind
 * that flow live here so they can be unit-tested without React.
 */

// After this long without picking a seat, the guide text starts moving to
// catch the student's eye.
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

export {
    KICK_REQUEST_POLL_INTERVAL_MS,
    SEAT_IDLE_HINT_MS,
    decideSeatAction,
    evaluateKickRequestPoll,
    parseSeatNumberInput,
    shouldPollKickRequest,
};
