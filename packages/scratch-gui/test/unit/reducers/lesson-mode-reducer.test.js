import { LESSON_PROGRESS_STORAGE_KEY } from '../../../src/lib/lessons/lesson-progress';
import reducer, {
    closeLesson,
    getCurrentChallenge,
    isLessonMode,
    lessonModeInitialState,
    markChallengeCompleted,
    openChallenge,
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

    test('markChallengeCompleted fills the time when not given', () => {
        const action = markChallengeCompleted('blocks-l1-broadcast');
        expect(Number.isNaN(Date.parse(action.completedAt))).toBe(false);
    });
});
