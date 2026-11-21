// いま開いているチャレンジ（レッスンモード）と、端末の記録。
// 記録の正は localStorage（lib/lessons/lesson-progress.js）で、ここはその写し。
//
// チャレンジを開く流れ（containers/lesson-mode.jsx が進める）:
//   startChallenge(id) → pendingChallengeId に入る → 新しい作品（変更があれば確認）
//   → setup を適用 → openChallenge(id) でレッスンモードに入る
import { findChallenge } from '../lib/lessons/courses';
import {
    emptyProgress,
    loadProgress,
    markChallengeCompleted as markProgress,
    mergeProgress,
    saveProgress,
} from '../lib/lessons/lesson-progress';
import { ROLE_SOURCES } from '../lib/lessons/lesson-role';
import { isReadDiagram } from '../lib/lessons/read-diagram';
import {
    emptyReadiness,
    loadReadiness,
    markReadinessChallengeCleared,
    markReadinessOffered,
    recordReadinessAnswer,
    saveReadiness,
} from '../lib/lessons/readiness';
import { DEFAULT_ROLE, challengeForRole, isRole } from '../lib/lessons/role-swap';
import { isSpotlightSeen, markSpotlightSeen } from '../lib/lessons/spotlight-seen';

const START_CHALLENGE = 'scratch-gui/lesson-mode/START_CHALLENGE';
const CANCEL_START_CHALLENGE = 'scratch-gui/lesson-mode/CANCEL_START_CHALLENGE';
const OPEN_CHALLENGE = 'scratch-gui/lesson-mode/OPEN_CHALLENGE';
const CLOSE_LESSON = 'scratch-gui/lesson-mode/CLOSE_LESSON';
const SHOW_HINT = 'scratch-gui/lesson-mode/SHOW_HINT';
const HIDE_HINT = 'scratch-gui/lesson-mode/HIDE_HINT';
const FINISH_HINT = 'scratch-gui/lesson-mode/FINISH_HINT';
const NEXT_HINT = 'scratch-gui/lesson-mode/NEXT_HINT';
const PREV_HINT = 'scratch-gui/lesson-mode/PREV_HINT';
const MARK_CHALLENGE_COMPLETED = 'scratch-gui/lesson-mode/MARK_CHALLENGE_COMPLETED';
const RELOAD_PROGRESS = 'scratch-gui/lesson-mode/RELOAD_PROGRESS';
const CLEAR_PROGRESS = 'scratch-gui/lesson-mode/CLEAR_PROGRESS';
const REQUEST_PROGRESS_SEND = 'scratch-gui/lesson-mode/REQUEST_PROGRESS_SEND';
const DISMISS_COMPLETED = 'scratch-gui/lesson-mode/DISMISS_COMPLETED';
const HIDE_COMPLETED = 'scratch-gui/lesson-mode/HIDE_COMPLETED';
const SHOW_COMPLETED = 'scratch-gui/lesson-mode/SHOW_COMPLETED';
const FOCUS_LESSONS_LIBRARY = 'scratch-gui/lesson-mode/FOCUS_LESSONS_LIBRARY';
const FOCUS_LESSONS_LIBRARY_START = 'scratch-gui/lesson-mode/FOCUS_LESSONS_LIBRARY_START';
const CLEAR_LESSONS_LIBRARY_FOCUS = 'scratch-gui/lesson-mode/CLEAR_LESSONS_LIBRARY_FOCUS';
const SET_LIBRARY_ASSIGNMENT_ONLY = 'scratch-gui/lesson-mode/SET_LIBRARY_ASSIGNMENT_ONLY';
const SET_ROLE = 'scratch-gui/lesson-mode/SET_ROLE';
const SOLVE_PART_QUIZ = 'scratch-gui/lesson-mode/SOLVE_PART_QUIZ';
const MISS_PART_QUIZ = 'scratch-gui/lesson-mode/MISS_PART_QUIZ';
const ANSWER_READINESS = 'scratch-gui/lesson-mode/ANSWER_READINESS';
const NEXT_READINESS = 'scratch-gui/lesson-mode/NEXT_READINESS';
const MARK_READINESS_OFFERED = 'scratch-gui/lesson-mode/MARK_READINESS_OFFERED';
// チュートリアルのカードを開く action（reducers/cards.js の ACTIVATE_DECK）。カードの
// allowedBlocks / setup がレッスンのものと食い違うので、開いたらレッスンモードを抜ける
const ACTIVATE_DECK = 'scratch-gui/cards/ACTIVATE_DECK';

