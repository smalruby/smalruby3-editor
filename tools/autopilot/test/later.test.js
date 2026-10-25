'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const vm = require('node:vm');
const {
    LATER_LABEL, TERMINAL_STATUSES, AUTOPILOT_LABEL, HITL_LABEL,
    hasLaterLabel, laterLabelDiff, withLaterLabel, canToggleLater, effectiveLater,
    splitLaterBoard, laterPendingReducer, healingLabelActions, phaseForItem, isActionable,
} = require('../src/phases');

test('LATER_LABEL は 💤 later', () => {
    assert.strictEqual(LATER_LABEL, '💤 later');
});

test('hasLaterLabel: labels に 💤 later があるか', () => {
    assert.strictEqual(hasLaterLabel({ labels: [LATER_LABEL] }), true);
    assert.strictEqual(hasLaterLabel({ labels: [AUTOPILOT_LABEL] }), false);
    assert.strictEqual(hasLaterLabel({}), false);
    assert.strictEqual(hasLaterLabel(null), false);
});

test('laterLabelDiff: 差分時のみ書き込む（同一状態の再実行は空差分）', () => {
    assert.deepStrictEqual(laterLabelDiff([AUTOPILOT_LABEL], true), { add: [LATER_LABEL], remove: [] });
    assert.deepStrictEqual(laterLabelDiff([LATER_LABEL], false), { add: [], remove: [LATER_LABEL] });
    assert.deepStrictEqual(laterLabelDiff([LATER_LABEL], true), { add: [], remove: [] });
    assert.deepStrictEqual(laterLabelDiff([], false), { add: [], remove: [] });
    assert.deepStrictEqual(laterLabelDiff(undefined, false), { add: [], remove: [] });
});

test('withLaterLabel: labels の 💤 later を置き換えたコピー（元配列は破壊しない）', () => {
    const src = [AUTOPILOT_LABEL];
    assert.deepStrictEqual(withLaterLabel(src, true), [AUTOPILOT_LABEL, LATER_LABEL]);
    assert.deepStrictEqual(src, [AUTOPILOT_LABEL]);
    assert.deepStrictEqual(withLaterLabel([LATER_LABEL, LATER_LABEL, 'x'], true), ['x', LATER_LABEL]);
    assert.deepStrictEqual(withLaterLabel([LATER_LABEL, 'x'], false), ['x']);
});

test('canToggleLater: 終端 Status（Close / Done）にはボタンを出さない', () => {
    for (const s of TERMINAL_STATUSES) assert.strictEqual(canToggleLater({ status: s }), false, s);
    for (const s of ['Backlog', 'Sprint Backlog', 'In Progress', 'Blocked', 'Review', 'DoD', 'New Item']) {
        assert.strictEqual(canToggleLater({ status: s }), true, s);
    }
    assert.strictEqual(canToggleLater(null), false);
});

test('💤 later は autopilot の処理を変えない（label healing が外さない・dispatch 判定も同じ）', () => {
    const base = { issue: 1, status: 'Sprint Backlog', aiStatus: null, kind: 'LEAF', labels: [AUTOPILOT_LABEL] };
    const withLater = { ...base, labels: [AUTOPILOT_LABEL, LATER_LABEL] };
    const heal = healingLabelActions(withLater, withLater.labels);
    assert.ok(!heal.remove.includes(LATER_LABEL));
    assert.ok(!heal.add.includes(LATER_LABEL));
    assert.deepStrictEqual(healingLabelActions(base, base.labels).add, []);
    assert.strictEqual(phaseForItem(withLater, {}), phaseForItem(base, {}));
    assert.strictEqual(isActionable(withLater, {}), isActionable(base, {}));
    const hitl = { ...withLater, status: 'Review', labels: [...withLater.labels, HITL_LABEL], hitlLabel: true };
    assert.ok(!healingLabelActions(hitl, hitl.labels).remove.includes(LATER_LABEL));
});

