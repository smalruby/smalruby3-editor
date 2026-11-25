'use strict';
/**
 * blocked-hub.js — 止まっている（blocked で人間の答えを待っている）worker の置き場（#2387）。
 *
 * runner は worker を一時停止すると、ここに「何で止まっているか（画面・理由・選択肢）」を置き、
 * 人間の答えが来るのを待つ。モニターは `GET /blocked` で一覧を見て、`POST /blocked/answer` で
 * キーか文を送る。ここはメモリに置くだけ（daemon を止めると worker も全部止まるので、残す必要が無い）。
 * どれに何と答えたか（ルール・AI・人間）は、daemon のログと、ここの履歴と、JSONL のファイルに残す。
 */

const fs = require('fs');
const { normalizeHumanAnswer } = require('./blocked');

const HISTORY_LIMIT = 100;

/**
 * @param {object} [opts] { now, log, file }（file = 答えの履歴を足していく JSONL のパス。省略で書かない）
 * @returns {object}
 */
function createBlockedHub(opts = {}) {
    const now = opts.now || (() => Date.now());
    const log = opts.log || (() => {});
    // key は Issue 番号。Issue に結びつかない worker（現在地・タスク・学びの PR。issue=0）は worker の名前
    const waiting = new Map(); // key → { key, issue, phase, session, since, reason, screen, options, answer }
    const keyOf = (issue, session) => (issue ? String(issue) : String(session || ''));
    const history = [];

    function record(evt) {
        const e = { at: new Date(now()).toISOString(), ...evt };
        history.unshift(e);
        if (history.length > HISTORY_LIMIT) history.length = HISTORY_LIMIT;
        if (opts.file) { try { fs.appendFileSync(opts.file, `${JSON.stringify(e)}\n`); } catch { /* 履歴の失敗で止めない */ } }
        const what = e.keys ? `keys=${e.keys.join(' ')}` : e.text != null ? 'text' : '';
        log(`#${e.issue}: blocked ${e.type} (${e.source || '-'}) ${what} — ${e.reason || ''}`);
    }

    /**
     * runner に渡す 1 worker 分の口。
     * @param {number} issue Issue 番号（Issue に結びつかない worker は 0）
     * @param {string} phase
     * @param {string} session
     * @returns {{open:function, close:function, take:function, record:function}}
     */
    function channel(issue, phase, session) {
        const key = keyOf(issue, session);
        return {
            open(info) {
                waiting.set(key, { key, issue, phase, session, since: now(), answer: null, ...info });
                record({ type: 'paused', issue: issue || session, phase, source: info.source || null, reason: info.reason });
            },
            update(info) {
                const w = waiting.get(key);
                if (w) Object.assign(w, info);
            },
            take() {
                const w = waiting.get(key);
                if (!w || !w.answer) return null;
                const a = w.answer;
                w.answer = null;
                return a;
            },
            close(reason) {
                if (waiting.delete(key)) record({ type: 'resumed', issue: issue || session, phase, reason });
            },
            record: (evt) => record({ issue: issue || session, phase, ...evt }),
        };
    }

    /**
     * 人間の答えを置く（runner が次の見回りで受け取って送る）。
     * @param {number|string} key Issue 番号か、Issue に結びつかない worker の名前（一覧の `key`）
     * @param {object} body { keys } | { text }
     * @returns {{ok:boolean, error?:string, status:number}}
     */
    function answer(key, body) {
        const w = waiting.get(String(key));
        if (!w) return { ok: false, status: 404, error: 'not waiting' };
        const n = normalizeHumanAnswer(body);
        if (!n.ok) return { ok: false, status: 400, error: n.error };
        w.answer = n.answer;
        record({ type: 'answered', issue: w.issue || w.session, phase: w.phase, source: 'human', ...n.answer, reason: 'モニターから' });
        return { ok: true, status: 200 };
    }

    function list() {
        return [...waiting.values()].map((w) => ({
            key: w.key, issue: w.issue, phase: w.phase, session: w.session, since: new Date(w.since).toISOString(),
            reason: w.reason, screen: w.screen, options: w.options || [], answerPending: !!w.answer,
        }));
    }

    return { channel, answer, list, history: () => history.slice(), size: () => waiting.size };
}

/**
 * daemon の HTTP に `/blocked` を足す。扱ったら true を返す（daemon の startHttp の先頭で呼ぶ）。
 * @param {object} req
 * @param {object} res
 * @param {URL} url
 * @param {object} hub createBlockedHub の結果
 * @returns {boolean}
 */
function handleBlockedHttp(req, res, url, hub) {
    if (!hub || !url.pathname.startsWith('/blocked')) return false;
    const send = (code, obj) => {
        res.writeHead(code, { 'content-type': 'application/json' });
        res.end(JSON.stringify(obj));
    };
    if (req.method === 'GET' && url.pathname === '/blocked') {
        send(200, { waiting: hub.list(), history: hub.history().slice(0, 30) });
        return true;
    }
    if (req.method === 'POST' && url.pathname === '/blocked/answer') {
        let raw = '';
        req.on('data', (c) => { raw += c; if (raw.length > 10_000) req.destroy(); });
        req.on('end', () => {
            let body;
            try { body = JSON.parse(raw || '{}'); } catch { return send(400, { error: 'invalid json' }); }
            // Issue の worker は issue、Issue に結びつかない worker は key（一覧の key = worker の名前）
            const key = body.key != null ? String(body.key) : String(Number(body.issue));
            if (!key || key === 'NaN' || key === '0') return send(400, { error: 'issue (number) or key required' });
            const r = hub.answer(key, body);
            return send(r.status, r.ok ? { answered: key } : { error: r.error });
        });
        return true;
    }
    send(404, { error: 'not found' });
    return true;
}

module.exports = { createBlockedHub, handleBlockedHttp };
