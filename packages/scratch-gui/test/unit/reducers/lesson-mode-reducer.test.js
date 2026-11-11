import {
    LESSON_PROGRESS_STORAGE_KEY,
    emptyProgress,
    markChallengeCompleted as markProgress,
    saveProgress,
} from '../../../src/lib/lessons/lesson-progress';
import { SPOTLIGHT_SEEN_STORAGE_KEY, markSpotlightSeen } from '../../../src/lib/lessons/spotlight-seen';
import { activateDeck } from '../../../src/reducers/cards';
import reducer, {
    clearLessonsLibraryFocus,
    closeLesson,
    dismissCompleted,
    focusLessonsLibrary,
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
    finishHint,
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
                lessonId: 'blocks-l2',
                challengeId: 'blocks-l1-quiz',
            }),
        );
        expect(isLessonMode(wrap(state))).toBe(true);
        expect(getCurrentChallenge(wrap(state)).challenge.number).toBe(3);
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
        expect(saved.challenges['blocks-l1-broadcast'].lessonId).toBe('blocks-l3');
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

    test('markChallengeCompleted shows "You did it!" for that challenge, even when already completed', () => {
        const opened = reducer(lessonModeInitialState, openChallenge('blocks-l1-quiz'));
        expect(opened.justCompletedId).toBeNull();
        const first = reducer(opened, markChallengeCompleted('blocks-l1-quiz', '2026-11-10T00:00:00.000Z'));
        expect(first.justCompletedId).toBe('blocks-l1-quiz');
        const dismissed = reducer(first, dismissCompleted());
        expect(dismissed.justCompletedId).toBeNull();
        expect(dismissed.progress).toBe(first.progress);
        expect(reducer(dismissed, dismissCompleted())).toBe(dismissed);
        // completed again: the record keeps the first time but the toast shows again
        const again = reducer(dismissed, markChallengeCompleted('blocks-l1-quiz', '2026-11-11T00:00:00.000Z'));
        expect(again.justCompletedId).toBe('blocks-l1-quiz');
        expect(again.progress.challenges['blocks-l1-quiz'].completedAt).toBe('2026-11-10T00:00:00.000Z');
        // unknown ids change nothing
        expect(reducer(dismissed, markChallengeCompleted('nope', '2026-11-11T00:00:00.000Z'))).toBe(dismissed);
    });

    test('opening another challenge or closing the lesson hides "You did it!"', () => {
        const done = reducer(
            reducer(lessonModeInitialState, openChallenge('blocks-l1-quiz')),
            markChallengeCompleted('blocks-l1-quiz', '2026-11-10T00:00:00.000Z'),
        );
        expect(reducer(done, openChallenge('blocks-l1-count')).justCompletedId).toBeNull();
        expect(reducer(done, closeLesson()).justCompletedId).toBeNull();
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

    test('opening a tutorial deck leaves lesson mode and drops a pending challenge', () => {
        let state = reducer(lessonModeInitialState, openChallenge('blocks-l1-click-say'));
        state = reducer(state, startChallenge('blocks-l1-quiz'));
        state = reducer(state, activateDeck('chat-1-basic-1'));
        expect(isLessonMode(wrap(state))).toBe(false);
        expect(state.pendingChallengeId).toBeNull();
    });

    test('opening a tutorial deck outside lesson mode keeps the state as is', () => {
        const state = reducer(lessonModeInitialState, activateDeck('chat-1-basic-1'));
        expect(state).toBe(lessonModeInitialState);
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
        // レッスン 1 のチャレンジはどれもパレットを絞るので、絞らないチャレンジに見せかける
        const courses = require('../../../src/lib/lessons/courses');
        const real = courses.findChallenge;
        const spy = jest.spyOn(courses, 'findChallenge').mockImplementation((id) => {
            const found = real(id);
            return found && { ...found, challenge: { ...found.challenge, allowedBlocks: null } };
        });
        try {
            const state = reducer(lessonModeInitialState, openChallenge('blocks-l1-quiz'));
            expect(getLessonAllowedBlocks(wrap(state))).toBeNull();
        } finally {
            spy.mockRestore();
        }
    });
});

