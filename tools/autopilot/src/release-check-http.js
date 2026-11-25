'use strict';
/**
 * release-check-http.js — 分解済み EPIC のリリース確認（#2430）の I/O。
 *
 * - {@link applyReleaseCheckEntries}: 子が全部済んだトラッカーの AI Status を Release Check にする
 *   （俯瞰ボードの再取得のあと。ボードが持つ sub-issue の数とラベルだけで決めるので、追加の read は無い）
 * - `GET /release-check?issue=N`: モニターの「確認の結果を書く」を押したときだけ、トラッカーのコメントを
 *   1 回読んで、観点とプレビューの URL を返す（定期では取らない・`.claude/rules/autopilot/github-api.md`）
 * - `POST /release-check/review`: 結果を目印付きのコメントとして Bot で書き、🙋 を外す
 *   （外す流れは「AI に任せる」と同じ monitor-answers.js の releaseHumanGate）
 *
 * 判断は release-check.js の純粋関数。daemon からは呼び出しだけにする。
 */

const project = require('./project');
const { sanitizeForSurface } = require('./phases');
const {
    selectReleaseCheckEntries, releaseCheckView, normalizeReleaseReviewBody, planReleaseReviewPost,
    renderReleaseReviewComment,
} = require('./release-check');

/** 既定の GitHub の I/O（テストは deps で差し替える。実 GitHub に触るテストを書かない） */
function defaultIo() {
    return {
        botToken: project.botToken, readToken: project.readToken, applyIntents: project.applyIntents,
        listIssueComments: project.listIssueComments, postIssueComment: project.postIssueComment,
    };
}

/** 同じトラッカーに結果を重ねて送らない */
const inFlight = new Set();

/**
 * 子が全部済んだトラッカーをリリース確認に入れる。1 件の失敗はほかを止めない。
 * @param {object[]} boardItems refreshBoard が作った board の item
 * @param {object} cfg { projectId, fields }
 * @param {object} state board キャッシュの追従に使う
 * @param {function} log
 * @param {object} [deps] { botToken, applyIntents, patchBoardCache }
 * @returns {Promise<number[]>} 入れたトラッカーの番号
 */
async function applyReleaseCheckEntries(boardItems, cfg, state, log, deps = {}) {
    const entries = selectReleaseCheckEntries(boardItems);
    if (!entries.length) return [];
    const io = { ...defaultIo(), ...deps };
    const token = await io.botToken();
    const done = [];
    for (const { item, intents } of entries) {
        try {
            await io.applyIntents({ projectId: cfg.projectId, fields: cfg.fields }, item.itemId, intents, token);
            for (const { field, value } of intents) if (field === 'AI Status') item.aiStatus = value;
            if (deps.patchBoardCache) deps.patchBoardCache(state, item.issue, intents);
            log(`#${item.issue}: all sub-issues done -> AI Status=Release Check`);
            done.push(item.issue);
        } catch (e) {
            log(`#${item.issue}: release check entry failed: ${sanitizeForSurface(e.message)}`);
        }
    }
    return done;
}

function boardItem(state, issue) {
    return state.board && Array.isArray(state.board.items) ? state.board.items.find((x) => x && x.issue === issue) || null : null;
}

/**
 * プレビューの URL を覚え、board のキャッシュにも載せる（モニターの行のリンク）。
 * 値は worker の結果から来るので、`javascript:` などをリンクにしないよう http(s) だけを受ける。
 */
