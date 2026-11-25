'use strict';
/**
 * monitor-answers.js — モニターで人間が答える質問の置き場と、`POST /answer` の受け口
 * （notes/autopilot/ui-policy.md §8 の U1・U2）。
 *
 * - worker が signal=hitl の結果に書いた `questions` を、daemon がここに置く（モニターが GET /board・
 *   /status で読む）。daemon を起動し直しても残るように JSON ファイルに書く。
 * - 「メモだけ保存」（proceed=false）はここに置くだけ（GitHub に書かない・🙋 も外さない）。
 * - 「答えて先へ進める」（proceed=true）は、daemon が渡す `onProceed`（Issue に答えを書き 🙋 を外す）が
 *   成功したときだけ「答えた」にする。次にその Issue の worker を起こすとき daemon が {@link take} で取り出す。
 *
 * 判定と本文の組み立ては phases.js の純粋関数（planMonitorAnswer など）。GitHub の書き込みは daemon
 * （project.js 経由）。書き込みの受け口は {@link handleAnswerHttp} の 1 か所にまとめてある（合言葉や
 * Origin の確認は、ここを呼ぶ前に差し込む）。
 */

const fs = require('fs');
const path = require('path');
const {
    normalizeMonitorAnswerBody, planMonitorAnswer, monitorQuestionsView, planMonitorQuestionsComment,
    planMonitorAnswerComments, renderMonitorAnswersForPrompt, sanitizeForSurface, HITL_LABEL,
    normalizeDelegateBody, planDelegate, normalizeDelegateInstruction, planMonitorInstructionPost,
    renderMonitorInstructionComment, openPrNumber, reviewFindingsView,
} = require('./phases');

/** 既定の GitHub の I/O（テストは deps で差し替える。実 GitHub に触るテストを書かない） */
function defaultIo() {
    // daemon と同じ project.js を遅延で読む（このモジュール単体のテストで gh を読み込まないため）
    // eslint-disable-next-line global-require
    const project = require('./project');
    return {
        botToken: project.botToken, readToken: project.readToken,
        applyCommentPlans: project.applyCommentPlans, getIssueLabels: project.getIssueLabels,
        findPrForIssue: project.findPrForIssue, editLabels: project.editLabels, applyIntents: project.applyIntents,
        listIssueComments: project.listIssueComments, postIssueComment: project.postIssueComment,
    };
}

/** body の上限（メモ 2000 字 × 質問 10 問 + 余裕） */
const MAX_BODY_BYTES = 64 * 1024;

/**
 * @param {object} [opts] { file, now, log, fs }（file を省くとファイルに書かない＝テスト用）
 * @returns {object}
 */
function createAnswerStore(opts = {}) {
    const now = opts.now || (() => Date.now());
    const log = opts.log || (() => {});
    const fsx = opts.fs || fs;
    let entries = {};
    if (opts.file) {
        try { entries = JSON.parse(fsx.readFileSync(opts.file, 'utf8')) || {}; } catch { entries = {}; }
    }
    function save() {
        if (!opts.file) return;
        try {
            fsx.mkdirSync(path.dirname(opts.file), { recursive: true });
            fsx.writeFileSync(opts.file, JSON.stringify(entries, null, 2));
        } catch (e) { log(`monitor answers: save failed: ${e.message}`); }
    }
    return {
        /** worker の hitl の質問を置く（同じ Issue の前の質問・メモは置き換える） */
        setQuestions(issue, q) {
            entries[issue] = {
                issue, phase: q.phase || null, round: q.round, reason: q.reason || null,
                questions: q.questions, askedAt: new Date(now()).toISOString(), status: 'open', drafts: {},
            };
            save();
        },
        get: (issue) => entries[issue] || null,
        /** 「メモだけ保存」 */
        saveDrafts(issue, drafts) {
            if (!entries[issue]) return;
            entries[issue].drafts = drafts;
            save();
        },
        /** 「答えて先へ進める」が GitHub に書けたあと */
        markAnswered(issue, drafts, records) {
            const e = entries[issue];
            if (!e) return;
            Object.assign(e, { drafts, records, status: 'answered', answeredAt: new Date(now()).toISOString() });
            save();
        },
        /**
         * worker を起こすときに取り出す。答えた（answered）ものだけ返す。答えていない質問は、
         * worker を起こし直す（人間が GitHub で 🙋 を外したなど）時点で古くなるので消す。
         * @returns {object|null}
         */
        take(issue) {
            const e = entries[issue];
            if (!e) return null;
            delete entries[issue];
            save();
            return e.status === 'answered' ? e : null;
        },
        list: () => monitorQuestionsView(entries),
    };
}

