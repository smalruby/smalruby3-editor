'use strict';
// daemon 側の並列の計画・優先度のつなぎ（EPIC #2384）。I/O は deps で差し替える。
const test = require('node:test');
const assert = require('node:assert');
const {
    currentSchedulerLimits, readResources, planDispatch, setItemPriority, setSchedulerOverrides,
} = require('../src/daemon');

const cfg = (extra = {}) => ({ now: () => 1000, settings: { scheduler: {} }, ...extra });

test('currentSchedulerLimits: settings ← CLI ← モニターの上書き', () => {
    assert.equal(currentSchedulerLimits(cfg(), {}).maxTotal, 6);
    assert.equal(currentSchedulerLimits(cfg({ cliConcurrency: 3 }), {}).maxTotal, 3);
    assert.equal(currentSchedulerLimits(cfg({ cliConcurrency: 3 }), { schedulerOverrides: { maxTotal: 5 } }).maxTotal, 5);
    assert.equal(currentSchedulerLimits(cfg({ settings: { scheduler: { maxHeavy: 1 } } }), null).maxHeavy, 1);
});

test('readResources: /proc/meminfo と loadavg を読む・無くても落ちない', () => {
    const r = readResources({
        readFile: () => 'MemAvailable: 2097152 kB\n', loadavg: () => [2.5, 1, 1], cpus: () => [{}, {}],
    });
    assert.deepEqual(r, { memAvailableMb: 2048, load1: 2.5, cpus: 2 });
    const none = readResources({ readFile: () => { throw new Error('no /proc'); }, loadavg: () => [0], cpus: () => [{}] });
    assert.equal(none.memAvailableMb, null);
});

test('planDispatch: 優先度（親から継ぐ）の順に、重さと上限で選ぶ', () => {
    const state = { running: new Map([[90, { phase: 'implement' }]]), parents: new Map([[12, 100]]) };
    const items = [
        { issue: 100, priority: 'P0' }, { issue: 11, priority: 'P3' }, { issue: 12 }, { issue: 13 }, { issue: 14 },
    ];
    const eligible = [
        { issue: 11, phase: 'triage', title: 'a' },
        { issue: 13, phase: 'implement', title: 'b' },
        { issue: 12, phase: 'implement', title: 'c' },
        { issue: 14, phase: 'implement', title: 'docs: d' },
    ];
    const directives = new Map([[14, { body: 'docs/autopilot/README.md だけ' }]]);
    const logs = [];
    const picked = planDispatch(eligible, directives, items, currentSchedulerLimits(cfg(), {}), cfg(), state,
        (m) => logs.push(m), { readResources: () => ({ memAvailableMb: 8000, load1: 0.5, cpus: 5 }) });
    // 12 は親 100 の P0 を継いで先頭。実行中の 90（implement=重い）と合わせて重いは 2 まで → 13 は待ち
    assert.deepEqual(picked.map((p) => p.issue), [12, 14, 11]);
    assert.equal(state.weights.get(12), 'heavy');
    assert.equal(state.weights.get(14), 'light');
    assert.equal(state.schedulePlan.waiting[0].issue, 13);
    assert.match(state.schedulePlan.reason, /3 件開始/);
    assert.equal(state.schedulePlan.order[0].prioritySource, 'inherited');
    assert.ok(logs.some((l) => l.startsWith('schedule: ')));
});

test('planDispatch: 重いものの枠が 1 つなら、同じ P1 の直しを新しい implement より先に始める（#2472）', () => {
    // 2026-11-26 の形: 実行中の重い 1 件で枠は残り 1。#2471（implement）が Project の並びで上
    const state = { running: new Map([[90, { phase: 'implement' }]]), parents: new Map() };
    const items = [{ issue: 2471, priority: 'P1' }, { issue: 2466, priority: 'P1' }];
    const eligible = [
        { issue: 2471, phase: 'implement', title: 'feat: jest の integration' },
        { issue: 2466, phase: 'address-review', pr: 2468, title: 'fix: playwright の確認' },
    ];
    const picked = planDispatch(eligible, new Map(), items, currentSchedulerLimits(cfg(), {}), cfg(), state,
        () => {}, { readResources: () => ({ memAvailableMb: 8000, load1: 0.5, cpus: 5 }) });
    assert.deepEqual(picked.map((p) => p.issue), [2466]);
    assert.equal(state.schedulePlan.waiting[0].issue, 2471);
    assert.equal(state.schedulePlan.order[0].stage, 'fix');
    assert.match(state.schedulePlan.reason, /順: 同じ P1 で、直しを先に/);
});

test('setItemPriority: 継いだ値から 1 段上げ、キャッシュにも反映する', async () => {
    const state = {
        itemsCache: { items: [{ issue: 1, itemId: 'I1', priority: 'P1' }, { issue: 2, itemId: 'I2' }] },
        board: { items: [{ issue: 2, itemId: 'I2', priority: null }] },
        parents: new Map([[2, 1]]),
    };
    const calls = [];
    const r = await setItemPriority({ projectId: 'P', fields: {} }, state, () => {}, { issue: 2, direction: 'up' },
        { setPriority: async (ctx, itemId, p) => { calls.push([ctx.projectId, itemId, p]); } });
    assert.deepEqual(r, { issue: 2, priority: 'P0', from: 'P1' });
    assert.deepEqual(calls, [['P', 'I2', 'P0']]);
    assert.equal(state.board.items[0].priority, 'P0');
    assert.equal(state.itemsCache.items[1].priority, 'P0');
    await assert.rejects(setItemPriority({}, state, () => {}, { issue: 9, direction: 'up' }, { setPriority: async () => {} }));
});

test('setSchedulerOverrides: 数だけ受け付け・null で外す', () => {
    const state = {};
    assert.deepEqual(setSchedulerOverrides(state, { maxTotal: 4, maxHeavy: 'x', foo: 1 }), { maxTotal: 4 });
    assert.deepEqual(setSchedulerOverrides(state, { maxTotal: null, maxHeavy: 1 }), { maxHeavy: 1 });
});
