'use strict';
/**
 * daemon.js — autopilot 常駐デーモン。
 *
 * Project をポーリングし、着手可能な item を並行上限内で拾って Claude runner に
 * ディスパッチし、結果を Project に反映する。HTTP で pause/resume/force-stop/inject/status を提供。
 *
 * 設計: Project が状態の単一の真実。スキルは結果ファイルで意図を伝え、daemon が Project を書く
 * （単一ライター）。フェーズ選択・着手判定は phases.js の純粋関数を使う。
 */

const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const { setTimeout: sleep } = require('timers/promises');
const {
    PHASE_BY_COMMAND,
    DEFAULT_BASE_BRANCH,
    parseBaseBranch,
    selectActionable,
    isStuckCandidate,
    applyResult,
    hitlDesireFromResult,
    selectMergeCandidates,
    mergeProgressionIntents,
    selectPrSyncCandidates,
    labelActions,
    draftAction,
    renderSticky,
    applyIntentsToItem,
    needsDodHandoff,
    hasDodHandoffComment,
    extractPreviewUrl,
    extractDodChecklist,
    dodHandoffBody,
} = require('./phases');
const { readResultFile } = require('./contract');
const { runPhase, killSession, capture } = require('./runner');
const { MONITOR_HTML } = require('./monitor');
const project = require('./project');

const WORKTREE_BIN = path.join(project.REPO_ROOT, 'bin', 'autopilot-worktree');

/** 既存 PR ブランチで作業するフェーズ（新ブランチを切らず PR ヘッドを checkout する） */
const PR_BRANCH_PHASES = new Set(['review', 'address-review', 'verify']);

function ensureWorktree(issue, pr, base) {
    const args = ['create', String(issue)];
    // base が明示されていれば新ブランチをそこから分岐（EPIC サブ Issue 等）。既定は develop。
    if (base && base !== DEFAULT_BASE_BRANCH) args.push(base);
    // address-review / verify 等は既存 PR ブランチで作業する（新ブランチを切らない）
    if (pr) args.push('--pr', String(pr));
    execFileSync(WORKTREE_BIN, args, { stdio: 'ignore' });
    return execFileSync(WORKTREE_BIN, ['path', String(issue)], { encoding: 'utf8' }).trim();
}

// In Progress + AI 作業中のまま run が無くなってから Blocked にするまでの猶予（#816）。
// 1 回の run の最大時間（watchdog tMaxMs=30分）より長くして、生きている run を誤って
// 止めない。daemon 再起動後はこの daemon が初めて観測した時刻から測り直す（保守的）。
const DEFAULT_STUCK_MS = 35 * 60 * 1000;

/**
 * item を Blocked にして人間へハンドオフする（Status=Blocked + 🙋 ラベル + 説明コメント）。
 * dispatch の run 失敗と tick の stuck 検知の両方から使う（#813/#816）。
 * @param {object} item Project item
 * @param {string|null} body 投稿する bot コメント本文（null ならコメントしない）
 */
function markBlocked(item, body, cfg, log, deps = {}) {
    const token = deps.token || project.botToken();
    const findItemId = deps.findItemId || project.findItemId;
    const setField = deps.setField || project.setField;
    const postIssueComment = deps.postIssueComment || project.postIssueComment;
    const syncFaces = deps.syncFaces || ((it) => syncFacesAfterIntents(it, [], cfg, log));
    const ctx = { projectId: cfg.projectId, fields: cfg.fields };
    const itemId = item.itemId || findItemId(cfg.owner, cfg.project, item.issue, token);
    try { setField(ctx, itemId, 'Status', 'Blocked', token); }
    catch (e) { log(`#${item.issue}: mark Status failed: ${e.message}`); }
    if (body) {
        try { postIssueComment(cfg.repo, item.issue, body, token); }
        catch (e) { log(`#${item.issue}: block comment failed: ${e.message}`); }
    }
    syncFaces({ ...item, status: 'Blocked', hitlLabel: true });
}

