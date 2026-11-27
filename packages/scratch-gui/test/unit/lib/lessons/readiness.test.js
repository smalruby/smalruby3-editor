/**
 * じゅんびチェック（#2299）の記録と「おすすめ」の決め方。
 */
import { COURSES, courseReadinessCheck, findCourse } from '../../../../src/lib/lessons/courses';
import {
    READINESS_STORAGE_KEY,
    assignmentReviewChallenges,
    challengeOpenContext,
    reviewReturnTarget,
    emptyReadiness,
    loadReadiness,
    markReadinessChallengeCleared,
    markReadinessOffered,
    readinessOffer,
    readinessResult,
    recommendedChallengeIds,
    recommendedChallenges,
    recordReadinessAnswer,
    saveReadiness,
} from '../../../../src/lib/lessons/readiness';

const CHAT = 'chat-wo-tsukurou';
const chat = () => findCourse(CHAT);
const AT = '2026-11-21T10:00:00.000Z';
const LATER = '2026-11-21T11:00:00.000Z';

const memoryStorage = (initial = {}) => {
    const data = { ...initial };
    return {
        getItem: (key) => (key in data ? data[key] : null),
        setItem: (key, value) => {
            data[key] = String(value);
        },
        data,
    };
};

// 4 問に答えた記録（correct は baseChallengeId → boolean）
const answered = (correct) =>
    Object.entries(correct).reduce(
        (state, [id, ok]) => recordReadinessAnswer(state, CHAT, id, ok, AT),
        emptyReadiness(),
    );

describe('readiness storage', () => {
    test('loads an empty record when nothing or something broken is stored', () => {
        expect(loadReadiness(null)).toEqual(emptyReadiness());
        expect(loadReadiness(memoryStorage())).toEqual(emptyReadiness());
        expect(loadReadiness(memoryStorage({ [READINESS_STORAGE_KEY]: '{not json' }))).toEqual(emptyReadiness());
        expect(loadReadiness(memoryStorage({ [READINESS_STORAGE_KEY]: '[]' }))).toEqual(emptyReadiness());
    });

    test('saves and loads back, dropping answers of the wrong shape', () => {
        const storage = memoryStorage();
        const state = markReadinessOffered(answered({ 'blocks-l1-count': false }), CHAT, AT);
        expect(saveReadiness(state, storage)).toBe(true);
        expect(loadReadiness(storage)).toEqual(state);
        storage.setItem(
            READINESS_STORAGE_KEY,
            JSON.stringify({
                courses: { [CHAT]: { answers: { a: { correct: 'yes', answeredAt: AT }, b: { correct: true } } } },
                offered: { [CHAT]: 1 },
            }),
        );
        expect(loadReadiness(storage)).toEqual({ version: 1, courses: { [CHAT]: { answers: {} } }, offered: {} });
    });

    test('does not throw when the storage throws', () => {
        const broken = {
            getItem: () => {
                throw new Error('denied');
            },
            setItem: () => {
                throw new Error('full');
            },
        };
        expect(loadReadiness(broken)).toEqual(emptyReadiness());
        expect(saveReadiness(emptyReadiness(), broken)).toBe(false);
        expect(saveReadiness(emptyReadiness(), null)).toBe(false);
    });
});

