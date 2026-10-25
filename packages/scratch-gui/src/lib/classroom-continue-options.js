/**
 * Submissions a student can continue from (#1201).
 *
 * `GET /classrooms/{id}/continuable-submissions` returns the seat's own
 * submission in this assignment (`current`) and the same seat's submission
 * in the previous assignment of the same class (`previous`).
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
