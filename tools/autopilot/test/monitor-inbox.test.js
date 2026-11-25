'use strict';
/**
 * monitor-inbox.test.js — モニター D「あなた宛て＋表」の判断の純粋関数（#2404）。
 */
const { test } = require('node:test');
const assert = require('node:assert');
const {
    itemSem, epicSem, inboxModel, boardRows, recommendedAnswers, chosenAnswers, digitTarget, agoLabel, shortTitle,
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
    assert.strictEqual(m.waits[1].goLabel, null);
    assert.strictEqual(m.waits[1].delegateError, 'DoD は人間の作業です');
});

test('inboxModel: 学びは PR を作る / マージする ときだけ「確かめてほしい」に出す', () => {
    const base = { count: 3, plan: { reason: 'たまった' } };
    assert.strictEqual(inboxModel({}, Object.assign({}, base, { action: { action: 'create', label: 'PR を作る' } })).learn.length, 1);
    assert.strictEqual(inboxModel({}, Object.assign({}, base, { action: { action: 'merge', label: 'マージ' } })).learn[0].label, 'マージ');
    assert.strictEqual(inboxModel({}, Object.assign({}, base, { action: { action: 'creating' } })).learn.length, 0);
    assert.strictEqual(inboxModel({}, Object.assign({}, base, { action: { action: 'none' } })).learn.length, 0);
});

const GROUPS = [
    { key: '10', epic: 10, title: 'EPIC: E', running: [], waitingHuman: [{ waitReason: 'review' }], pendingDecisions: 0, total: 4, done: 1,
        items: [{ issue: 11 }, { issue: 12 }, { issue: 15 }] },
    { key: 'solo', solo: true, epic: null, title: '単独', running: [], waitingHuman: [], pendingDecisions: 0, total: 1, done: 0,
        items: [{ issue: 14 }] },
];

test('boardRows: 開いたまとまりだけ子の行を出し、💤 later の子は「あとで」以外で隠す', () => {
    const rows = boardRows(GROUPS, ITEMS, { filter: 'all', open: ['10'], running: [], later: [15] });
    assert.deepStrictEqual(rows.map((r) => r.type + ':' + (r.item ? r.item.issue : r.group ? r.group.key : r.key)),
        ['epic:10', 'kid:11', 'kid:12', 'epic:solo']);
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
    assert.deepStrictEqual(boardRows(GROUPS, ITEMS, { filter: 'ai', running: [14] }).map((r) => r.group.key), ['solo']);
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
    const fns = new Function(`${src}; return { boardRows, inboxModel, digitTarget };`)();
    assert.deepStrictEqual(fns.boardRows(GROUPS, ITEMS, { open: ['10'], later: [15] }).length, 4);
    assert.deepStrictEqual(fns.inboxModel({ items: ITEMS }, null).waits.map((w) => w.issue), [11, 12, 13]);
    assert.strictEqual(fns.digitTarget({ code: 'Digit2' }), 'board');
});
