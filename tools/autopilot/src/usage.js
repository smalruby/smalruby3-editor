'use strict';
/**
 * usage.js — worker（claude セッション）の status line が書き出したファイルから
 * Claude の使用率（rate_limits）を読み取る純粋関数群（Issue #879）。
 *
 * データソース: rate_limits（five_hour=直近5時間 / seven_day=週間）は **status line の
 * stdin JSON にのみ**含まれる（Pro/Max サブスクのセッションで初回 API 応答以降）。
 * transcript JSONL・CLI サブコマンド・キャッシュファイルには出力されない（実測確定）。
 * そこで worker の status line に `tools/autopilot/bin/usage-statusline.sh` を仕込み、
 * rate_limits を JSON ファイルへ書き出させ、daemon が本モジュールでそれを読む。
 * 非サブスク / 初回応答前 / 未生成のときは null（UI 側で「—」表示）。
 */

const fs = require('fs');

/**
 * 任意のオブジェクトから rate_limits（five_hour か seven_day を持つもの）を再帰的に探す。
 * 書き出し形式が将来変わってもキー位置に依存しないよう走査する。
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
 * usage ファイルのテキスト（1 行 JSON、または複数行 JSONL）から最新の使用率を抽出する。
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
 * status line が書き出した usage ファイルから最新の Claude 使用量を読む。
 * ファイルが無い / rate_limits が取れなければ null（非サブスク / 初回応答前 / 未生成）。
 * @param {string} file usage ファイルの絶対パス（usage-statusline.sh の書き出し先と一致させる）
 * @param {object} [opts]
 * @param {function} [opts.now] 現在時刻（ms）を返す関数（テスト用）
 * @returns {{session, weekly, updatedAt:number}|null}
 */
function readClaudeUsage(file, { now = Date.now } = {}) {
    if (!file) return null;
    let text;
    try {
        text = fs.readFileSync(file, 'utf8');
    } catch {
        return null;
    }
    const usage = parseClaudeUsage(text);
    if (!usage) return null;
    return { ...usage, updatedAt: now() };
}

module.exports = { findRateLimits, toWindow, parseClaudeUsage, readClaudeUsage };