describe('readiness result and recommended challenges', () => {
    test('all right on the first try is "じゅんび OK" with nothing recommended', () => {
        const state = answered({
            'blocks-l0-where': true,
            'blocks-l1-ask-answer': true,
            'blocks-l1-count': true,
            'blocks-l1-broadcast': true,
        });
        expect(readinessResult(chat(), state)).toEqual({
            total: 4,
            answeredCount: 4,
            correctIds: ['blocks-l0-where', 'blocks-l1-ask-answer', 'blocks-l1-count', 'blocks-l1-broadcast'],
            wrongIds: [],
            recommendedIds: [],
            allCorrect: true,
        });
        expect(recommendedChallenges(chat(), state)).toEqual([]);
    });

    test('a wrong answer recommends its challenge (found in the other course)', () => {
        const state = answered({
            'blocks-l0-where': true,
            'blocks-l1-ask-answer': false,
            'blocks-l1-count': true,
            'blocks-l1-broadcast': false,
        });
        const result = readinessResult(chat(), state);
        expect(result.allCorrect).toBe(false);
        expect(result.recommendedIds).toEqual(['blocks-l1-ask-answer', 'blocks-l1-broadcast']);
        const recommended = recommendedChallenges(chat(), state);
        expect(recommended.map((r) => [r.course.id, r.lesson.id, r.challenge.id])).toEqual([
            ['kyou-kara-programmer', 'blocks-l2', 'blocks-l1-ask-answer'],
            ['kyou-kara-programmer', 'blocks-l3', 'blocks-l1-broadcast'],
        ]);
        expect(recommendedChallengeIds(state)).toEqual(['blocks-l1-ask-answer', 'blocks-l1-broadcast']);
    });

    test('a part-answered check is not "じゅんび OK"', () => {
        const state = answered({ 'blocks-l0-where': true });
        expect(readinessResult(chat(), state)).toMatchObject({ answeredCount: 1, allCorrect: false });
        expect(readinessResult(chat(), emptyReadiness())).toMatchObject({ answeredCount: 0, allCorrect: false });
    });

    test('the mark goes away when the question is answered right later', () => {
        const wrong = answered({ 'blocks-l1-count': false });
        expect(recommendedChallengeIds(wrong)).toEqual(['blocks-l1-count']);
        const right = recordReadinessAnswer(wrong, CHAT, 'blocks-l1-count', true, LATER);
        expect(recommendedChallengeIds(right)).toEqual([]);
        // まちがえなおすと、また「おすすめ」
        expect(recommendedChallengeIds(recordReadinessAnswer(right, CHAT, 'blocks-l1-count', false, LATER))).toEqual([
            'blocks-l1-count',
        ]);
    });

    test('the mark goes away when the challenge is cleared', () => {
        const wrong = answered({ 'blocks-l1-count': false, 'blocks-l1-broadcast': true });
        const cleared = markReadinessChallengeCleared(wrong, 'blocks-l1-count', LATER);
        expect(recommendedChallengeIds(cleared)).toEqual([]);
        expect(cleared.courses[CHAT].answers['blocks-l1-count']).toEqual({
            correct: false,
            answeredAt: AT,
            clearedAt: LATER,
        });
        // 「まちがえた問い」としては残る（先生の表など）
        expect(readinessResult(chat(), cleared).wrongIds).toEqual(['blocks-l1-count']);
        // 変わらないときは同じオブジェクト
        expect(markReadinessChallengeCleared(cleared, 'blocks-l1-count', LATER)).toBe(cleared);
        expect(markReadinessChallengeCleared(cleared, 'blocks-l1-broadcast', LATER)).toBe(cleared);
        expect(markReadinessChallengeCleared(cleared, 'chat-l1-sequence', LATER)).toBe(cleared);
    });
});

describe('readinessOffer (「先にじゅんびチェックをする？」)', () => {
    test('asks on the first challenge of lesson 1 of a course with a check, once', () => {
        expect(readinessOffer({ challengeId: 'chat-l1-sequence', readiness: emptyReadiness() })).toEqual({
            courseId: CHAT,
            checkChallengeId: 'chat-l0-readiness',
        });
        const offered = markReadinessOffered(emptyReadiness(), CHAT, AT);
        expect(readinessOffer({ challengeId: 'chat-l1-sequence', readiness: offered })).toBeNull();
        expect(markReadinessOffered(offered, CHAT, LATER)).toBe(offered);
    });

    test('does not ask elsewhere or after an answer', () => {
        const none = emptyReadiness();
        expect(readinessOffer({ challengeId: 'chat-l1-repeat', readiness: none })).toBeNull();
        expect(readinessOffer({ challengeId: 'chat-l2-omikuji', readiness: none })).toBeNull();
        expect(readinessOffer({ challengeId: 'chat-l0-readiness', readiness: none })).toBeNull();
        // きょうからプログラマーにはじゅんびチェックが無い
        expect(readinessOffer({ challengeId: 'blocks-l1-key-sound', readiness: none })).toBeNull();
        expect(readinessOffer({ challengeId: 'nope', readiness: none })).toBeNull();
        expect(
            readinessOffer({ challengeId: 'chat-l1-sequence', readiness: answered({ 'blocks-l0-where': true }) }),
        ).toBeNull();
    });

    test('also asks when 1-1 is opened from a class assignment (the check is in the review section)', () => {
        expect(
            readinessOffer({ challengeId: 'chat-l1-sequence', readiness: emptyReadiness(), fromAssignment: true }),
        ).toEqual({ courseId: CHAT, checkChallengeId: 'chat-l0-readiness' });
    });
});

