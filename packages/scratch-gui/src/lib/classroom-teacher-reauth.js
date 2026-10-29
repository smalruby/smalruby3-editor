/**
 * Teacher login expiry outside the class management modal (#1250).
 *
 * The teacher's ID token lasts about an hour. Views that keep using it after
 * the modal is closed (the floating status panel) see every call fail with a
 * 401 until the teacher logs in again, so they tell the teacher and offer a
 * re-authentication started by a click (the provider prompt needs a user
 * gesture).
 */

/**
 * Whether a classroom API error means the teacher's login has expired.
 * `classroomAPI` puts the HTTP status on the thrown error.
 * @param {?Error} err - the error thrown by a classroom API call
 * @returns {boolean} true for a 401
 */
const isTeacherAuthExpired = (err) => !!err && err.status === 401;

/**
 * Re-authenticate the teacher with the provider of the current login.
 * Never throws: a closed prompt, a timeout or an error all give null, and the
 * caller falls back to the class management modal.
 * @param {object} args - arguments.
 * @param {?string} args.provider - 'google' | 'microsoft' | null
 * @param {Function} args.reauth - provider re-authentication (`attemptSilentReauth`)
 * @param {?string} [args.devlogin] - the `?devlogin=` token; such a session
 *   has no provider login to renew
 * @returns {Promise<?string>} the new ID token, or null
 */
const reauthenticateTeacher = async ({ provider, reauth, devlogin = null }) => {
    if (devlogin) return null;
    try {
        return (await reauth(provider)) || null;
    } catch {
        return null;
    }
};

export { isTeacherAuthExpired, reauthenticateTeacher };