// ヒントの吹き出しの状態。チャレンジを閉じるたびに最初にもどす（開くときは 1 ページ目を出す）。
// hintMinimized = 吹き出しを小さくして、課題バーの近くに札（いまのページの番号と見出し）だけを残しているか。
// 子どもはヒントを読んで操作するときに閉じてしまい、手順を見失っていたので、閉じる代わりに小さくする（#2131）
const hintClosedState = {
    hintVisible: false,
    hintIndex: 0,
    hintMinimized: false,
};

// ヒントのページ数。steps の後ろに「うまく動かないときは」と「プログラムを入れる」の
// 最後の手段のページが 1 つ付く（debug も code も無いチャレンジでは付かない）。
// 読んで作るチャレンジには付けない（「正解のプログラムを確認する」で置き換えると、そのまま動かすだけで
// 「できた」になるため。答えは 3 ページ目に描くだけ・lib/lessons/read-diagram.js）
const hasLastResort = (challenge) =>
    !isReadDiagram(challenge) && (challenge.debug.length > 0 || Boolean(challenge.code));
const hintPageCount = (challenge) => challenge.steps.length + (hasLastResort(challenge) ? 1 : 0);

/**
 * チャレンジを始めたら、ヒントの 1 ページ目を自動で開くか。ヒントのあるチャレンジは全部開く（ヒントを表示した
 * まま操作することに気づかない子が多いため・#2129 の Q1）。読むときに邪魔なら「－」で小さくする。
 * ヒントの無いチャレンジは開かない。
 * @param {{lesson: object, challenge: object}} found - findChallenge の結果。
 * @returns {boolean} 自動で開くか。
 */
const autoOpensHint = (found) => hintPageCount(found.challenge) > 0;

const closedState = {
    courseId: null,
    lessonId: null,
    challengeId: null,
    // 開こうとしているチャレンジ（新しい作品ができるまでの間だけ入る）
    pendingChallengeId: null,
    // 開こうとしている・開いているチャレンジを、クラスの課題から開いたか（GA の計測で送る真偽だけ。
    // 課題の ID は持たない。lib/lessons/lesson-analytics.js）
    pendingFromAssignment: false,
    fromAssignment: false,
    // 開こうとしている・開いているチャレンジを、課題の「おさらい（課題の外）」として開いたか（#2300）。課題の数には
    // 入れない。課題バーに「おさらい中」と「課題にもどる」を出し、クラスへは current に `review: true` を付けて送る
    pendingFromReview: false,
    fromReview: false,
    ...hintClosedState,
    // はじめて開いたチャレンジか（spotlight のヒントで周りを暗くする。開いたときに決める）
    hintSpotlight: false,
    // 「できた！」を出しているチャレンジ id（閉じる・別のチャレンジを開くと null）
    justCompletedId: null,
    // 「できた！」を出しているチャレンジが、この「できた」ではじめて記録に入ったか（もう一度できたときは
    // false）。「課題クリア！」を 1 回だけ出すのに使う（lib/lessons/assignment-progress.js の
    // isAssignmentJustCleared）
    justCompletedNew: false,
    // 「できた！」を閉じずに、いっとき隠しているか（#1639）。クイズのある「できた！」は、課題バーの全文を
    // タップで開いているあいだだけ隠し、全文を閉じたら出し直す（閉じるとクイズにもどれないため）
    completedHidden: false,
    // ペアでやるチャレンジの役（#2061。lib/lessons/role-swap.js の ROLES）。役のあるチャレンジ（`roles: true`）を
    // 開いているときだけ入る。roleSource = どう決めたか（lib/lessons/lesson-role.js の ROLE_SOURCES）、
    // rolePair = 出席番号のペアの印（クラスで出席番号のペアにつながっているとき）
    role: null,
    roleSource: null,
    rolePair: null,
    // 役を選びなおしてチャレンジを始めなおすときの役と、どう決めたか（開くまでの間だけ入る）
    pendingRole: null,
    pendingRoleSource: null,
    // 画面の部分をクリックして答えるクイズ（チャレンジの `partQuiz`・#2134）で、正しく答えた問いの数。
    // いまの問いは、この数の番め（0 から）。チャレンジを開くたびに 0 にもどす
    partQuizSolved: 0,
    // そのクイズで 1 回でもまちがえたか。1 回もまちがえずに全部答えたら、「できた！」で次のレッスンへ進むことも
    // えらべる（lesson-progress.js の lessonSkipOffer）。チャレンジを開くたびに false にもどす
    partQuizMissed: false,
    // じゅんびチェック（チャレンジの `readinessCheck`・#2299）で、答えて「次へ」まで進んだ問いの数。いまの問いは、この数の
    // 番め（0 から）。goal の `readinessCheck` が見る。チャレンジを開くたびに 0 にもどす
    readinessAnswered: 0,
    // いまの問いで選んだ選択肢（`{index, choice}`）。1 回めに選んだものだけを数えるので、選んだら変えない。無ければ null
    readinessChoice: null,
};

