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
 *   tmp/design-system/styles.json              画面 → 部品 → スタイル (と hover) の値
 *   tmp/design-system/block-colours.json       `--colour-*` の値
 * 1 つでも開けなかった画面があれば exit 1。
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
    'border-radius',
    'box-shadow',
    'font-family',
    'font-size',
    'font-weight',
    'line-height',
    'padding',
    'margin',
    'width',
    'height',
    'opacity',
    'transition',
    'z-index',
];

// CSS Modules の名前 (`<ファイル>_<クラス>_<ハッシュ>`) から部品を選ぶ。
const cls = (file, name) => `[class*="${file}_${name}_"]`;

// docs/design-system/screenshots に置く見本 (少数だけ)。画面 id → ファイル名。
// ファイル名は撮り直しても変えない (docs/_screenshot-guidelines.md)。
const DOC_SHOT_NAMES = {
    'menu-bar': '0101-menu-bar.png',
    'code-tab': '0201-code-tab-1366x1024.png',
    'variable-prompt': '0401-variable-prompt.png',
    'delete-sprite-confirm': '0402-delete-sprite-confirm.png',
};

// ---- 画面を開く手順の部品 ----

const dispatch = (page, action) => page.evaluate((a) => window.__store.dispatch(a), action);
const openModal = (page, modal) => dispatch(page, { type: 'scratch-gui/modals/OPEN_MODAL', modal });
const activateTab = (page, tab) => dispatch(page, { type: 'scratch-gui/navigation/ACTIVATE_TAB', activeTabIndex: tab });

