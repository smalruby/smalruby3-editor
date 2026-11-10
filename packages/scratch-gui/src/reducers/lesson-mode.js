// いま開いているチャレンジ（レッスンモード）と、端末の記録。
// 記録の正は localStorage（lib/lessons/lesson-progress.js）で、ここはその写し。
import { findChallenge } from '../lib/lessons/courses';
import {
    loadProgress,
    markChallengeCompleted as markProgress,
    mergeProgress,
    saveProgress,
} from '../lib/lessons/lesson-progress';

const OPEN_CHALLENGE = 'scratch-gui/lesson-mode/OPEN_CHALLENGE';
const CLOSE_LESSON = 'scratch-gui/lesson-mode/CLOSE_LESSON';
const MARK_CHALLENGE_COMPLETED = 'scratch-gui/lesson-mode/MARK_CHALLENGE_COMPLETED';
const RELOAD_PROGRESS = 'scratch-gui/lesson-mode/RELOAD_PROGRESS';
const DISMISS_COMPLETED = 'scratch-gui/lesson-mode/DISMISS_COMPLETED';

const closedState = {
    courseId: null,
    lessonId: null,
    challengeId: null,
    // 「できた！」を出しているチャレンジ id（閉じる・別のチャレンジを開くと null）
    justCompletedId: null,
};

const initialState = {
    ...closedState,
    progress: loadProgress(),
};

const reducer = function (state, action) {
    if (typeof state === 'undefined') state = initialState;
    switch (action.type) {
        case OPEN_CHALLENGE: {
            const found = findChallenge(action.challengeId);
            if (!found) return state;
            return {
                ...state,
                courseId: found.course.id,
                lessonId: found.lesson.id,
                challengeId: found.challenge.id,
                justCompletedId: null,
            };
        }
        case CLOSE_LESSON:
            return { ...state, ...closedState };
        case MARK_CHALLENGE_COMPLETED: {
            // 別のタブが起動後に書いた分を消さないよう、localStorage の最新と合わせてから足す
            const latest = mergeProgress(state.progress, loadProgress());
            const progress = markProgress(latest, action.challengeId, action.completedAt);
            if (progress !== state.progress) saveProgress(progress);
            // もう一度できたときも「できた！」は出す（記録は最初の日時のまま）
            const justCompletedId = findChallenge(action.challengeId) ? action.challengeId : state.justCompletedId;
            if (progress === state.progress && justCompletedId === state.justCompletedId) return state;
            return { ...state, progress, justCompletedId };
        }
        case DISMISS_COMPLETED:
            return state.justCompletedId === null ? state : { ...state, justCompletedId: null };
        case RELOAD_PROGRESS: {
            // 別のタブが書いた分を写しに取り込む（レッスン表を開くときなど）。localStorage は書かない
            const progress = mergeProgress(state.progress, loadProgress());
            return progress === state.progress ? state : { ...state, progress };
        }
        default:
            return state;
    }
};

const openChallenge = (challengeId) => ({ type: OPEN_CHALLENGE, challengeId });

const closeLesson = () => ({ type: CLOSE_LESSON });

const markChallengeCompleted = (challengeId, completedAt = new Date().toISOString()) => ({
    type: MARK_CHALLENGE_COMPLETED,
    challengeId,
    completedAt,
});

const reloadProgress = () => ({ type: RELOAD_PROGRESS });

const dismissCompleted = () => ({ type: DISMISS_COMPLETED });

const isLessonMode = (state) => state.scratchGui.lessonMode.challengeId !== null;

/**
 * @param {object} state - Redux の state。
 * @returns {?{course: object, lesson: object, challenge: object}} いま開いているチャレンジ。
 */
const getCurrentChallenge = (state) => {
    const { challengeId } = state.scratchGui.lessonMode;
    return challengeId === null ? null : findChallenge(challengeId);
};

export {
    reducer as default,
    initialState as lessonModeInitialState,
    openChallenge,
    closeLesson,
    markChallengeCompleted,
    reloadProgress,
    dismissCompleted,
    isLessonMode,
    getCurrentChallenge,
};