const initialState = {
    ...closedState,
    // チャレンジを開いた回数。吹き出しの key にして、開き直したら（同じチャレンジでも）吹き出しの
    // 中の状態（ドラッグした位置・「置き換えますか？」）を捨てる。吹き出しはチャレンジを始めると
    // 自動で開くので、前のチャレンジから開いたままのときは unmount されないため
    hintSession: 0,
    progress: loadProgress(),
    // じゅんびチェックの記録（lib/lessons/readiness.js）。正は localStorage で、ここはその写し
    readiness: loadReadiness(),
    // レッスン表を開くときに見せるチャレンジ（「次のチャレンジ」で開いたとき・#1520）。
    // レッスン表は、これが入っているレッスンへスクロールし、次のまだできていないチャレンジを
    // 目立たせる（lessonsLibraryFocus）。レッスンを閉じても消さない（レッスン表が閉じるときに消す）
    libraryFocusChallengeId: null,
    // レッスン表を、ウェルカムの「レッスンを始める」で開いたか（#1888）。レッスン表は、記録から次にやる
    // チャレンジを決めて目立たせる（lesson-progress.js の startLessonsFocus）。レッスン表が閉じるときに消す
    libraryStartFocus: false,
    // レッスン表を、クラスの課題のチャレンジだけで開くか（「はじめる」「レッスンを続ける」・#1599）。
    // メニューの「レッスン」から開くときは false（コース全体＋課題の帯）。レッスン表が閉じるときに消す
    libraryAssignmentOnly: false,
    // 最後に課題から開いた課題のチャレンジ id（#2300）。「おさらい」の「課題にもどる」の行き先。レッスンを閉じても消さない
    lastAssignmentChallengeId: null,
    // クラスの課題へ進み具合を送ってほしい回数（クラスの画面を開いたとき・#1600）。
    // containers/lesson-progress-sync.jsx が、増えたら送る（取りこぼしの追いつき）
    progressSendRequest: 0,
};

/**
 * チャレンジを開くときの役（役のあるチャレンジだけ）。役を選びなおして始めなおしたとき（pendingRole）は
 * その役、コンテナが決めた役（action.role。前回の役・出席番号のペア。lib/lessons/lesson-role.js）があれば
 * それ、無ければシマラビの役。reducer は端末（localStorage）を読み書きしない（前回の役を読むのも、選んだ役を
 * 覚えるのもコンテナ）。
 * @param {object} challenge - 開くチャレンジ。
 * @param {object} action - OPEN_CHALLENGE。
 * @param {object} state - いまの state。
 * @returns {{role: ?string, roleSource: ?string, rolePair: ?string}} 役の state。
 */
