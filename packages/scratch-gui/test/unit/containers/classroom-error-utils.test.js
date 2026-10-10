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

describe('translateError Google Classroom failures', () => {
    const googleError = (status, reason, extra = {}) => {
        const err = new Error('Google Classroom API error');
        err.status = status;
        err.body = { error: 'Google Classroom API error', reason, ...extra };
        return err;
    };

    test('a missing/forbidden course explains that the teacher must own the GC class', () => {
        const msg = translateError(intlMock, googleError(404, 'googleCourseNotFound', { googleStatus: 'NOT_FOUND' }));
        expect(msg).toContain('Google Classroom');
        expect(msg).not.toBe('Google Classroom API error');
    });

    test('insufficient permissions get their own message', () => {
        const msg = translateError(
            intlMock,
            googleError(403, 'googlePermissionDenied', { googleStatus: 'PERMISSION_DENIED' }),
        );
        expect(msg).toContain('Google Classroom');
        expect(msg).not.toBe('Google Classroom API error');
    });

    test('an expired Google token is not reported as an expired classroom session', () => {
        const msg = translateError(
            intlMock,
            googleError(401, 'googleTokenExpired', { googleStatus: 'UNAUTHENTICATED' }),
        );
        expect(msg).toContain('Google');
        expect(msg).not.toContain('rejoin the classroom');
    });

    test('an unexpected Google failure surfaces the Google-provided detail', () => {
        const msg = translateError(
            intlMock,
            googleError(502, 'googleApiError', {
                googleStatus: 'RESOURCE_EXHAUSTED',
                googleMessage: 'Quota exceeded',
            }),
        );
        expect(msg).toContain('RESOURCE_EXHAUSTED');
        expect(msg).toContain('Quota exceeded');
    });

    test('an unexpected Google failure without detail still gives an actionable message', () => {
        const msg = translateError(intlMock, googleError(502, 'googleApiError'));
        expect(msg).toContain('Google Classroom');
        expect(msg).not.toBe('Google Classroom API error');
    });

    test('a client-side scope denial (googleReason) is translated too', () => {
        const err = new Error('Google Classroom permission was not granted.');
        err.googleReason = 'googlePermissionDenied';
        const msg = translateError(intlMock, err);
        expect(msg).toContain('Google Classroom');
        expect(msg).not.toBe('Google Classroom permission was not granted.');
    });

    test('non-Google errors are unaffected', () => {
        const err = new Error('Invalid or expired session token');
        err.status = 401;
        expect(translateError(intlMock, err)).toContain('rejoin the classroom');
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
