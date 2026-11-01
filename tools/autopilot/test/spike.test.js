'use strict';
/**
 * spike.test.js — 🔬 spike ラベルと「何待ちか」（humanWaitReason）の判定（#1315）。
 */
const { test } = require('node:test');
const assert = require('node:assert');
const vm = require('node:vm');
const {
    SPIKE_LABEL, WAITING_LABEL, AUTOPILOT_LABEL, HITL_LABEL,
    isSpikeItem, spikeLabelAction, labelActions, healingLabelActions, selectLabelHealingItems,
    humanWaitReason, humanWaitUrl, HUMAN_WAIT_REASONS, humanWaitGroups,
    renderHumanWaitsHtml, renderHumanWaitCell, renderSticky,
} = require('../src/phases');
const { MONITOR_HTML } = require('../src/monitor');

const REPO_URL = 'https://github.com/smalruby/smalruby3-editor';

test('SPIKE_LABEL は 🔬 spike', () => {
    assert.strictEqual(SPIKE_LABEL, '🔬 spike');
});

test('isSpikeItem: Discussing は 🙋 の有無にかかわらず Spike', () => {
    assert.ok(isSpikeItem({ status: 'Backlog', aiStatus: 'Discussing', hitlLabel: true }));
    // 人間が 🙋 を外して discuss が走る直前も相談中のまま
    assert.ok(isSpikeItem({ status: 'Backlog', aiStatus: 'Discussing', hitlLabel: false }));
    assert.ok(isSpikeItem({ status: 'New Item', aiStatus: 'Discussing', hitlLabel: true }));
});

test('isSpikeItem: triage / understand が質問を出して 🙋 で止まっているときは Spike', () => {
    assert.ok(isSpikeItem({ status: 'In Progress', aiStatus: 'Triaging', hitlLabel: true }));
    // understand の hitl は Blocked に回る（#1310）が、AI Status は Understanding のまま
    assert.ok(isSpikeItem({ status: 'Blocked', aiStatus: 'Understanding', hitlLabel: true }));
    // 実行中（🙋 なし）は質問待ちではない
    assert.ok(!isSpikeItem({ status: 'In Progress', aiStatus: 'Triaging', hitlLabel: false }));
    assert.ok(!isSpikeItem({ status: 'In Progress', aiStatus: 'Understanding', hitlLabel: false }));
});

test('isSpikeItem: implement 以降・終端・Icebox は Spike ではない', () => {
    for (const aiStatus of ['Implementing', 'Creating PR', 'Self-Reviewing', 'Addressing Comments', 'Running DoD', null]) {
        assert.ok(!isSpikeItem({ status: 'In Progress', aiStatus, hitlLabel: true }), String(aiStatus));
    }
    assert.ok(!isSpikeItem({ status: 'Sprint Backlog', aiStatus: null, hitlLabel: false }));
    assert.ok(!isSpikeItem({ status: 'Review', aiStatus: null, hitlLabel: true }));
    for (const status of ['Close', 'Done', 'Icebox']) {
        assert.ok(!isSpikeItem({ status, aiStatus: 'Discussing', hitlLabel: true }), status);
    }
    assert.ok(!isSpikeItem(null));
});

test('spikeLabelAction: 状態から導出して付け外しする', () => {
    assert.strictEqual(spikeLabelAction({ status: 'Backlog', aiStatus: 'Discussing' }, false), 'add');
    assert.strictEqual(spikeLabelAction({ status: 'Backlog', aiStatus: 'Discussing' }, true), null);
    assert.strictEqual(spikeLabelAction({ status: 'Sprint Backlog', aiStatus: null }, true), 'remove');
    assert.strictEqual(spikeLabelAction({ status: 'Sprint Backlog', aiStatus: null }, false), null);
});

test('labelActions: Discussing に 🔬 spike が付き、implement に進むと外れる', () => {
    const discussing = { status: 'Backlog', aiStatus: 'Discussing', hitlLabel: true };
    assert.ok(labelActions(discussing, [AUTOPILOT_LABEL, HITL_LABEL]).add.includes(SPIKE_LABEL));
    // discuss が承認して Sprint Backlog → implement へ
    const approved = { status: 'Sprint Backlog', aiStatus: null, hitlLabel: false };
    assert.ok(labelActions(approved, [AUTOPILOT_LABEL, SPIKE_LABEL]).remove.includes(SPIKE_LABEL));
    const implementing = { status: 'In Progress', aiStatus: 'Implementing', hitlLabel: false };
    assert.ok(labelActions(implementing, [AUTOPILOT_LABEL, SPIKE_LABEL]).remove.includes(SPIKE_LABEL));
    // skipSpike（PR 面）では扱わない
    const pr = labelActions(discussing, [AUTOPILOT_LABEL, HITL_LABEL], { skipSpike: true });
    assert.ok(!pr.add.includes(SPIKE_LABEL));
});

