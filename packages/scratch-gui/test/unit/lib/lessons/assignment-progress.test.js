import {
    ASSIGNMENT_MARKS,
    assignmentChallengeRecords,
    assignmentLibraryFocus,
    assignmentMenuMark,
    assignmentProgress,
    canSubmitAssignment,
    conditionCount,
    isAssignmentChallenge,
    isAssignmentJustCleared,
    normalizeAssignmentLesson,
    restrictCourseStatus,
} from '../../../../src/lib/lessons/assignment-progress';
import { COURSES } from '../../../../src/lib/lessons/courses';
import { courseProgress } from '../../../../src/lib/lessons/lesson-progress';

const record = (completedAt = '2026-11-15T01:00:00.000Z') => ({ completedAt, courseId: 'c', lessonId: 'l' });
const progressOf = (...ids) => ({ version: 1, challenges: Object.fromEntries(ids.map((id) => [id, record()])) });

const lesson = (overrides = {}) =>
    normalizeAssignmentLesson({
        courseId: 'kyou-kara-programmer',
        challengeIds: ['a', 'b', 'c', 'd', 'e', 'f'],
        requiredChallengeIds: ['b', 'e'],
        completion: { type: 'all' },
        submitWork: false,
        ...overrides,
    });

// テスト用のコース（a〜f）。実際のコースの ID に縛られずに数え方を見る
const FAKE_COURSES = [
    {
        id: 'kyou-kara-programmer',
        language: 'blocks',
        lessons: [{ id: 'l', challenges: ['a', 'b', 'c', 'd', 'e', 'f'].map((id) => ({ id })) }],
    },
];
const progressFor = (l, p) => assignmentProgress(l, p, FAKE_COURSES);
const justCleared = (l, p, id, wasNew) => isAssignmentJustCleared(l, p, id, wasNew, FAKE_COURSES);

describe('normalizeAssignmentLesson', () => {
    test('returns null for missing or malformed settings', () => {
        expect(normalizeAssignmentLesson(null)).toBeNull();
        expect(normalizeAssignmentLesson(undefined)).toBeNull();
        expect(normalizeAssignmentLesson({})).toBeNull();
        expect(normalizeAssignmentLesson({ courseId: 'x', challengeIds: [] })).toBeNull();
        expect(normalizeAssignmentLesson({ courseId: 'x', challengeIds: 'a' })).toBeNull();
        expect(normalizeAssignmentLesson({ courseId: 1, challengeIds: ['a'] })).toBeNull();
    });

    test('fills the defaults (no required, completion all, no work submission)', () => {
        expect(normalizeAssignmentLesson({ courseId: 'x', challengeIds: ['a', 'b'] })).toEqual({
            courseId: 'x',
            challengeIds: ['a', 'b'],
            requiredChallengeIds: [],
            completion: { type: 'all' },
            submitWork: false,
            scoring: null,
        });
    });

    test('keeps only required ids that are in the challenges and drops duplicates', () => {
        const result = normalizeAssignmentLesson({
            courseId: 'x',
            challengeIds: ['a', 'b', 'a', 7],
            requiredChallengeIds: ['b', 'z', 'b'],
        });
        expect(result.challengeIds).toEqual(['a', 'b']);
        expect(result.requiredChallengeIds).toEqual(['b']);
    });

    test('keeps a count completion and the submit flag', () => {
        const result = normalizeAssignmentLesson({
            courseId: 'x',
            challengeIds: ['a', 'b', 'c'],
            completion: { type: 'count', count: 2 },
            submitWork: true,
            scoring: { total: 100, requiredPoints: 70, optionalPoints: 30 },
        });
        expect(result.completion).toEqual({ type: 'count', count: 2 });
        expect(result.submitWork).toBe(true);
        expect(result.scoring).toEqual({ total: 100, requiredPoints: 70, optionalPoints: 30 });
    });

    test('treats an unknown completion as all', () => {
        expect(lesson({ completion: { type: 'weird' } }).completion).toEqual({ type: 'all' });
        expect(lesson({ completion: { type: 'count', count: 'x' } }).completion).toEqual({ type: 'all' });
    });
});

