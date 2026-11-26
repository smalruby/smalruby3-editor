'use strict';
/**
 * human-action.test.js — 「あなた宛て」の「人間がすること」（#2466）。
 * 2026-11-26 のボードと同じ形のデータで、同意したモックアップと同じ分け方・順になるかを見る。
 */
const { test } = require('node:test');
const assert = require('node:assert');
const vm = require('node:vm');
const { humanAction, forYouModel, linkIssueRefs, HUMAN_ACTION_CLIENT_FNS } = require('../src/human-action');

const REPO = 'https://github.com/smalruby/smalruby3-editor';
const kid = (issue, parent, extra) => Object.assign({ issue, title: 't' + issue, parent: { number: parent, title: 'E' + parent } }, extra);

// 2026-11-26 のボードを縮めたもの（形は同じ）
const ITEMS = [
    { issue: 1731, title: 'EPIC: 日本語モード', kind: 'EPIC', tracker: true, status: 'In Progress', aiStatus: 'Release Check', hitl: true,
        priority: 'P1', subIssues: { total: 46, completed: 44 }, prs: [{ number: 2206, state: 'OPEN' }] },
    kid(2374, 1731, { status: 'Sprint Backlog', hitl: true, labels: ['🚀 after-release'], priority: 'P2' }),
    kid(2453, 1731, { status: 'In Progress', aiStatus: 'Implementing' }),
    { issue: 2158, title: 'EPIC: 計測・制御', kind: 'EPIC', tracker: true, status: 'In Progress', aiStatus: 'EPIC Decomposed', hitl: true,
        priority: 'P1', subIssues: { total: 9, completed: 9 } },
    { issue: 2459, title: 'feat(autopilot): review', status: 'Review', hitl: true, priority: 'P2', prs: [{ number: 2460, state: 'OPEN' }] },
    { issue: 1826, title: 'EPIC: 変換器', kind: 'EPIC', tracker: true, status: 'In Progress', aiStatus: 'EPIC Decomposed', hitl: true,
        priority: 'P2', subIssues: { total: 17, completed: 15 } },
    kid(1830, 1826, { status: 'Sprint Backlog', hitl: true, priority: 'P2' }),
    kid(2090, 1826, { status: 'Sprint Backlog', hitl: true, priority: 'P2' }),
    { issue: 2048, title: 'fix(ruby): 2^31', status: 'Sprint Backlog', hitl: true, priority: 'P2' },
    { issue: 1916, title: 'spike(pwa)', status: 'Sprint Backlog', hitl: true, priority: 'P3' },
    { issue: 2220, title: 'EPIC: オフライン', kind: 'EPIC', status: 'Backlog', hitl: true, priority: 'P3' },
    { issue: 2163, title: 'EPIC: Studuino モード', kind: 'EPIC', tracker: true, status: 'In Progress', aiStatus: 'EPIC Decomposed', hitl: true,
        priority: 'P1', subIssues: { total: 17, completed: 16 } },
    kid(2211, 2163, { status: 'Backlog', kind: 'Issue', hitl: true, priority: 'P1' }),
    { issue: 2010, title: 'GitHub Pages を止める', status: 'Backlog', kind: 'Issue', hitl: true, priority: 'P3' },
];
const BOARD = {
    items: ITEMS,
    humanWait: ITEMS.filter((it) => it.hitl).map((it) => ({ issue: it.issue, delegate: { ok: true, action: 'release', nextPhase: 'implement' } })),
    running: [{ issue: 2453 }],
    monitorQuestions: [],
};

