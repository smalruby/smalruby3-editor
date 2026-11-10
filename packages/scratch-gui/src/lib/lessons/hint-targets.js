// ヒントの吹き出しが指す場所（`steps[].target`）と、その場所の DOM の探し方・吹き出しの置き方。
// 場所の名前はチャレンジのデータ（courses.js）が使い、DOM の探し方と置き方は吹き出しの部品
// （components/lesson-hint/）が使う。置き方は純粋関数にして unit テストで確かめる。

/** 指す場所の名前。`keyboard` は場所の無いもの（画面の真ん中に出す）。 */
export const HINT_TARGETS = Object.freeze({
    PALETTE: 'palette',
    CODE_AREA: 'code-area',
    STAGE: 'stage',
    SPRITE_LIST: 'sprite-list',
    SOUNDS_TAB: 'sounds-tab',
    COSTUMES_TAB: 'costumes-tab',
    BACKDROP: 'backdrop',
    EXTENSION_BUTTON: 'extension-button',
    GREEN_FLAG: 'green-flag',
    KEYBOARD: 'keyboard',
});

/** 吹き出しを置く側。`inside` は指す場所の中、`center` は画面の真ん中（矢印なし）。 */
export const HINT_SIDES = Object.freeze({
    RIGHT: 'right',
    LEFT: 'left',
    BOTTOM: 'bottom',
    TOP: 'top',
    INSIDE: 'inside',
    CENTER: 'center',
});

// Blockly のワークスペースは吹き出しの中にもあるので、コードタブの Blocks の中に限る
const BLOCKS = '[class*="blocks_blocks_"]';

// DOM の探し方。selectors は候補（最初に見えたもの。`union` なら見えたもの全部を合わせた矩形）。
// Smalruby の部品（サイドレール・拡張機能のボタン）は data-testid で探す。upstream の部品は
// data-testid を持たないので CSS Modules のクラス名の接頭辞（`<css ファイル名>_<クラス名>_`。
// localIdentName は scratch-webpack-configuration の `[name]_[local]_[hash:base64:5]`）で探す。
// upstream がクラス名を変えると壊れるので、使っているクラスが css に残っているかを
// test/unit/lib/lessons/hint-targets.test.js が見張る。
// SP（MobileGui）ではサイドレールのボタン（data-testid）を先に探す。
const TARGET_SPECS = {
    [HINT_TARGETS.PALETTE]: {
        selectors: [`${BLOCKS} .blocklyFlyout`, `${BLOCKS} .blocklyToolbox`],
        union: true,
        sides: [HINT_SIDES.RIGHT, HINT_SIDES.BOTTOM, HINT_SIDES.INSIDE],
    },
    [HINT_TARGETS.CODE_AREA]: {
        selectors: [`${BLOCKS} .blocklySvg`],
        // ワークスペースの svg はパレットの下にも広がっているので、パレットの右だけにする
        subtract: [`${BLOCKS} .blocklyFlyout`, `${BLOCKS} .blocklyToolbox`],
        sides: [HINT_SIDES.INSIDE],
    },
    [HINT_TARGETS.STAGE]: {
        selectors: ['[class*="stage_stage-wrapper_"]'],
        sides: [HINT_SIDES.LEFT, HINT_SIDES.BOTTOM, HINT_SIDES.INSIDE],
    },
    [HINT_TARGETS.SPRITE_LIST]: {
        selectors: ['[data-testid="mobile-sprite-panel"]', '[class*="sprite-selector_sprite-selector_"]'],
        sides: [HINT_SIDES.LEFT, HINT_SIDES.TOP, HINT_SIDES.INSIDE],
    },
    [HINT_TARGETS.SOUNDS_TAB]: {
        selectors: ['[data-testid="mobile-side-rail-sound"]', '[class*="gui_tab_"]:nth-child(3)'],
        sides: [HINT_SIDES.BOTTOM, HINT_SIDES.RIGHT],
    },
    [HINT_TARGETS.COSTUMES_TAB]: {
        selectors: ['[data-testid="mobile-side-rail-costume"]', '[class*="gui_tab_"]:nth-child(2)'],
        sides: [HINT_SIDES.BOTTOM, HINT_SIDES.RIGHT],
    },
    [HINT_TARGETS.BACKDROP]: {
        selectors: ['[class*="stage-selector_stage-selector_"]'],
        sides: [HINT_SIDES.LEFT, HINT_SIDES.TOP, HINT_SIDES.INSIDE],
    },
    [HINT_TARGETS.EXTENSION_BUTTON]: {
        // components/extension-button/（Smalruby が手を入れている部品）の data-testid
        selectors: ['[data-testid="extension-button"]'],
        sides: [HINT_SIDES.RIGHT, HINT_SIDES.TOP],
    },
    [HINT_TARGETS.GREEN_FLAG]: {
        selectors: ['[data-testid="mobile-side-rail-play"]', '[class*="green-flag_green-flag_"]'],
        sides: [HINT_SIDES.BOTTOM, HINT_SIDES.LEFT],
    },
    [HINT_TARGETS.KEYBOARD]: { selectors: [], sides: [] },
};

const toRect = (r) => ({ left: r.left, top: r.top, right: r.right, bottom: r.bottom });
const isVisibleRect = (r) => r.right - r.left > 0 && r.bottom - r.top > 0;
const union = (a, b) =>
    a === null
        ? b
        : {
              left: Math.min(a.left, b.left),
              top: Math.min(a.top, b.top),
              right: Math.max(a.right, b.right),
              bottom: Math.max(a.bottom, b.bottom),
          };

