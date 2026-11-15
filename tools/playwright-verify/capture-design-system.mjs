/**
 * デザインシステムの撮影スクリプト (EPIC #1809 / #1868)。
 *
 * 上流 (Scratch) 由来の画面を headless で 1 つずつ開き、
 *   - 計算済みのスタイル (getComputedStyle) とホバーしたときの値
 *   - スクリーンショット (画面全体 / 部品の切り抜き)
 *   - scratch-blocks がページに書き出す `--colour-*` (ブロックのテーマの色)
 * を tmp/design-system/ に出す。
 *
 * 値の正は上流 scratch-editor v13.7.2 の CSS (docs/design-system/README.md の方針)。
 * 実際の画面にはスモウルビーの変更が混ざるので、ここで取った値は「確かめ」と
 * 「見本の画像」にだけ使う。そのために:
 *   - 画面は 1366×1024 で開く (高さが低いとメニューバーがスモウルビーの変更で縮む)
 *   - スモウルビーの吹き出し (ようこそ・レッスンのヒントなど) を隠す
 *
 * dev server だけが前提 (stg・ログインは不要)。
 *
 *   node capture-design-system.mjs                         # コンテナ内 (headless)
 *   BASE=http://localhost:8631 node capture-design-system.mjs
 *   ONLY=menu-bar,extension-library node capture-design-system.mjs   # 一部の画面だけ
 *   LIST=1 node capture-design-system.mjs                  # 画面の一覧を出すだけ
 *   DOCS_SHOTS=1 node capture-design-system.mjs            # docs/design-system/screenshots の見本も撮り直す
 *   HEADLESS=false CHANNEL=chrome node capture-design-system.mjs     # ホストで目視
 *
 * 出力:
 *   tmp/design-system/<番号>-<画面>.png        スクリーンショット
 *   tmp/design-system/<番号>-<画面>-<切り抜き>.png  部品だけの切り抜き (crops)
 *   tmp/design-system/styles.json              画面 → 部品 → スタイル (と hover) の値
 *   tmp/design-system/block-colours.json       `--colour-*` の値
 * 開けなかった画面・切り抜けなかった画面・必須の部品が見つからない画面が 1 つでもあれば exit 1。
 * DOCS_SHOTS=1 は 1366×1024 でメニューバーが 48px のときだけ (それ以外は撮る前に止める)。
 */
