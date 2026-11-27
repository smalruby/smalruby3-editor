'use strict';
/**
 * release-check-http.js — 分解済み EPIC のリリース確認（#2430）の I/O。
 *
 * - {@link applyReleaseCheckEntries}: 子が全部済んだトラッカーの AI Status を Release Check にする
 *   （俯瞰ボードの再取得のあと。ボードが持つ sub-issue の数とラベル、既に読んだ本文のキャッシュだけで決めるので、
 *   追加の read は無い）
 * - `GET /release-check?issue=N`: モニターの「確認の結果を書く」を押したときだけ、トラッカーのコメントを
 *   1 回読んで、観点とプレビューの URL を返す（定期では取らない・`.claude/rules/autopilot/github-api.md`）
 * - `POST /release-check/review`: 結果を目印付きのコメントとして Bot で書き、🙋 を外す
 *   （外す流れは「AI に任せる」と同じ monitor-answers.js の releaseHumanGate）
 *
 * - `POST /release-check/merge?issue=N`（#2544）: 全部 OK の EPIC の topic → develop の PR を、トラッカー・PR を
 *   読み直して確かめてから draft を外してマージし、EPIC を Close にして閉じる（{@link releaseMergeOnce}）。
 *   人間が GitHub でマージしたときも同じ終わり方にする（{@link applyReleaseMergedEpics}）
 * - 確認ページ（artifact・#2474）: URL を EPIC ごとに状態ファイル（`$AUTOPILOT_STATE_DIR/release-check-pages.json`）に
 *   持ち、release-check の worker に `AUTOPILOT_ARTIFACT_URL` で渡す（{@link releasePageEnv}）。worker が結果の
 *   `artifactUrl` で返した URL を覚える（{@link rememberReleasePage}）。ページの答え（db）は worker が ArtifactData で読み、
 *   {@link postReleasePageAnswer}（`bin/release-page-answer.js`）でモニターの結果と同じ目印のコメントにする
 *
 * 判断は release-check.js / release-page.js の純粋関数。daemon からは呼び出しだけにする。
 */

const fs = require('fs');
const path = require('path');
const project = require('./project');
const { sanitizeForSurface, HITL_LABEL } = require('./phases');
const {
    selectReleaseCheckEntries, releaseCheckView, normalizeReleaseReviewBody, planReleaseReviewPost,
    renderReleaseReviewComment, releaseCheckRounds, parseReleaseResultMarker, handledPrFeedbackRefs, selectPrFeedback,
} = require('./release-check');
const {
    releaseMergeReadiness, planReleaseMerge, releaseMergeCloseIntents, epicTopicBranch, selectReleaseCheckTrackers,
    selectMergedReleaseEpics, releaseMergeCandidate,
} = require('./release-merge');
const { answerToReviewBody, planReleasePageState, releasePageUrl } = require('./release-page');
const { stateDir } = require('./current-status-job');

