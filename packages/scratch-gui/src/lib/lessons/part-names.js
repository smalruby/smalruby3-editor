// 「なまえ」の札（#2133）。画面の部分（タブ・パレット・コードエリア・ステージ・旗と止める・スプライトリスト・
// 背景・課題バー・ヒント）に名前の札を重ねて出す。部分の DOM の探し方はヒントの吹き出しと同じ
// （hint-targets.js の findHintTargetRect）。札の置き方は純粋関数にして unit テストで確かめる。
import { HINT_TARGETS, findHintTargetRect } from './hint-targets';

/** 課題バーの「なまえ」を押したときに札を出しておく時間（ms）。 */
export const PART_NAMES_DURATION_MS = 6000;

// 札を出す部分（先に書いたものから置く）。小さな部分（ボタン・タブ）は、札で隠すと押す場所が
// わからなくなるので、外側に置き、ほかの札でも隠さない（small）。広い部分は中の左上に置く。
// label は locale の `gui.lessonPartNames.<label>`
export const PART_NAMES = Object.freeze([
    { target: HINT_TARGETS.TASK_BAR, label: 'taskBar', sides: ['below-center'] },
    { target: HINT_TARGETS.HINT_BUTTON, label: 'hint', sides: ['below', 'left'], small: true },
    { target: HINT_TARGETS.CODE_TAB, label: 'codeTab', sides: ['below', 'right'], small: true },
    { target: HINT_TARGETS.COSTUMES_TAB, label: 'costumesTab', sides: ['below', 'right'], small: true },
    { target: HINT_TARGETS.SOUNDS_TAB, label: 'soundsTab', sides: ['below', 'right'], small: true },
    { target: HINT_TARGETS.GREEN_FLAG, label: 'greenFlag', sides: ['below', 'left'], small: true },
    { target: HINT_TARGETS.STOP_BUTTON, label: 'stop', sides: ['below', 'right'], small: true },
    { target: HINT_TARGETS.PALETTE, label: 'palette', sides: ['inside'] },
    { target: HINT_TARGETS.CODE_AREA, label: 'codeArea', sides: ['inside'] },
    { target: HINT_TARGETS.STAGE, label: 'stage', sides: ['inside'] },
    { target: HINT_TARGETS.SPRITE_LIST, label: 'spriteList', sides: ['inside'] },
    { target: HINT_TARGETS.BACKDROP, label: 'backdrop', sides: ['inside'] },
]);

/**
 * いま画面にある部分の矩形を探す（見つからない部分は出さない）。
 * @param {Document} doc - 探す document。
 * @returns {Array<{label: string, rect: object, sides: Array<string>, small: boolean}>} 見つかった部分（PART_NAMES の順）。
 */
export const findPartNameRects = (doc) =>
    PART_NAMES.map((part) => ({ ...part, rect: findHintTargetRect(part.target, doc), small: Boolean(part.small) }))
        .filter((part) => part.rect !== null)
        .map(({ target, ...part }) => part);

const overlapArea = (a, b) =>
    Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)) *
    Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));

const clamp = (v, min, max) => Math.min(Math.max(v, min), max);

// 置く側ごとの、札の左上の候補（最初のものほど部分に近い）。札どうしが重なるときのために、
// 部分の外に置くものは横に、中に置くものは下にずらした候補も作る
const candidatesFor = (side, rect, size, gap) => {
    const { width: w, height: h } = size;
    const step = (n, len) =>
        Array.from({ length: 2 * n + 1 }, (_, i) => (i % 2 === 1 ? 1 : -1) * Math.ceil(i / 2) * len);
    const centerX = (rect.left + rect.right) / 2 - w / 2;
    const centerY = (rect.top + rect.bottom) / 2 - h / 2;
    switch (side) {
        case 'below':
            return step(3, w / 2 + gap).map((dx) => ({ left: rect.left + dx, top: rect.bottom + gap }));
        case 'below-center':
            return step(6, w / 2 + gap).map((dx) => ({ left: centerX + dx, top: rect.bottom + gap }));
        case 'right':
            return step(2, h + gap).map((dy) => ({ left: rect.right + gap, top: centerY + dy }));
        case 'left':
            return step(2, h + gap).map((dy) => ({ left: rect.left - gap - w, top: centerY + dy }));
        case 'inside':
        default: {
            // 左の端を上から下へ、次に札 1 つぶん右の列を上から下へ（ヒントの吹き出しが上にかぶっていても、
            // 部分の中のどこかに置ける）。部分の外へは出さない（画面の端で切れたときは最後に画面の内側へ寄せる）
            const rows = Math.max(1, Math.min(24, Math.floor((rect.bottom - rect.top - gap) / (h + gap))));
            const cols = Math.max(1, Math.min(8, Math.floor((rect.right - rect.left - gap) / (w + gap))));
            return Array.from({ length: rows * cols }, (_, i) => ({
                left: rect.left + gap + Math.floor(i / rows) * (w + gap),
                top: rect.top + gap + (i % rows) * (h + gap),
            }));
        }
    }
};

/**
 * 札の置き方を決める。どの札も画面（margin の内側）からはみ出さず、ほかの札・小さな部分（ボタン・タブ）・
 * かぶせない矩形（ヒントの吹き出しなど）に重ならない候補を、部分に近いものから選ぶ。重ならない候補が
 * 無いときは、重なりがいちばん小さいものに置く。
 * @param {object} args - 引数。
 * @param {Array<{label: string, rect: object, sides: Array<string>, small: ?boolean}>} args.parts - 部分
 *   （`findPartNameRects`）。先に書いたものから置く。
 * @param {{[label: string]: {width: number, height: number}}} args.sizes - 札の大きさ（label ごと。無い札は置かない）。
 * @param {{width: number, height: number}} args.viewport - 画面の大きさ。
 * @param {Array<object>} [args.avoid] - かぶせない矩形。
 * @param {number} [args.gap] - 部分と札のすき間。
 * @param {number} [args.margin] - 画面の端から空ける幅。
 * @returns {Array<{label: string, left: number, top: number, width: number, height: number}>} 札の置き場所。
 */
export const computePartNameLayout = ({ parts, sizes, viewport, avoid = [], gap = 4, margin = 4 }) => {
    const placed = [];
    const smallRects = parts.filter((part) => part.small).map((part) => part.rect);
    parts.forEach((part) => {
        const size = sizes[part.label];
        if (!size || !(size.width > 0) || !(size.height > 0)) return;
        const maxLeft = Math.max(margin, viewport.width - size.width - margin);
        const maxTop = Math.max(margin, viewport.height - size.height - margin);
        const blockers = [
            ...placed,
            ...avoid,
            // 自分の部分は小さくても重ねてよい（外に置けないときに中に置く）
            ...smallRects.filter((r) => r !== part.rect),
        ];
        let best = null;
        for (const side of part.sides) {
            for (const c of candidatesFor(side, part.rect, size, gap)) {
                const left = clamp(c.left, margin, maxLeft);
                const top = clamp(c.top, margin, maxTop);
                const box = { left, top, right: left + size.width, bottom: top + size.height };
                const score = blockers.reduce((sum, b) => sum + overlapArea(box, b), 0);
                if (best === null || score < best.score) best = { box, score };
                if (score === 0) break;
            }
            if (best && best.score === 0) break;
        }
        placed.push({ ...best.box, label: part.label });
    });
    return placed.map((box) => ({
        label: box.label,
        left: box.left,
        top: box.top,
        width: box.right - box.left,
        height: box.bottom - box.top,
    }));
};