const openedRoleState = (challenge, action, state) => {
    if (!challenge.roles) return { role: null, roleSource: null, rolePair: null };
    let resolved;
    if (state.pendingChallengeId === challenge.id && isRole(state.pendingRole)) {
        resolved = {
            role: state.pendingRole,
            source: state.pendingRoleSource || ROLE_SOURCES.CHOSEN,
            pair: action.rolePair || state.rolePair || null,
        };
    } else if (isRole(action.role)) {
        resolved = {
            role: action.role,
            source: action.roleSource || ROLE_SOURCES.DEFAULT,
            pair: action.rolePair || null,
        };
    } else {
        resolved = { role: DEFAULT_ROLE, source: ROLE_SOURCES.DEFAULT, pair: null };
    }
    return { role: resolved.role, roleSource: resolved.source, rolePair: resolved.pair };
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
            return {
                ...state,
                pendingChallengeId: action.challengeId,
                pendingFromAssignment: Boolean(action.fromAssignment),
                pendingFromReview: Boolean(action.fromReview) && !action.fromAssignment,
                pendingRole: isRole(action.role) ? action.role : null,
                pendingRoleSource: isRole(action.role) ? action.roleSource || ROLE_SOURCES.CHOSEN : null,
            };
        }
        case CANCEL_START_CHALLENGE:
            return state.pendingChallengeId === null
                ? state
                : {
                      ...state,
                      pendingChallengeId: null,
                      pendingFromAssignment: false,
                      pendingFromReview: false,
                      pendingRole: null,
                      pendingRoleSource: null,
                  };
        case OPEN_CHALLENGE: {
            const found = findChallenge(action.challengeId);
            if (!found) return state;
            // はじめて開いたチャレンジだけスポットライトを出す。開いた時点で「見た」と記録し、
            // このチャレンジを開いているあいだは state の値で照らし続ける。レッスン 0（warmup）は
            // 画面を知らない子のためのもので、やり直す子ほど迷っているので、開くたびに照らす
            const firstOpen = !isSpotlightSeen(found.challenge.id);
            if (firstOpen) markSpotlightSeen(found.challenge.id);
            const hintSpotlight = firstOpen || found.lesson.warmup;
            const roleState = openedRoleState(found.challenge, action, state);
            // 役を選びなおして同じチャレンジを始めなおしたときは、ヒントのページをそのままにする（「メッシュにつなごう」の
            // ページで役を変えても 1 ページ目にもどらない）
            const fromStart = state.pendingChallengeId === found.challenge.id;
            const fromAssignment = fromStart && Boolean(state.pendingFromAssignment);
            const restartedInRole =
                state.challengeId === found.challenge.id &&
                state.pendingChallengeId === found.challenge.id &&
                isRole(state.pendingRole);
            const hintState = restartedInRole
                ? { hintIndex: state.hintIndex, hintVisible: state.hintVisible, hintMinimized: state.hintMinimized }
                : { ...hintClosedState, hintVisible: autoOpensHint(found) };
            // ヒントボタンを押さなくても、始めたら 1 ページ目を出す（autoOpensHint）
            return {
                ...state,
                courseId: found.course.id,
                lessonId: found.lesson.id,
                challengeId: found.challenge.id,
                pendingChallengeId: null,
                pendingFromAssignment: false,
                pendingFromReview: false,
                pendingRole: null,
                pendingRoleSource: null,
                ...roleState,
                // startChallenge から来たときだけ、そのときの「課題からか」「おさらいか」を引き継ぐ
                fromAssignment,
                fromReview: fromStart && Boolean(state.pendingFromReview),
                lastAssignmentChallengeId: fromAssignment
                    ? found.challenge.id
                    : state.lastAssignmentChallengeId || null,
                ...hintState,
                hintSession: (state.hintSession || 0) + 1,
                hintSpotlight,
                justCompletedId: null,
                justCompletedNew: false,
                completedHidden: false,
                partQuizSolved: 0,
                partQuizMissed: false,
                readinessAnswered: 0,
                readinessChoice: null,
            };
        }
        case ANSWER_READINESS: {
            // いまの問いに 1 回めに選んだものだけを記録する（ちがうチャレンジ・前の問い・選びなおしは数えない）
            const found = state.challengeId === action.challengeId ? findChallenge(state.challengeId) : null;
            const check = found ? found.challenge.readinessCheck : null;
            const index = state.readinessAnswered || 0;
            if (!check || action.index !== index || index >= check.questions.length || state.readinessChoice) {
                return state;
            }
            const question = check.questions[index];
            const correct = action.choice === question.answer;
            const readiness = recordReadinessAnswer(
                state.readiness || emptyReadiness(),
                found.course.id,
                question.baseChallengeId,
                correct,
                action.answeredAt,
            );
            saveReadiness(readiness);
            return { ...state, readiness, readinessChoice: { index, choice: action.choice } };
        }
        case NEXT_READINESS: {
            if (state.challengeId !== action.challengeId || !state.readinessChoice) return state;
            if (state.readinessChoice.index !== (state.readinessAnswered || 0)) return state;
            return { ...state, readinessAnswered: (state.readinessAnswered || 0) + 1, readinessChoice: null };
        }
        case MARK_READINESS_OFFERED: {
            const readiness = markReadinessOffered(state.readiness || emptyReadiness(), action.courseId, action.at);
            if (readiness === state.readiness) return state;
            saveReadiness(readiness);
            return { ...state, readiness };
        }
        case SOLVE_PART_QUIZ: {
            // ちがうチャレンジ（開きなおした後に届いたもの）の答えは数えない
            const found = state.challengeId === action.challengeId ? findChallenge(state.challengeId) : null;
            const questions = found && found.challenge.partQuiz ? found.challenge.partQuiz.questions.length : 0;
            const solved = state.partQuizSolved || 0;
            if (solved >= questions || action.index !== solved) return state;
            return { ...state, partQuizSolved: solved + 1 };
        }
        case MISS_PART_QUIZ: {
            // ちがうチャレンジ・クイズの無いチャレンジ・答えおわったクイズのまちがいは覚えない
            const found = state.challengeId === action.challengeId ? findChallenge(state.challengeId) : null;
            const questions = found && found.challenge.partQuiz ? found.challenge.partQuiz.questions.length : 0;
            if (state.partQuizMissed || (state.partQuizSolved || 0) >= questions) return state;
            return { ...state, partQuizMissed: true };
        }
        case CLOSE_LESSON:
        case ACTIVATE_DECK:
            return state.challengeId === null && state.pendingChallengeId === null
                ? state
                : { ...state, ...closedState };
        case SHOW_HINT:
            if (state.challengeId === null || hintCount(state) === 0) return state;
            return { ...state, hintVisible: true, hintMinimized: false };
        case HIDE_HINT:
            // 小さくする（閉じない）。課題バーの近くに札が残り、押すと同じページで元の大きさにもどる（#2131）
            return state.hintVisible ? { ...state, hintVisible: false, hintMinimized: true } : state;
        case FINISH_HINT:
            // 「おわり」で閉じたときは、最後まで読んだので、開き直すと 1 ページ目から（#1528）
            if (state.challengeId === null || (!state.hintVisible && !state.hintMinimized && state.hintIndex === 0)) {
                return state;
            }
            return { ...state, ...hintClosedState };
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
            // じゅんびチェックで「おすすめ」にしたチャレンジができたら、「おすすめ」を消す（#2299）
            const readiness = markReadinessChallengeCleared(
                state.readiness || emptyReadiness(),
                action.challengeId,
                action.completedAt,
            );
            if (readiness !== state.readiness) saveReadiness(readiness);
            // もう一度できたときも「できた！」は出す（記録は最初の日時のまま）
            const justCompletedId = findChallenge(action.challengeId) ? action.challengeId : state.justCompletedId;
            // いま開いているチャレンジができたら、ヒントの吹き出しを閉じる（#1528）。できたあとは
            // ヒントの役目が終わり、「できた！」（の「次のチャレンジ」）を吹き出しで隠さないため。
            // ページはそのまま（×で閉じたときと同じ。課題バーの「ヒント」で開き直すと同じページ）
            const hintVisible = action.challengeId === state.challengeId ? false : state.hintVisible;
            // 小さくした札も消す（できたあとはヒントの役目が終わる）
            const hintMinimized = action.challengeId === state.challengeId ? false : state.hintMinimized;
            const justCompletedNew =
                justCompletedId === action.challengeId ? progress !== latest : state.justCompletedNew;
            // 「できた！」を出し直すときは、隠していたのを解く
            const completedHidden = justCompletedId === action.challengeId ? false : state.completedHidden;
            if (
                progress === state.progress &&
                readiness === state.readiness &&
                justCompletedId === state.justCompletedId &&
                hintVisible === state.hintVisible &&
                hintMinimized === state.hintMinimized &&
                justCompletedNew === state.justCompletedNew &&
                completedHidden === state.completedHidden
            ) {
                return state;
            }
            return {
                ...state,
                progress,
                readiness,
                justCompletedId,
                hintVisible,
                hintMinimized,
                justCompletedNew,
                completedHidden,
            };
        }
        case DISMISS_COMPLETED:
            return state.justCompletedId === null
                ? state
                : { ...state, justCompletedId: null, justCompletedNew: false, completedHidden: false };
        case HIDE_COMPLETED:
            return state.justCompletedId === null || state.completedHidden
                ? state
                : { ...state, completedHidden: true };
        case SHOW_COMPLETED:
            return state.completedHidden ? { ...state, completedHidden: false } : state;
        case FOCUS_LESSONS_LIBRARY:
            if (!findChallenge(action.challengeId) || state.libraryFocusChallengeId === action.challengeId) {
                return state;
            }
            return { ...state, libraryFocusChallengeId: action.challengeId };
        case FOCUS_LESSONS_LIBRARY_START:
            return state.libraryStartFocus ? state : { ...state, libraryStartFocus: true };
        case CLEAR_LESSONS_LIBRARY_FOCUS:
            return state.libraryFocusChallengeId === null && !state.libraryAssignmentOnly && !state.libraryStartFocus
                ? state
                : { ...state, libraryFocusChallengeId: null, libraryAssignmentOnly: false, libraryStartFocus: false };
        case SET_ROLE: {
            // いまのチャレンジの役を、生徒が選びなおした（役の無いチャレンジでは何もしない）
            const found = state.challengeId === null ? null : findChallenge(state.challengeId);
            if (!found || !found.challenge.roles || !isRole(action.role)) return state;
            const roleSource = action.roleSource || ROLE_SOURCES.CHOSEN;
            const rolePair = typeof action.rolePair === 'undefined' ? state.rolePair : action.rolePair;
            if (state.role === action.role && state.roleSource === roleSource && state.rolePair === rolePair) {
                return state;
            }
            return { ...state, role: action.role, roleSource, rolePair };
        }
        case SET_LIBRARY_ASSIGNMENT_ONLY:
            return state.libraryAssignmentOnly === Boolean(action.assignmentOnly)
                ? state
                : { ...state, libraryAssignmentOnly: Boolean(action.assignmentOnly) };
        case CLEAR_PROGRESS: {
            // 本人の確認で「ちがう」→「消す」（#1600）。端末のレッスンの記録だけを空にする。じゅんびチェックの記録も
            // 同じ人のものなので消す（ほかの人の「おすすめ」を残さない）
            const progress = emptyProgress();
            saveProgress(progress);
            const readiness = emptyReadiness();
            saveReadiness(readiness);
            return {
                ...state,
                progress,
                readiness,
                justCompletedId: null,
                justCompletedNew: false,
                completedHidden: false,
            };
        }
        case REQUEST_PROGRESS_SEND:
            return { ...state, progressSendRequest: (state.progressSendRequest || 0) + 1 };
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
 * @param {object} [options] - オプション。
 * @param {boolean} [options.fromAssignment] - クラスの課題から開いたか（GA の計測で送る）。
 * @param {boolean} [options.fromReview] - 課題の「おさらい（課題の外）」として開いたか（#2300）。
 * @param {?string} [options.role] - この役で始める（役を選びなおして始めなおすとき・#2061）。
 * @param {?string} [options.roleSource] - その役をどう決めたか（無ければ生徒が選んだ）。
 * @returns {object} action。
 */
