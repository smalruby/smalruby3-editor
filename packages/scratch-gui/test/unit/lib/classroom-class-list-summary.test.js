/* eslint-env jest */
import {
    currentAssignmentFor,
    lessonDateKey,
    localDateKey,
    nextLessonFor,
    reviewItems,
} from '../../../src/lib/classroom-class-list-summary.js';

const DAY = 24 * 60 * 60 * 1000;
// Local noon, so the date keys do not depend on the time zone of the test machine.
const NOW = new Date(2026, 10, 15, 12, 0, 0).getTime();
const at = (days) => new Date(NOW + days * DAY).toISOString();

describe('lessonDateKey in Japan time', () => {
    const TZ = 'Asia/Tokyo';

    test('reads a UTC ISO time as the local date, not its first 10 characters', () => {
        // 2026-11-05 08:00 in Japan is still 2026-11-04 in UTC.
        expect(lessonDateKey({ sortDate: '2026-11-04T23:00:00.000Z' }, TZ)).toBe('2026-11-05');
        expect(lessonDateKey({ createdAt: '2026-11-04T14:59:59.000Z' }, TZ)).toBe('2026-11-04');
        expect(localDateKey(Date.parse('2026-11-04T15:00:00.000Z'), TZ)).toBe('2026-11-05');
    });

    test('keeps a date-only value as it is', () => {
        expect(lessonDateKey({ sortDate: '2026-11-05' }, TZ)).toBe('2026-11-05');
        expect(lessonDateKey({})).toBeNull();
        expect(lessonDateKey({ sortDate: 'not a date' })).toBeNull();
    });

    test('uses the local time zone when none is given', () => {
        const ms = new Date(2026, 10, 5, 8, 0, 0).getTime();
        expect(lessonDateKey({ sortDate: new Date(ms).toISOString() })).toBe('2026-11-05');
    });
});

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

describe('reviewItems', () => {
    const groups = [
        { groupId: 'g1', status: 'active' },
        { groupId: 'g2', status: 'archived' },
    ];

    test('lists the active classes’ assignments with submissions not returned, newest lesson first', () => {
        const classrooms = [
            { classroomId: 'old', groupId: 'g1', sortDate: at(-20), unreturnedCount: 3 },
            { classroomId: 'none', groupId: 'g1', sortDate: at(-1), unreturnedCount: 0 },
            { classroomId: 'new', groupId: 'g1', sortDate: at(-1), unreturnedCount: 12 },
            // Assignments of an archived class are left out (and need no count).
            { classroomId: 'archived-class', groupId: 'g2', sortDate: at(-1) },
            { classroomId: 'archived', groupId: 'g1', status: 'archived', sortDate: at(-1) },
        ];
        const items = reviewItems(classrooms, groups);
        expect(items.map((x) => x.classroom.classroomId)).toEqual(['new', 'old']);
        expect(items[0]).toEqual(expect.objectContaining({ count: 12, group: groups[0] }));
    });

    test('returns an empty list when every count is there and zero', () => {
        expect(reviewItems([{ classroomId: 'a', groupId: 'g1', unreturnedCount: 0 }], groups)).toEqual([]);
    });

    test('leaves out assignments without a count (lessons, older assignments)', () => {
        const items = reviewItems(
            [
                { classroomId: 'a', groupId: 'g1', unreturnedCount: 2 },
                { classroomId: 'lesson', groupId: 'g1' },
            ],
            groups,
        );
        expect(items.map((x) => x.classroom.classroomId)).toEqual(['a']);
    });

    test('returns null when no assignment has a count (older API) or there is no assignment', () => {
        expect(reviewItems([{ classroomId: 'a', groupId: 'g1' }], groups)).toBeNull();
        expect(reviewItems([], groups)).toBeNull();
        expect(reviewItems([{ classroomId: 'a', groupId: 'g2', unreturnedCount: 1 }], groups)).toBeNull();
    });

    test('does not say "none" while some assignments have no count', () => {
        expect(
            reviewItems(
                [
                    { classroomId: 'a', groupId: 'g1', unreturnedCount: 0 },
                    { classroomId: 'lesson', groupId: 'g1' },
                ],
                groups,
            ),
        ).toBeNull();
    });
});

describe('currentAssignmentFor (the stream card, #1960)', () => {
    const c = (id, days, over = {}) => ({
        classroomId: id,
        groupId: 'g1',
        assignmentName: id,
        sortDate: at(days),
        ...over,
    });

    test('a lesson today wins over closer-looking ones', () => {
        const current = currentAssignmentFor([c('past', -1), c('today', 0), c('next', 1)], NOW);
        expect(current.classroom.classroomId).toBe('today');
        expect(current.isToday).toBe(true);
        expect(current.date).toBe(localDateKey(NOW));
    });

    test('without a lesson today, the nearest lesson date (an upcoming one on a tie)', () => {
        expect(currentAssignmentFor([c('past', -3), c('next', 5)], NOW).classroom.classroomId).toBe('past');
        const tie = currentAssignmentFor([c('past', -2), c('next', 2)], NOW);
        expect(tie.classroom.classroomId).toBe('next');
        expect(tie.isToday).toBe(false);
    });

    test('the same day goes by name; archived and dateless assignments are left out', () => {
        expect(currentAssignmentFor([c('b', 0), c('a', 0)], NOW).classroom.classroomId).toBe('a');
        expect(
            currentAssignmentFor([c('gone', 0, { status: 'archived' }), { classroomId: 'x', groupId: 'g1' }], NOW),
        ).toBeNull();
        expect(currentAssignmentFor([], NOW)).toBeNull();
    });

    test('counts the day in Japan time: a morning lesson stored as UTC is still today', () => {
        // Stored as local midnight (the date input) → the day before in UTC.
        const midnight = new Date(2026, 10, 15, 0, 0, 0).toISOString();
        const current = currentAssignmentFor([{ classroomId: 'm', sortDate: midnight }, c('next', 1)], NOW);
        expect(current.classroom.classroomId).toBe('m');
        expect(current.isToday).toBe(true);
    });
});
