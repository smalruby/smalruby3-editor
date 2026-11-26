import { defineMessages } from 'react-intl';

/**
 * Localize the error messages that the Classroom API server returns in English.
 *
 * The server (`infra/smalruby-classroom/lambda/handler.ts`) answers errors as
 * `{error: '<English sentence>'}` and the GUI used to show that sentence as is
 * (e.g. the red line above the grading screen). The API stays as it is; the GUI
 * matches the known sentences here and shows them in the user's language.
 * Unknown sentences are shown as they are, so a new server message is never lost.
 */

const messages = defineMessages({
    evalDailyLimit: {
        defaultMessage:
            'AI grading can be used up to {limit} times a day, and today’s limit has been used up. ' +
            'You can use it again when the date changes (midnight, Japan time).',
        description: 'Error when the teacher used up the daily AI evaluation calls; {limit} is calls per day',
        id: 'gui.classroom.serverError.evalDailyLimit',
    },
    evalRateLimit: {
        defaultMessage: 'Too many AI grading requests in a short time. Please wait a while and try again.',
        description: 'Error when the teacher sent too many AI evaluation requests in an hour',
        id: 'gui.classroom.serverError.evalRateLimit',
    },
    sharedDailyLimit: {
        defaultMessage:
            'This can be done up to {limit} times a day, and today’s limit has been used up. ' +
            'You can do it again when the date changes (midnight, Japan time).',
        description:
            'Error when the teacher used up the daily limit of sharing or reporting an assignment; {limit} is per day',
        id: 'gui.classroom.serverError.sharedDailyLimit',
    },
    joinRateLimit: {
        defaultMessage: 'Too many attempts to join. Please wait a while and try again.',
        description: 'Error when a student tried to join too many times in a short time',
        id: 'gui.classroom.serverError.joinRateLimit',
    },
    lessonProgressRateLimit: {
        defaultMessage: 'Too many progress updates in a short time. Please wait a while and try again.',
        description: 'Error when the lesson progress was sent too often',
        id: 'gui.classroom.serverError.lessonProgressRateLimit',
    },
    aiTimeout: {
        defaultMessage: 'The AI took too long to answer. Please wait a moment and try again.',
        description: 'Error when the AI evaluation timed out',
        id: 'gui.classroom.serverError.aiTimeout',
    },
    aiApiError: {
        defaultMessage: 'The AI could not answer right now. Please wait a moment and try again.',
        description: 'Error when the AI service returned an error',
        id: 'gui.classroom.serverError.aiApiError',
    },
    aiResponseInvalid: {
        defaultMessage: 'The AI’s answer could not be read. Please try again.',
        description: 'Error when the AI answered in a form that could not be read',
        id: 'gui.classroom.serverError.aiResponseInvalid',
    },
    aiNotConfigured: {
        defaultMessage: 'AI grading is not available on this server.',
        description: 'Error when AI evaluation is not set up on the server',
        id: 'gui.classroom.serverError.aiNotConfigured',
    },
    classroomNotFound: {
        defaultMessage: 'The class could not be found. It may have been deleted.',
        description: 'Error when the classroom (assignment) was not found',
        id: 'gui.classroom.serverError.classroomNotFound',
    },
    submissionNotFound: {
        defaultMessage: 'The submitted work could not be found. It may have been deleted.',
        description: 'Error when the submission was not found',
        id: 'gui.classroom.serverError.submissionNotFound',
    },
    sharedNotFound: {
        defaultMessage: 'The shared assignment could not be found. It may have been deleted.',
        description: 'Error when the shared assignment was not found',
        id: 'gui.classroom.serverError.sharedNotFound',
    },
    noLesson: {
        defaultMessage: 'This assignment has no lesson.',
        description: 'Error when a lesson-only action is done on an assignment without a lesson',
        id: 'gui.classroom.serverError.noLesson',
    },
    shareNoContent: {
        defaultMessage: 'This assignment has nothing to share. Add pages, a starter project or a lesson first.',
        description: 'Error when sharing an assignment that has no content',
        id: 'gui.classroom.serverError.shareNoContent',
    },
    starterTooLarge: {
        defaultMessage: 'The starter project is too large. It must be {size} MB or less.',
        description: 'Error when the starter project exceeds the size limit; {size} is in MB',
        id: 'gui.classroom.serverError.starterTooLarge',
    },
    coTeacherOwnerOnly: {
        defaultMessage: 'Only the teacher who created the class can change the co-teachers.',
        description: 'Error when a co-teacher tries to change the co-teacher list',
        id: 'gui.classroom.serverError.coTeacherOwnerOnly',
    },
    coTeacherMax: {
        defaultMessage: 'A class can have up to {max} co-teachers.',
        description: 'Error when too many co-teachers are added; {max} is the limit',
        id: 'gui.classroom.serverError.coTeacherMax',
    },
    seatNotOccupied: {
        defaultMessage: 'No student is in seat {seat} now.',
        description: 'Error when acting on a seat that no student is using; {seat} is the seat number',
        id: 'gui.classroom.serverError.seatNotOccupied',
    },
    joinCodeFailed: {
        defaultMessage: 'Could not make a code. Please try again.',
        description: 'Error when the server could not make a unique join code or passcode',
        id: 'gui.classroom.serverError.joinCodeFailed',
    },
    internalError: {
        defaultMessage: 'Something went wrong on the server. Please wait a moment and try again.',
        description: 'Error when the server failed with an internal error',
        id: 'gui.classroom.serverError.internalError',
    },
    httpStatus: {
        defaultMessage: 'The server answered with an error ({status}). Please wait a moment and try again.',
        description: 'Error when the server answered an HTTP error without a message; {status} is the HTTP status',
        id: 'gui.classroom.serverError.httpStatus',
    },
});

