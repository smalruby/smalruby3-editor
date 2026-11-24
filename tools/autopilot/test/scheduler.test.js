'use strict';
const test = require('node:test');
const assert = require('node:assert');
const s = require('../src/scheduler');

test('parseWeightDirective: 行頭のみ・コメント・バッククォート可', () => {
    assert.equal(s.parseWeightDirective('autopilot-weight: heavy'), 'heavy');
    assert.equal(s.parseWeightDirective('x\n<!-- autopilot-weight: `light` -->'), 'light');
    assert.equal(s.parseWeightDirective('- `autopilot-weight: heavy`'), null);
    assert.equal(s.parseWeightDirective(''), null);
});

test('estimateWeight: フェーズの既定', () => {
    assert.equal(s.estimateWeight({ phase: 'implement' }).weight, 'heavy');
    assert.equal(s.estimateWeight({ phase: 'verify' }).weight, 'heavy');
    for (const p of ['triage', 'understand', 'decompose', 'review', 'address-review', 'discuss']) {
        assert.equal(s.estimateWeight({ phase: p }).weight, 'light', p);
    }
    assert.equal(s.estimateWeight({ phase: 'unknown' }).weight, 'light');
});

test('estimateWeight: ディレクティブが最優先', () => {
    const c = s.analyzeContent('jest webpack', 'autopilot-weight: light');
    assert.deepEqual(s.estimateWeight({ phase: 'implement', content: c }),
        { weight: 'light', source: 'directive', reasons: ['autopilot-weight'] });
    const h = s.analyzeContent('docs', 'autopilot-weight: heavy');
    assert.equal(s.estimateWeight({ phase: 'triage', content: h }).weight, 'heavy');
});

test('estimateWeight: 中身から推測（中身で変わるフェーズだけ）', () => {
    const gui = s.analyzeContent('fix(gui): ボタン', 'packages/scratch-gui の jest を足す');
    assert.equal(s.estimateWeight({ phase: 'address-review', content: gui }).weight, 'heavy');
    assert.equal(s.estimateWeight({ phase: 'address-review', content: gui }).source, 'content');
    // triage は中身に関係なく軽い
    assert.equal(s.estimateWeight({ phase: 'triage', content: gui }).weight, 'light');
    const docs = s.analyzeContent('docs: README を直す', 'docs/autopilot/README.md');
    assert.equal(s.estimateWeight({ phase: 'implement', content: docs }).weight, 'light');
    const ap = s.analyzeContent('feat(autopilot): x', 'tools/autopilot の node --test');
    assert.equal(s.estimateWeight({ phase: 'implement', content: ap }).weight, 'light');
    // 「テスト」だけでは重くしない（既定に戻る）
    const plain = s.analyzeContent('x', 'テストを足す');
    assert.equal(s.estimateWeight({ phase: 'address-review', content: plain }).weight, 'light');
    assert.equal(s.estimateWeight({ phase: 'implement', content: plain }).source, 'phase');
});

test('LOAD_PATTERNS: どのパターンも cpu/mem の説明を持つ', () => {
    for (const p of s.LOAD_PATTERNS) {
        assert.ok(p.re instanceof RegExp && p.note && Array.isArray(p.resources), p.id);
    }
});

test('resolveSchedulerLimits: 既定・上書き・不正値', () => {
    assert.equal(s.resolveSchedulerLimits().maxTotal, 6);
    assert.equal(s.resolveSchedulerLimits().maxHeavy, 2);
    const l = s.resolveSchedulerLimits({ maxTotal: 4, maxHeavy: 'x', foo: 1 }, { maxHeavy: 9 });
    assert.equal(l.maxTotal, 4);
    assert.equal(l.maxHeavy, 4); // 全体を超えない
    assert.equal(l.foo, undefined);
    assert.equal(s.resolveSchedulerLimits({ maxTotal: -1 }).maxTotal, 6);
});

test('parseMemAvailableMb', () => {
    assert.equal(s.parseMemAvailableMb('MemTotal: 8000000 kB\nMemAvailable:    3145728 kB\n'), 3072);
    assert.equal(s.parseMemAvailableMb('nothing'), null);
});

const limits = s.resolveSchedulerLimits();
const heavy = (issue) => ({ issue, weight: 'heavy' });
const light = (issue) => ({ issue, weight: 'light' });