/**
 * daemon の HTTP に `POST /answer` を足す。扱ったら true を返す。
 * body: `{issue, answers:[{q, key, note?}], proceed}`。
 * @param {object} req
 * @param {object} res
 * @param {URL} url
 * @param {object} ctx { store, now, onProceed(issue, entry, plan) → Promise<{status, body}> }
 * @returns {boolean}
 */
function handleAnswerHttp(req, res, url, ctx) {
    if (!ctx || !ctx.store || url.pathname !== '/answer') return false;
    return readJsonPost(req, res, (body) => answerOnce(ctx, body));
}

/** POST の JSON を読んで run(body) → {status, body} を返す（/answer と /delegate の共通の受け口）。true を返す */
function readJsonPost(req, res, run) {
    const send = (code, obj) => {
        res.writeHead(code, { 'content-type': 'application/json' });
        res.end(JSON.stringify(obj));
    };
    if (req.method !== 'POST') { send(405, { error: 'method not allowed' }); return true; }
    let raw = '';
    req.on('data', (c) => { raw += c; if (raw.length > MAX_BODY_BYTES) req.destroy(); });
    req.on('end', () => {
        let body;
        try { body = JSON.parse(raw || '{}'); } catch { return send(400, { error: 'invalid json' }); }
        run(body).then((r) => send(r.status, r.body))
            .catch((e) => send(500, { error: String(e && e.message || e) }));
    });
    return true;
}

/** 同じ Issue の「答えて先へ進める」を重ねて走らせない（二重に書かない） */
const inFlight = new Set();

/**
 * 答えを 1 回受ける（HTTP を外したところ。テストはここを呼ぶ）。
 * @param {object} ctx { store, now, onProceed }
 * @param {object} body
 * @returns {Promise<{status:number, body:object}>}
 */
async function answerOnce(ctx, body) {
    const n = normalizeMonitorAnswerBody(body);
    if (!n.ok) return { status: 400, body: { error: n.error } };
    const entry = ctx.store.get(n.issue);
    const plan = planMonitorAnswer(entry, n, (ctx.now || Date.now)());
    if (!plan.ok) return { status: plan.status, body: { error: plan.error } };
    if (!n.proceed) {
        ctx.store.saveDrafts(n.issue, plan.drafts);
        return { status: 200, body: { issue: n.issue, saved: true, proceed: false, answered: plan.records.length, total: entry.questions.length } };
    }
    if (inFlight.has(n.issue)) return { status: 409, body: { error: 'already proceeding' } };
    inFlight.add(n.issue);
    try {
        const r = await ctx.onProceed(n.issue, entry, plan);
        if (r && r.status && r.status !== 200) return r;
        ctx.store.markAnswered(n.issue, plan.drafts, plan.records);
        return { status: 200, body: { issue: n.issue, saved: true, proceed: true, ...(r && r.body) } };
    } finally {
        inFlight.delete(n.issue);
    }
}

/**
 * worker の hitl の結果に questions があれば、置き場に置き、Issue にマーカー付きで書く（冪等）。
 * Issue に書けなくても置き場には置く（モニターでは答えられる。答えのコメントは別に書く）。
 * @param {number} issue
 * @param {object} result 検証済みの結果
 * @param {object} ctx { cfg, store, log }
 * @param {object} [deps] I/O の差し替え
 * @returns {Promise<{recorded:boolean, round?:number, action?:string}>}
 */
async function recordHitlQuestions(issue, result, ctx, deps = {}) {
    if (!result || result.signal !== 'hitl' || !Array.isArray(result.questions) || !result.questions.length) {
        return { recorded: false };
    }
    const io = { ...defaultIo(), ...deps };
    const opts = { phase: result.phase, reason: result.reason };
    let plan = null;
    try {
        await io.applyCommentPlans(ctx.cfg.repo, issue, (comments) => {
            plan = planMonitorQuestionsComment(comments, issue, result.questions, opts);
            return plan.action === 'post' ? [{ ...plan, keepId: null, deleteIds: [] }] : [];
        }, await io.botToken(), { readToken: await io.readToken() });
    } catch (e) {
        ctx.log(`#${issue}: monitor questions comment failed: ${sanitizeForSurface(e.message)}`);
    }
    // Issue に書けなかったときも置く（round は 1。答えのコメントの書き込みでもう一度確かめる）
    const round = plan ? plan.round : 1;
    ctx.store.setQuestions(issue, {
        phase: result.phase, round, reason: sanitizeForSurface(result.reason || ''), questions: result.questions,
    });
    return { recorded: true, round, action: plan ? plan.action : 'failed' };
}

