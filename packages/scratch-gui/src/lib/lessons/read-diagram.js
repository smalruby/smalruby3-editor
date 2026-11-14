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
    answerOf: {
        id: `${P}answerOf`,
        defaultMessage: 'Program of {name}',
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

// 答えのページの見出しの名前（アクティビティ図の見出しと同じ文言・activity-diagram.locale.js）
const CODE_SPRITE_NAME = { id: 'gui.lessons.activityDiagram.codeSprite', defaultMessage: 'Cat' };
const STAGE_NAME = { id: 'gui.lessons.activityDiagram.stage', defaultMessage: 'Stage' };

/**
 * 答えのプログラムがあるか（`code` か `spriteCodes` のどちらか）。無いと、図も答えのページの絵も出ない。
 * @param {object} challenge - チャレンジ。
 * @returns {boolean} あれば true。
 */
export const hasAnswerProgram = (challenge) =>
    Boolean(challenge && (challenge.code || (challenge.spriteCodes || []).some((s) => s && s.code)));

/**
 * 答えのページに描くプログラムと、その見出し。`code` があればそれを、無ければ `spriteCodes` の最初のものを描く
 * （ページを 3 つに保つため、描くのは 1 つ。ほかのスプライトの答えは図で見る）。
 * 見出し（「ネコのプログラム」）は、プログラムが 2 つ以上あるとき（どのスプライトのものかがわからないとき）だけ付ける。
 * @param {object} challenge - チャレンジ。
 * @param {?(string|object)} [challenge.code] - 答えのプログラム。
 * @param {?string} [challenge.codeTarget] - `code` を入れる相手（'stage' ならステージ）。
 * @param {Array<{sprite: string, code: (string|object)}>} [challenge.spriteCodes] - ほかのスプライトの答え。
 * @returns {{blocks: ?(string|object), label: ?{message: object, name: (object|string)}}} 描くものと見出し。
 *   見出しの `name` は message descriptor（ネコ・ステージ）か、スプライトの名前の文字列。
 */
export const readDiagramAnswer = ({ code = null, codeTarget = null, spriteCodes = [] }) => {
    const sprites = (spriteCodes || []).filter((s) => s && s.code);
    const sources = (code ? 1 : 0) + sprites.length;
    let blocks = null;
    let name = null;
    if (code) {
        blocks = code;
        name = codeTarget === 'stage' ? STAGE_NAME : CODE_SPRITE_NAME;
    } else if (sprites.length > 0) {
        blocks = sprites[0].code;
        name = sprites[0].sprite;
    }
    return { blocks, label: sources > 1 ? { message: readDiagramMessages.answerOf, name } : null };
};

/**
 * 「読んで作る」チャレンジのヒントのページ（defineChallenge の `steps` の形）を作る。
 * 吹き出しはステージの左（コードエリアの右側）に出す。パレットと、生徒が組み立てているコードエリアの
 * 左側を隠さないため。図は 1 ページ目に吹き出しが描く（`activityDiagram`）。
 * @param {object} challenge - チャレンジの定義。
 * @param {?object} [challenge.explanation] - 1 ページ目の説明（message descriptor）。無ければ `task`。
 * @param {?object} [challenge.task] - 課題の 1 行（message descriptor）。
 * @param {?(string|object)} [challenge.code] - 答えのプログラム（3 ページ目に描く。locale ごとでもよい）。
 * @param {?string} [challenge.codeTarget] - `code` を入れる相手。
 * @param {Array<object>} [challenge.spriteCodes] - ほかのスプライトの答え（`code` が無ければ最初のものを描く）。
 * @returns {Array<{kind: string, title: ?object, note: ?object, target: string, blocks: ?(string|object),
 *   label: ?object, spotlight: boolean}>} 3 ページ。`kind` = `read` / `try` / `answer`。
 */
export const readDiagramSteps = ({
    explanation = null,
    task = null,
    code = null,
    codeTarget = null,
    spriteCodes = [],
}) => {
    const answer = readDiagramAnswer({ code, codeTarget, spriteCodes });
    return [
        {
            kind: 'read',
            title: explanation || task || null,
            note: readDiagramMessages.answerAtEnd,
            target: HINT_TARGETS.STAGE,
            blocks: null,
            label: null,
            spotlight: false,
        },
        {
            kind: 'try',
            title: readDiagramMessages.try,
            note: null,
            target: HINT_TARGETS.STAGE,
            blocks: null,
            label: null,
            spotlight: false,
        },
        {
            kind: 'answer',
            title: readDiagramMessages.answer,
            note: null,
            target: HINT_TARGETS.STAGE,
            // 答えを見くらべるには全体が要るので、スクリプト全体を描く（手順のページの「描くのは相手と
            // 置くブロックまで」の例外）
            blocks: answer.blocks,
            label: answer.label,
            spotlight: false,
        },
    ];
};

/**
 * 「読んで作る」チャレンジの定義に、この形の決まりを当てはめる（defineChallenge が呼ぶ）。
 * 図は必ず出し（`activityDiagram: true`）、ヒントは 3 ページに置き換える（定義の `steps` は使わない）。
 * ふつうのチャレンジはそのまま返す。答えのプログラムが無い定義は、開発のときだけ警告する（図も答えの絵も
 * 出なくなるため。本番では投げずにそのまま動かす。定義の誤りは courses.test.js が止める）。
 * @param {object} challenge - 既定値を埋めたチャレンジ。
 * @returns {object} 決まりを当てはめたチャレンジ。
 */
export const applyChallengeMode = (challenge) => {
    if (!isReadDiagram(challenge)) return challenge;
    if (!hasAnswerProgram(challenge) && process.env.NODE_ENV !== 'production') {
        // eslint-disable-next-line no-console
        console.warn(
            `[lessons] read-and-build challenge "${challenge.id}" has no answer program (code or spriteCodes)`,
        );
    }
    return { ...challenge, activityDiagram: true, steps: readDiagramSteps(challenge) };
};