test('healingLabelActions: 🔬 spike を付け外しし、閉じた item からは外すだけ', () => {
    const d = healingLabelActions({ status: 'Backlog', aiStatus: 'Discussing', hitlLabel: true }, [AUTOPILOT_LABEL]);
    assert.deepStrictEqual(d.add, [SPIKE_LABEL]);
    assert.ok(!d.add.includes(HITL_LABEL));
    const closed = healingLabelActions({ status: 'Close', aiStatus: 'Discussing' }, [SPIKE_LABEL]);
    assert.deepStrictEqual(closed, { add: [], remove: [SPIKE_LABEL] });
    // 閉じた item に 🤖 autopilot を足し直さない
    assert.deepStrictEqual(healingLabelActions({ status: 'Done' }, []), { add: [], remove: [] });
});

test('selectLabelHealingItems: 終端でも 🔬 spike が残っている item は外すために選ぶ', () => {
    const items = [
        { issue: 1, status: 'Close', labels: [SPIKE_LABEL] },
        { issue: 2, status: 'Close', labels: [AUTOPILOT_LABEL] },
        { issue: 3, status: 'Backlog', labels: [] },
    ];
    assert.deepStrictEqual(selectLabelHealingItems(items, new Set()).map((i) => i.issue), [1, 3]);
});

test('humanWaitReason: 🙋 の item の理由を 1 つに決める', () => {
    assert.strictEqual(humanWaitReason({ status: 'Backlog', aiStatus: 'Discussing', hitlLabel: true }), 'spike');
    assert.strictEqual(humanWaitReason({ status: 'In Progress', aiStatus: 'Triaging', hitlLabel: true }), 'spike');
    assert.strictEqual(humanWaitReason({ status: 'Blocked', aiStatus: 'Understanding', hitlLabel: true }), 'spike');
    assert.strictEqual(humanWaitReason({ status: 'Review', hitlLabel: true }), 'review');
    assert.strictEqual(humanWaitReason({ status: 'DoD', hitlLabel: true }), 'dod');
    assert.strictEqual(humanWaitReason({ status: 'Blocked', aiStatus: 'Implementing', hitlLabel: true }), 'blocked');
    assert.strictEqual(humanWaitReason({ status: 'Sprint Backlog', hitlLabel: true, labels: [WAITING_LABEL] }), 'waiting');
    assert.strictEqual(humanWaitReason({ status: 'In Progress', aiStatus: 'Decomposing', hitlLabel: true }), 'other');
});

test('humanWaitReason: 🙋 が無ければ依存待ちだけを返し、ほかは null', () => {
    assert.strictEqual(humanWaitReason({ status: 'Sprint Backlog', hitlLabel: false, labels: [WAITING_LABEL] }), 'waiting');
    assert.strictEqual(humanWaitReason({ status: 'Backlog', aiStatus: 'Discussing', hitlLabel: false }), null);
    assert.strictEqual(humanWaitReason({ status: 'Review', hitlLabel: false }), null);
    assert.strictEqual(humanWaitReason({ status: 'Close', hitlLabel: true }), null);
    assert.strictEqual(humanWaitReason(null), null);
});

test('HUMAN_WAIT_REASONS: humanWaitReason の全理由を表示順で持つ', () => {
    assert.deepStrictEqual(HUMAN_WAIT_REASONS.map((r) => r.key), ['spike', 'review', 'dod', 'blocked', 'waiting', 'other']);
    for (const r of HUMAN_WAIT_REASONS) assert.ok(r.icon && r.label && r.detail, r.key);
});

test('humanWaitUrl: レビュー/DoD は open な PR、それ以外は Issue', () => {
    const issueUrl = `${REPO_URL}/issues/9`;
    const prs = [{ number: 5, state: 'MERGED' }, { number: 7, state: 'OPEN' }];
    assert.strictEqual(humanWaitUrl('review', issueUrl, prs, REPO_URL), `${REPO_URL}/pull/7`);
    assert.strictEqual(humanWaitUrl('dod', issueUrl, prs, REPO_URL), `${REPO_URL}/pull/7`);
    assert.strictEqual(humanWaitUrl('review', issueUrl, [], REPO_URL), issueUrl);
    assert.strictEqual(humanWaitUrl('spike', issueUrl, prs, REPO_URL), issueUrl);
    assert.strictEqual(humanWaitUrl(null, issueUrl, prs, REPO_URL), null);
});

test('renderSticky: 人間待ちの理由を「いま:」の 1 行で出す', () => {
    const spike = renderSticky({ issue: 1, status: 'Backlog', aiStatus: 'Discussing', hitlLabel: true });
    assert.match(spike, /^> いま: 🔬 Spike・回答待ち — 要件の相談中。あなたの回答を待っています$/m);
    const review = renderSticky({ issue: 1, status: 'Review', hitlLabel: true });
    assert.match(review, /^> いま: 👀 レビュー待ち — /m);
    // 人間待ちでなければ出さない（本文が変わらない = PATCH しない）
    const running = renderSticky({ issue: 1, status: 'In Progress', aiStatus: 'Implementing', hitlLabel: false });
    assert.doesNotMatch(running, /いま:/);
    assert.strictEqual(running, renderSticky({ issue: 1, status: 'In Progress', aiStatus: 'Implementing', hitlLabel: false }));
});

