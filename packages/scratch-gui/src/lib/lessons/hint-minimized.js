// 小さくしたヒントの札（components/lesson-hint/lesson-hint-minimized.jsx）の純粋関数。
// ヒントの吹き出しは閉じずに小さくでき、課題バーの近くに「いまのページの番号と短い見出し」の札として残る。
// 子どもはヒントを読んで操作するときに閉じてしまい、手順を見失っていた（#2129 の F2）ので、
// 小さくしても消えず、押せば同じページで元の大きさにもどる。
import { splitEmphasis } from './hint-text';

/** 札に出す見出しの長さ（字）。これより長いときは … で切る（札を小さく保つ。全文は戻して読む）。 */
export const MINIMIZED_HEADING_MAX = 24;

/**
 * 札に出す短い見出し。ヒントの文言の最初の文（改行・「。」・「. 」まで）から、強調の記号（`**`）を外して作る。
 * @param {?string} text - ヒントの文言（formatMessage したもの）。無ければ空。
 * @param {number} [max] - いちばん長い字数。
 * @returns {string} 見出し（無ければ空文字）。
 */
export const shortHintHeading = (text, max = MINIMIZED_HEADING_MAX) => {
    if (!text) return '';
    const plain = splitEmphasis(String(text))
        .map((part) => part.text)
        .join('')
        .trim();
    const firstLine = plain.split(/\r?\n/)[0];
    const sentence = firstLine.match(/^(.+?[。！？!?]|.+?\.(?=\s))/u);
    const head = (sentence ? sentence[1] : firstLine).trim();
    const chars = Array.from(head);
    return chars.length > max ? `${chars.slice(0, max).join('')}…` : head;
};

/**
 * 札を置く場所（viewport 座標の左上）。課題バーのすぐ下で、バーの「ヒント」ボタンの下に右をそろえる。
 * ステージの列（旗・止める・ステージの大きさのボタン）が下にあるときは、その左（コードエリアの右上）へずらし、
 * ステージの操作をじゃましない。そこがパレットにかかるとき（SP の狭い画面）は、パレットの右へずらす。
 * 画面の外には出さない。
 * @param {object} args - 引数。
 * @param {?{left: number, top: number, right: number, bottom: number}} args.bar - 課題バーの矩形（無ければ null）。
 * @param {?{left: number, top: number, right: number, bottom: number}} args.hintButton - バーの「ヒント」ボタンの矩形。
 * @param {?{left: number, top: number, right: number, bottom: number}} args.stage - ステージの列の矩形（見えなければ null）。
 * @param {?{left: number, top: number, right: number, bottom: number}} [args.palette] - パレットの矩形（見えなければ null）。
 * @param {{width: number, height: number}} args.chip - 札の大きさ。
 * @param {{left: number, top: number, width: number, height: number}} args.viewport - 使える画面（hintViewport）。
 * @param {number} [args.gap] - バー・ステージの列から空ける幅（px）。
 * @param {number} [args.margin] - 画面の端から空ける幅（px）。
 * @returns {{left: number, top: number}} 札の左上。
 */
export const minimizedHintPosition = ({
    bar,
    hintButton,
    stage,
    palette = null,
    chip,
    viewport,
    gap = 6,
    margin = 8,
}) => {
    const top = (bar ? bar.bottom : viewport.top) + gap;
    let right = hintButton ? hintButton.right : viewport.width - margin;
    // 札の高さの帯にステージの列がかかっていて、札の右の端がその中に入るなら、ステージの列の左へ出す
    const overlapsStage =
        stage &&
        stage.right - stage.left > 0 &&
        stage.top < top + chip.height &&
        stage.bottom > top &&
        right > stage.left &&
        right - chip.width < stage.right;
    if (overlapsStage) right = stage.left - gap;
    const minLeft = (viewport.left || 0) + margin;
    const maxLeft = viewport.width - margin - chip.width;
    let left = Math.max(minLeft, Math.min(right - chip.width, maxLeft));
    const overlapsPalette =
        palette &&
        palette.right - palette.left > 0 &&
        palette.top < top + chip.height &&
        palette.bottom > top &&
        left < palette.right &&
        left + chip.width > palette.left;
    // パレットの右に入るときだけずらす（入らなければ、ずらしてもステージか画面の外にかかるので、そのまま）
    if (overlapsPalette && palette.right + gap <= (overlapsStage ? right : viewport.width - margin) - chip.width) {
        left = palette.right + gap;
    }
    const maxTop = viewport.height - margin - chip.height;
    return { left, top: Math.max(0, Math.min(top, maxTop)) };
};