/**
 * 「答えて先へ進める」: 答えを Issue にマーカー付きで書き（同じ答えは書かない）、Issue と PR の 🙋 を外し、
 * 「モニターで外した」を覚える（{@link import('./phases').withMonitorReleases}）。
 * 実行中の worker がいる Issue は受けない（worker の結果の同期と競うため）。
 * @param {number} issue
 * @param {object} entry 置き場の 1 件
 * @param {object} plan planMonitorAnswer の結果
 * @param {object} ctx { cfg, state, log, now }
 * @param {object} [deps]
 * @returns {Promise<{status:number, body:object}>}
 */
async function proceedMonitorAnswer(issue, entry, plan, ctx, deps = {}) {
    const { cfg, state, log } = ctx;
    if (state.running && state.running.has(issue)) return { status: 409, body: { error: 'worker is running', issue } };
    const io = { ...defaultIo(), ...deps };
    const token = await io.botToken();
    const readToken = await io.readToken();
    let written = 0;
    try {
        const done = await io.applyCommentPlans(cfg.repo, issue,
            (comments) => planMonitorAnswerComments(comments, issue, entry, plan.records), token, { readToken });
        written = done.filter((p) => p.action !== 'skip').length;
    } catch (e) {
        const msg = sanitizeForSurface(e.message);
        log(`#${issue}: monitor answer failed: ${msg}`);
        return { status: 502, body: { error: msg } };
    }
    const rel = await releaseHumanGate(issue, ctx, { ...io, botToken: async () => token, readToken: async () => readToken });
    if (!rel.ok) {
        log(`#${issue}: monitor answer failed: ${rel.error}`);
        return { status: 502, body: { error: rel.error } };
    }
    log(`#${issue}: monitor answer recorded (${plan.records.length} answers, ${written} comments) -> 🙋 released`);
    return { status: 200, body: { released: true, comments: written } };
}

/**
 * 人間の明示操作（モニターの「答えて先へ進める」「AI に任せる」）を受けて、daemon が人間ゲートを開く:
 * `intents`（Project のフィールド。例: Status=Sprint Backlog）を書き、Issue と PR の 🙋 を外し、
 * 「モニターで外した」を覚える（{@link import('./phases').withMonitorReleases}・`hitlLabelAction` の
 * monitorReleased）。フィールドを先に書くので、途中で失敗しても押し直せば続きから進む（🙋 が残る）。
 * @param {number} issue
 * @param {object} ctx { cfg, state, now }
 * @param {object} [deps] I/O の差し替え（botToken / readToken / getIssueLabels / editLabels / findPrForIssue / applyIntents）
 * @param {object} [opts] { intents, itemId }
 * @returns {Promise<{ok:boolean, error?:string}>}
 */
async function releaseHumanGate(issue, ctx, deps = {}, opts = {}) {
    const { cfg, state } = ctx;
    const io = { ...defaultIo(), ...deps };
    const intents = opts.intents || [];
    try {
        const token = await io.botToken();
        const readToken = await io.readToken();
        if (intents.length) {
            if (!opts.itemId) throw new Error('no project item id');
            await io.applyIntents({ projectId: cfg.projectId, fields: cfg.fields }, opts.itemId, intents, token);
        }
        // 🙋 を外す（daemon が人間の明示操作を受けて外す・単一ライター）。外れていれば触らない
        const issueLabels = await io.getIssueLabels(cfg.repo, issue, readToken);
        if (issueLabels.includes(HITL_LABEL)) await io.editLabels(cfg.repo, issue, 'issue', { remove: [HITL_LABEL] }, token);
        const pr = await io.findPrForIssue(cfg.repo, issue, readToken);
        if (pr && (pr.labels || []).includes(HITL_LABEL)) await io.editLabels(cfg.repo, pr.number, 'pr', { remove: [HITL_LABEL] }, token);
    } catch (e) {
        return { ok: false, error: sanitizeForSurface(e.message) };
    }
    if (!state.monitorReleases) state.monitorReleases = {};
    state.monitorReleases[issue] = (ctx.now || Date.now)();
    // モニターの表示もすぐ追従させる（GraphQL は増やさない）
    const it = boardItem(state, issue);
    if (it) {
        it.hitlLabel = false;
        it.hitl = false;
        if (Array.isArray(it.labels)) it.labels = it.labels.filter((l) => l !== HITL_LABEL);
        for (const { field, value } of intents) if (field === 'Status') it.status = value;
    }
    return { ok: true };
}

