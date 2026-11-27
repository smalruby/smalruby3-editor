'use strict';
/**
 * http-guard.js — daemon の HTTP 制御サーバーの「受け付けの守り」の判断（純粋関数のみ・EPIC #2384 U3）。
 *
 * daemon はコンテナの 127.0.0.1 だけで待ち、起動ごとにランダムな合言葉（トークン）を作る。
 * モニターの HTML に合言葉を埋め込み、状態を変える要求（GET / HEAD 以外）はヘッダ
 * `X-Autopilot-Token` で確かめる。さらに `Host` / `Origin` が自分自身（localhost / 127.0.0.1 /
 * [::1] と設定のポート）でなければ断る。ねらいは、人間のブラウザで開いた別のサイトから
 * localhost:8787 へ POST される（CSRF）ことと、DNS rebinding で読み書きされることを防ぐこと。
 *
 * I/O・時計・乱数を持ち込まない（合言葉の生成とファイルへの書き出しは daemon が行う）。
 */

const crypto = require('crypto');

/** 合言葉を載せるヘッダ（Node の req.headers は小文字のキー） */
const TOKEN_HEADER = 'x-autopilot-token';

/** 自分自身とみなすホスト名（ポートは別に照合する） */
const LOOPBACK_HOSTS = ['localhost', '127.0.0.1', '[::1]'];

/** 状態を変えない（合言葉の要らない）メソッド */
const SAFE_METHODS = new Set(['GET', 'HEAD']);

/**
 * 状態を変えうる要求か。GET / HEAD 以外は全部「書き込み」として扱う（あとから足される
 * POST / PUT / DELETE にも自動でかかるように、許す側を列挙する）。
 * @param {string} method HTTP メソッド
 * @returns {boolean} 合言葉が要るなら true
 */
function isWriteMethod(method) {
    return !SAFE_METHODS.has(String(method || '').toUpperCase());
}

/**
 * 追加で許す `host:port` の一覧を env の文字列から読む（devpod のポート転送が別のポートに
 * 振られたときなどのため。例: `AUTOPILOT_HTTP_ALLOWED_HOSTS=localhost:8788`）。
 * @param {string|undefined} text カンマ・空白区切り
 * @returns {string[]} 小文字にした `host:port` の配列
 */
function parseAllowedHosts(text) {
    return String(text || '').split(/[\s,]+/).map((s) => s.trim().toLowerCase()).filter(Boolean);
}

/**
 * 許す `host:port` の集合。
 * @param {number} port daemon が実際に待っているポート
 * @param {string[]} [extra] 追加で許す `host:port`
 * @returns {Set<string>} 小文字の `host:port`
 */
function allowedHostSet(port, extra = []) {
    const set = new Set(LOOPBACK_HOSTS.map((h) => `${h}:${port}`));
    for (const h of extra || []) set.add(String(h).toLowerCase());
    return set;
}

/**
 * `Host` ヘッダが自分自身か。ポートの無い Host（= 80 番）は、設定のポートが 80 でない限り断る。
 * @param {string|undefined} host Host ヘッダ
 * @param {number} port daemon が待っているポート
 * @param {string[]} [extra] 追加で許す `host:port`
 * @returns {boolean} 許すなら true
 */
function isAllowedHost(host, port, extra = []) {
    if (typeof host !== 'string' || !host) return false;
    return allowedHostSet(port, extra).has(host.trim().toLowerCase());
}

/**
 * `Origin` ヘッダが自分自身か。Origin が無い要求（curl・CLI・同一オリジンの GET）は許す
 * （その代わり書き込みは合言葉で守る）。`null`（sandbox の iframe・file://）や https、別のホストは断る。
 * @param {string|undefined} origin Origin ヘッダ
 * @param {number} port daemon が待っているポート
 * @param {string[]} [extra] 追加で許す `host:port`
 * @returns {boolean} 許すなら true
 */
function isAllowedOrigin(origin, port, extra = []) {
    if (origin === undefined) return true;
    let u;
    try { u = new URL(String(origin)); } catch { return false; }
    if (u.protocol !== 'http:') return false;
    return allowedHostSet(port, extra).has(u.host.toLowerCase());
}

/**
 * 合言葉の照合（時間一定の比較）。長さが違うときも同じ長さの比較を 1 回してから false を返し、
 * 比較にかかる時間から長さ以外を推測されないようにする。合言葉が空の daemon は全部断る。
 * @param {string} expected daemon の合言葉
 * @param {unknown} given 要求のヘッダの値
 * @returns {boolean} 一致すれば true
 */
function tokenMatches(expected, given) {
    if (typeof expected !== 'string' || !expected || typeof given !== 'string') return false;
    const a = Buffer.from(expected);
    const b = Buffer.from(given);
    if (a.length !== b.length) {
        crypto.timingSafeEqual(a, a);
        return false;
    }
    return crypto.timingSafeEqual(a, b);
}

/**
 * 1 つの要求を受け付けてよいか。ルーティングの手前で 1 回だけ呼ぶ。
 * @param {object} req 要求の中身
 * @param {string} req.method HTTP メソッド
 * @param {object} req.headers 小文字キーのヘッダ
 * @param {number} req.port daemon が待っているポート
 * @param {string} req.token daemon の合言葉
 * @param {string[]} [req.allowedHosts] 追加で許す `host:port`
 * @returns {{ok: true}|{ok: false, status: number, reason: 'host'|'origin'|'token'}} 判定
 */
function checkHttpRequest({ method, headers = {}, port, token, allowedHosts = [] }) {
    if (!isAllowedHost(headers.host, port, allowedHosts)) return { ok: false, status: 403, reason: 'host' };
    if (!isAllowedOrigin(headers.origin, port, allowedHosts)) return { ok: false, status: 403, reason: 'origin' };
    if (isWriteMethod(method) && !tokenMatches(token, headers[TOKEN_HEADER])) {
        return { ok: false, status: 403, reason: 'token' };
    }
    return { ok: true };
}

module.exports = {
    TOKEN_HEADER, LOOPBACK_HOSTS, isWriteMethod, parseAllowedHosts, allowedHostSet,
    isAllowedHost, isAllowedOrigin, tokenMatches, checkHttpRequest,
};
