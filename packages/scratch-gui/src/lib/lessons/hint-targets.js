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
    // 名前の札（「ガイド」）（lib/lessons/part-names.js）でも使う場所。停止ボタン・コードタブ・ルビータブ・課題バー・ヒントのボタン（#2133）
    STOP_BUTTON: 'stop-button',
    CODE_TAB: 'code-tab',
    RUBY_TAB: 'ruby-tab',
    TASK_BAR: 'task-bar',
    HINT_BUTTON: 'hint-button',
    // メッシュの練習相手のパネル（閉じているときは小さな「練習相手」のボタン）
    PRACTICE_PARTNER: 'practice-partner',
    // 課題バーの役のボタン（役のあるチャレンジの「役を決めよう」のページ）
    ROLE_PICKER: 'role-picker',
    // 「どこでしょう？」のクイズの問い（components/lesson-part-quiz/・#2134）
    PART_QUIZ: 'part-quiz',
    KEYBOARD: 'keyboard',
});

// 吹き出しをかぶせない部品（出ているときだけ）。練習相手のパネルはボタンを押しながらヒントを読むので、
// 吹き出しで隠さない（#1643）。コスチュームタブ・音タブの左の一覧（components/asset-panel/selector.jsx）も、
// ヒントを読みながら絵や音をえらぶので隠さない（タブの下に置くと一覧にかぶり、2 つめの絵が見えなかった・#2146）
const AVOID_SELECTORS = ['[data-testid="lesson-practice-partner"]', '[class*="selector_wrapper_"]'];

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
// スクリプトエリアに置いてあるスクリプト（いちばん上のブロックの組）
const CODE_SCRIPTS = `${BLOCKS} .blocklySvg > .blocklyWorkspace > .blocklyBlockCanvas > .blocklyBlock`;

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
        // スクリプトエリアに置いてあるスクリプト（いちばん上のブロックの組）にはかぶせない。「「15 度回す」の数を
        // 変えよう」のように、置いてあるブロックを指して操作させるヒントで、そのブロックが吹き出しに隠れないように
        // （#2146）。パレットのブロックは別の svg（.blocklyFlyout）なので入らない
        avoid: [CODE_SCRIPTS],
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
    [HINT_TARGETS.STOP_BUTTON]: {
        // SP のサイドレールには止めるボタンが無い（再生ボタンが全画面のあいだだけ止めるになる）
        selectors: ['[class*="stop-all_stop-all_"]'],
        sides: [HINT_SIDES.BOTTOM, HINT_SIDES.LEFT],
    },
    [HINT_TARGETS.CODE_TAB]: {
        selectors: ['[data-testid="mobile-side-rail-code"]', '[class*="gui_tab_"]:nth-child(1)'],
        sides: [HINT_SIDES.BOTTOM, HINT_SIDES.RIGHT],
    },
    [HINT_TARGETS.RUBY_TAB]: {
        // ルビータブは Smalruby が足した 4 つめのタブ（gui.jsx の「Start of ruby tab」）。SP はサイドレールのボタン
        selectors: ['[data-testid="mobile-side-rail-ruby"]', '[class*="gui_tab_"]:nth-child(4)'],
        sides: [HINT_SIDES.BOTTOM, HINT_SIDES.RIGHT],
    },
    [HINT_TARGETS.TASK_BAR]: {
        selectors: ['[data-testid="lesson-task-bar"]'],
        sides: [HINT_SIDES.BOTTOM],
    },
    [HINT_TARGETS.HINT_BUTTON]: {
        selectors: ['[data-testid="lesson-task-bar-hint"]'],
        sides: [HINT_SIDES.BOTTOM],
    },
    [HINT_TARGETS.PART_QUIZ]: {
        selectors: ['[data-testid="lesson-part-quiz-panel"]'],
        sides: [HINT_SIDES.TOP, HINT_SIDES.RIGHT],
    },
    [HINT_TARGETS.PRACTICE_PARTNER]: {
        selectors: ['[data-testid="lesson-practice-partner"]', '[data-testid="lesson-practice-partner-open"]'],
        sides: [HINT_SIDES.LEFT, HINT_SIDES.BOTTOM, HINT_SIDES.INSIDE],
    },
    [HINT_TARGETS.ROLE_PICKER]: {
        // components/lesson-task-bar/lesson-role-picker.jsx のボタンの並び（下の「前回は…」の一言は含めない）。
        // 課題バーは吹き出しより上に描かれ、吹き出しはバーの下から置く（hintViewport）ので、下に置いてしっぽを上に向ける
        selectors: ['[data-testid="lesson-task-bar-role-buttons"]'],
        sides: [HINT_SIDES.BOTTOM],
        // 役のボタンは練習相手のパネルの真上にあることが多い（1300×600）。パネルをよけると吹き出しが左へずれ、しっぽが
        // ボタンに届かない。このページは練習相手を使う前に読むので、パネルにかぶってもしっぽでボタンを指す
        coverAvoid: true,
    },
    [HINT_TARGETS.KEYBOARD]: { selectors: [], sides: [] },
};

