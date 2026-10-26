/**
 * Submissions a student can continue from (#1201).
 *
 * `GET /classrooms/{id}/continuable-submissions` returns the seat's own
 * submission in this assignment (`current`) and the same seat's submission
 * in the previous assignment of the same class (`previous`), plus the
 * assignment setting `startFromPrevious` (#1202).
 */

/** Choice kinds other than the starter, in display order. */
export const CONTINUE_KINDS = ['previous', 'current'];

const usable = (item) => (item && typeof item.projectUrl === 'string' && item.projectUrl ? item : null);

/**
 * Normalize the API response into the choices to offer.
 * @param {?object} data - API response ({current, previous})
 * @returns {?{current: ?object, previous: ?object}} null when there is
 *   nothing to continue from
 */
export const normalizeContinueOptions = (data) => {
    const current = usable(data?.current);
    const previous = usable(data?.previous);
    if (!current && !previous) return null;
    return { current, previous };
};

/**
 * Decide which start choices a student gets right after joining (#1202).
 *
 * Joining never loads a project by itself: the student loads one by pressing
 * a choice. Opening it automatically and still offering the same choice made
 * students unsure which button to press, and pressing it loaded the project a
 * second time behind an overwrite confirm.
 *
 * With the teacher's "start from the previous submission" setting on, the
 * previous submission is the recommended choice and the starter is not
 * offered, so a follow-up lesson is not started from the starter by mistake.
 * Without a previous submission the starter is recommended instead and the
 * student is told why. A seat that already submitted for this assignment
 * still chooses freely — recommending last time's work would hide this
 * lesson's.
 * @param {?{current: ?object, previous: ?object}} options - normalized options
 * @param {boolean} startFromPrevious - the assignment setting
 * @param {boolean} hasStarter - whether the assignment has a starter project
 * @returns {{showStarter: boolean, recommend: ?string, notice: ?string}}
 *   recommend is 'previous', 'starter' or null; notice is
 *   'recommendPrevious', 'noPrevious' or null
 */
export const decideJoinStart = (options, startFromPrevious, hasStarter) => {
    if (startFromPrevious && !options?.current) {
        if (options?.previous) {
            return { showStarter: false, recommend: 'previous', notice: 'recommendPrevious' };
        }
        return { showStarter: !!hasStarter, recommend: hasStarter ? 'starter' : null, notice: 'noPrevious' };
    }
    return { showStarter: !!hasStarter, recommend: null, notice: null };
};