describe('lesson-mode reducer: hints', () => {
    // ヒントが 3 つあるチャレンジに見せかける（2 つめは spotlight。最後の手段は無し）
    const withSteps = (state) => ({ ...state, challengeId: 'blocks-l1-click-say' });
    const STEPS = [
        { title: 'a', spotlight: false },
        { title: 'b', spotlight: true },
        { title: 'c', spotlight: false },
    ];
    let findChallengeSpy;
    let extra = {};

    beforeEach(() => {
        window.localStorage.clear();
        extra = {};
        const courses = require('../../../src/lib/lessons/courses');
        const real = courses.findChallenge;
        findChallengeSpy = jest.spyOn(courses, 'findChallenge').mockImplementation((id) => {
            const found = real(id);
            if (!found) return found;
            return {
                ...found,
                challenge: { ...found.challenge, steps: STEPS, debug: [], code: null, ...extra },
            };
        });
    });

    afterEach(() => {
        findChallengeSpy.mockRestore();
    });

    test('getCurrentHint is null outside lesson mode', () => {
        expect(getCurrentHint(wrap(lessonModeInitialState))).toBeNull();
    });

    test('opening a challenge opens the hint at the first step (no need to press the hint button)', () => {
        const state = withSteps(reducer(lessonModeInitialState, openChallenge('blocks-l1-click-say')));
        expect(getCurrentHint(wrap(state))).toEqual({
            visible: true,
            index: 0,
            count: 3,
            step: STEPS[0],
            spotlight: false,
            lastResort: false,
            debug: [],
            code: null,
            session: 1,
        });
    });

    test('each opening of a challenge (even the same one) is a new hint session', () => {
        let state = withSteps(reducer(lessonModeInitialState, openChallenge('blocks-l1-click-say')));
        const first = getCurrentHint(wrap(state)).session;
        state = reducer(state, openChallenge('blocks-l1-click-say'));
        expect(getCurrentHint(wrap(state)).session).toBe(first + 1);
        state = reducer(state, openChallenge('blocks-l1-quiz'));
        expect(getCurrentHint(wrap(withSteps(state))).session).toBe(first + 2);
    });

    test('the first time a challenge is opened, spotlight steps light up; the next time they do not', () => {
        let state = withSteps(reducer(lessonModeInitialState, openChallenge('blocks-l1-click-say')));
        expect(state.hintSpotlight).toBe(true);
        expect(getCurrentHint(wrap(state)).spotlight).toBe(false);
        state = reducer(state, nextHint());
        expect(getCurrentHint(wrap(state)).spotlight).toBe(true);
        // 開いた時点で「見た」と記録される
        expect(JSON.parse(window.localStorage.getItem(SPOTLIGHT_SEEN_STORAGE_KEY))).toHaveProperty(
            'blocks-l1-click-say',
        );

        state = reducer(state, closeLesson());
        expect(state.hintSpotlight).toBe(false);
        state = withSteps(reducer(state, openChallenge('blocks-l1-click-say')));
        state = reducer(state, nextHint());
        expect(state.hintSpotlight).toBe(false);
        expect(getCurrentHint(wrap(state)).spotlight).toBe(false);
    });

    test('a challenge seen on another day does not spotlight, but a new challenge does', () => {
        markSpotlightSeen('blocks-l1-click-say', window.localStorage, '2026-01-01T00:00:00.000Z');
        let state = reducer(lessonModeInitialState, openChallenge('blocks-l1-click-say'));
        expect(state.hintSpotlight).toBe(false);
        state = reducer(state, openChallenge('blocks-l1-quiz'));
        expect(state.hintSpotlight).toBe(true);
    });

    test('debug tips or code add a last-resort page after the steps', () => {
        extra = { debug: [{ id: 'd1' }], code: 'when_clicked do\nend\n' };
        let state = withSteps(reducer(lessonModeInitialState, openChallenge('blocks-l1-click-say')));
        expect(getCurrentHint(wrap(state)).count).toBe(4);
        state = reducer(state, nextHint());
        state = reducer(state, nextHint());
        expect(getCurrentHint(wrap(state)).lastResort).toBe(false);
        state = reducer(state, nextHint());
        expect(getCurrentHint(wrap(state))).toEqual(
            expect.objectContaining({
                index: 3,
                step: null,
                spotlight: false,
                lastResort: true,
                debug: [{ id: 'd1' }],
                code: 'when_clicked do\nend\n',
            }),
        );
        expect(reducer(state, nextHint())).toBe(state);

        extra = { debug: [], code: 'move(10)\n' };
        expect(getCurrentHint(wrap(state)).count).toBe(4);
        extra = { debug: [{ id: 'd1' }], code: null };
        expect(getCurrentHint(wrap(state)).count).toBe(4);
    });

    test('showHint works for a challenge with only a last-resort page', () => {
        extra = { steps: [], code: 'move(10)\n' };
        let state = reducer(lessonModeInitialState, openChallenge('blocks-l1-click-say'));
        state = reducer(state, showHint());
        expect(getCurrentHint(wrap(state))).toEqual(
            expect.objectContaining({ visible: true, index: 0, count: 1, step: null, lastResort: true }),
        );
    });

    test('a challenge without any hint page does not open the balloon', () => {
        extra = { steps: [], debug: [], code: null };
        const state = reducer(lessonModeInitialState, openChallenge('blocks-l1-click-say'));
        expect(state.hintVisible).toBe(false);
        expect(reducer(state, showHint())).toBe(state);
    });

    test('showHint / hideHint toggle the balloon', () => {
        let state = withSteps(reducer(lessonModeInitialState, openChallenge('blocks-l1-click-say')));
        state = reducer(state, hideHint());
        expect(getCurrentHint(wrap(state)).visible).toBe(false);
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
        expect(getCurrentHint(wrap(state))).toEqual(expect.objectContaining({ index: 2, step: STEPS[2] }));
        expect(reducer(state, nextHint())).toBe(state);
        state = reducer(state, prevHint());
        expect(getCurrentHint(wrap(state)).index).toBe(1);
    });

    test('opening another challenge resets the hint to its first page (opened)', () => {
        let state = withSteps(reducer(lessonModeInitialState, openChallenge('blocks-l1-click-say')));
        state = reducer(state, hideHint());
        state = reducer(state, nextHint());
        state = reducer(state, openChallenge('blocks-l1-quiz'));
        expect(state.hintVisible).toBe(true);
        expect(state.hintIndex).toBe(0);
    });

    test('closing with × keeps the page; reopening shows the same page', () => {
        let state = withSteps(reducer(lessonModeInitialState, openChallenge('blocks-l1-click-say')));
        state = reducer(state, nextHint());
        state = reducer(state, nextHint());
        state = reducer(state, hideHint());
        state = reducer(state, showHint());
        expect(getCurrentHint(wrap(state))).toEqual(expect.objectContaining({ visible: true, index: 2 }));
    });

    test('finishHint closes the balloon and the next open starts from the first page', () => {
        let state = withSteps(reducer(lessonModeInitialState, openChallenge('blocks-l1-click-say')));
        state = reducer(state, nextHint());
        state = reducer(state, nextHint());
        state = reducer(state, finishHint());
        expect(getCurrentHint(wrap(state))).toEqual(expect.objectContaining({ visible: false, index: 0 }));
        state = reducer(state, showHint());
        expect(getCurrentHint(wrap(state))).toEqual(expect.objectContaining({ visible: true, index: 0 }));
        expect(reducer(lessonModeInitialState, finishHint())).toBe(lessonModeInitialState);
        // すでに閉じていて 1 ページ目なら、何も変えない（同じ state を返す）
        const closed = reducer(state, hideHint());
        expect(reducer(closed, finishHint())).toBe(closed);
    });

    test('completing the open challenge closes the balloon and keeps its page', () => {
        let state = withSteps(reducer(lessonModeInitialState, openChallenge('blocks-l1-click-say')));
        state = reducer(state, nextHint());
        state = reducer(state, markChallengeCompleted('blocks-l1-click-say', '2026-11-10T00:00:00.000Z'));
        expect(state.justCompletedId).toBe('blocks-l1-click-say');
        expect(getCurrentHint(wrap(state))).toEqual(expect.objectContaining({ visible: false, index: 1 }));
        state = reducer(state, showHint());
        expect(getCurrentHint(wrap(state))).toEqual(expect.objectContaining({ visible: true, index: 1 }));
    });

    test('completing another challenge does not close the balloon', () => {
        let state = withSteps(reducer(lessonModeInitialState, openChallenge('blocks-l1-click-say')));
        state = reducer(state, markChallengeCompleted('blocks-l1-quiz', '2026-11-10T00:00:00.000Z'));
        expect(state.hintVisible).toBe(true);
    });

    test('hint actions do nothing outside lesson mode', () => {
        expect(reducer(lessonModeInitialState, showHint())).toBe(lessonModeInitialState);
        expect(reducer(lessonModeInitialState, nextHint())).toBe(lessonModeInitialState);
        expect(reducer(lessonModeInitialState, prevHint())).toBe(lessonModeInitialState);
    });
});

