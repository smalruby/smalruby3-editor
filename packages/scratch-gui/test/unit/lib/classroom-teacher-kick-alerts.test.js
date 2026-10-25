import {
    TEACHER_KICK_IDLE_MULTIPLIER,
    TEACHER_KICK_MAX_BACKOFF_MS,
    TEACHER_KICK_POLL_INTERVAL_MS,
    newKickRequestIds,
    nextTeacherKickPollDelay,
    shouldPollTeacherKickRequests,
    summarizeKickRequests,
} from '../../../src/lib/classroom-teacher-kick-alerts.js';

describe('classroom-teacher-kick-alerts (#1200)', () => {
    test('polls every 10 seconds by default', () => {
        expect(TEACHER_KICK_POLL_INTERVAL_MS).toBe(10000);
    });

    test('polls only while logged in and the tab is visible', () => {
        expect(shouldPollTeacherKickRequests({ loggedIn: true, visible: true })).toBe(true);
        expect(shouldPollTeacherKickRequests({ loggedIn: false, visible: true })).toBe(false);
        expect(shouldPollTeacherKickRequests({ loggedIn: true, visible: false })).toBe(false);
    });

    test('keeps the base interval while assignments are active', () => {
        expect(nextTeacherKickPollDelay({ baseMs: 10000, failures: 0, activeAssignmentCount: 3 })).toBe(10000);
        expect(nextTeacherKickPollDelay({ baseMs: 10000, failures: 0, activeAssignmentCount: null })).toBe(10000);
    });

    test('asks less often when the teacher has no active assignment', () => {
        expect(nextTeacherKickPollDelay({ baseMs: 10000, failures: 0, activeAssignmentCount: 0 })).toBe(
            10000 * TEACHER_KICK_IDLE_MULTIPLIER,
        );
    });

    test('backs off on consecutive errors up to a cap', () => {
        expect(nextTeacherKickPollDelay({ baseMs: 10000, failures: 1, activeAssignmentCount: 3 })).toBe(20000);
        expect(nextTeacherKickPollDelay({ baseMs: 10000, failures: 2, activeAssignmentCount: 3 })).toBe(40000);
        expect(nextTeacherKickPollDelay({ baseMs: 10000, failures: 20, activeAssignmentCount: 3 })).toBe(
            TEACHER_KICK_MAX_BACKOFF_MS,
        );
    });

    test('newKickRequestIds returns only ids not announced yet', () => {
        const seen = new Set(['a']);
        expect(newKickRequestIds(seen, [{ requestId: 'a' }, { requestId: 'b' }])).toEqual(['b']);
        expect(newKickRequestIds(seen, null)).toEqual([]);
    });

    test('summarizeKickRequests shows the oldest and counts the rest', () => {
        expect(summarizeKickRequests([])).toEqual({ count: 0, first: null, others: 0 });
        const a = { requestId: 'a' };
        const b = { requestId: 'b' };
        expect(summarizeKickRequests([a, b])).toEqual({ count: 2, first: a, others: 1 });
    });
});