describe('conditionCount', () => {
    test('is every challenge for completion all', () => {
        expect(conditionCount(lesson())).toBe(6);
    });

    test('is the count, kept between the required count and every challenge', () => {
        expect(conditionCount(lesson({ completion: { type: 'count', count: 4 } }))).toBe(4);
        expect(conditionCount(lesson({ completion: { type: 'count', count: 1 } }))).toBe(2);
        expect(conditionCount(lesson({ completion: { type: 'count', count: 99 } }))).toBe(6);
    });
});

describe('assignmentProgress', () => {
    test('nothing done: remaining is the condition count', () => {
        const status = progressFor(lesson(), progressOf());
        expect(status).toMatchObject({
            completedCount: 0,
            cappedCount: 0,
            conditionCount: 6,
            requiredCount: 2,
            requiredRemaining: 2,
            remaining: 6,
            started: false,
            cleared: false,
        });
        expect(status.challenges).toEqual([
            { id: 'a', required: false, completed: false },
            { id: 'b', required: true, completed: false },
            { id: 'c', required: false, completed: false },
            { id: 'd', required: false, completed: false },
            { id: 'e', required: true, completed: false },
            { id: 'f', required: false, completed: false },
        ]);
    });

    test('ignores records of challenges outside the assignment', () => {
        const status = progressFor(lesson(), progressOf('x', 'y', 'a'));
        expect(status.completedCount).toBe(1);
        expect(status.started).toBe(true);
    });

    test('remaining is max(condition - done, required left)', () => {
        const count4 = lesson({ completion: { type: 'count', count: 4 } });
        // 4 done but a required one is left: not 0
        const status = progressFor(count4, progressOf('a', 'c', 'd', 'f'));
        expect(status.completedCount).toBe(4);
        expect(status.requiredRemaining).toBe(2);
        expect(status.remaining).toBe(2);
        expect(status.cleared).toBe(false);
    });

    test('caps the done count at the condition count', () => {
        const count4 = lesson({ completion: { type: 'count', count: 4 } });
        const status = progressFor(count4, progressOf('a', 'b', 'c', 'd', 'e'));
        expect(status.completedCount).toBe(5);
        expect(status.cappedCount).toBe(4);
        expect(status.remaining).toBe(0);
        expect(status.cleared).toBe(true);
    });

    test('cleared needs the count and every required challenge', () => {
        expect(progressFor(lesson(), progressOf('a', 'b', 'c', 'd', 'e')).cleared).toBe(false);
        expect(progressFor(lesson(), progressOf('a', 'b', 'c', 'd', 'e', 'f')).cleared).toBe(true);
        const noRequired = lesson({ requiredChallengeIds: [], completion: { type: 'count', count: 2 } });
        expect(progressFor(noRequired, progressOf('c', 'f')).cleared).toBe(true);
    });

    test('returns null without a lesson', () => {
        expect(progressFor(null, progressOf('a'))).toBeNull();
    });
});

describe('assignmentMenuMark', () => {
    test('not started → ○', () => {
        expect(assignmentMenuMark(progressFor(lesson(), progressOf()))).toEqual({
            kind: ASSIGNMENT_MARKS.NOT_STARTED,
            text: '○',
            submitted: false,
        });
    });

    test('in progress → capped done / condition', () => {
        const count4 = lesson({ completion: { type: 'count', count: 4 } });
        expect(assignmentMenuMark(progressFor(count4, progressOf('a', 'c')))).toEqual({
            kind: ASSIGNMENT_MARKS.IN_PROGRESS,
            text: '2/4',
            submitted: false,
        });
        // 5 done with a required one left shows 4/4, not 5/4
        expect(assignmentMenuMark(progressFor(count4, progressOf('a', 'c', 'd', 'f', 'b'))).text).toBe('4/4');
    });

    test('cleared → ✓, and tells whether the work was submitted', () => {
        const cleared = progressFor(lesson(), progressOf('a', 'b', 'c', 'd', 'e', 'f'));
        expect(assignmentMenuMark(cleared)).toEqual({ kind: ASSIGNMENT_MARKS.CLEARED, text: '✓', submitted: false });
        expect(assignmentMenuMark(cleared, { submitted: true }).submitted).toBe(true);
    });

    test('returns null without a status', () => {
        expect(assignmentMenuMark(null)).toBeNull();
    });
});

