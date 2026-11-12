import { defineCourse, defineLesson, findCourse } from '../../../../src/lib/lessons/courses';
import {
    COMPLETED_ACTIONS,
    LESSON_PROGRESS_STORAGE_KEY,
    completedAction,
    courseProgress,
    emptyProgress,
    exportProgress,
    isChallengeCompleted,
    lessonProgress,
    lessonsLibraryFocus,
    loadProgress,
    markChallengeCompleted,
    mergeProgress,
    saveProgress,
} from '../../../../src/lib/lessons/lesson-progress';

const makeStorage = (initial = {}) => {
    const data = { ...initial };
    return {
        getItem: (key) => (key in data ? data[key] : null),
        setItem: (key, value) => {
            data[key] = String(value);
        },
        data,
    };
};

const throwingStorage = {
    getItem: () => {
        throw new Error('SecurityError');
    },
    setItem: () => {
        throw new Error('QuotaExceededError');
    },
};

const NOW = '2026-11-10T01:02:03.000Z';
const LATER = '2026-11-11T00:00:00.000Z';

const course = findCourse('kyou-kara-programmer');
const [lesson1, lesson2, lesson3] = course.lessons;
// コースの中の通し番号（1〜11）でチャレンジ id を引く（Issue の仕様の番号）
const ALL_CHALLENGES = course.lessons.flatMap((lesson) => lesson.challenges);
const challengeId = (n) => ALL_CHALLENGES[n - 1].id;

const completeAll = (numbers) =>
    numbers.reduce((progress, n) => markChallengeCompleted(progress, challengeId(n), NOW), emptyProgress());

// 11 のチャレンジが 1 つのレッスン（blocks-l1）だったころに書いた記録（#1529 より前）
const oldStorage = (numbers) =>
    makeStorage({
        [LESSON_PROGRESS_STORAGE_KEY]: JSON.stringify({
            version: 1,
            challenges: Object.fromEntries(
                numbers.map((n) => [
                    challengeId(n),
                    { completedAt: NOW, courseId: 'kyou-kara-programmer', lessonId: 'blocks-l1' },
                ]),
            ),
        }),
    });