import { chromium } from 'playwright';
import { copyFileSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HEADLESS = process.env.HEADLESS !== 'false';
const CHANNEL = process.env.CHANNEL || undefined;
const BASE = process.env.BASE || 'http://localhost:8601';
const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const OUT_DIR = process.env.OUT_DIR || resolve(REPO_ROOT, 'tmp', 'design-system');
const DOCS_DIR = resolve(REPO_ROOT, 'docs', 'design-system', 'screenshots');
const DOCS_SHOTS = process.env.DOCS_SHOTS === '1';
const ONLY = (process.env.ONLY || '').split(',').filter(Boolean);
// 1366×1024: メニューバーが上流の 3rem (48px) のまま出る高さ (スパイク #1810 で確かめた)。
const [VW, VH] = (process.env.VIEWPORT || '1366x1024').split('x').map(Number);
const VIEWPORT = { width: VW, height: VH };
const LOCALE = process.env.LOCALE || 'ja-JP';

// 撮るときに隠すスモウルビー独自の重なり (吹き出し・通知)。上流の値の見本に写さない。
const HIDE_SELECTORS = [
    '[data-testid="welcome-tooltip"]',
    '[data-testid="welcome-modal"]',
    '[data-testid="lesson-hint"]',
    '[data-testid="lesson-hint-spotlight"]',
    '[data-testid^="classroom-tutorial-"]',
];

// 部品ごとに読むスタイル。色・大きさ・余白・角丸・文字・影・動き (tokens.md の分類)。
const PROPS = [
    'color',
    'background-color',
    'border-top-color',
    'border-top-width',
    'border-top-style',
    // 区切りの点線 (ペイント・音のエディター) は右と下に引く
    'border-right-color',
    'border-right-style',
    'border-bottom-color',
    'border-bottom-style',
    'border-radius',
    'box-shadow',
    // フォーカスの書き方は部品ごとに違う (outline・box-shadow・::before の枠)。outline も読む
    'outline-color',
    'outline-style',
    'outline-width',
    'outline-offset',
    'font-family',
    'font-size',
    'font-weight',
    'line-height',
    'padding',
    'margin',
    'width',
    'height',
    'opacity',
    // アイコンの色を filter で変える部品がある (ペイントの選ばれた道具・切り替えボタン)
    'filter',
    // SVG の部品 (音の波形・録音のボタン・音量のメーター) は fill と stroke で色を付ける
    'fill',
    'stroke',
    // ホバーで大きくなる部品 (閉じるボタンの scale(1.1)) がある
    'transform',
    'transition',
    'z-index',
];

// CSS Modules の名前 (`<ファイル>_<クラス>_<ハッシュ>`) から部品を選ぶ。
// クラス名の先頭に固定する (`modal_header_` が `connection-modal_header_` に当たらないように)。
// 組み合わせて使う (`${cls(a)}${cls(b)}` や `:not(${cls(a)})`) ので、カンマの並びではなく :is() で包む。
const cls = (file, name) => `:is([class^="${file}_${name}_"], [class*=" ${file}_${name}_"])`;

// docs/design-system/screenshots に置く見本 (少数だけ)。画面 id (切り抜きは `画面 id/切り抜き`) → ファイル名。
// ファイル名は撮り直しても変えない (docs/_screenshot-guidelines.md)。
const DOC_SHOT_NAMES = {
    'menu-bar': '0101-menu-bar.png',
    'menu-file': '0102-menu-file.png',
    'code-tab': '0201-code-tab-1366x1024.png',
    'code-tab-large-stage/stage-header': '0202-stage-header.png',
    'code-tab-large-stage/target-pane': '0203-target-pane.png',
    'code-tab/category-menu': '0204-category-menu.png',
    'monitor': '0205-monitor.png',
    'variable-prompt': '0401-variable-prompt.png',
    'delete-sprite-confirm': '0402-delete-sprite-confirm.png',
    'code-tab/tabs': '0501-tabs.png',
    'code-tab/toggle-buttons': '0502-toggle-buttons.png',
    'code-tab/sprite-info': '0503-input-form.png',
    'sprite-library/filter-bar': '0504-library-filter-bar.png',
    'sprite-library/library-item-hover': '0505-library-item-hover.png',
    'context-menu': '0506-context-menu.png',
    'alerts': '0507-alerts.png',
    'costumes-tab/asset-panel': '0701-costumes-tab.png',
    'paint-color-picker': '0702-paint-color-picker.png',
    'sounds-tab/asset-panel': '0801-sounds-tab.png',
    'sound-selection/waveform': '0802-sound-selection.png',
    'record-modal': '0803-record-modal.png',
    'record-modal-playback': '0804-record-modal-playback.png',
};

// 見本 (DOCS_SHOTS=1) を撮ってよい viewport。上流の値が見える大きさに固定する。
const DOCS_VIEWPORT = { width: 1366, height: 1024 };
// 上流のメニューバーの高さ ($menu-bar-height = 3rem)。
const UPSTREAM_MENU_BAR_HEIGHT = '48px';

// ホバーを外すときにマウスを置く候補。ボタンなどの上でなく、ホバーで見た目が変わらない所
// (メニューバーの右の空き・画面の上の端・左の端) を順に試す。どこに置いたかは styles.json に残す。
const NEUTRAL_POINTS = [
    [1000, 24],
    [VW / 2, 1],
    [1, VH / 2],
];
const HOVER_SETTLE_MS = 700;
const RELEASE_WAIT_MS = 2100;
// ホバーを外したあと、閉じる動き (action-menu の max-height 1s など) が終わってから撮る。
const SHOT_SETTLE_MS = 1500;
const INTERACTIVE = 'button, a, input, select, textarea, [role="button"], [role="menuitem"], [class*="hoverable"]';

// ---- 画面を開く手順の部品 ----

const dispatch = (page, action) => page.evaluate((a) => window.__store.dispatch(a), action);
const openModal = (page, modal) => dispatch(page, { type: 'scratch-gui/modals/OPEN_MODAL', modal });
const activateTab = (page, tab) => dispatch(page, { type: 'scratch-gui/navigation/ACTIVATE_TAB', activeTabIndex: tab });

// コスチューム・音を 1 つ複製して、左の一覧に「選ばれていない項目」を作る (既定のスプライトは 1 つずつしか持たない)。
const duplicateAsset = (page, kind) =>
    page.evaluate(async (k) => {
        const vm = window.__store.getState().scratchGui.vm;
        await (k === 'costume' ? vm.duplicateCostume(0) : vm.duplicateSound(0));
    }, kind);

// 録音のモーダルを開く。マイクを使うには AudioContext が要り、SharedAudioContext は
// ユーザーの操作のあとでしか作られないので、先に音のエディターのラベルを押してから開く。
const openRecorder = async (page) => {
    await activateTab(page, 2);
    await page.waitForSelector(SOUND_EDITOR);
    await page.locator(`${SOUND_EDITOR} ${cls('label', 'input-label')}`).first().click();
    await openModal(page, 'soundRecorder');
    await page.waitForSelector(cls('record-modal', 'record-button-circle'));
};

// カテゴリを選んでフライアウトのボタン (変数を作る など) を押す。
const clickFlyoutButton = async (page, category, label) => {
    await page.locator('.blocklyToolboxCategory, .scratchCategoryMenuItem', { hasText: category }).first().click();
    await page.waitForTimeout(600);
    await page.locator('.blocklyFlyoutButton', { hasText: label }).first().click();
};

const findStore = (page) =>
    page.evaluate(() => {
        if (window.__store) return true;
        const all = [document.body, ...document.body.querySelectorAll('*')];
        let root = null;
        for (const el of all) {
            const k = Object.keys(el).find((x) => x.startsWith('__reactContainer'));
            if (k) {
                root = el[k];
                break;
            }
        }
        if (!root) return false;
        const seen = new WeakSet();
        const stack = [root.stateNode.current];
        while (stack.length) {
            const f = stack.pop();
            if (!f || seen.has(f)) continue;
            seen.add(f);
            const p = f.memoizedProps;
            const store = p && ((p.store && p.store.dispatch && p.store) || (p.value && p.value.store));
            if (store && typeof store.dispatch === 'function') {
                window.__store = store;
                return true;
            }
            if (f.child) stack.push(f.child);
            if (f.sibling) stack.push(f.sibling);
        }
        return false;
    });

const MODAL = cls('modal', 'modal-content');
const LIBRARY_ITEM = cls('library-item', 'library-item');
const PAINT = cls('paint-editor', 'editor-container');
const SOUND_EDITOR = cls('sound-editor', 'editor-container');

// コスチュームタブと音タブの左の一覧 (asset-panel/selector.css と sprite-selector-item.css)。
const ASSET_ITEM = `${cls('selector', 'list-area')} ${cls('sprite-selector-item', 'sprite-selector-item')}`;
const assetPanelParts = [
    { name: 'asset-panel', selector: cls('asset-panel', 'wrapper') },
    { name: 'detail-area', selector: cls('asset-panel', 'detail-area') },
    { name: 'asset-list', selector: cls('selector', 'wrapper') },
    // 一覧の下の、項目をうすく消す帯 (.new-buttons:before)
    { name: 'asset-list-fade', selector: cls('selector', 'new-buttons'), pseudo: '::before' },
    { name: 'asset-item', selector: `${ASSET_ITEM}:not(${cls('sprite-selector-item', 'is-selected')})`, hover: true },
    { name: 'asset-item-selected', selector: `${ASSET_ITEM}${cls('sprite-selector-item', 'is-selected')}` },
    { name: 'asset-item-number', selector: `${ASSET_ITEM} ${cls('sprite-selector-item', 'number')}` },
    { name: 'asset-item-details', selector: `${ASSET_ITEM} ${cls('sprite-selector-item', 'sprite-details')}` },
    {
        name: 'asset-add-button',
        selector: `${cls('selector', 'new-buttons')} ${cls('action-menu', 'main-button')}`,
        hover: true,
    },
];

// ライブラリ (拡張機能・スプライト・背景・コスチューム・音・チュートリアル) に共通の部品。
// 拡張機能とチュートリアルには絞り込みが無いので、filter と tag は見つからなくてよい。
// 絞り込みの部品。拡張機能のライブラリには無いので、そこでは optional にする。
const FILTER_PARTS = ['filter-input', 'tag-button', 'tag-button-active'];
const libraryParts = [
    { name: 'modal-header', selector: cls('modal', 'header') },
    { name: 'back-button', selector: cls('modal', 'back-button'), hover: true },
    { name: 'filter-input', selector: cls('filter', 'filter-input') },
    { name: 'tag-button', selector: cls('tag-button', 'tag-button') },
    { name: 'tag-button-active', selector: `${cls('tag-button', 'tag-button')}${cls('tag-button', 'active')}` },
    { name: 'library-item', selector: LIBRARY_ITEM, hover: true },
    { name: 'library-item-name', selector: cls('library-item', 'library-item-name') },
];

// メニューバーのメニュー (ファイル・編集) を開く。
const openMenuBarMenu = async (page, label) => {
    await page
        .locator(`${cls('menu-bar', 'menu-bar-item')}`, { hasText: label })
        .first()
        .click();
    await page.waitForSelector(cls('menu', 'menu'));
};
// ステージの大きさのボタン (小・中・大)。中はスモウルビーの追加で、既定も中。
// 上流の既定 (大) の画面を撮るときは、最後の「大」を押す。
const STAGE_SIZE_BUTTON = `${cls('stage-header', 'stage-size-toggle-group')} ${cls('toggle-buttons', 'button')}`;
// 「大」のステージの幅 (lib/layout-constants.js: 画面の幅が 1096px 以上なら 480px、狭ければ 0.85 倍の 408px)。
const LARGE_STAGE_WIDTH = VW >= 1096 ? 480 : 408;
// 最後のボタンを押して「大」にする。ボタンの題は言葉で変わるので並び順で選び、
// 並びが変わって別の大きさを押したときに気づけるように、ステージの幅で確かめる。
const setLargeStage = async (page) => {
    await page.locator(STAGE_SIZE_BUTTON).last().click();
    await page.waitForTimeout(600);
    const width = await page.evaluate((sel) => {
        const el = document.querySelector(sel);
        return el ? el.clientWidth : null;
    }, cls('stage', 'stage'));
    if (width !== LARGE_STAGE_WIDTH) {
        throw new Error(`「大」のステージにならない (幅 ${width}px。上流の「大」は ${LARGE_STAGE_WIDTH}px)`);
    }
};
const menuParts = [
    { name: 'menu', selector: cls('menu', 'menu') },
    { name: 'menu-item', selector: `${cls('menu', 'menu')} ${cls('menu', 'menu-item')}`, hover: true },
    { name: 'menu-section', selector: cls('menu', 'menu-section') },
];

/**
 * 撮る画面の一覧。上流 (Scratch) 由来の画面だけ (EPIC #1809 の「対象」)。
 * - setup: 画面を開く手順
 * - shot: 切り抜く部品 (無ければ画面全体)
 * - parts: スタイルを読む部品 (hover: true でホバーしたときの値も読む。
 *          optional: true は無くてよい部品。それ以外が見つからなければその画面は失敗。
 *          focus: true でフォーカスしたときの値、focusSelector でほかの要素にフォーカスしたときの値、
 *          active: true でマウスを押している間の値、blurFirst: true は自動でフォーカスされる部品の
 *          ふつうの値を読むために先にフォーカスを外す。pseudo: '::before' は疑似要素の値を読む)
 * - crops: 部品だけを切り抜いて撮る ({ name, selector, hover, first: N で先頭 N 個を囲む, padRight })
 * - close: 次の画面のために閉じる手順 (無ければページを開き直す)
 */
const SCENES = [
    {
        id: 'menu-bar',
        title: 'メニューバー',
        shot: cls('menu-bar', 'menu-bar'),
        parts: [
            { name: 'menu-bar', selector: cls('menu-bar', 'menu-bar') },
            { name: 'menu-bar-item', selector: `${cls('menu-bar', 'file-group')} ${cls('menu-bar', 'hoverable')}`, hover: true },
            // .no-offset の項目 (上流のチュートリアル・デバッグと同じ形。スモウルビーではレッスン)
            { name: 'menu-bar-item-no-offset', selector: '[data-testid="menu-bar-lessons"]' },
            { name: 'logo', selector: '#logo_img' },
            { name: 'divider', selector: cls('divider', 'divider') },
            // 「?」の項目 (上流の about のメニュー。スモウルビーはチュートリアル・デバッグをこの中に移した)
            { name: 'about-item', selector: '[data-testid="menu-bar-about"]', hover: true },
            { name: 'about-icon', selector: cls('menu-bar', 'about-icon') },
            {
                name: 'project-title-input',
                selector: cls('project-title-input', 'title-field'),
                hover: true,
                focus: true,
            },
        ],
    },
    {
        id: 'menu-file',
        title: 'ファイルのメニュー',
        setup: (page) => openMenuBarMenu(page, 'ファイル'),
        shot: cls('menu', 'menu'),
        parts: [
            ...menuParts,
            // メニューを開いている間のメニューバーの項目 (.menu-bar-item.active)
            { name: 'menu-bar-item-active', selector: `${cls('menu-bar', 'menu-bar-item')}${cls('menu-bar', 'active')}` },
        ],
    },
    {
        id: 'menu-edit',
        title: '編集のメニュー',
        setup: (page) => openMenuBarMenu(page, '編集'),
        shot: cls('menu', 'menu'),
        parts: menuParts,
    },
    {
        id: 'menu-help',
        title: '「?」のメニュー (チュートリアル・デバッグ。上流はメニューバーに並べる)',
        setup: async (page) => {
            await page.locator('[data-testid="menu-bar-about"]').click();
            await page.waitForSelector(cls('menu', 'menu'));
        },
        shot: cls('menu', 'menu'),
        parts: menuParts,
    },
    {
        id: 'code-tab',
        title: 'コードタブ',
        parts: [
            { name: 'tab', selector: `${cls('gui', 'tab')}:not(${cls('gui', 'is-selected')})`, hover: true },
            { name: 'tab-selected', selector: `${cls('gui', 'tab')}${cls('gui', 'is-selected')}` },
            { name: 'category-menu', selector: '.blocklyToolbox, .blocklyToolboxDiv' },
            { name: 'category-label', selector: '.blocklyToolboxCategoryLabel, .scratchCategoryMenuItemLabel' },
            { name: 'flyout', selector: '.blocklyFlyoutBackground' },
            { name: 'workspace', selector: '.blocklyMainBackground' },
            { name: 'stage-header', selector: cls('stage-header', 'stage-header-wrapper') },
            { name: 'stage-size-button', selector: cls('toggle-buttons', 'button') },
            { name: 'toggle-button-selected', selector: `${cls('toggle-buttons', 'button')}[aria-pressed="true"]` },
            {
                name: 'toggle-button',
                selector: `${cls('toggle-buttons', 'button')}[aria-pressed="false"]`,
                hover: true,
                focus: true,
                active: true,
            },
            // 切り替えボタンのフォーカスは ::before の枠で描く (toggle-buttons.css の .button:focus::before)
            {
                name: 'toggle-button-focus-ring',
                selector: `${cls('toggle-buttons', 'button')}[aria-pressed="false"]`,
                pseudo: '::before',
                focus: true,
            },
            { name: 'sprite-info', selector: cls('sprite-info', 'sprite-info') },
            { name: 'sprite-info-input', selector: cls('sprite-info', 'sprite-input'), hover: true, focus: true },
            { name: 'sprite-selector', selector: cls('sprite-selector', 'sprite-selector') },
            { name: 'sprite-selector-item-selected', selector: cls('sprite-selector-item', 'is-selected') },
            { name: 'stage-selector', selector: cls('stage-selector', 'stage-selector') },
            { name: 'action-menu-button', selector: cls('action-menu', 'main-button'), hover: true },
            { name: 'extension-button', selector: cls('extension-button', 'extension-button'), focus: true },
            { name: 'extension-button-container', selector: cls('extension-button', 'extension-button-container') },
            // ブロックのパレット・カテゴリ・スクリプトエリア (scratch-blocks の DOM と blocks.css)
            { name: 'blocks-frame', selector: '.injectionDiv' },
            { name: 'category-item', selector: '.blocklyToolboxCategory', hover: true },
            { name: 'category-bubble', selector: '.categoryBubble' },
            { name: 'flyout-label', selector: '.blocklyFlyoutLabelText' },
            { name: 'flyout-button', selector: '.blocklyFlyoutButtonBackground' },
            { name: 'flyout-checkbox', selector: '.blocklyFlyoutCheckbox' },
            { name: 'zoom-control', selector: '.blocklyZoom > image', hover: true },
            // ステージの上の段 (緑の旗・止める・全画面)
            { name: 'green-flag', selector: cls('green-flag', 'green-flag'), hover: true },
            { name: 'stop-all', selector: cls('stop-all', 'stop-all'), hover: true },
            { name: 'full-screen-button', selector: cls('stage-header', 'stage-button'), active: true },
            { name: 'stage', selector: cls('stage', 'stage') },
            { name: 'input-label', selector: cls('label', 'input-label') },
        ],
        crops: [
            // カテゴリの一覧 (上流の 9 つのカテゴリ。拡張機能のカテゴリは足していない)
            { name: 'category-menu', selector: '.blocklyToolboxCategory', first: 9 },
            // 上流のタブ (コード・コスチューム・音) だけを囲んで撮る。4 つめの Ruby タブはスモウルビーの追加
            // 右は余白をつけない (4 つめの Ruby タブの端が写らないように)
            { name: 'tabs', selector: cls('gui', 'tab'), first: 3, padRight: 0 },
            { name: 'toggle-buttons', selector: cls('toggle-buttons', 'row') },
            { name: 'sprite-info', selector: cls('sprite-info', 'sprite-info') },
        ],
    },
    {
        // スモウルビーの既定は「中」のステージ。上流の既定 (大・480×360) に切りかえて、
        // ステージ・スプライトの情報・ターゲットの一覧を上流の並びで撮る。
        id: 'code-tab-large-stage',
        title: 'コードタブ (大きいステージ。上流の既定)',
        setup: async (page) => {
            await setLargeStage(page);
            // カテゴリを 1 つ選んでおく (選ばれたカテゴリの値を読むため)
            await page.locator('.blocklyToolboxCategory').first().click();
            await page.waitForTimeout(600);
        },
        waitFor: cls('stage-selector', 'header'),
        parts: [
            { name: 'stage', selector: cls('stage', 'stage') },
            { name: 'stage-menu', selector: cls('stage-header', 'stage-menu-wrapper') },
            { name: 'target-wrapper', selector: cls('gui', 'target-wrapper') },
            { name: 'sprite-info', selector: cls('sprite-info', 'sprite-info') },
            { name: 'sprite-selector', selector: cls('sprite-selector', 'sprite-selector') },
            { name: 'sprite-wrapper', selector: cls('sprite-selector', 'sprite-wrapper') },
            { name: 'stage-selector', selector: cls('stage-selector', 'stage-selector'), hover: true },
            { name: 'stage-selector-header', selector: cls('stage-selector', 'header') },
            { name: 'stage-selector-header-title', selector: cls('stage-selector', 'header-title') },
            { name: 'stage-selector-label', selector: cls('stage-selector', 'label') },
            { name: 'stage-selector-count', selector: cls('stage-selector', 'count') },
            { name: 'stage-selector-costume', selector: cls('stage-selector', 'costume-canvas') },
            { name: 'category-item-selected', selector: '.blocklyToolboxSelected' },
        ],
        crops: [
            { name: 'stage-header', selector: cls('stage-header', 'stage-menu-wrapper') },
            { name: 'target-pane', selector: cls('target-pane', 'target-pane') },
        ],
    },
    {
        id: 'monitor',
        title: 'モニター (x座標)',
        // 動きのカテゴリの「x座標」のチェックボックスを押すと、ステージにモニターが出る
        // 前提: 動きのカテゴリが先頭で、最初のチェックボックスが「x座標」。
        // チェックボックスの上に Blockly の透明な当たりの要素が重なっていて、ふつうの click は
        // 「ほかの要素が受け取る」と待ち続けるので、force で要素の中央を押す (当たりの要素が受け取って同じ動きになる)。
        // ステージは上流の既定の「大」にする (中・小ではモニターも縮んで写る)
        setup: async (page) => {
            await setLargeStage(page);
            await page.locator('.blocklyFlyoutCheckbox').first().click({ force: true });
        },
        waitFor: cls('monitor', 'monitor-container'),
        shot: cls('monitor', 'monitor-container'),
        parts: [
            { name: 'monitor', selector: cls('monitor', 'monitor-container') },
            { name: 'monitor-label', selector: cls('monitor', 'label') },
            { name: 'monitor-value', selector: cls('monitor', 'value') },
        ],
    },
    {
        id: 'costumes-tab',
        title: 'コスチュームタブ (ペイントエディター)',
        setup: async (page) => {
            await duplicateAsset(page, 'costume');
            await activateTab(page, 1);
        },
        waitFor: PAINT,
        parts: [
            // 左のコスチュームの一覧 (asset-panel・selector は GUI、中の項目は sprite-selector-item)
            ...assetPanelParts,
            // ペイントエディター (scratch-paint)。GUI と同じ名前の CSS (input・label・button) があるので PAINT の中に限る
            { name: 'paint-editor', selector: PAINT },
            { name: 'editor-top', selector: cls('paint-editor', 'editor-container-top') },
            { name: 'dashed-border', selector: cls('fixed-tools', 'mod-dashed-border') },
            { name: 'costume-input', selector: cls('fixed-tools', 'costume-input'), hover: true, focus: true },
            { name: 'input-label', selector: `${PAINT} ${cls('label', 'input-label')}` },
            // 元に戻す・やり直す (はじめは押せない)
            { name: 'undo-button', selector: cls('fixed-tools', 'button-group-button') },
            // グループにする・手前に出す… (何も選んでいないときは押せない)
            { name: 'labeled-icon-button', selector: cls('labeled-icon-button', 'mod-edit-field') },
            { name: 'labeled-icon-title', selector: cls('labeled-icon-button', 'edit-field-title'), optional: true },
            { name: 'color-button-swatch', selector: cls('color-button', 'color-button-swatch') },
            { name: 'color-button-arrow', selector: cls('color-button', 'color-button-arrow') },
            // 枠線の太さ (paint の forms/input.css の .input-small-range)
            {
                name: 'stroke-width-input',
                selector: `${PAINT} ${cls('input', 'input-small-range')}`,
                hover: true,
                focus: true,
            },
            { name: 'mode-tools', selector: cls('mode-tools', 'mode-tools') },
            {
                name: 'tool-button',
                selector: `${cls('tool-select-base', 'mod-tool-select')}:not(${cls('tool-select-base', 'is-selected')})`,
                hover: true,
                focus: true,
                active: true,
            },
            { name: 'tool-button-selected', selector: cls('tool-select-base', 'is-selected') },
            { name: 'tool-button-selected-icon', selector: `${cls('tool-select-base', 'is-selected')} img` },
            { name: 'canvas-container', selector: cls('paint-editor', 'canvas-container') },
            { name: 'paper-canvas', selector: cls('paper-canvas', 'paper-canvas') },
            { name: 'scrollbar', selector: cls('scrollable-canvas', 'vertical-scrollbar') },
            { name: 'bitmap-button', selector: cls('paint-editor', 'bitmap-button'), hover: true, active: true },
            { name: 'zoom-button', selector: cls('paint-editor', 'button-group-button'), hover: true, active: true },
        ],
        crops: [
            // コスチュームタブ全体 (左の一覧 + ペイントエディター)
            { name: 'asset-panel', selector: cls('asset-panel', 'wrapper') },
            { name: 'editor-top', selector: cls('paint-editor', 'editor-container-top') },
            { name: 'mode-selector', selector: cls('paint-editor', 'mode-selector') },
        ],
        // コスチュームを複製したので、閉じずにページを開き直す (ONLY で一部だけ流しても変更を残さない)
    },
    {
        id: 'paint-color-picker',
        title: 'ペイントエディターの色を選ぶ吹き出し (塗りつぶし)',
        setup: async (page) => {
            await activateTab(page, 1);
            await page.waitForSelector(PAINT);
            await page.locator(cls('color-button', 'color-button-swatch')).first().click();
        },
        waitFor: '.Popover-body',
        shot: '.Popover-body',
        parts: [
            { name: 'popover-body', selector: '.Popover-body' },
            { name: 'popover-tip', selector: '.Popover-tipShape' },
            { name: 'row-header', selector: cls('color-picker', 'row-header') },
            { name: 'label-name', selector: cls('color-picker', 'label-name') },
            { name: 'slider', selector: cls('slider', 'container') },
            { name: 'slider-handle', selector: cls('slider', 'handle') },
            { name: 'divider', selector: cls('color-picker', 'divider') },
            { name: 'swatch', selector: `${cls('color-picker', 'swatch')}:not(${cls('color-picker', 'active-swatch')})` },
            // 選ばれた見本 (塗りなし・スポイト・グラデーションの種類)。単色の塗りでは無い
            { name: 'swatch-active', selector: cls('color-picker', 'active-swatch'), optional: true },
        ],
    },
    {
        id: 'sounds-tab',
        title: '音タブ (音のエディター)',
        setup: async (page) => {
            await duplicateAsset(page, 'sound');
            await activateTab(page, 2);
        },
        waitFor: SOUND_EDITOR,
        parts: [
            ...assetPanelParts,
            { name: 'sound-editor', selector: SOUND_EDITOR },
            { name: 'input-group', selector: cls('sound-editor', 'input-group') },
            { name: 'sound-name-input', selector: `${SOUND_EDITOR} ${cls('input', 'input-form')}`, hover: true, focus: true },
            { name: 'input-label', selector: `${SOUND_EDITOR} ${cls('label', 'input-label')}` },
            // 元に戻す・やり直す (はじめは押せない。押せるときの値は sound-selection で読む)
            { name: 'undo-button', selector: `${cls('sound-editor', 'button-group')} ${cls('sound-editor', 'button')}` },
            { name: 'undo-button-icon', selector: `${cls('sound-editor', 'button-group')} ${cls('sound-editor', 'button')} img` },
            // 道具のボタン (コピー・貼り付け・新しい音にコピー・削除)。icon-button の .container を .tool-button で上書き
            {
                name: 'tool-button',
                selector: `${cls('sound-editor', 'tool-button')}:not(${cls('icon-button', 'disabled')})`,
                hover: true,
                active: true,
            },
            { name: 'tool-button-disabled', selector: `${cls('sound-editor', 'tool-button')}${cls('icon-button', 'disabled')}` },
            { name: 'icon-button-title', selector: `${cls('sound-editor', 'tool-button')} ${cls('icon-button', 'title')}` },
            { name: 'round-button', selector: cls('sound-editor', 'round-button'), hover: true, active: true },
            // 効果のボタン (速く・遅く…)。icon-button の .container を sound-editor の .effect-button で上書きしている
            { name: 'effect-button', selector: cls('sound-editor', 'effect-button'), hover: true, active: true },
            { name: 'effect-button-icon', selector: `${cls('sound-editor', 'effect-button')} img` },
            { name: 'waveform-container', selector: cls('sound-editor', 'waveform-container') },
            { name: 'waveform-path', selector: cls('waveform', 'waveform-path') },
        ],
        crops: [
            // 音タブ全体 (左の一覧 + 音のエディター)
            { name: 'asset-panel', selector: cls('asset-panel', 'wrapper') },
            { name: 'effect-buttons', selector: cls('sound-editor', 'effect-button'), first: 9 },
        ],
        // 音を複製したので、閉じずにページを開き直す
    },
    {
        // 効果を 1 つかけて (元に戻すが押せるようにする)、波形の上をドラッグして範囲を選ぶ
        id: 'sound-selection',
        title: '音のエディターで範囲を選んだところ',
        setup: async (page) => {
            await activateTab(page, 2);
            await page.waitForSelector(SOUND_EDITOR);
            await page.locator(cls('sound-editor', 'effect-button')).first().click();
            await page.waitForTimeout(800);
            const box = await page.locator(cls('sound-editor', 'waveform-container')).boundingBox();
            await page.mouse.move(box.x + box.width * 0.3, box.y + box.height / 2);
            await page.mouse.down();
            await page.mouse.move(box.x + box.width * 0.6, box.y + box.height / 2, { steps: 8 });
            await page.mouse.up();
        },
        waitFor: cls('audio-trimmer', 'selection-background'),
        parts: [
            { name: 'selection-background', selector: cls('audio-trimmer', 'selection-background') },
            { name: 'selection-line', selector: `${cls('audio-trimmer', 'selector')} ${cls('audio-trimmer', 'trim-line')}` },
            { name: 'selection-handle', selector: `${cls('audio-trimmer', 'selector')} ${cls('audio-trimmer', 'trim-handle')}` },
            { name: 'selection-handle-icon', selector: `${cls('audio-trimmer', 'selector')} ${cls('audio-trimmer', 'trim-handle')} img` },
            {
                name: 'undo-button',
                selector: `${cls('sound-editor', 'button-group')} ${cls('sound-editor', 'button')}:not(:disabled)`,
                hover: true,
                focus: true,
                active: true,
            },
            // 並びのボタンのフォーカスは ::before の枠で描く (sound-editor.css の .button:focus::before)
            {
                name: 'undo-button-focus-ring',
                selector: `${cls('sound-editor', 'button-group')} ${cls('sound-editor', 'button')}:not(:disabled)`,
                pseudo: '::before',
                focus: true,
            },
            { name: 'tool-button-delete', selector: `${cls('sound-editor', 'tool-button')}:not(${cls('icon-button', 'disabled')})` },
        ],
        // 範囲の持ち手は波形の枠の上下にはみ出すので、枠を含む段 (2 段目の .row) ごと撮る
        crops: [{ name: 'waveform', selector: `${SOUND_EDITOR} > ${cls('sound-editor', 'row')}:nth-child(2)` }],
        // 効果をかけて音を変えたので、閉じずにページを開き直す
    },
    {
        id: 'record-modal',
        title: '音を録音するモーダル (録音の前)',
        // 録音のモーダルは音タブの中で描かれるので、先に音タブを開く。マイクは起動時の引数の偽の機器を使う
        setup: openRecorder,
        waitFor: cls('record-modal', 'record-button-circle'),
        shot: MODAL,
        parts: [
            { name: 'modal-content', selector: MODAL },
            { name: 'modal-header', selector: cls('modal', 'header') },
            { name: 'body', selector: cls('record-modal', 'body') },
            { name: 'meter-container', selector: cls('record-modal', 'meter-container') },
            { name: 'waveform-container', selector: cls('record-modal', 'waveform-container') },
            { name: 'help-text', selector: cls('record-modal', 'help-text') },
            { name: 'record-button', selector: `${cls('record-modal', 'main-button-row')} button`, hover: true, active: true },
            { name: 'record-button-circle', selector: cls('record-modal', 'record-button-circle') },
            { name: 'record-button-outline', selector: cls('record-modal', 'record-button-circle-outline') },
            { name: 'meter-green', selector: cls('meter', 'green') },
        ],
    },
    {
        id: 'record-modal-playback',
        title: '音を録音するモーダル (録音のあと)',
        // 1.5 秒録音して止め、始まりの持ち手を右へ動かして、切り落とす部分 (赤い斜線) を出す
        setup: async (page) => {
            await openRecorder(page);
            const button = page.locator(`${cls('record-modal', 'main-button-row')} button`).first();
            await page.waitForTimeout(1000);
            await button.click();
            await page.waitForTimeout(1500);
            await button.click();
            await page.waitForSelector(cls('record-modal', 'button-row'), { timeout: 15000 });
            const box = await page.locator(cls('record-modal', 'waveform-container')).boundingBox();
            const handle = await page.locator(`${cls('audio-trimmer', 'trimmer')} ${cls('audio-trimmer', 'trim-handle')}`).first().boundingBox();
            await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2);
            await page.mouse.down();
            await page.mouse.move(handle.x + handle.width / 2 + box.width * 0.2, handle.y + handle.height / 2, { steps: 8 });
            await page.mouse.up();
        },
        waitFor: cls('audio-trimmer', 'trim-background-mask'),
        shot: MODAL,
        parts: [
            { name: 'button-row', selector: cls('record-modal', 'button-row') },
            {
                name: 'rerecord-button',
                selector: `${cls('record-modal', 'button-row')} button:not(${cls('record-modal', 'ok-button')})`,
                hover: true,
            },
            { name: 'ok-button', selector: cls('record-modal', 'ok-button'), hover: true },
            { name: 'play-button', selector: `${cls('record-modal', 'main-button-row')} button`, hover: true },
            { name: 'trim-line', selector: `${cls('audio-trimmer', 'trimmer')} ${cls('audio-trimmer', 'trim-line')}` },
            { name: 'trim-handle', selector: `${cls('audio-trimmer', 'trimmer')} ${cls('audio-trimmer', 'trim-handle')}` },
            { name: 'trim-background-mask', selector: cls('audio-trimmer', 'trim-background-mask') },
            { name: 'playing-text', selector: cls('record-modal', 'playing-text'), optional: true },
            { name: 'waveform-path', selector: `${cls('record-modal', 'waveform-container')} ${cls('waveform', 'waveform-path')}` },
        ],
    },
    {
        id: 'extension-library',
        title: '拡張機能のモーダル',
        setup: (page) => openModal(page, 'extensionLibrary'),
        waitFor: LIBRARY_ITEM,
        shot: MODAL,
        parts: [
            { name: 'modal-overlay', selector: cls('modal', 'modal-overlay') },
            { name: 'modal-content', selector: MODAL },
            ...libraryParts.map((p) => (FILTER_PARTS.includes(p.name) ? { ...p, optional: true } : p)),
        ],
    },
    {
        id: 'sprite-library',
        title: 'スプライトを選ぶ',
        setup: (page) => openModal(page, 'spriteLibrary'),
        waitFor: LIBRARY_ITEM,
        parts: [
            ...libraryParts.map((p) =>
                p.name === 'tag-button'
                    ? { ...p, selector: `${p.selector}:not(${cls('tag-button', 'active')})`, hover: true, focus: true }
                    : p,
            ),
            // 絞り込みの入力欄の枠 (.filter)。入力欄にフォーカスすると :focus-within で輪が付く
            { name: 'filter', selector: cls('filter', 'filter'), focusSelector: cls('filter', 'filter-input') },
        ],
        crops: [
            { name: 'filter-bar', selector: cls('library', 'filter-bar') },
            { name: 'library-item-hover', selector: LIBRARY_ITEM, hover: true },
        ],
    },
    {
        id: 'backdrop-library',
        title: '背景を選ぶ',
        setup: (page) => openModal(page, 'backdropLibrary'),
        waitFor: LIBRARY_ITEM,
        parts: libraryParts,
    },
    {
        id: 'costume-library',
        title: 'コスチュームを選ぶ',
        setup: (page) => openModal(page, 'costumeLibrary'),
        waitFor: LIBRARY_ITEM,
        parts: libraryParts,
    },
    {
        id: 'sound-library',
        title: '音を選ぶ',
        // 音のライブラリは音タブの中で描かれるので、先に音タブを開く。
        setup: async (page) => {
            await activateTab(page, 2);
            await page.waitForSelector(cls('sound-editor', 'editor-container'));
            await openModal(page, 'soundLibrary');
        },
        waitFor: LIBRARY_ITEM,
        parts: libraryParts,
    },
    {
        id: 'tutorial-library',
        title: 'チュートリアルのモーダル',
        setup: (page) => openModal(page, 'tipsLibrary'),
        waitFor: LIBRARY_ITEM,
        parts: libraryParts,
    },
    {
        id: 'debug-modal',
        title: 'デバッグのモーダル',
        setup: (page) => openModal(page, 'debugModal'),
        waitFor: cls('debug-modal', 'debug-modal-container'),
        shot: cls('debug-modal', 'debug-modal-container'),
        parts: [
            { name: 'debug-modal', selector: cls('debug-modal', 'debug-modal-container') },
            { name: 'debug-modal-header', selector: cls('debug-modal', 'modal-header') },
            { name: 'debug-modal-topic-list', selector: cls('debug-modal', 'topic-list') },
            { name: 'debug-modal-topic', selector: cls('debug-modal', 'topic-item'), hover: true },
            { name: 'debug-modal-topic-selected', selector: cls('debug-modal', 'active') },
        ],
    },
    {
        id: 'delete-sprite-confirm',
        title: 'スプライトを削除するときの確認',
        setup: async (page) => {
            await page.locator(cls('sprite-selector-item', 'delete-button')).first().click();
        },
        // 削除の確認は共通の confirmation-prompt に delete-confirmation-prompt のクラスを重ねたもの。
        waitFor: cls('confirmation-prompt', 'modal-container'),
        shot: cls('confirmation-prompt', 'modal-container'),
        parts: [
            { name: 'prompt', selector: cls('confirmation-prompt', 'modal-container') },
            { name: 'label', selector: cls('confirmation-prompt', 'label') },
            { name: 'confirm-button', selector: cls('confirmation-prompt', 'confirm-button'), hover: true, focus: true },
            { name: 'cancel-button', selector: cls('confirmation-prompt', 'cancel-button'), hover: true },
        ],
    },
    {
        id: 'variable-prompt',
        title: '変数を作る',
        setup: (page) => clickFlyoutButton(page, '変数', '変数を作る'),
        waitFor: cls('prompt', 'body'),
        shot: MODAL,
        parts: [
            { name: 'modal-overlay', selector: cls('modal', 'modal-overlay') },
            { name: 'modal-content', selector: MODAL },
            { name: 'modal-header', selector: cls('modal', 'header') },
            { name: 'body', selector: cls('prompt', 'body') },
            { name: 'label', selector: cls('prompt', 'label') },
            // 開くと自動でフォーカスされるので、先に外してふつうの値を読み、フォーカスの値は別に読む
            { name: 'variable-name-input', selector: cls('prompt', 'variable-name-text-input'), blurFirst: true, focus: true },
            { name: 'option-radio-label', selector: cls('prompt', 'options-row') },
            { name: 'ok-button', selector: cls('prompt', 'ok-button'), hover: true, focus: true },
            // 取り消しのボタンは CSS のクラスを持たない (.button-row button で書かれている)
            { name: 'cancel-button', selector: `${cls('prompt', 'button-row')} button:not(${cls('prompt', 'ok-button')})`, hover: true },
            { name: 'close-button', selector: `${cls('modal', 'header-item-close')} ${cls('close-button', 'close-button')}`, hover: true },
        ],
    },
    {
        id: 'list-prompt',
        title: 'リストを作る',
        setup: (page) => clickFlyoutButton(page, '変数', 'リストを作る'),
        waitFor: cls('prompt', 'body'),
        shot: MODAL,
        parts: [{ name: 'body', selector: cls('prompt', 'body') }],
    },
    {
        id: 'custom-procedures',
        title: 'ブロックを作る (関数の定義)',
        setup: (page) => clickFlyoutButton(page, 'ブロック定義', 'ブロックを作る'),
        waitFor: cls('custom-procedures', 'workspace'),
        shot: MODAL,
        parts: [
            { name: 'modal-header', selector: cls('modal', 'header') },
            { name: 'body', selector: cls('custom-procedures', 'body') },
            { name: 'workspace', selector: cls('custom-procedures', 'workspace') },
            { name: 'option-card', selector: cls('custom-procedures', 'option-card'), hover: true },
            { name: 'ok-button', selector: cls('custom-procedures', 'ok-button'), hover: true },
            {
                name: 'cancel-button',
                selector: `${cls('custom-procedures', 'button-row')} button:not(${cls('custom-procedures', 'ok-button')})`,
                hover: true,
            },
        ],
    },
    {
        id: 'connection-modal',
        title: '機器と接続するモーダル (micro:bit)',
        setup: async (page) => {
            await page.evaluate(async () => {
                const vm = window.__store.getState().scratchGui.vm;
                if (!vm.extensionManager.isExtensionLoaded('microbit')) {
                    await vm.extensionManager.loadExtensionURL('microbit');
                }
            });
            await dispatch(page, { type: 'scratch-gui/connection-modal/setId', extensionId: 'microbit' });
            await openModal(page, 'connectionModal');
        },
        waitFor: cls('connection-modal', 'body'),
        shot: MODAL,
        parts: [
            { name: 'modal-header', selector: cls('modal', 'header') },
            { name: 'body', selector: cls('connection-modal', 'body') },
            { name: 'bottom-area', selector: cls('connection-modal', 'bottom-area') },
            { name: 'connection-button', selector: cls('connection-modal', 'connection-button'), hover: true },
            { name: 'close-button', selector: cls('close-button', 'close-button'), hover: true },
        ],
    },
    {
        id: 'context-menu',
        title: '右クリックのメニュー (スプライト)',
        setup: async (page) => {
            await page.locator(cls('sprite-selector-item', 'sprite-selector-item')).first().click({ button: 'right' });
        },
        waitFor: cls('context-menu', 'context-menu-content'),
        shot: cls('context-menu', 'context-menu-content'),
        parts: [
            { name: 'context-menu', selector: cls('context-menu', 'context-menu-content') },
            // ホバーすると Radix が data-highlighted を付ける
            { name: 'menu-item', selector: cls('context-menu', 'menu-item'), hover: true },
            { name: 'menu-item-bordered', selector: cls('context-menu', 'menu-item-bordered') },
        ],
    },
    {
        id: 'alerts',
        title: 'アラート (注意・成功・お知らせ)',
        // 上流のアラートを 1 つずつ出す: creatingError = warn、createSuccess = success、settingThumbnail = info-blue
        setup: async (page) => {
            for (const alertId of ['creatingError', 'createSuccess', 'settingThumbnail']) {
                await dispatch(page, { type: 'scratch-gui/alerts/SHOW_ALERT', alertId });
            }
        },
        waitFor: `${cls('alert', 'alert')}${cls('alert', 'info-blue')}`,
        shot: cls('alerts', 'alerts-inner-container'),
        parts: [
            { name: 'alert-warn', selector: `${cls('alert', 'alert')}${cls('alert', 'warn')}` },
            { name: 'alert-success', selector: `${cls('alert', 'alert')}${cls('alert', 'success')}` },
            { name: 'alert-info-blue', selector: `${cls('alert', 'alert')}${cls('alert', 'info-blue')}` },
            { name: 'alert-message', selector: cls('alert', 'alert-message') },
            {
                name: 'alert-close-button',
                selector: `${cls('alert', 'alert')} ${cls('close-button', 'close-button')}`,
                hover: true,
            },
        ],
    },
];

