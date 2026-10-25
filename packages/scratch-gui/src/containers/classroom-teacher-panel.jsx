import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { defineMessages, useIntl } from 'react-intl';
import { useDispatch, useSelector } from 'react-redux';
import ClassroomTeacherPanelComponent from '../components/classroom-teacher-panel/classroom-teacher-panel.jsx';
import classroomAPI from '../lib/classroom-api.js';
import {
    buildPanelSeats,
    clampPanelPosition,
    kickRequestsForClassroom,
    loadPanelPosition,
    recentAssignments,
    savePanelPosition,
    summarizePanelStatus,
} from '../lib/classroom-teacher-panel.js';
import { saveTeacherLastSelection } from '../lib/classroom-teacher-session.js';
import {
    closeTeacherPanel,
    removeTeacherKickRequest,
    requestTeacherNavigation,
    setTeacherLastSelection,
} from '../reducers/classroom.js';
import { getCachedTeacherIdToken } from './use-teacher-auth.js';
import useTeacherPanelPolling from './use-teacher-panel-polling.js';

const messages = defineMessages({
    loadFailed: {
        defaultMessage: 'Could not load the status. It will be retried.',
        description: 'Teacher status panel: a poll failed (#1203)',
        id: 'gui.classroomTeacherPanel.loadFailed',
    },
    actionFailed: {
        defaultMessage: 'Could not process the request. Please try again.',
        description: 'Teacher kick-request toast: approve / reject failed (#1200)',
        id: 'gui.classroomTeacherKick.actionFailed',
    },
});

// Below the menu bar (3rem) with a small gap.
const MENU_BAR_OFFSET = 56;
const EDGE_GAP = 8;
// Used before the panel is measured.
const FALLBACK_SIZE = { width: 280, height: 420 };

const viewportSize = () => ({ width: window.innerWidth, height: window.innerHeight });

/**
 * Default place: the right edge, low enough to leave the stage header and
 * the green flag visible (the panel stays draggable / minimizable).
 * @param {{width: number, height: number}} size - panel size
 * @returns {{x: number, y: number}} top-left
 */
const defaultPosition = (size) => {
    const viewport = viewportSize();
    return {
        x: viewport.width - size.width - EDGE_GAP,
        y: Math.max(MENU_BAR_OFFSET, viewport.height - size.height - EDGE_GAP),
    };
};

const keepOnScreen = (position, size) => {
    const viewport = viewportSize();
    const clamped = clampPanelPosition(position, size, viewport);
    return { x: clamped.x, y: Math.max(Math.min(MENU_BAR_OFFSET, viewport.height - size.height), clamped.y) };
};

/**
 * Teacher's floating "いまの課題の状況" panel (#1203), opened from the teacher
 * menu. Mounted once for the whole GUI; renders nothing while closed or
 * logged out. Members / submissions are polled only while it is open
 * (use-teacher-panel-polling.js); kick requests come from the #1200 poller.
 * @returns {React.ReactElement|null} the panel
 */
