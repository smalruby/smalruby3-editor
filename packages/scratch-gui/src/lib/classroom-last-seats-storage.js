/**
 * The seat number this PC joined each class with (#1796), so the seat screen
 * can say "Last time you were number 03". It is only a hint: on a shared PC
 * the saved number may belong to another student, so it is never picked
 * automatically. Decisions live in classroom-seat-selection.js; this file
 * only reads and writes localStorage.
 */
import { forgetSeatIn, parseLastSeats, recallSeatFrom, rememberSeatIn } from './classroom-seat-selection.js';

const STORAGE_KEY = 'smalruby:classroom:lastSeats';

const readSeats = () => {
    try {
        if (typeof window === 'undefined' || !window.localStorage) return {};
        return parseLastSeats(window.localStorage.getItem(STORAGE_KEY));
    } catch {
        return {};
    }
};

const writeSeats = (seats) => {
    try {
        if (typeof window === 'undefined' || !window.localStorage) return;
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(seats));
    } catch {
        // ignore quota errors and blocked storage
    }
};

/**
 * @param {?string} key - see lastSeatKeyFor.
 * @param {number} seatCount - seats in the class now.
 * @returns {?number} the previous seat or null.
 */
const loadLastSeat = (key, seatCount) => recallSeatFrom(readSeats(), key, seatCount);

/**
 * @param {?string} key - see lastSeatKeyFor.
 * @param {number} seat - seat the student joined with.
 */
const saveLastSeat = (key, seat) => {
    if (!key) return;
    writeSeats(rememberSeatIn(readSeats(), key, seat));
};

/**
 * @param {?string} key - see lastSeatKeyFor.
 * @param {number} seat - seat freed with "wrong number".
 */
const clearLastSeat = (key, seat) => {
    if (!key) return;
    writeSeats(forgetSeatIn(readSeats(), key, seat));
};

export { STORAGE_KEY as LAST_SEATS_STORAGE_KEY, clearLastSeat, loadLastSeat, saveLastSeat };