/** 既定の GitHub の I/O（テストは deps で差し替える。実 GitHub に触るテストを書かない） */
function defaultIo() {
    return {
        botToken: project.botToken, readToken: project.readToken, applyIntents: project.applyIntents,
        listIssueComments: project.listIssueComments, postIssueComment: project.postIssueComment,
        getEpicMergeFacts: project.getEpicMergeFacts, listPrFeedbackSources: project.listPrFeedbackSources,
        listSubIssueBodies: project.listSubIssueBodies, markPrReady: project.markPrReady, mergePr: project.mergePr,
        editLabels: project.editLabels, closeIssue: project.closeIssue, findMergedTopicPr: project.findMergedTopicPr,
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
    // 親を autopilot-after で待つ子（#2459）は、dispatch の計画が既に読んだ本文のキャッシュだけで見る
    const directives = state && state.directives instanceof Map ? state.directives : null;
    const afterOf = (n) => (directives && directives.get(n) ? directives.get(n).after : null);
    const entries = selectReleaseCheckEntries(boardItems, { afterOf });
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
                const text = renderReleaseReviewComment({
                    round: n.round, results: n.results, comment: n.comment, login: cfg.assignee || null, decisions: n.decisions, source: n.source,
                });
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

/**
 * EPIC を終わらせる（モニターから押したとき・人間が GitHub でマージしたときの共通）。Status=Close・AI Status を空、
 * 🙋 を外して Issue を閉じる。どれかが失敗しても残りは続け、失敗したものを返す（次の確かめで取り直せる）。
 * @returns {Promise<string[]>} 失敗した段の理由
 */
async function finishEpicMerge(ctx, item, io, token) {
    const { cfg, state, log } = ctx;
    const failed = [];
    const intents = releaseMergeCloseIntents();
    const step = async (name, fn) => {
        try { await fn(); } catch (e) { failed.push(`${name}: ${sanitizeForSurface(e.message)}`); }
    };
    await step('project', async () => {
        await io.applyIntents({ projectId: cfg.projectId, fields: cfg.fields }, item.itemId, intents, token);
        item.status = 'Close';
        item.aiStatus = null;
        if (io.patchBoardCache) io.patchBoardCache(state, item.issue, intents);
    });
    await step('hitl', async () => {
        if (!item.hitl && !(item.labels || []).includes(HITL_LABEL)) return;
        await io.editLabels(cfg.repo, item.issue, 'issue', { remove: [HITL_LABEL] }, token);
        item.hitl = false;
        if (Array.isArray(item.labels)) item.labels = item.labels.filter((l) => l !== HITL_LABEL);
    });
    await step('close', () => io.closeIssue(cfg.repo, item.issue, token));
    forgetReleaseMerge(state, item.issue, io);
    for (const f of failed) log(`#${item.issue}: EPIC close after merge: ${f}`);
    return failed;
}

/**
 * `POST /release-check/merge?issue=N` を 1 回受ける。押したときだけトラッカーと PR を読み直し、
 * {@link planReleaseMerge} で確かめてから行う。書き込みは Bot。
 * @param {object} ctx { cfg, state, log, now }
 * @param {number|string} issueRaw
 * @param {object} body `{confirmOffHours?: boolean}`
 * @param {object} [deps] I/O の差し替え
 * @returns {Promise<{status:number, body:object}>}
 */
async function releaseMergeOnce(ctx, issueRaw, body, deps = {}) {
    const issue = /^\d+$/.test(String(issueRaw || '')) ? Number(issueRaw) : null;
    if (!issue) return { status: 400, body: { error: 'issue (positive integer) required' } };
    const { cfg, state, log } = ctx;
    const io = { ...defaultIo(), ...deps };
    const item = boardItem(state, issue);
    if (!item) return { status: 404, body: { error: 'not a board item', code: 'unknown-item', issue } };
    if (item.aiStatus !== 'Release Check' || !item.hitl) {
        return { status: 409, body: { error: 'not waiting for a release check', code: 'not-release-check', issue } };
    }
    if (state.running && typeof state.running.has === 'function' && state.running.has(issue)) {
        return { status: 409, body: { error: 'a worker is running on this EPIC', code: 'busy', issue } };
    }
    if (inFlight.has(issue)) return { status: 409, body: { error: 'already sending', code: 'in-flight', issue } };
    inFlight.add(issue);
    try {
        let plan;
        try {
            const readTok = await io.readToken();
            const comments = await io.listIssueComments(cfg.repo, issue, readTok);
            const r = releaseCheckRounds(comments);
            const marker = r.resultComment ? parseReleaseResultMarker(r.resultComment.body) : null;
            let prFeedback = [];
            let pr = null;
            if (marker && marker.allOk && marker.pr) {
                const src = await io.listPrFeedbackSources(cfg.repo, marker.pr, readTok);
                const handled = handledPrFeedbackRefs({
                    epic: issue, existingBodies: await io.listSubIssueBodies(cfg.repo, issue, readTok), comments,
                });
                prFeedback = selectPrFeedback({ ...src, handled });
                pr = await io.getEpicMergeFacts(cfg.repo, marker.pr, readTok);
            }
            const readiness = releaseMergeReadiness({ comments, prFeedback });
            plan = planReleaseMerge({
                readiness, pr, nowMs: (ctx.now || Date.now)(), confirmOffHours: Boolean(body && body.confirmOffHours === true), epic: issue,
            });
        } catch (e) {
            const error = sanitizeForSurface(e.message);
            log(`#${issue}: release merge check failed: ${error}`);
            return { status: 502, body: { error, issue } };
        }
        if (plan.action === 'refuse') {
            log(`#${issue}: release merge refused (${plan.code})`);
            return { status: 409, body: { error: plan.reason, code: plan.code, issue } };
        }
        if (plan.action === 'confirm') {
            return { status: 409, body: { error: plan.reason, code: plan.code, confirm: true, issue } };
        }
        const token = await io.botToken();
        try {
            if (plan.steps.includes('ready')) await io.markPrReady(cfg.repo, plan.pr, token);
            await io.mergePr(cfg.repo, plan.pr, token);
        } catch (e) {
            const error = sanitizeForSurface(e.message);
            log(`#${issue}: release merge of PR #${plan.pr} failed: ${error}`);
            return {
                status: 502,
                body: { error: `PR #${plan.pr} をマージできませんでした（${error}）。Bot の権限で通らないときは GitHub でマージしてください`, issue, pr: plan.pr },
            };
        }
        log(`#${issue}: PR #${plan.pr} merged to develop from the monitor`);
        const failed = await finishEpicMerge(ctx, item, io, token);
        return { status: 200, body: { ok: true, issue, pr: plan.pr, closed: !failed.length, failed } };
    } finally {
        inFlight.delete(issue);
    }
}

/**
 * Release Check の EPIC の topic → develop の PR を人間が GitHub でマージしていたら、EPIC を終わらせる（#2544）。
 * 見るのは Release Check のトラッカーだけ（ふつう 0〜1 件）で、1 件につき PR の一覧を 1 回読む。
 * topic は子の `autopilot-base:`（dispatch の計画が既に読んだ本文のキャッシュ）か、全部 OK の結果の PR から。
 * @param {object[]} boardItems
 * @param {object} cfg
 * @param {object} state
 * @param {function} log
 * @param {object} [deps] I/O の差し替え（patchBoardCache も）
 * @returns {Promise<number[]>} 終わらせた EPIC
 */
async function applyReleaseMergedEpics(boardItems, cfg, state, log, deps = {}) {
    const trackers = selectReleaseCheckTrackers(boardItems);
    if (!trackers.length) return [];
    const io = { ...defaultIo(), ...deps };
    const directives = state && state.directives instanceof Map ? state.directives : null;
    const baseOf = (n) => (directives && directives.get(n) ? directives.get(n).base : null);
    const lookups = trackers.map((t) => ({
        t, topic: epicTopicBranch(t.issue, boardItems, baseOf), cand: (state.releaseMerges && state.releaseMerges[t.issue]) || null,
    })).filter((x) => x.topic || (x.cand && x.cand.pr));
    if (!lookups.length) return [];
    const readTok = await io.readToken();
    const merged = {};
    for (const { t, topic, cand } of lookups) {
        try {
            if (topic) {
                const n = await io.findMergedTopicPr(cfg.repo, topic, 'develop', readTok);
                if (n) merged[t.issue] = n;
            } else {
                const facts = await io.getEpicMergeFacts(cfg.repo, cand.pr, readTok);
                if (facts && facts.state === 'MERGED' && facts.baseRefName === 'develop') merged[t.issue] = cand.pr;
            }
        } catch (e) {
            log(`#${t.issue}: merged topic PR lookup failed: ${sanitizeForSurface(e.message)}`);
        }
    }
    const targets = selectMergedReleaseEpics(boardItems, merged);
    if (!targets.length) return [];
    const token = await io.botToken();
    const done = [];
    for (const { item, pr } of targets) {
        log(`#${item.issue}: topic → develop PR #${pr} was merged -> close the EPIC`);
        await finishEpicMerge({ cfg, state, log }, item, io, token);
        done.push(item.issue);
    }
    return done;
}

/** 全部 OK の材料の状態ファイル（daemon の再起動をまたいで「develop へマージする」を出し続ける） */
function releaseMergesPath(env) { return path.join(stateDir(env), 'release-check-merges.json'); }

/** 全部 OK の材料を読む。無い・壊れているときは空 */
function loadReleaseMerges(deps = {}) {
    try {
        const v = JSON.parse((deps.readFileSync || fs.readFileSync)(releaseMergesPath(deps.env), 'utf8'));
        return v && typeof v === 'object' && !Array.isArray(v) ? v : {};
    } catch {
        return {};
    }
}

function saveReleaseMerges(merges, deps = {}) {
    const file = releaseMergesPath(deps.env);
    (deps.mkdirSync || fs.mkdirSync)(path.dirname(file), { recursive: true });
    (deps.writeFileSync || fs.writeFileSync)(file, JSON.stringify(merges, null, 2));
}

/**
 * release-check の結果から、モニターの「develop へマージする」を出す材料を覚える（全部 OK のときだけ。
 * ほかの結果なら消す）。board のキャッシュにも載せる。押したときは daemon が改めて確かめる。
 * @returns {boolean} 変わったか
 */
function rememberReleaseMerge(state, issue, result, log = () => {}, deps = {}) {
    const cand = releaseMergeCandidate(result);
    const cur = state.releaseMerges && state.releaseMerges[issue];
    if (!cand && !cur) return false;
    if (cand && cur && JSON.stringify(cand) === JSON.stringify(cur)) return false;
    state.releaseMerges = { ...(state.releaseMerges || {}) };
    if (cand) state.releaseMerges[issue] = cand;
    else delete state.releaseMerges[issue];
    const it = boardItem(state, issue);
    if (it) it.releaseMerge = cand;
    try { saveReleaseMerges(state.releaseMerges, deps); } catch (e) { log(`#${issue}: release merge save failed: ${e.message}`); }
    if (cand) log(`#${issue}: release check all OK -> PR #${cand.pr} can be merged from the monitor`);
    return true;
}

/** 材料を消す（EPIC を終わらせたあと） */
function forgetReleaseMerge(state, issue, deps = {}) {
    if (!state.releaseMerges || !state.releaseMerges[issue]) return;
    state.releaseMerges = { ...state.releaseMerges };
    delete state.releaseMerges[issue];
    const it = boardItem(state, issue);
    if (it) it.releaseMerge = null;
    try { saveReleaseMerges(state.releaseMerges, deps); } catch { /* 次の結果で上書きされる */ }
}

/**
 * board の item に載せる材料（Release Check + 🙋 のときだけ）。
 * @param {object} state
 * @param {{issue:number, aiStatus?:string, hitlLabel?:boolean}} it Project の item
 * @returns {object|null}
 */
function releaseMergeOf(state, it) {
    if (!it || it.aiStatus !== 'Release Check' || !it.hitlLabel) return null;
    return (state.releaseMerges && state.releaseMerges[it.issue]) || null;
}

/** 確認ページの URL の状態ファイル（daemon の再起動をまたいで残す） */
function releasePagesPath(env) { return path.join(stateDir(env), 'release-check-pages.json'); }

/**
 * 確認ページの URL を読む。無い・壊れているときは空。
 * @param {object} [deps] { env, readFileSync }
 * @returns {object} `{ "<epic>": {url, round, updatedAt} }`
 */
function loadReleasePages(deps = {}) {
    try {
        const v = JSON.parse((deps.readFileSync || fs.readFileSync)(releasePagesPath(deps.env), 'utf8'));
        return v && typeof v === 'object' && !Array.isArray(v) ? v : {};
    } catch {
        return {};
    }
}

function saveReleasePages(pages, deps = {}) {
    const file = releasePagesPath(deps.env);
    (deps.mkdirSync || fs.mkdirSync)(path.dirname(file), { recursive: true });
    (deps.writeFileSync || fs.writeFileSync)(file, JSON.stringify(pages, null, 2));
}

/** テンプレートの場所。daemon のスナップショットにあればそれ、無ければ repo（current-status と同じ） */
function releasePageTemplateDir(cfg = {}) {
    const snap = cfg.snapshotDir && path.join(cfg.snapshotDir, 'templates', 'release-check');
    if (snap && fs.existsSync(snap)) return snap;
    return path.join(__dirname, '..', 'templates', 'release-check');
}

/**
 * release-check の worker に足す環境変数。URL が空なら初回（worker が新しく作る）。
 * @param {object} state daemon の state（releasePages）
 * @param {number} issue トラッカーの番号
 * @param {object} cfg
 * @returns {object}
 */
function releasePageEnv(state, issue, cfg = {}) {
    return {
        AUTOPILOT_ARTIFACT_URL: releasePageUrl(state.releasePages, issue) || '',
        AUTOPILOT_RELEASE_PAGE_TEMPLATE: path.join(releasePageTemplateDir(cfg), 'template.html'),
        AUTOPILOT_RELEASE_PAGE_RENDER: path.join(__dirname, '..', 'bin', 'release-page-render.js'),
        AUTOPILOT_RELEASE_PAGE_ANSWER: path.join(__dirname, '..', 'bin', 'release-page-answer.js'),
    };
}

/**
 * worker の結果の `artifactUrl` を覚え、状態ファイルと board のキャッシュ（「あなた宛て」のボタン）に載せる。
 * 同じ EPIC の 2 回目からは同じ場所を上書きする（URL が変わらなければ値もそのまま）。
 * @param {object} state
 * @param {number} issue
 * @param {object} result 結果ファイル（`artifactUrl`・`round`）
 * @param {number} now
 * @param {function} [log]
 * @param {object} [deps] { env, writeFileSync, mkdirSync }
 * @returns {boolean} 覚えたか
 */
function rememberReleasePage(state, issue, result, now, log = () => {}, deps = {}) {
    const r = result || {};
    const plan = planReleasePageState(state.releasePages, { issue, round: r.round, artifactUrl: r.artifactUrl, now });
    if (!plan.changed) return false;
    state.releasePages = plan.pages;
    const it = boardItem(state, issue);
    if (it) it.releasePageUrl = plan.pages[issue].url;
    try { saveReleasePages(plan.pages, deps); } catch (e) { log(`#${issue}: release page save failed: ${e.message}`); }
    log(`#${issue}: release page ${plan.pages[issue].url}`);
    return true;
}

/**
 * 確認ページで送られた答え（db の文書）を、モニターの結果と同じ目印のコメントとしてトラッカーに Bot で書く。
 * release-check の worker が ArtifactData で読んだ文書を渡す（daemon は db を読めない）。🙋 は外さない
 * （worker は 🙋 が外れて起きている）。同じ round の結果が既にあれば書かない（モニターから先に送った場合も）。
 * @param {{cfg:object}} ctx
 * @param {{issue:number, answer:object}} p answer は db の文書の中身
 * @param {object} [deps] I/O の差し替え（listIssueComments / postIssueComment / readToken / botToken）
 * @returns {Promise<{ok:boolean, action?:'post'|'skip'|'none', round?:number, error?:string, ng?:number}>}
 *   action=none は送った答えがその round に無い（下書きのまま・round が違う）
 */
async function postReleasePageAnswer(ctx, p, deps = {}) {
    const { cfg } = ctx;
    const io = { ...defaultIo(), ...deps };
    const comments = await io.listIssueComments(cfg.repo, p.issue, await io.readToken());
    const view = releaseCheckView(comments);
    if (!view.check) return { ok: false, error: 'no release check comment' };
    const round = view.check.round;
    const body = answerToReviewBody(p.answer, { issue: p.issue, round });
    if (!body) return { ok: true, action: 'none', round };
    const n = normalizeReleaseReviewBody(body);
    if (!n.ok) return { ok: false, error: n.error, round };
    const post = planReleaseReviewPost(comments, round);
    if (post.action === 'post') {
        const text = renderReleaseReviewComment({
            round, results: n.results, comment: n.comment, decisions: n.decisions, source: 'page', login: cfg.assignee || null,
        });
        await io.postIssueComment(cfg.repo, p.issue, text, await io.botToken());
    }
    return { ok: true, action: post.action, round, ng: n.results.filter((x) => x.verdict === 'ng').length };
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
 * daemon の HTTP に `GET /release-check`・`POST /release-check/review`・`POST /release-check/merge` を足す。扱ったら true を返す。
 * @param {object} req
 * @param {object} res
 * @param {URL} url
 * @param {object} ctx { cfg, state, log, now, afterRelease, deps }
 * @returns {boolean}
 */
function handleReleaseCheckHttp(req, res, url, ctx) {
    const paths = ['/release-check', '/release-check/review', '/release-check/merge'];
    if (!ctx || !paths.includes(url.pathname)) return false;
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
        const run = url.pathname === '/release-check/merge'
            ? releaseMergeOnce(ctx, url.searchParams.get('issue'), body, ctx.deps)
            : releaseReviewOnce(ctx, body, ctx.deps);
        run.then((r) => send(r.status, r.body)).catch(fail);
    });
    return true;
}

module.exports = {
    applyReleaseCheckEntries, releaseCheckViewOnce, releaseReviewOnce, handleReleaseCheckHttp, rememberPreview,
    releasePagesPath, loadReleasePages, saveReleasePages, releasePageTemplateDir, releasePageEnv, rememberReleasePage,
    postReleasePageAnswer, releaseMergeOnce, applyReleaseMergedEpics, finishEpicMerge, releaseMergesPath, loadReleaseMerges,
    saveReleaseMerges, rememberReleaseMerge, forgetReleaseMerge, releaseMergeOf,
};