describe('lesson progress', () => {
    describe('markChallengeCompleted / isChallengeCompleted', () => {
        test('records the time together with the course and lesson', () => {
            const progress = markChallengeCompleted(emptyProgress(), 'blocks-l1-broadcast', NOW);
            expect(progress.challenges['blocks-l1-broadcast']).toEqual({
                completedAt: NOW,
                courseId: 'kyou-kara-programmer',
                lessonId: 'blocks-l3',
            });
            expect(isChallengeCompleted(progress, 'blocks-l1-broadcast')).toBe(true);
            expect(isChallengeCompleted(progress, 'blocks-l1-quiz')).toBe(false);
        });

        test('keeps the first completion time when completed again', () => {
            const first = markChallengeCompleted(emptyProgress(), 'blocks-l1-quiz', NOW);
            const second = markChallengeCompleted(first, 'blocks-l1-quiz', LATER);
            expect(second.challenges['blocks-l1-quiz'].completedAt).toBe(NOW);
            expect(second).toBe(first);
        });

        test('does not mutate the given progress', () => {
            const before = emptyProgress();
            markChallengeCompleted(before, 'blocks-l1-quiz', NOW);
            expect(before.challenges).toEqual({});
        });

        test('ignores unknown challenge ids', () => {
            const before = emptyProgress();
            expect(markChallengeCompleted(before, 'no-such-challenge', NOW)).toBe(before);
        });
    });

    describe('mergeProgress', () => {
        test('adds records only the other side has and keeps the earlier time', () => {
            const mine = markChallengeCompleted(emptyProgress(), 'blocks-l1-quiz', LATER);
            let other = markChallengeCompleted(emptyProgress(), 'blocks-l1-quiz', NOW);
            other = markChallengeCompleted(other, 'blocks-l1-count', LATER);
            const merged = mergeProgress(mine, other);
            expect(merged.challenges['blocks-l1-quiz'].completedAt).toBe(NOW);
            expect(merged.challenges['blocks-l1-count'].completedAt).toBe(LATER);
            expect(mine.challenges['blocks-l1-quiz'].completedAt).toBe(LATER);
        });

        test('returns the same object when the other side adds nothing', () => {
            const mine = markChallengeCompleted(emptyProgress(), 'blocks-l1-quiz', NOW);
            const other = markChallengeCompleted(emptyProgress(), 'blocks-l1-quiz', LATER);
            expect(mergeProgress(mine, other)).toBe(mine);
            expect(mergeProgress(mine, emptyProgress())).toBe(mine);
        });
    });

    describe('lessonProgress', () => {
        test('counts the challenges done in the lesson', () => {
            expect(lessonProgress(lesson1, emptyProgress())).toEqual({
                completedCount: 0,
                total: 4,
                allCompleted: false,
            });
            expect(lessonProgress(lesson1, completeAll([1, 3, 5]))).toEqual({
                completedCount: 2,
                total: 4,
                allCompleted: false,
            });
        });

        test('is all completed when every challenge of the lesson is done', () => {
            expect(lessonProgress(lesson2, completeAll([5, 6, 7])).allCompleted).toBe(true);
            expect(lessonProgress(lesson3, completeAll([5, 6, 7])).allCompleted).toBe(false);
        });

        test('counts only challenges of the lesson', () => {
            const progress = completeAll([1, 2]);
            progress.challenges['other-lesson-challenge'] = { completedAt: NOW, courseId: 'x', lessonId: 'other' };
            expect(lessonProgress(lesson1, progress).completedCount).toBe(2);
        });

        test('a lesson with no challenges is not all completed', () => {
            expect(lessonProgress({ id: 'empty', challenges: [] }, emptyProgress()).allCompleted).toBe(false);
        });
    });

    describe('courseProgress', () => {
        test('gives the course total and each lesson with its challenges', () => {
            const status = courseProgress(course, completeAll([1, 2, 3, 4, 8]));
            expect(status).toEqual(expect.objectContaining({ completedCount: 5, total: 11, allCompleted: false }));
            expect(
                status.lessons.map((l) => [l.lesson.id, l.number, l.completedCount, l.total, l.allCompleted]),
            ).toEqual([
                ['blocks-l1', 1, 4, 4, true],
                ['blocks-l2', 2, 0, 3, false],
                ['blocks-l3', 3, 1, 4, false],
            ]);
            expect(status.lessons[2].challenges.map((c) => [c.challenge.id, c.completed])).toEqual([
                ['blocks-l1-count', true],
                ['blocks-l1-broadcast', false],
                ['blocks-l1-speak', false],
                ['blocks-l1-message-list', false],
            ]);
        });

        test('the course is all completed only when every challenge of the course is done', () => {
            expect(courseProgress(course, completeAll([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])).allCompleted).toBe(false);
            expect(courseProgress(course, completeAll([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11])).allCompleted).toBe(true);
        });

        test('a course with no lessons is not all completed', () => {
            const empty = defineCourse({ id: 'empty', language: 'ruby', lessons: [] });
            expect(courseProgress(empty, emptyProgress())).toEqual({
                completedCount: 0,
                total: 0,
                allCompleted: false,
                lessons: [],
            });
        });
    });

    describe('old records (one lesson of 11 challenges, before #1529)', () => {
        test('loads them with the lesson of the current definition', () => {
            const progress = loadProgress(oldStorage([1, 6, 11]));
            expect(progress.challenges[challengeId(1)].lessonId).toBe('blocks-l1');
            expect(progress.challenges[challengeId(6)].lessonId).toBe('blocks-l2');
            expect(progress.challenges[challengeId(11)].lessonId).toBe('blocks-l3');
            expect(progress.challenges[challengeId(6)].completedAt).toBe(NOW);
        });

        test('shows the right progress for each of the 3 lessons', () => {
            const progress = loadProgress(oldStorage([1, 2, 3, 4, 5, 8, 9]));
            expect(courseProgress(course, progress).lessons.map((l) => [l.completedCount, l.total])).toEqual([
                [4, 4],
                [1, 3],
                [2, 4],
            ]);
            expect(completedAction(challengeId(4), progress)).toBe(COMPLETED_ACTIONS.OTHER_LESSONS);
        });

        test('reads a record that has only the completion time', () => {
            const storage = makeStorage({
                [LESSON_PROGRESS_STORAGE_KEY]: JSON.stringify({
                    challenges: { 'blocks-l1-quiz': { completedAt: NOW } },
                }),
            });
            expect(loadProgress(storage).challenges['blocks-l1-quiz']).toEqual({
                completedAt: NOW,
                courseId: 'kyou-kara-programmer',
                lessonId: 'blocks-l2',
            });
        });

        test('exports the lesson of the current definition', () => {
            expect(exportProgress(loadProgress(oldStorage([7]))).map((row) => row.lessonId)).toEqual(['blocks-l2']);
        });

        test('keeps a record of a challenge it does not know as it is', () => {
            const unknown = { completedAt: NOW, courseId: 'future-course', lessonId: 'future-lesson' };
            const storage = makeStorage({
                [LESSON_PROGRESS_STORAGE_KEY]: JSON.stringify({ challenges: { 'future-challenge': unknown } }),
            });
            expect(loadProgress(storage).challenges['future-challenge']).toEqual(unknown);
        });
    });

    describe('exportProgress', () => {
        test('flattens records so they can be sent to a class later', () => {
            let progress = markChallengeCompleted(emptyProgress(), 'blocks-l1-quiz', LATER);
            progress = markChallengeCompleted(progress, 'blocks-l1-broadcast', NOW);
            expect(exportProgress(progress)).toEqual([
                {
                    challengeId: 'blocks-l1-broadcast',
                    courseId: 'kyou-kara-programmer',
                    lessonId: 'blocks-l3',
                    completedAt: NOW,
                },
                {
                    challengeId: 'blocks-l1-quiz',
                    courseId: 'kyou-kara-programmer',
                    lessonId: 'blocks-l2',
                    completedAt: LATER,
                },
            ]);
        });
    });

    describe('storage', () => {
        test('round-trips through storage', () => {
            const storage = makeStorage();
            const progress = markChallengeCompleted(emptyProgress(), 'blocks-l1-quiz', NOW);
            saveProgress(progress, storage);
            expect(JSON.parse(storage.data[LESSON_PROGRESS_STORAGE_KEY]).version).toBe(1);
            expect(loadProgress(storage)).toEqual(progress);
        });

        test('loads empty progress when nothing is stored', () => {
            expect(loadProgress(makeStorage())).toEqual(emptyProgress());
        });

        test('loads empty progress when the stored value is broken', () => {
            expect(loadProgress(makeStorage({ [LESSON_PROGRESS_STORAGE_KEY]: '{oops' }))).toEqual(emptyProgress());
            expect(loadProgress(makeStorage({ [LESSON_PROGRESS_STORAGE_KEY]: '[1,2]' }))).toEqual(emptyProgress());
            expect(
                loadProgress(makeStorage({ [LESSON_PROGRESS_STORAGE_KEY]: '{"challenges":{"a":3,"b":{}}}' })),
            ).toEqual(emptyProgress());
            // 知らないチャレンジは、コースとレッスンも書いてあるものだけを記録とみなす
            expect(
                loadProgress(
                    makeStorage({ [LESSON_PROGRESS_STORAGE_KEY]: `{"challenges":{"a":{"completedAt":"${NOW}"}}}` }),
                ),
            ).toEqual(emptyProgress());
            expect(
                loadProgress(
                    makeStorage({
                        [LESSON_PROGRESS_STORAGE_KEY]: '{"challenges":{"blocks-l1-quiz":{"completedAt":1}}}',
                    }),
                ),
            ).toEqual(emptyProgress());
        });

        test('does not throw when storage throws', () => {
            expect(loadProgress(throwingStorage)).toEqual(emptyProgress());
            expect(() => saveProgress(emptyProgress(), throwingStorage)).not.toThrow();
            expect(saveProgress(emptyProgress(), throwingStorage)).toBe(false);
        });

        test('does not throw when storage is missing', () => {
            expect(loadProgress(null)).toEqual(emptyProgress());
            expect(saveProgress(emptyProgress(), null)).toBe(false);
        });
    });
});

