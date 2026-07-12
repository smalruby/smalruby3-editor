#!/usr/bin/env node
/**
 * Playwright MCP launcher — committed, works both inside devpod and on the host.
 *
 * なぜ薄いラッパーが要るか（Issue #999）:
 *   `.mcp.json` から素の `npx -y @playwright/mcp@latest` を起動すると、その版が
 *   バンドルする playwright-core が要求する **新しい chromium リビジョンを起動時に
 *   ダウンロード**しようとする。devpod コンテナは egress allowlist で
 *   `cdn.playwright.dev` を遮断しているためダウンロードに失敗し、ブラウザが起動しない
 *   （headful 既定なので display 不足でも失敗する）。
 *
 *   そこで、リポジトリの `playwright`（root node_modules）が **イメージビルド時に
 *   既に導入済みの chromium** の実行ファイルパスを解決し、`--executable-path` で
 *   その既存 chromium を headless 起動する。これで:
 *     - devpod 内: 追加ダウンロード不要（ビルド時導入分を使う）→ 動く
 *     - ホスト:    同じ解決で host の chromium を使う（無ければ host は egress 制限が
 *                  無いので通常どおり取得できる）→ 動く
 *   単一の committable 設定で両環境が動作する。
 *
 * ホストで headful に見たい場合は committed 設定を変えず local-scope の HTTP MCP で
 * opt-in する（`tools/host-playwright-mcp.sh` と `.devcontainer/README.md` の
 * 「ホストで headful に見たい場合」参照）。
 *
 * `.mcp.json` からは `command: "node", args: ["tools/mcp/playwright-mcp.mjs"]` で呼ぶ。
 * stdio transport はこのプロセスの stdin/stdout を子 (`npx` → MCP) にそのまま
 * 引き継ぐ（`stdio: 'inherit'`）ため、JSON-RPC バイト列はラッパーの JS を経由しない。
 */

import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';

const DEFAULT_MCP_SPEC = '@playwright/mcp@latest';

/**
 * npx に渡す引数配列を組み立てる（純粋関数）。
 * @param {object} opts - オプション
 * @param {?string} opts.chromiumPath - 使う chromium 実行ファイルパス（null なら付けない）
 * @param {string[]} [opts.extraArgs] - 末尾へ透過する追加引数
 * @param {string} [opts.mcpSpec] - `@playwright/mcp` の npm 指定（既定は latest）
 * @returns {string[]} `npx` に渡す引数配列
 */
export function buildMcpArgs({ chromiumPath, extraArgs = [], mcpSpec = DEFAULT_MCP_SPEC }) {
    const args = ['-y', mcpSpec, '--headless'];
    if (chromiumPath) {
        args.push('--executable-path', chromiumPath);
    }
    args.push(...extraArgs);
    return args;
}

/**
 * リポジトリの playwright が導入済みの chromium 実行ファイルパスを解決する（純粋関数）。
 * 解決できない/未導入なら null を返す（呼び出し側は `--executable-path` を付けず、
 * MCP 既定のダウンロード挙動へフォールバックする）。
 * @param {() => object} loadPlaywright - playwright モジュールを返す関数（テスト用に注入）
 * @returns {?string} chromium 実行ファイルの絶対パス、または null
 */
export function resolveChromiumExecutable(loadPlaywright) {
    try {
        const playwright = loadPlaywright();
        const p = playwright?.chromium?.executablePath?.();
        return typeof p === 'string' && p.length > 0 ? p : null;
    } catch {
        return null;
    }
}

/**
 * このファイルの位置を起点に `playwright` を require で解決する。
 * worktree では root の node_modules が main へ symlink されているため、
 * script 位置（tools/mcp/）から上方向に辿ってリポジトリ root の playwright に届く。
 * @returns {object} playwright モジュール
 */
function loadRepoPlaywright() {
    const require = createRequire(import.meta.url);
    return require('playwright');
}

/**
 * エントリポイント。chromium を解決して MCP を起動し、子プロセスの終了コードで終わる。
 * @returns {void}
 */
function main() {
    const log = (m) => process.stderr.write(`[playwright-mcp] ${m}\n`);
    const chromiumPath = resolveChromiumExecutable(loadRepoPlaywright);
    if (chromiumPath) {
        log(`using repo chromium: ${chromiumPath}`);
    } else {
        log('repo chromium not resolved; falling back to @playwright/mcp default browser');
    }

    const args = buildMcpArgs({ chromiumPath, extraArgs: process.argv.slice(2) });
    // stdio: 'inherit' で stdin/stdout/stderr を子へ透過（JSON-RPC はここを通らない）。
    const child = spawn('npx', args, { stdio: 'inherit' });

    const forward = (sig) => {
        try {
            child.kill(sig);
        } catch {
            /* 子が既に終了している場合は無視 */
        }
    };
    process.on('SIGINT', () => forward('SIGINT'));
    process.on('SIGTERM', () => forward('SIGTERM'));

    child.on('error', (e) => {
        log(`failed to start npx: ${e.message}`);
        process.exit(1);
    });
    child.on('exit', (code, signal) => {
        if (signal) {
            process.kill(process.pid, signal);
            return;
        }
        process.exit(code ?? 0);
    });
}

// テスト（import）時は main を実行しない。直接起動されたときだけ実行する。
if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
    main();
}
