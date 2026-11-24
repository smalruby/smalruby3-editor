'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const LT = require('../src/learn-tasks');

function setup() {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ap-learn-tasks-'));
    const wt = path.join(root, 'wt');
    fs.mkdirSync(wt, { recursive: true });
    let now = Date.parse('2026-11-26T03:00:00Z');
    const cfg = { repoRoot: root, repo: 'o/r', now: () => now, watchdog: {} };
    const calls = [];
    const deps = {
        await: true,
        execFileP: async (cmd, args) => { calls.push([path.basename(cmd), ...args]); return { stdout: args[0] === 'path' ? wt : '' }; },
        workerCommand: () => ({ command: 'fake', promptDir: '/p' }),
        runPhase: async (o) => {
            calls.push(['runPhase', o.session, o.skill, o.env.AUTOPILOT_PHASE]);
            fs.writeFileSync(o.resultFile, JSON.stringify(deps.result));
            return { ok: true };
        },
        result: { issue: 0, phase: 'task', signal: 'done', summary: 'ok', hitl: false },
    };
    return { root, wt, cfg, deps, calls, setNow: (v) => { now = v; } };
}
const log = () => {};

test('タスク: once はすぐ 1 回だけ走り、記録が残る', async () => {
    const { root, wt, cfg, deps, calls } = setup();
    fs.mkdirSync(path.join(root, 'tools/autopilot'), { recursive: true });
    fs.writeFileSync(path.join(root, LT.TASKS_REPO_FILE), JSON.stringify({ tasks: [
        { id: 'now', title: 'いま', prompt: 'hello', schedule: { type: 'once' } },
        { id: 'cron', title: '定期', prompt: 'x', schedule: { type: 'cron', cron: '0 9 * * *' } },
    ] }));
    const state = {};
    assert.deepEqual(await LT.applyDueTasks(cfg, state, log, deps), ['now']);
    assert.ok(calls.some((c) => c[0] === 'runPhase' && c[1] === 'autopilot-task-now' && c[2] === 'autopilot-task'));
    assert.match(fs.readFileSync(path.join(wt, 'tmp/autopilot-task-now.md'), 'utf8'), /hello/);
    const st = LT.loadTaskState(root);
    assert.equal(st.now.lastOutcome, 'done');
    assert.equal(st.now.lastRunAt, cfg.now());
    assert.ok(st.cron.firstSeenAt);
    assert.deepEqual(await LT.applyDueTasks(cfg, state, log, deps), []);
    const rows = LT.tasksResponse(cfg, state).tasks;
    assert.equal(rows.find((r) => r.id === 'now').nextRunAt, null);
});

test('タスク: モニターで作った定義は手元のファイルに入る', () => {
    const { root } = setup();
    LT.addLocalTask(root, { id: 'a', title: 'a', prompt: 'p', schedule: { type: 'once' } });
    LT.addLocalTask(root, { id: 'a', title: 'b', prompt: 'p', schedule: { type: 'once' } });
    const { tasks } = LT.loadTasks(root);
    assert.deepEqual(tasks.map((t) => [t.id, t.title, t.source]), [['a', 'b', 'local']]);
});

test('学び: ためる → PR を作る → CI が通ったらマージして片付ける', async () => {
    const { root, cfg, deps, calls } = setup();
    cfg.learningsThreshold = 2;
    assert.ok(LT.addLearning(root, { kind: 'intent', areas: ['autopilot'], text: 'A' }, cfg.now(), 'a').ok);
    assert.equal(LT.learningsResponse(cfg, {}).action.action, 'none');
    assert.ok(LT.addLearning(root, { kind: 'review', areas: ['scratch-gui'], text: 'B' }, cfg.now(), 'b').ok);
    const state = {};
    assert.equal(LT.learningsResponse(cfg, state).action.action, 'create');
    deps.result = { issue: 0, phase: 'learnings', signal: 'done', summary: 's', hitl: false, pr: 77 };
    const r = await LT.startLearningsPr(cfg, state, log, deps);
    assert.equal(r.started, true);
    assert.ok(calls.some((c) => c[0] === 'runPhase' && c[2] === 'autopilot-learnings'));
    assert.equal(LT.readPrRecord(root).number, 77);
    assert.equal(LT.learningsResponse(cfg, state).action.action, 'merge');

    let merged = false;
    const proj = {
        readToken: async () => 'r', botToken: async () => 'b',
        getPrMergeStatus: async () => ({ state: 'open', base: 'develop', head: 'h', files: ['docs/autopilot/learned/autopilot.md'],
            checkRuns: deps.checks }),
        mergePr: async () => { merged = true; },
    };
    deps.project = proj;
    deps.checks = [{ status: 'in_progress', conclusion: null }];
    const pending = await LT.mergeLearningsPr(cfg, state, log, deps);
    assert.equal(pending.merged, false);
    assert.equal(merged, false);
    deps.checks = [{ status: 'completed', conclusion: 'success' }];
    const ok = await LT.mergeLearningsPr(cfg, state, log, deps);
    assert.equal(ok.merged, true);
    assert.equal(merged, true);
    assert.equal(LT.listLearnings(root).length, 0);
    assert.equal(LT.readPrRecord(root), null);
});

test('学び: worker が PR 番号を返さなければ記録しない', async () => {
    const { root, cfg, deps } = setup();
    cfg.learningsThreshold = 1;
    LT.addLearning(root, { kind: 'intent', areas: [], text: 'A' }, cfg.now(), 'a');
    deps.result = { issue: 0, phase: 'learnings', signal: 'done', summary: 's', hitl: false };
    const state = {};
    await LT.startLearningsPr(cfg, state, log, deps);
    assert.equal(LT.readPrRecord(root), null);
    assert.match(LT.learningsResponse(cfg, state).error, /PR number/);
});
