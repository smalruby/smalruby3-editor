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

/**
 * Decide how the student side follows the assignment the teacher selected in
 * class management (#1199). The teacher's selection and the student "クラス"
 * menu share one join code, so a different assignment means leaving the class
 * the teacher joined as a student.
 *
 * - `none`: nothing selected, or already in that assignment's class.
 * - `leave`: joined another class. Release the seat on the server (best effort)
 *   and clear the local session; the next open of the student modal starts the
 *   seat selection of the selected assignment.
 * - `clear`: a local session without a classroomId (cannot be released on the
 *   server). Only clear it locally.
 * @param {object} currentSession - {sessionToken, joinCode, classroomId}
 * @param {string} teacherJoinCode - Join code of the assignment the teacher selected
 * @returns {object} Action descriptor for the container
 */
const decideTeacherSelectionSync = (currentSession, teacherJoinCode) => {
    if (!teacherJoinCode) return { type: 'none' };
    const action = decideClasscodeAction(currentSession, teacherJoinCode);
    if (action.type === 'switch_class') {
        return {
            type: 'leave',
            leaveSessionToken: action.leaveSessionToken,
            leaveClassroomId: action.leaveClassroomId,
        };
    }
    if (action.type === 'fresh_join' && currentSession && currentSession.sessionToken) {
        return { type: 'clear' };
    }
    return { type: 'none' };
};

/**
 * Pick the join code the student modal looks up on open, without asking for
 * it. The `?classcode=` URL wins; otherwise a logged-in teacher's selected
 * assignment is used so the modal opens on its seat selection (#1199). A held
 * student session is left alone: opening the modal must never throw the user
 * out of a class they joined (switching happens when the teacher selects).
 * @param {object} args - Inputs
 * @param {string} [args.urlClasscode] - `?classcode=` value, if any
 * @param {string} [args.teacherJoinCode] - Join code of the teacher's selected assignment
 * @param {object} [args.session] - {sessionToken} of the current student session
 * @returns {object|null} `{code, source: 'url'|'teacher'}`, or null for the normal flow
 */
const resolveAutoJoinCode = ({ urlClasscode, teacherJoinCode, session } = {}) => {
    if (urlClasscode) return { code: urlClasscode, source: 'url' };
    if (teacherJoinCode && !(session && session.sessionToken)) {
        return { code: teacherJoinCode, source: 'teacher' };
    }
    return null;
};

export { decideClasscodeAction, decideTeacherSelectionSync, resolveAutoJoinCode };
export default decideClasscodeAction;
