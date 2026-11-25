'use strict';
/**
 * monitor-inbox.test.js — モニター D「あなた宛て＋表」の判断の純粋関数（#2404）。
 */
const { test } = require('node:test');
const assert = require('node:assert');
const {
    itemSem, epicSem, inboxModel, inboxGroups, isInboxToggleKey, boardRows, recommendedAnswers, chosenAnswers, digitTarget,
    agoLabel, shortTitle, renderMiniMarkdown,
    INBOX_CLIENT_FNS,
} = require('../src/monitor-inbox');

test('itemSem: 止まった → AI が作業中 → 人間の番 → 依存待ち → 待っている の順', () => {
    assert.strictEqual(itemSem({ issue: 1, status: 'Blocked', hitl: true }, [1]).key, 'stop');
    assert.strictEqual(itemSem({ issue: 1, status: 'In Progress', hitl: true }, [1]).key, 'ai');
    assert.deepStrictEqual(itemSem({ issue: 1, status: 'Review', waitReason: 'review' }, []), { key: 'human', label: '人間の番' });
    assert.deepStrictEqual(itemSem({ issue: 1, status: 'Sprint Backlog', waitReason: 'waiting' }, []), { key: 'idle', label: '依存待ち' });
    assert.strictEqual(itemSem({ issue: 1, status: 'Done' }, []).key, 'done');
    assert.strictEqual(itemSem({ issue: 1, status: 'Icebox' }, []).label, 'ずっと先');
    assert.strictEqual(itemSem({ issue: 1, status: 'Backlog' }, []).label, '待っている');
});

test('epicSem: 中に止まったものがあれば止まった、動いていれば AI、人間待ち・決定待ちは人間の番', () => {
    const g = { running: [], waitingHuman: [], pendingDecisions: 0, total: 2, done: 0 };
    assert.strictEqual(epicSem(g, [{ issue: 2, status: 'Blocked' }], []).key, 'stop');
    assert.strictEqual(epicSem(Object.assign({}, g, { running: [{ issue: 2 }] }), [], []).key, 'ai');
    assert.strictEqual(epicSem(Object.assign({}, g, { pendingDecisions: 1 }), [], []).key, 'human');
    assert.strictEqual(epicSem(Object.assign({}, g, { waitingHuman: [{ waitReason: 'waiting' }] }), [], []).key, 'idle');
    assert.strictEqual(epicSem(Object.assign({}, g, { done: 2 }), [], []).key, 'done');
});

const ITEMS = [
    { issue: 10, title: 'EPIC: E', kind: 'EPIC', status: 'In Progress', priority: 'P1' },
    { issue: 11, title: 'review me', status: 'Review', hitl: true, waitReason: 'review', parent: { number: 10, title: 'EPIC: E' } },
    { issue: 12, title: 'asked', status: 'In Progress', hitl: true, waitReason: 'spike', parent: { number: 10, title: 'EPIC: E' } },
    { issue: 13, title: 'running', status: 'In Progress', hitl: true, parent: { number: 10, title: 'EPIC: E' } },
    { issue: 14, title: 'dep', status: 'Sprint Backlog', waitReason: 'waiting' },
    { issue: 15, title: 'later', status: 'Sprint Backlog', later: true, parent: { number: 10, title: 'EPIC: E' } },
];

test('inboxModel（humanWait なし）: 質問のある・動いている・依存待ちの Issue は人間待ちに出さない', () => {
    const m = inboxModel({
        items: ITEMS, running: [{ issue: 13 }],
        monitorQuestions: [{ issue: 12, status: 'open', questions: [{ id: 'q1', options: [] }] }, { issue: 99, status: 'answered', questions: [] }],
    }, null);
    assert.deepStrictEqual(m.questions.map((q) => q.issue), [12]);
    assert.deepStrictEqual(m.answered.map((q) => q.issue), [99]);
    assert.deepStrictEqual(m.waits.map((w) => w.issue), [11]);
    assert.strictEqual(m.waits[0].from, 'EPIC: E');
    assert.strictEqual(m.waits[0].goLabel, 'AI に任せる');
    assert.deepStrictEqual(m.learn, []);
});

