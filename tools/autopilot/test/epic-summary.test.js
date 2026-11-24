'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const {
    priorityRank, decisionCount, countEpicDecisions, averageIssueDurationMs, epicStage,
    estimateNextInterview, groupItemsByEpic, priorityList, buildStatusMaterial, renderEpicGroupsHtml,
    DEFAULT_ISSUE_DURATION_MS,
} = require('../src/epic-summary');

const H = 60 * 60 * 1000;

test('priorityRank: P0〜P3 は数、それ以外は最後', () => {
    assert.equal(priorityRank('P0'), 0);
    assert.equal(priorityRank('p2'), 2);
    assert.equal(priorityRank(null), 9);
    assert.equal(priorityRank('High'), 9);
});

test('decisionCount: 数・{count}・{items}・配列を受ける', () => {
    assert.equal(decisionCount(3), 3);
    assert.equal(decisionCount({ count: 2 }), 2);
    assert.equal(decisionCount({ items: [1, 2, 3, 4] }), 4);
    assert.equal(decisionCount([1]), 1);
    assert.equal(decisionCount(undefined), 0);
    assert.equal(decisionCount(-1), 0);
});

test('countEpicDecisions: マーカーが無ければ 0、count= を優先、次に未チェック・見出し・箇条書き', () => {
    assert.equal(countEpicDecisions('- a\n- b'), 0);
    assert.equal(countEpicDecisions('<!-- autopilot-epic-decisions count=5 -->\n- a'), 5);
    assert.equal(countEpicDecisions('<!-- autopilot-epic-decisions -->\n- [ ] a\n- [x] b\n- [ ] c'), 2);
    assert.equal(countEpicDecisions('<!-- autopilot-epic-decisions -->\n### Q1\n- x\n### Q2'), 2);
    assert.equal(countEpicDecisions('<!-- autopilot-epic-decisions -->\n- a\n- b\n- c'), 3);
});

test('averageIssueDurationMs: Issue ごとに足してから平均・Issue 0 は数えない・無ければ既定', () => {
    const hist = [
        { issue: 1, startedAt: 0, endedAt: H },
        { issue: 1, startedAt: H, endedAt: 2 * H },
        { issue: 2, startedAt: 0, endedAt: H },
        { issue: 0, startedAt: 0, endedAt: 10 * H },
    ];
    assert.equal(averageIssueDurationMs(hist), 1.5 * H);
    assert.equal(averageIssueDurationMs([]), DEFAULT_ISSUE_DURATION_MS);
    assert.equal(averageIssueDurationMs(null, { fallbackMs: 5 }), 5);
});

test('epicStage: 設計 → 実装 → topic の確認 → develop', () => {
    assert.equal(epicStage({ status: 'In Progress' }, { done: 0, total: 0 }), 'design');
    assert.equal(epicStage({ status: 'In Progress' }, { done: 1, total: 3 }), 'implement');
    assert.equal(epicStage({ status: 'In Progress' }, { done: 3, total: 3 }), 'topic-review');
    assert.equal(epicStage({ status: 'Done' }, { done: 3, total: 3 }), 'develop');
    assert.equal(epicStage({ status: 'Review', prs: [{ state: 'MERGED' }] }, { done: 3, total: 3 }), 'develop');
    assert.equal(epicStage(null, { done: 1, total: 2 }), 'implement');
});

test('estimateNextInterview: 残り × 1 件の時間 ÷ 並列（並列は残りを超えない）', () => {
    const now = 1000;
    assert.deepEqual(estimateNextInterview({ stage: 'implement', remaining: 4, avgDurationMs: H, parallelism: 2, now, questions: 3 }),
        { at: now + 2 * H, remaining: 4, questions: 3, parallelism: 2 });
    // 並列 6 でも残り 1 なら 1 件分
    assert.equal(estimateNextInterview({ stage: 'implement', remaining: 1, avgDurationMs: H, parallelism: 6, now }).at, now + H);
    assert.equal(estimateNextInterview({ stage: 'topic-review', remaining: 0, now, questions: 2 }).at, now);
    assert.equal(estimateNextInterview({ stage: 'design', remaining: 0, now }), null);
    assert.equal(estimateNextInterview({ stage: 'develop', remaining: 0, now }), null);
});

const ITEMS = [
    { issue: 10, title: 'EPIC A', kind: 'EPIC', tracker: true, status: 'In Progress', subIssues: { total: 4, completed: 1 }, priority: 'P1', url: 'u10' },
    { issue: 11, title: 'a1', status: 'In Progress', parent: { number: 10, title: 'EPIC A' }, waitReason: null },
    { issue: 12, title: 'a2', status: 'Review', parent: { number: 10, title: 'EPIC A' }, waitReason: 'review', hitl: true },
    { issue: 20, title: 'b1', status: 'Ready', parent: { number: 99, title: 'EPIC B（ボードに無い）' }, priority: 'P0' },
    { issue: 30, title: 'solo', status: 'Ready' },
    { issue: 40, title: 'EPIC C 未分解', kind: 'EPIC', status: 'In Progress', subIssues: { total: 0, completed: 0 } },
];