const visibleRects = (doc, selectors) =>
    selectors
        .flatMap((selector) => Array.from(doc.querySelectorAll(selector)))
        .map((el) => toRect(el.getBoundingClientRect()))
        .filter(isVisibleRect);

/**
 * 指す場所の矩形（viewport 座標）を DOM から探す。
 * @param {string} target - 指す場所（`HINT_TARGETS`）。
 * @param {Document} doc - 探す document。
 * @returns {?{left: number, top: number, right: number, bottom: number}} 見つからなければ null
 *   （場所の無いもの、いまのタブに無いもの）。
 */
export const findHintTargetRect = (target, doc) => {
    const spec = TARGET_SPECS[target];
    if (!spec || !doc) return null;
    let rect = null;
    if (spec.union) {
        visibleRects(doc, spec.selectors).forEach((r) => {
            rect = union(rect, r);
        });
    } else {
        for (const selector of spec.selectors) {
            const found = visibleRects(doc, [selector]);
            if (found.length > 0) {
                rect = found[0];
                break;
            }
        }
    }
    if (rect && spec.subtract) {
        visibleRects(doc, spec.subtract).forEach((r) => {
            if (r.right > rect.left && r.right < rect.right) rect = { ...rect, left: r.right };
        });
    }
    return rect && isVisibleRect(rect) ? rect : null;
};

/**
 * 指す場所ごとの、吹き出しを置く側の候補（先に書いたものを優先）。
 * @param {string} target - 指す場所。
 * @returns {Array<string>} 候補（`HINT_SIDES`）。
 */
export const preferredSides = (target) => (TARGET_SPECS[target] ? TARGET_SPECS[target].sides : []);

const clamp = (v, min, max) => Math.min(Math.max(v, min), max);

/**
 * 吹き出しの置き方を決める。指す場所の横（右 → 左）に収まらないときは下（→ 上）に、
 * それも収まらないときは指す場所の中に置く。場所が無ければ画面の真ん中。
 * 画面からはみ出さないよう、最後に margin の内側に収める。
 * @param {object} args - 引数。
 * @param {?{left: number, top: number, right: number, bottom: number}} args.target - 指す場所の矩形（無ければ null）。
 * @param {{width: number, height: number}} args.balloon - 吹き出しの大きさ。
 * @param {{width: number, height: number}} args.viewport - 画面の大きさ。
 * @param {Array<string>} [args.sides] - 置く側の候補（既定は右 → 左 → 下 → 上 → 中）。
 * @param {number} [args.gap] - 指す場所と吹き出しのすき間。
 * @param {number} [args.margin] - 画面の端から空ける幅。
 * @returns {{left: number, top: number, side: string, arrow: ?{x: number, y: number}}}
 *   吹き出しの左上（viewport 座標）・置いた側・矢印の位置（吹き出しの左上からの相対。無ければ null）。
 */
export const computeHintPlacement = ({ target, balloon, viewport, sides, gap = 12, margin = 8 }) => {
    const maxLeft = Math.max(margin, viewport.width - balloon.width - margin);
    const maxTop = Math.max(margin, viewport.height - balloon.height - margin);
    const settle = (left, top, side, anchor) => {
        const l = clamp(left, margin, maxLeft);
        const t = clamp(top, margin, maxTop);
        const arrow = anchor
            ? {
                  x: clamp(anchor.x - l, 12, Math.max(12, balloon.width - 12)),
                  y: clamp(anchor.y - t, 12, Math.max(12, balloon.height - 12)),
              }
            : null;
        return { left: l, top: t, side, arrow };
    };
    if (!target) {
        return settle((viewport.width - balloon.width) / 2, (viewport.height - balloon.height) / 2, HINT_SIDES.CENTER);
    }
    const cx = (target.left + target.right) / 2;
    const cy = (target.top + target.bottom) / 2;
    const order =
        sides && sides.length > 0
            ? sides
            : [HINT_SIDES.RIGHT, HINT_SIDES.LEFT, HINT_SIDES.BOTTOM, HINT_SIDES.TOP, HINT_SIDES.INSIDE];
    const candidates = {
        [HINT_SIDES.RIGHT]: () => ({
            left: target.right + gap,
            top: cy - balloon.height / 2,
            fits: target.right + gap + balloon.width <= viewport.width - margin,
            anchor: { x: target.right, y: cy },
        }),
        [HINT_SIDES.LEFT]: () => ({
            left: target.left - gap - balloon.width,
            top: cy - balloon.height / 2,
            fits: target.left - gap - balloon.width >= margin,
            anchor: { x: target.left, y: cy },
        }),
        [HINT_SIDES.BOTTOM]: () => ({
            left: cx - balloon.width / 2,
            top: target.bottom + gap,
            fits: target.bottom + gap + balloon.height <= viewport.height - margin,
            anchor: { x: cx, y: target.bottom },
        }),
        [HINT_SIDES.TOP]: () => ({
            left: cx - balloon.width / 2,
            top: target.top - gap - balloon.height,
            fits: target.top - gap - balloon.height >= margin,
            anchor: { x: cx, y: target.top },
        }),
        [HINT_SIDES.INSIDE]: () => ({ left: target.left + gap, top: target.top + gap, fits: true, anchor: null }),
    };
    for (const side of order) {
        const make = candidates[side];
        if (!make) continue;
        const c = make();
        if (c.fits) return settle(c.left, c.top, side, c.anchor);
    }
    // 横にも縦にも収まらない: 指す場所の中（はみ出すぶんは画面の内側に収める）
    const inside = candidates[HINT_SIDES.INSIDE]();
    return settle(inside.left, inside.top, HINT_SIDES.INSIDE, null);
};
