'use strict';
/**
 * learn-tasks.js — 学び（M6 / R1）とタスク（E1）の I/O（EPIC #2384）。
 *
 * 判断は純粋関数（`learnings.js` / `tasks.js`）に置き、ここは置き場の読み書き・worker の起動・
 * GitHub（project.js 経由）・HTTP の口だけを持つ。daemon.js からは次の 3 か所だけでつなぐ:
 *  - tick の中で {@link applyDueTasks}（時刻が来たタスクを worker で実行）
 *  - startHttp の先頭で {@link handleLearnTasksHttp}（`/learnings*` と `/tasks*`）
 *  - モニターは `monitor-learn-tasks.js` の HTML / JS を埋め込む
 *
 * 状態はメモリ（`state.learnTasks`）と、gitignore された tmp/ のファイルに持つ:
 *  - 学び: `tmp/autopilot-learnings/<id>.json`（1 件 1 ファイル）と `.pr.json`（作った PR）
 *  - タスクの定義: `tools/autopilot/tasks.json`（repo 共通）+ `tmp/autopilot-tasks.local.json`（手元）
 *  - タスクの実行の記録: `tmp/autopilot-tasks-state.json`
 */

const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');
const { promisify } = require('util');

const project = require('./project');
const { readResultFile } = require('./contract');
const { sanitizeForSurface } = require('./phases');
const L = require('./learnings');
const T = require('./tasks');

const execFileP = promisify(execFile);

const TASKS_REPO_FILE = 'tools/autopilot/tasks.json';
const TASKS_LOCAL_FILE = 'tmp/autopilot-tasks.local.json';
const TASKS_STATE_FILE = 'tmp/autopilot-tasks-state.json';

/** タスクを同時にいくつ走らせるか（Issue の worker とは別に数える） */
const DEFAULT_TASK_CONCURRENCY = 1;

function rootOf(cfg) {
    return (cfg && cfg.repoRoot) || project.REPO_ROOT;
}

function readJson(file, fallback) {
    try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; }
}

function writeJson(file, obj) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const tmp = `${file}.tmp-${process.pid}`;
    fs.writeFileSync(tmp, JSON.stringify(obj, null, 2));
    fs.renameSync(tmp, file);
}

function lt(state) {
    if (!state.learnTasks) {
        state.learnTasks = {
            taskRuns: new Map(), forced: [], learningsBusy: null, lastLearningsError: null,
        };
    }
    return state.learnTasks;
}

// ---------------------------------------------------------------- 学び（置き場）

function learningsDir(root) {
    return path.join(root, L.LEARNINGS_DIR);
}

/** ためた学びを全部読む（壊れたファイルは飛ばす） */
function listLearnings(root) {
    const dir = learningsDir(root);
    let names = [];
    try { names = fs.readdirSync(dir).filter((n) => n.endsWith('.json') && !n.startsWith('.')); } catch { return []; }
    const out = [];
    for (const n of names) {
        const e = readJson(path.join(dir, n), null);
        if (e && L.validateLearning(e).ok) out.push(e);
    }
    return out.sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));
}

/**
 * 学びを 1 件ためる。指揮役（autopilot スキル）が決定ページの答えを反映したあと、
 * `POST /learnings` か `tools/autopilot/bin/autopilot-learn` で呼ぶ。
 */
function addLearning(root, input, nowMs, suffix) {
    const entry = L.newLearningEntry(input, { nowMs, suffix: suffix || Math.random().toString(36).slice(2, 8) });
    const v = L.validateLearning(entry);
    if (!v.ok) return { ok: false, errors: v.errors };
    writeJson(path.join(learningsDir(root), L.learningFileName(entry)), entry);
    return { ok: true, entry };
}

function prRecordPath(root) {
    return path.join(learningsDir(root), L.LEARNINGS_PR_FILE);
}

function readPrRecord(root) {
    return readJson(prRecordPath(root), null);
}

function removeLearnings(root, ids) {
    for (const id of ids || []) {
        try { fs.rmSync(path.join(learningsDir(root), `${id}.json`), { force: true }); } catch { /* noop */ }
    }
}