test('groupItemsByEpic: EPIC ごと・ボードに無い親・単独のまとまり（単独は最後）', () => {
    const groups = groupItemsByEpic(ITEMS, {
        running: [{ issue: 11, phase: 'implement', since: 5 }], concurrency: 2, now: 0,
        history: [{ issue: 1, startedAt: 0, endedAt: H }], decisionsByEpic: { 10: { count: 2 } },
    });
    assert.deepEqual(groups.map((g) => g.key), ['99', '10', '40', 'solo']);
    const a = groups.find((g) => g.key === '10');
    assert.equal(a.stage, 'implement');
    assert.equal(a.done, 1);
    assert.equal(a.total, 4);
    assert.equal(a.pendingDecisions, 2);
    assert.deepEqual(a.running.map((r) => r.issue), [11]);
    assert.deepEqual(a.waitingHuman.map((w) => w.issue), [12]);
    assert.equal(a.eta.at, Math.round((3 * H) / 2));
    const b = groups.find((g) => g.key === '99');
    assert.equal(b.title, 'EPIC B（ボードに無い）');
    assert.equal(b.priority, 'P0');
    assert.equal(b.total, 1);
    assert.equal(groups.find((g) => g.key === '40').stage, 'design');
    const solo = groups.find((g) => g.solo);
    assert.equal(solo.stage, null);
    assert.equal(solo.eta, null);
    assert.deepEqual(solo.items.map((i) => i.issue), [30]);
});

test('priorityList: 優先度 → 指定の並び → 番号。EPIC・終端・あとで は除く', () => {
    const items = [...ITEMS, { issue: 50, status: 'Done' }, { issue: 51, status: 'Ready', later: true }, { issue: 5, status: 'Ready' }];
    assert.deepEqual(priorityList(items).map((p) => p.issue), [20, 5, 11, 12, 30]);
    assert.deepEqual(priorityList(items, { order: [30, 12] }).map((p) => p.issue), [20, 30, 12, 5, 11]);
});

test('buildStatusMaterial: 材料の形（次の確認はいちばん早いもの）', () => {
    const m = buildStatusMaterial({
        items: ITEMS, running: [{ issue: 11, phase: 'implement', since: 1000 }], history: [], concurrency: 2,
        now: Date.UTC(2026, 10, 24), decisionsByEpic: { 10: 1 }, blocked: [{ issue: 11, reason: 'prompt' }],
        repo: 'o/r', currentStatus: { url: 'x' },
    });
    assert.equal(m.schema, 1);
    assert.equal(m.generatedAt, '2026-11-24T00:00:00.000Z');
    assert.equal(m.pendingDecisionsTotal, 1);
    assert.equal(m.running[0].epic, 10);
    assert.equal(m.running[0].title, 'a1');
    assert.deepEqual(m.waitingHuman.map((w) => w.issue), [12]);
    assert.equal(m.nextInterview.epic, 99); // 残り 1 件のほうが早い
    assert.ok(m.nextInterview.atIso);
    assert.equal(m.blocked[0].reason, 'prompt');
    assert.deepEqual(m.currentStatus, { url: 'x' });
});

test('renderEpicGroupsHtml: ボタン・リンク・最終更新・エスケープ。自己完結（ブラウザへ埋め込める）', () => {
    const groups = groupItemsByEpic([{ ...ITEMS[0], title: '<b>x</b>' }, ITEMS[1]], { now: 0 });
    const html = renderEpicGroupsHtml(groups, { url: 'https://claude.ai/artifact/abc', updatedAt: Date.UTC(2026, 0, 1) }, 0);
    assert.match(html, /data-testid="current-status-make"/);
    assert.match(html, /data-testid="current-status-link"/);
    assert.match(html, /最終更新/);
    assert.match(html, /&lt;b&gt;x&lt;\/b&gt;/);
    const running = renderEpicGroupsHtml([], { running: true }, 0);
    assert.match(running, /disabled/);
    assert.match(renderEpicGroupsHtml([], null, 0), /まだ作っていません/);
    // fn.toString() を単独で評価できる（モジュールの外を参照しない）
    // eslint-disable-next-line no-new-func
    const standalone = new Function(`return (${renderEpicGroupsHtml.toString()})`)();
    assert.equal(standalone(groups, null, 0), renderEpicGroupsHtml(groups, null, 0));
});
