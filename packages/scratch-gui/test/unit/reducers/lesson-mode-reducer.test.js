import {
    LESSON_PROGRESS_STORAGE_KEY,
    emptyProgress,
    markChallengeCompleted as markProgress,
    saveProgress,
} from '../../../src/lib/lessons/lesson-progress';
import reducer, {
    closeLesson,
    getCurrentChallenge,
    isLessonMode,
    lessonModeInitialState,
    markChallengeCompleted,
    openChallenge,
    reloadProgress,
    startChallenge,
    cancelStartChallenge,
    showHint,
    hideHint,
    nextHint,
    prevHint,
    getLessonAllowedBlocks,
    getCurrentHint,
} from '../../../src/reducers/lesson-mode';

const wrap = (lessonMode) => ({ scratchGui: { lessonMode } });

describe('lesson-mode reducer', () => {
    beforeEach(() => {
        window.localStorage.clear();
    });

    test('starts outside lesson mode', () => {
        expect(lessonModeInitialState.challengeId).toBeNull();
        expect(isLessonMode(wrap(lessonModeInitialState))).toBe(false);
        expect(getCurrentChallenge(wrap(lessonModeInitialState))).toBeNull();
    });

    test('openChallenge enters lesson mode with the course and lesson', () => {
        const state = reducer(lessonModeInitialState, openChallenge('blocks-l1-quiz'));
        expect(state).toEqual(
            expect.objectContaining({
                courseId: 'kyou-kara-programmer',
                lessonId: 'blocks-l1',
                challengeId: 'blocks-l1-quiz',
            }),
        );
        expect(isLessonMode(wrap(state))).toBe(true);
        expect(getCurrentChallenge(wrap(state)).challenge.number).toBe(7);
    });

    test('openChallenge ignores unknown ids', () => {
        const state = reducer(lessonModeInitialState, openChallenge('no-such-challenge'));
        expect(state).toBe(lessonModeInitialState);
    });

    test('closeLesson leaves lesson mode but keeps the progress', () => {
        let state = reducer(lessonModeInitialState, openChallenge('blocks-l1-quiz'));
        state = reducer(state, markChallengeCompleted('blocks-l1-quiz', '2026-11-10T00:00:00.000Z'));
        state = reducer(state, closeLesson());
        expect(isLessonMode(wrap(state))).toBe(false);
        expect(state.courseId).toBeNull();
        expect(state.progress.challenges['blocks-l1-quiz']).toBeTruthy();
    });

    test('markChallengeCompleted updates the progress and writes it to localStorage', () => {
        const state = reducer(
            lessonModeInitialState,
            markChallengeCompleted('blocks-l1-broadcast', '2026-11-10T00:00:00.000Z'),
        );
        expect(state.progress.challenges['blocks-l1-broadcast'].completedAt).toBe('2026-11-10T00:00:00.000Z');
        const saved = JSON.parse(window.localStorage.getItem(LESSON_PROGRESS_STORAGE_KEY));
        expect(saved.challenges['blocks-l1-broadcast'].lessonId).toBe('blocks-l1');
    });

    test('markChallengeCompleted keeps records another tab wrote after start-up', () => {
        // 別のタブが起動後に書いた記録
        saveProgress(markProgress(emptyProgress(), 'blocks-l1-quiz', '2026-11-10T00:00:00.000Z'));
        const state = reducer(
            lessonModeInitialState,
            markChallengeCompleted('blocks-l1-broadcast', '2026-11-10T01:00:00.000Z'),
        );
        expect(Object.keys(state.progress.challenges).sort()).toEqual(['blocks-l1-broadcast', 'blocks-l1-quiz']);
        const saved = JSON.parse(window.localStorage.getItem(LESSON_PROGRESS_STORAGE_KEY));
        expect(Object.keys(saved.challenges).sort()).toEqual(['blocks-l1-broadcast', 'blocks-l1-quiz']);
    });

    test('reloadProgress takes in records another tab wrote without writing back', () => {
        const state = reducer(
            lessonModeInitialState,
            markChallengeCompleted('blocks-l1-broadcast', '2026-11-10T00:00:00.000Z'),
        );
        // 別のタブが書いた記録（こちらの分は含まない）
        saveProgress(markProgress(emptyProgress(), 'blocks-l1-quiz', '2026-11-10T01:00:00.000Z'));
        const reloaded = reducer(state, reloadProgress());
        expect(Object.keys(reloaded.progress.challenges).sort()).toEqual(['blocks-l1-broadcast', 'blocks-l1-quiz']);
        const saved = JSON.parse(window.localStorage.getItem(LESSON_PROGRESS_STORAGE_KEY));
        expect(Object.keys(saved.challenges)).toEqual(['blocks-l1-quiz']);
        // 変わらなければ同じ state
        expect(reducer(reloaded, reloadProgress())).toBe(reloaded);
    });

    test('markChallengeCompleted fills the time when not given', () => {
        const action = markChallengeCompleted('blocks-l1-broadcast');
        expect(Number.isNaN(Date.parse(action.completedAt))).toBe(false);
    });
});

