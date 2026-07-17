import React, { useCallback, useRef, useState, useEffect } from 'react';
import { useIntl } from 'react-intl';
import { useDispatch, useSelector } from 'react-redux';
import ClassroomTeacherModalComponent from '../components/classroom-teacher-modal/classroom-teacher-modal.jsx';
import { teacherEmailFromToken } from '../lib/classroom-class-label.js';
import { getUrlParams } from '../lib/url-params.js';
import { showAlertWithTimeout } from '../reducers/alerts.js';
import {
    closeTeacherModal,
    clearClassroomSession,
    setTeacherSelection,
    clearTeacherSelection,
} from '../reducers/classroom.js';
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
        selectedGoogleCourse: teacher.selectedGoogleCourse,
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
    };
    return <ClassroomTeacherModalComponent containerProps={teacherContainerProps} onClose={handleClose} />;
};

export default ClassroomTeacherModal;
