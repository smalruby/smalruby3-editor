import PropTypes from 'prop-types';
import React, { useCallback, useRef, useState, useEffect } from 'react';
import { useIntl } from 'react-intl';
import { useDispatch, useSelector } from 'react-redux';
import ClassroomModalComponent from '../components/classroom-modal/classroom-modal.jsx';
import ClassroomTeacherModalComponent from '../components/classroom-teacher-modal/classroom-teacher-modal.jsx';
import analytics from '../lib/analytics';
import classroomAPI from '../lib/classroom-api.js';
import { loadHistory, addToHistory } from '../lib/join-code-history.js';
import { getUrlParams, clearClasscode } from '../lib/url-params.js';
import { showAlertWithTimeout } from '../reducers/alerts.js';
import {
    closeClassroomModal,
    closeTeacherModal,
    openTeacherModal,
    setClassroomSession,
    clearClassroomSession,
    setSubmissionStatus,
    setTeacherSelection,
    clearTeacherSelection,
} from '../reducers/classroom.js';
import { setProjectTitle } from '../reducers/project-title.js';
import translateError from './classroom-error-utils.js';
import useStudentSubmit from './use-student-submit.js';
import useTeacherClassroom, { getCachedTeacherIdToken, setCachedTeacherIdToken } from './use-teacher-classroom.js';

