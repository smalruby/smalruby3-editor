/**
 * Teacher classroom orchestrator hook.
 *
 * Composes {@link useTeacherAuth}, {@link useTeacherClassrooms},
 * {@link useTeacherSubmissions}, and {@link useGoogleClassroom} into
 * a single return object consumed by {@link ClassroomModal}.
 */
import { useCallback, useRef } from 'react';
import useGoogleClassroom from './use-google-classroom.js';
import useSharedAssignments from './use-shared-assignments.js';
import useTeacherAssignment from './use-teacher-assignment.js';
import useTeacherAuth, { getCachedTeacherIdToken, setCachedTeacherIdToken } from './use-teacher-auth.js';
import useTeacherClassrooms from './use-teacher-classrooms.js';
import useTeacherEvaluation from './use-teacher-evaluation.js';
import useTeacherGroups from './use-teacher-groups.js';
import useTeacherNotifications from './use-teacher-notifications.js';
import useTeacherSubmissions from './use-teacher-submissions.js';

export { getCachedTeacherIdToken, setCachedTeacherIdToken };

/**
 * @param {object} params - hook dependencies
 * @param {string} params.mode - 'student' | 'teacher'
 * @param {Function} params.dispatch - Redux dispatch
 * @param {object} params.intl - react-intl intl object
 * @param {string} params.phase - current UI phase
 * @param {Function} params.setPhase - phase setter
 * @param {Function} params.showError - error display helper
 * @param {Function} params.clearError - clear error helper
 * @param {Function} params.showSessionExpiredError - session-expired error helper
 * @param {Function} params.setIsLoading - loading state setter
 * @param {object} params.vm - Scratch VM instance
 * @returns {object} merged teacher state and handler functions
 */
