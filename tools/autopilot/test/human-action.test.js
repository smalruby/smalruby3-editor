'use strict';
/**
 * human-action.test.js — 「あなた宛て」の「人間がすること」（#2466）。
 * 2026-11-26 のボードと同じ形のデータで、同意したモックアップと同じ分け方・順になるかを見る。
 */
const { test } = require('node:test');
const assert = require('node:assert');
const vm = require('node:vm');
const { humanAction, forYouModel, linkIssueRefs, delegateTargets, HUMAN_ACTION_CLIENT_FNS } = require('../src/human-action');

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

test('forYouModel: #1826 は「この EPIC を AI に任せる」で、子 #1830・#2090 を行として重ねない', () => {
    const m = forYouModel(BOARD, { repoUrl: REPO });
    const all = m.sections.flatMap((s) => s.rows).concat(m.idle);
    const e = all.find((w) => w.issue === 1826);
    assert.strictEqual(e.button, 'この EPIC を AI に任せる');
    assert.strictEqual(e.epicPhase, 'before-delegate');
    assert.deepStrictEqual(e.targets, [1830, 2090]);
    assert.strictEqual(e.act, 'delegate');
    assert.match(e.state, /15\/17/);
    assert.match(e.happens, /子 2 件（#1830・#2090）の 🙋 を外す。AI が順に実装して topic にマージし、最後の確認だけあなたに返します/);
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
    assert.strictEqual(r.button, 'この EPIC を AI に任せる');
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
    assert.strictEqual(e.button, 'この EPIC を AI に任せる');
    assert.match(e.happens, /子 1 件（#1830）/);
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

// ---- EPIC の「いま」（#2475） ----

// 2026-11-26 のボードと同じ形: #2438 は子が自律で進み、#2103 は 🙋 の子が 5 件残る
const EPIC_ITEMS = [
    { issue: 2438, title: 'feat(classroom): grading', kind: 'EPIC', tracker: true, status: 'In Progress', aiStatus: 'EPIC Decomposed',
        hitl: true, priority: 'P0', subIssues: { total: 5, completed: 2 } },
    kid(2439, 2438, { status: 'In Progress', aiStatus: 'Implementing', priority: 'P0' }),
    kid(2440, 2438, { status: 'In Progress', aiStatus: 'Self-Reviewing', priority: 'P0' }),
    kid(2441, 2438, { status: 'Sprint Backlog', priority: 'P0' }),
    { issue: 2103, title: 'EPIC: ことばを予想する AI', kind: 'EPIC', tracker: true, status: 'In Progress', aiStatus: 'EPIC Decomposed',
        hitl: true, priority: 'P3', subIssues: { total: 11, completed: 6 } },
    ...[2109, 2110, 2111, 2112, 2113].map((n) => kid(n, 2103, { status: 'Sprint Backlog', kind: 'Issue', hitl: true,
        labels: ['🤖 autopilot', '🙋 HITL'], priority: 'P3' })),
    { issue: 2430, title: 'EPIC: release check', kind: 'EPIC', tracker: true, status: 'In Progress', aiStatus: 'Release Check',
        hitl: true, priority: 'P1', subIssues: { total: 4, completed: 4 }, prs: [{ number: 2500, state: 'OPEN' }] },
    { issue: 2450, title: 'EPIC: consult', kind: 'EPIC', tracker: true, status: 'In Progress', aiStatus: 'EPIC Decomposed',
        hitl: true, priority: 'P2', subIssues: { total: 3, completed: 1 } },
    kid(2457, 2450, { status: 'In Progress', aiStatus: 'Implementing', hitl: true, priority: 'P2' }),
    kid(2458, 2450, { status: 'In Progress', aiStatus: 'Implementing', priority: 'P2' }),
];
const EPIC_BOARD = {
    items: EPIC_ITEMS,
    // 分解済みの EPIC は 🙋 を外せない（tracker）。子は外せる
    humanWait: EPIC_ITEMS.filter((it) => it.hitl).map((it) => ({
        issue: it.issue,
        delegate: it.tracker ? { ok: false, code: 'tracker' } : { ok: true, action: 'release', nextPhase: 'implement' },
    })),
    running: [{ issue: 2439 }],
    monitorQuestions: [{ issue: 2457, status: 'open', questions: [] }],
    epicGroups: [{ epic: 2438, pendingDecisions: 2 }, { epic: 2103, pendingDecisions: 0 }],
};
const allRows = (m) => m.sections.flatMap((s) => s.rows).concat(m.idle);

test('EPIC: #2438（子が自律で進む）は「自律で進行中」で人間の番ではない欄に入り、数えない', () => {
    const m = forYouModel(EPIC_BOARD, { repoUrl: REPO });
    const e = m.idle.find((w) => w.issue === 2438);
    assert.ok(e, '人間の番ではない欄にある');
    assert.strictEqual(e.epicPhase, 'autonomous');
    assert.strictEqual(e.button, null);
    assert.match(e.state, /AI が進めています（2\/5 済み・topic に自動でマージ）。人間の番は最後の確認だけ/);
    assert.match(e.state, /決定待ち 2 件（最後にまとめて確認）/);
    assert.ok(!m.sections.some((s) => s.rows.some((w) => w.issue === 2438)));
});

test('EPIC: #2103（🙋 の子が 5 件）は「任せる前」で「この EPIC を AI に任せる」。子の行は重ねない', () => {
    const m = forYouModel(EPIC_BOARD, { repoUrl: REPO });
    const e = m.sections.find((s) => s.kind === 'go').rows.find((w) => w.issue === 2103);
    assert.strictEqual(e.epicPhase, 'before-delegate');
    assert.strictEqual(e.button, 'この EPIC を AI に任せる');
    assert.strictEqual(e.act, 'delegate');
    assert.deepStrictEqual(e.targets, [2109, 2110, 2111, 2112, 2113]);
    assert.match(e.state, /子 5 件があなたのゴーサイン待ち（6\/11 済み）。任せると最後の確認まで AI が進めます/);
    assert.ok(!allRows(m).some((w) => w.issue >= 2109 && w.issue <= 2113));
});

test('EPIC: 「この EPIC を AI に任せる」で子 5 件の 🙋 を外す（POST は deps で差し替え）。失敗しても残りは送る', async () => {
    const e = forYouModel(EPIC_BOARD, { repoUrl: REPO }).sections.flatMap((s) => s.rows).find((w) => w.issue === 2103);
    const sent = [];
    const res = await delegateTargets(e.targets, async (n) => {
        sent.push(n);
        if (n === 2111) throw new Error('boom');
        return { ok: true, nextPhase: 'implement' };
    });
    assert.deepStrictEqual(sent, [2109, 2110, 2111, 2112, 2113]);
    assert.deepStrictEqual(res.ok, [2109, 2110, 2112, 2113]);
    assert.deepStrictEqual(res.failed, [{ issue: 2111, error: 'boom' }]);
    assert.strictEqual(res.nextPhase, 'implement');
});

test('EPIC: Release Check は「最後の確認」で「確認ページを開く」（いまは確認の結果を書くダイアログ）', () => {
    const m = forYouModel(EPIC_BOARD, { repoUrl: REPO });
    const e = m.sections.find((s) => s.kind === 'check').rows.find((w) => w.issue === 2430);
    assert.strictEqual(e.epicPhase, 'final-check');
    assert.strictEqual(e.button, '確認ページを開く');
    assert.strictEqual(e.act, 'release');
    assert.match(e.state, /子は全部 topic に入りました（4\/4 済み）。確認ページで答えてください/);
});

test('EPIC: 子で方針が分かれたら「途中の相談」で、子の質問を開く「答える」', () => {
    const m = forYouModel(EPIC_BOARD, { repoUrl: REPO });
    const e = allRows(m).find((w) => w.issue === 2450);
    assert.strictEqual(e.epicPhase, 'consult');
    assert.deepStrictEqual([e.kind, e.button, e.act, e.targets], ['answer', '答える', 'answer', [2457]]);
    assert.match(e.state, /#2457 で方針が分かれました。選んでください/);
});

test('EPIC: 子が Blocked なら「途中の相談」で止まった理由を確かめる', () => {
    const r = humanAction(EPIC_ITEMS[EPIC_ITEMS.length - 3], {
        kids: [{ issue: 2457, status: 'Blocked', hitl: true, parent: { number: 2450 } }], repoUrl: REPO,
    });
    assert.deepStrictEqual([r.epicPhase, r.kind, r.act, r.url], ['consult', 'check', 'open', REPO + '/issues/2457']);
    assert.match(r.state, /#2457 が止まりました/);
});

test('HUMAN_ACTION_CLIENT_FNS: delegateTargets も埋め込んで動く', async () => {
    const ctx = vm.createContext({});
    vm.runInContext(HUMAN_ACTION_CLIENT_FNS.map(String).join('\n')
        + '\nthis.p = delegateTargets([1, 2], async (n) => ({ nextPhase: "x" + n }));', ctx);
    const res = await ctx.p;
    assert.deepStrictEqual([res.ok.length, res.nextPhase], [2, 'x1']);
});

test('EPIC: 🧭 が付いていても Backlog で子 0 件なら分解。残りが人間の作業だけなら「AI が進めています」と言わない', () => {
    const a = (it, ctx) => humanAction(Object.assign({ issue: 1, hitl: true, kind: 'EPIC', tracker: true }, it), Object.assign({ repoUrl: REPO }, ctx));
    assert.strictEqual(a({ status: 'Backlog', subIssues: { total: 0, completed: 0 } }).kind, 'decompose');
    const r = a({ status: 'In Progress', aiStatus: 'EPIC Decomposed', subIssues: { total: 17, completed: 16 } },
        { kids: [{ issue: 2211, status: 'Backlog', kind: 'Issue', hitl: true }] });
    assert.strictEqual(r.epicPhase, 'autonomous');
    assert.match(r.state, /残りは人間の作業 #2211 だけ/);
    assert.doesNotMatch(r.state, /AI が進めています/);
});

test('EPIC: 🙋 の無い子（topic への自動マージ待ちの Review など）は途中の相談にせず、自律で進行中のまま', () => {
    const r = humanAction(EPIC_ITEMS[0], {
        kids: [
            { issue: 2439, status: 'Review', aiStatus: null, prs: [{ number: 2600, state: 'OPEN' }], parent: { number: 2438 } },
            { issue: 2440, status: 'DoD', parent: { number: 2438 } },
        ],
        repoUrl: REPO,
    });
    assert.strictEqual(r.epicPhase, 'autonomous');
    assert.strictEqual(r.kind, 'idle');
});

test('humanAction: Review / DoD の PR がコンフリクトしていれば、先に AI に解消してもらう（#2524）', () => {
    const a = (it, ctx) => humanAction(Object.assign({ issue: 2474, hitl: true }, it), Object.assign({ repoUrl: REPO }, ctx));
    const conflict = [{ number: 2482, state: 'OPEN', mergeable: 'CONFLICTING' }];
    for (const status of ['Review', 'DoD']) {
        const r = a({ status, prs: conflict });
        assert.deepStrictEqual([r.kind, r.button, r.act, r.targets], ['check', 'コンフリクトを解消してもらう', 'resolve', [2474]]);
        assert.strictEqual(r.state, 'PR #2482 が base とコンフリクトしている');
        assert.match(r.happens, /base を取り込んでコンフリクトを解消し、push する。🙋 と Status はそのまま/);
        assert.match(r.happens, status === 'Review' ? /済んだらレビューへ/ : /済んだら動作の確認（DoD）へ/);
    }
    // 🙋 が付いていて OPEN の PR を持つほかの状態でも同じ
    const blocked = a({ status: 'Blocked', prs: conflict });
    assert.strictEqual(blocked.act, 'resolve');
    assert.match(blocked.happens, /済んだらいまの作業へ/);
    // worker が走っていればコンフリクトの扱いにしない（AI の番）
    assert.strictEqual(a({ status: 'Review', prs: conflict }, { running: [2474] }).kind, 'idle');
    // コンフリクトが無い・まだ分からない・閉じた PR ならいままでどおり「PR を見る」
    for (const prs of [[{ number: 2482, state: 'OPEN', mergeable: 'MERGEABLE' }], [{ number: 2482, state: 'OPEN' }],
        [{ number: 2482, state: 'CLOSED', mergeable: 'CONFLICTING' }]]) {
        const r = a({ status: 'Review', prs });
        assert.deepStrictEqual([r.button, r.act], [prs[0].state === 'OPEN' ? 'PR を見る' : 'Issue を見る', 'open']);
    }
});

test('EPIC: 途中の相談の子の PR がコンフリクトしていれば、EPIC の行も「コンフリクトを解消してもらう」（#2524）', () => {
    const r = humanAction(EPIC_ITEMS[EPIC_ITEMS.length - 3], {
        kids: [{ issue: 2457, status: 'Review', hitl: true, parent: { number: 2450 },
            prs: [{ number: 2470, state: 'OPEN', mergeable: 'CONFLICTING' }] }],
        repoUrl: REPO,
    });
    assert.deepStrictEqual([r.epicPhase, r.kind, r.button, r.act, r.targets], ['consult', 'check', 'コンフリクトを解消してもらう', 'resolve', [2457]]);
    assert.match(r.state, /#2457: PR #2470 が base とコンフリクトしている/);
    // 子の worker が走っていれば相談にしない
    const r2 = humanAction(EPIC_ITEMS[EPIC_ITEMS.length - 3], {
        kids: [{ issue: 2457, status: 'Review', hitl: true, parent: { number: 2450 },
            prs: [{ number: 2470, state: 'OPEN', mergeable: 'CONFLICTING' }] }],
        running: [2457], repoUrl: REPO,
    });
    assert.notStrictEqual(r2.act, 'resolve');
});

// ---- 質問を隠さない（#2565）: bin/autopilot-ask で書いた質問がある Issue は、ゴーサインではなく「答える」 ----
const { inboxModel } = require('../src/monitor-inbox');

// 2026-11-28 の #1731（リリース確認）と、その子 #2552・#2555（Sprint Backlog + 🙋・本文に案があるだけだった）
const ASK_ITEMS = [
    { issue: 1731, title: 'EPIC: 日本語モード', kind: 'EPIC', tracker: true, status: 'In Progress', aiStatus: 'Release Check', hitl: true,
        priority: 'P1', subIssues: { total: 48, completed: 46 }, prs: [{ number: 2206, state: 'OPEN' }] },
    kid(2552, 1731, { status: 'Sprint Backlog', hitl: true, priority: 'P2' }),
    kid(2555, 1731, { status: 'Sprint Backlog', hitl: true, priority: 'P2' }),
    { issue: 2600, title: 'single', status: 'Sprint Backlog', hitl: true },
];
const askBoard = (asked) => ({
    items: ASK_ITEMS,
    humanWait: ASK_ITEMS.filter((it) => it.hitl).map((it) => ({
        issue: it.issue, waitReason: it.kind === 'EPIC' ? 'release' : 'go',
        delegate: it.tracker ? { ok: true, action: 'release-check', nextPhase: 'release-check' } : { ok: true, action: 'release', nextPhase: 'implement' },
    })),
    running: [],
    monitorQuestions: asked.map((n) => ({ issue: n, status: 'open', round: 1, questions: [{ id: 'q1', text: 'どちら', options: [{ key: 'a', label: 'A' }] }] })),
});

test('質問のある Sprint Backlog + 🙋 の Issue は、ゴーサインではなく「答える」', () => {
    const it = { issue: 2600, status: 'Sprint Backlog', hitl: true, delegate: { ok: true } };
    assert.strictEqual(humanAction(it, {}).kind, 'go');
    const a = humanAction(it, { questions: [2600] });
    assert.deepStrictEqual([a.kind, a.button, a.act], ['answer', '答える', 'answer']);
    // 待ち（⏳）・リリース後（🚀）でも、開いている質問があれば答える番
    assert.strictEqual(humanAction(Object.assign({}, it, { labels: ['⏳ waiting'] }), { questions: [2600] }).kind, 'answer');
    assert.strictEqual(humanAction(Object.assign({}, it, { status: 'Blocked' }), { questions: [2600] }).kind, 'answer');
    // ボードでも: ゴーサインの欄に出ず、「答えが要る」の欄に出る
    const m = forYouModel(askBoard([2600]), { repoUrl: REPO });
    assert.ok(!allRows(m).some((w) => w.issue === 2600));
    assert.deepStrictEqual(inboxModel(askBoard([2600]), null).questions.map((q) => q.issue), [2600]);
});

test('リリース確認の段階の EPIC の子に質問があると、「あなた宛て」に出る（リリース確認のボタンも残る）', () => {
    const board = askBoard([2552, 2555]);
    const inbox = inboxModel(board, null);
    assert.deepStrictEqual(inbox.questions.map((q) => q.issue), [2552, 2555]);
    assert.ok(!inbox.waits.some((w) => w.issue === 2552 || w.issue === 2555), '人間待ち（ゴーサイン）に重ねない');
    const m = forYouModel(board, { repoUrl: REPO });
    const e = allRows(m).find((w) => w.issue === 1731);
    assert.deepStrictEqual([e.epicPhase, e.kind, e.button], ['final-check', 'check', '確認ページを開く']);
    assert.match(e.state, /子 #2552・#2555 に答え待ちの質問があります（「答えが要る」の欄で答えてください）/);
    assert.ok(!allRows(m).some((w) => w.issue === 2552 || w.issue === 2555));
});

test('自律で進行中・任せる前の EPIC でも、質問のある子はゴーサインにまとめず、相談として出す', () => {
    const epic = { issue: 10, kind: 'EPIC', tracker: true, status: 'In Progress', aiStatus: 'EPIC Decomposed', hitl: true,
        subIssues: { total: 3, completed: 1 } };
    const kids = [
        { issue: 11, status: 'Sprint Backlog', hitl: true, parent: { number: 10 } },
        { issue: 12, status: 'Sprint Backlog', hitl: true, parent: { number: 10 } },
    ];
    const a = humanAction(epic, { kids, questions: [12] });
    assert.deepStrictEqual([a.epicPhase, a.kind, a.targets], ['before-delegate', 'go', [11]]);
    // 任せる前の行でも、質問のある子を一文で指す（子の質問は「答えが要る」の欄に出る）
    assert.match(a.state, /^子 #12 に答え待ちの質問があります（「答えが要る」の欄で答えてください）。/);
    const b = humanAction(epic, { kids: [kids[1]], questions: [12] });
    assert.deepStrictEqual([b.epicPhase, b.kind, b.act, b.targets], ['consult', 'answer', 'answer', [12]]);
});

test('forYouModel: 行に開いている PR の番号を持たせる（探す欄で PR の番号から引ける・#2601）', () => {
    const m = forYouModel({ items: [
        { issue: 2512, title: 'redirect', status: 'Review', hitl: true, prs: [{ number: 2513, state: 'OPEN', branch: 'topic/autopilot-2512' }, { number: 2500, state: 'CLOSED' }] },
    ] }, { repoUrl: 'https://github.com/smalruby/smalruby3-editor' });
    const row = m.sections.reduce((a, s) => a.concat(s.rows), []).concat(m.idle).find((w) => w.issue === 2512);
    assert.deepStrictEqual(row.prs, [{ number: 2513, state: 'OPEN', branch: 'topic/autopilot-2512' }]);
});
