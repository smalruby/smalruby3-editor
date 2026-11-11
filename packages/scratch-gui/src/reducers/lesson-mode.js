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
import { isSpotlightSeen, markSpotlightSeen } from '../lib/lessons/spotlight-seen';

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
const FOCUS_LESSONS_LIBRARY = 'scratch-gui/lesson-mode/FOCUS_LESSONS_LIBRARY';
const CLEAR_LESSONS_LIBRARY_FOCUS = 'scratch-gui/lesson-mode/CLEAR_LESSONS_LIBRARY_FOCUS';
// チュートリアルのカードを開く action（reducers/cards.js の ACTIVATE_DECK）。カードの
// allowedBlocks / setup がレッスンのものと食い違うので、開いたらレッスンモードを抜ける
const ACTIVATE_DECK = 'scratch-gui/cards/ACTIVATE_DECK';

// ヒントの吹き出しの状態。チャレンジを閉じるたびに最初にもどす（開くときは 1 ページ目を出す）
const hintClosedState = {
    hintVisible: false,
    hintIndex: 0,
};

// ヒントのページ数。steps の後ろに「うまく動かないときは」と「プログラムを入れる」の
// 最後の手段のページが 1 つ付く（debug も code も無いチャレンジでは付かない）
const hasLastResort = (challenge) => challenge.debug.length > 0 || Boolean(challenge.code);
const hintPageCount = (challenge) => challenge.steps.length + (hasLastResort(challenge) ? 1 : 0);

const closedState = {
    courseId: null,
    lessonId: null,
    challengeId: null,
    // 開こうとしているチャレンジ（新しい作品ができるまでの間だけ入る）
    pendingChallengeId: null,
    ...hintClosedState,
    // はじめて開いたチャレンジか（spotlight のヒントで周りを暗くする。開いたときに決める）
    hintSpotlight: false,
    // 「できた！」を出しているチャレンジ id（閉じる・別のチャレンジを開くと null）
    justCompletedId: null,
};

const initialState = {
    ...closedState,
    // チャレンジを開いた回数。吹き出しの key にして、開き直したら（同じチャレンジでも）吹き出しの
    // 中の状態（ドラッグした位置・「置き換えますか？」）を捨てる。吹き出しはチャレンジを始めると
    // 自動で開くので、前のチャレンジから開いたままのときは unmount されないため
    hintSession: 0,
    progress: loadProgress(),
    // レッスン表を開くときに見せるチャレンジ（「次のチャレンジ」で開いたとき・#1520）。
    // レッスン表は、これが入っているレッスンへスクロールし、次のまだできていないチャレンジを
    // 目立たせる（lessonsLibraryFocus）。レッスンを閉じても消さない（レッスン表が閉じるときに消す）
    libraryFocusChallengeId: null,
};

const hintCount = (state) => {
    const found = state.challengeId === null ? null : findChallenge(state.challengeId);
    return found ? hintPageCount(found.challenge) : 0;
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
            // はじめて開いたチャレンジだけスポットライトを出す。開いた時点で「見た」と記録し、
            // このチャレンジを開いているあいだは state の値で照らし続ける
            const hintSpotlight = !isSpotlightSeen(found.challenge.id);
            if (hintSpotlight) markSpotlightSeen(found.challenge.id);
            // ヒントボタンを押さなくても、始めたら 1 ページ目を出す（ヒントの無いチャレンジは出さない）。
            // 閉じたあとは課題バーの「ヒント」で開き直す
            return {
                ...state,
                courseId: found.course.id,
                lessonId: found.lesson.id,
                challengeId: found.challenge.id,
                pendingChallengeId: null,
                ...hintClosedState,
                hintVisible: hintPageCount(found.challenge) > 0,
                hintSession: (state.hintSession || 0) + 1,
                hintSpotlight,
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
        case FOCUS_LESSONS_LIBRARY:
            if (!findChallenge(action.challengeId) || state.libraryFocusChallengeId === action.challengeId) {
                return state;
            }
            return { ...state, libraryFocusChallengeId: action.challengeId };
        case CLEAR_LESSONS_LIBRARY_FOCUS:
            return state.libraryFocusChallengeId === null ? state : { ...state, libraryFocusChallengeId: null };
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

/**
 * レッスン表を開いたときに、このチャレンジのレッスンを見せて、その次のまだできていない
 * チャレンジを目立たせる（「次のチャレンジ」・#1520）。開くのは modals の openLessonsLibrary
 * （まとめて出すときは lib/lessons/open-lessons-library.js の openLessonsLibraryAt）。
 * @param {string} challengeId - いまのチャレンジ id（知らない id は無視）。
 * @returns {object} action。
 */
const focusLessonsLibrary = (challengeId) => ({ type: FOCUS_LESSONS_LIBRARY, challengeId });

/** レッスン表を閉じたとき、見せるチャレンジを消す（次にメニューから開いたときは先頭から）。 */
const clearLessonsLibraryFocus = () => ({ type: CLEAR_LESSONS_LIBRARY_FOCUS });

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
 * @returns {?{visible: boolean, index: number, count: number, step: ?object, spotlight: boolean,
 *   lastResort: boolean, debug: Array<object>, code: ?(string|object), session: number}}
 *   レッスンモードでなければ null。`step` はいまのヒント（最後の手段のページでは null）。
 *   `spotlight` はこのページで周りを暗くするか（はじめて開いたチャレンジ、かつ `step.spotlight`）。
 *   `session` はチャレンジを開いた回数（吹き出しの key。開き直したら中の状態を捨てる）。
 *   `lastResort` は最後の手段のページ（`debug` = うまく動かないときは、`code` = プログラムを入れる）か。
 */
const getCurrentHint = (state) => {
    const found = getCurrentChallenge(state);
    if (!found) return null;
    const { hintVisible, hintIndex, hintSession, hintSpotlight } = state.scratchGui.lessonMode;
    const { steps, debug, code } = found.challenge;
    const step = steps[hintIndex] || null;
    return {
        visible: hintVisible,
        index: hintIndex,
        count: hintPageCount(found.challenge),
        step,
        spotlight: hintSpotlight && Boolean(step && step.spotlight),
        lastResort: hasLastResort(found.challenge) && hintIndex === steps.length,
        debug,
        code,
        session: hintSession || 0,
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
    focusLessonsLibrary,
    clearLessonsLibraryFocus,
    isLessonMode,
    getCurrentChallenge,
    getLessonAllowedBlocks,
    getCurrentHint,
};
