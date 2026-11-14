/* eslint-env jest */
import {
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
} from '../../../src/lib/classroom-seat-selection.js';

describe('constants (#1198)', () => {
    test('idle hint fires after 30 seconds', () => {
        expect(SEAT_IDLE_HINT_MS).toBe(30 * 1000);
    });

    test('kick request polling runs every 5 seconds', () => {
        expect(KICK_REQUEST_POLL_INTERVAL_MS).toBe(5 * 1000);
    });
});

describe('parseSeatNumberInput (#1198)', () => {
    test('accepts a number within 1..seatCount', () => {
        expect(parseSeatNumberInput('5', 40)).toEqual({ seat: 5, error: null });
        expect(parseSeatNumberInput('1', 40)).toEqual({ seat: 1, error: null });
        expect(parseSeatNumberInput('40', 40)).toEqual({ seat: 40, error: null });
    });

    test('trims spaces and accepts leading zeros', () => {
        expect(parseSeatNumberInput(' 07 ', 40)).toEqual({ seat: 7, error: null });
    });

    test('accepts full-width digits typed with a Japanese IME', () => {
        expect(parseSeatNumberInput('１２', 40)).toEqual({ seat: 12, error: null });
    });

    test('accepts a number value', () => {
        expect(parseSeatNumberInput(3, 40)).toEqual({ seat: 3, error: null });
    });

    test('reports empty input', () => {
        expect(parseSeatNumberInput('', 40)).toEqual({ seat: null, error: 'empty' });
        expect(parseSeatNumberInput('   ', 40)).toEqual({ seat: null, error: 'empty' });
        expect(parseSeatNumberInput(null, 40)).toEqual({ seat: null, error: 'empty' });
    });

    test('reports non-integer input', () => {
        expect(parseSeatNumberInput('abc', 40)).toEqual({ seat: null, error: 'invalid' });
        expect(parseSeatNumberInput('1.5', 40)).toEqual({ seat: null, error: 'invalid' });
        expect(parseSeatNumberInput('-3', 40)).toEqual({ seat: null, error: 'invalid' });
    });

    test('reports out-of-range numbers', () => {
        expect(parseSeatNumberInput('0', 40)).toEqual({ seat: null, error: 'outOfRange' });
        expect(parseSeatNumberInput('41', 40)).toEqual({ seat: null, error: 'outOfRange' });
    });
});

describe('decideSeatAction (#1198)', () => {
    test('selects a free seat', () => {
        expect(decideSeatAction(3, [1, 2])).toBe('select');
    });

    test('asks to free an occupied seat', () => {
        expect(decideSeatAction(2, [1, 2])).toBe('requestKick');
    });

    test('tells the student to wait when a request is already pending', () => {
        expect(decideSeatAction(2, [1, 2], { seatNumber: 2 })).toBe('alreadyRequested');
        expect(decideSeatAction(1, [1, 2], { seatNumber: 2 })).toBe('alreadyRequested');
    });

    test('still selects a free seat while a request is pending', () => {
        expect(decideSeatAction(3, [1, 2], { seatNumber: 2 })).toBe('select');
    });

    test('treats a missing takenSeats as all free', () => {
        expect(decideSeatAction(3, undefined)).toBe('select');
    });
});

describe('evaluateKickRequestPoll (#1198)', () => {
    const pending = { requestId: 'r1', joinCode: 'ABC123', seatNumber: 7 };

    test('approved when the seat is no longer taken', () => {
        expect(evaluateKickRequestPoll(pending, { takenSeats: [1, 2], activeKickRequestIds: [] })).toBe('approved');
    });

    test('waiting while the seat is taken and the request is active', () => {
        expect(evaluateKickRequestPoll(pending, { takenSeats: [7], activeKickRequestIds: ['r1'] })).toBe('waiting');
    });

    test('rejected when the request disappeared but the seat is still taken', () => {
        expect(evaluateKickRequestPoll(pending, { takenSeats: [7], activeKickRequestIds: ['r2'] })).toBe('rejected');
    });

    test('handles missing arrays in the lookup response', () => {
        expect(evaluateKickRequestPoll(pending, {})).toBe('approved');
        expect(evaluateKickRequestPoll(pending, { takenSeats: [7] })).toBe('rejected');
    });

    test('no pending request means nothing to do', () => {
        expect(evaluateKickRequestPoll(null, { takenSeats: [] })).toBeNull();
    });
});

describe('shouldPollKickRequest (#1198)', () => {
    const pending = { requestId: 'r1', joinCode: 'ABC123', seatNumber: 7 };

    test('polls while a request is pending and the tab is visible', () => {
        expect(shouldPollKickRequest({ pending, visible: true, hasSession: false })).toBe(true);
    });

    test('stops while the tab is hidden', () => {
        expect(shouldPollKickRequest({ pending, visible: false, hasSession: false })).toBe(false);
    });

    test('stops without a pending request', () => {
        expect(shouldPollKickRequest({ pending: null, visible: true, hasSession: false })).toBe(false);
    });

    test('stops once the student has joined', () => {
        expect(shouldPollKickRequest({ pending, visible: true, hasSession: true })).toBe(false);
    });
});

describe('lastSeatKeyFor (#1796)', () => {
    test('uses the class (group) when the assignment belongs to one', () => {
        expect(lastSeatKeyFor({ groupId: 'g1', classroomId: 'c1' })).toBe('group:g1');
    });

    test('falls back to the assignment when it is not in a class', () => {
        expect(lastSeatKeyFor({ groupId: null, classroomId: 'c1' })).toBe('assignment:c1');
    });

    test('returns null when the lookup has neither', () => {
        expect(lastSeatKeyFor({})).toBeNull();
        expect(lastSeatKeyFor(null)).toBeNull();
    });
});