describe('isAssignmentJustCleared', () => {
    const all = lesson();

    test('true when this new record made the assignment cleared', () => {
        const after = progressOf('a', 'b', 'c', 'd', 'e', 'f');
        expect(justCleared(all, after, 'f', true)).toBe(true);
    });

    test('false when the record was already there (done again)', () => {
        const after = progressOf('a', 'b', 'c', 'd', 'e', 'f');
        expect(justCleared(all, after, 'f', false)).toBe(false);
    });

    test('false when cleared already before this challenge (count condition)', () => {
        const count2 = lesson({ requiredChallengeIds: [], completion: { type: 'count', count: 2 } });
        expect(justCleared(count2, progressOf('a', 'b'), 'b', true)).toBe(true);
        expect(justCleared(count2, progressOf('a', 'b', 'c'), 'c', true)).toBe(false);
    });

    test('false when not cleared, outside the assignment, or no lesson', () => {
        expect(justCleared(all, progressOf('a'), 'a', true)).toBe(false);
        expect(justCleared(all, progressOf('a', 'b', 'c', 'd', 'e', 'f', 'z'), 'z', true)).toBe(false);
        expect(justCleared(null, progressOf('a'), 'a', true)).toBe(false);
    });
});

describe('isAssignmentChallenge / assignmentChallengeRecords', () => {
    test('tells whether a challenge belongs to the assignment', () => {
        expect(isAssignmentChallenge(lesson(), 'a')).toBe(true);
        expect(isAssignmentChallenge(lesson(), 'z')).toBe(false);
        expect(isAssignmentChallenge(null, 'a')).toBe(false);
    });

    test('keeps only the records of the assignment challenges', () => {
        const progress = progressOf('a', 'z');
        expect(assignmentChallengeRecords(lesson(), progress)).toEqual({
            a: { completedAt: '2026-11-15T01:00:00.000Z' },
        });
        expect(assignmentChallengeRecords(null, progress)).toEqual({});
    });
});

describe('restrictCourseStatus', () => {
    const course = COURSES[0];
    const ids = [course.lessons[0].challenges[1].id, course.lessons[2].challenges[0].id];

    test('keeps only the assignment challenges and drops empty lessons', () => {
        const status = { course, ...courseProgress(course, progressOf(ids[0])) };
        const restricted = restrictCourseStatus(status, ids);
        expect(restricted.lessons.map((l) => l.lesson.id)).toEqual([course.lessons[0].id, course.lessons[2].id]);
        expect(restricted.lessons.map((l) => l.number)).toEqual([1, 3]);
        expect(restricted.lessons[0].challenges.map((c) => c.challenge.id)).toEqual([ids[0]]);
        expect(restricted.completedCount).toBe(1);
        expect(restricted.total).toBe(2);
        expect(restricted.allCompleted).toBe(false);
    });

    test('keeps the course check of the whole course (not of the assignment challenges)', () => {
        const status = { course, ...courseProgress(course, progressOf(...ids)) };
        const restricted = restrictCourseStatus(status, ids);
        expect(restricted.completedCount).toBe(2);
        expect(restricted.total).toBe(2);
        expect(restricted.allCompleted).toBe(false);
    });
});

