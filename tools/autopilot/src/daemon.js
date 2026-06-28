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
const { PHASE_BY_COMMAND, selectActionable, applyResult } = require('./phases');
const { readResultFile } = require('./contract');
const { runPhase, killSession, capture } = require('./runner');
const { MONITOR_HTML } = require('./monitor');
const project = require('./project');

const WORKTREE_BIN = path.join(project.REPO_ROOT, 'bin', 'autopilot-worktree');

function ensureWorktree(issue) {
    execFileSync(WORKTREE_BIN, ['create', String(issue)], { stdio: 'ignore' });
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
        const cwd = ensureWorktree(item.issue);
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
    const picked = selectActionable(items, { paused: state.paused, running, limit: cfg.concurrency });
    for (const item of picked) {
        // fire-and-forget（running で重複防止）
        dispatch(item, cfg, state, log);
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

module.exports = { main, tick, dispatch };
