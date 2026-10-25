import { SEATED_THRESHOLD_MS } from '../../../src/lib/classroom-presence.js';
import {
    TEACHER_PANEL_POLL_INTERVAL_MS,
    TEACHER_PANEL_RECENT_LIMIT,
    buildPanelSeats,
    clampPanelPosition,
    kickRequestsForClassroom,
    loadPanelPosition,
    parsePanelPosition,
    recentAssignments,
    savePanelPosition,
    shouldPollTeacherPanel,
    summarizePanelStatus,
} from '../../../src/lib/classroom-teacher-panel.js';

const NOW = Date.parse('2026-10-25T10:00:00.000Z');
const recent = new Date(NOW - 60 * 1000).toISOString();
const stale = new Date(NOW - SEATED_THRESHOLD_MS - 1000).toISOString();

describe('classroom-teacher-panel', () => {
    test('polls every 30 seconds by default', () => {
        expect(TEACHER_PANEL_POLL_INTERVAL_MS).toBe(30 * 1000);
    });

    describe('shouldPollTeacherPanel', () => {
        test('polls only while open, logged in, visible and an assignment is chosen', () => {
            const base = { open: true, minimized: false, loggedIn: true, visible: true, classroomId: 'c1' };
            expect(shouldPollTeacherPanel(base)).toBe(true);
            expect(shouldPollTeacherPanel({ ...base, open: false })).toBe(false);
            expect(shouldPollTeacherPanel({ ...base, loggedIn: false })).toBe(false);
            expect(shouldPollTeacherPanel({ ...base, visible: false })).toBe(false);
            expect(shouldPollTeacherPanel({ ...base, classroomId: null })).toBe(false);
        });

        test('keeps polling while minimized (the header shows the counts)', () => {
            expect(
                shouldPollTeacherPanel({
                    open: true,
                    minimized: true,
                    loggedIn: true,
                    visible: true,
                    classroomId: 'c1',
                }),
            ).toBe(true);
        });
    });

    describe('summarizePanelStatus', () => {
        test('counts seated (rough hint) / capacity and submitted / joined', () => {
            const members = [
                { memberId: 'seat-01', lastActiveAt: recent, hasSubmission: true },
                { memberId: 'seat-02', lastActiveAt: stale },
                { memberId: 'seat-03', lastActiveAt: recent, hasSubmission: true, submissionStatus: 'returned' },
                // left the class but submitted before: not joined, not seated, not counted
                { memberId: 'seat-04', hasSubmission: true, left: true },
            ];
            expect(summarizePanelStatus({ members, studentCount: 40, now: NOW })).toEqual({
                seated: 2,
                capacity: 40,
                joined: 3,
                submitted: 2,
            });
        });

        test('handles an empty class', () => {
            expect(summarizePanelStatus({ members: [], studentCount: 0, now: NOW })).toEqual({
                seated: 0,
                capacity: 0,
                joined: 0,
                submitted: 0,
            });
        });
    });

    describe('buildPanelSeats', () => {
        test('one cell per seat with presence, submission and kick request', () => {
            const members = [
                { memberId: 'seat-01', lastActiveAt: recent, hasSubmission: true, nickname: 'たろう' },
                { memberId: 'seat-03', lastActiveAt: stale },
            ];
            const seats = buildPanelSeats({
                members,
                studentCount: 3,
                kickRequests: [{ requestId: 'r1', seatNumber: 3 }],
                now: NOW,
            });
            expect(seats).toEqual([
                {
                    seatNumber: 1,
                    memberId: 'seat-01',
                    nickname: 'たろう',
                    presence: 'seated',
                    submission: 'submitted',
                    kickRequested: false,
                },
                {
                    seatNumber: 2,
                    memberId: 'seat-02',
                    nickname: null,
                    presence: 'notJoined',
                    submission: null,
                    kickRequested: false,
                },
                {
                    seatNumber: 3,
                    memberId: 'seat-03',
                    nickname: null,
                    presence: 'notSeated',
                    submission: 'notSubmitted',
                    kickRequested: true,
                },
            ]);
        });
    });

    describe('kickRequestsForClassroom', () => {
        test('keeps only the requests of the shown assignment', () => {
            const requests = [
                { requestId: 'a', classroomId: 'c1' },
                { requestId: 'b', classroomId: 'c2' },
            ];
            expect(kickRequestsForClassroom(requests, 'c1')).toEqual([{ requestId: 'a', classroomId: 'c1' }]);
            expect(kickRequestsForClassroom(null, 'c1')).toEqual([]);
        });
    });

    describe('recentAssignments', () => {
        test('active assignments, most recent first, capped', () => {
            const list = [
                { classroomId: 'old', sortDate: '2026-01-01T00:00:00Z' },
                { classroomId: 'archived', sortDate: '2026-10-01T00:00:00Z', status: 'archived' },
                { classroomId: 'new', sortDate: '2026-10-20T00:00:00Z' },
                { classroomId: 'mid', createdAt: '2026-05-01T00:00:00Z' },
            ];
            expect(recentAssignments(list).map((c) => c.classroomId)).toEqual(['new', 'mid', 'old']);
            const many = Array.from({ length: 12 }, (_, i) => ({
                classroomId: `c${i}`,
                sortDate: `2026-10-${String(i + 1).padStart(2, '0')}T00:00:00Z`,
            }));
            expect(recentAssignments(many)).toHaveLength(TEACHER_PANEL_RECENT_LIMIT);
            expect(recentAssignments(many)[0].classroomId).toBe('c11');
        });
    });

    describe('panel position', () => {
        test('parses a stored position and rejects garbage', () => {
            expect(parsePanelPosition('{"x":10,"y":20}')).toEqual({ x: 10, y: 20 });
            expect(parsePanelPosition('{"x":"a","y":20}')).toBeNull();
            expect(parsePanelPosition('not json')).toBeNull();
            expect(parsePanelPosition(null)).toBeNull();
        });

        test('keeps the panel header on screen', () => {
            const viewport = { width: 1300, height: 600 };
            const size = { width: 300, height: 400 };
            expect(clampPanelPosition({ x: 2000, y: 900 }, size, viewport)).toEqual({ x: 1000, y: 200 });
            expect(clampPanelPosition({ x: -50, y: -10 }, size, viewport)).toEqual({ x: 0, y: 0 });
            expect(clampPanelPosition({ x: 100, y: 50 }, size, viewport)).toEqual({ x: 100, y: 50 });
        });

        test('save / load round trip and survive a throwing storage', () => {
            savePanelPosition({ x: 12, y: 34 });
            expect(loadPanelPosition()).toEqual({ x: 12, y: 34 });
            const spy = jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
                throw new Error('blocked');
            });
            expect(loadPanelPosition()).toBeNull();
            spy.mockRestore();
            const setSpy = jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
                throw new Error('quota');
            });
            expect(() => savePanelPosition({ x: 1, y: 2 })).not.toThrow();
            setSpy.mockRestore();
        });
    });
});