describe('assignmentLibraryFocus', () => {
    const course = COURSES[0];
    const [first, second, third] = course.lessons[0].challenges;
    const later = course.lessons[1].challenges[0];
    const a = normalizeAssignmentLesson({
        courseId: course.id,
        challengeIds: [first.id, third.id, later.id],
    });

    test('points at the first challenge not done yet', () => {
        expect(assignmentLibraryFocus(a, progressOf(first.id))).toEqual({
            language: course.language,
            courseId: course.id,
            lessonId: course.lessons[0].id,
            nextChallengeId: third.id,
        });
    });

    test('looks after the current challenge first, then wraps around', () => {
        expect(assignmentLibraryFocus(a, progressOf(third.id), third.id).nextChallengeId).toBe(later.id);
        expect(assignmentLibraryFocus(a, progressOf(third.id, later.id), later.id).nextChallengeId).toBe(first.id);
        // a challenge outside the assignment: from the top
        expect(assignmentLibraryFocus(a, progressOf(), second.id).nextChallengeId).toBe(first.id);
    });

    test('falls back to the current challenge when it is the only one not done (#1599 FYI2)', () => {
        const focus = assignmentLibraryFocus(a, progressOf(first.id, later.id), third.id);
        expect(focus.nextChallengeId).toBe(third.id);
        expect(focus.lessonId).toBe(course.lessons[0].id);
        // done already: no mark
        expect(
            assignmentLibraryFocus(a, progressOf(first.id, third.id, later.id), third.id).nextChallengeId,
        ).toBeNull();
    });

    test('no mark when every assignment challenge is done', () => {
        const focus = assignmentLibraryFocus(a, progressOf(first.id, third.id, later.id));
        expect(focus.nextChallengeId).toBeNull();
        expect(focus.courseId).toBe(course.id);
    });

    test('null for an unknown course or no lesson', () => {
        expect(assignmentLibraryFocus(null, progressOf())).toBeNull();
        expect(
            assignmentLibraryFocus(
                normalizeAssignmentLesson({ courseId: 'nope', challengeIds: ['x'] }),
                progressOf(),
            ),
        ).toBeNull();
    });
});

describe('challenges unknown to this build (#1599 M1)', () => {
    // 'n1' / 'n2' は、先生が新しい版で選んだ、この版のコースに無いチャレンジ
    const withUnknown = (overrides = {}) =>
        lesson({ challengeIds: ['a', 'b', 'n1', 'n2'], requiredChallengeIds: ['b', 'n1'], ...overrides });

    test('leaves them out of the circles, the counts and the condition', () => {
        const status = progressFor(withUnknown(), progressOf('a'));
        expect(status.challenges.map((c) => c.id)).toEqual(['a', 'b']);
        expect(status.unknownCount).toBe(2);
        expect(status.conditionCount).toBe(2);
        expect(status.requiredCount).toBe(1);
        expect(status.remaining).toBe(1);
    });

    test('a condition count above the known challenges is capped to them, so it can be cleared', () => {
        const status = progressFor(withUnknown({ completion: { type: 'count', count: 3 } }), progressOf('a', 'b'));
        expect(status.conditionCount).toBe(2);
        expect(status.cleared).toBe(true);
    });

    test('all unknown: never cleared, but the work can still be submitted', () => {
        const l = lesson({ challengeIds: ['n1', 'n2'], requiredChallengeIds: [], submitWork: true });
        const status = progressFor(l, progressOf());
        expect(status.challenges).toEqual([]);
        expect(status.cleared).toBe(false);
        expect(canSubmitAssignment(l, status)).toBe(true);
    });

    test('canSubmitAssignment: cleared or unknown challenges, and only for work-submit assignments', () => {
        const submit = withUnknown({ submitWork: true });
        expect(canSubmitAssignment(submit, progressFor(submit, progressOf()))).toBe(true);
        const known = lesson({ submitWork: true });
        expect(canSubmitAssignment(known, progressFor(known, progressOf('a')))).toBe(false);
        expect(canSubmitAssignment(known, progressFor(known, progressOf('a', 'b', 'c', 'd', 'e', 'f')))).toBe(true);
        const noSubmit = withUnknown();
        expect(canSubmitAssignment(noSubmit, progressFor(noSubmit, progressOf()))).toBe(false);
        expect(canSubmitAssignment(null, null)).toBe(false);
    });

    test('with the real courses, unknown ids are counted as unknown', () => {
        const l = normalizeAssignmentLesson({
            courseId: 'kyou-kara-programmer',
            challengeIds: [COURSES[0].lessons[0].challenges[0].id, 'not-in-this-build'],
        });
        const status = assignmentProgress(l, progressOf());
        expect(status.challenges).toHaveLength(1);
        expect(status.unknownCount).toBe(1);
    });
});
