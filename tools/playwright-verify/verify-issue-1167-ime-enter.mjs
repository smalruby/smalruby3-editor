// Issue #1167: IME 変換確定の Enter でブロックの入力欄が閉じてしまう問題の回帰確認。
//
// 本物の IME は自動化できないので、`isComposing: true` の合成 KeyboardEvent を
// dispatch して「変換中の Enter」を再現する。ブラウザが本当に IME 変換中に
// 送ってくるイベントもこれと同じ形（key='Enter' / isComposing=true /
// keyCode=229）なので、パッチが効いているかの回帰確認としては十分。
//
// 実機（Chrome + Google 日本語入力 / ことえり）での最終確認は人間が行う。
//
// 使い方:
//   # コンテナ内（既定）— headless:
//   node verify-issue-1167-ime-enter.mjs
//   PORT=8611 node verify-issue-1167-ime-enter.mjs      # 別ポートの dev server
//
//   # ホスト（macOS）— 実 Chrome ウィンドウで目視:
//   HEADLESS=false CHANNEL=chrome SLOWMO=300 node verify-issue-1167-ime-enter.mjs
//
// Env: HEADLESS=false / CHANNEL=chrome / SLOWMO=<ms> / KEEP_OPEN=1 / PORT=<port> / BASE_URL=...
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SHOTS = resolve(__dirname, '.screenshots');
mkdirSync(SHOTS, { recursive: true });

const PORT = process.env.PORT || '8601';
const BASE_URL = process.env.BASE_URL || `http://localhost:${PORT}`;
const URL = `${BASE_URL}/?no_beforeunload=1`;
const log = (...a) => console.log('[ime]', ...a);
const fail = (m) => {
    console.error('[FAIL]', m);
    process.exitCode = 1;
};
const check = (n, ok, m) => {
    log(`${n} ${m} =`, ok ? 'OK' : 'FAIL');
    if (!ok) fail(m);
};

const launchOpts = { headless: process.env.HEADLESS !== 'false' };
if (process.env.CHANNEL) launchOpts.channel = process.env.CHANNEL;
if (process.env.SLOWMO) launchOpts.slowMo = Number(process.env.SLOWMO);
const browser = await chromium.launch(launchOpts);
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

await page.goto(URL);
await page.waitForSelector('.blocklyWorkspace', { timeout: 60000 });
await page.waitForFunction(() => window.vm || (window.smalruby && window.smalruby.vm), { timeout: 60000 });

// 1. ワークスペースに「( ) と ( ) 秒言う」を置く（VM 経由 → workspace update）。
await page.evaluate(() => {
    const vm = window.vm || window.smalruby.vm;
    const target = vm.editingTarget;
    target.blocks.createBlock({
        id: 'ime-say-block',
        opcode: 'looks_sayforsecs',
        inputs: {
            MESSAGE: { name: 'MESSAGE', block: 'ime-say-text', shadow: 'ime-say-text' },
            SECS: { name: 'SECS', block: 'ime-say-secs', shadow: 'ime-say-secs' },
        },
        fields: {},
        next: null,
        topLevel: true,
        parent: null,
        shadow: false,
        x: 60,
        y: 60,
    });
    target.blocks.createBlock({
        id: 'ime-say-text',
        opcode: 'text',
        inputs: {},
        fields: { TEXT: { name: 'TEXT', value: 'Hello!' } },
        next: null,
        topLevel: false,
        parent: 'ime-say-block',
        shadow: true,
    });
    target.blocks.createBlock({
        id: 'ime-say-secs',
        opcode: 'math_number',
        inputs: {},
        fields: { NUM: { name: 'NUM', value: '2' } },
        next: null,
        topLevel: false,
        parent: 'ime-say-block',
        shadow: true,
    });
    vm.emitWorkspaceUpdate();
});
await page.waitForTimeout(1500);

// 2. 文字入力欄（TEXT フィールド）をクリックしてエディタを開く。
// パレット（フライアウト）にも同じ "Hello!" があるので、そちらは除外する。
const fieldHandle = await page.evaluateHandle(() =>
    Array.from(document.querySelectorAll('text')).find(
        (t) => t.textContent === 'Hello!' && !t.closest('.blocklyFlyout'),
    ),
);
const field = fieldHandle.asElement();
if (!field) throw new Error('ワークスペースに置いた say ブロックの文字フィールドが見つからない');
await field.click({ timeout: 15000 });
await page.waitForSelector('.blocklyHtmlInput', { timeout: 10000 });
check('1', true, 'フィールドエディタが開く');

// 3. IME 変換中の Enter → エディタは閉じない（これが本件の修正点）。
const dispatchEnter = (isComposing) =>
    page.evaluate((composing) => {
        const input = document.querySelector('.blocklyHtmlInput');
        if (!input) return false;
        input.dispatchEvent(
            new KeyboardEvent('keydown', {
                key: 'Enter',
                keyCode: composing ? 229 : 13,
                isComposing: composing,
                bubbles: true,
                cancelable: true,
            }),
        );
        return true;
    }, isComposing);

await dispatchEnter(true);
await page.waitForTimeout(300);
const survives = await page.locator('.blocklyHtmlInput').count();
check('2', survives === 1, 'IME 変換中の Enter でエディタが閉じない');
await page.screenshot({ path: resolve(SHOTS, 'issue-1167-editor-open-after-composing-enter.png') });

// 4. IME 変換中の Escape も閉じない（変換の取り消しに使われるため）。
await page.evaluate(() => {
    document.querySelector('.blocklyHtmlInput')?.dispatchEvent(
        new KeyboardEvent('keydown', {
            key: 'Escape',
            keyCode: 229,
            isComposing: true,
            bubbles: true,
            cancelable: true,
        }),
    );
});
await page.waitForTimeout(300);
check('3', (await page.locator('.blocklyHtmlInput').count()) === 1, 'IME 変換中の Escape でエディタが閉じない');

// 5. 変換していない Enter は従来どおり閉じる（過剰なガードになっていないこと）。
await dispatchEnter(false);
await page.waitForTimeout(500);
check('4', (await page.locator('.blocklyHtmlInput').count()) === 0, '通常の Enter ではエディタが閉じる');

if (!process.exitCode) log('ALL OK');
if (!process.env.KEEP_OPEN) await browser.close();
