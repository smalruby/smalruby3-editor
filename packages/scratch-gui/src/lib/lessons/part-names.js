// 名前の札（「ガイド」）（#2133）。画面の部分（タブ・ブロックパレット・スクリプトエリア・ステージ・緑の旗と停止ボタン・
// スプライトペイン・背景・課題バー・ヒント）に名前の札を重ねて出す。部分の DOM の探し方はヒントの吹き出しと同じ
// （hint-targets.js の findHintTargetRect）。札の置き方は純粋関数にして unit テストで確かめる。
import { HINT_TARGETS, findHintTargetRect } from './hint-targets';

/** 課題バーの「ガイド」を押したときに札を出しておく時間（ms）。 */
export const PART_NAMES_DURATION_MS = 6000;

// 札を押したときに押す部品の探し方（小さな部分だけ）。hint-targets.js の TARGET_SPECS と同じ候補を同じ順に書く
// （同じ部品を見つけることを test/unit/lib/lessons/part-names.test.js が確かめる）。緑の旗・停止ボタンは img が
// 見つかるので、押すのはそれを包むボタン（clickPartNameTarget）
const CLICK_SELECTORS = Object.freeze({
    hint: ['[data-testid="lesson-task-bar-hint"]'],
    codeTab: ['[data-testid="mobile-side-rail-code"]', '[class*="gui_tab_"]:nth-child(1)'],
    costumesTab: ['[data-testid="mobile-side-rail-costume"]', '[class*="gui_tab_"]:nth-child(2)'],
    soundsTab: ['[data-testid="mobile-side-rail-sound"]', '[class*="gui_tab_"]:nth-child(3)'],
    rubyTab: ['[data-testid="mobile-side-rail-ruby"]', '[class*="gui_tab_"]:nth-child(4)'],
    greenFlag: ['[data-testid="mobile-side-rail-play"]', '[class*="green-flag_green-flag_"]'],
    stop: ['[class*="stop-all_stop-all_"]'],
});

// 札を出す部分（先に書いたものから置く）。小さな部分（ボタン・タブ）は、札で隠すと押す場所が
// わからなくなるので、外側に置き、ほかの札でも隠さない（small）。外側の札は部分を指すしっぽの付いた吹き出しにし、
// 押すと部分を押したことにする（札だけを見て押しても、何も起きないことが無いように）。広い部分は中の左上に置く。
// label は locale の `gui.lessonPartNames.<label>`。名前は Scratch Wiki「Scratchユーザーインターフェース (3.0)」に
// 合わせる（Wiki に無い課題バー・ヒント・ルビータブ・背景はスモウルビー独自。docs/lessons/design.md）
export const PART_NAMES = Object.freeze([
    { target: HINT_TARGETS.TASK_BAR, label: 'taskBar', sides: ['below-center'] },
    { target: HINT_TARGETS.HINT_BUTTON, label: 'hint', sides: ['below', 'left'], small: true },
    { target: HINT_TARGETS.CODE_TAB, label: 'codeTab', sides: ['below', 'right'], small: true },
    { target: HINT_TARGETS.COSTUMES_TAB, label: 'costumesTab', sides: ['below', 'right'], small: true },
    { target: HINT_TARGETS.SOUNDS_TAB, label: 'soundsTab', sides: ['below', 'right'], small: true },
    { target: HINT_TARGETS.RUBY_TAB, label: 'rubyTab', sides: ['below', 'right'], small: true },
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

const isVisible = (el) => {
    const r = el.getBoundingClientRect();
    return r.right - r.left > 0 && r.bottom - r.top > 0;
};

/**
 * 小さな部分の札を押したときに押す部品を探す（候補のうち、最初に見えたもの）。
 * @param {string} label - 札の名前（`PART_NAMES` の label）。
 * @param {Document} doc - 探す document。
 * @returns {?Element} 押す部品。広い部分・画面に無い部分は null。
 */
export const findPartNameClickTarget = (label, doc) => {
    const selectors = CLICK_SELECTORS[label];
    if (!selectors || !doc) return null;
    for (const selector of selectors) {
        const found = Array.from(doc.querySelectorAll(selector)).find(isVisible);
        if (found) return found;
    }
    return null;
};

/**
 * 小さな部分の札を押したとき、その部分を押す（ボタンの中の絵が見つかったときは、包むボタンを押す）。
 * @param {string} label - 札の名前。
 * @param {Document} doc - document。
 * @returns {boolean} 押す部品があったか。
 */
export const clickPartNameTarget = (label, doc) => {
    const found = findPartNameClickTarget(label, doc);
    if (!found) return false;
    const control = (found.closest && found.closest('button, [role="tab"]')) || found;
    control.click();
    return true;
};

const overlapArea = (a, b) =>
    Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)) *
    Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));