// ---- 読み取り ----

const readStyle = (page, selector, pseudo = null) =>
    page.evaluate(
        ({ selector, props, pseudo }) => {
            const el = document.querySelector(selector);
            if (!el) return null;
            const cs = getComputedStyle(el, pseudo);
            const out = {};
            for (const p of props) out[p] = cs.getPropertyValue(p);
            const r = el.getBoundingClientRect();
            out['@rect'] = { width: Math.round(r.width), height: Math.round(r.height) };
            return out;
        },
        { selector, props: PROPS, pseudo },
    );

// ホバー前と値が違うものだけを返す (ホバーで変わる値が見やすいように)。
const diff = (before, after) => {
    const out = {};
    for (const k of Object.keys(after || {})) {
        if (k !== '@rect' && before && before[k] !== after[k]) out[k] = after[k];
    }
    return out;
};

const readBlockColours = (page) =>
    page.evaluate(() => {
        const out = {};
        const cs = getComputedStyle(document.documentElement);
        for (const sheet of document.styleSheets) {
            let rules;
            try {
                rules = sheet.cssRules;
            } catch (e) {
                continue;
            }
            for (const rule of rules) {
                if (!rule.style) continue;
                for (const name of rule.style) {
                    if (name.startsWith('--colour-')) out[name] = cs.getPropertyValue(name).trim();
                }
            }
        }
        for (const name of document.documentElement.style) {
            if (name.startsWith('--colour-')) out[name] = cs.getPropertyValue(name).trim();
        }
        return out;
    });

