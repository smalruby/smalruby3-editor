import translateError, { extractKickReason } from '../../../src/containers/classroom-error-utils.js';

// Minimal intl mock: substitutes {placeholders} from the values map into
// the defaultMessage so we can assert the composed, localized text.
const intlMock = {
    formatMessage: (descriptor, values = {}) =>
        descriptor.defaultMessage.replace(/\{(\w+)\}/g, (m, key) =>
            Object.prototype.hasOwnProperty.call(values, key) ? String(values[key]) : m,
        ),
};

describe('translateError network failure', () => {
    test('builds an actionable message including the unreachable host', () => {
        const err = new Error('Failed to fetch');
        err.isNetworkError = true;
        err.endpointHost = 'classroom.api.smalruby.app';
        const msg = translateError(intlMock, err);
        expect(msg).toContain('classroom.api.smalruby.app');
        // must not surface the raw fetch message
        expect(msg).not.toBe('Failed to fetch');
    });

    test('a network error takes precedence over a generic message', () => {
        const err = new Error('Failed to fetch');
        err.isNetworkError = true;
        err.endpointHost = 'classroom.api.example.test';
        const msg = translateError(intlMock, err, 'join');
        expect(msg).toContain('classroom.api.example.test');
    });
});

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