/** run 失敗時の Blocked コメント本文（#816） */
function failureBlockBody(skill, issue, reason) {
    return (
        `🤖 autopilot: \`${skill}\` フェーズの run が完了できなかったため **Blocked** にしました。\n\n` +
        `**理由**: ${reason}\n\n` +
        `**人間の対応**: ログ（\`/log?issue=${issue}\`）と worktree を確認し、原因を取り除いた上で ` +
        'Status を戻す（例: Sprint Backlog で再実装、Review で再開）か、不要なら Icebox / Close に ' +
        'してください。準備ができたら `🙋 HITL` を外すと autopilot が再開します。'
    );
}

/** stuck 検知時の Blocked コメント本文（#816） */
function stuckBlockBody(item, stuckMinutes) {
    return (
        `🤖 autopilot: Status が **In Progress** / AI Status=\`${item.aiStatus}\` のまま約 ` +
        `${stuckMinutes} 分進行が止まっていました（run が見当たりません。daemon 再起動や run の異常終了が原因）。` +
        '安全のため **Blocked** にしました。\n\n' +
        `**人間の対応**: ログ（\`/log?issue=${item.issue}\`）と worktree を確認し、再実装するなら ` +
        'Sprint Backlog へ、続きから再開するなら Review へ Status を戻してください。' +
        '準備ができたら `🙋 HITL` を外すと autopilot が再開します。'
    );
}

/**
 * In Progress + AI 作業中のまま run が無く、一定時間動かない item を検知して Blocked にする（#816）。
 * 観測した時刻を state.stuckSince に記録し、DEFAULT_STUCK_MS を超えたら markBlocked。
 * 候補でなくなった（status が進んだ等）issue は追跡から外す。
 */
function detectStuck(items, cfg, state, log, deps = {}) {
    const now = cfg.now();
    const stuckMs = cfg.stuckMs || DEFAULT_STUCK_MS;
    if (!state.stuckSince) state.stuckSince = new Map();
    const seen = state.stuckSince;
    const live = new Set();
    for (const item of items) {
        if (!isStuckCandidate(item)) continue;
        if (state.running.has(item.issue)) continue; // この daemon が実行中の run を所有
        live.add(item.issue);
        if (!seen.has(item.issue)) { seen.set(item.issue, now); continue; }
        const elapsed = now - seen.get(item.issue);
        if (elapsed >= stuckMs) {
            const minutes = Math.round(elapsed / 60000);
            log(`#${item.issue}: stuck at In Progress/${item.aiStatus} for ${minutes}min -> Blocked`);
            seen.delete(item.issue);
            try { markBlocked(item, stuckBlockBody(item, minutes), cfg, log, deps); }
            catch (e) { log(`#${item.issue}: stuck block failed: ${e.message}`); }
        }
    }
    for (const issue of [...seen.keys()]) if (!live.has(issue)) seen.delete(issue);
}

