'use strict';
/**
 * version.js — 稼働中 autopilot の git バージョン表示 + `tools/autopilot/` 更新検知（Issue #885）。
 *
 * daemon はモジュールを**起動時にロード**するので「動いているコード = 起動時のコミット」。
 * 起動時に動作中 checkout（`project.REPO_ROOT`）の git 情報を取得して保持し、以降 ~15 分ごとに
 * 既定ブランチ（`origin/develop`）を fetch して、起動時コミット以降に `tools/autopilot/` を
 * 変更するコミットがあるか（= 更新あり）を判定する。
 *
 * I/O は execFile（daemon の非同期 I/O に合わせる）。git コマンドは deps.execFileP で差し替え可能
 * にし、更新あり/なし/失敗をユニットテストできるようにする。fetch は remote-tracking ref のみ更新し
 * working tree は触らない。private repo なので fetch の認証は既存の gh credential helper に委ねる。
 */

const { execFile } = require('child_process');
const { promisify } = require('util');

const execFileP = promisify(execFile);

/** git log の 1 行区切り（unit separator）。件名にタブ/空白が含まれても壊れないように使う */
const SEP = '\x1f';

/**
 * git log の出力（`%h<SEP>%s` を 1 コミット 1 行）をコミット配列にパースする（純粋関数）。
 * @param {string} stdout
 * @returns {Array<{shortCommit: string, subject: string}>} 新しい順（git log の既定）
 */
function parseCommitLog(stdout) {
    if (!stdout) return [];
    const commits = [];
    for (const line of String(stdout).split('\n')) {
        const s = line.trim();
        if (!s) continue;
        const idx = s.indexOf(SEP);
        if (idx === -1) {
            commits.push({ shortCommit: s, subject: '' });
        } else {
            commits.push({ shortCommit: s.slice(0, idx), subject: s.slice(idx + 1) });
        }
    }
    return commits;
}

/**
 * 動作中 checkout の git バージョン（ブランチ + コミット）を取得する。
 * 取得できなければ全フィールド null（表示側で「—」）。
 * @param {string} repoRoot 動作中 checkout のパス（= project.REPO_ROOT）
 * @param {object} [deps] { execFileP }（テスト用）
 * @returns {Promise<{branch: (string|null), commit: (string|null), shortCommit: (string|null)}>}
 */
async function readVersion(repoRoot, deps = {}) {
    const run = deps.execFileP || execFileP;
    const git = async (args) => {
        const { stdout } = await run('git', ['-C', repoRoot, ...args], { encoding: 'utf8' });
        return stdout.trim();
    };
    try {
        const [branch, commit, shortCommit] = await Promise.all([
            git(['rev-parse', '--abbrev-ref', 'HEAD']),
            git(['rev-parse', 'HEAD']),
            git(['rev-parse', '--short', 'HEAD']),
        ]);
        return { branch, commit, shortCommit };
    } catch {
        return { branch: null, commit: null, shortCommit: null };
    }
}

/**
 * 既定ブランチを fetch し、起動時コミット以降に `subdir`（既定 `tools/autopilot`）を変更する
 * コミットがあるか判定する。常にオブジェクトを返す（失敗時は error を載せる）。
 * @param {object} args
 * @param {string} args.repoRoot 動作中 checkout のパス
 * @param {string} args.baseBranch 既定ブランチ（例 `develop`）
 * @param {string} args.bootCommit 起動時コミット（full SHA 推奨）
 * @param {string} [args.subdir] 監視対象ディレクトリ（既定 `tools/autopilot`）
 * @param {string} [args.remote] リモート名（既定 `origin`）
 * @param {function} [args.now] 現在時刻（ms）（テスト用）
 * @param {object} [deps] { execFileP }（テスト用）
 * @returns {Promise<{available: boolean, behind: number, commits: Array, checkedAt: number, error: (string|null)}>}
 */
async function checkAutopilotUpdate(args, deps = {}) {
    const {
        repoRoot, baseBranch, bootCommit, subdir = 'tools/autopilot', remote = 'origin', now = Date.now,
    } = args;
    const run = deps.execFileP || execFileP;
    const git = (a) => run('git', ['-C', repoRoot, ...a], { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
    if (!bootCommit) {
        return { available: false, behind: 0, commits: [], checkedAt: now(), error: 'no boot commit' };
    }
    try {
        // remote-tracking ref のみ更新（working tree は触らない）。認証は gh credential helper に委ねる。
        await git(['fetch', remote, baseBranch]);
        const range = `${bootCommit}..${remote}/${baseBranch}`;
        const { stdout } = await git(['log', `--format=%h${SEP}%s`, range, '--', subdir]);
        const commits = parseCommitLog(stdout);
        return { available: commits.length > 0, behind: commits.length, commits, checkedAt: now(), error: null };
    } catch (e) {
        return { available: false, behind: 0, commits: [], checkedAt: now(), error: e.message || String(e) };
    }
}

module.exports = { parseCommitLog, readVersion, checkAutopilotUpdate };