const useTeacherClassroom = ({
    mode,
    dispatch,
    intl,
    phase,
    setPhase,
    showError,
    clearError,
    showSessionExpiredError,
    setIsLoading,
    vm,
}) => {
    // --- Sub-hooks ---

    const auth = useTeacherAuth({
        mode,
        clearError,
        setPhase,
        showSessionExpiredError,
    });

    const classrooms = useTeacherClassrooms({
        idToken: auth.idToken,
        handleTeacher401: auth.handleTeacher401,
        mode,
        phase,
        setPhase,
        clearError,
        showError,
        intl,
        setIsLoading,
    });

    const submissions = useTeacherSubmissions({
        idToken: auth.idToken,
        selectedClassroom: classrooms.selectedClassroom,
        members: classrooms.members,
        handleTeacher401: auth.handleTeacher401,
        loadClassroomDetail: classrooms.loadClassroomDetail,
        mode,
        clearError,
        showError,
        intl,
        setIsLoading,
        vm,
        dispatch,
    });

    // The groups hook is created after this one; bridge with a ref so the
    // GC import confirm can create a class (v2) without reordering hooks.
    const importCourseRef = useRef(null);
    const handleImportCourse = useCallback((course) => importCourseRef.current?.(course), []);

    const google = useGoogleClassroom({
        idToken: auth.idToken,
        onImportCourse: handleImportCourse,
        selectedClassroom: classrooms.selectedClassroom,
        setSelectedClassroom: classrooms.setSelectedClassroom,
        setClassrooms: classrooms.setClassrooms,
        clearError,
        showError,
        intl,
        setIsLoading,
        setPhase,
    });

    const assignment = useTeacherAssignment({
        idToken: auth.idToken,
        selectedClassroom: classrooms.selectedClassroom,
        handleTeacher401: auth.handleTeacher401,
        phase,
        clearError,
        showError,
        intl,
        setIsLoading,
        setPhase,
        vm,
    });

    const groups = useTeacherGroups({
        idToken: auth.idToken,
        handleTeacher401: auth.handleTeacher401,
        setClassrooms: classrooms.setClassrooms,
        setSelectedClassroom: classrooms.setSelectedClassroom,
        loadClassrooms: classrooms.loadClassrooms,
        clearError,
        showError,
        intl,
        setIsLoading,
        setPhase,
    });

    importCourseRef.current = groups.handleCreateClassFromCourse;

    const evaluation = useTeacherEvaluation({
        idToken: auth.idToken,
        classrooms: classrooms.classrooms,
        handleTeacher401: auth.handleTeacher401,
        clearError,
        showError,
        intl,
        setPhase,
    });

    const shared = useSharedAssignments({
        idToken: auth.idToken,
        handleTeacher401: auth.handleTeacher401,
        loadClassrooms: classrooms.loadClassrooms,
        clearError,
        showError,
        intl,
        setIsLoading,
    });

    // お知らせセンター (EPIC #1111)
    const notifications = useTeacherNotifications({
        idToken: auth.idToken,
        handleTeacher401: auth.handleTeacher401,
    });

    // --- Composed handlers ---

    const handleTeacherLogout = useCallback(() => {
        auth.logoutAuth();
        classrooms.resetClassrooms();
        submissions.resetSubmissionDisplay();
        notifications.resetNotifications();
        clearError();
        setPhase(mode === 'teacher' ? 'teacher-login' : 'student-join');
    }, [auth, classrooms, submissions, notifications, mode, clearError, setPhase]);

    /**
     * Open the view an お知らせ links to. Kinds are a small whitelist the
     * admin side also enforces; unknown kinds just close the panel (a newer
     * server may send kinds this build doesn't know yet).
     * @param {object|null} link - {kind, ...} from the notification item
     */
    const handleOpenNotificationLink = useCallback(
        (link) => {
            notifications.handleCloseNotifications();
            if (!link || !link.kind) return;
            if (link.kind === 'classroom') {
                // Scope the board to the owning class first (breadcrumbs and
                // back-navigation then behave as if opened from the board),
                // then open the assignment detail itself.
                const all = [...(classrooms.classrooms || []), ...(classrooms.archivedClassrooms || [])];
                const target = all.find((c) => c.classroomId === link.classroomId);
                if (target && target.groupId) {
                    const group = (groups.groups || []).find((g) => g.groupId === target.groupId);
                    if (group) groups.handleSelectGroup(group);
                }
                classrooms.handleSelectClassroom(link.classroomId);
            } else if (link.kind === 'shared-mine') {
                // 推薦通知 (#1110) のジャンプ先: みんなの課題の「自分の投稿」。
                // カタログはボード内サブビューなのでクラスの文脈が要る —
                // 未選択ならアクティブな先頭のクラスを開いてから表示する。
                if (!groups.selectedGroup) {
                    const first = (groups.groups || []).find((g) => g.status !== 'archived');
                    if (!first) return;
                    groups.handleSelectGroup(first);
                }
                shared.handleOpenCatalogMine();
            }
        },
        [notifications, classrooms, groups, shared],
    );

    const handleBackToDashboard = useCallback(() => {
        classrooms.handleBackToDashboard();
        submissions.resetSubmissionDisplay();
    }, [classrooms, submissions]);

    const handleCreateClassroom = useCallback(
        async (formData) => {
            await classrooms.handleCreateClassroom(formData, google.selectedGoogleCourse?.courseId);
            google.clearSelectedCourse();
        },
        [classrooms, google],
    );

    return {
        // Auth
        idToken: auth.idToken,
        authProvider: auth.authProvider,
        isMicrosoftAuthAvailable: auth.isMicrosoftAuthAvailable,
        handleGoogleLogin: auth.handleGoogleLogin,
        handleMicrosoftLogin: auth.handleMicrosoftLogin,
        handleTeacherLogout,

        // Setters (needed by container for go-to-login reset)
        setIdToken: auth.setIdToken,
        setClassrooms: classrooms.setClassrooms,
        setSelectedClassroom: classrooms.setSelectedClassroom,
        setMembers: classrooms.setMembers,

        // Classrooms
        classrooms: classrooms.classrooms,
        archivedClassrooms: classrooms.archivedClassrooms,
        handleRestoreClassroom: classrooms.handleRestoreClassroom,
        selectedClassroom: classrooms.selectedClassroom,
        members: classrooms.members,
        selectedMember: classrooms.selectedMember,
        handleCreateClassroom,
        handleDeleteClassroom: classrooms.handleDeleteClassroom,
        handleSelectClassroom: classrooms.handleSelectClassroom,
        handleBackToDashboard,
        handleRefreshDetail: classrooms.handleRefreshDetail,
        loadClassroomDetail: classrooms.loadClassroomDetail,
        handleDeleteMember: classrooms.handleDeleteMember,
        handleSelectMember: classrooms.handleSelectMember,
        handleUpdateAssignmentName: classrooms.handleUpdateAssignmentName,
        handleUpdateAssignmentMeta: classrooms.handleUpdateAssignmentMeta,
        setDetailTab: classrooms.setDetailTab,

        // Kick requests (Phase 4-6)
        kickRequestsBySeat: classrooms.kickRequestsBySeat,
        handleApproveKickRequest: classrooms.handleApproveKickRequest,
        handleRejectKickRequest: classrooms.handleRejectKickRequest,

        // Co-teachers (shared classroom management)

        // Submissions
        codeDisplayClassroom: submissions.codeDisplayClassroom,
        codeDisplayFullscreen: submissions.codeDisplayFullscreen,
        downloadProgress: submissions.downloadProgress,
        handleOpenSubmission: submissions.handleOpenSubmission,
        handleShowCodeDisplay: submissions.handleShowCodeDisplay,
        handleCloseCodeDisplay: submissions.handleCloseCodeDisplay,
        handleToggleCodeFullscreen: submissions.handleToggleCodeFullscreen,
        handleCopyInviteLink: submissions.handleCopyInviteLink,
        handleReturnSubmission: submissions.handleReturnSubmission,
        handleDownloadAll: submissions.handleDownloadAll,
        handleDownloadClassAll: submissions.handleDownloadClassAll,

        // Assignment content editor
        assignmentEditorPages: assignment.editorPages,
        assignmentStarterMode: assignment.starterMode,
        assignmentStarterSource: assignment.starterSource,
        assignmentHasExistingStarter: assignment.hasExistingStarter,
        assignmentIsSaving: assignment.isSaving,
        handleAssignmentAddPage: assignment.handleAddPage,
        handleAssignmentRemovePage: assignment.handleRemovePage,
        handleAssignmentMovePage: assignment.handleMovePage,
        handleAssignmentChangePageText: assignment.handleChangePageText,
        handleAssignmentAttachPageImage: assignment.handleAttachPageImage,
        handleAssignmentRemovePageImage: assignment.handleRemovePageImage,
        handleAssignmentUseCurrentProject: assignment.handleUseCurrentProjectAsStarter,
        handleAssignmentUseFile: assignment.handleUseFileAsStarter,
        handleAssignmentRemoveStarter: assignment.handleRemoveStarter,
        handleAssignmentSave: assignment.handleSaveAssignment,
        handleAssignmentCancel: assignment.handleCancelAssignmentEdit,
        handleAssignmentApplyTemplate: assignment.handleApplyTemplate,

        // Evaluation (期末評価)
        evaluation,
        shared,

        // お知らせセンター (#1111)
        notificationsCenter: {
            notifications: notifications.notifications,
            unreadCount: notifications.unreadCount,
            isOpen: notifications.isOpen,
            handleToggleNotifications: notifications.handleToggleNotifications,
            handleOpenLink: handleOpenNotificationLink,
        },

        // Groups (組)
        groups: groups.groups,
        selectedGroup: groups.selectedGroup,
        handleSelectGroup: groups.handleSelectGroup,
        handleShowClassList: groups.handleShowClassList,
        handleCreateClassWithAssignment: groups.handleCreateClassWithAssignment,
        handleUpdateGroupTopics: groups.handleUpdateGroupTopics,
        handleCreateAssignmentInClass: groups.handleCreateAssignmentInClass,
        handleReuseAssignment: groups.handleReuseAssignment,
        handleUpdateGroup: groups.handleUpdateGroup,

        // Google Classroom
        googleCourses: google.googleCourses,
        selectedGoogleCourse: google.selectedGoogleCourse,
        handleShowGoogleCourses: google.handleShowGoogleCourses,
        handleLoadGoogleCourses: google.handleLoadGoogleCourses,
        handleSelectGoogleCourse: google.handleSelectGoogleCourse,
        handleConfirmGoogleImport: google.handleConfirmGoogleImport,
        handleShowPostAssignment: google.handleShowPostAssignment,
        handleBackToDetail: google.handleBackToDetail,
        handlePostAssignment: google.handlePostAssignment,
    };
};

export default useTeacherClassroom;