describe('lesson-mode reducer: lessons library focus', () => {
    const ID = 'blocks-l1-click-say';

    test('starts without a focus', () => {
        expect(lessonModeInitialState.libraryFocusChallengeId).toBeNull();
    });

    test('focusLessonsLibrary keeps the challenge, clearLessonsLibraryFocus removes it', () => {
        const focused = reducer(lessonModeInitialState, focusLessonsLibrary(ID));
        expect(focused.libraryFocusChallengeId).toBe(ID);
        expect(reducer(focused, focusLessonsLibrary(ID))).toBe(focused);
        const cleared = reducer(focused, clearLessonsLibraryFocus());
        expect(cleared.libraryFocusChallengeId).toBeNull();
        expect(reducer(cleared, clearLessonsLibraryFocus())).toBe(cleared);
    });

    test('ignores an unknown challenge', () => {
        expect(reducer(lessonModeInitialState, focusLessonsLibrary('no-such'))).toBe(lessonModeInitialState);
    });

    test('closing the lesson keeps the focus (the library clears it when it closes)', () => {
        const open = reducer(reducer(lessonModeInitialState, openChallenge(ID)), focusLessonsLibrary(ID));
        expect(reducer(open, closeLesson()).libraryFocusChallengeId).toBe(ID);
    });
});
