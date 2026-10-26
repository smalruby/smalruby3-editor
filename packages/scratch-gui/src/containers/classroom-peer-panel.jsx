import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { defineMessages, useIntl } from 'react-intl';
import { useDispatch, useSelector } from 'react-redux';
import ClassroomPeerPanelComponent from '../components/classroom-peer-panel/classroom-peer-panel.jsx';
import classroomAPI from '../lib/classroom-api.js';
import { buildPeerSeats, isPeerListStale, peerViewErrorState, peerViewerImages } from '../lib/classroom-peer-view.js';
import { clampPanelPosition } from '../lib/classroom-teacher-panel.js';
import { closeStudentPeerPanel, setStudentPeerView } from '../reducers/classroom.js';

const messages = defineMessages({
    stage: {
        defaultMessage: 'Stage',
        description: 'Peer view image viewer: name of the stage thumbnail (#1210)',
        id: 'gui.classroomPeerPanel.stageImage',
    },
    sprite: {
        defaultMessage: 'Sprite {number}',
        description: 'Peer view image viewer: name of a sprite image without a saved name (#1210)',
        id: 'gui.classroomPeerPanel.spriteImage',
    },
});

// Below the menu bar (3rem) with a small gap.
const MENU_BAR_OFFSET = 56;
const EDGE_GAP = 8;
const FALLBACK_SIZE = { width: 280, height: 360 };
// Default viewer width (26rem in classroom-peer-panel.css).
const VIEWER_WIDTH = 416;

const viewportSize = () => ({ width: window.innerWidth, height: window.innerHeight });

const keepOnScreen = (position, size) => {
    const viewport = viewportSize();
    const clamped = clampPanelPosition(position, size, viewport);
    return { x: clamped.x, y: Math.max(Math.min(MENU_BAR_OFFSET, viewport.height - size.height), clamped.y) };
};

// The panel starts at the right edge and the viewer just to its left, so the
// block palette and the left part of the script area stay usable.
const defaultPanelPosition = () => ({
    x: viewportSize().width - FALLBACK_SIZE.width - EDGE_GAP,
    y: MENU_BAR_OFFSET,
});
const defaultViewerPosition = () => ({
    x: Math.max(EDGE_GAP, viewportSize().width - FALLBACK_SIZE.width - EDGE_GAP * 2 - VIEWER_WIDTH),
    y: MENU_BAR_OFFSET,
});

/**
 * Student's floating "みんなの作品を見る" panel (#1210), opened from the class
 * screen. Mounted once for the whole GUI; renders nothing while closed.
 * The list is read when the panel opens and on the refresh button only (no
 * polling: up to 40 students may open it). Before a seat opens, a list old
 * enough for its image URLs to expire is read again.
 * @returns {React.ReactElement|null} the panel
 */
const ClassroomPeerPanel = () => {
    const intl = useIntl();
    const dispatch = useDispatch();
    const open = useSelector((state) => !!state.scratchGui.classroom?.studentPeerPanelOpen);
    const sessionToken = useSelector((state) => state.scratchGui.classroom?.sessionToken || null);
    const classroomId = useSelector((state) => state.scratchGui.classroom?.classroomId || null);
    const ownSeatNumber = useSelector((state) => state.scratchGui.classroom?.seatNumber || null);
    const shown = open && !!sessionToken && !!classroomId;

    const [submissions, setSubmissions] = useState([]);
    const [fetchedAt, setFetchedAt] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [minimized, setMinimized] = useState(false);
    const [selectedSeat, setSelectedSeat] = useState(null);
    const [position, setPosition] = useState(defaultPanelPosition);
    const [viewerPosition, setViewerPosition] = useState(defaultViewerPosition);
    const panelRef = useRef(null);
    const viewerRef = useRef(null);

    const load = useCallback(async () => {
        if (!sessionToken || !classroomId) return null;
        setLoading(true);
        try {
            const data = await classroomAPI.listPeerSubmissions(sessionToken, classroomId);
            const list = (data && data.submissions) || [];
            setSubmissions(list);
            setFetchedAt(Date.now());
            setError(null);
            if (data && data.peerView) dispatch(setStudentPeerView(data.peerView));
            return list;
        } catch (err) {
            const state = peerViewErrorState(err);
            setError(state);
            setSubmissions([]);
            setSelectedSeat(null);
            // Remember the setting the server told us, so the entry hides / locks.
            if (state === 'off') dispatch(setStudentPeerView('none'));
            if (state === 'notSubmitted') dispatch(setStudentPeerView('afterSubmit'));
            return null;
        } finally {
            setLoading(false);
        }
    }, [sessionToken, classroomId, dispatch]);

    useEffect(() => {
        if (!shown) {
            setSelectedSeat(null);
            return;
        }
        load();
    }, [shown, load]);

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
    }, [shown, minimized, submissions, error]);

    // The viewer's default position is computed when the GUI mounts, so a
    // window narrowed since then (or a viewer resized by the student) could
    // leave it off screen; keep it inside the window like the panel.
    const viewerShown = shown && !!selectedSeat;
    useLayoutEffect(() => {
        if (!viewerShown) return () => {};
        const fit = () => {
            const el = viewerRef.current;
            if (!el) return;
            const size = { width: el.offsetWidth, height: el.offsetHeight };
            setViewerPosition((p) => {
                const next = keepOnScreen(p, size);
                return next.x === p.x && next.y === p.y ? p : next;
            });
        };
        fit();
        window.addEventListener('resize', fit);
        return () => window.removeEventListener('resize', fit);
    }, [viewerShown, selectedSeat, submissions]);

    const handleOpenSeat = useCallback(
        async (seatNumber) => {
            setSelectedSeat(seatNumber);
            if (isPeerListStale(fetchedAt, Date.now())) await load();
        },
        [fetchedAt, load],
    );
    const handleRefresh = useCallback(() => load(), [load]);
    const handleClose = useCallback(() => dispatch(closeStudentPeerPanel()), [dispatch]);
    const handleCloseViewer = useCallback(() => setSelectedSeat(null), []);
    const handleToggleMinimize = useCallback(() => setMinimized((m) => !m), []);
    const handleDrag = useCallback((e, data) => setPosition({ x: data.x, y: data.y }), []);
    const handleViewerDrag = useCallback((e, data) => setViewerPosition({ x: data.x, y: data.y }), []);

    const seats = useMemo(() => buildPeerSeats({ submissions, ownSeatNumber }), [submissions, ownSeatNumber]);
    const images = useMemo(() => {
        const submission = submissions.find((s) => s.seatNumber === selectedSeat) || null;
        return peerViewerImages(submission, {
            stage: intl.formatMessage(messages.stage),
            sprite: (number) => intl.formatMessage(messages.sprite, { number }),
        });
    }, [submissions, selectedSeat, intl]);

    if (!shown) return null;

    return (
        <ClassroomPeerPanelComponent
            error={error}
            images={images}
            loading={loading}
            minimized={minimized}
            panelRef={panelRef}
            position={position}
            seats={seats}
            selectedSeat={selectedSeat}
            viewerPosition={viewerPosition}
            viewerRef={viewerRef}
            onClose={handleClose}
            onCloseViewer={handleCloseViewer}
            onDrag={handleDrag}
            onDragStop={handleDrag}
            onOpenSeat={handleOpenSeat}
            onRefresh={handleRefresh}
            onToggleMinimize={handleToggleMinimize}
            onViewerDrag={handleViewerDrag}
        />
    );
};

export default ClassroomPeerPanel;