function boardItem(state, issue) {
    return state.board && Array.isArray(state.board.items) ? state.board.items.find((x) => x && x.issue === issue) || null : null;
}

/**
 * 指摘と指示を扱う PR の番号（#2415）。board の item の PR を先に見て、無ければ GitHub に聞く。
 * @param {object|null} item board item
 * @param {number} issue
 * @param {object} cfg
 * @param {object} io
 * @returns {Promise<number|null>}
 */
async function prNumberFor(item, issue, cfg, io) {
    const fromBoard = openPrNumber(item && item.prs);
    if (fromBoard) return fromBoard;
    const pr = await io.findPrForIssue(cfg.repo, issue, await io.readToken());
    return pr ? pr.number : null;
}

/**
 * 「AI に任せる」を 1 回受ける（HTTP を外したところ。テストはここを呼ぶ・#2404）。
 * 判断は phases.js の {@link planDelegate}。答えの置き場と同じ inFlight で、同じ Issue に重ねて走らせない。
 *
 * body に `instruction`（モニターで書いた直してほしいこと・#2415）があれば、🙋 を外す前に、目印付きの
 * コメントとして Bot で PR に残す（address-review が `selectMonitorInstructions` で読む）。先に書くので、
 * 🙋 を外すのに失敗しても押し直せば続きから進む（同じ文はもう一度書かない・{@link planMonitorInstructionPost}）。
 * @param {object} ctx { cfg, state, log, now, afterRelease() }
 * @param {object} body `{issue, instruction?}`
 * @param {object} [deps] I/O の差し替え
 * @returns {Promise<{status:number, body:object}>}
 */
async function delegateOnce(ctx, body, deps = {}) {
    const n = normalizeDelegateBody(body);
    if (!n.ok) return { status: 400, body: { error: n.error } };
    const ins = normalizeDelegateInstruction(body);
    if (!ins.ok) return { status: 400, body: { error: ins.error, code: 'bad-instruction', issue: n.issue } };
    const { state, log, cfg } = ctx;
    const io = { ...defaultIo(), ...deps };
    const item = boardItem(state, n.issue);
    const q = state.answerStore ? state.answerStore.get(n.issue) : null;
    const plan = planDelegate(item, {
        running: Boolean(state.running && state.running.has(n.issue)),
        openQuestions: Boolean(q && q.status === 'open'),
        pr: Boolean(item && item.prs && item.prs.length),
    });
    if (!plan.ok) return { status: plan.status, body: { error: plan.error, code: plan.code, issue: n.issue } };
    if (ins.instruction && plan.nextPhase !== 'address-review') {
        return { status: 409, body: { error: 'instructions are only for address-review', code: 'no-instruction-phase', issue: n.issue } };
    }
    if (inFlight.has(n.issue)) return { status: 409, body: { error: 'already proceeding', code: 'in-flight', issue: n.issue } };
    inFlight.add(n.issue);
    try {
        let instruction = null;
        if (ins.instruction) {
            try {
                const pr = await prNumberFor(item, n.issue, cfg, io);
                if (!pr) return { status: 409, body: { error: 'no open PR', code: 'no-pr', issue: n.issue } };
                const comments = await io.listIssueComments(cfg.repo, pr, await io.readToken());
                const post = planMonitorInstructionPost(comments, ins.instruction);
                if (post.action === 'post') {
                    const text = renderMonitorInstructionComment({ text: ins.instruction, login: cfg.assignee || null });
                    await io.postIssueComment(cfg.repo, pr, text, await io.botToken());
                }
                instruction = { pr, action: post.action };
            } catch (e) {
                const error = sanitizeForSurface(e.message);
                log(`#${n.issue}: delegate instruction failed: ${error}`);
                return { status: 502, body: { error, issue: n.issue } };
            }
        }
        const r = await releaseHumanGate(n.issue, ctx, deps, { intents: plan.intents, itemId: item.itemId });
        if (!r.ok) {
            log(`#${n.issue}: delegate failed: ${r.error}`);
            return { status: 502, body: { error: r.error, issue: n.issue } };
        }
        const how = instruction ? ` with instruction on PR #${instruction.pr} (${instruction.action})` : '';
        log(`#${n.issue}: delegated to AI (${plan.action} -> ${plan.nextPhase})${how} -> 🙋 released`);
        if (ctx.afterRelease) ctx.afterRelease(n.issue);
        const out = { ok: true, issue: n.issue, action: plan.action, nextPhase: plan.nextPhase };
        if (instruction) out.instruction = instruction;
        return { status: 200, body: out };
    } finally {
        inFlight.delete(n.issue);
    }
}