/** 1 つの item を 1 フェーズ実行し、結果を Project に反映する */
async function dispatch(item, cfg, state, log) {
    const phase = item.phase;
    const meta = PHASE_BY_COMMAND[phase];
    if (!meta) return;
    const session = `autopilot-${phase}-${item.issue}`;
    state.running.set(item.issue, { phase, session, since: cfg.now() });
    const ctx = { projectId: cfg.projectId, fields: cfg.fields };
    const itemId = item.itemId || project.findItemId(cfg.owner, cfg.project, item.issue, project.botToken());
    item.itemId = itemId; // markBlocked が再解決しないよう保持
    const mark = (field, value) => {
        try { project.setField(ctx, itemId, field, value, project.botToken()); }
        catch (e) { log(`#${item.issue}: mark ${field} failed: ${e.message}`); }
    };
    // ブロック時の人間ハンドオフ（#813/#816）: run が失敗・stall したとき、コメント無しで 🙋 だけ
    // 付くと人間が状況を把握できない（#815 の発端）。必ず説明コメントを残して Blocked にする。
    const blockToHuman = (reason) =>
        markBlocked(item, reason ? failureBlockBody(meta.skill, item.issue, reason) : null, cfg, log);
    try {
        // 着手を即可視化（Issue を状態の正に）: In Progress + AI Status=xxxing
        mark('Status', 'In Progress');
        mark('AI Status', meta.aiStatus);
        // PR ブランチで作業するフェーズは PR 番号を解決（inject 経由など item.pr 未設定時はここで取得）
        let pr;
        if (PR_BRANCH_PHASES.has(phase)) {
            pr = item.pr || (project.findPrForIssue(cfg.repo, item.issue, project.botToken()) || {}).number;
        }
        // 新ブランチを切るフェーズ（implement）は Issue 本文の base 宣言を尊重する（#827・EPIC サブ）。
        // 既定は develop。PR ブランチ作業フェーズは PR の base を継ぐので解決不要。
        let baseBranch = DEFAULT_BASE_BRANCH;
        if (!pr) {
            try {
                const declared = parseBaseBranch(project.getIssueBody(cfg.repo, item.issue, project.botToken()));
                if (declared) { baseBranch = declared; log(`#${item.issue}: base branch = ${baseBranch} (declared)`); }
            } catch (e) { log(`#${item.issue}: base parse failed: ${e.message}`); }
        }
        const cwd = ensureWorktree(item.issue, pr, baseBranch);
        const resultDir = path.join(cwd, 'tmp');
        fs.mkdirSync(resultDir, { recursive: true });
        const resultFile = path.join(resultDir, `autopilot-result-${item.issue}.json`);
        const env = {
            AUTOPILOT_ISSUE: String(item.issue),
            AUTOPILOT_PHASE: phase,
            AUTOPILOT_RESULT_FILE: resultFile,
            AUTOPILOT_PROJECT: String(cfg.project),
            AUTOPILOT_REPO: cfg.repo,
            AUTOPILOT_BASE_BRANCH: baseBranch,
        };
        log(`#${item.issue}: run ${phase} (${meta.skill})`);
        const res = await runPhase({ session, cwd, env, skill: meta.skill, issue: item.issue, resultFile, log });
        if (!res.ok) {
            log(`#${item.issue}: runner failed (${res.reason})`);
            blockToHuman(`run（${meta.skill}）が失敗・停止しました（watchdog: ${res.reason}）。`);
            return;
        }
        const parsed = readResultFile(resultFile);
        if (!parsed.ok) {
            log(`#${item.issue}: invalid result (${parsed.errors.join('; ')})`);
            blockToHuman(`run は終了しましたが結果ファイルが不正でした: ${parsed.errors.join('; ')}`);
            return;
        }
        const intents = applyResult(parsed.result);
        const applied = project.applyIntents(ctx, itemId, intents, project.botToken());
        log(`#${item.issue}: ${parsed.result.signal} — applied: ${applied.join(', ')}`);
        // 権威的な面同期（contract §7）: 🙋/🤖 ラベル・Draft・sticky を Project 状態 + HITL 希望へ合わせる。
        // HITL は Project フィールドではなくラベルなので、結果から導いた希望を hitlLabel として渡す（#813）。
        const wantHitl = hitlDesireFromResult(parsed.result);
        syncFacesAfterIntents({ ...item, hitlLabel: wantHitl }, intents, cfg, log);
    } catch (e) {
        log(`#${item.issue}: error ${e.message}`);
        blockToHuman(`dispatch が例外で停止しました: ${e.message}`);
    } finally {
        state.running.delete(item.issue);
    }
}

/**
 * 人間ゲート状態（Review / DoD）かつ未実行の item について PR レビュー状態 + HITL 解除シグナルを
 * 集める。これを phaseForItem の ctx として渡すと、人間が HITL を解除した item を address-review に
 * 振り分けできる（#792/#821: DoD NG 差し戻しも OR セマンティクスで解除できる）。
 * I/O はここに閉じ込め、判定は phases.js の純粋関数。
 * @returns {object} issue 番号 → { review, hitlSignals, pr } の map
 */
function collectReviewContexts(cfg, items, running, log) {
    const contexts = {};
    const token = project.botToken();
    for (const item of items) {
        if (item.status !== 'Review' && item.status !== 'DoD') continue;
        if (running.has(item.issue)) continue;
        try {
            const ctx = project.getReviewContext(cfg.repo, item.issue, token);
            if (ctx) contexts[item.issue] = ctx;
        } catch (e) {
            log(`#${item.issue}: review context error ${e.message}`);
        }
    }
    return contexts;
}

