import { COURSES, defineCourse, defineLesson, LANGUAGES } from '../../../../src/lib/lessons/courses';
import { emptyProgress, markChallengeCompleted } from '../../../../src/lib/lessons/lesson-progress';
import { filterCourseStatuses } from '../../../../src/lib/lessons/library-filter';
import { currentCourseId, DOT_STATES, initialFoldState, lessonDots } from '../../../../src/lib/lessons/library-fold';

const nameOf = (challenge) => challenge.id;

const makeLesson = (id, challengeIds, extra = {}) =>
    defineLesson({ id, challenges: challengeIds.map((cid) => ({ id: cid })), ...extra });

// コース A: レッスン 0（warmup）・1・2・3・4。コース B: レッスン 1・2
const COURSE_A = defineCourse({
    id: 'a',
    language: LANGUAGES.BLOCKS,
    lessons: [
        makeLesson('a-l0', ['a0-1', 'a0-2'], { warmup: true }),
        makeLesson('a-l1', ['a1-1', 'a1-2', 'a1-3']),
        makeLesson('a-l2', ['a2-1', 'a2-2']),
        makeLesson('a-l3', ['a3-1', 'a3-2']),
        makeLesson('a-l4', ['a4-1']),
    ],
});
const COURSE_B = defineCourse({
    id: 'b',
    language: LANGUAGES.BLOCKS,
    lessons: [makeLesson('b-l1', ['b1-1', 'b1-2']), makeLesson('b-l2', ['b2-1'])],
});
const TEST_COURSES = [COURSE_A, COURSE_B];

const progressWith = (ids, courses = TEST_COURSES) =>
    ids.reduce(
        (p, id, i) => markChallengeCompleted(p, id, `2026-11-10T00:00:${String(i).padStart(2, '0')}.000Z`, courses),
        emptyProgress(),
    );

const statusesOf = (progress, query = '', courses = TEST_COURSES) =>
    filterCourseStatuses(courses, progress, query, nameOf);

const openIds = (map) =>
    Object.entries(map)
        .filter(([, open]) => open)
        .map(([id]) => id);

const foldOf = (progress, options) => initialFoldState(statusesOf(progress), progress, options);

