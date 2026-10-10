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
    test('blocks only when Google proved the teacher is not a course teacher', () => {
        expect(isGoogleShareBlocked({ status: GOOGLE_COURSE_ACCESS.NOT_TEACHER })).toBe(true);
    });

    test('allows a teacher of the course', () => {
        expect(isGoogleShareBlocked({ status: GOOGLE_COURSE_ACCESS.TEACHER })).toBe(false);
    });

    // The check runs only with an already-granted Google token, so "we could
    // not tell" is the normal state — it must never disable the button, or a
    // teacher who is allowed would be locked out (issue #1184).
    test('does not block when the check was inconclusive', () => {
        expect(isGoogleShareBlocked({ status: GOOGLE_COURSE_ACCESS.UNKNOWN })).toBe(false);
    });

    test('does not block when the class is not linked at all', () => {
        expect(isGoogleShareBlocked({ status: GOOGLE_COURSE_ACCESS.NOT_LINKED })).toBe(false);
    });

    test('does not block when the check has not run', () => {
        expect(isGoogleShareBlocked(null)).toBe(false);
        expect(isGoogleShareBlocked(undefined)).toBe(false);
        expect(isGoogleShareBlocked({})).toBe(false);
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
