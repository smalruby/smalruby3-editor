/**
 * Student presence ("seated") for the classroom feature (issue #1197).
 *
 * `lastActiveAt` is refreshed only by join and verify-session (when the student
 * opens the classroom modal) — there is deliberately no periodic heartbeat, to
 * keep API traffic down. "Seated" is therefore a rough hint: before approving a
 * seat-release (kick) request the teacher confirms in the classroom anyway.
 * The threshold lives here so every teacher view uses the same rule.
 */

/** How long after the last activity a member still counts as seated. */
const SEATED_THRESHOLD_MS = 60 * 60 * 1000;

/**
 * Whether a classroom member is currently at their seat.
 * @param {?object} member - member row from the members API (`lastActiveAt` ISO string)
 * @param {number} [now] - current time in ms epoch (defaults to Date.now())
 * @returns {boolean} true while the last activity is within SEATED_THRESHOLD_MS
 */
const isMemberSeated = (member, now = Date.now()) => {
    if (!member || !member.lastActiveAt) return false;
    const last = new Date(member.lastActiveAt).getTime();
    if (Number.isNaN(last)) return false;
    return now - last < SEATED_THRESHOLD_MS;
};

export { SEATED_THRESHOLD_MS, isMemberSeated };
