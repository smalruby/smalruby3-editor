'use strict';
/**
 * usage.js — worker（claude セッション）の transcript JSONL から
 * Claude の使用率（rate_limits）を抽出する純粋関数群。
 *
 * データソース: Pro/Max サブスクのセッションでは、初回 API 応答以降の transcript に
 * `rate_limits`（five_hour = 直近5時間 / seven_day = 週間）が含まれる。API キー利用時や
 * 初回応答前は存在しない → その場合は null を返し、UI 側で「—」表示にする。
 *
 * Issue #879。CLI サブコマンドや専用キャッシュファイルは存在しないため、transcript JSONL
 * からの抽出が唯一の手段（claude-code-guide 調査確定）。
 */

const fs = require('fs');
const os = require('os');
const path = require('path');

/**
 * cwd を Claude Code の transcript プロジェクトディレクトリ名（slug）に変換する。
 * Claude Code は英数字以外を '-' に置換する
 * （例: /app/.autopilot-worktrees/issue-879 → -app--autopilot-worktrees-issue-879）。
 * @param {string} cwd 絶対パス
 * @returns {string} slug
 */
function transcriptSlug(cwd) {
    return String(cwd).replace(/[^a-zA-Z0-9]/g, '-');
}

/**
 * cwd に対応する transcript ディレクトリの絶対パス。
 * @param {string} cwd
 * @param {string} [home] ホームディレクトリ（既定 os.homedir()）
 * @returns {string}
 */
function transcriptDir(cwd, home = os.homedir()) {
    return path.join(home, '.claude', 'projects', transcriptSlug(cwd));
}

/**
 * 任意のオブジェクトから rate_limits（five_hour か seven_day を持つもの）を再帰的に探す。
 * transcript の行構造は将来変わりうるため、キー位置に依存せず走査する。
 * @param {*} obj
 * @returns {object|null} rate_limits オブジェクト、無ければ null
 */
function findRateLimits(obj) {
    if (!obj || typeof obj !== 'object') return null;
    const rl = obj.rate_limits;
    if (rl && typeof rl === 'object' && (rl.five_hour || rl.seven_day)) return rl;
    for (const v of Object.values(obj)) {
        if (v && typeof v === 'object') {
            const found = findRateLimits(v);
            if (found) return found;
        }
    }
    return null;
}

/**
 * rate_limits の 1 ウィンドウ（five_hour / seven_day）を {percent, resetsAt} に正規化する。
 * used_percentage が数値でなければ null。
 * @param {object} w
 * @returns {{percent:number, resetsAt:(number|null)}|null}
 */
function toWindow(w) {
    if (!w || typeof w !== 'object') return null;
    const percent = typeof w.used_percentage === 'number' ? w.used_percentage : null;
    if (percent == null || Number.isNaN(percent)) return null;
    const resetsAt = typeof w.resets_at === 'number' ? w.resets_at : null;
    return { percent, resetsAt };
}

/**
 * JSONL テキスト（transcript）または単一の status-line JSON から、最新の使用率を抽出する。
 * 複数行に rate_limits があれば後勝ち（最新行）で採用する。
 * @param {string} text
 * @returns {{session:(object|null), weekly:(object|null)}|null}
 */
function parseClaudeUsage(text) {
    if (!text) return null;
    let latest = null;
    for (const line of String(text).split('\n')) {
        const s = line.trim();
        if (!s || s[0] !== '{') continue;
        let obj;
        try { obj = JSON.parse(s); } catch { continue; }
        const rl = findRateLimits(obj);
        if (rl) latest = rl;
    }
    if (!latest) return null;
    const session = toWindow(latest.five_hour);
    const weekly = toWindow(latest.seven_day);
    if (!session && !weekly) return null;
    return { session, weekly };
}

/**
 * worker の cwd に対応する transcript から最新の Claude 使用量を読む。
 * transcript ディレクトリ内の *.jsonl を更新時刻の新しい順に読み、最初に使用率が
 * 取れたものを返す。取れなければ null（非サブスク / 初回応答前 / transcript 未生成）。
 * @param {string} cwd worker の作業ディレクトリ
 * @param {object} [opts]
 * @param {string} [opts.home] ホームディレクトリ
 * @param {function} [opts.now] 現在時刻（ms）を返す関数（テスト用）
 * @returns {{session, weekly, updatedAt:number}|null}
 */
function readClaudeUsage(cwd, { home = os.homedir(), now = Date.now } = {}) {
    const dir = transcriptDir(cwd, home);
    let entries;
    try {
        entries = fs.readdirSync(dir).filter((f) => f.endsWith('.jsonl'));
    } catch {
        return null;
    }
    if (!entries.length) return null;
    const byMtime = entries.map((f) => {
        const full = path.join(dir, f);
        let mtimeMs = 0;
        try { mtimeMs = fs.statSync(full).mtimeMs; } catch { /* noop */ }
        return { full, mtimeMs };
    }).sort((a, b) => b.mtimeMs - a.mtimeMs);
    for (const { full } of byMtime) {
        let text;
        try { text = fs.readFileSync(full, 'utf8'); } catch { continue; }
        const usage = parseClaudeUsage(text);
        if (usage) return { ...usage, updatedAt: now() };
    }
    return null;
}

module.exports = { transcriptSlug, transcriptDir, findRateLimits, toWindow, parseClaudeUsage, readClaudeUsage };
