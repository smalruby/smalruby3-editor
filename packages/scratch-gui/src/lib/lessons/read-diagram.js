// === Smalruby: This file is Smalruby-specific (lessons: read-and-build challenge) ===
// 「読んで作る」チャレンジ（チャレンジの定義の `mode: 'readDiagram'`）のヒントのページを作る純粋関数。
// 説明とアクティビティ図だけで指示するチャレンジで、ヒントは 3 ページだけ:
//   ① 図と説明（チャレンジを始めたら自動で開く。最後のページに答えがあることを伝える）
//   ② 試すページ（答えを見る前に、自分のプログラムを動かして試してもらう）
//   ③ 答えを見るページ（答えのプログラムを吹き出しの中に本物のブロックで描くだけ。生徒のプログラムは
//      置き換えない）
// 「正解のプログラムを確認する」（置き換え）の最後の手段のページは持たない。置き換えると、そのまま
// 動かすだけで「できた」になってしまうため（docs/lessons/design.md の「アクティビティ図」の「読んで作る」）。
import { HINT_TARGETS } from './hint-targets';

/** チャレンジの形（定義の `mode`）。無ければ（null）ふつうのチャレンジ。 */
export const CHALLENGE_MODES = Object.freeze({
    READ_DIAGRAM: 'readDiagram',
});

/** 「読んで作る」チャレンジのヒントのページ数。 */
export const READ_DIAGRAM_HINT_PAGES = 3;

// ヒントの文言（どの「読んで作る」チャレンジにも共通。src/locales/{en,ja,ja-Hira}.js）
const P = 'gui.lessonHint.readDiagram.';
export const readDiagramMessages = Object.freeze({
    answerAtEnd: {
        id: `${P}answerAtEnd`,
        defaultMessage:
            'Read the diagram and the explanation, and make the program yourself. The answer is on the last page of the hint.',
    },
    try: {
        id: `${P}try`,
        defaultMessage:
            'When you have made it, run it and try it. Does it work like the diagram? If not, read the diagram again and fix it. You can see the answer on the next page.',
    },
    answer: {
        id: `${P}answer`,
        defaultMessage: 'This is the answer. Compare it with your program. Your program stays as it is.',
    },
});

/**
 * 「読んで作る」チャレンジか。
 * @param {?object} challenge - チャレンジ（定義でも defineChallenge の形でもよい）。
 * @returns {boolean} `mode` が 'readDiagram' のとき true。
 */
export const isReadDiagram = (challenge) => Boolean(challenge && challenge.mode === CHALLENGE_MODES.READ_DIAGRAM);

/**
 * 「読んで作る」チャレンジのヒントのページ（defineChallenge の `steps` の形）を作る。
 * 吹き出しはステージの左（コードエリアの右側）に出す。パレットと、生徒が組み立てているコードエリアの
 * 左側を隠さないため。図は 1 ページ目に吹き出しが描く（`activityDiagram`）。
 * @param {object} challenge - チャレンジの定義。
 * @param {?object} [challenge.explanation] - 1 ページ目の説明（message descriptor）。無ければ `task`。
 * @param {?object} [challenge.task] - 課題の 1 行（message descriptor）。
 * @param {?(string|object)} [challenge.code] - 答えのプログラム（3 ページ目に描く。locale ごとでもよい）。
 * @returns {Array<{kind: string, title: ?object, note: ?object, target: string, blocks: ?(string|object),
 *   spotlight: boolean}>} 3 ページ。`kind` = `read` / `try` / `answer`。
 */
export const readDiagramSteps = ({ explanation = null, task = null, code = null }) => [
    {
        kind: 'read',
        title: explanation || task || null,
        note: readDiagramMessages.answerAtEnd,
        target: HINT_TARGETS.STAGE,
        blocks: null,
        spotlight: false,
    },
    {
        kind: 'try',
        title: readDiagramMessages.try,
        note: null,
        target: HINT_TARGETS.STAGE,
        blocks: null,
        spotlight: false,
    },
    {
        kind: 'answer',
        title: readDiagramMessages.answer,
        note: null,
        target: HINT_TARGETS.STAGE,
        // 答えを見くらべるには全体が要るので、スクリプト全体を描く（手順のページの「描くのは相手と
        // 置くブロックまで」の例外）
        blocks: code,
        spotlight: false,
    },
];

/**
 * 「読んで作る」チャレンジの定義に、この形の決まりを当てはめる（defineChallenge が呼ぶ）。
 * 図は必ず出し（`activityDiagram: true`）、ヒントは 3 ページに置き換える（定義の `steps` は使わない）。
 * ふつうのチャレンジはそのまま返す。
 * @param {object} challenge - 既定値を埋めたチャレンジ。
 * @returns {object} 決まりを当てはめたチャレンジ。
 */
export const applyChallengeMode = (challenge) =>
    isReadDiagram(challenge)
        ? { ...challenge, activityDiagram: true, steps: readDiagramSteps(challenge) }
        : challenge;
