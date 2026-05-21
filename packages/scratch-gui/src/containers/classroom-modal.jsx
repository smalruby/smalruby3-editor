import React, { useCallback, useRef, useState, useEffect } from 'react';
import { useIntl } from 'react-intl';
import { useDispatch, useSelector } from 'react-redux';
import ClassroomModalComponent from '../components/classroom-modal/classroom-modal.jsx';
import analytics from '../lib/analytics';
import classroomAPI from '../lib/classroom-api.js';
import { loadHistory, addToHistory } from '../lib/join-code-history.js';
import { getUrlParams, clearClasscode } from '../lib/url-params.js';
import { showAlertWithTimeout } from '../reducers/alerts.js';
import {
    closeClassroomModal,
    openTeacherModal,
    setClassroomSession,
    clearClassroomSession,
    setSubmissionStatus,
} from '../reducers/classroom.js';
import { setProjectTitle } from '../reducers/project-title.js';
import translateError, { extractKickReason } from './classroom-error-utils.js';
import useStudentSubmit from './use-student-submit.js';

const ClassroomModal = () => {
    const dispatch = useDispatch();
    const intl = useIntl();
    const classroomState = useSelector((state) => state.scratchGui.classroom);
    const vm = useSelector((state) => state.scratchGui.vm);
    const projectTitle = useSelector((state) => state.scratchGui.projectTitle);
    const scratchBlocks = useSelector((state) => state.scratchGui.blockDisplay?.scratchBlocks);

    // Determine initial phase from persisted session
    const getInitialPhase = () => {
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

    // Go back to join screen (used as error action for session expiry)
    const handleGoToLogin = useCallback(() => {
        dispatch(clearClassroomSession());
        clearError();
        setPhase('student-join');
    }, [clearError, dispatch]);

    // Handle relogin request from Alert "参加しなおす" button
    useEffect(() => {
        if (classroomState.reloginRequested) {
            dispatch(clearClassroomSession());
            handleGoToLogin();
        }
    }, [classroomState.reloginRequested, dispatch, handleGoToLogin]);

    const showSessionExpiredError = useCallback(() => {
        showAlertWithTimeout(dispatch, 'classroomSessionExpired');
    }, [dispatch]);
    showSessionExpiredErrorRef.current = showSessionExpiredError;

    const handleClose = useCallback(() => {
        dispatch(closeClassroomModal());
    }, [dispatch]);

    // --- Open teacher management modal ---

    const handleSelectTeacher = useCallback(() => {
        dispatch(closeClassroomModal());
        dispatch(openTeacherModal());
    }, [dispatch]);

    // --- Join state ---

    const [joinCodeHistory, setJoinCodeHistory] = useState(() => loadHistory());
    const [pendingJoinCode, setPendingJoinCode] = useState(null);
    const [seatCount, setSeatCount] = useState(0);
    const [takenSeats, setTakenSeats] = useState([]);
    const [selectedSeat, setSelectedSeat] = useState(null);
    const [pendingClassroomInfo, setPendingClassroomInfo] = useState(null);
    const [joinedInfo, setJoinedInfo] = useState(null);
    // Set to {joinCode, className, seatNumber} when the student arrives at the
    // seat-selection screen because the teacher kicked them. The seat-selector
    // shows a dismissible banner so the student knows the reason rather than
    // seeing the generic "session expired" alert.
    const [kickedNotice, setKickedNotice] = useState(null);
    const handleDismissKickedNotice = useCallback(() => setKickedNotice(null), []);

    // --- Join with code ---

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

    // --- Confirm join ---

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
            setKickedNotice(null);
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

    // --- Verify session + fetch submission status ---

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
        } catch (err) {
            const kick = extractKickReason(err);
            if (kick) {
                // Teacher removed the student. Clear the dead session, jump
                // straight to seat selection for the same classroom, and let
                // the seat-selector show a "you were removed" banner so the
                // student knows what happened instead of seeing the generic
                // "session expired" alert.
                dispatch(clearClassroomSession());
                setKickedNotice(kick);
                handleJoinWithCode(kick.joinCode);
            } else {
                dispatch(clearClassroomSession());
                showSessionExpiredError(translateError(intl, { status: 401 }, 'session'));
            }
        } finally {
            setIsLoading(false);
        }
    }, [classroomState.sessionToken, dispatch, showSessionExpiredError, intl, handleJoinWithCode]);

    useEffect(() => {
        if (phase === 'student-status' && classroomState.sessionToken) {
            refreshStudentStatus();
        }
    }, [phase]); // Only on phase change

    // --- Leave classroom ---

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
            kickedNotice={kickedNotice}
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
            onDismissKickedNotice={handleDismissKickedNotice}
            onJoinWithCode={handleJoinWithCode}
            onLeaveClassroom={handleLeaveClassroom}
            onRefreshStudentStatus={refreshStudentStatus}
            onSelectSeat={handleSelectSeat}
            onSelectTeacher={handleSelectTeacher}
            onStartSubmit={submit.handleStartSubmit}
        />
    );
};

export default ClassroomModal;
