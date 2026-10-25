import React, { useCallback, useEffect, useRef, useState } from 'react';
import { defineMessages, useIntl } from 'react-intl';
import { useDispatch, useSelector } from 'react-redux';
import ClassroomTeacherKickToast from '../components/classroom-teacher-kick-toast/classroom-teacher-kick-toast.jsx';
import classroomAPI from '../lib/classroom-api.js';
import { TEACHER_KICK_TOAST_DURATION_MS, newKickRequestIds } from '../lib/classroom-teacher-kick-alerts.js';
import {
    closeTeacherKickList,
    openTeacherKickList,
    removeTeacherKickRequest,
    requestTeacherNavigation,
    setTeacherKickRequests,
    setTeacherLastSelection,
} from '../reducers/classroom.js';
import { getCachedTeacherIdToken } from './use-teacher-auth.js';
import useTeacherKickRequestPolling from './use-teacher-kick-request-polling.js';

const messages = defineMessages({
    actionFailed: {
        defaultMessage: 'Could not process the request. Please try again.',
        description: 'Teacher kick-request toast: approve / reject failed (#1200)',
        id: 'gui.classroomTeacherKick.actionFailed',
    },
});

/**
 * Tells a logged-in teacher about kick requests (退室依頼) even while the class
 * management modal is closed (#1200). Mounted once for the whole GUI: polls
 * the pending requests, keeps them in Redux for the teacher menu badge, and
 * shows a bottom toast for 30 seconds whenever a new request arrives.
 * "Later" hides the toast; the menu keeps the count and reopens the list.
 * @returns {React.ReactElement|null} the toast, or null when hidden
 */
const ClassroomTeacherKickAlerts = () => {
    const intl = useIntl();
    const dispatch = useDispatch();
    // Always mounted, so it must survive embeds that omit the classroom reducer.
    const loggedIn = useSelector((state) => !!state.scratchGui.classroom?.teacherLoggedIn);
    const requests = useSelector((state) => state.scratchGui.classroom?.teacherKickRequests || []);
    const listOpen = useSelector((state) => !!state.scratchGui.classroom?.teacherKickListOpen);
    const [toastOpen, setToastOpen] = useState(false);
    const [busyIds, setBusyIds] = useState([]);
    const [error, setError] = useState(null);
    const seenIdsRef = useRef(new Set());
    const toastTimerRef = useRef(null);

    const hideToast = useCallback(() => {
        clearTimeout(toastTimerRef.current);
        setToastOpen(false);
    }, []);

    useEffect(() => () => clearTimeout(toastTimerRef.current), []);

    useEffect(() => {
        if (loggedIn) return;
        // Another teacher logging in on this browser must be told about their
        // own requests from scratch.
        seenIdsRef.current = new Set();
        hideToast();
    }, [loggedIn, hideToast]);

    const handleRequests = useCallback(
        (data) => {
            const next = data.requests || [];
            dispatch(setTeacherKickRequests(next));
            const fresh = newKickRequestIds(seenIdsRef.current, next);
            next.forEach((r) => seenIdsRef.current.add(r.requestId));
            if (fresh.length === 0) return;
            setError(null);
            setToastOpen(true);
            clearTimeout(toastTimerRef.current);
            toastTimerRef.current = setTimeout(() => setToastOpen(false), TEACHER_KICK_TOAST_DURATION_MS);
        },
        [dispatch],
    );

    useTeacherKickRequestPolling({ loggedIn, onRequests: handleRequests });

    const runAction = useCallback(
        async (request, call) => {
            const token = getCachedTeacherIdToken();
            if (!token) return;
            setBusyIds((ids) => [...ids, request.requestId]);
            setError(null);
            try {
                await call(token, request.classroomId, request.requestId);
                dispatch(removeTeacherKickRequest(request.requestId));
            } catch {
                setError(intl.formatMessage(messages.actionFailed));
            } finally {
                setBusyIds((ids) => ids.filter((id) => id !== request.requestId));
            }
        },
        [dispatch, intl],
    );

    const handleApprove = useCallback(
        (request) => runAction(request, (...args) => classroomAPI.approveKickRequest(...args)),
        [runAction],
    );
    const handleReject = useCallback(
        (request) => runAction(request, (...args) => classroomAPI.rejectKickRequest(...args)),
        [runAction],
    );

    const handleLater = useCallback(() => {
        hideToast();
        dispatch(closeTeacherKickList());
    }, [dispatch, hideToast]);

    const handleShowAll = useCallback(() => {
        clearTimeout(toastTimerRef.current);
        dispatch(openTeacherKickList());
    }, [dispatch]);

    // Reuse the teacher menu's "いまの課題を開く" jump (#1199) for the request's assignment.
    const handleOpenAssignment = useCallback(
        (request) => {
            handleLater();
            dispatch(setTeacherLastSelection({ classroomId: request.classroomId, groupId: request.groupId || null }));
            dispatch(requestTeacherNavigation('current-assignment'));
        },
        [dispatch, handleLater],
    );

    useEffect(() => {
        if (listOpen && requests.length === 0) dispatch(closeTeacherKickList());
    }, [dispatch, listOpen, requests.length]);

    if (!loggedIn || requests.length === 0 || !(toastOpen || listOpen)) return null;

    return (
        <ClassroomTeacherKickToast
            busyIds={busyIds}
            error={error}
            expanded={listOpen}
            requests={requests}
            onApprove={handleApprove}
            onLater={handleLater}
            onOpenAssignment={handleOpenAssignment}
            onReject={handleReject}
            onShowAll={handleShowAll}
        />
    );
};

export default ClassroomTeacherKickAlerts;