test('planSlots: 重いは 2 まで、残りは軽いで埋める', () => {
    const r = s.planSlots({
        candidates: [heavy(1), heavy(2), heavy(3), light(4), light(5)],
        running: [],
        limits,
        resources: { memAvailableMb: 8000, load1: 1, cpus: 5 },
    });
    assert.deepEqual(r.picked, [1, 2, 4, 5]);
    assert.deepEqual(r.waiting, [{ issue: 3, why: '重いものの上限 2' }]);
    assert.match(r.reason, /4 件開始（重い 2・軽い 2）/);
});

test('planSlots: 全体の上限（実行中を数える）', () => {
    const r = s.planSlots({
        candidates: [light(10), light(11), light(12)],
        running: [heavy(1), light(2), light(3), light(4)],
        limits,
        resources: {},
    });
    assert.deepEqual(r.picked, [10, 11]);
    assert.equal(r.waiting[0].why, '全体の上限 6');
});

test('planSlots: 空きメモリ 2.5GB 未満で重いを始めない・1GB 未満で何も始めない', () => {
    const r = s.planSlots({ candidates: [heavy(1), light(2)], running: [], limits, resources: { memAvailableMb: 2000 } });
    assert.deepEqual(r.picked, [2]);
    assert.match(r.waiting[0].why, /重い/);
    const z = s.planSlots({ candidates: [light(1)], running: [], limits, resources: { memAvailableMb: 900 } });
    assert.deepEqual(z.picked, []);
    assert.match(z.reason, /新しい作業を止める/);
});

test('planSlots: 同じ tick で始めた分を空きから引く', () => {
    // 4000MB: 重い 1 件で 2500 → 2 件目は 2.5GB 未満なので待ち
    const r = s.planSlots({ candidates: [heavy(1), heavy(2)], running: [], limits, resources: { memAvailableMb: 4000 } });
    assert.deepEqual(r.picked, [1]);
});

test('planSlots: CPU の負荷', () => {
    const hi = s.planSlots({ candidates: [heavy(1), light(2)], running: [], limits, resources: { load1: 6, cpus: 5 } });
    assert.deepEqual(hi.picked, [2]);
    const over = s.planSlots({ candidates: [light(1)], running: [], limits, resources: { load1: 11, cpus: 5 } });
    assert.deepEqual(over.picked, []);
});

test('normalizePriority / shiftPriority', () => {
    assert.equal(s.normalizePriority('P1'), 'P1');
    assert.equal(s.normalizePriority('p0 urgent'), 'P0');
    assert.equal(s.normalizePriority(null), null);
    assert.equal(s.shiftPriority('P2', 'up'), 'P1');
    assert.equal(s.shiftPriority('P0', 'up'), 'P0');
    assert.equal(s.shiftPriority('P3', 'down'), 'P3');
    assert.equal(s.shiftPriority(null, 'down'), 'P3');
});

test('effectivePriority: 自分 → 親 → 既定・循環に耐える', () => {
    const ctx = { priorityByIssue: { 1: 'P0', 3: 'P3' }, parentByIssue: { 2: 1, 3: 1, 4: 5, 5: 4 } };
    assert.deepEqual(s.effectivePriority(1, ctx), { priority: 'P0', source: 'own', from: null });
    assert.deepEqual(s.effectivePriority(2, ctx), { priority: 'P0', source: 'inherited', from: 1 });
    assert.equal(s.effectivePriority(3, ctx).priority, 'P3');
    assert.equal(s.effectivePriority(4, ctx).source, 'default');
    const m = { priorityByIssue: new Map([[9, 'P1']]), parentByIssue: new Map([[8, 9]]) };
    assert.equal(s.effectivePriority(8, m).priority, 'P1');
});

test('orderByPriority: 優先度 → 渡された順（安定）', () => {
    const ctx = { priorityByIssue: { 10: 'P1', 30: 'P0' }, parentByIssue: { 21: 10 } };
    const out = s.orderByPriority([{ issue: 20 }, { issue: 21 }, { issue: 10 }, { issue: 30 }, { issue: 40 }], ctx);
    assert.deepEqual(out.map((c) => c.issue), [30, 21, 10, 20, 40]);
    assert.equal(out[1].prioritySource, 'inherited');
});