/**
 * Known server messages. Each rule matches the whole message (anchored) and
 * turns the captured groups into the values of its descriptor.
 * Ordered from the specific to the general.
 */
const RULES = [
    {
        pattern: /^Daily AI evaluation limit reached \((\d+) calls\/day\)\. Please continue tomorrow\.$/,
        message: messages.evalDailyLimit,
        values: (m) => ({ limit: Number(m[1]) }),
    },
    {
        pattern: /^Too many evaluation requests\. Please try again later\.$/,
        message: messages.evalRateLimit,
    },
    {
        pattern: /^Daily limit reached \((\d+)\/day\)\. Please continue tomorrow\.$/,
        message: messages.sharedDailyLimit,
        values: (m) => ({ limit: Number(m[1]) }),
    },
    { pattern: /^Too many join attempts\. Please try again later\.$/, message: messages.joinRateLimit },
    {
        pattern: /^Too many lesson progress updates\. Please try again later\.$/,
        message: messages.lessonProgressRateLimit,
    },
    { pattern: /^AI_TIMEOUT$/, message: messages.aiTimeout },
    { pattern: /^AI_API_ERROR$/, message: messages.aiApiError },
    { pattern: /^AI_RESPONSE_INVALID$/, message: messages.aiResponseInvalid },
    { pattern: /^AI evaluation is not configured$/, message: messages.aiNotConfigured },
    { pattern: /^Classroom not found$/, message: messages.classroomNotFound },
    { pattern: /^Submission not found$/, message: messages.submissionNotFound },
    { pattern: /^Shared assignment not found$/, message: messages.sharedNotFound },
    { pattern: /^This assignment has no lesson$/, message: messages.noLesson },
    { pattern: /^This assignment has no content \(.*\) to share$/, message: messages.shareNoContent },
    {
        pattern: /^Starter project exceeds the (\d+)MB limit$/,
        message: messages.starterTooLarge,
        values: (m) => ({ size: Number(m[1]) }),
    },
    { pattern: /^Only the class owner can change the co-teacher list$/, message: messages.coTeacherOwnerOnly },
    {
        pattern: /^A classroom may have at most (\d+) co-teachers$/,
        message: messages.coTeacherMax,
        values: (m) => ({ max: Number(m[1]) }),
    },
    {
        pattern: /^Seat (\d+) is not currently occupied$/,
        message: messages.seatNotOccupied,
        values: (m) => ({ seat: Number(m[1]) }),
    },
    { pattern: /^Failed to generate (?:a )?unique (?:join code|passcode)$/, message: messages.joinCodeFailed },
    { pattern: /^Internal server error$/, message: messages.internalError },
    // Set by classroom-api.js when the server answered without an `error` field.
    {
        pattern: /^API error (\d{3})$/,
        message: messages.httpStatus,
        values: (m) => ({ status: Number(m[1]) }),
    },
];

/**
 * Find the descriptor for a server error message.
 * @param {string} serverMessage - The `error` text the server returned
 * @returns {?{message: object, values: object}} Descriptor and values, or null when unknown.
 */
const matchServerError = (serverMessage) => {
    if (typeof serverMessage !== 'string') return null;
    const text = serverMessage.trim();
    for (const rule of RULES) {
        const m = rule.pattern.exec(text);
        if (m) return { message: rule.message, values: rule.values ? rule.values(m) : {} };
    }
    return null;
};

/**
 * Show a server error message in the user's language.
 * @param {object} intl - react-intl intl object
 * @param {string} serverMessage - The `error` text the server returned
 * @returns {string} The localized text, or the original text when it is not known.
 */
const localizeServerError = (intl, serverMessage) => {
    const found = matchServerError(serverMessage);
    if (!found) return serverMessage;
    return intl.formatMessage(found.message, found.values);
};

export { matchServerError, localizeServerError, messages as serverErrorMessages };
export default localizeServerError;
