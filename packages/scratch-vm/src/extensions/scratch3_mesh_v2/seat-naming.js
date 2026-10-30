/**
 * Seat numbers (出席番号) in mesh group names and node ids.
 *
 * Inside a classroom, a group name keeps the host node id as its head and
 * appends seat information after `|`:
 *
 *   <hostNodeId>|seats=3,7,12|host=3
 *   <hostNodeId>|host=7
 *   <hostNodeId>|host=teacher
 *
 * The head is untouched so that old clients still derive the same 6-letter
 * label (makeMeshIdLabel uses the first 6 chars) and `searchGroupsByNamePrefix`
 * (a prefix match on the name) keeps finding the group. The mesh server
 * stores the name as an opaque string, so no server change is needed.
 *
 * A node id gets a `s<NN>` suffix (e.g. `…s07`). Node ids are uuid hex
 * (no `s`), so the suffix can be told apart and stripped again.
 *
 * Group names come from other clients and the server stores them as they are
 * (it checks neither the length nor the characters), so parseGroupName is
 * strict: anything outside the format, too long, or inconsistent is treated
 * as "no seat info". The seat info is still only what the host claims about
 * itself; it is a hint for the list, never a proof of who the host is.
 */

const TEACHER_HOST = 'teacher';
const SEPARATOR = '|';
const SEAT_RE = /^[1-9]\d{0,2}$/;
const NODE_SEAT_RE = /s(\d+)$/;
// The head of a seat-carrying name is a node id: uuid hex plus an optional seat suffix.
const NODE_ID_RE = /^[0-9a-f]{1,64}(?:s\d{2,3})?$/;
// Upper bounds for names from other clients (a class has at most a few dozen seats).
const MAX_SEAT = 999;
const MAX_SEATS = 100;
const MAX_GROUP_NAME_LENGTH = 512;

const isSeat = value => Number.isInteger(value) && value > 0 && value <= MAX_SEAT;

const parseSeat = text => (SEAT_RE.test(text) ? Number(text) : null);

/**
 * @param {string} nodeId - node id.
 * @returns {?number} the seat number in the node id, or null.
 */
const parseNodeSeat = nodeId => {
    if (typeof nodeId !== 'string') return null;
    const match = NODE_SEAT_RE.exec(nodeId);
    if (!match) return null;
    const seat = Number(match[1]);
    return isSeat(seat) ? seat : null;
};

/**
 * Build a group name with seat information.
 * @param {string} hostNodeId - node id of the host (the head of the name).
 * @param {{seats: Array<number>, host: (number|string)}} [info] - seat information.
 *   `host` is a seat number or TEACHER_HOST. Invalid values are dropped.
 * @returns {string} the group name. Without valid seat info it is `hostNodeId`.
 */
const buildGroupName = (hostNodeId, info) => {
    const parts = [hostNodeId];
    if (info) {
        const seats = Array.isArray(info.seats) ?
            [...new Set(info.seats.filter(isSeat))].sort((a, b) => a - b) :
            [];
        if (seats.length > 0) parts.push(`seats=${seats.join(',')}`);
        if (isSeat(info.host) || info.host === TEACHER_HOST) parts.push(`host=${info.host}`);
    }
    return parts.join(SEPARATOR);
};

/**
 * Read seat information from a group name.
 * `host=<seat>` must match the seat suffix of the head (the host's node id),
 * and `host=teacher` needs a head without a suffix.
 * @param {string} name - group name.
 * @returns {?{baseName: string, seats: Array<number>, host: (number|string|null)}}
 *   seat information, or null for a legacy name or a malformed one.
 */
const parseGroupName = name => {
    if (typeof name !== 'string' || name.length > MAX_GROUP_NAME_LENGTH) return null;
    const [baseName, ...segments] = name.split(SEPARATOR);
    if (!NODE_ID_RE.test(baseName) || segments.length === 0) return null;
    const result = {baseName, seats: [], host: null};
    const seen = new Set();
    for (const segment of segments) {
        const eq = segment.indexOf('=');
        if (eq <= 0) return null;
        const key = segment.slice(0, eq);
        const value = segment.slice(eq + 1);
        if (seen.has(key)) return null;
        seen.add(key);
        if (key === 'seats') {
            const seats = value.split(',').map(parseSeat);
            if (seats.length > MAX_SEATS || seats.some(seat => seat === null)) return null;
            if (new Set(seats).size !== seats.length) return null;
            result.seats = seats;
        } else if (key === 'host') {
            const host = value === TEACHER_HOST ? TEACHER_HOST : parseSeat(value);
            if (host === null) return null;
            result.host = host;
        } else {
            return null;
        }
    }
    if (result.host !== null) {
        const headSeat = parseNodeSeat(baseName);
        if (result.host === TEACHER_HOST ? headSeat !== null : headSeat !== result.host) return null;
    }
    return result;
};

/**
 * @param {number} seat - seat number.
 * @returns {string} the node id suffix (`s07`), or '' for no seat.
 */
const seatNodeIdSuffix = seat => (isSeat(seat) ? `s${String(seat).padStart(2, '0')}` : '');

/**
 * @param {string} nodeId - node id, with or without a seat suffix.
 * @returns {string} the node id without a seat suffix.
 */
const stripSeatSuffix = nodeId => String(nodeId).replace(NODE_SEAT_RE, '');

/**
 * @param {string} nodeId - base node id.
 * @param {?number} seat - seat number, or null outside a classroom.
 * @returns {string} the node id carrying `seat` (an old suffix is replaced).
 */
const withSeatSuffix = (nodeId, seat) => stripSeatSuffix(nodeId) + seatNodeIdSuffix(seat);

module.exports = {
    TEACHER_HOST,
    buildGroupName,
    parseGroupName,
    seatNodeIdSuffix,
    withSeatSuffix,
    stripSeatSuffix,
    parseNodeSeat
};
