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
    selectActionable,
    applyResult,
    selectMergeCandidates,
    mergeProgressionIntents,
} = require('./phases');
const { readResultFile } = require('./contract');
const { runPhase, killSession, capture } = require('./runner');
const { MONITOR_HTML } = require('./monitor');
const project = require('./project');

const WORKTREE_BIN = path.join(project.REPO_ROOT, 'bin', 'autopilot-worktree');

/** 既存 PR ブランチで作業するフェーズ（新ブランチを切らず PR ヘッドを checkout する） */
const PR_BRANCH_PHASES = new Set(['review', 'address-review', 'verify']);

function ensureWorktree(issue, pr) {
    const args = ['create', String(issue)];
    // address-review / verify 等は既存 PR ブランチで作業する（新ブランチを切らない）
    if (pr) args.push('--pr', String(pr));
    execFileSync(WORKTREE_BIN, args, { stdio: 'ignore' });
    return execFileSync(WORKTREE_BIN, ['path', String(issue)], { encoding: 'utf8' }).trim();
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
    const mark = (field, value) => {
        try { project.setField(ctx, itemId, field, value, project.botToken()); }
        catch (e) { log(`#${item.issue}: mark ${field} failed: ${e.message}`); }
    };
    try {
        // 着手を即可視化（Issue を状態の正に）: In Progress + AI Status=xxxing
        mark('Status', 'In Progress');
        mark('AI Status', meta.aiStatus);
        // PR ブランチで作業するフェーズは PR 番号を解決（inject 経由など item.pr 未設定時はここで取得）
        let pr;
        if (PR_BRANCH_PHASES.has(phase)) {
            pr = item.pr || (project.findPrForIssue(cfg.repo, item.issue, project.botToken()) || {}).number;
        }
        const cwd = ensureWorktree(item.issue, pr);
        const resultDir = path.join(cwd, 'tmp');
        fs.mkdirSync(resultDir, { recursive: true });
        const resultFile = path.join(resultDir, `autopilot-result-${item.issue}.json`);
        const env = {
            AUTOPILOT_ISSUE: String(item.issue),
            AUTOPILOT_PHASE: phase,
            AUTOPILOT_RESULT_FILE: resultFile,
            AUTOPILOT_PROJECT: String(cfg.project),
            AUTOPILOT_REPO: cfg.repo,
        };
        log(`#${item.issue}: run ${phase} (${meta.skill})`);
        const res = await runPhase({ session, cwd, env, skill: meta.skill, issue: item.issue, resultFile, log });
        if (!res.ok) {
            log(`#${item.issue}: runner failed (${res.reason})`);
            mark('Status', 'Blocked'); mark('HITL', 'Yes');
            return;
        }
        const parsed = readResultFile(resultFile);
        if (!parsed.ok) {
            log(`#${item.issue}: invalid result (${parsed.errors.join('; ')})`);
            mark('Status', 'Blocked'); mark('HITL', 'Yes');
            return;
        }
        const applied = project.applyIntents(ctx, itemId, applyResult(parsed.result), project.botToken());
        log(`#${item.issue}: ${parsed.result.signal} — applied: ${applied.join(', ')}`);
    } catch (e) {
        log(`#${item.issue}: error ${e.message}`);
        mark('Status', 'Blocked'); mark('HITL', 'Yes');
    } finally {
        state.running.delete(item.issue);
    }
}

/**
 * Review 状態かつ未実行の item について PR レビュー状態 + HITL 解除シグナルを集める。
 * これを phaseForItem の ctx として渡すと、人間が HITL を解除した Review item を
 * address-review / verify に振り分けできる（#792）。I/O はここに閉じ込め、判定は phases.js の純粋関数。
 * @returns {object} issue 番号 → { review, hitlSignals, pr } の map
 */
function collectReviewContexts(cfg, items, running, log) {
    const contexts = {};
    const token = project.botToken();
    for (const item of items) {
        if (item.status !== 'Review') continue;
        if (running.has(item.issue)) continue;
        try {
            const ctx = project.getReviewContext(cfg.repo, item.issue, item.hitl, token);
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
        } catch (e) {
            log(`#${item.issue}: merge progression failed: ${e.message}`);
        }
    }
}

/** 1 ポーリングサイクル */
async function tick(cfg, state, log) {
    if (state.paused) return;
    let items;
    try {
        items = project.listItems(cfg.owner, cfg.project, project.botToken());
    } catch (e) {
        log(`poll error: ${e.message}`);
        return;
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
    const state = { paused: false, running: new Map() };
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
        await tick(cfg, state, log);
        await sleep(cfg.intervalMs);
    }
    if (opts.once) await tick(cfg, state, log);
}

module.exports = { main, tick, dispatch, applyMergeProgression };
