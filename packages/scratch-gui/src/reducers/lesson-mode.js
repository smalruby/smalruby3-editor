// いま開いているチャレンジ（レッスンモード）と、端末の記録。
// 記録の正は localStorage（lib/lessons/lesson-progress.js）で、ここはその写し。
//
// チャレンジを開く流れ（containers/lesson-mode.jsx が進める）:
//   startChallenge(id) → pendingChallengeId に入る → 新しい作品（変更があれば確認）
//   → setup を適用 → openChallenge(id) でレッスンモードに入る
import { findChallenge } from '../lib/lessons/courses';
import {
    loadProgress,
    markChallengeCompleted as markProgress,
    mergeProgress,
    saveProgress,
} from '../lib/lessons/lesson-progress';

const START_CHALLENGE = 'scratch-gui/lesson-mode/START_CHALLENGE';
const CANCEL_START_CHALLENGE = 'scratch-gui/lesson-mode/CANCEL_START_CHALLENGE';
const OPEN_CHALLENGE = 'scratch-gui/lesson-mode/OPEN_CHALLENGE';
const CLOSE_LESSON = 'scratch-gui/lesson-mode/CLOSE_LESSON';
const SHOW_HINT = 'scratch-gui/lesson-mode/SHOW_HINT';
const HIDE_HINT = 'scratch-gui/lesson-mode/HIDE_HINT';
const NEXT_HINT = 'scratch-gui/lesson-mode/NEXT_HINT';
const PREV_HINT = 'scratch-gui/lesson-mode/PREV_HINT';
const MARK_CHALLENGE_COMPLETED = 'scratch-gui/lesson-mode/MARK_CHALLENGE_COMPLETED';
const RELOAD_PROGRESS = 'scratch-gui/lesson-mode/RELOAD_PROGRESS';
const DISMISS_COMPLETED = 'scratch-gui/lesson-mode/DISMISS_COMPLETED';
// チュートリアルのカードを開く action（reducers/cards.js の ACTIVATE_DECK）。カードの
// allowedBlocks / setup がレッスンのものと食い違うので、開いたらレッスンモードを抜ける
const ACTIVATE_DECK = 'scratch-gui/cards/ACTIVATE_DECK';

// ヒントの吹き出しの状態。チャレンジを開く・閉じるたびに最初にもどす
const hintClosedState = {
    hintVisible: false,
    hintIndex: 0,
};

const closedState = {
    courseId: null,
    lessonId: null,
    challengeId: null,
    // 開こうとしているチャレンジ（新しい作品ができるまでの間だけ入る）
    pendingChallengeId: null,
    ...hintClosedState,
    // 「できた！」を出しているチャレンジ id（閉じる・別のチャレンジを開くと null）
    justCompletedId: null,
};

const initialState = {
    ...closedState,
    progress: loadProgress(),
};

const hintCount = (state) => {
    const found = state.challengeId === null ? null : findChallenge(state.challengeId);
    return found ? found.challenge.steps.length : 0;
};

const reducer = function (state, action) {
    if (typeof state === 'undefined') state = initialState;
    switch (action.type) {
        case START_CHALLENGE: {
            if (!findChallenge(action.challengeId)) return state;
            return { ...state, pendingChallengeId: action.challengeId };
        }
        case CANCEL_START_CHALLENGE:
            return state.pendingChallengeId === null ? state : { ...state, pendingChallengeId: null };
        case OPEN_CHALLENGE: {
            const found = findChallenge(action.challengeId);
            if (!found) return state;
            return {
                ...state,
                courseId: found.course.id,
                lessonId: found.lesson.id,
                challengeId: found.challenge.id,
                pendingChallengeId: null,
                ...hintClosedState,
                justCompletedId: null,
            };
        }
        case CLOSE_LESSON:
        case ACTIVATE_DECK:
            return state.challengeId === null && state.pendingChallengeId === null
                ? state
                : { ...state, ...closedState };
        case SHOW_HINT:
            if (state.challengeId === null || hintCount(state) === 0) return state;
            return { ...state, hintVisible: true };
        case HIDE_HINT:
            return state.hintVisible ? { ...state, hintVisible: false } : state;
        case NEXT_HINT: {
            if (state.challengeId === null) return state;
            const last = hintCount(state) - 1;
            return state.hintIndex >= last ? state : { ...state, hintIndex: state.hintIndex + 1 };
        }
        case PREV_HINT:
            if (state.challengeId === null || state.hintIndex <= 0) return state;
            return { ...state, hintIndex: state.hintIndex - 1 };
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

/**
 * チャレンジを開く（レッスン表が呼ぶ入口）。新しい作品にしてから setup を適用し、
 * レッスンモードに入るところまでを containers/lesson-mode.jsx が進める。
 * @param {string} challengeId - チャレンジ id（知らない id は無視）。
 * @returns {object} action。
 */
const startChallenge = (challengeId) => ({ type: START_CHALLENGE, challengeId });

/** 「保存しますか」で取りやめたときなど、開こうとしていたチャレンジを取り消す。 */
const cancelStartChallenge = () => ({ type: CANCEL_START_CHALLENGE });

/**
 * レッスンモードに入る（作品の準備は済んでいる前提）。
 * @param {string} challengeId - チャレンジ id（知らない id は無視）。
 * @returns {object} action。
 */
const openChallenge = (challengeId) => ({ type: OPEN_CHALLENGE, challengeId });

const closeLesson = () => ({ type: CLOSE_LESSON });

const showHint = () => ({ type: SHOW_HINT });

const hideHint = () => ({ type: HIDE_HINT });

const nextHint = () => ({ type: NEXT_HINT });

const prevHint = () => ({ type: PREV_HINT });

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

/**
 * パレットに出すブロック（チャレンジの `allowedBlocks`）。レッスンモードでないか、
 * チャレンジが絞っていなければ null。チャレンジの定義は不変なので参照も変わらない
 * （Blocks コンテナが参照の変化でツールボックスを作り直すため）。
 * @param {object} state - Redux の state。
 * @returns {?object} deck と同じ形の allowedBlocks。
 */
const getLessonAllowedBlocks = (state) => {
    const found = getCurrentChallenge(state);
    return found ? found.challenge.allowedBlocks : null;
};

/**
 * ヒントの吹き出しの状態（見た目は吹き出しの実装が作る）。
 * @param {object} state - Redux の state。
 * @returns {?{visible: boolean, index: number, count: number, step: ?object}}
 *   レッスンモードでなければ null。`step` はいまのヒント（無ければ null）。
 */
const getCurrentHint = (state) => {
    const found = getCurrentChallenge(state);
    if (!found) return null;
    const { hintVisible, hintIndex } = state.scratchGui.lessonMode;
    const { steps } = found.challenge;
    return {
        visible: hintVisible,
        index: hintIndex,
        count: steps.length,
        step: steps[hintIndex] || null,
    };
};

export {
    reducer as default,
    initialState as lessonModeInitialState,
    startChallenge,
    cancelStartChallenge,
    openChallenge,
    closeLesson,
    showHint,
    hideHint,
    nextHint,
    prevHint,
    markChallengeCompleted,
    reloadProgress,
    dismissCompleted,
    isLessonMode,
    getCurrentChallenge,
    getLessonAllowedBlocks,
    getCurrentHint,
};
