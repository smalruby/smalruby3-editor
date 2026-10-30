// Rules for "出席番号でつながる" (connect by seat number).
//
// The connection modal shows what these functions return and nothing more,
// so every decision (who hosts, whether to create / join / wait, which of two
// groups survives, how each seat is shown) lives here as a pure function.
//
// A group is given as {id, seatInfo, memberSeats}:
// - `seatInfo` is the parsed group name from the VM (`seatInfo` on a meshV2
//   peripheral, see scratch3_mesh_v2/seat-naming.js), or null.
// - `memberSeats` are the seats found in the group's node ids
//   (`listNodesInGroup` + `parseNodeSeat`). The host is a member too.
//
// Seat info is only what the host claims about itself; these rules use it to
// meet up, never to decide who may do what.
import { TEACHER_HOST } from '@smalruby/scratch-vm/src/extensions/scratch3_mesh_v2/seat-naming';

// A host who is in the class but has not opened mesh yet is skipped after this.
const HOST_WAIT_MS = 20 * 1000;
// "そろいました" stays this long before the modal closes by itself.
const ALL_ARRIVED_CLOSE_MS = 2000;
// `meshGroupLimit` of an assignment: 0 means no limit.
const NO_GROUP_LIMIT = 0;

const SEAT_STATUS = {
    ME: 'me',
    JOINED: 'joined',
    WAITING: 'waiting',
    ABSENT: 'absent',
    ELSEWHERE: 'elsewhere',
};

const ACTION = {
    CREATE: 'create',
    JOIN: 'join',
    WAIT: 'wait',
};

const isSeat = (value) => Number.isInteger(value) && value > 0;

const sortedSeats = (seats) => [...new Set((seats || []).filter(isSeat))].sort((a, b) => a - b);

/**
 * Normalize `meshGroupLimit` from the classroom API. A missing value (an
 * assignment made before the setting, or an API not deployed yet) means no limit.
 * @param {*} value - `meshGroupLimit` from the lookup / join response.
 * @returns {number} the limit, or 0 for no limit.
 */
const normalizeGroupLimit = (value) => (Number.isInteger(value) && value > 0 ? value : NO_GROUP_LIMIT);

/**
 * @param {{seatInfo: ?object}} group - group.
 * @returns {?number} the seat of the group's host, or null (teacher / legacy / unknown).
 */
const groupHostSeat = (group) => {
    const info = group && group.seatInfo;
    if (!info || info.host === TEACHER_HOST) return null;
    return isSeat(info.host) ? info.host : null;
};

/**
 * @param {{seatInfo: ?object}} group - group.
 * @returns {Array<number>} the seats the group was made for (with its host).
 */
const groupSeats = (group) => {
    const info = group && group.seatInfo;
    if (!info) return [];
    return sortedSeats([...(info.seats || []), groupHostSeat(group)]);
};

/**
 * @param {{memberSeats: ?Array<number>}} group - group.
 * @returns {Array<number>} the seats already connected to the group.
 */
const groupMemberSeats = (group) => sortedSeats(group && group.memberSeats);

/**
 * Whether a group is for a seat: the seat is named in it or already connected.
 * @param {object} group - group.
 * @param {number} seat - seat number.
 * @returns {boolean} true if the group includes `seat`.
 */
const groupIncludesSeat = (group, seat) => groupSeats(group).includes(seat) || groupMemberSeats(group).includes(seat);

/**
 * Of several groups, the one that survives: the smallest host seat.
 * Groups without a host seat come last; ties keep the given order.
 * @param {Array<object>} groups - groups.
 * @returns {?object} the surviving group, or null for none.
 */
const pickSurvivingGroup = (groups) => {
    let best = null;
    let bestSeat = Infinity;
    for (const group of groups) {
        const host = groupHostSeat(group);
        const rank = host === null ? Infinity : host;
        if (best === null || rank < bestSeat) {
            best = group;
            bestSeat = rank;
        }
    }
    return best;
};

/**
 * Who should host: the smallest chosen seat present in the class. A present
 * host that has not opened mesh is skipped every HOST_WAIT_MS, but never past
 * the student asking (they can always create the group themselves).
 * @param {object} params - parameters.
 * @param {Array<number>} params.chosenSeats - chosen seats (with mySeat).
 * @param {Array<number>} params.presentSeats - seats present in the class (`takenSeats`).
 * @param {number} params.mySeat - own seat.
 * @param {number} [params.elapsedMs] - time since waiting started.
 * @returns {number} the host seat.
 */