// コードタブに戻したあと Blockly の文字が乱れるのを避ける (e2e-test.md の「文字化け回避」)。
const backToCodeTab = async (page) => {
    await activateTab(page, 0);
    await page.waitForTimeout(500);
    await page.evaluate(() => window.dispatchEvent(new Event('resize')));
    await page.waitForTimeout(500);
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

// ライブラリ (拡張機能・スプライト・背景・コスチューム・音・チュートリアル) に共通の部品。
// 拡張機能とチュートリアルには絞り込みが無いので、filter と tag は見つからなくてよい。
const libraryParts = [
    { name: 'modal-header', selector: cls('modal', 'header') },
    { name: 'back-button', selector: cls('modal', 'back-button'), hover: true },
    { name: 'filter-input', selector: cls('filter', 'filter-input') },
    { name: 'tag-button', selector: cls('tag-button', 'tag-button') },
    { name: 'tag-button-active', selector: `${cls('tag-button', 'tag-button')}${cls('tag-button', 'active')}` },
    { name: 'library-item', selector: LIBRARY_ITEM, hover: true },
    { name: 'library-item-name', selector: cls('library-item', 'library-item-name') },
];

/**
 * 撮る画面の一覧。上流 (Scratch) 由来の画面だけ (EPIC #1809 の「対象」)。
 * - setup: 画面を開く手順
 * - shot: 切り抜く部品 (無ければ画面全体)
 * - parts: スタイルを読む部品 (hover: true でホバーしたときの値も読む)
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
            { name: 'project-title-input', selector: cls('project-title-input', 'title-field') },
        ],
    },
    {
        id: 'menu-file',
        title: 'ファイルのメニュー',
        setup: async (page) => {
            await page.locator(`${cls('menu-bar', 'file-group')} ${cls('menu-bar', 'menu-bar-item')}`, { hasText: 'ファイル' }).first().click();
            await page.waitForSelector(cls('menu', 'menu'));
        },
        shot: cls('menu', 'menu'),
        parts: [
            { name: 'menu', selector: cls('menu', 'menu') },
            { name: 'menu-item', selector: `${cls('menu', 'menu')} ${cls('menu', 'menu-item')}`, hover: true },
            { name: 'menu-section', selector: cls('menu', 'menu-section') },
        ],
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
            { name: 'sprite-info', selector: cls('sprite-info', 'sprite-info') },
            { name: 'sprite-info-input', selector: cls('sprite-info', 'sprite-input') },
            { name: 'sprite-selector', selector: cls('sprite-selector', 'sprite-selector') },
            { name: 'sprite-selector-item-selected', selector: cls('sprite-selector-item', 'is-selected') },
            { name: 'stage-selector', selector: cls('stage-selector', 'stage-selector') },
            { name: 'action-menu-button', selector: cls('action-menu', 'main-button'), hover: true },
            { name: 'extension-button', selector: cls('extension-button', 'extension-button') },
        ],
    },
    {
        id: 'costumes-tab',
        title: 'コスチュームタブ (ペイントエディター)',
        setup: (page) => activateTab(page, 1),
        waitFor: cls('paint-editor', 'editor-container'),
        parts: [
            { name: 'asset-selector-item-selected', selector: cls('sprite-selector-item', 'is-selected') },
            { name: 'paint-editor', selector: cls('paint-editor', 'editor-container') },
            { name: 'mode-tool-button', selector: cls('tool-select-base', 'mod-tool-select') },
            { name: 'mode-tool-button-selected', selector: cls('tool-select-base', 'is-selected') },
            { name: 'input', selector: `${cls('paint-editor', 'editor-container')} input` },
            { name: 'canvas-container', selector: cls('paint-editor', 'canvas-container') },
        ],
        close: backToCodeTab,
    },
    {
        id: 'sounds-tab',
        title: '音タブ (音のエディター)',
        setup: (page) => activateTab(page, 2),
        waitFor: cls('sound-editor', 'editor-container'),
        parts: [
            { name: 'sound-editor', selector: cls('sound-editor', 'editor-container') },
            { name: 'round-button', selector: cls('sound-editor', 'round-button') },
            { name: 'effect-button', selector: cls('icon-button', 'container'), hover: true },
            { name: 'waveform-container', selector: cls('sound-editor', 'waveform-container') },
            { name: 'waveform-path', selector: `${cls('waveform', 'container')} path` },
        ],
        close: backToCodeTab,
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
            ...libraryParts,
        ],
    },
    {
        id: 'sprite-library',
        title: 'スプライトを選ぶ',
        setup: (page) => openModal(page, 'spriteLibrary'),
        waitFor: LIBRARY_ITEM,
        parts: libraryParts,
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
            { name: 'confirm-button', selector: cls('confirmation-prompt', 'confirm-button'), hover: true },
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
            { name: 'modal-header', selector: cls('modal', 'header') },
            { name: 'body', selector: cls('prompt', 'body') },
            { name: 'label', selector: cls('prompt', 'label') },
            { name: 'variable-name-input', selector: cls('prompt', 'variable-name-text-input') },
            { name: 'option-radio-label', selector: cls('prompt', 'options-row') },
            { name: 'ok-button', selector: cls('prompt', 'ok-button'), hover: true },
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
];

// ---- 読み取り ----

const readStyle = (page, selector) =>
    page.evaluate(
        ({ selector, props }) => {
            const el = document.querySelector(selector);
            if (!el) return null;
            const cs = getComputedStyle(el);
            const out = {};
            for (const p of props) out[p] = cs.getPropertyValue(p);
            const r = el.getBoundingClientRect();
            out['@rect'] = { width: Math.round(r.width), height: Math.round(r.height) };
            return out;
        },
        { selector, props: PROPS },
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

    const browser = await chromium.launch({ headless: HEADLESS, channel: CHANNEL });
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

        const colours = await readBlockColours(page);
        writeFileSync(resolve(OUT_DIR, 'block-colours.json'), `${JSON.stringify(colours, null, 2)}\n`);

        for (const scene of scenes) {
            const num = String(SCENES.indexOf(scene) + 1).padStart(2, '0');
            const file = `${num}-${scene.id}.png`;
            const row = { id: scene.id, title: scene.title, file, parts: 0, missing: [], error: null };
            const data = { title: scene.title, screenshot: file, parts: {} };
            const errorShot = resolve(OUT_DIR, `${num}-${scene.id}-error.png`);
            rmSync(errorShot, { force: true }); // 前の実行で失敗したときの画像を残さない
            try {
                if (scene.setup) await scene.setup(page);
                if (scene.waitFor) await page.waitForSelector(scene.waitFor, { timeout: 15000 });
                await page.waitForTimeout(800);

                for (const part of scene.parts) {
                    const style = await readStyle(page, part.selector);
                    if (!style) {
                        row.missing.push(part.name);
                        data.parts[part.name] = { selector: part.selector, found: false };
                        continue;
                    }
                    const entry = { selector: part.selector, found: true, style };
                    if (part.hover) {
                        try {
                            await page.locator(part.selector).first().hover({ timeout: 3000 });
                            await page.waitForTimeout(400); // transition が終わるのを待つ
                            entry.hover = diff(style, await readStyle(page, part.selector));
                        } catch (e) {
                            entry.hover = { error: e.message.split('\n')[0] };
                        }
                        await page.mouse.move(VIEWPORT.width - 2, VIEWPORT.height - 2);
                        await page.waitForTimeout(300);
                    }
                    data.parts[part.name] = entry;
                    row.parts++;
                }

                const path = resolve(OUT_DIR, file);
                const target = scene.shot ? page.locator(scene.shot).first() : null;
                if (target && (await target.count())) await target.screenshot({ path });
                else await page.screenshot({ path });
                if (DOCS_SHOTS && DOC_SHOT_NAMES[scene.id]) {
                    copyFileSync(path, resolve(DOCS_DIR, DOC_SHOT_NAMES[scene.id]));
                }
            } catch (e) {
                row.error = e.message.split('\n')[0];
                data.error = row.error;
                await page.screenshot({ path: errorShot }).catch(() => {});
            }
            results.scenes[scene.id] = data;
            rows.push(row);

            // 次の画面のために元に戻す。閉じ方の決まっていない画面はページを開き直す。
            if (scene.close) await scene.close(page);
            else if (scene.setup) await openGui(page);
        }

        // メニューバーが上流の高さ (3rem = 48px) か。違えばスモウルビーの「低い画面での圧縮」が効いている。
        const bar = results.scenes['menu-bar']?.parts?.['menu-bar']?.style;
        if (bar && bar.height !== '48px') {
            console.warn(`注意: メニューバーの高さが ${bar.height} (上流は 48px)。VIEWPORT の高さを上げる`);
        }
    } finally {
        await browser.close();
    }

    writeFileSync(resolve(OUT_DIR, 'styles.json'), `${JSON.stringify(results, null, 2)}\n`);

    console.log(`\n撮影: ${BASE} ${VIEWPORT.width}x${VIEWPORT.height} → ${OUT_DIR}`);
    for (const r of rows) {
        const mark = r.error ? 'NG' : 'OK';
        const missing = r.missing.length ? ` (見つからない部品: ${r.missing.join(', ')})` : '';
        console.log(`${mark} ${r.file}\t${r.title}\t部品 ${r.parts}${missing}${r.error ? `\n   ${r.error}` : ''}`);
    }
    const failed = rows.filter((r) => r.error);
    console.log(`\n${rows.length - failed.length}/${rows.length} 画面を撮れた`);
    return failed.length ? 1 : 0;
};

main()
    .then((code) => process.exit(code))
    .catch((e) => {
        console.error(e);
        process.exit(1);
    });