describe('parseLastSeats (#1796)', () => {
    test('keeps positive integer seats only', () => {
        const raw = JSON.stringify({ 'group:g1': 3, 'group:g2': 0, 'group:g3': 'x', 'assignment:c1': 2.5 });
        expect(parseLastSeats(raw)).toEqual({ 'group:g1': 3 });
    });

    test('broken or missing values become an empty map', () => {
        expect(parseLastSeats(null)).toEqual({});
        expect(parseLastSeats('{oops')).toEqual({});
        expect(parseLastSeats('[1,2]')).toEqual({});
        expect(parseLastSeats('7')).toEqual({});
    });
});

describe('recallSeatFrom (#1796)', () => {
    test('returns the seat saved for the key', () => {
        expect(recallSeatFrom({ 'group:g1': 3 }, 'group:g1', 40)).toBe(3);
    });

    test('ignores a seat outside the current seat count', () => {
        expect(recallSeatFrom({ 'group:g1': 38 }, 'group:g1', 35)).toBeNull();
    });

    test('returns null without a key or a saved seat', () => {
        expect(recallSeatFrom({ 'group:g1': 3 }, null, 40)).toBeNull();
        expect(recallSeatFrom({}, 'group:g1', 40)).toBeNull();
    });
});

describe('rememberSeatIn (#1796)', () => {
    test('saves the seat without changing the original map', () => {
        const before = { 'group:g1': 3 };
        const after = rememberSeatIn(before, 'group:g2', 5);
        expect(after).toEqual({ 'group:g1': 3, 'group:g2': 5 });
        expect(before).toEqual({ 'group:g1': 3 });
    });

    test('overwrites the seat for the same key', () => {
        expect(rememberSeatIn({ 'group:g1': 3 }, 'group:g1', 7)).toEqual({ 'group:g1': 7 });
    });

    test('keeps only the most recent entries', () => {
        let seats = {};
        for (let i = 0; i < 120; i++) seats = rememberSeatIn(seats, `assignment:c${i}`, 1);
        seats = rememberSeatIn(seats, 'assignment:c0', 2);
        const keys = Object.keys(seats);
        expect(keys).toHaveLength(100);
        expect(keys[keys.length - 1]).toBe('assignment:c0');
        expect(seats['assignment:c1']).toBeUndefined();
    });

    test('ignores an invalid key or seat', () => {
        expect(rememberSeatIn({ a: 1 }, null, 3)).toEqual({ a: 1 });
        expect(rememberSeatIn({ a: 1 }, 'group:g1', 0)).toEqual({ a: 1 });
    });
});

describe('forgetSeatIn (#1796)', () => {
    test('drops the seat freed by "wrong number"', () => {
        expect(forgetSeatIn({ 'group:g1': 3, 'group:g2': 4 }, 'group:g1', 3)).toEqual({ 'group:g2': 4 });
    });

    test('keeps a different seat saved later for the same key', () => {
        expect(forgetSeatIn({ 'group:g1': 5 }, 'group:g1', 3)).toEqual({ 'group:g1': 5 });
    });
});

describe('isSeatIdleCounting (#1796)', () => {
    test('counts while the grid is shown', () => {
        expect(isSeatIdleCounting({})).toBe(true);
    });

    test('does not count during the confirmation, the kick dialog or a pending request', () => {
        expect(isSeatIdleCounting({ selectedSeat: 5 })).toBe(false);
        expect(isSeatIdleCounting({ kickRequestDialogSeat: 3 })).toBe(false);
        expect(isSeatIdleCounting({ kickRequestPending: { seatNumber: 3 } })).toBe(false);
    });
});

describe('seatGuideFor (#1796)', () => {
    test('nothing before 30 seconds', () => {
        expect(seatGuideFor({ takenSeats: [3], idle: false, counting: true })).toEqual({
            guide: null,
            flashTaken: false,
        });
    });

    test('after 30 seconds with an occupied seat: the guide and one flash', () => {
        expect(seatGuideFor({ takenSeats: [3], idle: true, counting: true })).toEqual({
            guide: 'idle',
            flashTaken: true,
        });
    });

    test('no guide and no flash when no seat is occupied', () => {
        expect(seatGuideFor({ takenSeats: [], idle: true, counting: true })).toEqual({
            guide: null,
            flashTaken: false,
        });
    });

    test('an occupied previous seat shows its guide at once', () => {
        expect(seatGuideFor({ previousSeat: 3, takenSeats: [3], idle: false, counting: true })).toEqual({
            guide: 'previousTaken',
            flashTaken: false,
        });
        expect(seatGuideFor({ previousSeat: 3, takenSeats: [3], idle: true, counting: true })).toEqual({
            guide: 'previousTaken',
            flashTaken: true,
        });
    });

    test('a free previous seat waits like any other', () => {
        expect(seatGuideFor({ previousSeat: 5, takenSeats: [3], idle: false, counting: true }).guide).toBeNull();
    });

    test('nothing while not counting (confirmation, dialog, pending request)', () => {
        expect(seatGuideFor({ previousSeat: 3, takenSeats: [3], idle: true, counting: false })).toEqual({
            guide: null,
            flashTaken: false,
        });
    });
});