test('forYouModel: することごと（確かめる → ゴーサイン → 分解 → 人間の作業）、中は P1 → P3・番号順', () => {
    const m = forYouModel(BOARD, { repoUrl: REPO });
    assert.deepStrictEqual(m.sections.map((s) => s.kind), ['check', 'go', 'decompose', 'hand']);
    const ids = (k) => m.sections.find((s) => s.kind === k).rows.map((w) => w.issue);
    assert.deepStrictEqual(ids('check'), [1731, 2158, 2459]);
    assert.deepStrictEqual(ids('go'), [1826, 2048, 1916]);
    assert.deepStrictEqual(ids('decompose'), [2220]);
    assert.deepStrictEqual(ids('hand'), [2211, 2010]);
});

test('forYouModel: #2374（🚀 after-release）は人間の番ではない欄に入り、数えない', () => {
    const m = forYouModel(BOARD, { repoUrl: REPO });
    assert.ok(m.idle.some((w) => w.issue === 2374));
    assert.ok(!m.sections.some((s) => s.rows.some((w) => w.issue === 2374)));
    assert.deepStrictEqual(m.counts, { check: 3, answer: 0, go: 4, hand: 2, total: 9 });
});

test('forYouModel: #1826 は「2 件の実装を始めてもらう」で、子 #1830・#2090 を行として重ねない', () => {
    const m = forYouModel(BOARD, { repoUrl: REPO });
    const all = m.sections.flatMap((s) => s.rows).concat(m.idle);
    const e = all.find((w) => w.issue === 1826);
    assert.strictEqual(e.button, '2 件の実装を始めてもらう');
    assert.deepStrictEqual(e.targets, [1830, 2090]);
    assert.strictEqual(e.act, 'delegate');
    assert.match(e.state, /15\/17/);
    assert.match(e.happens, /#1830・#2090 の 🙋 を外す/);
    assert.ok(!all.some((w) => w.issue === 1830 || w.issue === 2090));
});

test('forYouModel: 動いている worker の Issue と、答えが要る欄の質問は出さない', () => {
    const m = forYouModel(Object.assign({}, BOARD, { monitorQuestions: [{ issue: 2048, status: 'open', questions: [] }] }));
    const all = m.sections.flatMap((s) => s.rows).concat(m.idle);
    assert.ok(!all.some((w) => w.issue === 2048));
});

test('humanAction: 状態ごとの すること・ボタン・押すと', () => {
    const a = (it, ctx) => humanAction(Object.assign({ issue: 1, hitl: true }, it), Object.assign({ repoUrl: REPO }, ctx));
    // Review（PR あり）は PR を開く
    let r = a({ status: 'Review', prs: [{ number: 9, state: 'OPEN' }] });
    assert.deepStrictEqual([r.kind, r.button, r.act, r.url], ['check', 'PR を見る', 'open', REPO + '/pull/9']);
    // リリース確認は確認の結果を書くダイアログ
    r = a({ status: 'In Progress', aiStatus: 'Release Check', tracker: true, subIssues: { total: 2, completed: 2 } });
    assert.deepStrictEqual([r.kind, r.act], ['check', 'release']);
    // 確認ページ（#2474）があれば、そのページを別タブで開く
    r = a({ status: 'In Progress', aiStatus: 'Release Check', tracker: true, subIssues: { total: 2, completed: 2 },
        releasePageUrl: 'https://claude.ai/artifact/p1' });
    assert.deepStrictEqual([r.kind, r.button, r.act, r.url], ['check', '確認ページを開く', 'open', 'https://claude.ai/artifact/p1']);
    assert.match(r.happens, /1 枚で見て、答えを送る/);
    // Sprint Backlog の EPIC の子は topic 宛て、属さないものは develop 宛て
    assert.match(a({ status: 'Sprint Backlog', parent: { number: 5 } }).happens, /topic 宛て/);
    assert.match(a({ status: 'Sprint Backlog' }).happens, /develop 宛て/);
    // 未分解の EPIC は分解、Backlog の Issue は人間の作業
    assert.strictEqual(a({ status: 'Backlog', kind: 'EPIC' }).kind, 'decompose');
    r = a({ status: 'Backlog', kind: 'Issue' });
    assert.deepStrictEqual([r.kind, r.button, r.act], ['hand', 'Issue を開く', 'open']);
    // 相談中は答える。⏳ 待ちと動いているものは人間の番ではない
    assert.strictEqual(a({ status: 'Backlog', aiStatus: 'Discussing' }).kind, 'answer');
    assert.strictEqual(a({ status: 'Sprint Backlog', waiting: true }).kind, 'idle');
    assert.strictEqual(a({ status: 'Review' }, { running: [1] }).kind, 'idle');
    // 1 件だけの EPIC のゴーサインは番号で言う
    r = a({ status: 'In Progress', aiStatus: 'EPIC Decomposed', tracker: true, subIssues: { total: 3, completed: 2 } },
        { kids: [{ issue: 7, status: 'Sprint Backlog', hitl: true }] });
    assert.strictEqual(r.button, '#7 を始めてもらう');
    // 終端は null
    assert.strictEqual(a({ status: 'Close' }), null);
});

test('humanAction: 🙋 を外せない（delegate.ok=false）ものはゴーサインにせず、🧱 infra の子は develop 宛て', () => {
    const a = (it, ctx) => humanAction(Object.assign({ issue: 1, hitl: true }, it), Object.assign({ repoUrl: REPO }, ctx));
    let r = a({ status: 'Sprint Backlog', delegate: { ok: false, code: 'no-ai-phase' } });
    assert.deepStrictEqual([r.kind, r.act], ['check', 'open']);
    assert.match(a({ status: 'Sprint Backlog', parent: { number: 5 }, labels: ['🧱 infra'] }).happens, /develop 宛て/);
    // EPIC のまとめ: 外せない子は入れない。全部 infra なら develop 宛て
    const epic = { status: 'In Progress', aiStatus: 'EPIC Decomposed', tracker: true, subIssues: { total: 3, completed: 1 } };
    r = a(epic, { kids: [
        { issue: 7, status: 'Sprint Backlog', hitl: true, labels: ['🧱 infra'] },
        { issue: 8, status: 'Sprint Backlog', hitl: true, delegate: { ok: false } },
    ] });
    assert.deepStrictEqual(r.targets, [7]);
    assert.match(r.happens, /develop 宛ての PR/);
});

test('forYouModel: 子の delegate は humanWait から重ね、外せない子は EPIC のゴーサインに入れない', () => {
    const hw = BOARD.humanWait.map((h) => (h.issue === 2090 ? { issue: 2090, delegate: { ok: false, code: 'no-ai-phase' } } : h));
    const m = forYouModel(Object.assign({}, BOARD, { humanWait: hw }), { repoUrl: REPO });
    const e = m.sections.flatMap((s) => s.rows).find((w) => w.issue === 1826);
    assert.deepStrictEqual(e.targets, [1830]);
    assert.strictEqual(e.button, '#1830 を始めてもらう');
});

test('linkIssueRefs: #N は別タブで開くリンクにし、ほかはエスケープする', () => {
    const h = linkIssueRefs('PR #2460 と <b>#12</b>', REPO);
    assert.strictEqual(h, 'PR <a class="ilink" href="' + REPO + '/issues/2460" target="_blank" rel="noopener">#2460</a> と &lt;b&gt;'
        + '<a class="ilink" href="' + REPO + '/issues/12" target="_blank" rel="noopener">#12</a>&lt;/b&gt;');
    assert.strictEqual(linkIssueRefs(null, REPO), '');
});

test('HUMAN_ACTION_CLIENT_FNS: モジュールの外を参照せず、ブラウザへ埋め込んで動く', () => {
    const ctx = vm.createContext({});
    vm.runInContext(HUMAN_ACTION_CLIENT_FNS.map(String).join('\n') + '\nthis.out = forYouModel(' + JSON.stringify(BOARD) + ').counts;', ctx);
    assert.strictEqual(ctx.out.total, 9);
});