test('inboxModel（humanWait あり）: daemon の delegate で「AI に任せる / 直してもらう」を決める', () => {
    const m = inboxModel({
        items: ITEMS,
        humanWait: [
            { issue: 11, title: 'review me', status: 'Review', delegate: { ok: true, action: 'release', nextPhase: 'address-review' } },
            { issue: 14, title: 'dep', status: 'DoD', delegate: { ok: false, code: 'human-work', error: 'DoD は人間の作業です' } },
            { issue: 12, title: 'asked', delegate: { ok: false, code: 'open-questions' } },
        ],
        monitorQuestions: [{ issue: 12, status: 'open', questions: [] }],
    }, null);
    assert.deepStrictEqual(m.waits.map((w) => w.issue), [11, 14]);
    assert.strictEqual(m.waits[0].goLabel, 'AI に直してもらう');
    assert.strictEqual(m.waits[0].fix, true); // 押すと指摘とコメント欄を開く（#2415）
    assert.strictEqual(m.waits[1].goLabel, null);
    assert.strictEqual(m.waits[1].fix, false);
    assert.strictEqual(m.waits[1].delegateError, 'DoD は人間の作業です');
});

test('inboxModel: 学びは PR を作る / マージする ときだけ「確かめてほしい」に出す', () => {
    const base = { count: 3, plan: { reason: 'たまった' } };
    assert.strictEqual(inboxModel({}, Object.assign({}, base, { action: { action: 'create', label: 'PR を作る' } })).learn.length, 1);
    assert.strictEqual(inboxModel({}, Object.assign({}, base, { action: { action: 'merge', label: 'マージ' } })).learn[0].label, 'マージ');
    assert.strictEqual(inboxModel({}, Object.assign({}, base, { action: { action: 'creating' } })).learn.length, 0);
    assert.strictEqual(inboxModel({}, Object.assign({}, base, { action: { action: 'none' } })).learn.length, 0);
});

// 実データ（Projects #4・2026-11-25）の形を縮めたもの
const ok = (nextPhase) => ({ ok: true, action: 'release', nextPhase });
const TAG_ITEMS = [
    { issue: 1, title: 'EPIC: 分解済み', kind: 'EPIC', tracker: true, status: 'In Progress', aiStatus: 'EPIC Decomposed', subIssues: { total: 4, completed: 2 },
        effectivePriority: { priority: 'P2' } },
    { issue: 2, title: 'EPIC: 済んだ', kind: 'EPIC', tracker: true, status: 'In Progress', aiStatus: 'EPIC Decomposed', subIssues: { total: 3, completed: 3 },
        effectivePriority: { priority: 'P1' } },
    { issue: 3, title: 'EPIC: 未分解', kind: 'EPIC', tracker: true, status: 'Backlog', subIssues: { total: 0, completed: 0 }, effectivePriority: { priority: 'P3' } },
    { issue: 4, title: '着手', status: 'Sprint Backlog', parent: { number: 1, title: 'EPIC: 分解済み' } },
    { issue: 5, title: '人間の作業', status: 'Backlog', parent: { number: 2, title: 'EPIC: 済んだ' } },
    { issue: 6, title: 'レビュー', status: 'Review' },
    { issue: 7, title: 'DoD', status: 'DoD' },
    { issue: 8, title: '止まった', status: 'Blocked' },
    { issue: 9, title: '相談', status: 'In Progress', aiStatus: 'Discussing' },
    { issue: 10, title: '続き', status: 'In Progress', aiStatus: 'Awaiting Continuation' },
    { issue: 11, title: 'ほか', status: 'Sprint Backlog' },
];
const TAG_WAIT = [
    { issue: 1, delegate: { ok: false, code: 'tracker' } },
    { issue: 2, delegate: { ok: false, code: 'tracker' } },
    { issue: 3, delegate: ok('decompose') },
    { issue: 4, delegate: ok('implement') },
    { issue: 5, delegate: { ok: false, code: 'human-work' } },
    { issue: 6, delegate: ok('address-review') },
    { issue: 7, delegate: { ok: false, code: 'human-work' } },
    { issue: 8, delegate: ok('implement') },
    { issue: 9, delegate: { ok: false, code: 'open-questions' } },
    { issue: 10, delegate: ok('implement') },
    { issue: 11, delegate: { ok: false, code: 'no-ai-phase' } },
];

test('inboxModel: 人間待ちの札は「何を待たれているか」（そのほか一色にしない）', () => {
    const m = inboxModel({ items: TAG_ITEMS, humanWait: TAG_WAIT, epicGroups: [] }, null);
    const tag = {};
    for (const w of m.waits) tag[w.issue] = w.tag.label + '/' + w.tag.key;
    assert.deepStrictEqual(tag, {
        1: '見守り/idle', 2: 'topic の確認/human', 3: '分解待ち/idle', 4: '着手待ち/idle', 5: '人間の作業/human',
        6: 'レビュー/human', 7: 'DoD の確認/human', 8: '止まった/stop', 9: '相談中/human', 10: '続きの確認/human', 11: '人間の番/human',
    });
    // 未分解でも 🧭 tracker が付いていることがある。分解待ちを見守りにしない
    assert.strictEqual(m.waits.find((w) => w.issue === 3).goLabel, 'AI に任せる');
    // EPIC の段が topic-review なら、子の数が取れなくても topic の確認
    const st = inboxModel({ items: [{ issue: 1, kind: 'EPIC', status: 'In Progress', aiStatus: 'EPIC Decomposed' }],
        humanWait: [{ issue: 1, delegate: { ok: false, code: 'tracker' } }], epicGroups: [{ epic: 1, stage: 'topic-review' }] }, null);
    assert.strictEqual(st.waits[0].tag.label, 'topic の確認');
});

