// Seat numbers (出席番号) in mesh group names, as parsed by the VM
// (`seatInfo` on a meshV2 peripheral, see scratch3_mesh_v2/seat-naming.js).

const TEACHER_HOST = 'teacher';
const SEAT_SEPARATOR = '・';

/**
 * Describe how a group with seat information should be labelled.
 * @param {?{seats: Array<number>, host: (number|string|null)}} seatInfo - parsed group name.
 * @returns {?{kind: string, seats?: string, host?: number}} `seats` (a group for some seats),
 *   `teacher` (hosted by the teacher) or `host` (hosted by a seat); null without seat info.
 */
const describeSeatGroup = (seatInfo) => {
    if (!seatInfo) return null;
    if (Array.isArray(seatInfo.seats) && seatInfo.seats.length > 0) {
        return { kind: 'seats', seats: seatInfo.seats.join(SEAT_SEPARATOR) };
    }
    if (seatInfo.host === TEACHER_HOST) return { kind: 'teacher' };
    if (Number.isInteger(seatInfo.host)) return { kind: 'host', host: seatInfo.host };
    return null;
};

/**
 * Whether joining a group should be confirmed first: the group is for some
 * seats and the student's seat is not one of them.
 * @param {?{seats: Array<number>, host: (number|string|null)}} seatInfo - parsed group name.
 * @param {?{seat: ?number, teacher: boolean}} mySeat - own seat, or null outside a class.
 * @returns {boolean} true to ask before joining.
 */
const needsSeatJoinConfirm = (seatInfo, mySeat) => {
    if (!seatInfo || !Array.isArray(seatInfo.seats) || seatInfo.seats.length === 0) return false;
    if (!mySeat || mySeat.teacher || !Number.isInteger(mySeat.seat)) return false;
    return !seatInfo.seats.includes(mySeat.seat) && seatInfo.host !== mySeat.seat;
};

export { describeSeatGroup, needsSeatJoinConfirm, SEAT_SEPARATOR };
