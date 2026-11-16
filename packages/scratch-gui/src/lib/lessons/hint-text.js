// ヒントの文言の決まり（純粋関数）。描くのは components/lesson-hint。
//
// - 強調: 文言の `**…**` で囲んだところを強調して出す（ja / ja-Hira / en で同じ書き方）。スプライトを足すと
//   えらばれているスプライトが変わるので「シマラビをえらびなおして」のような見落としやすいところに使う。
//   文言は HTML として扱わない（React の文字として出す）ので、訳に `<` などが入っても安全。
// - クラスの中と外: 手順の `classroomTitle` があれば、クラスに参加中の生徒（出席番号でつながる人）には
//   `title` の代わりにそれを出す。メッシュのつなぎ方がクラスの中と外で違う（クラスの中では「ホストになる」が
//   たたまれて、出席番号でつながる）ため。
import { computeBoundSeat } from '../mesh-v2-classroom-binding.jsx';

const EMPHASIS = /\*\*([^*]+)\*\*/g;

/**
 * 文言を、強調するところとしないところに分ける。閉じていない `**` はそのまま文字として残す。
 * @param {string} text - 文言。
 * @returns {Array<{text: string, strong: boolean}>} 分けたもの（空の部分は入れない）。
 */
export const splitEmphasis = (text) => {
    if (typeof text !== 'string' || text === '') return [];
    const parts = [];
    let last = 0;
    for (const match of text.matchAll(EMPHASIS)) {
        if (match.index > last) parts.push({ text: text.slice(last, match.index), strong: false });
        parts.push({ text: match[1], strong: true });
        last = match.index + match[0].length;
    }
    if (last < text.length) parts.push({ text: text.slice(last), strong: false });
    return parts;
};

/**
 * ヒントのページに出す文言（message descriptor）。クラスに参加中の生徒で、手順に `classroomTitle` が
 * あればそれ、ほかは `title`。
 * @param {?object} step - ヒントの手順。
 * @param {object} [context] - いまの状態。
 * @param {boolean} [context.inClassroom] - クラスに参加中の生徒（出席番号がある）か。
 * @returns {?object} 文言（message descriptor）。無ければ null。
 */
export const hintStepTitle = (step, { inClassroom = false } = {}) => {
    if (!step) return null;
    if (inClassroom && step.classroomTitle) return step.classroomTitle;
    return step.title || null;
};

/**
 * クラスに参加中の生徒（メッシュの接続モーダルが「出席番号でつながる」を出す人）か。接続モーダルと同じ
 * 判定（computeBoundSeat）を使う。先生・クラスの外・出席番号の無い生徒は false。
 * @param {?object} classroom - state.scratchGui.classroom。
 * @returns {boolean} クラスに参加中の生徒か。
 */
export const isSeatedStudent = (classroom) => {
    const seat = computeBoundSeat(classroom);
    return Boolean(seat && !seat.teacher);
};