test('splitLaterBoard: タブ振り分けと件数・⚠ バッジ（あとでやる内の実行中 / 人間の番）', () => {
    const items = [
        { issue: 1, later: false, hitl: true },
        { issue: 2, later: true, hitl: false },
        { issue: 3, later: true, hitl: true },
        { issue: 4, later: true, hitl: true },
        { issue: 5, later: true, hitl: false },
    ];
    const r = splitLaterBoard(items, {}, [4, 5, 1]);
    assert.deepStrictEqual(r.normal.map((i) => i.issue), [1]);
    assert.deepStrictEqual(r.later.map((i) => i.issue), [2, 3, 4, 5]);
    // 実行中（4,5）は実行中として数え、人間の番は実行中でない 3 のみ
    assert.strictEqual(r.laterRunning, 2);
    assert.strictEqual(r.laterHitl, 1);
    // 通常側の実行中・人間の番は ⚠ に数えない
    const none = splitLaterBoard([{ issue: 1, later: false, hitl: true }], null, [1]);
    assert.strictEqual(none.laterRunning + none.laterHitl, 0);
    assert.deepStrictEqual(splitLaterBoard(undefined), { normal: [], later: [], laterRunning: 0, laterHitl: 0 });
});

test('splitLaterBoard / effectiveLater: 保留中の Issue は pending の目標を優先する', () => {
    const items = [{ issue: 1, later: false }, { issue: 2, later: true }];
    const pending = { 1: { desired: true }, 2: { desired: false } };
    const r = splitLaterBoard(items, pending, []);
    assert.deepStrictEqual(r.normal.map((i) => i.issue), [2]);
    assert.deepStrictEqual(r.later.map((i) => i.issue), [1]);
    assert.strictEqual(effectiveLater(items[0], pending), true);
    assert.strictEqual(effectiveLater(items[0], {}), false);
    assert.strictEqual(effectiveLater(items[1], undefined), true);
});

// ---- 連打対策（laterPendingReducer） ----

const reduce = (actions, init = {}) => actions.reduce(laterPendingReducer, init);

test('laterPendingReducer: クリックで即時移動（楽観的更新）→ 成功 → ボード追従で保留解除', () => {
    let s = reduce([{ type: 'request', issue: 7, later: true, current: false, seq: 1 }]);
    assert.deepStrictEqual(s[7], { desired: true, confirmed: false, seq: 1, inFlight: true, error: null });
    s = laterPendingReducer(s, { type: 'success', issue: 7, seq: 1, later: true });
    assert.strictEqual(s[7].inFlight, false);
    assert.strictEqual(s[7].confirmed, true);
    // ボードがまだ古い（later:false）間は保留を維持して行を戻さない
    s = laterPendingReducer(s, { type: 'board', items: [{ issue: 7, later: false }] });
    assert.strictEqual(effectiveLater({ issue: 7, later: false }, s), true);
    // ボードが追いついたら保留解除
    s = laterPendingReducer(s, { type: 'board', items: [{ issue: 7, later: true }] });
    assert.strictEqual(s[7], undefined);
});

test('laterPendingReducer: 失敗時は最後に確定した状態へ巻き戻す（エラー保持）', () => {
    let s = reduce([
        { type: 'request', issue: 7, later: true, current: false, seq: 1 },
        { type: 'failure', issue: 7, seq: 1, error: 'boom' },
    ]);
    assert.strictEqual(s[7].desired, false);
    assert.strictEqual(s[7].inFlight, false);
    assert.strictEqual(s[7].error, 'boom');
    assert.strictEqual(effectiveLater({ issue: 7, later: false }, s), false);
    s = laterPendingReducer(s, { type: 'board', items: [{ issue: 7, later: false }] });
    assert.strictEqual(s[7], undefined);
});

test('laterPendingReducer: 連続トグルは最後の意図が勝つ（古い応答で巻き戻らない）', () => {
    // あとで(seq1) → 今やる(seq2) を連続送信。seq1 の応答が後から返っても desired は false のまま
    let s = reduce([
        { type: 'request', issue: 7, later: true, current: false, seq: 1 },
        { type: 'request', issue: 7, later: false, current: true, seq: 2 },
    ]);
    assert.strictEqual(s[7].confirmed, false, '確定状態は最初の request 時点を引き継ぐ');
    s = laterPendingReducer(s, { type: 'success', issue: 7, seq: 1, later: true });
    assert.strictEqual(s[7].desired, false);
    assert.strictEqual(s[7].inFlight, true, '最新 seq はまだ送信中');
    assert.strictEqual(s[7].confirmed, true);
    s = laterPendingReducer(s, { type: 'success', issue: 7, seq: 2, later: false });
    assert.strictEqual(s[7].desired, false);
    assert.strictEqual(s[7].inFlight, false);
});