/**
 * merge-progression: 連携 PR が人間に merge された leaf を Close へ前進させる。
 * autopilot は自動 merge しない（人間の手動 merge を検知して後処理するだけ）。
 * 判定は phases.js の純粋関数、GitHub 問い合わせ・Project 書き込みは project.js。
 * deps は injection できる（テスト用）。実行中の item は触らない（live phase と競合しない）。
 */
function applyMergeProgression(items, cfg, state, log, deps = {}) {
    const token = deps.token || project.botToken();
    const hasMerged = deps.hasMergedPullRequest || project.hasMergedPullRequest;
    const applyIntents = deps.applyIntents || project.applyIntents;
    const findItemId = deps.findItemId || project.findItemId;
    // merge 後の面正規化（Issue の HITL ラベルを落とす等）。テストは no-op を注入できる。
    const syncFaces = deps.syncFaces || ((item, intents) => syncFacesAfterIntents(item, intents, cfg, log));
    const ctx = { projectId: cfg.projectId, fields: cfg.fields };
    for (const item of selectMergeCandidates(items)) {
        if (state.running.has(item.issue)) continue; // live phase が所有中は触らない
        let merged;
        try {
            merged = hasMerged(cfg.repo, item.issue, token);
        } catch (e) {
            log(`#${item.issue}: merge check failed: ${e.message}`);
            continue;
        }
        const intents = mergeProgressionIntents(item, merged);
        if (!intents.length) continue;
        const itemId = item.itemId || findItemId(cfg.owner, cfg.project, item.issue, token);
        try {
            const applied = applyIntents(ctx, itemId, intents, token);
            log(`#${item.issue}: PR merged → ${applied.join(', ')}`);
            // merge は前進シグナル → 人間の番は解除。🙋 ラベルを両面から落とす（force 同期・#813）。
            syncFaces({ ...item, hitlLabel: false }, intents);
        } catch (e) {
            log(`#${item.issue}: merge progression failed: ${e.message}`);
        }
    }
}

/**
 * DoD 引き継ぎ生成（#821）: Status=DoD の leaf について、連携 PR に headful 検証手順の引き継ぎ
 * コメント（`autopilot:dod-handoff` マーカー付き）を **1 回だけ** 投稿する。コンテナ内 daemon は
 * headless で実ブラウザ確認ができないため、ホスト側 Claude（headful Playwright）に渡す文面を
 * テンプレート生成する（child Claude を起動せず純粋な I/O + 文字列テンプレートで完結）。
 *
 * - プレビュー URL は PR の CI コメントから拾う（無ければフォールバック文言）。
 * - DoD チェックリストは Issue 本文から転記する（無ければフォールバック文言）。
 * - 冪等: 既に引き継ぎコメントがあれば再投稿しない（`hasDodHandoffComment`）。
 * - 🙋 HITL はそのまま維持（ホスト/人間の番）。sticky の DoD ポインタは renderSticky が出す。
 * - 実行中（run が所有する）item は触らない。1 件の失敗は他を止めない。
 * deps は injection 可能（テスト用）。
 */
function applyDodHandoffs(items, cfg, state, log, deps = {}) {
    const token = deps.token || project.botToken();
    const findPrForIssue = deps.findPrForIssue || project.findPrForIssue;
    const listIssueComments = deps.listIssueComments || project.listIssueComments;
    const getIssueBody = deps.getIssueBody || project.getIssueBody;
    const postIssueComment = deps.postIssueComment || project.postIssueComment;
    for (const item of items) {
        if (!item || item.kind === 'EPIC' || item.status !== 'DoD') continue;
        if (state.running.has(item.issue)) continue; // live phase が所有中は触らない
        try {
            const pr = findPrForIssue(cfg.repo, item.issue, token);
            const prComments = pr ? listIssueComments(cfg.repo, pr.number, token) : [];
            const ctx = { hasHandoffComment: hasDodHandoffComment(prComments), hasPr: Boolean(pr) };
            if (!needsDodHandoff(item, ctx)) continue;
            const previewUrl = extractPreviewUrl(prComments);
            const dodChecklist = extractDodChecklist(getIssueBody(cfg.repo, item.issue, token));
            const body = dodHandoffBody({
                issue: item.issue,
                pr: pr.number,
                repo: cfg.repo,
                branch: pr.branch,
                previewUrl,
                dodChecklist,
            });
            postIssueComment(cfg.repo, pr.number, body, token);
            log(`#${item.issue}: posted DoD handoff on PR #${pr.number}`);
        } catch (e) {
            log(`#${item.issue}: DoD handoff failed: ${e.message}`);
        }
    }
}