// ホバーを外すためにマウスを置く場所を選ぶ。ボタンなどの上でない所を返す。
const neutralPoint = (page) =>
    page.evaluate(
        ({ points, interactive }) => {
            for (const [x, y] of points) {
                const el = document.elementFromPoint(x, y);
                if (el && !el.closest(interactive)) return [x, y];
            }
            return points[0];
        },
        { points: NEUTRAL_POINTS, interactive: INTERACTIVE },
    );

const readMenuBarHeight = (page) =>
    page.evaluate((sel) => {
        const el = document.querySelector(sel);
        return el ? getComputedStyle(el).height : null;
    }, cls('menu-bar', 'menu-bar'));

// ホバー・フォーカス・押した状態の値を読む (ふつうの値との差だけ)。
const releaseMouse = async (page) => {
    const [x, y] = await neutralPoint(page);
    await page.mouse.move(x, y);
    return [x, y];
};

const measureHover = async (page, scene, part, style, entry) => {
    try {
        await page.locator(part.selector).first().hover({ timeout: 3000 });
        // transition が終わるのを待つ (上流で一番長いのは action-menu の 0.5s)
        await page.waitForTimeout(HOVER_SETTLE_MS);
        entry.hover = diff(style, await readStyle(page, part.selector, part.pseudo));
    } catch (e) {
        entry.hover = { error: e.message.split('\n')[0] };
    }
    entry.hoverReleasedAt = await releaseMouse(page);
    // マウスを離したら元の値に戻ったか (置いた場所がホバーを起こしていないか) を確かめる。
    // 閉じるまで遅れる部品 (action-menu) があるので、少しのあいだ待ちながら見る。
    let back = {};
    for (let waited = 0; waited <= RELEASE_WAIT_MS; waited += HOVER_SETTLE_MS) {
        await page.waitForTimeout(HOVER_SETTLE_MS);
        back = diff(style, await readStyle(page, part.selector, part.pseudo));
        if (!Object.keys(back).length) break;
    }
    if (Object.keys(back).length) {
        entry.hoverNotReleased = back;
        console.warn(`注意: ${scene.id}/${part.name} がホバーを外しても戻らない: ${JSON.stringify(back)}`);
    }
};

