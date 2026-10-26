import React, { useCallback, useRef, useState, useEffect } from 'react';
import { useIntl } from 'react-intl';
import { useDispatch, useSelector } from 'react-redux';
import ClassroomModalComponent from '../components/classroom-modal/classroom-modal.jsx';
import analytics from '../lib/analytics';
import classroomAPI from '../lib/classroom-api.js';
import {
    loadPendingKickRequest,
    savePendingKickRequest,
    clearPendingKickRequest,
} from '../lib/classroom-kick-request-storage.js';
import { evaluateKickRequestPoll } from '../lib/classroom-seat-selection.js';
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
import { decideClasscodeAction, resolveAutoJoinCode } from './classroom-classcode-utils.js';
import translateError, { extractKickReason } from './classroom-error-utils.js';
import useKickRequestPolling from './use-kick-request-polling.js';
import useStudentAssignment from './use-student-assignment.js';
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

    const handleClose = useCallback(() => {
        dispatch(closeClassroomModal());
    }, [dispatch]);

    // Student assignment hook (assignment pages + starter auto-load)
    const studentAssignment = useStudentAssignment({
        classroomState,
        vm,
        intl,
        clearError,
        showError,
        setIsLoading,
        setPhase,
        // a chosen project starts the work right away (#1201)
        onStarted: handleClose,
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

    // --- Kick-request state ---
    // The student can tap an occupied seat to ask the teacher to free it.
    // `kickRequestDialogSeat` is the seat number while the confirm dialog is
    // open (replaces the grid). `kickRequestPending` is the saved request
    // after submission (persisted to localStorage so it survives reload).
    // Once submitted, polling watches the seat grid and clears the pending
    // state when the teacher acts (approve or reject + TTL).
    const [kickRequestDialogSeat, setKickRequestDialogSeat] = useState(null);
    const [kickRequestPending, setKickRequestPending] = useState(() => loadPendingKickRequest());
    const [kickRequestError, setKickRequestError] = useState(null);
    // Set when polling detects that a previously-pending request has
    // disappeared from the server's activeKickRequestIds *and* the target
    // seat is still occupied — meaning the teacher rejected the request (or
    // the TTL of 1h ran out). The seat-selector shows a dismissible "依頼は
    // 受理されませんでした" banner so the student doesn't watch the
    // pending banner forever.
    const [kickRequestRejectedNotice, setKickRequestRejectedNotice] = useState(null);
    const handleDismissKickRequestRejectedNotice = useCallback(() => setKickRequestRejectedNotice(null), []);
    // Seat freed by the teacher's approval: join it without making the
    // student pick it again (#1198). Consumed by an effect below.
    const [autoJoinSeat, setAutoJoinSeat] = useState(null);

    // Apply the teacher's answer to a pending kick request (from polling or
    // from the lookup done when the modal is reopened).
    const applyKickRequestOutcome = useCallback((outcome, data, pending) => {
        if (data) setTakenSeats(data.takenSeats || []);
        if (!outcome || outcome === 'waiting') return;
        clearPendingKickRequest();
        setKickRequestPending(null);
        if (outcome === 'approved') {
            setKickRequestRejectedNotice(null);
            setSelectedSeat(pending.seatNumber);
            setAutoJoinSeat(pending.seatNumber);
        } else if (outcome === 'rejected') {
            // The teacher rejected, or the 1h TTL ran out. Either way the
            // student should pick another seat (or send a new request)
            // rather than stare at the pending banner.
            setKickRequestRejectedNotice({ seatNumber: pending.seatNumber });
        }
    }, []);

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
                // Reopened while a request for this class is pending: the
                // answer may already be in this lookup.
                const pending = loadPendingKickRequest();
                if (pending && pending.joinCode === joinCode) {
                    applyKickRequestOutcome(evaluateKickRequestPoll(pending, data), data, pending);
                }
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
        [clearError, showError, intl, applyKickRequestOutcome],
    );

    const handleSelectSeat = useCallback((seatNumber) => {
        setSelectedSeat(seatNumber);
    }, []);

    // --- Kick-request handlers ---

    const handleRequestKick = useCallback(
        (seatNumber) => {
            if (!pendingJoinCode) return;
            if (kickRequestPending) return; // one outstanding request at a time
            setKickRequestError(null);
            setKickRequestRejectedNotice(null);
            setKickRequestDialogSeat(seatNumber);
        },
        [pendingJoinCode, kickRequestPending],
    );

    const handleCancelKickRequest = useCallback(() => {
        setKickRequestDialogSeat(null);
        setKickRequestError(null);
    }, []);

    const handleConfirmKickRequest = useCallback(
        async (reason) => {
            if (!pendingJoinCode || !kickRequestDialogSeat) return;
            setKickRequestError(null);
            setIsLoading(true);
            try {
                const result = await classroomAPI.createKickRequest(pendingJoinCode, kickRequestDialogSeat, reason);
                const record = {
                    requestId: result.requestId,
                    joinCode: pendingJoinCode,
                    seatNumber: kickRequestDialogSeat,
                    reason: reason || null,
                    createdAt: new Date().toISOString(),
                };
                savePendingKickRequest(record);
                setKickRequestPending(record);
                setKickRequestDialogSeat(null);
            } catch (err) {
                setKickRequestError(translateError(intl, err));
            } finally {
                setIsLoading(false);
            }
        },
        [pendingJoinCode, kickRequestDialogSeat, intl],
    );

    // Polling: while in student-seat with a pending kick request for this
    // class, watch for the teacher's answer (only while the tab is visible).
    const handlePollResult = useCallback(
        (outcome, data) => applyKickRequestOutcome(outcome, data, kickRequestPending),
        [applyKickRequestOutcome, kickRequestPending],
    );
    useKickRequestPolling({
        pending: kickRequestPending,
        enabled: phase === 'student-seat' && !!kickRequestPending && kickRequestPending.joinCode === pendingJoinCode,
        hasSession: !!classroomState.sessionToken,
        onResult: handlePollResult,
    });

    // --- Confirm join ---

    const joinSeat = useCallback(
        async (seatNumber) => {
            if (!pendingJoinCode || !seatNumber) return;
            clearError();
            setIsLoading(true);
            try {
                const data = await classroomAPI.joinClassroom(pendingJoinCode, seatNumber);
                dispatch(
                    setClassroomSession({
                        role: 'student',
                        classroomId: data.classroomId,
                        className: data.className,
                        classYear: typeof data.classYear === 'number' ? data.classYear : null,
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
                    classYear: typeof data.classYear === 'number' ? data.classYear : null,
                    assignmentName: data.assignmentName || null,
                    seatNumber: data.seatNumber,
                    previousComment: data.previousComment || null,
                });
                setKickedNotice(null);
                clearPendingKickRequest();
                setKickRequestPending(null);
                setKickRequestRejectedNotice(null);
                // Assignment delivery: fetch the assignment and the submissions
                // to continue from (#1201). The starter auto-loads only when
                // there is nothing to continue from (never clobbering an edited
                // project silently); we jump straight to the assignment pages
                // when there are any.
                const nextPhase = await studentAssignment.handleJoined(
                    data.sessionToken,
                    data.classroomId,
                    !!data.hasAssignment,
                );
                setPhase(nextPhase || 'student-joined');
            } catch (err) {
                if (err.status === 409) {
                    setTakenSeats((prev) => [...prev, seatNumber]);
                    setSelectedSeat(null);
                }
                showError(translateError(intl, err, 'seat'));
            } finally {
                setIsLoading(false);
            }
        },
        [dispatch, pendingJoinCode, pendingClassroomInfo, clearError, showError, intl, studentAssignment],
    );

    const handleConfirmJoin = useCallback(() => joinSeat(selectedSeat), [joinSeat, selectedSeat]);

    useEffect(() => {
        if (!autoJoinSeat) return;
        setAutoJoinSeat(null);
        joinSeat(autoJoinSeat);
    }, [autoJoinSeat, joinSeat]);

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
            studentAssignment.setHasAssignment(!!result.hasAssignment);
            studentAssignment.refreshContinueOptions();
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
    }, [classroomState.sessionToken, dispatch, showSessionExpiredError, intl, handleJoinWithCode, studentAssignment]);

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

    // --- Auto-join: classcode URL parameter / teacher's selected assignment ---
    useEffect(() => {
        const classcodeParams = getUrlParams();
        const autoJoin = resolveAutoJoinCode({
            urlClasscode: classcodeParams.classcode,
            teacherJoinCode: classroomState.teacherSelection && classroomState.teacherSelection.joinCode,
            session: classroomState,
        });
        if (!autoJoin) {
            // A kick request is still pending (the student closed the modal
            // while waiting): go straight back to that class's seat screen.
            const pending = loadPendingKickRequest();
            if (pending && !classroomState.sessionToken) {
                handleJoinWithCode(pending.joinCode);
            }
            return;
        }

        const code = autoJoin.code;
        if (autoJoin.source === 'teacher') {
            // The teacher selected this assignment in class management: open
            // on its seat selection (#1199). Leaving another class already
            // happened when the teacher selected it.
            handleJoinWithCode(code);
            return;
        }

        const url = new URL(window.location.href);
        url.searchParams.delete('classcode');
        window.history.replaceState({}, '', url.toString());
        clearClasscode();

        const action = decideClasscodeAction(classroomState, code);
        if (action.type === 'same_class') {
            setPhase('student-status');
            return;
        }
        if (action.type === 'switch_class') {
            // Best-effort release of the old seat before switching. We do not
            // await this so the new lookup UI is not blocked by a slow API
            // call (or by a 401 in case the old session already expired on
            // the server). Without this call, opening a new classcode URL
            // while still holding an old session would leave the previous
            // seat occupied until TTL.
            classroomAPI.leaveClassroom(action.leaveSessionToken, action.leaveClassroomId).catch(() => {
                // Ignore — we have no UI to surface this to and the new
                // join takes precedence either way.
            });
            dispatch(clearClassroomSession());
        }
        // 'fresh_join' and 'switch_class' both fall through to a join lookup.
        handleJoinWithCode(code);
    }, []); // Run once on mount

    return (
        <ClassroomModalComponent
            assignment={studentAssignment.assignment}
            assignmentPageIndex={studentAssignment.assignmentPageIndex}
            classroomState={classroomState}
            continueOptions={studentAssignment.continueOptions}
            error={error}
            hasAssignment={studentAssignment.hasAssignment}
            loadedChoice={studentAssignment.loadedChoice}
            startNotice={studentAssignment.startNotice}
            onLoadSubmission={studentAssignment.handleLoadSubmission}
            onAssignmentNextPage={studentAssignment.handleAssignmentNextPage}
            onAssignmentPrevPage={studentAssignment.handleAssignmentPrevPage}
            onOpenAssignment={studentAssignment.handleOpenAssignment}
            onReloadStarter={studentAssignment.handleReloadStarter}
            onChooseStarter={studentAssignment.handleChooseStarter}
            errorActionHandler={errorActionHandler}
            errorActionLabel={errorActionLabel}
            errorTitle={errorTitle}
            isLoading={isLoading}
            joinCodeHistory={joinCodeHistory}
            joinedInfo={joinedInfo}
            kickedNotice={kickedNotice}
            kickRequestDialogSeat={kickRequestDialogSeat}
            kickRequestError={kickRequestError}
            kickRequestPending={kickRequestPending}
            kickRequestRejectedNotice={kickRequestRejectedNotice}
            phase={phase}
            seatCount={seatCount}
            selectedSeat={selectedSeat}
            submitProgress={submit.submitProgress}
            takenSeats={takenSeats}
            teacherComment={studentTeacherComment}
            thumbnailDataUrl={submit.thumbnailDataUrl}
            onCancelKickRequest={handleCancelKickRequest}
            onCancelSubmit={submit.handleCancelSubmit}
            onClose={handleClose}
            onConfirmJoin={handleConfirmJoin}
            onConfirmKickRequest={handleConfirmKickRequest}
            onConfirmSubmit={submit.handleConfirmSubmit}
            onDismissKickRequestRejectedNotice={handleDismissKickRequestRejectedNotice}
            onDismissKickedNotice={handleDismissKickedNotice}
            onJoinWithCode={handleJoinWithCode}
            onLeaveClassroom={handleLeaveClassroom}
            onRefreshStudentStatus={refreshStudentStatus}
            onRequestKick={handleRequestKick}
            onSelectSeat={handleSelectSeat}
            onSelectTeacher={handleSelectTeacher}
            onStartSubmit={submit.handleStartSubmit}
        />
    );
};

export default ClassroomModal;