const ClassroomModal = ({ mode = 'student' }) => {
    const dispatch = useDispatch();
    const intl = useIntl();
    const classroomState = useSelector((state) => state.scratchGui.classroom);
    const vm = useSelector((state) => state.scratchGui.vm);
    const projectTitle = useSelector((state) => state.scratchGui.projectTitle);
    const scratchBlocks = useSelector((state) => state.scratchGui.blockDisplay?.scratchBlocks);

    // Auto-login with dev bypass token from URL (e.g. ?devlogin=<secret>)
    if (mode === 'teacher') {
        const urlParams = getUrlParams();
        if (urlParams.devlogin && !getCachedTeacherIdToken()) {
            setCachedTeacherIdToken(urlParams.devlogin);
        }
    }

    // Determine initial phase based on mode and persisted session
    const getInitialPhase = () => {
        if (mode === 'teacher') {
            if (getCachedTeacherIdToken()) return 'teacher-dashboard';
            return 'teacher-login';
        }
        if (classroomState.role === 'student' && classroomState.sessionToken) {
            return 'student-status';
        }
        return 'student-join';
    };

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

    // Teacher hook (called unconditionally — required for teacher modal rendering)
    const teacher = useTeacherClassroom({
        mode,
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

    // Student submit hook
    const submit = useStudentSubmit({
        classroomState,
        vm,
        scratchBlocks,
        projectTitle,
        dispatch,
        clearError,
        showError,
        showSessionExpiredError: stableShowSessionExpiredError,
        intl,
        setIsLoading,
        setPhase,
    });

    // Go back to login/join screen (used as error action for session expiry)
    const handleGoToLogin = useCallback(() => {
        if (mode === 'teacher') {
            setCachedTeacherIdToken(null);
            teacher.setIdToken(null);
            teacher.setClassrooms([]);
            teacher.setSelectedClassroom(null);
            teacher.setMembers([]);
            dispatch(clearTeacherSelection());
            setPhase('teacher-login');
        } else {
            dispatch(clearClassroomSession());
            clearError();
            setPhase('student-join');
        }
    }, [mode, clearError, dispatch, teacher]);

    // Sync teacher's selectedClassroom into Redux + sessionStorage so it survives modal close.
    // This drives the Mesh v2 domain binding (see mesh-v2-classroom-binding.jsx).
    useEffect(() => {
        if (mode !== 'teacher') return;
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
    }, [mode, dispatch, teacher.selectedClassroom]);

    // Handle relogin request from Alert "参加しなおす" button
    useEffect(() => {
        if (classroomState.reloginRequested) {
            dispatch(clearClassroomSession());
            handleGoToLogin();
        }
    }, [classroomState.reloginRequested, dispatch, handleGoToLogin]);

    const showSessionExpiredError = useCallback(() => {
        const alertId = mode === 'teacher' ? 'classroomTeacherSessionExpired' : 'classroomSessionExpired';
        showAlertWithTimeout(dispatch, alertId);
    }, [dispatch, mode]);
    showSessionExpiredErrorRef.current = showSessionExpiredError;

    const handleClose = useCallback(() => {
        dispatch(mode === 'teacher' ? closeTeacherModal() : closeClassroomModal());
    }, [dispatch, mode]);

    // --- Student: open teacher management modal ---

    const handleSelectTeacher = useCallback(() => {
        dispatch(closeClassroomModal());
        dispatch(openTeacherModal());
    }, [dispatch]);

    // --- Student: join state ---

    const [joinCodeHistory, setJoinCodeHistory] = useState(() => loadHistory());
    const [pendingJoinCode, setPendingJoinCode] = useState(null);
    const [seatCount, setSeatCount] = useState(0);
    const [takenSeats, setTakenSeats] = useState([]);
    const [selectedSeat, setSelectedSeat] = useState(null);
    const [pendingClassroomInfo, setPendingClassroomInfo] = useState(null);
    const [joinedInfo, setJoinedInfo] = useState(null);

    // --- Student: Join with code ---

    const handleJoinWithCode = useCallback(
        async (joinCode) => {
            clearError();
            setIsLoading(true);
            try {
                const data = await classroomAPI.lookupClassroom(joinCode);
                setPendingJoinCode(joinCode);
                setPendingClassroomInfo({
                    className: data.className || '',
                    assignmentName: data.assignmentName || '',
                    expiresAt: data.expiresAt || null,
                });
                setSeatCount(data.studentCount);
                setTakenSeats(data.takenSeats || []);
                setSelectedSeat(null);
                setPhase('student-seat');
            } catch (err) {
                const title = intl.formatMessage({
                    defaultMessage: 'An error occurred',
                    description: 'Error dialog title',
                    id: 'gui.classroom.error.title',
                });
                showError(translateError(intl, err, 'join'), title);
            } finally {
                setIsLoading(false);
            }
        },
        [clearError, showError, intl],
    );

    const handleSelectSeat = useCallback((seatNumber) => {
        setSelectedSeat(seatNumber);
    }, []);

    // --- Student: Confirm join ---

    const handleConfirmJoin = useCallback(async () => {
        if (!pendingJoinCode || !selectedSeat) return;
        clearError();
        setIsLoading(true);
        try {
            const data = await classroomAPI.joinClassroom(pendingJoinCode, selectedSeat);
            dispatch(
                setClassroomSession({
                    role: 'student',
                    classroomId: data.classroomId,
                    className: data.className,
                    assignmentName: data.assignmentName || null,
                    joinCode: pendingJoinCode,
                    seatNumber: data.seatNumber,
                    memberId: data.memberId,
                    sessionToken: data.sessionToken,
                    joinedAt: new Date().toISOString(),
                }),
            );
            try {
                analytics.event({
                    category: 'classroom',
                    action: 'join',
                    label: data.assignmentName ? 'with_assignment' : 'no_assignment',
                });
            } catch (_e) {
                // Swallow analytics failures so the editor never breaks.
            }
            if (data.assignmentName) {
                dispatch(setProjectTitle(data.assignmentName));
            }
            addToHistory({
                joinCode: pendingJoinCode,
                className: data.className,
                assignmentName: data.assignmentName || '',
                expiresAt: pendingClassroomInfo?.expiresAt || null,
            });
            setJoinCodeHistory(loadHistory());
            setJoinedInfo({
                className: data.className,
                assignmentName: data.assignmentName || null,
                seatNumber: data.seatNumber,
            });
            setPhase('student-joined');
        } catch (err) {
            if (err.status === 409) {
                setTakenSeats((prev) => [...prev, selectedSeat]);
                setSelectedSeat(null);
            }
            showError(translateError(intl, err, 'seat'));
        } finally {
            setIsLoading(false);
        }
    }, [dispatch, pendingJoinCode, selectedSeat, pendingClassroomInfo, clearError, showError, intl]);

    // --- Student: Verify session + fetch submission status ---

    const [studentTeacherComment, setStudentTeacherComment] = useState(null);

    const refreshStudentStatus = useCallback(async () => {
        if (!classroomState.sessionToken) return;
        setIsLoading(true);
        try {
            const result = await classroomAPI.verifySession(classroomState.sessionToken);
            if (result.submission) {
                dispatch(setSubmissionStatus(result.submission.status, result.submission.submittedAt));
                setStudentTeacherComment(result.submission.teacherComment || null);
            }
        } catch {
            dispatch(clearClassroomSession());
            showSessionExpiredError(translateError(intl, { status: 401 }, 'session'));
        } finally {
            setIsLoading(false);
        }
    }, [classroomState.sessionToken, dispatch, showSessionExpiredError, intl]);

    useEffect(() => {
        if (phase === 'student-status' && classroomState.sessionToken) {
            refreshStudentStatus();
        }
    }, [phase]); // Only on phase change

    // --- Student: Leave classroom ---

    const handleLeaveClassroom = useCallback(async () => {
        if (classroomState.sessionToken && classroomState.classroomId) {
            try {
                await classroomAPI.leaveClassroom(classroomState.sessionToken, classroomState.classroomId);
            } catch {
                // Proceed even if server call fails
            }
        }
        dispatch(clearClassroomSession());
        setPhase('student-join');
    }, [classroomState.sessionToken, classroomState.classroomId, dispatch]);

    // --- Classcode URL parameter auto-join ---
    useEffect(() => {
        const classcodeParams = getUrlParams();
        if (!classcodeParams.classcode) return;

        const code = classcodeParams.classcode;

        const url = new URL(window.location.href);
        url.searchParams.delete('classcode');
        window.history.replaceState({}, '', url.toString());
        clearClasscode();

        if (classroomState.sessionToken && classroomState.joinCode === code) {
            setPhase('student-status');
            return;
        }

        if (classroomState.sessionToken) {
            dispatch(clearClassroomSession());
        }

        handleJoinWithCode(code);
    }, []); // Run once on mount

    // --- Teacher modal (separate fullscreen modal) ---

    if (mode === 'teacher') {
        const teacherContainerProps = {
            phase,
            classrooms: teacher.classrooms,
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
            onTeacherLogout: teacher.handleTeacherLogout,
            onShowCreateForm: teacher.handleShowCreateForm,
            onCreateClassroom: teacher.handleCreateClassroom,
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
            onUpdateStudentCount: teacher.handleUpdateStudentCount,
        };
        return <ClassroomTeacherModalComponent containerProps={teacherContainerProps} onClose={handleClose} />;
    }

    // --- Student modal ---

    return (
        <ClassroomModalComponent
            classroomState={classroomState}
            error={error}
            errorActionHandler={errorActionHandler}
            errorActionLabel={errorActionLabel}
            errorTitle={errorTitle}
            isLoading={isLoading}
            joinCodeHistory={joinCodeHistory}
            joinedInfo={joinedInfo}
            phase={phase}
            seatCount={seatCount}
            selectedSeat={selectedSeat}
            submitProgress={submit.submitProgress}
            takenSeats={takenSeats}
            teacherComment={studentTeacherComment}
            thumbnailDataUrl={submit.thumbnailDataUrl}
            onCancelSubmit={submit.handleCancelSubmit}
            onClose={handleClose}
            onConfirmJoin={handleConfirmJoin}
            onConfirmSubmit={submit.handleConfirmSubmit}
            onJoinWithCode={handleJoinWithCode}
            onLeaveClassroom={handleLeaveClassroom}
            onRefreshStudentStatus={refreshStudentStatus}
            onSelectSeat={handleSelectSeat}
            onSelectTeacher={handleSelectTeacher}
            onStartSubmit={submit.handleStartSubmit}
        />
    );
};

ClassroomModal.propTypes = {
    mode: PropTypes.oneOf(['student', 'teacher']),
};

export default ClassroomModal;