// キーボードで操作したときのフォーカス (:focus-visible) を読むため、先にキーを 1 つ押してから
// プログラムでフォーカスする (Chromium はキー操作のあとのフォーカスを focus-visible として扱う)。
const measureFocus = async (page, part, style, entry) => {
    try {
        await page.keyboard.press('Shift');
        await page.locator(part.focusSelector || part.selector).first().focus({ timeout: 3000 });
        await page.waitForTimeout(HOVER_SETTLE_MS);
        entry.focus = diff(style, await readStyle(page, part.selector, part.pseudo));
    } catch (e) {
        entry.focus = { error: e.message.split('\n')[0] };
    }
    await page.evaluate(() => document.activeElement && document.activeElement.blur());
    await page.waitForTimeout(HOVER_SETTLE_MS);
};

// 押している間 (:active) の値。部品の上で押して、離す前に外へ動かすのでクリックにはならない。
const measureActive = async (page, part, style, entry) => {
    try {
        await page.locator(part.selector).first().hover({ timeout: 3000 });
        await page.mouse.down();
        await page.waitForTimeout(300);
        entry.active = diff(style, await readStyle(page, part.selector, part.pseudo));
    } catch (e) {
        entry.active = { error: e.message.split('\n')[0] };
    } finally {
        // 途中で失敗しても押したままにしない。部品の外へ動かしてから離すので、クリックにはならない
        await releaseMouse(page).catch(() => {});
        await page.mouse.up().catch(() => {});
    }
    // 押すとフォーカスも移るので外す (次の部品のふつうの値に混ざらないように)
    await page.evaluate(() => document.activeElement && document.activeElement.blur());
    await page.waitForTimeout(HOVER_SETTLE_MS);
};