/**
 * Issue/PR の面（🙋 HITL / 🤖 autopilot ラベル・Draft/Ready・sticky コメント）を Project 状態へ
 * 同期する（contract §7 の投影）。判定は phases.js の純粋関数、書き込みはここ（単一ライター）。
 * deps は injection 可能（テスト用）。force=true は権威的な遷移（Review への handoff 等）で、
 * Review でも HITL ラベルを明示的に付与する。
 * @param {object} item Project item（status/aiStatus/hitlLabel/size/kind を含む）
 * @param {object} io 束ねた I/O（token + project 関数群）
 * @param {object} cfg
 * @param {function} log
 * @param {object} [opts] { force }
 */
function syncFacesForItem(item, io, cfg, log, opts = {}) {
    // 1) Issue 側のラベル（PR が無くても投影する。HITL handoff を可視化）
    const issueLabels = io.getIssueLabels(cfg.repo, item.issue, io.token);
    io.editLabels(cfg.repo, item.issue, 'issue', labelActions(item, issueLabels, opts), io.token);
    // 2) 連携 PR の面（ラベル・Draft/Ready・sticky）
    const pr = io.findPrForIssue(cfg.repo, item.issue, io.token);
    if (!pr) return;
    const info = io.getPrInfo(cfg.repo, pr.number, io.token);
    io.editLabels(cfg.repo, pr.number, 'pr', labelActions(item, info.labels, opts), io.token);
    const da = draftAction(info.isDraft, item);
    if (da) io.setPrDraft(cfg.repo, pr.number, da, io.token);
    io.upsertStickyComment(cfg.repo, pr.number, renderSticky(item), io.token);
}

/** project.js 実関数を束ねた I/O オブジェクトを返す（deps 差し替えがあれば優先） */
function projectionIo(deps = {}) {
    return {
        token: deps.token || project.botToken(),
        findPrForIssue: deps.findPrForIssue || project.findPrForIssue,
        getPrInfo: deps.getPrInfo || project.getPrInfo,
        getIssueLabels: deps.getIssueLabels || project.getIssueLabels,
        editLabels: deps.editLabels || project.editLabels,
        setPrDraft: deps.setPrDraft || project.setPrDraft,
        upsertStickyComment: deps.upsertStickyComment || project.upsertStickyComment,
    };
}

/**
 * per-tick の面投影: PR を持ちうる item の面を Project 状態へ揃える（contract §7）。
 * 実行中の item は live phase が所有するので触らない。1 件の失敗は他を止めない。
 * deps.force を渡すと全件 force 同期（通常は per-tick=非 force）。
 */
function applyPrProjection(items, cfg, state, log, deps = {}) {
    const io = projectionIo(deps);
    const opts = { force: Boolean(deps.force) };
    for (const item of selectPrSyncCandidates(items)) {
        if (state.running.has(item.issue)) continue; // live phase が所有中は触らない
        try {
            syncFacesForItem(item, io, cfg, log, opts);
        } catch (e) {
            log(`#${item.issue}: pr projection failed: ${e.message}`);
        }
    }
}

/**
 * フェーズ適用後・merge 前進後の権威的な面同期（force）。結果の意図を item に反映してから
 * 投影する。PR が無ければ Issue ラベルのみ。失敗は warn に留める（Project 反映は別途済み）。
 */
function syncFacesAfterIntents(item, intents, cfg, log) {
    try {
        const projected = applyIntentsToItem(item, intents);
        syncFacesForItem(projected, projectionIo(), cfg, log, { force: true });
    } catch (e) {
        log(`#${item.issue}: face sync failed: ${e.message}`);
    }
}

