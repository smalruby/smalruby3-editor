import React, { useCallback, useRef, useState, useEffect } from 'react';
import { useIntl } from 'react-intl';
import { useDispatch, useSelector } from 'react-redux';
import ClassroomTeacherModalComponent from '../components/classroom-teacher-modal/classroom-teacher-modal.jsx';
import { teacherEmailFromToken } from '../lib/classroom-class-label.js';
import {
    clearTeacherSession,
    resolveTeacherNavigation,
    saveTeacherLastSelection,
    saveTeacherLogin,
} from '../lib/classroom-teacher-session.js';
import { getUrlParams } from '../lib/url-params.js';
import { showAlertWithTimeout } from '../reducers/alerts.js';
import {
    closeTeacherModal,
    clearClassroomSession,
    setTeacherSelection,
    clearTeacherSelection,
    setTeacherLoggedIn,
    setTeacherUnreadCount,
    setTeacherLastSelection,
    clearTeacherNavigation,
} from '../reducers/classroom.js';
import { getCachedTeacherAuthProvider } from './use-teacher-auth.js';
import useTeacherClassroom, { getCachedTeacherIdToken, setCachedTeacherIdToken } from './use-teacher-classroom.js';

const TEACHER_MODE = 'teacher';

const ClassroomTeacherModal = () => {
    const dispatch = useDispatch();
    const intl = useIntl();
    const classroomState = useSelector((state) => state.scratchGui.classroom);
    const vm = useSelector((state) => state.scratchGui.vm);

    // Auto-login with dev bypass token from URL (e.g. ?devlogin=<secret>)
    const urlParams = getUrlParams();
    if (urlParams.devlogin && !getCachedTeacherIdToken()) {
        setCachedTeacherIdToken(urlParams.devlogin);
    }

    // Determine initial phase from cached idToken. v2: land on the class
    // list (GC-style) instead of the assignment dashboard.
    const getInitialPhase = () => (getCachedTeacherIdToken() ? 'teacher-class-list' : 'teacher-login');

    // UI state
    const [phase, setPhase] = useState(getInitialPhase);
    const [error, setError] = useState(null);
    const [errorTitle, setErrorTitle] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [errorActionLabel, setErrorActionLabel] = useState(null);
    const [errorActionHandler, setErrorActionHandler] = useState(null);

    const showError = useCallback((message, title = null) => {
        setError(message);
        setErrorTitle(title);
        setErrorActionLabel(null);
        setErrorActionHandler(null);
    }, []);

    const clearError = useCallback(() => {
        setError(null);
        setErrorTitle(null);
        setErrorActionLabel(null);
        setErrorActionHandler(null);
    }, []);

    // Ref-based wrapper for showSessionExpiredError to break circular dependency
    const showSessionExpiredErrorRef = useRef(null);
    const stableShowSessionExpiredError = useCallback((...args) => showSessionExpiredErrorRef.current?.(...args), []);

    const teacher = useTeacherClassroom({
        mode: TEACHER_MODE,
        dispatch,
        intl,
        phase,
        setPhase,
        showError,
        clearError,
        showSessionExpiredError: stableShowSessionExpiredError,
        isLoading,
        setIsLoading,
        vm,
    });

    // Go back to login screen (used as error action for session expiry)
    const handleGoToLogin = useCallback(() => {
        setCachedTeacherIdToken(null);
        teacher.setIdToken(null);
        teacher.setClassrooms([]);
        teacher.setSelectedClassroom(null);
        teacher.setMembers([]);
        dispatch(clearTeacherSelection());
        setPhase('teacher-login');
    }, [dispatch, teacher]);

    // Sync teacher's selectedClassroom into Redux so the Mesh v2 binding
    // (mesh-v2-classroom-binding.jsx) and the connection modal can react to it.
    useEffect(() => {
        if (teacher.selectedClassroom && teacher.selectedClassroom.joinCode) {
            dispatch(
                setTeacherSelection({
                    classroomId: teacher.selectedClassroom.classroomId,
                    joinCode: teacher.selectedClassroom.joinCode,
                    className: teacher.selectedClassroom.className || teacher.selectedClassroom.name || null,
                    assignmentName: teacher.selectedClassroom.assignmentName || null,
                }),
            );
        }
    }, [dispatch, teacher.selectedClassroom]);

    // --- Teacher menu in the menu bar (#1199) ---

    // Mirror the login into Redux (menu visibility) and remember the provider
    // so the next page load can restore it silently. Only a token → none
    // transition counts as a logout: the modal may mount logged out while the
    // menu is still restoring the login in the background.
    const { idToken: teacherIdToken, authProvider: teacherAuthProvider, setIdToken: setTeacherIdToken } = teacher;
    const prevTeacherIdTokenRef = useRef(teacherIdToken);
    useEffect(() => {
        if (teacherIdToken) {
            dispatch(setTeacherLoggedIn(true));
            saveTeacherLogin(teacherAuthProvider);
        } else if (prevTeacherIdTokenRef.current) {
            dispatch(setTeacherLoggedIn(false));
            clearTeacherSession();
        }
        prevTeacherIdTokenRef.current = teacherIdToken;
    }, [dispatch, teacherIdToken, teacherAuthProvider]);

    // The background restore finished after this modal mounted on the login
    // screen: adopt the restored login instead of asking to log in again.
    const teacherLoggedIn = classroomState.teacherLoggedIn;
    useEffect(() => {
        const cached = getCachedTeacherIdToken();
        if (teacherLoggedIn && !teacherIdToken && cached) {
            teacher.setAuthProvider(getCachedTeacherAuthProvider());
            setTeacherIdToken(cached);
            setPhase('teacher-class-list');
        }
        // teacher is a fresh object every render; the setters are stable.
    }, [teacherLoggedIn, teacherIdToken, setTeacherIdToken]);

    const unreadCount = teacher.notificationsCenter.unreadCount;
    useEffect(() => {
        if (teacherIdToken) dispatch(setTeacherUnreadCount(unreadCount));
    }, [dispatch, teacherIdToken, unreadCount]);

    // Remember the assignment being worked on for "いまの課題を開く".
    const selectedClassroomId = teacher.selectedClassroom && teacher.selectedClassroom.classroomId;
    const selectedClassroomGroupId =
        (teacher.selectedClassroom && teacher.selectedClassroom.groupId) ||
        (teacher.selectedGroup && teacher.selectedGroup.groupId) ||
        null;
    useEffect(() => {
        if (!selectedClassroomId) return;
        const selection = { classroomId: selectedClassroomId, groupId: selectedClassroomGroupId };
        dispatch(setTeacherLastSelection(selection));
        saveTeacherLastSelection(selection);
    }, [dispatch, selectedClassroomId, selectedClassroomGroupId]);

    // Jump requested from the menu bar. Uses the same handlers as the
    // breadcrumbs / notification links, so the phase always follows the
    // selection (handleSelectGroup resets it to the board first).
    const navTarget = classroomState.teacherNavTarget;
    const lastSelection = classroomState.teacherLastSelection;
    useEffect(() => {
        if (!navTarget) return;
        if (!teacherIdToken) {
            // Not logged in after all: the modal shows the login screen.
            if (!teacherLoggedIn) dispatch(clearTeacherNavigation());
            return;
        }
        const nav = resolveTeacherNavigation({
            target: navTarget,
            lastSelection,
            groups: teacher.groups,
            groupsLoaded: (teacher.groups || []).length > 0,
        });
        if (nav.action === 'wait' || nav.action === 'none') return;
        dispatch(clearTeacherNavigation());
        if (nav.action === 'notifications') {
            teacher.notificationsCenter.handleShowAll();
        } else if (nav.action === 'assignment') {
            if (nav.group) teacher.handleSelectGroup(nav.group);
            teacher.handleSelectClassroom(nav.classroomId);
        } else {
            teacher.handleShowClassList();
        }
        // teacher is a fresh object every render; re-run only when the inputs change.
    }, [dispatch, navTarget, lastSelection, teacherIdToken, teacherLoggedIn, teacher.groups]);

    // Handle relogin request from Alert "参加しなおす" button
    useEffect(() => {
        if (classroomState.reloginRequested) {
            dispatch(clearClassroomSession());
            handleGoToLogin();
        }
    }, [classroomState.reloginRequested, dispatch, handleGoToLogin]);

    const showSessionExpiredError = useCallback(() => {
        showAlertWithTimeout(dispatch, 'classroomTeacherSessionExpired');
    }, [dispatch]);
    showSessionExpiredErrorRef.current = showSessionExpiredError;

    const handleClose = useCallback(() => {
        dispatch(closeTeacherModal());
    }, [dispatch]);

    // Wrap the teacher logout so we also clear teacherSelection from Redux —
    // the underlying handleTeacherLogout only resets local hook state.
    const handleTeacherLogoutWithReduxClear = useCallback(() => {
        dispatch(clearTeacherSelection());
        teacher.handleTeacherLogout();
    }, [dispatch, teacher]);

    const teacherContainerProps = {
        phase,
        classrooms: teacher.classrooms,
        archivedClassrooms: teacher.archivedClassrooms,
        onRestoreClassroom: teacher.handleRestoreClassroom,
        selectedClassroom: teacher.selectedClassroom,
        members: teacher.members,
        error,
        errorTitle,
        errorActionLabel,
        errorActionHandler,
        isLoading,
        selectedMember: teacher.selectedMember,
        codeDisplayClassroom: teacher.codeDisplayClassroom,
        codeDisplayFullscreen: teacher.codeDisplayFullscreen,
        downloadProgress: teacher.downloadProgress,
        googleCourses: teacher.googleCourses,
        googleCourseAccess: teacher.googleCourseAccess,
        isVerifyingGoogleCourseAccess: teacher.isVerifyingGoogleCourseAccess,
        onVerifyGoogleCourseAccess: teacher.handleVerifyGoogleCourseAccess,
        selectedGoogleCourse: teacher.selectedGoogleCourse,
        googleSignInRef: teacher.googleSignInRef,
        googleFallbackReason: teacher.googleFallbackReason,
        onGoogleLogin: teacher.handleGoogleLogin,
        onMicrosoftLogin: teacher.handleMicrosoftLogin,
        isMicrosoftAuthAvailable: teacher.isMicrosoftAuthAvailable,
        authProvider: teacher.authProvider,
        onTeacherLogout: handleTeacherLogoutWithReduxClear,
        onSelectClassroom: teacher.handleSelectClassroom,
        onBackToDashboard: teacher.handleBackToDashboard,
        onDeleteClassroom: teacher.handleDeleteClassroom,
        onDeleteMember: teacher.handleDeleteMember,
        onRefreshDetail: teacher.handleRefreshDetail,
        onSelectMember: teacher.handleSelectMember,
        onOpenSubmission: teacher.handleOpenSubmission,
        onReturnSubmission: teacher.handleReturnSubmission,
        onDownloadAll: teacher.handleDownloadAll,
        onDownloadClassAll: teacher.handleDownloadClassAll,
        onShowCodeDisplay: teacher.handleShowCodeDisplay,
        onCloseCodeDisplay: teacher.handleCloseCodeDisplay,
        onCopyInviteLink: teacher.handleCopyInviteLink,
        onToggleCodeFullscreen: teacher.handleToggleCodeFullscreen,
        onShowPostAssignment: teacher.handleShowPostAssignment,
        onBackToDetail: teacher.handleBackToDetail,
        onPostAssignment: teacher.handlePostAssignment,
        onShowGoogleCourses: teacher.handleShowGoogleCourses,
        onLoadGoogleCourses: teacher.handleLoadGoogleCourses,
        onSelectGoogleCourse: teacher.handleSelectGoogleCourse,
        onConfirmGoogleImport: teacher.handleConfirmGoogleImport,
        onUpdateAssignmentName: teacher.handleUpdateAssignmentName,
        kickRequestsBySeat: teacher.kickRequestsBySeat,
        onApproveKickRequest: teacher.handleApproveKickRequest,
        onRejectKickRequest: teacher.handleRejectKickRequest,
        assignmentEditorPages: teacher.assignmentEditorPages,
        assignmentStarterMode: teacher.assignmentStarterMode,
        assignmentStarterSource: teacher.assignmentStarterSource,
        assignmentHasExistingStarter: teacher.assignmentHasExistingStarter,
        assignmentIsSaving: teacher.assignmentIsSaving,
        onAssignmentAddPage: teacher.handleAssignmentAddPage,
        onAssignmentRemovePage: teacher.handleAssignmentRemovePage,
        onAssignmentMovePage: teacher.handleAssignmentMovePage,
        onAssignmentChangePageText: teacher.handleAssignmentChangePageText,
        onAssignmentAttachPageImage: teacher.handleAssignmentAttachPageImage,
        onAssignmentRemovePageImage: teacher.handleAssignmentRemovePageImage,
        onAssignmentUseCurrentProject: teacher.handleAssignmentUseCurrentProject,
        onAssignmentUseFile: teacher.handleAssignmentUseFile,
        onAssignmentRemoveStarter: teacher.handleAssignmentRemoveStarter,
        onAssignmentSave: teacher.handleAssignmentSave,
        onAssignmentCancel: teacher.handleAssignmentCancel,
        groups: teacher.groups,
        teacherEmail: teacherEmailFromToken(teacher.idToken),
        selectedGroup: teacher.selectedGroup,
        onSelectGroup: teacher.handleSelectGroup,
        onShowClassList: teacher.handleShowClassList,
        onCreateClassWithAssignment: teacher.handleCreateClassWithAssignment,
        onUpdateGroupTopics: teacher.handleUpdateGroupTopics,
        onUpdateAssignmentMeta: teacher.handleUpdateAssignmentMeta,
        onCreateAssignmentInClass: teacher.handleCreateAssignmentInClass,
        onDetailTabChange: teacher.setDetailTab,
        onReuseAssignment: teacher.handleReuseAssignment,
        onUpdateGroup: teacher.handleUpdateGroup,
        evaluation: teacher.evaluation,
        shared: teacher.shared,
        notificationsCenter: teacher.notificationsCenter,
    };
    return <ClassroomTeacherModalComponent containerProps={teacherContainerProps} onClose={handleClose} />;
};

export default ClassroomTeacherModal;
