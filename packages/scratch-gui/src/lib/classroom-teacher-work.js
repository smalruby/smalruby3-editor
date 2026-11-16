/**
 * The teacher's way back from an opened work to class management (#1990).
 *
 * Pure helpers shared by ClassroomTeacherModalHost (keep class management
 * mounted) and the bar above the editor (ClassroomTeacherWorkBar).
 */

/**
 * Whether class management stays mounted.
 *
 * Shown: always. Hidden: only after it was opened once and while the teacher
 * is logged in, so opening a work and coming back keeps the screen and the
 * grading drafts. Never mounted before the first open (nothing is fetched).
 * @param {object} params - inputs
 * @param {boolean} params.visible - the modal is shown
 * @param {boolean} params.opened - it has been opened since the last logout
 * @param {boolean} params.loggedIn - a teacher is logged in
 * @returns {boolean} whether to mount it
 */
const shouldMountTeacherModal = ({ visible, opened, loggedIn }) => !!visible || (!!opened && !!loggedIn);

/**
 * Whether the bar above the editor is shown.
 * Only for a work the teacher opened, while class management is closed.
 * @param {object} classroom - state.scratchGui.classroom
 * @returns {boolean} whether to show the bar
 */
const isTeacherWorkBarVisible = (classroom) =>
    !!(classroom && classroom.teacherOpenedWork && !classroom.teacherModalVisible && classroom.teacherLoggedIn);

export { shouldMountTeacherModal, isTeacherWorkBarVisible };