/**
 * 指す場所の中の 1 つのもの（`steps[].focus` の `kind`）。場所（`target`）より細かく、押すもの 1 つを指す
 * （レッスン 0 で、子どもが「どこを押すのか」をまちがえたため）。見つからないときは `target` の場所を指す。
 * - `paletteBlock` {opcode, category}: ブロックパレットのブロック。パレットの見えている範囲に無いときは、
 *   左のなかま（category = ツールボックスの id）のボタンを指す（押すとパレットがそこへ動き、次に測るとブロックを指す）
 * - `codeBlock` {opcode}: スクリプトエリアのブロック（その 1 つだけ。下につながったブロックは入れない）
 * - `codeField` {opcode, shadow}: スクリプトエリアのブロックの白いところ・▼（入れてある影のブロック。
 *   shadow は影のブロックの opcode。数なら `math_number`、▼ なら `motion_goto_menu` など）
 * - `stageSprite`: ステージに映っているスプライト（いま選んでいるスプライト。DOM が無いので VM の描画の位置から求める）
 * - `costume` {number}: コスチュームタブの左の一覧の、何番目の絵か（1 から）
 * - `soundPlay`: 音タブの再生ボタン（▶。押すと選んでいる音が鳴る）
 * - `spriteAdd` / `backdropAdd`: スプライトを選ぶボタン・背景を選ぶボタン（スプライトペインの右下の丸いボタン）
 */
export const HINT_FOCUS = Object.freeze({
    PALETTE_BLOCK: 'paletteBlock',
    CODE_BLOCK: 'codeBlock',
    CODE_FIELD: 'codeField',
    STAGE_SPRITE: 'stageSprite',
    COSTUME: 'costume',
    SOUND_PLAY: 'soundPlay',
    SPRITE_ADD: 'spriteAdd',
    BACKDROP_ADD: 'backdropAdd',
});

// opcode・なかまの id はブロックの g の class と、ツールボックスのなかまの id になる（scratch-blocks が付ける）。
// セレクタに入れるので、英数字と _ だけを通す
const safeName = (name) => (typeof name === 'string' && /^[A-Za-z0-9_]+$/.test(name) ? name : null);
const FLYOUT = `${BLOCKS} .blocklyFlyout`;
// スクリプトエリアのブロック（パレットのブロックは別の svg の .blocklyFlyout にあるので入らない）
const CODE_CANVAS = `${BLOCKS} .blocklySvg > .blocklyWorkspace > .blocklyBlockCanvas`;

