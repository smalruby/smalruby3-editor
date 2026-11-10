// いま開いているチャレンジ（レッスンモード）と、端末の記録。
// 記録の正は localStorage（lib/lessons/lesson-progress.js）で、ここはその写し。
import { findChallenge } from '../lib/lessons/courses';
import { loadProgress, markChallengeCompleted as markProgress, saveProgress } from '../lib/lessons/lesson-progress';

const OPEN_CHALLENGE = 'scratch-gui/lesson-mode/OPEN_CHALLENGE';
const CLOSE_LESSON = 'scratch-gui/lesson-mode/CLOSE_LESSON';
const MARK_CHALLENGE_COMPLETED = 'scratch-gui/lesson-mode/MARK_CHALLENGE_COMPLETED';

const closedState = {
    courseId: null,
    lessonId: null,
    challengeId: null,
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
            };
        }
        case CLOSE_LESSON:
            return { ...state, ...closedState };
        case MARK_CHALLENGE_COMPLETED: {
            const progress = markProgress(state.progress, action.challengeId, action.completedAt);
            if (progress === state.progress) return state;
            saveProgress(progress);
            return { ...state, progress };
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
    isLessonMode,
    getCurrentChallenge,
};
