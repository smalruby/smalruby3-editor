/* eslint-env jest */
import {
    KICK_REQUEST_POLL_INTERVAL_MS,
    SEAT_IDLE_HINT_MS,
    decideSeatAction,
    evaluateKickRequestPoll,
    parseSeatNumberInput,
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
