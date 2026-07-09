'use strict';
/**
 * pw-check — autopilot worker 用の headless Playwright ヘルパー。
 *
 * verify / review フェーズの worker（コンテナ内 claude）が、bundled chromium を
 * headless で起動して UI を自分で動作確認するための薄いラッパー。Playwright MCP は
 * host Chrome 依存でコンテナ内では失敗するため使わない（Issue #891）。
 *
 * - ブラウザは常に `playwright` パッケージの bundled chromium・headless 固定。
 * - スクリーンショットは必ず `tmp/` 配下（`.claude/rules/scratch-gui/e2e-test.md` 準拠）。
 * - 自己完結 HTML（autopilot monitor 等）は `--serve-html` で静的 serve して確認できる。
 *
 * このモジュールは純粋関数（parseArgs / parseViewport / defaultScreenshotPath）と
 * 実行関数（run）に分かれる。純粋関数は `node --test` で検証する。
 */

const USAGE = `pw-check — headless Playwright（bundled chromium）で UI を確認する

使い方:
  node tools/autopilot/bin/pw-check <url> [options]
  node tools/autopilot/bin/pw-check --serve-html <file.html> [options]

ブラウザは常に bundled chromium を headless で起動する（Playwright MCP は使わない）。

options:
  --serve-html <file>   自己完結 HTML を一時 HTTP サーバで serve してその URL を開く
                        （dev server 不要のページ用。例: autopilot monitor の HTML）
  --screenshot <path>   スクリーンショット保存先（既定: tmp/pw-check-<slug>.png。tmp/ 配下必須）
  --wait <selector>     この CSS セレクタが現れるまで待つ
  --eval <js>           ページ内で評価する式。結果を JSON で標準出力に出す
  --timeout <ms>        ナビゲーション/待機のタイムアウト（既定 30000）
  --viewport <WxH>      ビューポート（既定 1280x800）
  -h, --help            この使い方を表示

例:
  # 稼働中の daemon monitor（自己完結ページ）を確認
  node tools/autopilot/bin/pw-check http://localhost:8787/ --wait '#board' \\
    --eval 'document.title'

  # scratch-gui のプレビュー URL を確認
  node tools/autopilot/bin/pw-check 'https://smalruby.jp/smalruby3-editor/<branch>/?no_beforeunload=1' \\
    --wait '[class*="gui_editor-wrapper"]' --timeout 90000
`;

const DEFAULT_TIMEOUT = 30000;
const DEFAULT_VIEWPORT = { width: 1280, height: 800 };

/**
 * "WxH" 形式のビューポート指定をパースする。
 * @param {string} s - 例 "1024x768"
 * @returns {{width: number, height: number}} パース結果
 */
function parseViewport(s) {
    const m = /^(\d+)x(\d+)$/.exec(String(s).trim());
    if (!m) throw new Error(`invalid viewport "${s}" (expected WxH, e.g. 1280x800)`);
    return { width: Number(m[1]), height: Number(m[2]) };
}

/**
 * URL またはファイルパスから決定的な（タイムスタンプを含まない）スクショ保存先を作る。
 * @param {string} target - URL または serve するファイルのパス
 * @returns {string} `tmp/pw-check-<slug>.png`
 */
function defaultScreenshotPath(target) {
    let slug = '';
    if (/^https?:\/\//i.test(target)) {
        try {
            const u = new URL(target);
            slug = `${u.hostname}-${u.port || 'x'}${u.pathname}`;
        } catch {
            slug = target;
        }
    } else {
        // ファイルパスは basename（拡張子除去）を使う
        const base = String(target).split('/').pop() || 'page';
        slug = base.replace(/\.[^.]+$/, '');
    }
    slug = slug
        .replace(/[^a-zA-Z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .toLowerCase()
        .slice(0, 60);
    if (!slug) slug = 'page';
    return `tmp/pw-check-${slug}.png`;
}

/**
 * argv をパースする。エラー時は throw せず `{error}` を返す（呼び出し側が USAGE を出す）。
 * @param {string[]} argv - process.argv.slice(2)
 * @returns {object} パース結果（`{url, serveHtml, screenshot, waitSelector, evalJs, timeoutMs, viewport}` または `{error}` / `{help:true}`）
 */
function parseArgs(argv) {
    const o = {
        url: null,
        serveHtml: null,
        screenshot: null,
        waitSelector: null,
        evalJs: null,
        timeoutMs: DEFAULT_TIMEOUT,
        viewport: { ...DEFAULT_VIEWPORT },
    };
    const need = (i, flag) => {
        if (i + 1 >= argv.length) return { error: `${flag} requires a value` };
        return { value: argv[i + 1] };
    };
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i];
        if (a === '-h' || a === '--help') return { help: true };
        if (a === '--serve-html') {
            const r = need(i, '--serve-html');
            if (r.error) return { error: r.error };
            o.serveHtml = r.value;
            i++;
        } else if (a === '--screenshot') {
            const r = need(i, '--screenshot');
            if (r.error) return { error: r.error };
            o.screenshot = r.value;
            i++;
        } else if (a === '--wait') {
            const r = need(i, '--wait');
            if (r.error) return { error: r.error };
            o.waitSelector = r.value;
            i++;
        } else if (a === '--eval') {
            const r = need(i, '--eval');
            if (r.error) return { error: r.error };
            o.evalJs = r.value;
            i++;
        } else if (a === '--timeout') {
            const r = need(i, '--timeout');
            if (r.error) return { error: r.error };
            const n = Number(r.value);
            if (!Number.isFinite(n) || n <= 0) return { error: `--timeout must be a positive number` };
            o.timeoutMs = n;
            i++;
        } else if (a === '--viewport') {
            const r = need(i, '--viewport');
            if (r.error) return { error: r.error };
            try {
                o.viewport = parseViewport(r.value);
            } catch (e) {
                return { error: e.message };
            }
            i++;
        } else if (a.startsWith('-')) {
            return { error: `unknown flag: ${a}` };
        } else if (o.url === null) {
            o.url = a;
        } else {
            return { error: `unexpected extra argument: ${a}` };
        }
    }
    if (!o.url && !o.serveHtml) {
        return { error: 'provide a <url> or --serve-html <file>' };
    }
    // スクショは必ず tmp/ 配下（誤ってリポジトリを汚さない）
    if (!o.screenshot) o.screenshot = defaultScreenshotPath(o.url || o.serveHtml);
    if (!/^tmp\//.test(o.screenshot)) {
        return { error: `--screenshot must be under tmp/ (got "${o.screenshot}")` };
    }
    return o;
}