function rememberPreview(state, issue, url) {
    if (typeof url !== 'string' || !/^https?:\/\/[^\s"'<>]+$/i.test(url)) return;
    if (!state.releasePreviews) state.releasePreviews = {};
    state.releasePreviews[issue] = url;
    const it = boardItem(state, issue);
    if (it) it.previewUrl = url;
}

/**
 * `GET /release-check?issue=N` を 1 回受ける。
 * @param {object} ctx { cfg, state }
 * @param {number|string} issueRaw
 * @param {object} [deps]
 * @returns {Promise<{status:number, body:object}>}
 */
async function releaseCheckViewOnce(ctx, issueRaw, deps = {}) {
    const issue = /^\d+$/.test(String(issueRaw || '')) ? Number(issueRaw) : null;
    if (!issue) return { status: 400, body: { error: 'issue (positive integer) required' } };
    const { cfg, state } = ctx;
    const io = { ...defaultIo(), ...deps };
    if (!boardItem(state, issue)) return { status: 404, body: { error: 'not a board item', code: 'unknown-item', issue } };
    try {
        const view = releaseCheckView(await io.listIssueComments(cfg.repo, issue, await io.readToken()));
        if (view.check) rememberPreview(state, issue, view.check.previewUrl);
        return { status: 200, body: { issue, ...view } };
    } catch (e) {
        return { status: 502, body: { error: sanitizeForSurface(e.message), issue } };
    }
}

/**
 * `POST /release-check/review` を 1 回受ける。結果を先に書いてから 🙋 を外すので、外すのに失敗しても
 * 押し直せば続きから進む（同じ round の結果はもう一度書かない・{@link planReleaseReviewPost}）。
 * @param {object} ctx { cfg, state, log, now, afterRelease() }
 * @param {object} body `{issue, round, results, comment}`
 * @param {object} [deps] I/O の差し替え（releaseHumanGate も）
 * @returns {Promise<{status:number, body:object}>}
 */
async function releaseReviewOnce(ctx, body, deps = {}) {
    const n = normalizeReleaseReviewBody(body);
    if (!n.ok) return { status: 400, body: { error: n.error } };
    const { cfg, state, log } = ctx;
    const io = { ...defaultIo(), ...deps };
    const item = boardItem(state, n.issue);
    if (!item) return { status: 404, body: { error: 'not a board item', code: 'unknown-item', issue: n.issue } };
    if (item.aiStatus !== 'Release Check' || !item.hitl) {
        return { status: 409, body: { error: 'not waiting for a release check', code: 'not-release-check', issue: n.issue } };
    }
    if (inFlight.has(n.issue)) return { status: 409, body: { error: 'already sending', code: 'in-flight', issue: n.issue } };
    inFlight.add(n.issue);
    try {
        let post;
        try {
            const comments = await io.listIssueComments(cfg.repo, n.issue, await io.readToken());
            const view = releaseCheckView(comments);
            if (!view.check || view.check.round !== n.round) {
                return { status: 409, body: { error: 'round does not match the latest check', code: 'stale-round', issue: n.issue } };
            }
            post = planReleaseReviewPost(comments, n.round);
            if (post.action === 'post') {
                const text = renderReleaseReviewComment({ round: n.round, results: n.results, comment: n.comment, login: cfg.assignee || null });
                await io.postIssueComment(cfg.repo, n.issue, text, await io.botToken());
            }
        } catch (e) {
            const error = sanitizeForSurface(e.message);
            log(`#${n.issue}: release review failed: ${error}`);
            return { status: 502, body: { error, issue: n.issue } };
        }
        const release = deps.releaseHumanGate || require('./monitor-answers').releaseHumanGate;
        const r = await release(n.issue, ctx, deps, { intents: [], itemId: item.itemId });
        if (!r.ok) {
            log(`#${n.issue}: release review: 🙋 release failed: ${r.error}`);
            return { status: 502, body: { error: r.error, issue: n.issue } };
        }
        const ng = n.results.filter((x) => x.verdict === 'ng').length;
        log(`#${n.issue}: release review round ${n.round} (${post.action}, NG ${ng}) -> 🙋 released`);
        if (ctx.afterRelease) ctx.afterRelease(n.issue);
        return { status: 200, body: { ok: true, issue: n.issue, round: n.round, action: post.action, ng } };
    } finally {
        inFlight.delete(n.issue);
    }
}

/** JSON の POST を読む（大きすぎる body は断る） */
function readJson(req, max, cb) {
    let size = 0;
    const chunks = [];
    let over = false;
    req.on('data', (c) => { size += c.length; if (size > max) over = true; else chunks.push(c); });
    req.on('end', () => {
        if (over) return cb(new Error('body too large'));
        try { cb(null, JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')); } catch (e) { cb(e); }
    });
}

/**
 * daemon の HTTP に `GET /release-check` と `POST /release-check/review` を足す。扱ったら true を返す。
 * @param {object} req
 * @param {object} res
 * @param {URL} url
 * @param {object} ctx { cfg, state, log, now, afterRelease, deps }
 * @returns {boolean}
 */
function handleReleaseCheckHttp(req, res, url, ctx) {
    if (!ctx || (url.pathname !== '/release-check' && url.pathname !== '/release-check/review')) return false;
    const send = (code, obj) => {
        res.writeHead(code, { 'content-type': 'application/json' });
        res.end(JSON.stringify(obj));
    };
    const fail = (e) => send(500, { error: String((e && e.message) || e) });
    if (url.pathname === '/release-check') {
        if (req.method !== 'GET') { send(405, { error: 'method not allowed' }); return true; }
        releaseCheckViewOnce(ctx, url.searchParams.get('issue'), ctx.deps).then((r) => send(r.status, r.body)).catch(fail);
        return true;
    }
    if (req.method !== 'POST') { send(405, { error: 'method not allowed' }); return true; }
    readJson(req, 64 * 1024, (err, body) => {
        if (err) return send(400, { error: `bad body: ${err.message}` });
        releaseReviewOnce(ctx, body, ctx.deps).then((r) => send(r.status, r.body)).catch(fail);
    });
    return true;
}

module.exports = { applyReleaseCheckEntries, releaseCheckViewOnce, releaseReviewOnce, handleReleaseCheckHttp, rememberPreview };
