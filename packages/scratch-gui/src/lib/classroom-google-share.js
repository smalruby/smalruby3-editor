/**
 * Sharing a Smalruby assignment to Google Classroom posts course work with the
 * **pressing** teacher's Google token, and Google only accepts that from a
 * teacher of the course. Smalruby lets any class co-teacher press the button,
 * so a co-teacher who is not in the Google Classroom course used to hit a raw
 * `Google Classroom API error` (issue #1184).
 *
 * These helpers turn the server's pre-flight answer into "disable the button?"
 * plus the sentence that explains who to ask.
 */
import { defineMessages } from 'react-intl';

/**
 * Result of the "is the signed-in teacher a teacher of the linked course?"
 * probe (`GET /classroom-groups/{groupId}/google-course-access`).
 * @enum {string}
 */
const GOOGLE_COURSE_ACCESS = {
    /** The teacher is a teacher of the linked course — sharing works. */
    TEACHER: 'teacher',
    /** Google proved they are not — sharing would fail. */
    NOT_TEACHER: 'notTeacher',
    /** The class has no Google Classroom course linked. */
    NOT_LINKED: 'notLinked',
    /** The probe could not be run or was inconclusive. */
    UNKNOWN: 'unknown',
};

const messages = defineMessages({
    blockedBy: {
        defaultMessage: "This class's Google Classroom was linked by {email}. Please ask them to share it.",
        description: 'Explains that only the teacher who linked the Google Classroom course can share',
        id: 'gui.classroom.googleShare.blockedBy',
    },
    blocked: {
        defaultMessage: "This class's Google Classroom was linked by another teacher. Please ask them to share it.",
        description:
            'Explains that only the teacher who linked the Google Classroom course can share, ' +
            'when that teacher cannot be named',
        id: 'gui.classroom.googleShare.blocked',
    },
});

/**
 * Should the "share to Google Classroom" button be disabled?
 *
 * Only a proven `notTeacher` blocks. Anything else — including "we could not
 * tell", which is the normal state before the teacher has granted Google
 * access this session — leaves the button enabled so a teacher who is in fact
 * allowed is never locked out; the failure path then explains the same thing.
 *
 * The verdict is about one class, so it must match the class on screen. The
 * probe is a network round trip and the teacher can switch classes during it
 * (and answers can arrive out of order), which would otherwise let a
 * `notTeacher` verdict about the previous class disable a class they can
 * perfectly well share.
 * @param {?object} access - the probe result, or null when it has not run
 * @param {?string} groupId - the class currently on screen
 * @returns {boolean} true when sharing is known to be impossible
 */
const isGoogleShareBlocked = (access, groupId) =>
    Boolean(access) &&
    access.status === GOOGLE_COURSE_ACCESS.NOT_TEACHER &&
    Boolean(groupId) &&
    access.groupId === groupId;

/**
 * The sentence shown instead of letting the teacher press the button.
 * @param {object} intl - react-intl intl object
 * @param {?string} linkedByEmail - email of the teacher who linked the course
 * @returns {string} localized explanation naming who to ask, when known
 */
const googleShareBlockedMessage = (intl, linkedByEmail) =>
    linkedByEmail
        ? intl.formatMessage(messages.blockedBy, { email: linkedByEmail })
        : intl.formatMessage(messages.blocked);

export { GOOGLE_COURSE_ACCESS, isGoogleShareBlocked, googleShareBlockedMessage };