describe('assignmentReviewChallenges (「おさらい（課題の外）」)', () => {
    const lessonOf = (challengeIds, courseId = CHAT) => ({ courseId, challengeIds });
    const ids = (list) => list.map((found) => found.challenge.id);

    test('shows the check, then the recommended challenges, all outside the assignment', () => {
        const readiness = answered({
            'blocks-l0-where': true,
            'blocks-l1-count': false,
            'blocks-l1-broadcast': false,
        });
        expect(ids(assignmentReviewChallenges(lessonOf(['chat-l1-sequence']), readiness))).toEqual([
            'chat-l0-readiness',
            'blocks-l1-count',
            'blocks-l1-broadcast',
        ]);
    });

    test('keeps the check even when nothing is recommended, and leaves out challenges of the assignment', () => {
        expect(ids(assignmentReviewChallenges(lessonOf(['chat-l1-sequence']), emptyReadiness()))).toEqual([
            'chat-l0-readiness',
        ]);
        expect(ids(assignmentReviewChallenges(lessonOf(['chat-l1-sequence']), null))).toEqual(['chat-l0-readiness']);
        const readiness = answered({ 'blocks-l1-count': false });
        expect(
            ids(assignmentReviewChallenges(lessonOf(['chat-l0-readiness', 'blocks-l1-count']), readiness)),
        ).toEqual([]);
    });

    test('is empty without an assignment or for a course without a check', () => {
        expect(assignmentReviewChallenges(null, emptyReadiness())).toEqual([]);
        expect(assignmentReviewChallenges(lessonOf(['blocks-l1-key-sound'], 'nope'), emptyReadiness())).toEqual([]);
        const programmer = COURSES.find((course) => !courseReadinessCheck(course));
        expect(assignmentReviewChallenges(lessonOf(['x'], programmer.id), emptyReadiness())).toEqual([]);
    });
});

describe('challengeOpenContext', () => {
    const lesson = { courseId: CHAT, challengeIds: ['chat-l1-sequence'] };

    test('is from the assignment for an assignment challenge, a review for one outside it', () => {
        expect(challengeOpenContext(lesson, 'chat-l1-sequence', true)).toEqual({
            fromAssignment: true,
            fromReview: false,
        });
        expect(challengeOpenContext(lesson, 'chat-l0-readiness', true)).toEqual({
            fromAssignment: false,
            fromReview: true,
        });
    });

    test('is neither outside the assignment flow', () => {
        const neither = { fromAssignment: false, fromReview: false };
        expect(challengeOpenContext(lesson, 'chat-l1-sequence', false)).toEqual(neither);
        expect(challengeOpenContext(null, 'chat-l1-sequence', true)).toEqual(neither);
        expect(challengeOpenContext(lesson, null, true)).toEqual(neither);
    });
});

describe('reviewReturnTarget (「課題にもどる」)', () => {
    const lesson = { courseId: CHAT, challengeIds: ['chat-l1-sequence', 'chat-l1-repeat'] };
    const done = (id) => ({ challenges: { [id]: { completedAt: AT, courseId: CHAT, lessonId: 'chat-l1' } } });

    test('reopens the assignment challenge the student was on while it is not done', () => {
        expect(reviewReturnTarget(lesson, { challenges: {} }, 'chat-l1-repeat')).toEqual({
            challengeId: 'chat-l1-repeat',
        });
    });

    test('opens the assignment library otherwise', () => {
        expect(reviewReturnTarget(lesson, done('chat-l1-repeat'), 'chat-l1-repeat')).toEqual({
            libraryAfterId: 'chat-l1-repeat',
        });
        expect(reviewReturnTarget(lesson, { challenges: {} }, null)).toEqual({ libraryAfterId: null });
        // 先生が課題からはずしたチャレンジにはもどらない
        expect(reviewReturnTarget(lesson, { challenges: {} }, 'chat-l2-omikuji')).toEqual({ libraryAfterId: null });
    });
});
