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

/**
 * Key of a members-tab comment draft: one per assignment and seat (#1990).
 * @param {string} classroomId - the assignment
 * @param {string} memberId - the seat ('seat-04')
 * @returns {string} key
 */
const memberCommentDraftKey = (classroomId, memberId) => `${classroomId}\n${memberId}`;

/**
 * The drafts of one assignment, as memberId → text, for its members tab.
 * @param {object} drafts - memberCommentDraftKey → {text, base}
 * @param {?string} classroomId - the shown assignment
 * @returns {object} memberId → text
 */
const memberDraftsForClassroom = (drafts, classroomId) => {
    const out = {};
    if (!classroomId) return out;
    const prefix = `${classroomId}\n`;
    for (const [key, value] of Object.entries(drafts || {})) {
        if (key.startsWith(prefix)) out[key.slice(prefix.length)] = value.text;
    }
    return out;
};

/**
 * Whether some members-tab comment is typed and not returned: not empty and not
 * the returned comment. For the shown assignment the returned comment is read
 * from its members (so returning it makes the draft saved); for the others,
 * from when the typing started.
 * @param {object} drafts - memberCommentDraftKey → {text, base}
 * @param {?string} shownClassroomId - the assignment shown now
 * @param {Array<object>} shownMembers - its members (memberId, teacherComment)
 * @returns {boolean} whether a logout would drop a comment
 */
const unsavedMemberCommentDrafts = (drafts, shownClassroomId, shownMembers) =>
    Object.entries(drafts || {}).some(([key, { text, base }]) => {
        const draft = (text || '').trim();
        if (!draft) return false;
        const [classroomId, memberId] = key.split('\n');
        const shown =
            classroomId === shownClassroomId ? (shownMembers || []).find((m) => m.memberId === memberId) : null;
        const saved = shown ? shown.teacherComment || '' : base || '';
        return draft !== saved.trim();
    });

export {
    shouldMountTeacherModal,
    isTeacherWorkBarVisible,
    memberCommentDraftKey,
    memberDraftsForClassroom,
    unsavedMemberCommentDrafts,
};