const startChallenge = (
    challengeId,
    { fromAssignment = false, fromReview = false, role = null, roleSource = null } = {},
) => ({
    type: START_CHALLENGE,
    challengeId,
    fromAssignment: Boolean(fromAssignment),
    fromReview: Boolean(fromReview),
    role,
    roleSource,
});

/** 「保存しますか」で取りやめたときなど、開こうとしていたチャレンジを取り消す。 */
const cancelStartChallenge = () => ({ type: CANCEL_START_CHALLENGE });

/**
 * レッスンモードに入る（作品の準備は済んでいる前提）。
 * @param {string} challengeId - チャレンジ id（知らない id は無視）。
 * @param {object} [options] - 役のあるチャレンジの役（#2061。無ければ前回の役から決める）。
 * @param {?string} [options.role] - 役。
 * @param {?string} [options.roleSource] - どう決めたか（ROLE_SOURCES）。
 * @param {?string} [options.rolePair] - 出席番号のペアの印。
 * @returns {object} action。
 */
const openChallenge = (challengeId, { role = null, roleSource = null, rolePair = null } = {}) => ({
    type: OPEN_CHALLENGE,
    challengeId,
    role,
    roleSource,
    rolePair,
});

/**
 * いまのチャレンジの役を選びなおす（課題バーの役のボタン・#2061）。役の無いチャレンジでは何もしない。
 * @param {string} role - 役（lib/lessons/role-swap.js の ROLES）。
 * @param {object} [options] - オプション。
 * @param {?string} [options.roleSource] - どう決めたか（無ければ生徒が選んだ）。出席番号のペアにつながって
 *   決めなおしたときは SEAT。
 * @param {?string} [options.rolePair] - 出席番号のペアの印（無ければいまのまま）。
 * @returns {object} action。
 */
