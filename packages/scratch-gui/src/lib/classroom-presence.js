/**
 * Student presence ("seated") for the classroom feature (issue #1197).
 *
 * The student GUI pings `POST /classrooms/heartbeat` every
 * HEARTBEAT_INTERVAL_MS while it holds a session, and the teacher views treat
 * a member as seated while their `lastActiveAt` is within SEATED_THRESHOLD_MS.
 * Both live here so the two sides cannot drift apart.
 */

const DEFAULT_HEARTBEAT_INTERVAL_MS = 2 * 60 * 1000;

const parsedInterval = parseInt(process.env.CLASSROOM_HEARTBEAT_INTERVAL_MS || '', 10);

/** How often a joined student refreshes `lastActiveAt`. */
const HEARTBEAT_INTERVAL_MS = parsedInterval > 0 ? parsedInterval : DEFAULT_HEARTBEAT_INTERVAL_MS;

/**
 * How long after the last ping a member still counts as seated. 2.5 intervals
 * tolerates one late or dropped ping (slow network, a tab hidden for a moment)
 * so the indicator does not flicker, while a student who left drops out within
 * a few minutes instead of the old one hour.
 */
const SEATED_THRESHOLD_MS = HEARTBEAT_INTERVAL_MS * 2.5;

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

export { HEARTBEAT_INTERVAL_MS, SEATED_THRESHOLD_MS, isMemberSeated };
