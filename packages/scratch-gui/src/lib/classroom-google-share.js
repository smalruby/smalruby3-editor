/**
 * Sharing a Smalruby assignment to Google Classroom posts course work with the
 * **pressing** teacher's Google token, and Google only accepts that from a
 * teacher of the course. Smalruby lets any class co-teacher press the button,
 * so a co-teacher who is not in the Google Classroom course used to hit a raw
 * `Google Classroom API error` (issue #1184).
 *
 * The teacher this issue is about cannot be rescued by a better error message:
 * they are on a personal Google account with no Workspace, so they can never
 * become a teacher of the course. Sharing is therefore **blocked by default**
 * for everyone except the teacher who linked the course, and the probe is used
 * the other way around — as the evidence that *unblocks* a genuine Google
 * Classroom co-teacher, run only when they ask for it.
 *
 * These helpers decide "disable the button?" and produce the sentence that
 * explains who to ask.
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
    verifyFailedBy: {
        defaultMessage:
            'We could not confirm that you are a teacher of this Google Classroom class. ' +
            'Please ask {email} to share it.',
        description: 'Shown when the teacher asked us to check their Google Classroom access and it did not confirm',
        id: 'gui.classroom.googleShare.verifyFailedBy',
    },
    verifyFailed: {
        defaultMessage:
            'We could not confirm that you are a teacher of this Google Classroom class. ' +
            'Please ask the teacher who linked it to share it.',
        description:
            'Shown when the teacher asked us to check their Google Classroom access and it did not confirm, ' +
            'when the linking teacher cannot be named',
        id: 'gui.classroom.googleShare.verifyFailed',
    },
});

/**
 * The probe answer that is about the class on screen, if any.
 *
 * The probe is a network round trip and the teacher can switch classes during
 * it (answers can even arrive out of order), so a verdict must be matched to
 * the class it was about before it is allowed to decide anything.
 * @param {?object} access - the probe result, or null when it has not run
 * @param {?object} group - the class (group) currently on screen
 * @returns {?object} the verdict for this class, or null
 */
const googleShareVerdict = (access, group) => {
    const groupId = group && group.groupId;
    if (!access || !groupId || access.groupId !== groupId) return null;
    return access;
};

/**
 * Should the "share to Google Classroom" button be disabled?
 *
 * Blocked unless one of two things is true: this teacher linked the course
 * (server-decided, so no email string matching), or the probe proved they are
 * a teacher of it. "We could not tell" blocks — the teacher this issue is
 * about can never be told apart from a silent failure, and the block carries
 * its own way out (the verify affordance) for a genuine GC co-teacher.
 * @param {?object} access - the probe result, or null when it has not run
 * @param {?object} group - the class (group) currently on screen
 * @returns {boolean} true when sharing should be prevented
 */
const isGoogleShareBlocked = (access, group) => {
    if (!group || !group.groupId) return false;
    if (group.googleClassroomLinkedByMe) return false;
    const verdict = googleShareVerdict(access, group);
    if (verdict && verdict.status === GOOGLE_COURSE_ACCESS.TEACHER) return false;
    if (verdict && verdict.linkedByMe) return false;
    // The class's own link is what the default block is about. A class that is
    // linked only through the assignment (pre-v2) carries no attribution, so
    // keep the old behaviour there: block only what Google proved.
    if (group.googleClassroomCourseId) return true;
    return Boolean(verdict && verdict.status === GOOGLE_COURSE_ACCESS.NOT_TEACHER);
};

/**
 * Can this teacher still prove they are a Google Classroom co-teacher?
 *
 * Only worth offering while we have no answer for them: once Google has said
 * "not a teacher" for this account, asking again replays the same answer.
 * @param {?object} access - the probe result, or null when it has not run
 * @param {?object} group - the class (group) currently on screen
 * @returns {boolean} true when the verify affordance should be offered
 */
const canVerifyGoogleShare = (access, group) => {
    const verdict = googleShareVerdict(access, group);
    return !verdict || verdict.status !== GOOGLE_COURSE_ACCESS.NOT_TEACHER;
};

/**
 * The sentence shown instead of letting the teacher press the button.
 *
 * After the teacher asked us to check (and it did not confirm them) the
 * sentence says so, rather than repeating an explanation they just acted on.
 * @param {object} intl - react-intl intl object
 * @param {?string} linkedByEmail - email of the teacher who linked the course
 * @param {boolean} [verifyFailed] - a check this teacher asked for came back negative
 * @returns {string} localized explanation naming who to ask, when known
 */
const googleShareBlockedMessage = (intl, linkedByEmail, verifyFailed = false) => {
    if (verifyFailed) {
        return linkedByEmail
            ? intl.formatMessage(messages.verifyFailedBy, { email: linkedByEmail })
            : intl.formatMessage(messages.verifyFailed);
    }
    return linkedByEmail
        ? intl.formatMessage(messages.blockedBy, { email: linkedByEmail })
        : intl.formatMessage(messages.blocked);
};

export {
    GOOGLE_COURSE_ACCESS,
    googleShareVerdict,
    isGoogleShareBlocked,
    canVerifyGoogleShare,
    googleShareBlockedMessage,
};