function learningsResponse(cfg, state) {
    const root = rootOf(cfg);
    const entries = listLearnings(root);
    const pr = readPrRecord(root);
    const s = lt(state);
    const plan = L.learningsPrPlan(entries, { nowMs: cfg.now(), pr, threshold: cfg.learningsThreshold });
    const action = L.learningsAction({
        plan, pr, creating: s.learningsBusy === 'create', merging: s.learningsBusy === 'merge',
    });
    return {
        count: entries.length,
        plan,
        pr,
        action,
        error: s.lastLearningsError,
        entries: entries.map((e) => ({ id: e.id, kind: e.kind, areas: e.areas, text: e.text.slice(0, 200) })),
    };
}

// ---------------------------------------------------------------- worker 共通

/**
 * Issue に結びつかない worker（タスク・学びの PR）を 1 回走らせる。
 * worktree は `bin/autopilot-worktree create <key>` で作る（Issue と同じ軽い作り方）。
 * @returns {Promise<{ok: boolean, result?: object, reason?: string, cwd?: string}>}
 */
async function runDetachedWorker(p, deps) {
    const { key, phase, skill, env, cfg, log, prepare, base } = p;
    const exec = deps.execFileP || execFileP;
    const root = rootOf(cfg);
    const bin = path.join(root, 'bin', 'autopilot-worktree');
    const args = ['create', key];
    if (base) args.push(base);
    await exec(bin, args, { cwd: root, maxBuffer: 16 * 1024 * 1024 });
    const { stdout } = await exec(bin, ['path', key], { cwd: root, encoding: 'utf8' });
    const cwd = String(stdout).trim();
    if (prepare) await prepare(cwd);
    const resultDir = path.join(cwd, 'tmp');
    fs.mkdirSync(resultDir, { recursive: true });
    const resultFile = path.join(resultDir, `autopilot-result-${key}.json`);
    const { command, promptDir } = deps.workerCommand(cfg, phase, cwd);
    const runPhase = deps.runPhase || require('./runner').runPhase;
    const res = await runPhase({
        session: `autopilot-${key}`, cwd, command, promptDir, skill, issue: 0, resultFile,
        env: { AUTOPILOT_ISSUE: '0', AUTOPILOT_PHASE: phase, AUTOPILOT_RESULT_FILE: resultFile,
            AUTOPILOT_REPO: cfg.repo, ...env },
        log: (m) => log(`${key}: ${m}`), watchdog: cfg.watchdog,
    });
    if (!res.ok) return { ok: false, reason: res.reason, cwd };
    const parsed = (deps.readResultFile || readResultFile)(resultFile);
    if (!parsed.ok) return { ok: false, reason: parsed.errors.join('; '), cwd };
    return { ok: true, result: parsed.result, cwd };
}

// ---------------------------------------------------------------- 学びの PR

/**
 * 学びを PR にする worker を起こす（モニターのボタン・`POST /learnings/pr`）。
 * worker は `docs/autopilot/learned/<area>.md` をまとめ直し、develop 宛ての PR を作る。
 * 作った PR は `.pr.json` に残し、そこに入れた学びは次の PR に数えない。
 */
async function startLearningsPr(cfg, state, log, deps = {}) {
    const s = lt(state);
    if (s.learningsBusy) return { started: false, error: 'busy' };
    const root = rootOf(cfg);
    const entries = listLearnings(root);
    const pr = readPrRecord(root);
    const plan = L.learningsPrPlan(entries, { nowMs: cfg.now(), pr, threshold: cfg.learningsThreshold });
    if (!plan.ready && !deps.force) return { started: false, error: plan.reason };
    s.learningsBusy = 'create';
    s.lastLearningsError = null;
    const stamp = new Date(cfg.now()).toISOString().replace(/[-:T]/g, '').slice(0, 12);
    const key = `learnings-${stamp}`;
    const ids = entries.map((e) => e.id);
    const run = (async () => {
        try {
            const r = await runDetachedWorker({
                key, phase: 'learnings', skill: 'autopilot-learnings', cfg, log,
                env: { AUTOPILOT_LEARNINGS_WORK_FILE: `tmp/autopilot-learnings-work.md` },
                prepare: async (cwd) => {
                    fs.mkdirSync(path.join(cwd, 'tmp'), { recursive: true });
                    fs.writeFileSync(path.join(cwd, 'tmp', 'autopilot-learnings-work.md'), L.renderLearningsWorkFile(entries));
                },
            }, deps);
            if (!r.ok) throw new Error(r.reason);
            const n = Number(r.result.pr);
            if (r.result.signal !== 'done' || !Number.isInteger(n) || n <= 0) {
                throw new Error(r.result.error || r.result.reason || 'worker did not report a PR number');
            }
            writeJson(prRecordPath(root), { number: n, ids, key, createdAt: new Date(cfg.now()).toISOString() });
            log(`learnings: PR #${n} を作りました（${ids.length} 件）`);
        } catch (e) {
            s.lastLearningsError = sanitizeForSurface(e.message || String(e), 300);
            log(`learnings: PR の作成に失敗: ${s.lastLearningsError}`);
        } finally {
            s.learningsBusy = null;
        }
    })();
    if (deps.await) await run;
    return { started: true, key, count: ids.length };
}