test('inboxGroups: 親の EPIC ごとにまとめ、EPIC 自身は見出しに畳む。押せるまとまりが先', () => {
    const items = TAG_ITEMS.concat([
        { issue: 20, title: 'P0 の子', status: 'Sprint Backlog', parent: { number: 30, title: 'EPIC: 表に無い親' } },
    ]);
    const hw = TAG_WAIT.concat([{ issue: 20, delegate: ok('implement') }]);
    const epicGroups = [{ epic: 30, title: 'EPIC: 表に無い親', priority: 'P0' }];
    const m = inboxModel({ items, humanWait: hw, epicGroups }, null);
    const gs = inboxGroups(m.waits, { items, epicGroups });
    assert.deepStrictEqual(gs.map((g) => g.key + ':' + g.tier), ['30:0', '1:0', '3:0', 'none:0', '2:1']);
    const e1 = gs.find((g) => g.key === '1');
    assert.strictEqual(e1.header.issue, 1);
    assert.strictEqual(e1.header.tag.label, '見守り');
    assert.deepStrictEqual(e1.rows.map((r) => r.issue), [4]);
    assert.strictEqual(e1.priority, 'P2');
    // 親が人間待ちに無くても、epicGroups から題名・優先度を引く
    assert.strictEqual(gs[0].title, 'EPIC: 表に無い親');
    assert.strictEqual(gs[0].priority, 'P0');
    assert.strictEqual(gs[0].header, null);
    // 分解待ちの EPIC は見出しだけ（行は 0）
    assert.strictEqual(gs.find((g) => g.key === '3').count, 0);
    // EPIC に属さない: 押せる行が先
    const none = gs.find((g) => g.key === 'none');
    assert.strictEqual(none.title, 'EPIC に属さない');
    assert.deepStrictEqual(none.rows.map((r) => r.issue), [6, 8, 10, 7]);
    assert.strictEqual(none.hidden, 2);
    const opened = inboxGroups(m.waits, { items, epicGroups, open: ['none'] }).find((g) => g.key === 'none');
    assert.deepStrictEqual(opened.rows.map((r) => r.issue), [6, 8, 10, 7, 9, 11]);
});

test('inboxGroups: 1 まとまり 4 行まで。開いたまとまりは全部', () => {
    const waits = [1, 2, 3, 4, 5, 6].map((n) => ({ issue: n, parent: null, tag: { key: 'idle' }, goLabel: 'AI に任せる' }));
    const [g] = inboxGroups(waits, {});
    assert.strictEqual(g.rows.length, 4);
    assert.strictEqual(g.hidden, 2);
    assert.strictEqual(g.count, 6);
    const [all] = inboxGroups(waits, { open: ['none'] });
    assert.strictEqual(all.rows.length, 6);
    assert.strictEqual(all.hidden, 0);
});

test('isInboxToggleKey: 入力欄の外の [ だけ（⌘ / Ctrl / Alt と一緒なら効かない）', () => {
    assert.strictEqual(isInboxToggleKey({ key: '[' }), true);
    assert.strictEqual(isInboxToggleKey({ key: '[', inInput: true }), false);
    assert.strictEqual(isInboxToggleKey({ key: '[', metaKey: true }), false);
    assert.strictEqual(isInboxToggleKey({ key: '[', ctrlKey: true }), false);
    assert.strictEqual(isInboxToggleKey({ key: '[', altKey: true }), false);
    assert.strictEqual(isInboxToggleKey({ key: ']' }), false);
    assert.strictEqual(isInboxToggleKey(null), false);
});

const GROUPS = [
    { key: '10', epic: 10, title: 'EPIC: E', running: [], waitingHuman: [{ waitReason: 'review' }], pendingDecisions: 0, total: 4, done: 1,
        items: [{ issue: 11 }, { issue: 12 }, { issue: 15 }] },
    { key: 'solo-P2', solo: true, epic: null, title: 'EPIC に属さない · P2', priority: 'P2', running: [], waitingHuman: [], pendingDecisions: 0, total: 1, done: 0,
        items: [{ issue: 14 }] },
];