test('laterPendingReducer: 途中の古い失敗は後続リクエストを巻き戻さない', () => {
    let s = reduce([
        { type: 'request', issue: 7, later: true, current: false, seq: 1 },
        { type: 'request', issue: 7, later: false, current: true, seq: 2 },
        { type: 'failure', issue: 7, seq: 1, error: 'old' },
    ]);
    assert.strictEqual(s[7].desired, false);
    assert.strictEqual(s[7].inFlight, true);
    assert.strictEqual(s[7].error, null);
    // 最新の失敗は「最後に確定した状態」（最初の request 時点 = false）へ
    s = reduce([
        { type: 'request', issue: 7, later: true, current: false, seq: 1 },
        { type: 'request', issue: 7, later: false, current: true, seq: 2 },
        { type: 'request', issue: 7, later: true, current: false, seq: 3 },
        { type: 'success', issue: 7, seq: 2, later: false },
        { type: 'failure', issue: 7, seq: 3, error: 'x' },
    ]);
    assert.strictEqual(s[7].desired, false);
});

test('laterPendingReducer: サーバーが畳み込んだ最終状態で確定する', () => {
    // seq1 の応答がサーバー側の畳み込みで最終状態 false を返したら confirmed=false
    const s = reduce([
        { type: 'request', issue: 7, later: true, current: false, seq: 1 },
        { type: 'success', issue: 7, seq: 1, later: false },
    ]);
    assert.strictEqual(s[7].desired, false);
    assert.strictEqual(s[7].confirmed, false);
});

test('laterPendingReducer: ボード更新との競合 — 送信中は保留を維持、消えた Issue の保留は捨てる', () => {
    let s = reduce([
        { type: 'request', issue: 7, later: true, current: false, seq: 1 },
        { type: 'request', issue: 8, later: true, current: false, seq: 2 },
        { type: 'success', issue: 8, seq: 2, later: true },
    ]);
    // 7 は送信中 → ボードが古い状態でも保留維持。8 はボードから消えた → 捨てる
    s = laterPendingReducer(s, { type: 'board', items: [{ issue: 7, later: false }] });
    assert.ok(s[7]);
    assert.strictEqual(s[8], undefined);
    assert.strictEqual(splitLaterBoard([{ issue: 7, later: false }], s, []).later.length, 1);
});

test('laterPendingReducer: 未知の action / 未保留 issue の応答は状態を変えない（入力を破壊しない）', () => {
    const init = Object.freeze({});
    assert.strictEqual(laterPendingReducer(init, { type: 'success', issue: 1, seq: 1, later: true }), init);
    assert.strictEqual(laterPendingReducer(init, { type: 'failure', issue: 1, seq: 1 }), init);
    assert.strictEqual(laterPendingReducer(init, { type: 'nope' }), init);
    const frozen = Object.freeze({ 7: Object.freeze({ desired: true, confirmed: false, seq: 1, inFlight: true, error: null }) });
    laterPendingReducer(frozen, { type: 'success', issue: 7, seq: 1, later: true });
    assert.strictEqual(frozen[7].inFlight, true);
});

test('クライアント共有関数は自己完結（モニタへ toString 埋め込みで単独評価できる）', () => {
    const src = [canToggleLater, effectiveLater, splitLaterBoard, laterPendingReducer].map(String).join('\n');
    const ctx = vm.createContext({});
    vm.runInContext(src, ctx);
    const r = vm.runInContext('splitLaterBoard([{issue:1,later:true}], laterPendingReducer({}, {type:"request",issue:1,later:false,current:true,seq:1}), [])', ctx);
    assert.strictEqual(r.normal.length, 1);
    assert.strictEqual(vm.runInContext('canToggleLater({status:"Done"})', ctx), false);
});