/**
 * 学びの PR を、CI が通っていればマージする（モニターのボタン・`POST /learnings/merge`）。
 * PR が閉じられていたら記録だけ消す（学びは残る＝次に PR にし直せる）。
 */
async function mergeLearningsPr(cfg, state, log, deps = {}) {
    const s = lt(state);
    if (s.learningsBusy) return { merged: false, error: 'busy' };
    const root = rootOf(cfg);
    const rec = readPrRecord(root);
    if (!rec || !rec.number) return { merged: false, error: '学びの PR はありません' };
    s.learningsBusy = 'merge';
    try {
        const p = deps.project || project;
        const info = await p.getPrMergeStatus(cfg.repo, rec.number, await p.readToken());
        if (info.merged || info.state === 'closed') {
            if (info.merged) removeLearnings(root, rec.ids);
            fs.rmSync(prRecordPath(root), { force: true });
            return { merged: Boolean(info.merged), cleared: true, reason: info.merged ? 'もうマージされていました' : 'PR は閉じられていました' };
        }
        const verdict = L.canMergeLearningsPr({ ...info, checks: L.summarizeChecks(info.checkRuns) });
        if (!verdict.ok) return { merged: false, reason: verdict.reason };
        // head ブランチはリポジトリの設定で自動で消える（#2385 の mergePr と同じ前提）
        await p.mergePr(cfg.repo, rec.number, await p.botToken());
        removeLearnings(root, rec.ids);
        fs.rmSync(prRecordPath(root), { force: true });
        log(`learnings: PR #${rec.number} を develop にマージしました`);
        if (rec.key) {
            const exec = deps.execFileP || execFileP;
            exec(path.join(root, 'bin', 'autopilot-worktree'), ['remove', rec.key, '--delete-branch'], { cwd: root })
                .catch(() => { /* 片付けの失敗は致命ではない */ });
        }
        return { merged: true, pr: rec.number };
    } catch (e) {
        const msg = sanitizeForSurface(e.message || String(e), 300);
        s.lastLearningsError = msg;
        return { merged: false, error: msg };
    } finally {
        s.learningsBusy = null;
    }
}

// ---------------------------------------------------------------- タスク

function loadTasks(root) {
    const repo = readJson(path.join(root, TASKS_REPO_FILE), { tasks: [] });
    const local = readJson(path.join(root, TASKS_LOCAL_FILE), { tasks: [] });
    return T.mergeTaskDefs((repo && repo.tasks) || [], (local && local.tasks) || []);
}

/** モニターで作ったタスクを手元の定義に足す（同じ id は置きかえ） */
function addLocalTask(root, task) {
    const file = path.join(root, TASKS_LOCAL_FILE);
    const cur = readJson(file, { tasks: [] }) || { tasks: [] };
    const tasks = (cur.tasks || []).filter((t) => t.id !== task.id);
    tasks.push(task);
    writeJson(file, { ...cur, tasks });
}

function loadTaskState(root) {
    return readJson(path.join(root, TASKS_STATE_FILE), {}) || {};
}

function saveTaskState(root, st) {
    writeJson(path.join(root, TASKS_STATE_FILE), st);
}

function tasksResponse(cfg, state) {
    const root = rootOf(cfg);
    const { tasks, invalid } = loadTasks(root);
    const s = lt(state);
    return {
        // まだ tick が見ていない新しい定義も「次の実行」を出せるよう、記録には書かずに種を足して見せる
        tasks: T.taskRows(tasks, T.seedTaskState(tasks, loadTaskState(root), cfg.now()).state, { running: [...s.taskRuns.keys()], forced: s.forced }),
        invalid,
    };
}

/**
 * 時刻が来たタスク・「いま実行」を押されたタスクを worker で実行する（tick から呼ぶ・fire-and-forget）。
 * pause 中は tick が先に return するので呼ばれない。
 */
