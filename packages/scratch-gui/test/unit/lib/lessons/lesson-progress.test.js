import { findLesson } from '../../../../src/lib/lessons/courses';
import {
    LESSON_PROGRESS_STORAGE_KEY,
    completedSkills,
    emptyProgress,
    exportProgress,
    isChallengeCompleted,
    lessonClearStatus,
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

const lesson1 = findLesson('blocks-l1');
const lesson1Id = (n) => lesson1.challenges[n - 1].id;

const completeAll = (numbers) =>
    numbers.reduce((progress, n) => markChallengeCompleted(progress, lesson1Id(n), NOW), emptyProgress());

describe('lesson progress', () => {
    describe('markChallengeCompleted / isChallengeCompleted', () => {
        test('records the time together with the course and lesson', () => {
            const progress = markChallengeCompleted(emptyProgress(), 'blocks-l1-broadcast', NOW);
            expect(progress.challenges['blocks-l1-broadcast']).toEqual({
                completedAt: NOW,
                courseId: 'kyou-kara-programmer',
                lessonId: 'blocks-l1',
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

    describe('lessonClearStatus', () => {
        test('not cleared with nothing done', () => {
            const status = lessonClearStatus(lesson1, emptyProgress());
            expect(status.cleared).toBe(false);
            expect(status.completedCount).toBe(0);
            expect(status.count).toBe(7);
            expect(status.missingRequired.length).toBe(5);
        });

        test('cleared with 7 including all required', () => {
            const status = lessonClearStatus(lesson1, completeAll([1, 2, 3, 6, 8, 9, 11]));
            expect(status).toEqual(
                expect.objectContaining({ cleared: true, completedCount: 7, missingRequired: [] }),
            );
        });

        test('not cleared with 7 when a required one is missing', () => {
            const status = lessonClearStatus(lesson1, completeAll([1, 2, 3, 4, 5, 6, 8, 9]));
            expect(status.cleared).toBe(false);
            expect(status.completedCount).toBe(8);
            expect(status.missingRequired).toEqual([lesson1Id(11)]);
        });

        test('not cleared with all required but fewer than 7', () => {
            const status = lessonClearStatus(lesson1, completeAll([3, 6, 8, 9, 11, 1]));
            expect(status.cleared).toBe(false);
            expect(status.missingRequired).toEqual([]);
        });

        test('counts only challenges of the lesson', () => {
            const progress = completeAll([3, 6, 8, 9, 11, 1]);
            progress.challenges['other-lesson-challenge'] = { completedAt: NOW, lessonId: 'other' };
            expect(lessonClearStatus(lesson1, progress).completedCount).toBe(6);
        });
    });

    describe('completedSkills', () => {
        test('lists each skill of completed challenges once, in course order', () => {
            const lesson = {
                id: 'l',
                clear: { count: 1, required: [] },
                challenges: [
                    { id: 'a', skills: [{ id: 's1' }, { id: 's2' }] },
                    { id: 'b', skills: [{ id: 's2' }, { id: 's3' }] },
                    { id: 'c', skills: [{ id: 's4' }] },
                ],
            };
            const courses = [{ id: 'c', lessons: [lesson] }];
            const progress = { challenges: { a: { completedAt: NOW }, b: { completedAt: NOW } } };
            expect(completedSkills(progress, courses).map((s) => s.id)).toEqual(['s1', 's2', 's3']);
        });

        test('is empty with nothing done', () => {
            expect(completedSkills(emptyProgress())).toEqual([]);
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
                    lessonId: 'blocks-l1',
                    completedAt: NOW,
                },
                {
                    challengeId: 'blocks-l1-quiz',
                    courseId: 'kyou-kara-programmer',
                    lessonId: 'blocks-l1',
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
            expect(loadProgress(makeStorage({ [LESSON_PROGRESS_STORAGE_KEY]: '{oops' }))).toEqual(
                emptyProgress(),
            );
            expect(loadProgress(makeStorage({ [LESSON_PROGRESS_STORAGE_KEY]: '[1,2]' }))).toEqual(
                emptyProgress(),
            );
            expect(
                loadProgress(makeStorage({ [LESSON_PROGRESS_STORAGE_KEY]: '{"challenges":{"a":3,"b":{}}}' })),
            ).toEqual(emptyProgress());
            expect(
                loadProgress(
                    makeStorage({ [LESSON_PROGRESS_STORAGE_KEY]: `{"challenges":{"a":{"completedAt":"${NOW}"}}}` }),
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