/**
 * 「AI に直してもらう」を押したときに見せる bot の指摘を取ってくる（#2415）。押したときだけ呼ぶ
 * （REST の `issues/<pr>/comments` を 1 回。定期では取らない・`.claude/rules/autopilot/github-api.md`）。
 * @param {object} ctx { cfg, state }
 * @param {number|string} issueRaw
 * @param {object} [deps] I/O の差し替え
 * @returns {Promise<{status:number, body:object}>}
 */
async function findingsOnce(ctx, issueRaw, deps = {}) {
    const n = normalizeDelegateBody({ issue: issueRaw });
    if (!n.ok) return { status: 400, body: { error: n.error } };
    const { cfg, state } = ctx;
    const io = { ...defaultIo(), ...deps };
    const item = boardItem(state, n.issue);
    if (!item) return { status: 404, body: { error: 'not a board item', code: 'unknown-item', issue: n.issue } };
    try {
        const pr = await prNumberFor(item, n.issue, cfg, io);
        if (!pr) return { status: 200, body: { issue: n.issue, pr: null, findings: null, pendingInstructions: [] } };
        const view = reviewFindingsView(await io.listIssueComments(cfg.repo, pr, await io.readToken()));
        return { status: 200, body: { issue: n.issue, pr, ...view } };
    } catch (e) {
        return { status: 502, body: { error: sanitizeForSurface(e.message), issue: n.issue } };
    }
}

/**
 * daemon の HTTP に `POST /delegate`（と `GET /delegate/findings?issue=N`・#2415）を足す。扱ったら true を返す。
 * @param {object} req
 * @param {object} res
 * @param {URL} url
 * @param {object} ctx {@link delegateOnce} の ctx
 * @returns {boolean}
 */
function handleDelegateHttp(req, res, url, ctx) {
    if (!ctx) return false;
    if (url.pathname === '/delegate/findings') {
        const send = (code, obj) => {
            res.writeHead(code, { 'content-type': 'application/json' });
            res.end(JSON.stringify(obj));
        };
        if (req.method !== 'GET') { send(405, { error: 'method not allowed' }); return true; }
        findingsOnce(ctx, url.searchParams.get('issue'), ctx.deps).then((r) => send(r.status, r.body))
            .catch((e) => send(500, { error: String(e && e.message || e) }));
        return true;
    }
    if (url.pathname !== '/delegate') return false;
    return readJsonPost(req, res, (body) => delegateOnce(ctx, body, ctx.deps));
}

/**
 * worker を起こす直前に呼ぶ。答えがあれば worktree の tmp/ にファイルを書いてパスを返す
 * （AUTOPILOT_ANSWERS_FILE）。「モニターで外した」の覚えもここで消す（このあとの結果の同期は
 * worker の結果に従う）。
 * @param {number} issue
 * @param {string} cwd worktree
 * @param {object} state
 * @param {object} [deps] { fs }
 * @returns {string|null}
 */
function deliverMonitorAnswers(issue, cwd, state, deps = {}) {
    const fsx = deps.fs || fs;
    if (state.monitorReleases) delete state.monitorReleases[issue];
    const entry = state.answerStore ? state.answerStore.take(issue) : null;
    if (!entry || !(entry.records || []).length) return null;
    const dir = path.join(cwd, 'tmp');
    fsx.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, `autopilot-answers-${issue}.md`);
    fsx.writeFileSync(file, renderMonitorAnswersForPrompt(issue, entry));
    return file;
}

module.exports = {
    releaseHumanGate, delegateOnce, findingsOnce, handleDelegateHttp,
    recordHitlQuestions, proceedMonitorAnswer, deliverMonitorAnswers, createAnswerStore, handleAnswerHttp, answerOnce, MAX_BODY_BYTES };