const pickHostSeat = ({ chosenSeats, presentSeats, mySeat, elapsedMs = 0 }) => {
    const present = new Set(presentSeats || []);
    const candidates = sortedSeats([...(chosenSeats || []), mySeat]).filter(
        (seat) => seat === mySeat || present.has(seat),
    );
    const skipped = Math.max(0, Math.floor(elapsedMs / HOST_WAIT_MS));
    return candidates[Math.min(skipped, candidates.indexOf(mySeat))];
};

/**
 * What to do now: create a group, join one, or wait for the host.
 * A group that already has the student's seat always wins over creating,
 * so a late host joins the group made in their place.
 * @param {object} params - parameters.
 * @param {Array<object>} params.groups - groups in the class domain.
 * @param {Array<number>} params.chosenSeats - chosen seats (with mySeat).
 * @param {Array<number>} params.presentSeats - seats present in the class.
 * @param {number} params.mySeat - own seat.
 * @param {number} [params.elapsedMs] - time since waiting started.
 * @returns {{action: string, hostSeat: number, groupId?: string, seats?: Array<number>}} the decision.
 */
const decideSeatAction = ({ groups, chosenSeats, presentSeats, mySeat, elapsedMs = 0 }) => {
    const mine = (groups || []).filter((group) => groupIncludesSeat(group, mySeat));
    const survivor = pickSurvivingGroup(mine);
    if (survivor) {
        return { action: ACTION.JOIN, groupId: survivor.id, hostSeat: groupHostSeat(survivor) };
    }
    const hostSeat = pickHostSeat({ chosenSeats, presentSeats, mySeat, elapsedMs });
    if (hostSeat === mySeat) {
        return { action: ACTION.CREATE, hostSeat, seats: sortedSeats([...(chosenSeats || []), mySeat]) };
    }
    return { action: ACTION.WAIT, hostSeat };
};

/**
 * While hosting, whether to give up the own group: another group includes
 * the own seat and has a smaller host seat. The members of the dissolved
 * group then find the surviving group by themselves (decideSeatAction).
 * @param {object} params - parameters.
 * @param {Array<object>} params.groups - groups in the class domain.
 * @param {string} params.myGroupId - id of the group the student hosts.
 * @param {number} params.mySeat - own seat.
 * @returns {?string} the id of the group to move to, or null to stay.
 */
const findGroupToMergeInto = ({ groups, myGroupId, mySeat }) => {
    const rivals = (groups || []).filter(
        (group) => group.id !== myGroupId && groupIncludesSeat(group, mySeat) && groupHostSeat(group) !== null,
    );
    const survivor = pickSurvivingGroup(rivals);
    if (!survivor || groupHostSeat(survivor) >= mySeat) return null;
    return survivor.id;
};

/**
 * How each chosen seat is shown while waiting and after connecting.
 * @param {object} params - parameters.
 * @param {Array<object>} params.groups - groups in the class domain.
 * @param {?string} params.groupId - the group the student is in or waits for, or null.
 * @param {Array<number>} params.chosenSeats - chosen seats (with mySeat).
 * @param {Array<number>} params.presentSeats - seats present in the class.
 * @param {number} params.mySeat - own seat.
 * @returns {Array<{seat: number, status: string, groupSeats?: Array<number>, host?: boolean}>}
 *   one entry per chosen seat. `elsewhere` carries the seats of the other group.
 */
const describeSeatStatuses = ({ groups, groupId, chosenSeats, presentSeats, mySeat }) => {
    const present = new Set(presentSeats || []);
    const all = groups || [];
    const target = all.find((group) => group.id === groupId) || null;
    const joined = new Set(target ? groupMemberSeats(target) : []);
    const hostSeat = target ? groupHostSeat(target) : null;
    return sortedSeats([...(chosenSeats || []), mySeat]).map((seat) => {
        const host = seat === hostSeat;
        if (seat === mySeat) return { seat, status: SEAT_STATUS.ME, host };
        if (joined.has(seat)) return { seat, status: SEAT_STATUS.JOINED, host };
        const other = all.find(
            (group) => group !== target && (groupMemberSeats(group).includes(seat) || groupHostSeat(group) === seat),
        );
        if (other) return { seat, status: SEAT_STATUS.ELSEWHERE, groupSeats: groupSeats(other), host };
        if (!present.has(seat)) return { seat, status: SEAT_STATUS.ABSENT, host };
        return { seat, status: SEAT_STATUS.WAITING, host };
    });
};

/**
 * Whether everyone worth waiting for is here (absent seats are not waited for).
 * @param {Array<{status: string}>} statuses - describeSeatStatuses result.
 * @returns {boolean} true when no seat is waiting or elsewhere.
 */
