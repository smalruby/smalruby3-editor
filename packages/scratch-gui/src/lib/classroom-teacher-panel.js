/**
 * Pure helpers for the teacher's floating status panel (#1203): the seat /
 * submission status of one assignment, shown while the teacher keeps using
 * Smalruby (the class management modal is full screen).
 *
 * The panel polls members / submissions only while it is open and the tab is
 * visible, like the members tab of class management (cost policy). Kick
 * requests are NOT fetched here: they come from the GUI-wide teacher poller
 * (#1200) through Redux, so there is no second poll for them.
 */
import { getPresenceStatus, getSubmissionStatus } from '../components/classroom-modal/classroom-status-icon.jsx';
import { isMemberSeated } from './classroom-presence.js';

// Same interval as the members tab of class management (CLASSROOM_REFRESH_INTERVAL_MS).
const TEACHER_PANEL_POLL_INTERVAL_MS = 30 * 1000;

// How many assignments the "switch assignment" list offers.
const TEACHER_PANEL_RECENT_LIMIT = 8;

const POSITION_STORAGE_KEY = 'smalruby:classroomTeacherPanelPosition';

/**
 * @param {object} params - inputs
 * @param {boolean} params.open - the panel is shown (minimized counts as shown)
 * @param {boolean} params.loggedIn - a teacher is logged in
 * @param {boolean} params.visible - the tab is visible
 * @param {?string} params.classroomId - the assignment shown in the panel
 * @returns {boolean} whether the panel should poll
 */
const shouldPollTeacherPanel = ({ open, loggedIn, visible, classroomId }) =>
    !!open && !!loggedIn && !!visible && !!classroomId;

/**
 * Counts shown at the top of the panel. "Seated" is the rough hint of
 * isMemberSeated (opened the class screen within the last hour, #1197).
 * @param {object} params - inputs
 * @param {Array<object>} params.members - enriched members (enrichMembers)
 * @param {number} params.studentCount - seats of the assignment
 * @param {number} params.now - current time in ms epoch
 * @returns {{seated: number, capacity: number, joined: number, submitted: number}} counts
 */
const summarizePanelStatus = ({ members, studentCount, now }) => {
    const joinedMembers = (members || []).filter((m) => !m.left);
    return {
        seated: joinedMembers.filter((m) => isMemberSeated(m, now)).length,
        capacity: studentCount || 0,
        joined: joinedMembers.length,
        submitted: joinedMembers.filter((m) => m.hasSubmission).length,
    };
};

const seatMemberId = (seatNumber) => `seat-${String(seatNumber).padStart(2, '0')}`;

/**
 * One cell per seat for the mini grid, with the #1196 status kinds.
 * @param {object} params - inputs
 * @param {Array<object>} params.members - enriched members
 * @param {number} params.studentCount - seats of the assignment
 * @param {Array<{seatNumber: number}>} params.kickRequests - pending requests of this assignment
 * @param {number} params.now - current time in ms epoch
 * @returns {Array<object>} cells in seat order
 */
const buildPanelSeats = ({ members, studentCount, kickRequests, now }) => {
    const byId = {};
    for (const m of members || []) byId[m.memberId] = m;
    const kickSeats = new Set((kickRequests || []).map((r) => r.seatNumber));
    return Array.from({ length: studentCount || 0 }, (_, i) => {
        const seatNumber = i + 1;
        const memberId = seatMemberId(seatNumber);
        const member = byId[memberId] || null;
        const joined = member && !member.left;
        return {
            seatNumber,
            memberId,
            nickname: (joined && member.nickname) || null,
            presence: getPresenceStatus(member, !!joined && isMemberSeated(member, now)),
            submission: joined ? getSubmissionStatus(member) : null,
            kickRequested: kickSeats.has(seatNumber),
        };
    });
};

/**
 * @param {?Array<object>} requests - all pending kick requests (Redux, #1200)
 * @param {?string} classroomId - assignment shown in the panel
 * @returns {Array<object>} the requests of that assignment
 */
const kickRequestsForClassroom = (requests, classroomId) =>
    (requests || []).filter((r) => r.classroomId === classroomId);

const recency = (c) =>
    [c.updatedAt, c.sortDate, c.createdAt].filter((v) => typeof v === 'string').reduce((a, b) => (a > b ? a : b), '');

/**
 * Active assignments for the switcher, most recently touched first.
 * @param {Array<object>} classrooms - listClassrooms result
 * @returns {Array<object>} at most TEACHER_PANEL_RECENT_LIMIT assignments
 */
const recentAssignments = (classrooms) =>
    (classrooms || [])
        .filter((c) => c.status !== 'archived')
        .slice()
        .sort((a, b) => {
            const ra = recency(a);
            const rb = recency(b);
            if (ra === rb) return 0;
            return ra > rb ? -1 : 1;
        })
        .slice(0, TEACHER_PANEL_RECENT_LIMIT);

/**
 * @param {?string} raw - JSON from localStorage
 * @returns {{x: number, y: number}|null} stored position
 */
const parsePanelPosition = (raw) => {
    if (!raw) return null;
    try {
        const data = JSON.parse(raw);
        if (data && Number.isFinite(data.x) && Number.isFinite(data.y)) return { x: data.x, y: data.y };
    } catch {
        // fall through
    }
    return null;
};

/**
 * Keep the panel inside the viewport (a position stored on a wider screen
 * must not put it off screen on the 1300x600 class PC).
 * @param {{x: number, y: number}} position - wanted top-left
 * @param {{width: number, height: number}} size - panel size
 * @param {{width: number, height: number}} viewport - window size
 * @returns {{x: number, y: number}} clamped top-left
 */
const clampPanelPosition = (position, size, viewport) => ({
    x: Math.max(0, Math.min(position.x, viewport.width - size.width)),
    y: Math.max(0, Math.min(position.y, viewport.height - size.height)),
});

/** @returns {{x: number, y: number}|null} the remembered position */
const loadPanelPosition = () => {
    try {
        if (typeof window === 'undefined' || !window.localStorage) return null;
        return parsePanelPosition(window.localStorage.getItem(POSITION_STORAGE_KEY));
    } catch {
        return null;
    }
};

/** @param {{x: number, y: number}} position - position to remember */
const savePanelPosition = (position) => {
    try {
        if (typeof window === 'undefined' || !window.localStorage) return;
        window.localStorage.setItem(POSITION_STORAGE_KEY, JSON.stringify({ x: position.x, y: position.y }));
    } catch {
        // private mode / quota: the panel just opens at the default place.
    }
};

export {
    TEACHER_PANEL_POLL_INTERVAL_MS,
    TEACHER_PANEL_RECENT_LIMIT,
    POSITION_STORAGE_KEY,
    shouldPollTeacherPanel,
    summarizePanelStatus,
    buildPanelSeats,
    kickRequestsForClassroom,
    recentAssignments,
    parsePanelPosition,
    clampPanelPosition,
    loadPanelPosition,
    savePanelPosition,
};