const FOCUS_SIDES = {
    [HINT_FOCUS.PALETTE_BLOCK]: [HINT_SIDES.RIGHT, HINT_SIDES.BOTTOM],
    [HINT_FOCUS.CODE_BLOCK]: [HINT_SIDES.BOTTOM, HINT_SIDES.TOP, HINT_SIDES.RIGHT, HINT_SIDES.LEFT],
    [HINT_FOCUS.CODE_FIELD]: [HINT_SIDES.BOTTOM, HINT_SIDES.TOP, HINT_SIDES.RIGHT, HINT_SIDES.LEFT],
    [HINT_FOCUS.STAGE_SPRITE]: [HINT_SIDES.LEFT, HINT_SIDES.BOTTOM],
    [HINT_FOCUS.COSTUME]: [HINT_SIDES.RIGHT, HINT_SIDES.BOTTOM],
    [HINT_FOCUS.SOUND_PLAY]: [HINT_SIDES.TOP, HINT_SIDES.RIGHT],
    [HINT_FOCUS.SPRITE_ADD]: [HINT_SIDES.LEFT, HINT_SIDES.TOP],
    [HINT_FOCUS.BACKDROP_ADD]: [HINT_SIDES.LEFT, HINT_SIDES.TOP],
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

const firstVisible = (doc, selector) =>
    Array.from(doc.querySelectorAll(selector)).find((el) => isVisibleRect(el.getBoundingClientRect())) || null;

/**
 * 指す場所の DOM の要素（候補のうち、最初に見えたもの）。名前の札を押したときに、その部分を押すのに使う
 * （part-names.js）。矩形を合わせる場所（`union`）は 1 つの要素にならないので null。
 * @param {string} target - 指す場所（`HINT_TARGETS`）。
 * @param {Document} doc - 探す document。
 * @returns {?Element} 見つかった要素。無ければ null。
 */
export const findHintTargetElement = (target, doc) => {
    const spec = TARGET_SPECS[target];
    if (!spec || spec.union || !doc) return null;
    for (const selector of spec.selectors) {
        const found = firstVisible(doc, selector);
        if (found) return found;
    }
    return null;
};

// 矩形が見えている範囲（パレット・スクリプトエリア）の中にあるか。パレットのブロックは上下に全部入っていること
// （半分見えているブロックは押しにくい）、スクリプトエリアのブロックは真ん中が入っていること
const insideVertically = (r, clip) => r.top >= clip.top - 1 && r.bottom <= clip.bottom + 1;
const centerInside = (r, clip) => {
    const cx = (r.left + r.right) / 2;
    const cy = (r.top + r.bottom) / 2;
    return cx >= clip.left && cx <= clip.right && cy >= clip.top && cy <= clip.bottom;
};

// スクリプトエリアに置いてあるブロック（影でないもの）で、見えている範囲に真ん中があるもの
const findCodeBlock = (doc, opcode) => {
    const name = safeName(opcode);
    if (!name) return null;
    const area = findHintTargetRect(HINT_TARGETS.CODE_AREA, doc);
    if (!area) return null;
    return (
        Array.from(doc.querySelectorAll(`${CODE_CANVAS} g.blocklyBlock.${name}:not(.blocklyShadow)`)).find((el) => {
            const r = el.getBoundingClientRect();
            return isVisibleRect(r) && centerInside(r, area);
        }) || null
    );
};

/**
 * 指す 1 つのもの（`focus`）の DOM の要素を探す。DOM を読むだけ（Blockly のメソッドは呼ばない）。
 * ステージのスプライトは DOM が無いので null（`findHintFocusRect` が VM から求める）。
 * @param {?object} focus - 指す 1 つのもの（`{kind, ...}`。`HINT_FOCUS`）。
 * @param {Document} doc - 探す document。
 * @returns {?Element} 見えている要素。無ければ null。
 */
export const findHintFocusElement = (focus, doc) => {
    if (!focus || !doc) return null;
    switch (focus.kind) {
        case HINT_FOCUS.PALETTE_BLOCK: {
            const name = safeName(focus.opcode);
            const flyout = firstVisible(doc, FLYOUT);
            if (!name || !flyout) return null;
            const clip = flyout.getBoundingClientRect();
            const block = Array.from(doc.querySelectorAll(`${FLYOUT} g.blocklyBlock.${name}`)).find((el) => {
                const r = el.getBoundingClientRect();
                return isVisibleRect(r) && insideVertically(r, clip);
            });
            if (block) return block;
            // パレットの見えている範囲に無い: なかまのボタンを押すと、パレットがそのなかまへ動く
            const category = safeName(focus.category);
            return category ? firstVisible(doc, `${BLOCKS} .blocklyToolboxCategory[id="${category}"]`) : null;
        }
        case HINT_FOCUS.CODE_BLOCK: {
            const block = findCodeBlock(doc, focus.opcode);
            // ブロックの g は下につながったブロックも含むので、そのブロックの形（path）だけにする
            return block ? block.querySelector(':scope > path.blocklyPath') || block : null;
        }
        case HINT_FOCUS.CODE_FIELD: {
            const block = findCodeBlock(doc, focus.opcode);
            const shadow = safeName(focus.shadow);
            return block && shadow ? block.querySelector(`:scope > g.${shadow}`) : null;
        }
        case HINT_FOCUS.COSTUME: {
            const items = Array.from(
                doc.querySelectorAll('[class*="selector_wrapper_"] [class*="selector_list-item_"]'),
            ).filter((el) => isVisibleRect(el.getBoundingClientRect()));
            return Number.isInteger(focus.number) ? items[focus.number - 1] || null : null;
        }
        case HINT_FOCUS.SOUND_PLAY:
            // 再生ボタン（鳴っているあいだは同じ場所の止めるボタンになる）
            return firstVisible(doc, '[class*="sound-editor_round-button_"]');
        case HINT_FOCUS.SPRITE_ADD:
            return firstVisible(doc, '[class*="sprite-selector_add-button_"] [class*="action-menu_main-button_"]');
        case HINT_FOCUS.BACKDROP_ADD:
            return firstVisible(doc, '[class*="stage-selector_add-button_"] [class*="action-menu_main-button_"]');
        default:
            return null;
    }
};

/**
 * ステージの座標（VM。真ん中が 0・上が +y）の矩形を、画面の canvas の上の矩形（viewport 座標）にする。
 * canvas の外にはみ出した分は切る。
 * @param {{left: number, right: number, top: number, bottom: number}} bounds - ステージの座標の矩形
 *   （renderer.getBounds）。
 * @param {{left: number, top: number, right: number, bottom: number}} canvas - canvas の矩形。
 * @param {Array<number>} [nativeSize] - ステージの大きさ（[幅, 高さ]。既定は 480×360）。
 * @returns {?{left: number, top: number, right: number, bottom: number}} 矩形。canvas に入らなければ null。
 */
export const stageBoundsToRect = (bounds, canvas, nativeSize = [480, 360]) => {
    if (!bounds || !canvas) return null;
    const [w, h] = nativeSize;
    const sx = (canvas.right - canvas.left) / w;
    const sy = (canvas.bottom - canvas.top) / h;
    const rect = {
        left: Math.max(canvas.left, canvas.left + (bounds.left + w / 2) * sx),
        right: Math.min(canvas.right, canvas.left + (bounds.right + w / 2) * sx),
        top: Math.max(canvas.top, canvas.top + (h / 2 - bounds.top) * sy),
        bottom: Math.min(canvas.bottom, canvas.top + (h / 2 - bounds.bottom) * sy),
    };
    return isVisibleRect(rect) ? rect : null;
};

// ステージに映っているスプライト（いま選んでいるスプライト。ステージを選んでいれば最初のスプライト）の矩形
const findStageSpriteRect = (doc, vm) => {
    const renderer = vm && vm.renderer;
    const runtime = vm && vm.runtime;
    if (!renderer || typeof renderer.getBounds !== 'function' || !runtime) return null;
    const editing = vm.editingTarget;
    const sprite =
        editing && !editing.isStage ? editing : (runtime.targets || []).find((t) => !t.isStage && t.isOriginal);
    if (!sprite || typeof sprite.drawableID !== 'number' || sprite.visible === false) return null;
    const canvas = firstVisible(doc, '[class*="stage_stage-wrapper_"] canvas');
    if (!canvas) return null;
    let bounds = null;
    try {
        bounds = renderer.getBounds(sprite.drawableID);
    } catch (e) {
        return null;
    }
    const canvasRect = toRect(canvas.getBoundingClientRect());
    return typeof renderer.getNativeSize === 'function'
        ? stageBoundsToRect(bounds, canvasRect, renderer.getNativeSize())
        : stageBoundsToRect(bounds, canvasRect);
};

/**
 * 指す 1 つのもの（`focus`）の矩形（viewport 座標）。見つからなければ null（呼ぶ側は `target` の場所を指す）。
 * @param {?object} focus - 指す 1 つのもの（`HINT_FOCUS`）。
 * @param {Document} doc - 探す document。
 * @param {object} [options] - 任意。
 * @param {object} [options.vm] - VM（ステージのスプライトの位置を求める）。
 * @returns {?{left: number, top: number, right: number, bottom: number}} 矩形。
 */
export const findHintFocusRect = (focus, doc, { vm = null } = {}) => {
    if (!focus || !doc) return null;
    if (focus.kind === HINT_FOCUS.STAGE_SPRITE) return findStageSpriteRect(doc, vm);
    const el = findHintFocusElement(focus, doc);
    if (!el) return null;
    const rect = toRect(el.getBoundingClientRect());
    return isVisibleRect(rect) ? rect : null;
};

/**
 * 指す 1 つのものの、吹き出しを置く側の候補。
 * @param {?object} focus - 指す 1 つのもの。
 * @returns {Array<string>} 候補（`HINT_SIDES`）。知らないものは空。
 */
export const focusSides = (focus) => (focus && FOCUS_SIDES[focus.kind]) || [];

/**
 * 吹き出しをかぶせない部品の矩形（viewport 座標。出ているものだけ）。
 * @param {Document} doc - 探す document。
 * @param {string} [target] - 指す場所。かぶってでも指す場所（役のボタン）なら、よけるものは無い。
 * @param {?object} [focus] - 指す 1 つのもの。パレットのブロックを指すときは、スクリプトエリアに置いたスクリプトも
 *   よける（パレットからドラッグして置いたブロックが、右に出した吹き出しに隠れて押せなかった）。
 * @returns {Array<{left: number, top: number, right: number, bottom: number}>} 矩形。
 */
export const findHintAvoidRects = (doc, target, focus = null) => {
    const spec = target ? TARGET_SPECS[target] : null;
    if (!doc || (spec && spec.coverAvoid)) return [];
    // パレットのブロックを指すときは、スクリプトエリアのスクリプトもよける。なかまのボタンを指すときはパレットに
    // かぶるが、押すとブロックを指しなおして吹き出しも動く（パレットをよけると、吹き出しが遠くへ行ってしまう）
    const focusAvoid = focus && focus.kind === HINT_FOCUS.PALETTE_BLOCK ? [CODE_SCRIPTS] : [];
    return visibleRects(doc, [...AVOID_SELECTORS, ...((spec && spec.avoid) || []), ...focusAvoid]);
};

/**
 * 指す場所ごとの、吹き出しを置く側の候補（先に書いたものを優先）。
 * @param {string} target - 指す場所。
 * @returns {Array<string>} 候補（`HINT_SIDES`）。
 */
export const preferredSides = (target) => (TARGET_SPECS[target] ? TARGET_SPECS[target].sides : []);

const clamp = (v, min, max) => Math.min(Math.max(v, min), max);

/**
 * ドラッグで動かした吹き出しを画面の内側に収める（margin の内側。画面より大きいときは左上に寄せる）。
 * ドラッグ中だけでなく、ページが変わって大きさが変わったとき・画面の大きさが変わったときにも使う。
 * @param {{left: number, top: number}} position - 吹き出しの左上（viewport 座標）。
 * @param {{width: number, height: number}} balloon - 吹き出しの大きさ。
 * @param {{width: number, height: number, left: ?number, top: ?number}} viewport - 画面の大きさ（`left` / `top` は
 *   左・上の使えない幅）。
 * @param {number} [margin] - 画面の端から空ける幅。
 * @returns {{left: number, top: number}} 収めた左上。
 */
export const clampHintPosition = (position, balloon, viewport, margin = 8) => {
    const minLeft = (viewport.left || 0) + margin;
    const minTop = (viewport.top || 0) + margin;
    return {
        left: clamp(position.left, minLeft, Math.max(minLeft, viewport.width - balloon.width - margin)),
        top: clamp(position.top, minTop, Math.max(minTop, viewport.height - balloon.height - margin)),
    };
};

/**
 * 吹き出しを置いてよい画面の範囲。SP のサイドレール（`mobile-side-rail`）は吹き出しより上の層に
 * あるので、その右から置く（レールの下に吹き出しが隠れ、取っ手やボタンを押せなくなるのを防ぐ）。
 * 課題バー（`lesson-task-bar`。メニューバーと同じ層）も吹き出しより上に描かれるので、その下から置く
 * （高い吹き出し — 図のある 1 ページ目・答えのページ — のヘッダーと閉じるがバーの下に隠れないように）。
 * @param {Document} doc - document。
 * @param {{innerWidth: number, innerHeight: number}} win - window。
 * @returns {{left: number, top: number, width: number, height: number}} 画面の大きさと、左・上の使えない幅。
 */
export const hintViewport = (doc, win) => {
    const visible = (r) => r && r.right - r.left > 0 && r.bottom - r.top > 0;
    const rail = doc.querySelector('[data-testid="mobile-side-rail"]');
    const r = rail ? rail.getBoundingClientRect() : null;
    const left = visible(r) && r.right > 0 ? r.right : 0;
    const bar = doc.querySelector('[data-testid="lesson-task-bar"]');
    const b = bar ? bar.getBoundingClientRect() : null;
    const top = visible(b) && b.bottom > 0 ? b.bottom : 0;
    return { left, top, width: win.innerWidth, height: win.innerHeight };
};

/**
 * 吹き出しの置き方を決める。指す場所の横（右 → 左）に収まらないときは下（→ 上）に、
 * それも収まらないときは指す場所の中に置く。場所が無ければ画面の真ん中。
 * 画面からはみ出さないよう、最後に margin の内側に収める。
 * @param {object} args - 引数。
 * @param {?{left: number, top: number, right: number, bottom: number}} args.target - 指す場所の矩形（無ければ null）。
 * @param {{width: number, height: number, header: ?number, closeLeft: ?number}} args.balloon - 吹き出しの大きさ。
 *   `header` はヘッダーの帯の下の端、`closeLeft` は閉じるボタンの左の端（どちらも吹き出しの左上からの相対。
 *   無ければ見ない）。左右の辺のしっぽは帯の横に、上の辺のしっぽは閉じるボタンの上に出さない。
 * @param {{width: number, height: number, left: ?number}} args.viewport - 画面の大きさ（`left` は左の使えない幅。`hintViewport`）。
 * @param {Array<string>} [args.sides] - 置く側の候補（既定は右 → 左 → 下 → 上 → 中）。
 * @param {Array<object>} [args.avoid] - かぶせない矩形（練習相手のパネル。`findHintAvoidRects`）。かぶる置き方は、
 *   縦（横に置くとき）・横（縦に置くとき）にずらし、それでもかぶれば指す場所から離す方向にずらす。指す場所に
 *   かからない置き方を先に選び、無ければ指す場所にかかる面積がいちばん小さいもの、それも無ければ、かぶせない
 *   ことはあきらめて今までどおりに置く。指す場所が無い（真ん中に置く）ときも、かぶれば横・縦にずらす。
 * @param {number} [args.gap] - 指す場所と吹き出しのすき間。
 * @param {number} [args.margin] - 画面の端から空ける幅。
 * @returns {{left: number, top: number, side: string, arrow: ?{x: number, y: number}}}
 *   吹き出しの左上（viewport 座標）・置いた側・矢印の位置（吹き出しの左上からの相対。無ければ null。ずらした結果、
 *   指す場所の真ん中が吹き出しの辺の外になったときも null — 角に寄せたしっぽは何も指さないため）。
 */
export const computeHintPlacement = ({ target, balloon, viewport, sides, avoid = [], gap = 12, margin = 8 }) => {
    const minLeft = (viewport.left || 0) + margin;
    const minTop = (viewport.top || 0) + margin;
    const maxLeft = Math.max(minLeft, viewport.width - balloon.width - margin);
    const maxTop = Math.max(minTop, viewport.height - balloon.height - margin);
    // しっぽ（矢印）を描ける位置か。画面に収める・かぶせない部品をよけるために吹き出しをずらすと、指す場所の
    // 真ん中が吹き出しの辺の外（上の端より上など）になることがある。そこで位置を辺の中に寄せて描くと、しっぽは
    // 何も指さずに角に出る（ヘッダーの閉じるボタンにかぶる白いひし形になる）ので、そのときは出さない
    const ARROW_INSET = 12;
    // 辺の中でも、ヘッダーの帯の横（左右の辺の上のほう）と閉じるボタンの上（上の辺の右の端）には出さない。
    // 帯の色の上に白いしっぽが出て、閉じるボタンの横の白いひし形に見える
    const headerBottom = balloon.header || 0;
    const closeLeft = typeof balloon.closeLeft === 'number' ? balloon.closeLeft : Infinity;
    const alongEdge = (offset, length, start = 0, end = length) =>
        offset >= start + ARROW_INSET && offset <= Math.min(length, end) - ARROW_INSET;
    const arrowFor = (l, t, side, anchor) => {
        if (!anchor) return null;
        const x = anchor.x - l;
        const y = anchor.y - t;
        const sideways = side === HINT_SIDES.RIGHT || side === HINT_SIDES.LEFT;
        const onTopEdge = side === HINT_SIDES.BOTTOM;
        const fits = sideways
            ? alongEdge(y, balloon.height, headerBottom)
            : alongEdge(x, balloon.width, 0, onTopEdge ? closeLeft : balloon.width);
        if (!fits) return null;
        return {
            x: clamp(x, ARROW_INSET, Math.max(ARROW_INSET, balloon.width - ARROW_INSET)),
            y: clamp(y, ARROW_INSET, Math.max(ARROW_INSET, balloon.height - ARROW_INSET)),
        };
    };
    const settle = (left, top, side, anchor) => {
        const l = clamp(left, minLeft, maxLeft);
        const t = clamp(top, minTop, maxTop);
        return { left: l, top: t, side, arrow: arrowFor(l, t, side, anchor) };
    };
    const boxOf = (p) => ({
        left: p.left,
        top: p.top,
        right: p.left + balloon.width,
        bottom: p.top + balloon.height,
    });
    const overlapArea = (a, b) =>
        Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)) *
        Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
    const clearOfAvoid = (p) => avoid.every((a) => overlapArea(boxOf(p), a) === 0);
    // かぶせない部品をよける置き方の候補（ずらす向きの順。`vertical` なら縦を先に）
    const shifts = (base, vertical) => {
        const tries = [base];
        avoid.forEach((a) => {
            const v = [
                { left: base.left, top: a.bottom + gap },
                { left: base.left, top: a.top - gap - balloon.height },
            ];
            const h = [
                { left: a.left - gap - balloon.width, top: base.top },
                { left: a.right + gap, top: base.top },
            ];
            tries.push(...(vertical ? [...v, ...h] : [...h, ...v]));
        });
        return tries;
    };
    if (!target) {
        // 横も縦も、使える範囲（サイドレールの右・課題バーの下）の真ん中に置く
        const areaLeft = viewport.left || 0;
        const areaTop = viewport.top || 0;
        const center = {
            left: areaLeft + (viewport.width - areaLeft - balloon.width) / 2,
            top: areaTop + (viewport.height - areaTop - balloon.height) / 2,
        };
        const placed = shifts(center, false)
            .map((t) => settle(t.left, t.top, HINT_SIDES.CENTER))
            .find(clearOfAvoid);
        return placed || settle(center.left, center.top, HINT_SIDES.CENTER);
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
            fits: target.top - gap - balloon.height >= minTop,
            anchor: { x: cx, y: target.top },
        }),
        [HINT_SIDES.INSIDE]: () => ({ left: target.left + gap, top: target.top + gap, fits: true, anchor: null }),
    };
    if (avoid.length > 0) {
        // かぶせない部品があるとき: 候補ごとに、そのままの置き方とずらした置き方を試す
        let best = null;
        for (const side of order) {
            const make = candidates[side];
            if (!make) continue;
            const c = make();
            if (!c.fits) continue;
            const sideways = side === HINT_SIDES.TOP || side === HINT_SIDES.BOTTOM;
            for (const t of shifts({ left: c.left, top: c.top }, !sideways)) {
                const p = settle(t.left, t.top, side, c.anchor);
                if (!clearOfAvoid(p)) continue;
                const cost = side === HINT_SIDES.INSIDE ? Infinity : overlapArea(boxOf(p), target);
                if (cost === 0) return p;
                if (!best || cost < best.cost) best = { cost, p };
            }
        }
        if (best) return best.p;
    }
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