/** /board の item（daemon の refreshBoard が付ける waitReason / waitUrl を含む） */
const BOARD_ITEMS = [
    { issue: 11, title: 'spike の Issue', url: `${REPO_URL}/issues/11`, waitReason: 'spike', waitUrl: `${REPO_URL}/issues/11` },
    { issue: 12, title: 'review の Issue', url: `${REPO_URL}/issues/12`, waitReason: 'review', waitUrl: `${REPO_URL}/pull/99` },
    { issue: 13, title: 'もう 1 つの spike', url: `${REPO_URL}/issues/13`, waitReason: 'spike', waitUrl: `${REPO_URL}/issues/13` },
    { issue: 14, title: '実行中', url: `${REPO_URL}/issues/14`, waitReason: null, waitUrl: null },
];

test('humanWaitGroups: 理由ごとに表示順でまとめ、空の理由は出さない', () => {
    const groups = humanWaitGroups(BOARD_ITEMS, HUMAN_WAIT_REASONS);
    assert.deepStrictEqual(groups.map((g) => [g.key, g.items.map((i) => i.issue)]), [
        ['spike', [11, 13]],
        ['review', [12]],
    ]);
});

test('renderHumanWaitsHtml: /board のデータから理由ごとの件数と item を出す', () => {
    const html = renderHumanWaitsHtml(BOARD_ITEMS, HUMAN_WAIT_REASONS);
    assert.match(html, /data-testid="human-waits"/);
    assert.match(html, /data-wait-reason="spike"[^>]*>[\s\S]*?🔬 Spike・回答待ち[\s\S]*?2 件/);
    assert.match(html, /data-wait-reason="review"[^>]*>[\s\S]*?👀 レビュー待ち[\s\S]*?1 件/);
    assert.doesNotMatch(html, /data-wait-reason="dod"/);
    // 回答してほしい場所へのリンク（review は PR）
    assert.ok(html.includes(`href="${REPO_URL}/pull/99"`));
    assert.ok(html.includes(`href="${REPO_URL}/issues/11"`));
    assert.strictEqual(renderHumanWaitsHtml([BOARD_ITEMS[3]], HUMAN_WAIT_REASONS), '');
});

test('renderHumanWaitCell: 🙋 の欄を理由つきで出す', () => {
    const cell = renderHumanWaitCell(BOARD_ITEMS[0], HUMAN_WAIT_REASONS);
    assert.match(cell, /🔬/);
    assert.match(cell, /Spike・回答待ち/);
    assert.ok(cell.includes(`href="${REPO_URL}/issues/11"`));
    assert.strictEqual(renderHumanWaitCell(BOARD_ITEMS[3], HUMAN_WAIT_REASONS), '');
    // タイトル等は escape する
    const xss = renderHumanWaitsHtml([{ issue: 1, title: '<b>x</b>', url: '#', waitReason: 'other', waitUrl: '"><x' }], HUMAN_WAIT_REASONS);
    assert.ok(!xss.includes('<b>x</b>') && !xss.includes('"><x'));
});

test('MONITOR_HTML: 人間待ちのまとめと理由つきの 🙋 欄を描画する（埋め込み関数が自己完結）', () => {
    assert.match(MONITOR_HTML, /id="humanwaits"/);
    assert.match(MONITOR_HTML, /function renderHumanWaitsHtml\(items, reasons\)/);
    assert.match(MONITOR_HTML, /renderHumanWaitsHtml\(d\.items, HUMAN_WAIT_REASONS\)/);
    assert.match(MONITOR_HTML, /renderHumanWaitCell\(it, HUMAN_WAIT_REASONS\)/);
    // 埋め込んだ関数だけでブラウザ側と同じ HTML が作れる（外部の定数に依存しない）
    const script = MONITOR_HTML.slice(MONITOR_HTML.indexOf('<script>') + 8, MONITOR_HTML.lastIndexOf('</script>'));
    const m = script.match(/const HUMAN_WAIT_REASONS = (.*);/);
    assert.ok(m, 'HUMAN_WAIT_REASONS が埋め込まれている');
    const ctx = vm.createContext({});
    vm.runInContext(`${String(humanWaitGroups)}\n${String(renderHumanWaitsHtml)}\nvar out = renderHumanWaitsHtml(${JSON.stringify(BOARD_ITEMS)}, ${m[1]});`, ctx);
    assert.strictEqual(ctx.out, renderHumanWaitsHtml(BOARD_ITEMS, HUMAN_WAIT_REASONS));
});