const twoLessonCourses = () => [
    defineCourse({
        id: 'c',
        language: 'blocks',
        lessons: [
            defineLesson({ id: 'l1', challenges: [{ id: 'a' }, { id: 'b' }] }),
            defineLesson({ id: 'l2', challenges: [{ id: 'c1' }, { id: 'c2' }] }),
        ],
    }),
];

const record = (lessonId) => ({ completedAt: NOW, courseId: 'c', lessonId });

describe('completedAction', () => {
    const done = (...numbers) => completeAll(numbers);

    test('is "next" while the lesson has challenges not done, even on the last challenge', () => {
        expect(completedAction(challengeId(3), done(3))).toBe(COMPLETED_ACTIONS.NEXT);
        // Skipped to the last challenge of lesson 1: the lesson is not over yet
        expect(completedAction(challengeId(4), done(4))).toBe(COMPLETED_ACTIONS.NEXT);
    });

    test('is "otherLessons" when every challenge of lesson 1 or 2 is done (the course has a next lesson)', () => {
        expect(completedAction(challengeId(4), done(1, 2, 3, 4))).toBe(COMPLETED_ACTIONS.OTHER_LESSONS);
        // Not only on the last challenge in the order
        expect(completedAction(challengeId(2), done(1, 2, 3, 4))).toBe(COMPLETED_ACTIONS.OTHER_LESSONS);
        expect(completedAction(challengeId(7), done(5, 6, 7))).toBe(COMPLETED_ACTIONS.OTHER_LESSONS);
    });

    test('is "library" when every challenge of the last lesson is done', () => {
        expect(completedAction(challengeId(11), done(8, 9, 10, 11))).toBe(COMPLETED_ACTIONS.LIBRARY);
        expect(completedAction(challengeId(9), done(1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11))).toBe(
            COMPLETED_ACTIONS.LIBRARY,
        );
    });

    test('skips a next lesson that is already all done', () => {
        // Lesson 2 is all done already: "other lessons" goes on to lesson 3
        expect(completedAction(challengeId(4), done(1, 2, 3, 4, 5, 6, 7))).toBe(COMPLETED_ACTIONS.OTHER_LESSONS);
        // Lessons 2 and 3 are all done already: nothing is left after lesson 1
        expect(completedAction(challengeId(1), done(1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11))).toBe(
            COMPLETED_ACTIONS.LIBRARY,
        );
    });

    test('is "otherLessons" with a test course too', () => {
        const progress = { version: 1, challenges: { a: record('l1'), b: record('l1') } };
        expect(completedAction('a', progress, twoLessonCourses())).toBe(COMPLETED_ACTIONS.OTHER_LESSONS);
        expect(completedAction('c1', progress, twoLessonCourses())).toBe(COMPLETED_ACTIONS.NEXT);
    });

    test('is "next" for an unknown challenge', () => {
        expect(completedAction('no-such-challenge', emptyProgress())).toBe(COMPLETED_ACTIONS.NEXT);
    });
});