const ClassroomTeacherPanel = () => {
    const intl = useIntl();
    const dispatch = useDispatch();
    // Always mounted, so it must survive embeds that omit the classroom reducer.
    const loggedIn = useSelector((state) => !!state.scratchGui.classroom?.teacherLoggedIn);
    const open = useSelector((state) => !!state.scratchGui.classroom?.teacherPanelOpen);
    const lastSelection = useSelector((state) => state.scratchGui.classroom?.teacherLastSelection || null);
    const allKickRequests = useSelector((state) => state.scratchGui.classroom?.teacherKickRequests || []);
    const shown = loggedIn && open;

    const [minimized, setMinimized] = useState(false);
    const [classrooms, setClassrooms] = useState([]);
    const [membersById, setMembersById] = useState({});
    const [loading, setLoading] = useState(false);
    const [busyIds, setBusyIds] = useState([]);
    const [error, setError] = useState(null);
    const [position, setPosition] = useState(() => loadPanelPosition() || defaultPosition(FALLBACK_SIZE));
    const panelRef = useRef(null);

    const classroomId = (lastSelection && lastSelection.classroomId) || null;

    // The assignment list (switcher + seat count) is read when the panel opens
    // and again on the manual refresh, so a failed read or a new assignment
    // does not need closing and reopening the panel.
    const loadClassrooms = useCallback(async () => {
        const token = getCachedTeacherIdToken();
        if (!token) return;
        try {
            const data = await classroomAPI.listClassrooms(token);
            setClassrooms(data.classrooms || []);
        } catch {
            setError(intl.formatMessage(messages.loadFailed));
        }
    }, [intl]);
    useEffect(() => {
        if (shown) loadClassrooms();
    }, [shown, loadClassrooms]);

    const handleMembers = useCallback((id, members) => {
        setError(null);
        setMembersById((prev) => ({ ...prev, [id]: members }));
    }, []);
    const handlePollError = useCallback(() => setError(intl.formatMessage(messages.loadFailed)), [intl]);

    const { refresh } = useTeacherPanelPolling({
        open: shown,
        loggedIn,
        classroomId,
        onMembers: handleMembers,
        onError: handlePollError,
    });

    // Keep the panel on screen once its real size is known and on resize.
    useLayoutEffect(() => {
        if (!shown || !panelRef.current) return () => {};
        const fit = () => {
            const el = panelRef.current;
            if (!el) return;
            const size = { width: el.offsetWidth, height: el.offsetHeight };
            setPosition((p) => {
                const next = keepOnScreen(p, size);
                return next.x === p.x && next.y === p.y ? p : next;
            });
        };
        fit();
        window.addEventListener('resize', fit);
        return () => window.removeEventListener('resize', fit);
    }, [shown, minimized, classroomId, membersById]);

    const handleDrag = useCallback((e, data) => setPosition({ x: data.x, y: data.y }), []);
    const handleDragStop = useCallback((e, data) => {
        setPosition({ x: data.x, y: data.y });
        savePanelPosition({ x: data.x, y: data.y });
    }, []);
    const handleToggleMinimize = useCallback(() => setMinimized((m) => !m), []);
    const handleClose = useCallback(() => dispatch(closeTeacherPanel()), [dispatch]);

    const handleRefresh = useCallback(async () => {
        setLoading(true);
        await Promise.all([refresh(), loadClassrooms()]);
        setLoading(false);
    }, [refresh, loadClassrooms]);

    const handleSelectAssignment = useCallback(
        (id) => {
            const c = classrooms.find((x) => x.classroomId === id);
            const selection = { classroomId: id, groupId: (c && c.groupId) || null };
            dispatch(setTeacherLastSelection(selection));
            saveTeacherLastSelection(selection);
        },
        [dispatch, classrooms],
    );

    // A seat opens that member's detail in the full-screen class management.
    const handleOpenSeat = useCallback(
        (memberId) => {
            setMinimized(true);
            dispatch(requestTeacherNavigation('current-assignment', memberId));
        },
        [dispatch],
    );

    const runKickAction = useCallback(
        async (request, call, { freesSeat = false } = {}) => {
            const token = getCachedTeacherIdToken();
            if (!token) return;
            setBusyIds((ids) => [...ids, request.requestId]);
            setError(null);
            try {
                await call(token, request.classroomId, request.requestId);
                dispatch(
                    removeTeacherKickRequest(
                        request.requestId,
                        freesSeat ? { classroomId: request.classroomId, seatNumber: request.seatNumber } : null,
                    ),
                );
                // The freed seat should show as empty right away.
                if (freesSeat) refresh();
            } catch {
                setError(intl.formatMessage(messages.actionFailed));
            } finally {
                setBusyIds((ids) => ids.filter((id) => id !== request.requestId));
            }
        },
        [dispatch, intl, refresh],
    );
    const handleApprove = useCallback(
        (request) =>
            runKickAction(request, (...args) => classroomAPI.approveKickRequest(...args), { freesSeat: true }),
        [runKickAction],
    );
    const handleReject = useCallback(
        (request) => runKickAction(request, (...args) => classroomAPI.rejectKickRequest(...args)),
        [runKickAction],
    );

    const assignments = useMemo(() => {
        const recent = recentAssignments(classrooms);
        // The shown assignment stays in the list even when it is not recent.
        const current = classrooms.find((c) => c.classroomId === classroomId);
        return current && !recent.includes(current) ? [current, ...recent] : recent;
    }, [classrooms, classroomId]);
    const classroom = classrooms.find((c) => c.classroomId === classroomId) || null;
    const members = membersById[classroomId];
    const kickRequests = kickRequestsForClassroom(allKickRequests, classroomId);
    const now = Date.now();
    const studentCount = (classroom && classroom.studentCount) || 0;
    const summary = classroom && members ? summarizePanelStatus({ members, studentCount, now }) : null;
    const seats = classroom ? buildPanelSeats({ members: members || [], studentCount, kickRequests, now }) : [];

    if (!shown) return null;

    return (
        <ClassroomTeacherPanelComponent
            assignments={assignments}
            busyIds={busyIds}
            classroom={classroom}
            error={error}
            kickRequests={kickRequests}
            loading={loading}
            minimized={minimized}
            panelRef={panelRef}
            position={position}
            seats={seats}
            summary={summary}
            onApprove={handleApprove}
            onClose={handleClose}
            onDrag={handleDrag}
            onDragStop={handleDragStop}
            onOpenSeat={handleOpenSeat}
            onRefresh={handleRefresh}
            onReject={handleReject}
            onSelectAssignment={handleSelectAssignment}
            onToggleMinimize={handleToggleMinimize}
        />
    );
};

export default ClassroomTeacherPanel;
