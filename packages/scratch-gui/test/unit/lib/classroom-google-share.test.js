import {
    GOOGLE_COURSE_ACCESS,
    canVerifyGoogleShare,
    googleShareBlockedMessage,
    googleShareVerdict,
    isGoogleShareBlocked,
} from '../../../src/lib/classroom-google-share.js';

const intl = {
    formatMessage: (descriptor, values) =>
        values && values.email ? `${descriptor.id}:${values.email}` : descriptor.id,
};

// The class on screen: linked to a GC course by somebody else.
const linkedGroup = (over = {}) => ({
    groupId: 'g1',
    googleClassroomCourseId: 'course-123',
    ...over,
});

describe('isGoogleShareBlocked', () => {
    const verdict = (status, groupId = 'g1') => ({ groupId, status });

    // The teacher this issue is about is on a personal Google account and can
    // never join the course, so "we could not tell" has to block — otherwise
    // they keep pressing a button that always fails (issue #1184).
    test('blocks by default when another teacher linked the course', () => {
        expect(isGoogleShareBlocked(null, linkedGroup())).toBe(true);
        expect(isGoogleShareBlocked(verdict(GOOGLE_COURSE_ACCESS.UNKNOWN), linkedGroup())).toBe(true);
        expect(isGoogleShareBlocked(verdict(GOOGLE_COURSE_ACCESS.NOT_TEACHER), linkedGroup())).toBe(true);
    });

    test('never blocks the teacher who linked the course', () => {
        const mine = linkedGroup({ googleClassroomLinkedByMe: true });
        expect(isGoogleShareBlocked(null, mine)).toBe(false);
        // Not even a negative probe: their 404 means the course is gone, and
        // they are the person everyone else is told to ask.
        expect(isGoogleShareBlocked(verdict(GOOGLE_COURSE_ACCESS.NOT_TEACHER), mine)).toBe(false);
    });

    test('lifts the block once the probe proves the teacher is in the course', () => {
        expect(isGoogleShareBlocked(verdict(GOOGLE_COURSE_ACCESS.TEACHER), linkedGroup())).toBe(false);
    });

    test('lifts the block when the probe reports this teacher as the linker', () => {
        const access = { groupId: 'g1', status: GOOGLE_COURSE_ACCESS.UNKNOWN, linkedByMe: true };
        expect(isGoogleShareBlocked(access, linkedGroup())).toBe(false);
    });

    // Pre-v2 classes carry the GC link on the assignment, with nobody recorded
    // as the linker — blocking everyone there would lock out the owner.
    test('keeps the proof-only rule when the class itself is not linked', () => {
        const unlinked = { groupId: 'g1', googleClassroomCourseId: null };
        expect(isGoogleShareBlocked(null, unlinked)).toBe(false);
        expect(isGoogleShareBlocked(verdict(GOOGLE_COURSE_ACCESS.UNKNOWN), unlinked)).toBe(false);
        expect(isGoogleShareBlocked(verdict(GOOGLE_COURSE_ACCESS.NOT_TEACHER), unlinked)).toBe(true);
    });

    // The probe is a network round trip, so switching classes while it is in
    // flight (or answers arriving out of order) leaves a verdict about another
    // class in state. It must not decide anything about the class on screen —
    // in either direction.
    test('ignores a verdict that belongs to a different class', () => {
        expect(
            isGoogleShareBlocked(verdict(GOOGLE_COURSE_ACCESS.TEACHER, 'gA'), linkedGroup({ groupId: 'gB' })),
        ).toBe(true);
    });

    test('ignores a verdict with no class attached', () => {
        expect(isGoogleShareBlocked({ status: GOOGLE_COURSE_ACCESS.TEACHER }, linkedGroup())).toBe(true);
    });

    test('does not block when there is no class on screen', () => {
        expect(isGoogleShareBlocked(verdict(GOOGLE_COURSE_ACCESS.NOT_TEACHER), null)).toBe(false);
        expect(isGoogleShareBlocked(verdict(GOOGLE_COURSE_ACCESS.NOT_TEACHER), undefined)).toBe(false);
        expect(isGoogleShareBlocked(verdict(GOOGLE_COURSE_ACCESS.NOT_TEACHER), {})).toBe(false);
    });
});

describe('googleShareVerdict', () => {
    test('returns the verdict only when it is about the class on screen', () => {
        const access = { groupId: 'g1', status: GOOGLE_COURSE_ACCESS.TEACHER };
        expect(googleShareVerdict(access, linkedGroup())).toBe(access);
        expect(googleShareVerdict(access, linkedGroup({ groupId: 'g2' }))).toBeNull();
        expect(googleShareVerdict(null, linkedGroup())).toBeNull();
        expect(googleShareVerdict(access, null)).toBeNull();
    });
});

describe('canVerifyGoogleShare', () => {
    test('offers the check while no answer exists for this teacher', () => {
        expect(canVerifyGoogleShare(null, linkedGroup())).toBe(true);
        expect(canVerifyGoogleShare({ groupId: 'g1', status: GOOGLE_COURSE_ACCESS.UNKNOWN }, linkedGroup())).toBe(
            true,
        );
    });

    // Asking again just replays Google's answer, at the cost of another popup.
    test('stops offering it once Google said this account is not a teacher', () => {
        expect(canVerifyGoogleShare({ groupId: 'g1', status: GOOGLE_COURSE_ACCESS.NOT_TEACHER }, linkedGroup())).toBe(
            false,
        );
    });

    test('ignores an answer about a different class', () => {
        expect(canVerifyGoogleShare({ groupId: 'gA', status: GOOGLE_COURSE_ACCESS.NOT_TEACHER }, linkedGroup())).toBe(
            true,
        );
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

    // After the teacher asked us to check, repeating the generic explanation
    // would read as if nothing happened.
    test('reports a failed check instead of repeating the explanation', () => {
        expect(googleShareBlockedMessage(intl, 'owner@example.com', true)).toBe(
            'gui.classroom.googleShare.verifyFailedBy:owner@example.com',
        );
        expect(googleShareBlockedMessage(intl, null, true)).toBe('gui.classroom.googleShare.verifyFailed');
    });
});