describe('lessonsLibraryFocus', () => {
    const done = (...numbers) => completeAll(numbers);

    test('focuses the current lesson and the next challenge after the current one', () => {
        expect(lessonsLibraryFocus(challengeId(3), done(3))).toEqual({
            language: 'blocks',
            courseId: 'kyou-kara-programmer',
            lessonId: 'blocks-l1',
            nextChallengeId: challengeId(4),
        });
    });

    test('skips challenges that are already done', () => {
        expect(lessonsLibraryFocus(challengeId(8), done(8, 9)).nextChallengeId).toBe(challengeId(10));
    });

    test('wraps around to the first challenges not done yet in the lesson', () => {
        expect(lessonsLibraryFocus(challengeId(10), done(10, 11, 8)).nextChallengeId).toBe(challengeId(9));
    });

    test('when lesson 1 is all done, moves to the first challenge not done of lesson 2', () => {
        expect(lessonsLibraryFocus(challengeId(4), done(1, 2, 3, 4, 5))).toEqual({
            language: 'blocks',
            courseId: 'kyou-kara-programmer',
            lessonId: 'blocks-l2',
            nextChallengeId: challengeId(6),
        });
    });

    test('when lesson 2 is all done, moves to lesson 3', () => {
        expect(lessonsLibraryFocus(challengeId(7), done(5, 6, 7))).toEqual(
            expect.objectContaining({ lessonId: 'blocks-l3', nextChallengeId: challengeId(8) }),
        );
    });

    test('skips a next lesson that is already all done', () => {
        expect(lessonsLibraryFocus(challengeId(4), done(1, 2, 3, 4, 5, 6, 7, 9))).toEqual(
            expect.objectContaining({ lessonId: 'blocks-l3', nextChallengeId: challengeId(8) }),
        );
    });

    test('when the whole course is done, stays in the lesson without a mark', () => {
        const focus = lessonsLibraryFocus(challengeId(2), done(1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11));
        expect(focus.lessonId).toBe('blocks-l1');
        expect(focus.nextChallengeId).toBeNull();
    });

    test('on the last lesson all done, stays there without a mark', () => {
        const focus = lessonsLibraryFocus(challengeId(11), done(8, 9, 10, 11));
        expect(focus.lessonId).toBe('blocks-l3');
        expect(focus.nextChallengeId).toBeNull();
    });

    test('never picks the current challenge', () => {
        expect(lessonsLibraryFocus(challengeId(5), emptyProgress()).nextChallengeId).toBe(challengeId(6));
    });

    test('when the lesson is all done, moves to the next lesson of the course when there is one', () => {
        const courses = twoLessonCourses();
        const progress = {
            version: 1,
            challenges: { a: record('l1'), b: record('l1'), c1: record('l2') },
        };
        expect(lessonsLibraryFocus('a', progress, courses)).toEqual({
            language: 'blocks',
            courseId: 'c',
            lessonId: 'l2',
            nextChallengeId: 'c2',
        });
    });

    test('stays in the lesson while it has challenges not done, even on the last challenge', () => {
        const courses = twoLessonCourses();
        const progress = { version: 1, challenges: { b: record('l1') } };
        expect(lessonsLibraryFocus('b', progress, courses)).toEqual({
            language: 'blocks',
            courseId: 'c',
            lessonId: 'l1',
            nextChallengeId: 'a',
        });
    });

    test('is null for an unknown challenge', () => {
        expect(lessonsLibraryFocus('no-such-challenge', emptyProgress())).toBeNull();
    });
});
