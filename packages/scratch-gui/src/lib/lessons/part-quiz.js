// 「どこでしょう？」のクイズ（#2134）。「パレットはどこ？」のように画面の部分の名前を出し、生徒が画面をクリックして
// 答える。部分の名前と場所は「なまえ」の札（part-names.js）と同じ（label = PART_NAMES の label、場所の探し方 =
// hint-targets.js の findHintTargetRect）。ここは判定の純粋関数だけで、クリックを受けるのは
// components/lesson-part-quiz/。
import { findHintTargetRect } from './hint-targets';
import { PART_NAMES } from './part-names';

/** まちがえたときに、正しい場所を光らせておく時間（ms）。 */
export const PART_QUIZ_REVEAL_MS = 2500;

/**
 * 部分の名前（label）から、指す場所（HINT_TARGETS）。
 * @param {string} label - PART_NAMES の label（例: `palette`）。
 * @returns {?string} 場所。知らない label は null。
 */
export const partQuizTarget = (label) => {
    const part = PART_NAMES.find((p) => p.label === label);
    return part ? part.target : null;
};

/**
 * チャレンジの `partQuiz` の形を確かめる（定義の誤りをテストで見つけるため。アプリでは投げない）。
 * @param {*} quiz - チャレンジの `partQuiz`（`{questions: [label, ...]}`）。
 * @returns {Array<string>} 誤り（無ければ空）。
 */
export const validatePartQuiz = (quiz) => {
    if (!quiz || typeof quiz !== 'object' || !Array.isArray(quiz.questions) || quiz.questions.length === 0) {
        return ['partQuiz.questions must be a non-empty array of part names'];
    }
    const errors = [];
    quiz.questions.forEach((label, i) => {
        if (partQuizTarget(label) === null) errors.push(`partQuiz.questions[${i}]: unknown part name ${label}`);
    });
    if (new Set(quiz.questions).size !== quiz.questions.length) errors.push('partQuiz.questions must be unique');
    return errors;
};

/**
 * 点が矩形の中か（端をふくむ）。
 * @param {{x: number, y: number}} point - 点（画面の座標）。
 * @param {?{left: number, top: number, right: number, bottom: number}} rect - 矩形。
 * @returns {boolean} 中なら true。
 */
export const isPointInRect = (point, rect) =>
    Boolean(rect) && point.x >= rect.left && point.x <= rect.right && point.y >= rect.top && point.y <= rect.bottom;

/**
 * クリックした場所が、問いの部分か。
 * @param {string} label - 問いの部分の名前（PART_NAMES の label）。
 * @param {{x: number, y: number}} point - クリックした点（画面の座標）。
 * @param {Document} doc - 探す document。
 * @returns {boolean} 正しければ true。部分が画面に無いときは false。
 */
export const isPartQuizAnswer = (label, point, doc) => {
    const target = partQuizTarget(label);
    return target !== null && isPointInRect(point, findHintTargetRect(target, doc));
};