const setLessonRole = (role, { roleSource = null, rolePair } = {}) => ({
    type: SET_ROLE,
    role,
    roleSource,
    rolePair,
});

const closeLesson = () => ({ type: CLOSE_LESSON });

/**
 * 画面の部分をクリックして答えるクイズで、`index` 番め（0 から）の問いに正しく答えた（#2134）。いまの問いで
 * なければ数えない（同じ問いを 2 回数えない）。
 * @param {string} challengeId - クイズのあるチャレンジ id。
 * @param {number} index - 答えた問いの番号（0 から）。
 * @returns {object} action。
 */
const solvePartQuiz = (challengeId, index) => ({ type: SOLVE_PART_QUIZ, challengeId, index });

/**
 * 画面の部分をクリックして答えるクイズで、まちがえた（ちがう場所をクリックした）。1 回もまちがえずに全部答えたかを
 * 見るために覚える（lesson-progress.js の lessonSkipOffer）。
 * @param {string} challengeId - クイズのあるチャレンジ id。
 * @returns {object} action。
 */
const missPartQuiz = (challengeId) => ({ type: MISS_PART_QUIZ, challengeId });

/**
 * じゅんびチェックのいまの問いで選んだ（#2299）。1 回めに選んだものだけを記録に入れる（正しいかは reducer が決める）。
 * @param {string} challengeId - じゅんびチェックのチャレンジ id。
 * @param {number} index - 問いの番号（0 から）。
 * @param {number} choice - 選んだ選択肢の番号（0 から）。
 * @param {string} [answeredAt] - 答えた日時（ISO 文字列）。
 * @returns {object} action。
 */