/**
 * 1 ポーリングサイクル。
 * @returns {{paused: boolean, picked: number[]}} このサイクルの要約
 *   - paused: pause 中で早期 return した（no-op）か
 *   - picked: このサイクルで dispatch を起動した issue 番号（並行上限内の actionable）
 */
async function tick(cfg, state, log) {
    if (state.paused) return { paused: true, picked: [] };
    let items;
    try {
        items = project.listItems(cfg.owner, cfg.project, project.botToken());
    } catch (e) {
        log(`poll error: ${e.message}`);
        return { paused: false, picked: [] };
    }
    const running = new Set(state.running.keys());
    const contexts = collectReviewContexts(cfg, items, running, log);
    const picked = selectActionable(items, { paused: state.paused, running, limit: cfg.concurrency, contexts });
    for (const item of picked) {
        // fire-and-forget（running で重複防止）
        dispatch(item, cfg, state, log);
    }
    // 人間が手動 merge した leaf を Close へ前進（自動 merge はしない）
    applyMergeProgression(items, cfg, state, log);
    // In Progress + AI 作業中のまま止まった item を検知して Blocked へ（#816）
    detectStuck(items, cfg, state, log);
    // Status=DoD の leaf に headful 検証の引き継ぎコメントを 1 回だけ投稿（#821・冪等）
    applyDodHandoffs(items, cfg, state, log);
    // PR/Issue の面（ラベル/Draft/sticky）を Project 状態へ投影（dispatch 後なので running は除外される）
    applyPrProjection(items, cfg, state, log);
    return { paused: false, picked: picked.map((it) => it.issue) };
}

/**
 * tick を1回だけ実行する（再入防止つき）。HTTP `POST /tick` と interval ループの両方から使い、
 * 手動 tick と定期 tick が重ならないようにする。実行中（state.ticking）なら tick を呼ばず busy を返す。
 * @param {object} cfg
 * @param {object} state running/paused/ticking を持つ可変状態
 * @param {function} log
 * @param {object} [deps] テスト用に tick を差し替え可能
 * @returns {Promise<object>} `{ran:false, busy:true}`（実行中）または `{ran:true, ...summary, running:number[]}`
 */
async function runTickOnce(cfg, state, log, deps = {}) {
    const tickFn = deps.tick || tick;
    if (state.ticking) return { ran: false, busy: true };
    state.ticking = true;
    try {
        const summary = await tickFn(cfg, state, log);
        return { ran: true, ...summary, running: [...state.running.keys()] };
    } finally {
        state.ticking = false;
    }
}