test('boardRows: 開いたまとまりだけ子の行を出し、💤 later の子は「あとで」以外で隠す', () => {
    const rows = boardRows(GROUPS, ITEMS, { filter: 'all', open: ['10'], running: [], later: [15] });
    assert.deepStrictEqual(rows.map((r) => r.type + ':' + (r.item ? r.item.issue : r.group ? r.group.key : r.key)),
        ['epic:10', 'kid:11', 'kid:12', 'epic:solo-P2']);
    assert.strictEqual(rows[0].epicItem.issue, 10);
    assert.strictEqual(rows[0].sem.key, 'human');
    assert.strictEqual(rows[0].humanN, 2);
    assert.strictEqual(rows[3].index, 2);
    const later = boardRows(GROUPS, ITEMS, { filter: 'later', open: ['10'], later: [15] });
    assert.deepStrictEqual(later.filter((r) => r.type === 'kid').map((r) => r.item.issue), [15]);
    assert.strictEqual(later.filter((r) => r.type === 'epic').length, 1);
});

test('boardRows: チップ（人間の番 / AI / 止まった）と文字の絞り込み', () => {
    assert.deepStrictEqual(boardRows(GROUPS, ITEMS, { filter: 'human' }).map((r) => r.group.key), ['10']);
    assert.deepStrictEqual(boardRows(GROUPS, ITEMS, { filter: 'ai', running: [14] }).map((r) => r.group.key), ['solo-P2']);
    assert.deepStrictEqual(boardRows(GROUPS, ITEMS, { filter: 'stop' }), []);
    // 子に当たったまとまりは、当たった子だけを開いて見せる
    const q = boardRows(GROUPS, ITEMS, { query: 'review' });
    assert.deepStrictEqual(q.map((r) => r.type), ['epic', 'kid']);
    assert.strictEqual(q[0].open, true);
    assert.strictEqual(q[1].item.issue, 11);
    // 番号（# 付きでも）
    assert.deepStrictEqual(boardRows(GROUPS, ITEMS, { query: '#14' }).map((r) => r.type + (r.item ? r.item.issue : '')), ['epic', 'kid14']);
    // まとまりそのものに当たれば、閉じたまま出す
    assert.deepStrictEqual(boardRows(GROUPS, ITEMS, { query: '10' }).filter((r) => r.type === 'epic').map((r) => r.open), [false]);
});

test('recommendedAnswers: 全部の問いに推奨があるときだけ作る（メモも添える）', () => {
    const entry = { questions: [{ id: 'q1', recommended: 'a' }, { id: 'q2', recommended: 'b' }] };
    assert.deepStrictEqual(recommendedAnswers(entry, { q2: ' memo ' }), {
        ok: true, answers: [{ q: 'q1', key: 'a', note: null }, { q: 'q2', key: 'b', note: 'memo' }],
    });
    assert.strictEqual(recommendedAnswers({ questions: [{ id: 'q1', recommended: 'a' }, { id: 'q2' }] }).ok, false);
    assert.strictEqual(recommendedAnswers({ questions: [] }).ok, false);
});

test('chosenAnswers: 進めるには全部を選ぶ。メモだけ保存は選んだかメモのある問いだけ送る', () => {
    const entry = { questions: [{ id: 'q1' }, { id: 'q2' }] };
    const partial = chosenAnswers(entry, { q1: 'a' }, { q2: 'あとで' }, true);
    assert.strictEqual(partial.ok, false);
    assert.deepStrictEqual(partial.missing, ['q2']);
    const save = chosenAnswers(entry, { q1: 'a' }, { q2: 'あとで' }, false);
    assert.strictEqual(save.ok, true);
    assert.deepStrictEqual(save.answers, [{ q: 'q1', key: 'a', note: null }, { q: 'q2', key: null, note: 'あとで' }]);
    assert.strictEqual(chosenAnswers(entry, { q1: 'a', q2: 'b' }, {}, true).ok, true);
    assert.strictEqual(chosenAnswers(entry, {}, { q1: '  ' }, false).ok, false);
});

