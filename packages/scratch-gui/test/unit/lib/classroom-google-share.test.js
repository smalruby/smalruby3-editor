import {
    GOOGLE_COURSE_ACCESS,
    isGoogleShareBlocked,
    googleShareBlockedMessage,
} from '../../../src/lib/classroom-google-share.js';

const intl = {
    formatMessage: (descriptor, values) =>
        values && values.email ? `${descriptor.id}:${values.email}` : descriptor.id,
};

describe('isGoogleShareBlocked', () => {
    const verdict = (status, groupId = 'g1') => ({ groupId, status });

    test('blocks only when Google proved the teacher is not a course teacher', () => {
        expect(isGoogleShareBlocked(verdict(GOOGLE_COURSE_ACCESS.NOT_TEACHER), 'g1')).toBe(true);
    });

    test('allows a teacher of the course', () => {
        expect(isGoogleShareBlocked(verdict(GOOGLE_COURSE_ACCESS.TEACHER), 'g1')).toBe(false);
    });

    // The check runs only with an already-granted Google token, so "we could
    // not tell" is the normal state — it must never disable the button, or a
    // teacher who is allowed would be locked out (issue #1184).
    test('does not block when the check was inconclusive', () => {
        expect(isGoogleShareBlocked(verdict(GOOGLE_COURSE_ACCESS.UNKNOWN), 'g1')).toBe(false);
    });

    test('does not block when the class is not linked at all', () => {
        expect(isGoogleShareBlocked(verdict(GOOGLE_COURSE_ACCESS.NOT_LINKED), 'g1')).toBe(false);
    });

    test('does not block when the check has not run', () => {
        expect(isGoogleShareBlocked(null, 'g1')).toBe(false);
        expect(isGoogleShareBlocked(undefined, 'g1')).toBe(false);
        expect(isGoogleShareBlocked({}, 'g1')).toBe(false);
    });

    // The probe is a network round trip, so switching classes while it is in
    // flight (or answers arriving out of order) leaves a verdict about another
    // class in state. Applying it would disable sharing for a class the
    // teacher is perfectly allowed to share.
    test('ignores a verdict that belongs to a different class', () => {
        expect(isGoogleShareBlocked(verdict(GOOGLE_COURSE_ACCESS.NOT_TEACHER, 'gA'), 'gB')).toBe(false);
    });

    test('ignores a verdict with no class attached', () => {
        expect(isGoogleShareBlocked({ status: GOOGLE_COURSE_ACCESS.NOT_TEACHER }, 'g1')).toBe(false);
    });

    test('does not block when there is no class on screen', () => {
        expect(isGoogleShareBlocked(verdict(GOOGLE_COURSE_ACCESS.NOT_TEACHER), null)).toBe(false);
        expect(isGoogleShareBlocked(verdict(GOOGLE_COURSE_ACCESS.NOT_TEACHER), undefined)).toBe(false);
    });
});

describe('googleShareBlockedMessage', () => {
    test('names the linking teacher when the email is known', () => {
        expect(googleShareBlockedMessage(intl, 'owner@example.com')).toBe(
            'gui.classroom.googleShare.blockedBy:owner@example.com',
        );
    });

    test('stays generic rather than guessing a name when the email is unknown', () => {
        expect(googleShareBlockedMessage(intl, null)).toBe('gui.classroom.googleShare.blocked');
        expect(googleShareBlockedMessage(intl, '')).toBe('gui.classroom.googleShare.blocked');
    });
});