describe('initialFoldState', () => {
    test('before anything is done, opens the first course with lesson 0 and lesson 1 only', () => {
        const fold = foldOf(emptyProgress());
        expect(openIds(fold.courses)).toEqual(['a']);
        expect(openIds(fold.lessons)).toEqual(['a-l0', 'a-l1', 'b-l1', 'b-l2']);
        expect(fold.lessons['a-l2']).toBe(false);
        expect(fold.lessons['a-l3']).toBe(false);
    });

    test('closes the lessons that are all done, and opens the next lesson and the one after', () => {
        const progress = progressWith(['a0-1', 'a0-2', 'a1-1', 'a1-2', 'a1-3', 'a2-1']);
        const fold = foldOf(progress);
        expect(fold.lessons['a-l0']).toBe(false);
        expect(fold.lessons['a-l1']).toBe(false);
        expect(fold.lessons['a-l2']).toBe(true);
        expect(fold.lessons['a-l3']).toBe(true);
        expect(fold.lessons['a-l4']).toBe(false);
    });

    test('the lesson after skips lessons that are already all done', () => {
        const progress = progressWith(['a1-1', 'a2-1', 'a2-2']);
        const fold = foldOf(progress);
        // レッスン 0 がまだなので、いま = 0、つぎ = 1（2 は全部できているので閉じる）
        expect(openIds(fold.lessons).filter((id) => id.startsWith('a-'))).toEqual(['a-l0', 'a-l1']);
        // レッスン 0 ができたら、いま = 1、つぎ = 3（2 は飛ばす）
        const fold2 = foldOf(progressWith(['a0-1', 'a0-2', 'a1-1', 'a2-1', 'a2-2']));
        expect(openIds(fold2.lessons).filter((id) => id.startsWith('a-'))).toEqual(['a-l1', 'a-l3']);
    });

    test('opens only the last lesson when the next lesson is the last one', () => {
        const progress = progressWith(['a0-1', 'a0-2', 'a1-1', 'a1-2', 'a1-3', 'a2-1', 'a2-2', 'a3-1', 'a3-2']);
        const fold = foldOf(progress);
        expect(openIds(fold.lessons).filter((id) => id.startsWith('a-'))).toEqual(['a-l4']);
    });

    test('closes every lesson of a course that is all done, and opens the next course', () => {
        const progress = progressWith([
            'a0-1',
            'a0-2',
            'a1-1',
            'a1-2',
            'a1-3',
            'a2-1',
            'a2-2',
            'a3-1',
            'a3-2',
            'a4-1',
        ]);
        const fold = foldOf(progress);
        expect(openIds(fold.courses)).toEqual(['b']);
        expect(openIds(fold.lessons)).toEqual(['b-l1', 'b-l2']);
    });

    test('opens the course where a challenge was done most recently', () => {
        const progress = progressWith(['a0-1', 'b1-1']);
        expect(openIds(foldOf(progress).courses)).toEqual(['b']);
        expect(openIds(foldOf(progressWith(['b1-1', 'a0-1'])).courses)).toEqual(['a']);
    });

    test('opens the first course when every course is all done', () => {
        const all = TEST_COURSES.flatMap((c) =>
            [...c.warmupLessons, ...c.lessons].flatMap((l) => l.challenges.map((ch) => ch.id)),
        );
        const fold = foldOf(progressWith(all));
        expect(openIds(fold.courses)).toEqual(['a']);
        expect(openIds(fold.lessons)).toEqual([]);
    });

    test('opens everything while searching', () => {
        const progress = progressWith(['a0-1', 'a0-2']);
        const fold = initialFoldState(statusesOf(progress, 'a'), progress, { searching: true });
        expect(Object.values(fold.courses).every(Boolean)).toBe(true);
        expect(Object.values(fold.lessons).every(Boolean)).toBe(true);
        expect(fold.lessons['a-l0']).toBe(true);
    });

    test('opens everything in the library of the class assignment challenges', () => {
        const progress = progressWith(['a0-1', 'a0-2', 'a1-1', 'a1-2', 'a1-3']);
        const fold = foldOf(progress, { assignmentOnly: true });
        expect(Object.values(fold.courses).every(Boolean)).toBe(true);
        expect(Object.values(fold.lessons).every(Boolean)).toBe(true);
    });

    test('opens the focused lesson and its course, even when the lesson is all done', () => {
        const progress = progressWith(['a0-1', 'a0-2', 'a1-1', 'a1-2', 'a1-3', 'b1-1']);
        const fold = foldOf(progress, { focusLessonId: 'a-l1' });
        expect(openIds(fold.courses)).toEqual(['a']);
        expect(fold.lessons['a-l1']).toBe(true);
        expect(fold.lessons['a-l2']).toBe(true);
        expect(fold.lessons['a-l0']).toBe(false);
        expect(fold.lessons['a-l3']).toBe(false);
    });

    test('opens the focused lesson and the next one after it', () => {
        const fold = foldOf(emptyProgress(), { focusLessonId: 'a-l2' });
        expect(openIds(fold.lessons).filter((id) => id.startsWith('a-'))).toEqual(['a-l2', 'a-l3']);
    });

    test('ignores an unknown focused lesson', () => {
        const fold = foldOf(emptyProgress(), { focusLessonId: 'nope' });
        expect(openIds(fold.lessons).filter((id) => id.startsWith('a-'))).toEqual(['a-l0', 'a-l1']);
    });

    test('does not choose a lesson without challenges as the current lesson', () => {
        const course = defineCourse({
            id: 'c',
            language: LANGUAGES.BLOCKS,
            lessons: [makeLesson('c-l1', []), makeLesson('c-l2', ['c2-1']), makeLesson('c-l3', [])],
        });
        const progress = emptyProgress();
        const fold = initialFoldState(statusesOf(progress, '', [course]), progress);
        expect(openIds(fold.lessons)).toEqual(['c-l2']);
    });

    test('works with no courses', () => {
        expect(initialFoldState([], emptyProgress())).toEqual({ courses: {}, lessons: {} });
        expect(currentCourseId([], emptyProgress())).toBeNull();
    });

    test('with the real courses, opens lesson 0 and lesson 1 of the first course at first', () => {
        const progress = emptyProgress();
        const statuses = filterCourseStatuses(COURSES, progress, '', nameOf);
        const fold = initialFoldState(statuses, progress);
        expect(openIds(fold.courses)).toEqual(['kyou-kara-programmer']);
        expect(fold.lessons['blocks-l0']).toBe(true);
        expect(fold.lessons['blocks-l1']).toBe(true);
        expect(fold.lessons['blocks-l2']).toBe(false);
        expect(fold.lessons['blocks-l3']).toBe(false);
    });
});

describe('lessonDots', () => {
    test('one dot per challenge: done, next or todo', () => {
        const progress = progressWith(['a1-1']);
        const lessonStatus = statusesOf(progress)[0].lessons.find((l) => l.lesson.id === 'a-l1');
        expect(lessonDots(lessonStatus, 'a1-2')).toEqual([
            { id: 'a1-1', state: DOT_STATES.DONE },
            { id: 'a1-2', state: DOT_STATES.NEXT },
            { id: 'a1-3', state: DOT_STATES.TODO },
        ]);
        expect(lessonDots(lessonStatus).map((d) => d.state)).toEqual(['done', 'todo', 'todo']);
    });

    test('a done challenge stays done even if it is the next one', () => {
        const progress = progressWith(['a1-1']);
        const lessonStatus = statusesOf(progress)[0].lessons.find((l) => l.lesson.id === 'a-l1');
        expect(lessonDots(lessonStatus, 'a1-1')[0].state).toBe(DOT_STATES.DONE);
    });
});
