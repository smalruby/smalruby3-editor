/**
 * The teacher's way back from an opened work to class management (#1990).
 *
 * Pure helpers shared by ClassroomTeacherModalHost (keep class management
 * mounted) and the bar above the editor (ClassroomTeacherWorkBar).
 */

/**
 * Whether class management stays mounted.
 *
 * Shown: always. Hidden: after it was opened once, until the teacher logs out
 * on purpose (ClassroomTeacherModalHost clears `opened` then). A login that
 * expires does not count: the screen and the drafts wait for the teacher to log
 * in again. Never mounted before the first open (nothing is fetched).
 * @param {object} params - inputs
 * @param {boolean} params.visible - the modal is shown
 * @param {boolean} params.opened - it has been opened since the last logout
 * @returns {boolean} whether to mount it
 */
const shouldMountTeacherModal = ({ visible, opened }) => !!visible || !!opened;

/**
 * Whether the bar above the editor is shown.
 * Only for a work the teacher opened, while class management is closed. It
 * stays when the login expires (it then asks to log in again); a logout on
 * purpose clears the work.
 * @param {object} classroom - state.scratchGui.classroom
 * @returns {boolean} whether to show the bar
 */
const isTeacherWorkBarVisible = (classroom) =>
    !!(classroom && classroom.teacherOpenedWork && !classroom.teacherModalVisible);

/**
 * What to do with the screen once a teacher logs in again after the login
 * expired (#1990). The same teacher goes back to the screen they were on, with
 * everything kept; another teacher starts from the class list with nothing of
 * the previous teacher's.
 * @param {?{phase: string, email: ?string}} resume - where the expired login was
 * @param {?string} email - the teacher who logged in now
 * @returns {'none'|'resume'|'reset'} what to do
 */
const decideSessionResume = (resume, email) => {
    if (!resume) return 'none';
    if (resume.email && email) return resume.email === email ? 'resume' : 'reset';
    // Neither login says who it is (the dev bypass login): nothing tells another teacher apart.
    if (!resume.email && !email) return 'resume';
    return 'reset';
};

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
    decideSessionResume,
    memberCommentDraftKey,
    memberDraftsForClassroom,
    unsavedMemberCommentDrafts,
};