const isEveryoneHere = (statuses) =>
    statuses.every(
        (entry) =>
            entry.status === SEAT_STATUS.ME ||
            entry.status === SEAT_STATUS.JOINED ||
            entry.status === SEAT_STATUS.ABSENT,
    );

/**
 * Whether "待たずに始める" should ask first: every other chosen seat is absent.
 * @param {Array<{status: string}>} statuses - describeSeatStatuses result.
 * @returns {boolean} true to ask before starting alone.
 */
const needsAloneConfirm = (statuses) => {
    const others = statuses.filter((entry) => entry.status !== SEAT_STATUS.ME);
    return others.length > 0 && others.every((entry) => entry.status === SEAT_STATUS.ABSENT);
};

/**
 * The seat grid of "番号を選ぶ".
 * @param {object} params - parameters.
 * @param {number} params.studentCount - seats in the class (`studentCount`).
 * @param {Array<number>} params.presentSeats - seats present in the class (`takenSeats`).
 * @param {Array<object>} params.groups - groups in the class domain.
 * @param {Array<number>} params.chosenSeats - chosen seats (with mySeat).
 * @param {number} params.mySeat - own seat.
 * @param {*} params.groupLimit - `meshGroupLimit` (normalized here).
 * @returns {{seats: Array<object>, limit: number, limitReached: boolean, canSelectAll: boolean}}
 *   one entry per seat with `me` / `chosen` / `absent` / `busyGroupId` / `disabled`.
 */
const seatPickerState = ({ studentCount, presentSeats, groups, chosenSeats, mySeat, groupLimit }) => {
    const limit = normalizeGroupLimit(groupLimit);
    const present = new Set(presentSeats || []);
    const chosen = new Set(sortedSeats([...(chosenSeats || []), mySeat]));
    const limitReached = limit !== NO_GROUP_LIMIT && chosen.size >= limit;
    const busy = new Map();
    for (const group of groups || []) {
        for (const seat of groupMemberSeats(group)) {
            if (!busy.has(seat)) busy.set(seat, group.id);
        }
    }
    const count = Math.max(Number.isInteger(studentCount) ? studentCount : 0, mySeat || 0);
    const seats = [];
    for (let seat = 1; seat <= count; seat++) {
        const me = seat === mySeat;
        const isChosen = chosen.has(seat);
        const busyGroupId = me ? null : busy.get(seat) || null;
        seats.push({
            seat,
            me,
            chosen: isChosen,
            absent: !me && !present.has(seat),
            busyGroupId,
            disabled: me || (!isChosen && limitReached),
        });
    }
    return { seats, limit, limitReached, canSelectAll: limit === NO_GROUP_LIMIT };
};

/**
 * Toggle a seat in the chosen list. The own seat cannot be removed and the
 * limit cannot be exceeded.
 * @param {Array<number>} chosenSeats - chosen seats.
 * @param {number} seat - seat to toggle.
 * @param {number} mySeat - own seat.
 * @param {*} groupLimit - `meshGroupLimit`.
 * @returns {Array<number>} the new chosen seats (sorted, with mySeat).
 */
const toggleSeat = (chosenSeats, seat, mySeat, groupLimit) => {
    const chosen = sortedSeats([...(chosenSeats || []), mySeat]);
    if (seat === mySeat || !isSeat(seat)) return chosen;
    if (chosen.includes(seat)) return chosen.filter((s) => s !== seat);
    const limit = normalizeGroupLimit(groupLimit);
    if (limit !== NO_GROUP_LIMIT && chosen.length >= limit) return chosen;
    return sortedSeats([...chosen, seat]);
};

/**
 * The teacher's group to offer on the first screen: only for an assignment
 * without a limit (Q8).
 * @param {Array<object>} groups - groups in the class domain.
 * @param {*} groupLimit - `meshGroupLimit`.
 * @returns {?object} the teacher's group, or null.
 */
const findTeacherGroup = (groups, groupLimit) => {
    if (normalizeGroupLimit(groupLimit) !== NO_GROUP_LIMIT) return null;
    return (groups || []).find((group) => group.seatInfo && group.seatInfo.host === TEACHER_HOST) || null;
};

export {
    ACTION,
    ALL_ARRIVED_CLOSE_MS,
    HOST_WAIT_MS,
    NO_GROUP_LIMIT,
    SEAT_STATUS,
    decideSeatAction,
    describeSeatStatuses,
    findGroupToMergeInto,
    findTeacherGroup,
    groupHostSeat,
    groupSeats,
    isEveryoneHere,
    needsAloneConfirm,
    normalizeGroupLimit,
    pickHostSeat,
    pickSurvivingGroup,
    seatPickerState,
    toggleSeat,
};
