/* eslint-env jest */
import {
    countUnreturned,
    localDateKey,
    nextLessonFor,
    REVIEW_CANDIDATE_LIMIT,
    reviewCandidates,
} from '../../../src/lib/classroom-class-list-summary.js';

const DAY = 24 * 60 * 60 * 1000;
// Local noon, so the date keys do not depend on the time zone of the test machine.
const NOW = new Date(2026, 10, 15, 12, 0, 0).getTime();
const at = (days) => new Date(NOW + days * DAY).toISOString();

describe('nextLessonFor', () => {
    test('picks the nearest lesson date from today on', () => {
        const classrooms = [
            { classroomId: 'a', groupId: 'g1', assignmentName: 'past', sortDate: at(-1) },
            { classroomId: 'b', groupId: 'g1', assignmentName: 'later', sortDate: at(5) },
            { classroomId: 'c', groupId: 'g1', assignmentName: 'today', sortDate: at(0) },
            { classroomId: 'd', groupId: 'g2', assignmentName: 'other class', sortDate: at(0) },
        ];
        const next = nextLessonFor(classrooms, 'g1', NOW);
        expect(next.classroom.classroomId).toBe('c');
        expect(next.date).toBe(localDateKey(NOW));
    });

    test('falls back to the creation date and returns null when nothing is ahead', () => {
        expect(
            nextLessonFor([{ classroomId: 'a', groupId: 'g1', createdAt: at(2) }], 'g1', NOW).classroom.classroomId,
        ).toBe('a');
        expect(nextLessonFor([{ classroomId: 'a', groupId: 'g1', sortDate: at(-3) }], 'g1', NOW)).toBeNull();
        expect(nextLessonFor([], 'g1', NOW)).toBeNull();
    });
});

describe('reviewCandidates', () => {
    const groups = [
        { groupId: 'g1', status: 'active' },
        { groupId: 'g2', status: 'archived' },
    ];

    test('keeps the active classes’ assignments of the last 14 days, newest first', () => {
        const classrooms = [
            { classroomId: 'old', groupId: 'g1', sortDate: at(-20) },
            { classroomId: 'future', groupId: 'g1', sortDate: at(2) },
            { classroomId: 'archived-class', groupId: 'g2', sortDate: at(-1) },
            { classroomId: 'no-class', groupId: null, sortDate: at(-1) },
            { classroomId: 'week', groupId: 'g1', sortDate: at(-7) },
            { classroomId: 'today', groupId: 'g1', sortDate: at(0) },
        ];
        expect(reviewCandidates(classrooms, groups, NOW).map((c) => c.classroom.classroomId)).toEqual([
            'today',
            'week',
        ]);
        expect(reviewCandidates(classrooms, groups, NOW)[0].group.groupId).toBe('g1');
    });

    test('asks for at most REVIEW_CANDIDATE_LIMIT assignments', () => {
        const classrooms = Array.from({ length: 10 }, (_, i) => ({
            classroomId: `c${i}`,
            groupId: 'g1',
            sortDate: at(-i),
        }));
        expect(reviewCandidates(classrooms, groups, NOW)).toHaveLength(REVIEW_CANDIDATE_LIMIT);
    });
});

describe('countUnreturned', () => {
    test('counts each seat’s latest submission that is not returned', () => {
        const submissions = [
            { memberId: 'seat-01', status: 'returned', submittedAt: '2026-11-10T00:00:00Z' },
            { memberId: 'seat-01', status: 'submitted', submittedAt: '2026-11-12T00:00:00Z' },
            { memberId: 'seat-02', status: 'submitted', submittedAt: '2026-11-10T00:00:00Z' },
            { memberId: 'seat-02', status: 'returned', submittedAt: '2026-11-12T00:00:00Z' },
            { memberId: 'seat-03', submittedAt: '2026-11-12T00:00:00Z' },
        ];
        expect(countUnreturned({ submissions })).toBe(2);
        expect(countUnreturned({})).toBe(0);
        expect(countUnreturned(null)).toBe(0);
    });
});