describe('lesson-mode reducer: starting a challenge', () => {
    test('startChallenge records the challenge to open without entering lesson mode yet', () => {
        const state = reducer(lessonModeInitialState, startChallenge('blocks-l1-click-say'));
        expect(state.pendingChallengeId).toBe('blocks-l1-click-say');
        expect(isLessonMode(wrap(state))).toBe(false);
    });

    test('startChallenge ignores unknown ids', () => {
        expect(reducer(lessonModeInitialState, startChallenge('no-such-challenge'))).toBe(lessonModeInitialState);
    });

    test('cancelStartChallenge clears the pending challenge', () => {
        let state = reducer(lessonModeInitialState, startChallenge('blocks-l1-click-say'));
        state = reducer(state, cancelStartChallenge());
        expect(state.pendingChallengeId).toBeNull();
        // 何も待っていなければ同じ state
        expect(reducer(state, cancelStartChallenge())).toBe(state);
    });

    test('openChallenge clears the pending challenge and enters lesson mode', () => {
        let state = reducer(lessonModeInitialState, startChallenge('blocks-l1-click-say'));
        state = reducer(state, openChallenge('blocks-l1-click-say'));
        expect(state.pendingChallengeId).toBeNull();
        expect(state.challengeId).toBe('blocks-l1-click-say');
    });

    test('closeLesson also drops a pending challenge', () => {
        let state = reducer(lessonModeInitialState, startChallenge('blocks-l1-click-say'));
        state = reducer(state, closeLesson());
        expect(state.pendingChallengeId).toBeNull();
    });
});

describe('lesson-mode reducer: allowed blocks', () => {
    test('getLessonAllowedBlocks is null outside lesson mode', () => {
        expect(getLessonAllowedBlocks(wrap(lessonModeInitialState))).toBeNull();
    });

    test('getLessonAllowedBlocks returns the challenge allowedBlocks with a stable reference', () => {
        const state = reducer(lessonModeInitialState, openChallenge('blocks-l1-click-say'));
        const allowed = getLessonAllowedBlocks(wrap(state));
        expect(allowed.event).toEqual(['event_whenthisspriteclicked']);
        expect(getLessonAllowedBlocks(wrap(state))).toBe(allowed);
    });

    test('getLessonAllowedBlocks is null for a challenge that does not restrict the palette', () => {
        const state = reducer(lessonModeInitialState, openChallenge('blocks-l1-quiz'));
        expect(getLessonAllowedBlocks(wrap(state))).toBeNull();
    });
});

describe('lesson-mode reducer: hints', () => {
    // ヒントが 3 つあるチャレンジに見せかける
    const withSteps = (state) => ({ ...state, challengeId: 'blocks-l1-click-say' });
    let findChallengeSpy;

    beforeEach(() => {
        const courses = require('../../../src/lib/lessons/courses');
        const real = courses.findChallenge;
        findChallengeSpy = jest.spyOn(courses, 'findChallenge').mockImplementation((id) => {
            const found = real(id);
            if (!found) return found;
            return {
                ...found,
                challenge: { ...found.challenge, steps: [{ title: 'a' }, { title: 'b' }, { title: 'c' }] },
            };
        });
    });

    afterEach(() => {
        findChallengeSpy.mockRestore();
    });

    test('getCurrentHint is null outside lesson mode', () => {
        expect(getCurrentHint(wrap(lessonModeInitialState))).toBeNull();
    });

    test('opening a challenge starts with the hint hidden at the first step', () => {
        const state = withSteps(reducer(lessonModeInitialState, openChallenge('blocks-l1-click-say')));
        expect(getCurrentHint(wrap(state))).toEqual({ visible: false, index: 0, count: 3, step: { title: 'a' } });
    });

    test('showHint / hideHint toggle the balloon', () => {
        let state = withSteps(reducer(lessonModeInitialState, openChallenge('blocks-l1-click-say')));
        state = reducer(state, showHint());
        expect(getCurrentHint(wrap(state)).visible).toBe(true);
        state = reducer(state, hideHint());
        expect(getCurrentHint(wrap(state)).visible).toBe(false);
    });

    test('nextHint / prevHint move within the steps and stop at the ends', () => {
        let state = withSteps(reducer(lessonModeInitialState, openChallenge('blocks-l1-click-say')));
        expect(reducer(state, prevHint())).toBe(state);
        state = reducer(state, nextHint());
        state = reducer(state, nextHint());
        expect(getCurrentHint(wrap(state))).toEqual(expect.objectContaining({ index: 2, step: { title: 'c' } }));
        expect(reducer(state, nextHint())).toBe(state);
        state = reducer(state, prevHint());
        expect(getCurrentHint(wrap(state)).index).toBe(1);
    });

    test('opening another challenge resets the hint', () => {
        let state = withSteps(reducer(lessonModeInitialState, openChallenge('blocks-l1-click-say')));
        state = reducer(state, showHint());
        state = reducer(state, nextHint());
        state = reducer(state, openChallenge('blocks-l1-quiz'));
        expect(state.hintVisible).toBe(false);
        expect(state.hintIndex).toBe(0);
    });

    test('hint actions do nothing outside lesson mode', () => {
        expect(reducer(lessonModeInitialState, showHint())).toBe(lessonModeInitialState);
        expect(reducer(lessonModeInitialState, nextHint())).toBe(lessonModeInitialState);
        expect(reducer(lessonModeInitialState, prevHint())).toBe(lessonModeInitialState);
    });
});
