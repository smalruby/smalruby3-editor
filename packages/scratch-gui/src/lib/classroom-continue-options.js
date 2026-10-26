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
 *   nothing to continue from (the starter then opens automatically as before)
 */
export const normalizeContinueOptions = (data) => {
    const current = usable(data?.current);
    const previous = usable(data?.previous);
    if (!current && !previous) return null;
    return { current, previous };
};

/**
 * Decide how a student starts right after joining (#1202).
 *
 * With the teacher's "start from the previous submission" setting on, the
 * previous submission opens by itself so a follow-up lesson never starts
 * from the starter by mistake; without one the starter opens instead and the
 * student is told why. A seat that already submitted for this assignment
 * still chooses — opening last time's work would hide this lesson's.
 * @param {?{current: ?object, previous: ?object}} options - normalized options
 * @param {boolean} startFromPrevious - the assignment setting
 * @returns {{action: string, notice: ?string}} action is 'previous' (open
 *   the previous submission), 'starter' (open the starter, when there is one)
 *   or 'choose' (offer the choice row); notice is 'openedPrevious',
 *   'noPrevious' or null
 */
export const decideJoinStart = (options, startFromPrevious) => {
    if (startFromPrevious && !options?.current) {
        return options?.previous
            ? { action: 'previous', notice: 'openedPrevious' }
            : { action: 'starter', notice: 'noPrevious' };
    }
    return { action: options ? 'choose' : 'starter', notice: null };
};
