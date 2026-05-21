import { extractKickReason } from '../../../src/containers/classroom-error-utils.js';

describe('extractKickReason', () => {
    test('returns null for a non-410 error', () => {
        const err = new Error('Invalid or expired session token');
        err.status = 401;
        expect(extractKickReason(err)).toBeNull();
    });

    test('returns null for a 410 without a kicked reason', () => {
        const err = new Error('Gone');
        err.status = 410;
        err.body = { error: 'Gone', reason: 'other' };
        expect(extractKickReason(err)).toBeNull();
    });

    test('returns kick context when the server flags reason=kicked', () => {
        const err = new Error('You were removed from the classroom by the teacher');
        err.status = 410;
        err.body = {
            error: 'You were removed from the classroom by the teacher',
            reason: 'kicked',
            joinCode: 'btgyal',
            className: 'Phase1検証',
            seatNumber: 5,
        };
        expect(extractKickReason(err)).toEqual({
            joinCode: 'btgyal',
            className: 'Phase1検証',
            seatNumber: 5,
        });
    });

    test('falls back gracefully when body fields are missing', () => {
        const err = new Error('You were removed from the classroom by the teacher');
        err.status = 410;
        err.body = { reason: 'kicked' };
        expect(extractKickReason(err)).toEqual({
            joinCode: '',
            className: '',
            seatNumber: 0,
        });
    });

    test('returns null when body is missing entirely', () => {
        const err = new Error('Gone');
        err.status = 410;
        expect(extractKickReason(err)).toBeNull();
    });

    test('returns null for a non-Error-shaped value', () => {
        expect(extractKickReason(null)).toBeNull();
        expect(extractKickReason(undefined)).toBeNull();
        expect(extractKickReason('boom')).toBeNull();
    });
});