const openGui = async (page) => {
    await page.goto(`${BASE}/?no_beforeunload=1`, { waitUntil: 'load' });
    await page.waitForSelector('.blocklyWorkspace', { timeout: 90000 });
    await page.addStyleTag({ content: `${HIDE_SELECTORS.join(',\n')} { display: none !important; }` });
    if (!(await findStore(page))) throw new Error('Redux store が見つからない');
    await page.waitForTimeout(1500);
};

// ---- 実行 ----

const main = async () => {
    if (process.env.LIST === '1') {
        SCENES.forEach((s, i) => console.log(`${String(i + 1).padStart(2, '0')} ${s.id}\t${s.title}`));
        return 0;
    }
    const scenes = ONLY.length ? SCENES.filter((s) => ONLY.includes(s.id)) : SCENES;
    if (ONLY.length && scenes.length !== ONLY.length) {
        const known = SCENES.map((s) => s.id);
        throw new Error(`知らない画面: ${ONLY.filter((id) => !known.includes(id)).join(', ')}`);
    }
    mkdirSync(OUT_DIR, { recursive: true });

    // 録音のモーダル (record-modal) のために、偽のマイクを許可なしで使う
    const browser = await chromium.launch({
        headless: HEADLESS,
        channel: CHANNEL,
        args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'],
    });
    const results = { base: BASE, viewport: VIEWPORT, locale: LOCALE, capturedAt: new Date().toISOString(), scenes: {} };
    const rows = [];
    try {
        const context = await browser.newContext({ viewport: VIEWPORT, locale: LOCALE });
        await context.addInitScript(() => {
            try {
                window.localStorage.setItem('smalruby:welcomeTooltipDismissed', 'true');
            } catch (e) {
                // 吹き出しは CSS でも隠すので、localStorage が使えなくてもよい
            }
        });
        const page = await context.newPage();
        page.on('dialog', (d) => d.dismiss().catch(() => {}));
        await openGui(page);

        // 見本は上流の値が見える条件でだけ撮る (docs の画像を別の条件で上書きしない)。
        if (DOCS_SHOTS) {
            if (VIEWPORT.width !== DOCS_VIEWPORT.width || VIEWPORT.height !== DOCS_VIEWPORT.height) {
                throw new Error(`DOCS_SHOTS=1 は ${DOCS_VIEWPORT.width}x${DOCS_VIEWPORT.height} のときだけ (いまは ${VW}x${VH})`);
            }
            const height = await readMenuBarHeight(page);
            if (height !== UPSTREAM_MENU_BAR_HEIGHT) {
                throw new Error(`DOCS_SHOTS=1 はメニューバーが ${UPSTREAM_MENU_BAR_HEIGHT} のときだけ (いまは ${height})`);
            }
        }

        const colours = await readBlockColours(page);
        writeFileSync(resolve(OUT_DIR, 'block-colours.json'), `${JSON.stringify(colours, null, 2)}\n`);

        for (const scene of scenes) {
            const num = String(SCENES.indexOf(scene) + 1).padStart(2, '0');
            const file = `${num}-${scene.id}.png`;
            const row = { id: scene.id, title: scene.title, file, parts: 0, missing: [], optionalMissing: [], error: null };
            const data = { title: scene.title, screenshot: file, parts: {} };
            const errorShot = resolve(OUT_DIR, `${num}-${scene.id}-error.png`);
            rmSync(errorShot, { force: true }); // 前の実行で失敗したときの画像を残さない
            try {
                if (scene.setup) await scene.setup(page);
                if (scene.waitFor) await page.waitForSelector(scene.waitFor, { timeout: 15000 });
                await page.waitForTimeout(800);

                for (const part of scene.parts) {
                    if (part.blurFirst) {
                        await page.evaluate(() => document.activeElement && document.activeElement.blur());
                        await page.waitForTimeout(HOVER_SETTLE_MS);
                    }
                    const style = await readStyle(page, part.selector, part.pseudo);
                    if (!style) {
                        (part.optional ? row.optionalMissing : row.missing).push(part.name);
                        data.parts[part.name] = { selector: part.selector, found: false, optional: Boolean(part.optional) };
                        continue;
                    }
                    const entry = { selector: part.selector, found: true, style };
                    if (part.hover) await measureHover(page, scene, part, style, entry);
                    if (part.focus || part.focusSelector) await measureFocus(page, part, style, entry);
                    if (part.active) await measureActive(page, part, style, entry);
                    data.parts[part.name] = entry;
                    row.parts++;
                }

                if (scene.parts.some((p) => p.hover)) await page.waitForTimeout(SHOT_SETTLE_MS);
                const path = resolve(OUT_DIR, file);
                if (scene.shot) {
                    const target = page.locator(scene.shot).first();
                    // 切り抜く部品が無いのに画面全体を撮ると、見本を別の画像で上書きしてしまう。
                    if ((await target.count()) === 0) throw new Error(`切り抜く部品が見つからない: ${scene.shot}`);
                    await target.screenshot({ path });
                } else {
                    await page.screenshot({ path });
                }
                if (row.missing.length) throw new Error(`必須の部品が見つからない: ${row.missing.join(', ')}`);
                if (DOCS_SHOTS && DOC_SHOT_NAMES[scene.id]) {
                    copyFileSync(path, resolve(DOCS_DIR, DOC_SHOT_NAMES[scene.id]));
                }
                for (const crop of scene.crops || []) {
                    const target = page.locator(crop.selector).first();
                    if ((await target.count()) === 0) throw new Error(`切り抜く部品が見つからない: ${crop.name}`);
                    const cropFile = `${num}-${scene.id}-${crop.name}.png`;
                    const cropPath = resolve(OUT_DIR, cropFile);
                    if (crop.hover) {
                        await target.hover();
                        await page.waitForTimeout(HOVER_SETTLE_MS);
                    }
                    if (crop.first) {
                        // 先頭 N 個の部品を囲む四角を撮る (まわりを 4px あける。右は padRight)
                        const clip = await page.evaluate(
                            ({ selector, n, padRight }) => {
                                const rects = [...document.querySelectorAll(selector)]
                                    .slice(0, n)
                                    .map((e) => e.getBoundingClientRect());
                                const x = Math.max(0, Math.min(...rects.map((r) => r.left)) - 4);
                                const y = Math.max(0, Math.min(...rects.map((r) => r.top)) - 4);
                                const right = Math.max(...rects.map((r) => r.right)) + padRight;
                                const bottom = Math.max(...rects.map((r) => r.bottom)) + 4;
                                return { x, y, width: right - x, height: bottom - y };
                            },
                            { selector: crop.selector, n: crop.first, padRight: crop.padRight ?? 4 },
                        );
                        await page.screenshot({ path: cropPath, clip });
                    } else {
                        await target.screenshot({ path: cropPath });
                    }
                    if (crop.hover) await releaseMouse(page);
                    data.crops = { ...data.crops, [crop.name]: cropFile };
                    const docName = DOC_SHOT_NAMES[`${scene.id}/${crop.name}`];
                    if (DOCS_SHOTS && docName) copyFileSync(cropPath, resolve(DOCS_DIR, docName));
                }
            } catch (e) {
                row.error = e.message.split('\n')[0];
                data.error = row.error;
                await page.screenshot({ path: errorShot }).catch(() => {});
            }
            results.scenes[scene.id] = data;
            rows.push(row);

            // 次の画面のために元に戻す。閉じ方の決まっていない画面はページを開き直す。
            // 戻せなかったらその画面の失敗にして、ページを開き直してから次へ進む。
            try {
                if (scene.close) await scene.close(page);
                else if (scene.setup) await openGui(page);
            } catch (e) {
                const msg = `元に戻せない: ${e.message.split('\n')[0]}`;
                row.error = row.error ? `${row.error} / ${msg}` : msg;
                data.error = row.error;
                await openGui(page);
            }
        }

        // メニューバーが上流の高さ (3rem = 48px) か。違えばスモウルビーの「低い画面での圧縮」が効いている。
        const bar = results.scenes['menu-bar']?.parts?.['menu-bar']?.style;
        if (bar && bar.height !== '48px') {
            console.warn(`注意: メニューバーの高さが ${bar.height} (上流は 48px)。VIEWPORT の高さを上げる`);
        }
    } finally {
        await browser.close();
        // 途中で止まっても、そこまでに取れた値は残す。
        writeFileSync(resolve(OUT_DIR, 'styles.json'), `${JSON.stringify(results, null, 2)}\n`);
    }

    console.log(`\n撮影: ${BASE} ${VIEWPORT.width}x${VIEWPORT.height} → ${OUT_DIR}`);
    for (const r of rows) {
        const mark = r.error ? 'NG' : 'OK';
        const optional = r.optionalMissing.length ? ` (無くてよい部品で無かったもの: ${r.optionalMissing.join(', ')})` : '';
        console.log(`${mark} ${r.file}\t${r.title}\t部品 ${r.parts}${optional}${r.error ? `\n   ${r.error}` : ''}`);
    }
    const failed = rows.filter((r) => r.error);
    const missingRequired = rows.reduce((n, r) => n + r.missing.length, 0);
    const missingOptional = rows.reduce((n, r) => n + r.optionalMissing.length, 0);
    console.log(`\n${rows.length - failed.length}/${rows.length} 画面を撮れた`);
    console.log(`見つからない部品: 必須 ${missingRequired} / 無くてよい ${missingOptional}`);
    return failed.length ? 1 : 0;
};

main()
    .then((code) => process.exit(code))
    .catch((e) => {
        console.error(e);
        process.exit(1);
    });