async function applyDueTasks(cfg, state, log, deps = {}) {
    const root = rootOf(cfg);
    const s = lt(state);
    const { tasks, invalid } = loadTasks(root);
    for (const bad of invalid) log(`task ${bad.id}: 定義が正しくないので飛ばします（${bad.errors.join('; ')}）`);
    const seeded = T.seedTaskState(tasks, loadTaskState(root), cfg.now());
    if (seeded.changed) saveTaskState(root, seeded.state);
    const picks = T.dueTasks(tasks, seeded.state, {
        nowMs: cfg.now(), running: [...s.taskRuns.keys()], forced: s.forced,
        limit: cfg.taskConcurrency || DEFAULT_TASK_CONCURRENCY,
    });
    // 並列の計画（scheduler.js）: Issue の worker と同じ上限（全体・重い・空きメモリ）に数える。
    // 枠が無ければ始めない（「いま実行」は forced に残り、次の tick で試す）
    let allowed = picks;
    if (deps.planSlots && picks.length) {
        const ok = new Set(deps.planSlots(picks.map((pk) => ({
            issue: `task:${pk.id}`, weight: T.taskWeight(tasks.find((t) => t.id === pk.id)),
        }))));
        allowed = picks.filter((pk) => ok.has(`task:${pk.id}`));
    }
    const started = [];
    for (const pick of allowed) {
        const def = tasks.find((t) => t.id === pick.id);
        s.forced = s.forced.filter((id) => id !== pick.id);
        const p = runTask(def, pick.reason, cfg, state, log, deps);
        s.taskRuns.set(def.id, { since: cfg.now(), reason: pick.reason, session: `autopilot-task-${def.id}`, weight: T.taskWeight(def), promise: p });
        started.push(pick.id);
        if (deps.await) await p;
    }
    return started;
}

async function runTask(def, reason, cfg, state, log, deps = {}) {
    const root = rootOf(cfg);
    const s = lt(state);
    const startedAt = cfg.now();
    let outcome = 'failed';
    let summary = null;
    log(`task ${def.id}: 実行します（${reason === 'forced' ? 'いま実行' : '予定の時刻'}）`);
    try {
        const promptRel = `tmp/autopilot-task-${def.id}.md`;
        const r = await runDetachedWorker({
            key: `task-${def.id}`, phase: 'task', skill: 'autopilot-task', cfg, log,
            env: { AUTOPILOT_TASK_ID: def.id, AUTOPILOT_TASK_PROMPT_FILE: promptRel },
            prepare: async (cwd) => {
                // 何度も走る定期タスクは、変更が残っていなければ最新の develop にそろえて始める
                const exec = deps.execFileP || execFileP;
                try {
                    const { stdout } = await exec('git', ['status', '--porcelain'], { cwd, encoding: 'utf8' });
                    if (!String(stdout).trim()) {
                        await exec('git', ['fetch', '-q', 'origin', 'develop'], { cwd });
                        await exec('git', ['checkout', '-q', '--detach', 'origin/develop'], { cwd });
                    }
                } catch (e) { log(`task ${def.id}: develop へそろえられませんでした（続けます）: ${e.message}`); }
                const text = def.prompt
                    ? def.prompt
                    : fs.readFileSync(path.join(cwd, def.promptFile), 'utf8');
                fs.mkdirSync(path.join(cwd, 'tmp'), { recursive: true });
                fs.writeFileSync(path.join(cwd, promptRel), `# タスク: ${def.title}\n\n${text}\n`);
            },
        }, deps);
        if (!r.ok) throw new Error(r.reason);
        outcome = r.result.signal;
        summary = r.result.summary || r.result.reason || r.result.error || null;
    } catch (e) {
        summary = sanitizeForSurface(e.message || String(e), 300);
    } finally {
        const st = loadTaskState(root);
        st[def.id] = T.recordTaskRun(st[def.id], { def, reason, startedAt, endedAt: cfg.now(), outcome, summary });
        saveTaskState(root, st);
        s.taskRuns.delete(def.id);
        log(`task ${def.id}: ${outcome}${summary ? ` — ${summary}` : ''}`);
    }
}

/**
 * 並列の計画に数える、Issue に結びつかない実行中の worker（タスクと学びの PR）。
 * @returns {{issue: string, weight: string}[]}
 */
