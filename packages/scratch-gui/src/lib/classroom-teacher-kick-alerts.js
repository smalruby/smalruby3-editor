/**
 * Pure helpers for telling the teacher about kick requests (退室依頼) while
 * the class management modal is closed (#1200).
 *
 * The teacher's GUI polls `GET /kick-requests/pending` every 10 seconds while
 * logged in: the class cannot go on until the seat is freed, so the teacher
 * is allowed a short interval (students are not — #1197).
 */

const parseInterval = (raw, fallback) => {
    const value = parseInt(raw, 10);
    return Number.isFinite(value) && value > 0 ? value : fallback;
};

const TEACHER_KICK_POLL_INTERVAL_MS = parseInterval(process.env.CLASSROOM_TEACHER_KICK_POLL_INTERVAL_MS, 10 * 1000);

// How long the bottom toast stays up for a new request.
const TEACHER_KICK_TOAST_DURATION_MS = 30 * 1000;

// Consecutive errors double the interval up to this cap, so an outage or an
// expired login does not keep hitting the API every 10 seconds.
const TEACHER_KICK_MAX_BACKOFF_MS = 5 * 60 * 1000;

// With no active assignment there can be no request; ask much less often
// (an assignment created later is still picked up within a minute).
const TEACHER_KICK_IDLE_MULTIPLIER = 6;

/**
 * @param {object} params - inputs
 * @param {boolean} params.loggedIn - a teacher is logged in
 * @param {boolean} params.visible - the tab is visible
 * @returns {boolean} whether the poller should run
 */
const shouldPollTeacherKickRequests = ({ loggedIn, visible }) => !!loggedIn && !!visible;

/**
 * Delay before the next poll.
 * @param {object} params - inputs
 * @param {number} params.baseMs - normal interval
 * @param {number} params.failures - consecutive failed polls
 * @param {?number} params.activeAssignmentCount - from the last response (null when unknown)
 * @returns {number} delay in ms
 */
const nextTeacherKickPollDelay = ({ baseMs, failures, activeAssignmentCount }) => {
    if (failures > 0) {
        return Math.min(baseMs * 2 ** failures, TEACHER_KICK_MAX_BACKOFF_MS);
    }
    if (activeAssignmentCount === 0) return baseMs * TEACHER_KICK_IDLE_MULTIPLIER;
    return baseMs;
};

/**
 * Request ids the teacher has not been shown yet.
 * @param {Set<string>} seenIds - ids already announced
 * @param {Array<{requestId: string}>} requests - pending requests
 * @returns {Array<string>} new ids, in request order
 */
const newKickRequestIds = (seenIds, requests) =>
    (requests || []).map((r) => r.requestId).filter((id) => !seenIds.has(id));

/**
 * What the toast shows: the oldest request in full and how many more there are,
 * so several requests are summarized instead of stacking toasts.
 * @param {Array<object>} requests - pending requests, oldest first
 * @returns {{count: number, first: ?object, others: number}} summary
 */
const summarizeKickRequests = (requests) => {
    const list = requests || [];
    return { count: list.length, first: list[0] || null, others: Math.max(0, list.length - 1) };
};

export {
    TEACHER_KICK_POLL_INTERVAL_MS,
    TEACHER_KICK_TOAST_DURATION_MS,
    TEACHER_KICK_MAX_BACKOFF_MS,
    TEACHER_KICK_IDLE_MULTIPLIER,
    shouldPollTeacherKickRequests,
    nextTeacherKickPollDelay,
    newKickRequestIds,
    summarizeKickRequests,
};