/**
 * 自己完結 HTML を serve する一時 HTTP サーバを起動する。
 * すべての GET に同じ HTML を text/html で返す（inline CSS/JS の自己完結ページ用）。
 * @param {string} filePath - serve する HTML ファイル
 * @returns {Promise<{url: string, close: function}>} ローカル URL と停止関数
 */
async function serveStaticHtml(filePath) {
    const http = require('http');
    const fs = require('fs');
    const html = fs.readFileSync(filePath, 'utf8');
    const server = http.createServer((req, res) => {
        res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
        res.end(html);
    });
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const { port } = server.address();
    return {
        url: `http://127.0.0.1:${port}/`,
        close: () => new Promise((resolve) => server.close(resolve)),
    };
}

/**
 * headless bundled chromium で URL を開き、待機/評価/スクショを行う。
 * @param {object} opts - parseArgs の戻り値
 * @param {(msg: string) => void} [logFn] - ログ出力先（既定 console.error）
 * @returns {Promise<{ok: boolean, url: string, title: string, screenshot: string, evalResult: *, error?: string}>} 実行結果
 */
async function run(opts, logFn) {
    const log = logFn || ((m) => process.stderr.write(`[pw-check] ${m}\n`));
    const { chromium } = require('playwright');
    const fs = require('fs');
    const path = require('path');

    fs.mkdirSync(path.dirname(opts.screenshot), { recursive: true });

    let server = null;
    let target = opts.url;
    if (opts.serveHtml) {
        server = await serveStaticHtml(opts.serveHtml);
        target = server.url;
        log(`serving ${opts.serveHtml} at ${target}`);
    }

    log('launching bundled chromium (headless)...');
    const browser = await chromium.launch({ headless: true });
    const result = { ok: false, url: target, title: null, screenshot: opts.screenshot, evalResult: undefined };
    try {
        const page = await browser.newPage({ viewport: opts.viewport });
        page.on('pageerror', (e) => log(`[pageerror] ${e.message}`));
        log(`navigating to ${target}`);
        await page.goto(target, { waitUntil: 'domcontentloaded', timeout: opts.timeoutMs });
        if (opts.waitSelector) {
            log(`waiting for selector: ${opts.waitSelector}`);
            await page.waitForSelector(opts.waitSelector, { timeout: opts.timeoutMs });
        }
        result.title = await page.title();
        if (opts.evalJs) {
            log(`evaluating: ${opts.evalJs}`);
            result.evalResult = await page.evaluate(opts.evalJs);
        }
        await page.screenshot({ path: opts.screenshot, fullPage: false });
        log(`screenshot -> ${opts.screenshot}`);
        result.ok = true;
    } catch (e) {
        result.error = e.message;
        log(`ERROR: ${e.message}`);
    } finally {
        await browser.close();
        if (server) await server.close();
    }
    return result;
}

/**
 * CLI エントリ。argv をパースして run を実行し、結果 JSON を標準出力へ出す。
 * @param {string[]} argv - process.argv.slice(2)
 * @returns {Promise<number>} プロセス終了コード（0=成功 / 1=失敗 / 2=引数エラー）
 */
async function main(argv) {
    const opts = parseArgs(argv);
    if (opts.help) {
        process.stdout.write(USAGE);
        return 0;
    }
    if (opts.error) {
        process.stderr.write(`pw-check: ${opts.error}\n\n${USAGE}`);
        return 2;
    }
    const result = await run(opts);
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    return result.ok ? 0 : 1;
}

module.exports = { parseArgs, parseViewport, defaultScreenshotPath, serveStaticHtml, run, main, USAGE };