/** HTTP 制御サーバ（pause/resume/stop/inject/status） */
function startHttp(cfg, state, log) {
    const server = http.createServer((req, res) => {
        const url = new URL(req.url, 'http://localhost');
        const send = (code, obj) => {
            res.writeHead(code, { 'content-type': 'application/json' });
            res.end(JSON.stringify(obj));
        };
        if (req.method === 'GET' && (url.pathname === '/' || url.pathname === '/index.html')) {
            res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
            return res.end(MONITOR_HTML);
        }
        if (req.method === 'GET' && url.pathname === '/log') {
            const issue = Number(url.searchParams.get('issue'));
            const r = state.running.get(issue);
            res.writeHead(r ? 200 : 404, { 'content-type': 'text/plain; charset=utf-8' });
            return res.end(r ? capture(r.session) : `#${issue} は実行中ではありません`);
        }
        if (req.method === 'GET' && url.pathname === '/status') {
            return send(200, {
                paused: state.paused,
                concurrency: cfg.concurrency,
                running: [...state.running.entries()].map(([issue, v]) => ({ issue, phase: v.phase })),
            });
        }
        if (req.method === 'POST' && url.pathname === '/tick') {
            // 即時 tick: interval を待たずに 1 サイクル実行する（Web モニタの「今すぐ確認」）。
            // 再入防止つき。実行中なら 409 busy。pause 中は tick が早期 return し no-op（paused:true で返る）。
            runTickOnce(cfg, state, log)
                .then((result) => {
                    if (result.busy) return send(409, { ran: false, busy: true, error: 'tick already running' });
                    send(200, result);
                })
                .catch((e) => { log(`tick error: ${e.message}`); send(500, { error: e.message }); });
            return;
        }
        if (req.method === 'POST' && url.pathname === '/pause') { state.paused = true; log('paused'); return send(200, { paused: true }); }
        if (req.method === 'POST' && url.pathname === '/resume') { state.paused = false; log('resumed'); return send(200, { paused: false }); }
        if (req.method === 'POST' && url.pathname === '/stop') {
            const issue = Number(url.searchParams.get('issue'));
            const r = state.running.get(issue);
            if (r) { killSession(r.session); state.running.delete(issue); log(`force-stopped #${issue}`); return send(200, { stopped: issue }); }
            return send(404, { error: 'not running', issue });
        }
        if (req.method === 'POST' && url.pathname === '/inject') {
            // 割り込み投入: 並行上限を超えてよい
            const issue = Number(url.searchParams.get('issue'));
            const phase = url.searchParams.get('phase');
            if (!issue || !PHASE_BY_COMMAND[phase]) return send(400, { error: 'issue and valid phase required' });
            if (state.running.has(issue)) return send(409, { error: 'already running', issue });
            dispatch({ issue, phase }, cfg, state, log);
            log(`injected #${issue} (${phase})`);
            return send(202, { injected: issue, phase });
        }
        if (req.method === 'POST' && url.pathname === '/shutdown') {
            // 安全停止: pkill -f は自己 kill するため使わず、この HTTP か PID ファイルで止める
            log('shutdown requested');
            send(200, { shutdown: true });
            setTimeout(() => process.exit(0), 100);
            return;
        }
        send(404, { error: 'not found' });
    });
    server.listen(cfg.port, () => log(`control server on :${cfg.port}`));
    return server;
}

/** PID ファイルのパス（停止スクリプトが参照） */
function pidFilePath() {
    return path.join(os.tmpdir(), 'autopilot-daemon.pid');
}

/** デーモン起動 */
async function main(opts = {}) {
    const log = opts.log || ((m) => process.stderr.write(`[autopilot-daemon] ${m}\n`));
    const token = project.botToken();
    const proj = project.getProject(opts.owner || 'smalruby', opts.project || 4, token);
    const cfg = {
        owner: opts.owner || 'smalruby',
        project: opts.project || 4,
        repo: opts.repo || 'smalruby/smalruby3-editor',
        concurrency: opts.concurrency || 2,
        // 既定 5 分（単位は秒で CLI 指定 → ms）。実運用で 20 秒等の高頻度ポーリングは API を無駄に叩く。
        intervalMs: opts.intervalMs || 300_000,
        port: opts.port || 8787,
        projectId: proj.id,
        fields: project.getFields(opts.owner || 'smalruby', opts.project || 4, token),
        now: () => Date.now(),
    };
    const state = { paused: false, running: new Map(), ticking: false };
    // PID ファイルを書き、安全停止（kill "$(cat <pidfile>)" / POST /shutdown）を可能にする
    try {
        fs.writeFileSync(pidFilePath(), String(process.pid));
        const cleanup = () => { try { fs.rmSync(pidFilePath(), { force: true }); } catch { /* noop */ } };
        process.on('exit', cleanup);
        process.on('SIGTERM', () => process.exit(0));
        process.on('SIGINT', () => process.exit(0));
    } catch (e) { log(`pid file warn: ${e.message}`); }
    startHttp(cfg, state, log);
    log(`daemon up: project #${cfg.project}, concurrency ${cfg.concurrency}, interval ${cfg.intervalMs}ms, pid ${process.pid} (${pidFilePath()})`);
    /* eslint-disable no-constant-condition */
    while (!opts.once) {
        // runTickOnce 経由にして、定期 tick と手動 POST /tick が重ならないようにする（再入防止）
        await runTickOnce(cfg, state, log);
        await sleep(cfg.intervalMs);
    }
    if (opts.once) await runTickOnce(cfg, state, log);
}

module.exports = {
    main, tick, runTickOnce, dispatch, applyMergeProgression, applyPrProjection,
    applyDodHandoffs, detectStuck, markBlocked,
};