const answerReadiness = (challengeId, index, choice, answeredAt = new Date().toISOString()) => ({
    type: ANSWER_READINESS,
    challengeId,
    index,
    choice,
    answeredAt,
});

/**
 * じゅんびチェックの次の問いへ進む（いまの問いに答えたあとだけ）。最後の問いで進むと、goal の `readinessCheck` を満たす。
 * @param {string} challengeId - じゅんびチェックのチャレンジ id。
 * @returns {object} action。
 */
const nextReadiness = (challengeId) => ({ type: NEXT_READINESS, challengeId });

/**
 * 「先にじゅんびチェックをする？」を聞いたことを覚える（1 回だけ聞く）。
 * @param {string} courseId - コース id。
 * @param {string} [at] - 聞いた日時（ISO 文字列）。
 * @returns {object} action。
 */
const markReadinessOfferedAction = (courseId, at = new Date().toISOString()) => ({
    type: MARK_READINESS_OFFERED,
    courseId,
    at,
});

const showHint = () => ({ type: SHOW_HINT });

const hideHint = () => ({ type: HIDE_HINT });

/** 最後のページの「おわり」で閉じる。次に開くときは 1 ページ目から（×の hideHint は同じページから）。 */
const finishHint = () => ({ type: FINISH_HINT });

const nextHint = () => ({ type: NEXT_HINT });

const prevHint = () => ({ type: PREV_HINT });

const markChallengeCompleted = (challengeId, completedAt = new Date().toISOString()) => ({
    type: MARK_CHALLENGE_COMPLETED,
    challengeId,
    completedAt,
});

const reloadProgress = () => ({ type: RELOAD_PROGRESS });

/**
 * 端末のレッスンの記録を空にする（本人の確認で「消す」を選んだとき・#1600）。
 * @returns {object} action。
 */
const clearProgress = () => ({ type: CLEAR_PROGRESS });

/**
 * クラスの課題へ進み具合を送ってもらう（クラスの画面を開いたとき・#1600）。
 * @returns {object} action。
 */
const requestProgressSend = () => ({ type: REQUEST_PROGRESS_SEND });

const dismissCompleted = () => ({ type: DISMISS_COMPLETED });

/**
 * 「できた！」を閉じずに、いっとき隠す（課題バーの全文をタップで開いているあいだ・#1639）。
 * 選んだクイズの答えは残る（toast は描いたまま見えなくするだけ）。
 * @returns {object} action。
 */
const hideCompleted = () => ({ type: HIDE_COMPLETED });

/**
 * hideCompleted で隠した「できた！」を出し直す（全文を閉じたとき）。
 * @returns {object} action。
 */
const showCompleted = () => ({ type: SHOW_COMPLETED });

/**
 * レッスン表を開いたときに、このチャレンジのレッスンを見せて、その次のまだできていない
 * チャレンジを目立たせる（「次のチャレンジ」・#1520）。開くのは modals の openLessonsLibrary
 * （まとめて出すときは lib/lessons/open-lessons-library.js の openLessonsLibraryAt）。
 * @param {string} challengeId - いまのチャレンジ id（知らない id は無視）。
 * @returns {object} action。
 */
const focusLessonsLibrary = (challengeId) => ({ type: FOCUS_LESSONS_LIBRARY, challengeId });

/**
 * レッスン表を開いたときに、記録から次にやるチャレンジを決めて目立たせる（ウェルカムの
 * 「レッスンを始める」・#1888。見せ方は「次のチャレンジ」と同じ）。開くのは modals の openLessonsLibrary
 * （まとめて出すときは lib/lessons/open-lessons-library.js の openLessonsLibraryToStart）。
 * @returns {object} action。
 */
