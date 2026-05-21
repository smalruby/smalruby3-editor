/**
 * Decide what to do when the editor is opened with a `?classcode=XXXX` URL
 * parameter, given any session the student already has in localStorage.
 *
 * - `fresh_join`: no existing session, or the existing session is malformed
 *   (no classroomId to release). Just lookup + seat select.
 * - `same_class`: the URL classcode matches the existing session — drop the
 *   student straight into student-status (no leave, no re-pick).
 * - `switch_class`: the existing session is for a different classroom. The
 *   container should call leaveClassroom() on the server (best effort) before
 *   clearing the local session and starting the new join flow. Without the
 *   server-side leave, the previous seat would stay occupied until TTL.
 *
 * Pure function with no side effects; container glue performs the action.
 * @param {object} currentSession - {sessionToken, joinCode, classroomId}
 * @param {string} code - The classcode from the URL parameter
 * @returns {object} Action descriptor for the container
 */
const decideClasscodeAction = (currentSession, code) => {
    const { sessionToken, joinCode, classroomId } = currentSession || {};
    if (!sessionToken) {
        return { type: 'fresh_join', code };
    }
    // Join codes are case-insensitive (server normalises to lowercase). Without
    // this, opening the URL `?classcode=ABCDEF` while holding a session for
    // `abcdef` would falsely look like a class switch and the student would be
    // bounced through seat selection on their own seat.
    if (joinCode && joinCode.toLowerCase() === code.toLowerCase()) {
        return { type: 'same_class' };
    }
    if (!classroomId) {
        // No classroomId means we can't issue a server-side leave anyway.
        // Fall back to fresh_join so we at least clear any stale local state
        // and don't refuse to switch.
        return { type: 'fresh_join', code };
    }
    return {
        type: 'switch_class',
        leaveSessionToken: sessionToken,
        leaveClassroomId: classroomId,
        code,
    };
};

export { decideClasscodeAction };
export default decideClasscodeAction;