const clamp = (v, min, max) => Math.min(Math.max(v, min), max);

// 札を置いた側から、しっぽを出す札の辺（`top` なら札の上の辺から上の部分を指す）
const ARROW_ORDER = {
    below: ['top', 'left', 'right', 'bottom'],
    right: ['left', 'top', 'bottom', 'right'],
    left: ['right', 'top', 'bottom', 'left'],
};

/**
 * 小さな部分の札（吹き出し）のしっぽ。札が部分のどちら側にあるかで辺を決め、辺の上では部分の真ん中に向ける
 * （札の角からは出さない）。札が部分に重なっているときは、しっぽを出さない。
 * @param {object} box - 札の矩形。
 * @param {object} rect - 部分の矩形。
 * @param {string} side - 札を置いた側（`below` / `right` / `left`）。
 * @param {number} edge - しっぽを札の角から離す幅。
 * @returns {?{side: string, offset: number}} しっぽを出す辺と、辺の始め（上・下の辺は左、左・右の辺は上）からの位置。
 */
const arrowFor = (box, rect, side, edge) => {
    const along = (center, start, len) =>
        clamp(center - start, Math.min(edge, len / 2), Math.max(len - edge, len / 2));
    const cx = (rect.left + rect.right) / 2;
    const cy = (rect.top + rect.bottom) / 2;
    const w = box.right - box.left;
    const h = box.bottom - box.top;
    const fits = {
        top: box.top >= rect.bottom,
        bottom: box.bottom <= rect.top,
        left: box.left >= rect.right,
        right: box.right <= rect.left,
    };
    const arrowSide = (ARROW_ORDER[side] || ARROW_ORDER.below).find((s) => fits[s]);
    if (!arrowSide) return null;
    const offset = arrowSide === 'top' || arrowSide === 'bottom' ? along(cx, box.left, w) : along(cy, box.top, h);
    return { side: arrowSide, offset };
};

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
 * 無いときは、重なりがいちばん小さいものに置く。小さな部分の札は、しっぽの入るすき間（arrowGap）を空けて外に置き、
 * 部分を指すしっぽ（`arrow`）を返す。
 * @param {object} args - 引数。
 * @param {Array<{label: string, rect: object, sides: Array<string>, small: ?boolean}>} args.parts - 部分
 *   （`findPartNameRects`）。先に書いたものから置く。
 * @param {{[label: string]: {width: number, height: number}}} args.sizes - 札の大きさ（label ごと。無い札は置かない）。
 * @param {{width: number, height: number}} args.viewport - 画面の大きさ。
 * @param {Array<object>} [args.avoid] - かぶせない矩形。
 * @param {number} [args.gap] - 部分と札のすき間。
 * @param {number} [args.margin] - 画面の端から空ける幅。
 * @param {number} [args.arrowGap] - 小さな部分と札のすき間（しっぽが入る）。
 * @param {number} [args.arrowEdge] - しっぽを札の角から離す幅。
 * @returns {Array<{label: string, left: number, top: number, width: number, height: number, small: boolean,
 *   arrow: ?{side: string, offset: number}}>} 札の置き場所（`arrow` は小さな部分の札のしっぽ。広い部分は null）。
 */
export const computePartNameLayout = ({
    parts,
    sizes,
    viewport,
    avoid = [],
    gap = 4,
    margin = 4,
    arrowGap = 10,
    arrowEdge = 10,
}) => {
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
            // 小さな部分は自分の部分にもかぶせない（札が部分を隠すと押す場所がわからない。どこにも置けないときだけ、
            // 重なりのいちばん小さい所に置く）。広い部分の札は自分の部分の中に置く
            ...(part.small ? smallRects : smallRects.filter((r) => r !== part.rect)),
        ];
        let best = null;
        for (const side of part.sides) {
            for (const c of candidatesFor(side, part.rect, size, part.small ? arrowGap : gap)) {
                const left = clamp(c.left, margin, maxLeft);
                const top = clamp(c.top, margin, maxTop);
                const box = { left, top, right: left + size.width, bottom: top + size.height };
                const score = blockers.reduce((sum, b) => sum + overlapArea(box, b), 0);
                if (best === null || score < best.score) best = { box, score, side };
                if (score === 0) break;
            }
            if (best && best.score === 0) break;
        }
        const small = Boolean(part.small);
        const arrow = small ? arrowFor(best.box, part.rect, best.side, arrowEdge) : null;
        placed.push({ ...best.box, label: part.label, small, arrow });
    });
    return placed.map((box) => ({
        label: box.label,
        left: box.left,
        top: box.top,
        width: box.right - box.left,
        height: box.bottom - box.top,
        small: box.small,
        arrow: box.arrow,
    }));
};