const focusLessonsLibraryStart = () => ({ type: FOCUS_LESSONS_LIBRARY_START });

/** レッスン表を閉じたとき、見せるチャレンジと課題だけの表示を消す（次にメニューから開いたときは先頭から）。 */
const clearLessonsLibraryFocus = () => ({ type: CLEAR_LESSONS_LIBRARY_FOCUS });

/**
 * レッスン表を、クラスの課題のチャレンジだけで開くか（#1599）。開くのは modals の openLessonsLibrary
 * （まとめて出すときは lib/lessons/open-lessons-library.js の openAssignmentLessonsLibrary）。
 * @param {boolean} assignmentOnly - 課題のチャレンジだけにするなら true。
 * @returns {object} action。
 */
const setLibraryAssignmentOnly = (assignmentOnly) => ({ type: SET_LIBRARY_ASSIGNMENT_ONLY, assignmentOnly });

const isLessonMode = (state) => state.scratchGui.lessonMode.challengeId !== null;

/**
 * @param {object} state - Redux の state。
 * @returns {?{course: object, lesson: object, challenge: object}} いま開いているチャレンジ。
 */
const getCurrentChallenge = (state) => {
    const { challengeId, role } = state.scratchGui.lessonMode;
    const found = challengeId === null ? null : findChallenge(challengeId);
    if (!found) return null;
    // シマネコの役なら、名前を入れかえた形（同じ役なら同じ参照・role-swap.js）
    return { ...found, challenge: challengeForRole(found.challenge, role) };
};

/**
 * いまのチャレンジの役（#2061）。役の無いチャレンジ・レッスンモードでないときは null。
 * @param {object} state - Redux の state。
 * @returns {?{role: string, source: string}} 役と、どう決めたか。
 */
const getCurrentRole = (state) => {
    const { role, roleSource } = state.scratchGui.lessonMode;
    return isRole(role) ? { role, source: roleSource || ROLE_SOURCES.DEFAULT } : null;
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
 * Ruby タブを日本語モードに切りかえてよいか。レッスンモードでなければ切りかえてよい。レッスンモードの
 * あいだは、いまのレッスンの `allowDnclMode`（書いていなければ不可・#1741）。
 * @param {object} state - Redux の state。
 * @returns {boolean} 切りかえてよいとき true。
 */
const getLessonDnclModeAllowed = (state) => {
    const found = getCurrentChallenge(state);
    return found ? found.lesson.allowDnclMode === true : true;
};

/**
 * ヒントの吹き出しの状態（見た目は吹き出しの実装が作る）。
 * @param {object} state - Redux の state。
 * @returns {?{visible: boolean, minimized: boolean, index: number, count: number, step: ?object, spotlight: boolean,
 *   lastResort: boolean, debug: Array<object>, code: ?(string|object), session: number}}
 *   レッスンモードでなければ null。`step` はいまのヒント（最後の手段のページでは null）。
 *   `spotlight` はこのページで周りを暗くするか（はじめて開いたチャレンジ、かつ `step.spotlight`）。
 *   `session` はチャレンジを開いた回数（吹き出しの key。開き直したら中の状態を捨てる）。
 *   `lastResort` は最後の手段のページ（`debug` = うまく動かないときは、`code` = プログラムを入れる）か。
 */
const getCurrentHint = (state) => {
    const found = getCurrentChallenge(state);
    if (!found) return null;
    const { hintVisible, hintIndex, hintMinimized, hintSession, hintSpotlight } = state.scratchGui.lessonMode;
    const { steps, debug, code } = found.challenge;
    const step = steps[hintIndex] || null;
    return {
        visible: hintVisible,
        // 小さくして札だけを残しているか（visible とは同時に true にならない）
        minimized: Boolean(hintMinimized) && !hintVisible,
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
    solvePartQuiz,
    missPartQuiz,
    answerReadiness,
    nextReadiness,
    markReadinessOfferedAction as markReadinessOffered,
    showHint,
    hideHint,
    finishHint,
    nextHint,
    prevHint,
    markChallengeCompleted,
    reloadProgress,
    clearProgress,
    requestProgressSend,
    dismissCompleted,
    hideCompleted,
    showCompleted,
    focusLessonsLibrary,
    focusLessonsLibraryStart,
    clearLessonsLibraryFocus,
    setLibraryAssignmentOnly,
    isLessonMode,
    getCurrentChallenge,
    getCurrentRole,
    setLessonRole,
    getLessonAllowedBlocks,
    getLessonDnclModeAllowed,
    getCurrentHint,
};