test('digitTarget: 入力欄の外の 1〜4 だけ。⌘ / Ctrl / Alt との組み合わせは使わない', () => {
    assert.strictEqual(digitTarget({ code: 'Digit1' }), 'inbox');
    assert.strictEqual(digitTarget({ code: 'Digit2' }), 'board');
    assert.strictEqual(digitTarget({ code: 'Digit3' }), 'hist');
    assert.strictEqual(digitTarget({ code: 'Digit4' }), 'tasks');
    assert.strictEqual(digitTarget({ code: 'Digit5' }), null);
    assert.strictEqual(digitTarget({ code: 'Digit1', metaKey: true }), null);
    assert.strictEqual(digitTarget({ code: 'Digit1', ctrlKey: true }), null);
    assert.strictEqual(digitTarget({ code: 'Digit1', altKey: true }), null);
    assert.strictEqual(digitTarget({ code: 'Digit1', inInput: true }), null);
});

test('agoLabel / shortTitle', () => {
    assert.strictEqual(agoLabel(12000), '12 秒');
    assert.strictEqual(agoLabel(31 * 60000), '31 分');
    assert.strictEqual(agoLabel(3 * 3600000), '3 時間');
    assert.strictEqual(agoLabel(2 * 86400000), '2 日');
    assert.strictEqual(shortTitle('EPIC: 変換器'), '変換器');
    assert.strictEqual(shortTitle('feat(autopilot): モニター'), 'モニター');
    assert.strictEqual(shortTitle(null), '');
});

test('INBOX_CLIENT_FNS: どれも自己完結（モジュールの外を参照せずにブラウザで動く）', () => {
    const src = INBOX_CLIENT_FNS.map(String).join('\n');
    // eslint-disable-next-line no-new-func
    const fns = new Function(`${src}; return { boardRows, inboxModel, inboxGroups, digitTarget };`)();
    assert.deepStrictEqual(fns.boardRows(GROUPS, ITEMS, { open: ['10'], later: [15] }).length, 4);
    assert.deepStrictEqual(fns.inboxModel({ items: ITEMS }, null).waits.map((w) => w.issue), [11, 12, 13]);
    assert.strictEqual(fns.digitTarget({ code: 'Digit2' }), 'board');
    assert.strictEqual(fns.inboxGroups(fns.inboxModel({ items: ITEMS }, null).waits, { items: ITEMS })[0].key, '10');
});

// ---- 指摘のまとめコメントの整形（#2415）
test('renderMiniMarkdown: headings, lists, bold, code, links; hides the marker comment', () => {
    const md = [
        '<!-- autopilot-review-findings round=1 -->',
        '🤖 敵対的レビュー（round 1）: 指摘 2 件',
        '',
        '### Must',
        '- **[M1]** `src/a.js:3` 直す — 修正済み',
        '',
        '1. 一つ目',
        '2. [PR](https://github.com/o/r/pull/1)',
        '> 引用',
        '```',
        'const x = 1 < 2;',
        '```',
    ].join('\n');
    const h = renderMiniMarkdown(md);
    assert.ok(!h.includes('autopilot-review-findings'));
    assert.match(h, /<h6>Must<\/h6>/);
    assert.match(h, /<ul><li><strong>\[M1\]<\/strong> <code>src\/a\.js:3<\/code> 直す — 修正済み<\/li><\/ul>/);
    assert.match(h, /<ol><li>一つ目<\/li><li><a href="https:\/\/github\.com\/o\/r\/pull\/1" target="_blank" rel="noopener noreferrer">PR<\/a><\/li><\/ol>/);
    assert.match(h, /<blockquote>引用<\/blockquote>/);
    assert.match(h, /<pre><code>const x = 1 &lt; 2;<\/code><\/pre>/);
    assert.match(h, /<p>🤖 敵対的レビュー/);
    assert.strictEqual(renderMiniMarkdown(''), '');
});

test('renderMiniMarkdown: escapes HTML before formatting (no XSS)', () => {
    const h = renderMiniMarkdown('<script>alert(1)</script> **<img src=x onerror=alert(1)>**\n'
        + '[x](javascript:alert(1)) [y](https://e.com/"onmouseover="a) `<b>`');
    assert.ok(!/<script|<img|<b>/.test(h));
    assert.match(h, /&lt;script&gt;/);
    assert.match(h, /<strong>&lt;img src=x onerror=alert\(1\)&gt;<\/strong>/);
    assert.ok(!h.includes('href="javascript'));
    assert.ok(!/href="[^"]*"onmouseover/.test(h));
    assert.match(h, /<code>&lt;b&gt;<\/code>/);
});

test('renderMiniMarkdown: is self-contained (embedded with toString)', () => {
    // eslint-disable-next-line no-new-func
    const fn = new Function('return (' + renderMiniMarkdown.toString() + ')')();
    assert.strictEqual(fn('**a**'), '<p><strong>a</strong></p>');
    assert.ok(!renderMiniMarkdown.toString().includes('<!--'));
});
