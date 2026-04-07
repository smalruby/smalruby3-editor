import PropTypes from 'prop-types';
import React, { useCallback, useRef, useState, useEffect } from 'react';
import { useIntl } from 'react-intl';
import { useDispatch, useSelector } from 'react-redux';
import ClassroomModalComponent from '../components/classroom-modal/classroom-modal.jsx';
import ClassroomTeacherModalComponent from '../components/classroom-teacher-modal/classroom-teacher-modal.jsx';
import { renderBlocksToCanvas } from '../lib/blocks-screenshot.js';
import classroomAPI from '../lib/classroom-api.js';
import { getProjectThumbnail } from '../lib/store-project-thumbnail.js';
import { getUrlParams, clearClasscode } from '../lib/url-params.js';
import {
    closeClassroomModal,
    closeTeacherModal,
    setClassroomSession,
    clearClassroomSession,
    setSubmissionStatus,
} from '../reducers/classroom.js';
import { setProjectTitle } from '../reducers/project-title.js';
import translateError from './classroom-error-utils.js';
import useTeacherClassroom, {
    getCachedTeacherIdToken,
    setCachedTeacherIdToken,
    DEV_BYPASS_TOKEN,
} from './use-teacher-classroom.js';

const ClassroomModal = ({ mode = 'student' }) => {
    const dispatch = useDispatch();
    const intl = useIntl();
    const classroomState = useSelector(state => state.scratchGui.classroom);
    const vm = useSelector(state => state.scratchGui.vm);
    const projectTitle = useSelector(state => state.scratchGui.projectTitle);
    const scratchBlocks = useSelector(state => state.scratchGui.blockDisplay?.scratchBlocks);

    // Auto-login with dev bypass token when devlogin=1
    const urlParams = getUrlParams();
    if (mode === 'teacher' && urlParams.devlogin && DEV_BYPASS_TOKEN && !getCachedTeacherIdToken()) {
        setCachedTeacherIdToken(DEV_BYPASS_TOKEN);
    }

    // Determine initial phase based on mode and persisted session
    const getInitialPhase = () => {
        if (mode === 'teacher') {
            if (getCachedTeacherIdToken()) return 'teacher-dashboard';
            return 'teacher-login';
        }
        // Student mode
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

    // Error action state (link shown alongside the error message)
    const [errorActionLabel, setErrorActionLabel] = useState(null);
    const [errorActionHandler, setErrorActionHandler] = useState(null);

    // Helper to set error with optional title
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

    // Use a ref-based wrapper for showSessionExpiredError to break the circular
    // dependency: the hook needs showSessionExpiredError, but
    // showSessionExpiredError needs handleGoToLogin, which needs teacher state.
    // The ref is updated after showSessionExpiredError is defined below.
    const showSessionExpiredErrorRef = useRef(null);
    const stableShowSessionExpiredError = useCallback((...args) => showSessionExpiredErrorRef.current?.(...args), []);

    // Teacher hook (must be called unconditionally)
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

    // Go back to login/join screen (used as error action for session expiry)
    const handleGoToLogin = useCallback(() => {
        if (mode === 'teacher') {
            setCachedTeacherIdToken(null);
            teacher.setIdToken(null);
            teacher.setClassrooms([]);
            teacher.setSelectedClassroom(null);
            teacher.setMembers([]);
        } else {
            dispatch(clearClassroomSession());
        }
        clearError();
        setPhase(mode === 'teacher' ? 'teacher-login' : 'student-join');
    }, [mode, clearError, dispatch, teacher]);

    // Show error with session-expired action link
    const showSessionExpiredError = useCallback(
        (message, title = null) => {
            setError(message);
            setErrorTitle(title);
            const label =
                mode === 'teacher'
                    ? intl.formatMessage({
                          defaultMessage: 'Go to login screen',
                          description: 'Link to go back to the login screen after session expiry',
                          id: 'gui.classroom.error.goToLogin',
                      })
                    : intl.formatMessage({
                          defaultMessage: 'Go to join screen',
                          description: 'Link to go back to the join screen after session expiry',
                          id: 'gui.classroom.error.goToJoin',
                      });
            setErrorActionLabel(label);
            // useState setter with function form to store the callback
            setErrorActionHandler(() => handleGoToLogin);
        },
        [mode, intl, handleGoToLogin],
    );
    showSessionExpiredErrorRef.current = showSessionExpiredError;

    const handleClose = useCallback(() => {
        dispatch(mode === 'teacher' ? closeTeacherModal() : closeClassroomModal());
    }, [dispatch, mode]);

    // --- Role selection ---

    const handleSelectTeacher = useCallback(() => {
        clearError();
        if (teacher.idToken) {
            setPhase('teacher-dashboard');
        } else {
            setPhase('teacher-login');
        }
    }, [teacher.idToken, clearError]);

    const handleSelectStudent = useCallback(() => {
        clearError();
        setPhase('student-join');
    }, [clearError]);

    // --- Student state ---

    const [pendingJoinCode, setPendingJoinCode] = useState(null);
    const [seatCount, setSeatCount] = useState(0);
    const [takenSeats, setTakenSeats] = useState([]);
    const [selectedSeat, setSelectedSeat] = useState(null);
    const [joinedInfo, setJoinedInfo] = useState(null);

    // Submission state
    const [thumbnailDataUrl, setThumbnailDataUrl] = useState(null);
    const [submitProgress, setSubmitProgress] = useState(null);

    // --- Student: Join with code (validate first) ---

    const handleJoinWithCode = useCallback(
        async joinCode => {
            clearError();
            setIsLoading(true);
            try {
                const data = await classroomAPI.lookupClassroom(joinCode);
                setPendingJoinCode(joinCode);
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

    const handleSelectSeat = useCallback(seatNumber => {
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
            if (data.assignmentName) {
                dispatch(setProjectTitle(data.assignmentName));
            }
            setJoinedInfo({
                className: data.className,
                assignmentName: data.assignmentName || null,
                seatNumber: data.seatNumber,
            });
            setPhase('student-joined');
        } catch (err) {
            if (err.status === 409) {
                setTakenSeats(prev => [...prev, selectedSeat]);
                setSelectedSeat(null);
            }
            showError(translateError(intl, err, 'seat'));
        } finally {
            setIsLoading(false);
        }
    }, [dispatch, pendingJoinCode, selectedSeat, clearError, showError, intl]);

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

    // Fetch on student-status phase display
    useEffect(() => {
        if (phase === 'student-status' && classroomState.sessionToken) {
            refreshStudentStatus();
        }
    }, [phase]); // Only on phase change, not on every render

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

    // --- Student: Start submit flow ---

    const handleStartSubmit = useCallback(() => {
        clearError();
        setThumbnailDataUrl(null);
        if (vm && vm.renderer) {
            getProjectThumbnail(vm, dataUrl => {
                setThumbnailDataUrl(dataUrl);
            });
        }
        setPhase('student-submit-confirm');
    }, [vm, clearError]);

    // --- Student: Confirm submit ---

    /**
     * Capture block screenshots for all targets that have blocks.
     * @returns {Promise<Blob[]>} Array of PNG blobs
     */
    const captureBlockScreenshots = useCallback(async () => {
        if (!vm || !scratchBlocks) return [];

        const workspace = scratchBlocks.getMainWorkspace();
        if (!workspace) return [];

        const originalTargetId = vm.editingTarget?.id;
        const allTargets = vm.runtime.targets.filter(t => !t.isOriginal === false || t.isOriginal);
        const targetsWithBlocks = allTargets.filter(t => {
            const blocks = t.blocks._blocks;
            return blocks && Object.keys(blocks).length > 0;
        });

        const blobs = [];
        for (let i = 0; i < targetsWithBlocks.length; i++) {
            const target = targetsWithBlocks[i];
            setSubmitProgress({
                current: i + 1,
                total: targetsWithBlocks.length,
                label: target.sprite.name,
            });

            vm.setEditingTarget(target.id);
            await new Promise(resolve => {
                setTimeout(() => requestAnimationFrame(resolve), 100);
            });

            try {
                const costumeDataUri = target.sprite.costumes[target.currentCostume]?.asset?.encodeDataURI();
                const canvas = await renderBlocksToCanvas(workspace, costumeDataUri);
                if (!canvas) continue;

                const blob = await new Promise(resolve => {
                    canvas.toBlob(resolve, 'image/png');
                });
                if (blob) blobs.push(blob);
            } catch {
                // Skip sprites that fail to capture
            }
        }

        if (originalTargetId) {
            vm.setEditingTarget(originalTargetId);
        }
        setSubmitProgress(null);
        return blobs;
    }, [vm, scratchBlocks]);

    const handleConfirmSubmit = useCallback(async () => {
        if (!classroomState.sessionToken || !classroomState.classroomId) return;
        clearError();
        setIsLoading(true);
        try {
            const submitProjectTitle = projectTitle || 'Untitled';
            const screenshotBlobs = await captureBlockScreenshots();

            const submissionData = await classroomAPI.createSubmission(
                classroomState.sessionToken,
                classroomState.classroomId,
                submitProjectTitle,
                screenshotBlobs.length,
            );

            setSubmitProgress({ current: 0, total: 1, label: 'project' });
            const sb3Data = await vm.saveProjectSb3();
            const MAX_FILE_SIZE = 10 * 1024 * 1024;
            if (sb3Data.byteLength > MAX_FILE_SIZE) {
                const sizeMB = (sb3Data.byteLength / (1024 * 1024)).toFixed(1);
                throw new Error(
                    intl.formatMessage(
                        {
                            defaultMessage: 'Project is too large ({size}MB). Maximum size is 10MB.',
                            description: 'File too large error',
                            id: 'gui.classroom.error.fileTooLarge',
                        },
                        { size: sizeMB },
                    ),
                );
            }
            await classroomAPI.uploadToPresignedUrl(submissionData.uploadUrl, sb3Data, 'application/octet-stream');

            if (thumbnailDataUrl) {
                const thumbnailBlob = await fetch(thumbnailDataUrl).then(r => r.blob());
                await classroomAPI.uploadToPresignedUrl(
                    submissionData.thumbnailUploadUrl,
                    thumbnailBlob,
                    'image/png',
                );
            }

            if (screenshotBlobs.length > 0 && submissionData.screenshotUploadUrls) {
                await Promise.all(
                    screenshotBlobs.map((blob, i) =>
                        classroomAPI.uploadToPresignedUrl(submissionData.screenshotUploadUrls[i], blob, 'image/png'),
                    ),
                );
            }

            setSubmitProgress(null);
            dispatch(setSubmissionStatus('submitted', submissionData.submittedAt));
            setPhase('student-status');
        } catch (err) {
            setSubmitProgress(null);
            if (err.status === 401) {
                dispatch(clearClassroomSession());
                showSessionExpiredError(translateError(intl, err, 'session'));
            } else {
                showError(translateError(intl, err));
            }
        } finally {
            setIsLoading(false);
        }
    }, [
        classroomState,
        vm,
        projectTitle,
        thumbnailDataUrl,
        captureBlockScreenshots,
        dispatch,
        clearError,
        showError,
        showSessionExpiredError,
        intl,
    ]);

    const handleCancelSubmit = useCallback(() => {
        setPhase('student-status');
    }, []);

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
    }, []); // Run once on mount — intentionally omit deps

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
        onTeacherLogin: teacher.handleTeacherLogin,
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
        onPostAssignment: teacher.handlePostAssignment,
        onGoogleClassroomImport: teacher.handleGoogleClassroomImport,
        onSelectGoogleCourse: teacher.handleSelectGoogleCourse,
        onConfirmGoogleImport: teacher.handleConfirmGoogleImport,
        onUpdateAssignmentName: teacher.handleUpdateAssignmentName,
    };

    if (mode === 'teacher') {
        return <ClassroomTeacherModalComponent containerProps={teacherContainerProps} onClose={handleClose} />;
    }

    return (
        <ClassroomModalComponent
            classrooms={teacher.classrooms}
            classroomState={classroomState}
            error={error}
            errorActionHandler={errorActionHandler}
            errorActionLabel={errorActionLabel}
            errorTitle={errorTitle}
            isLoading={isLoading}
            joinedInfo={joinedInfo}
            members={teacher.members}
            phase={phase}
            seatCount={seatCount}
            selectedClassroom={teacher.selectedClassroom}
            selectedMember={teacher.selectedMember}
            selectedSeat={selectedSeat}
            takenSeats={takenSeats}
            thumbnailDataUrl={thumbnailDataUrl}
            codeDisplayClassroom={teacher.codeDisplayClassroom}
            codeDisplayFullscreen={teacher.codeDisplayFullscreen}
            onBackToDashboard={teacher.handleBackToDashboard}
            onCloseCodeDisplay={teacher.handleCloseCodeDisplay}
            onClose={handleClose}
            onConfirmJoin={handleConfirmJoin}
            onCopyInviteLink={teacher.handleCopyInviteLink}
            onCreateClassroom={teacher.handleCreateClassroom}
            onDeleteClassroom={teacher.handleDeleteClassroom}
            onDeleteMember={teacher.handleDeleteMember}
            onDownloadAll={teacher.handleDownloadAll}
            downloadProgress={teacher.downloadProgress}
            onJoinWithCode={handleJoinWithCode}
            onLeaveClassroom={handleLeaveClassroom}
            submitProgress={submitProgress}
            onOpenSubmission={teacher.handleOpenSubmission}
            onRefreshDetail={teacher.handleRefreshDetail}
            onReturnSubmission={teacher.handleReturnSubmission}
            teacherComment={studentTeacherComment}
            onRefreshStudentStatus={refreshStudentStatus}
            onStartSubmit={handleStartSubmit}
            onConfirmSubmit={handleConfirmSubmit}
            onCancelSubmit={handleCancelSubmit}
            onShowCodeDisplay={teacher.handleShowCodeDisplay}
            onSelectClassroom={teacher.handleSelectClassroom}
            onSelectMember={teacher.handleSelectMember}
            onSelectSeat={handleSelectSeat}
            onSelectStudent={handleSelectStudent}
            onSelectTeacher={handleSelectTeacher}
            onShowCreateForm={teacher.handleShowCreateForm}
            onTeacherLogin={teacher.handleTeacherLogin}
            onTeacherLogout={teacher.handleTeacherLogout}
            onToggleCodeFullscreen={teacher.handleToggleCodeFullscreen}
            googleCourses={teacher.googleCourses}
            selectedGoogleCourse={teacher.selectedGoogleCourse}
            onGoogleClassroomImport={teacher.handleGoogleClassroomImport}
            onSelectGoogleCourse={teacher.handleSelectGoogleCourse}
            onConfirmGoogleImport={teacher.handleConfirmGoogleImport}
            onPostAssignment={teacher.handlePostAssignment}
            onShowPostAssignment={teacher.handleShowPostAssignment}
        />
    );
};

ClassroomModal.propTypes = {
    mode: PropTypes.oneOf(['student', 'teacher']),
};

export default ClassroomModal;