function runningWorkers(state) {
    const s = lt(state);
    const out = [...s.taskRuns.entries()].map(([id, r]) => ({ issue: `task:${id}`, weight: r.weight || 'light' }));
    if (s.learningsBusy === 'create') out.push({ issue: 'learnings', weight: 'light' });
    return out;
}

// ---------------------------------------------------------------- HTTP

function readBody(req, cb) {
    let raw = '';
    req.on('data', (c) => { raw += c; if (raw.length > 60_000) req.destroy(); });
    req.on('end', () => {
        let body;
        try { body = JSON.parse(raw || '{}'); } catch { return cb(null); }
        cb(body);
    });
}

/**
 * `/learnings*` と `/tasks*` を受ける。受けたら true（daemon の startHttp は先頭でこれを呼ぶ）。
 * @param {object} ctx { cfg, state, log, send, capture, deps }
 */
function handleLearnTasksHttp(req, res, url, ctx) {
    const { cfg, state, log, send } = ctx;
    const deps = ctx.deps || {};
    const p = url.pathname;
    if (!p.startsWith('/learnings') && !p.startsWith('/tasks')) return false;
    const root = rootOf(cfg);
    const fail = (e) => send(500, { error: sanitizeForSurface(e.message || String(e), 300) });
    if (req.method === 'GET' && p === '/learnings') { send(200, learningsResponse(cfg, state)); return true; }
    if (req.method === 'POST' && p === '/learnings') {
        readBody(req, (body) => {
            if (!body) return send(400, { error: 'invalid json' });
            const r = addLearning(root, body, cfg.now());
            if (!r.ok) return send(400, { error: r.errors.join('; ') });
            log(`learnings: 1 件ためました（${r.entry.kind} / ${r.entry.areas.join(',')}）`);
            return send(200, { ok: true, id: r.entry.id });
        });
        return true;
    }
    if (req.method === 'POST' && p === '/learnings/pr') {
        startLearningsPr(cfg, state, log, { ...deps, force: url.searchParams.get('force') === '1' })
            .then((r) => send(r.started ? 200 : 409, r)).catch(fail);
        return true;
    }
    if (req.method === 'POST' && p === '/learnings/merge') {
        mergeLearningsPr(cfg, state, log, deps).then((r) => send(200, r)).catch(fail);
        return true;
    }
    if (req.method === 'GET' && p === '/tasks') { send(200, tasksResponse(cfg, state)); return true; }
    if (req.method === 'POST' && p === '/tasks') {
        readBody(req, (body) => {
            if (!body) return send(400, { error: 'invalid json' });
            const r = T.taskFromInput(body, cfg.now());
            if (!r.ok) return send(400, { error: r.errors.join('; ') });
            addLocalTask(root, r.task);
            log(`task ${r.task.id}: 手元の定義に足しました（${T.scheduleLabel(r.task)}）`);
            return send(200, { ok: true, task: r.task });
        });
        return true;
    }
    if (req.method === 'POST' && p === '/tasks/run') {
        const id = url.searchParams.get('id') || '';
        const { tasks } = loadTasks(root);
        if (!tasks.some((t) => t.id === id)) { send(404, { error: 'no such task', id }); return true; }
        const s = lt(state);
        if (!s.forced.includes(id)) s.forced.push(id);
        // tick を待たずにすぐ始める（pause 中は積むだけで、再開したら走る）
        if (!state.paused && !state.booting) applyDueTasks(cfg, state, log, deps).catch((e) => log(`task run error: ${e.message}`));
        send(200, { queued: id });
        return true;
    }
    if (req.method === 'GET' && p === '/tasks/log') {
        const id = url.searchParams.get('id') || '';
        const r = lt(state).taskRuns.get(id);
        res.writeHead(r ? 200 : 404, { 'content-type': 'text/plain; charset=utf-8' });
        res.end(r && ctx.capture ? ctx.capture(r.session) : `タスク ${id} は実行中ではありません`);
        return true;
    }
    return false;
}

module.exports = {
    TASKS_REPO_FILE,
    TASKS_LOCAL_FILE,
    TASKS_STATE_FILE,
    listLearnings,
    addLearning,
    readPrRecord,
    learningsResponse,
    startLearningsPr,
    mergeLearningsPr,
    loadTasks,
    addLocalTask,
    loadTaskState,
    tasksResponse,
    applyDueTasks,
    runTask,
    runDetachedWorker,
    runningWorkers,
    handleLearnTasksHttp,
};
