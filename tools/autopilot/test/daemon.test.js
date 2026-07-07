'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const {
    applyMergeProgression, applyClosedReconcile, applyPrProjection, applyDodHandoffs, runTickOnce,
    detectStuck, markBlocked, getDirectives, applyEpicTracking, collectGateContexts,
} = require('../src/daemon');
const { HITL_LABEL, AUTOPILOT_LABEL } = require('../src/phases');

/** Build an injectable double for markBlocked/detectStuck that records side effects. */
function makeBlockDeps() {
    const calls = { setField: [], comments: [], syncFaces: [] };
    return {
        calls,
        token: 't',
        findItemId: () => 'x',
        setField: (ctx, itemId, field, value) => calls.setField.push({ itemId, field, value }),
        postIssueComment: (repo, number, body) => calls.comments.push({ number, body }),
        syncFaces: (item) => calls.syncFaces.push(item),
    };
}

function makeCfg() {
    return { owner: 'smalruby', project: 4, repo: 'smalruby/smalruby3-editor', projectId: 'P', fields: {} };
}

/** Build an injectable I/O double that records every side effect. */
function makeProjectionDeps({ prByIssue = {}, prInfo = {}, issueLabels = {} } = {}) {
    const calls = { editLabels: [], setPrDraft: [], sticky: [] };
    return {
        calls,
        token: 't',
        findPrForIssue: (repo, issue) => prByIssue[issue] || null,
        getPrInfo: (repo, prNumber) => prInfo[prNumber] || { isDraft: true, labels: [] },
        getIssueLabels: (repo, issue) => issueLabels[issue] || [],
        editLabels: (repo, number, type, diff) => calls.editLabels.push({ number, type, ...diff }),
        setPrDraft: (repo, prNumber, action) => calls.setPrDraft.push({ prNumber, action }),
        upsertStickyComment: (repo, prNumber, body) => calls.sticky.push({ prNumber, hasMarker: /autopilot-sticky-status/.test(body) }),
    };
}

test('applyMergeProgression: closes leaf with merged PR; skips not-merged/EPIC/terminal', () => {
    const items = [
        { issue: 1, itemId: 'i1', status: 'Review', kind: 'Issue' }, // merged -> Close
        { issue: 2, itemId: 'i2', status: 'DoD', kind: 'Issue' }, // not merged -> skip
        { issue: 3, itemId: 'i3', status: 'Review', kind: 'EPIC' }, // EPIC -> not a candidate
        { issue: 4, itemId: 'i4', status: 'Close', kind: 'Issue' }, // terminal -> not a candidate
    ];
    const mergedMap = { 1: true, 2: false };
    const applied = [];
    const state = { running: new Map() };
    applyMergeProgression(items, makeCfg(), state, () => {}, {
        token: 't',
        hasMergedPullRequest: (repo, issue) => mergedMap[issue],
        applyIntents: (ctx, itemId, intents) => {
            applied.push({ itemId, intents });
            return intents.map((i) => `${i.field}=${i.value}`);
        },
        findItemId: () => 'x',
        syncFaces: () => {},
    });
    assert.equal(applied.length, 1);
    assert.equal(applied[0].itemId, 'i1');
    const m = Object.fromEntries(applied[0].intents.map((i) => [i.field, i.value]));
    assert.equal(m.Status, 'Close');
    assert.equal(m['AI Status'], null);
});

test('applyMergeProgression: also closes the GitHub issue (Fix A, #843)', () => {
    // 非デフォルト base 宛て PR では GitHub の `Closes #N` 自動 close が効かないので、
    // leaf を Close へ前進させたら GitHub issue も明示 close する（冪等）。
    const items = [
        { issue: 1, itemId: 'i1', status: 'Review', kind: 'Issue' }, // merged -> Close + gh close
        { issue: 2, itemId: 'i2', status: 'Review', kind: 'Issue' }, // not merged -> no close
    ];
    const mergedMap = { 1: true, 2: false };
    const closed = [];
    const state = { running: new Map() };
    applyMergeProgression(items, makeCfg(), state, () => {}, {
        token: 't',
        hasMergedPullRequest: (repo, issue) => mergedMap[issue],
        applyIntents: (ctx, itemId, intents) => intents.map((i) => `${i.field}=${i.value}`),
        findItemId: () => 'x',
        closeIssue: (repo, issue) => closed.push(issue),
        syncFaces: () => {},
    });
    assert.deepEqual(closed, [1]);
});

test('applyMergeProgression: a failing gh close does not abort the loop (#843)', () => {
    const items = [
        { issue: 1, itemId: 'i1', status: 'Review', kind: 'Issue' },
        { issue: 2, itemId: 'i2', status: 'Review', kind: 'Issue' },
    ];
    const applied = [];
    const state = { running: new Map() };
    applyMergeProgression(items, makeCfg(), state, () => {}, {
        token: 't',
        hasMergedPullRequest: () => true,
        applyIntents: (ctx, itemId) => { applied.push(itemId); return []; },
        findItemId: () => 'x',
        closeIssue: (repo, issue) => { if (issue === 1) throw new Error('boom'); },
        syncFaces: () => {},
    });
    assert.deepEqual(applied, ['i1', 'i2']);
});

test('applyClosedReconcile: closed non-terminal items -> Status=Close + clear AI Status (incl. EPIC)', () => {
    const items = [
        { issue: 738, itemId: 'e1', status: 'Review', kind: 'EPIC' }, // closed EPIC -> reconcile
        { issue: 839, itemId: 'i1', status: 'Review', kind: 'Issue' }, // closed leaf -> reconcile
        { issue: 900, itemId: 'i2', status: 'Close', kind: 'Issue' }, // closed but terminal -> skip
        { issue: 901, itemId: 'i3', status: 'In Progress', kind: 'Issue' }, // open on GitHub -> skip
    ];
    const applied = [];
    const faces = [];
    const state = { running: new Map() };
    applyClosedReconcile(items, makeCfg(), state, () => {}, {
        token: 't',
        listClosedIssueNumbers: () => new Set([738, 839, 900]),
        applyIntents: (ctx, itemId, intents) => { applied.push({ itemId, intents }); return []; },
        findItemId: () => 'x',
        syncFaces: (item) => faces.push(item.issue),
    });
    assert.deepEqual(applied.map((a) => a.itemId).sort(), ['e1', 'i1']);
    for (const a of applied) {
        const m = Object.fromEntries(a.intents.map((i) => [i.field, i.value]));
        assert.equal(m.Status, 'Close');
        assert.equal(m['AI Status'], null);
    }
    assert.deepEqual(faces.sort((x, y) => x - y), [738, 839]);
});

test('applyClosedReconcile: skips running items (does not fight a live phase)', () => {
    const items = [{ issue: 839, itemId: 'i1', status: 'Review', kind: 'Issue' }];
    const applied = [];
    const state = { running: new Map([[839, { phase: 'review' }]]) };
    applyClosedReconcile(items, makeCfg(), state, () => {}, {
        token: 't',
        listClosedIssueNumbers: () => new Set([839]),
        applyIntents: (ctx, itemId) => { applied.push(itemId); return []; },
        findItemId: () => 'x',
        syncFaces: () => {},
    });
    assert.deepEqual(applied, []);
});

test('applyClosedReconcile: a failing listClosedIssueNumbers is a no-op (does not throw)', () => {
    const items = [{ issue: 839, itemId: 'i1', status: 'Review', kind: 'Issue' }];
    const applied = [];
    const state = { running: new Map() };
    assert.doesNotThrow(() => applyClosedReconcile(items, makeCfg(), state, () => {}, {
        token: 't',
        listClosedIssueNumbers: () => { throw new Error('rate limit'); },
        applyIntents: (ctx, itemId) => { applied.push(itemId); return []; },
        findItemId: () => 'x',
        syncFaces: () => {},
    }));
    assert.deepEqual(applied, []);
});

test('applyClosedReconcile: one failing item does not block others', () => {
    const items = [
        { issue: 1, itemId: 'i1', status: 'Review', kind: 'Issue' }, // apply throws
        { issue: 2, itemId: 'i2', status: 'Review', kind: 'Issue' }, // ok
    ];
    const applied = [];
    const state = { running: new Map() };
    applyClosedReconcile(items, makeCfg(), state, () => {}, {
        token: 't',
        listClosedIssueNumbers: () => new Set([1, 2]),
        applyIntents: (ctx, itemId) => {
            if (itemId === 'i1') throw new Error('boom');
            applied.push(itemId);
            return [];
        },
        findItemId: () => 'x',
        syncFaces: () => {},
    });
    assert.deepEqual(applied, ['i2']);
});

test('applyMergeProgression: skips items currently running (does not fight a live phase)', () => {
    const items = [{ issue: 1, itemId: 'i1', status: 'Review', kind: 'Issue' }];
    const applied = [];
    const state = { running: new Map([[1, { phase: 'review' }]]) };
    applyMergeProgression(items, makeCfg(), state, () => {}, {
        token: 't',
        hasMergedPullRequest: () => true,
        applyIntents: (ctx, itemId, intents) => {
            applied.push(intents);
            return [];
        },
        findItemId: () => 'x',
        syncFaces: () => {},
    });
    assert.equal(applied.length, 0);
});

test('applyMergeProgression: a failing merge check on one item does not block others', () => {
    const items = [
        { issue: 1, itemId: 'i1', status: 'Review', kind: 'Issue' }, // check throws
        { issue: 2, itemId: 'i2', status: 'Review', kind: 'Issue' }, // merged -> Close
    ];
    const applied = [];
    const state = { running: new Map() };
    applyMergeProgression(items, makeCfg(), state, () => {}, {
        token: 't',
        hasMergedPullRequest: (repo, issue) => {
            if (issue === 1) throw new Error('boom');
            return true;
        },
        applyIntents: (ctx, itemId, intents) => {
            applied.push(itemId);
            return [];
        },
        findItemId: () => 'x',
        syncFaces: () => {},
    });
    assert.deepEqual(applied, ['i2']);
});

test('applyPrProjection: Review handoff (HITL=Yes) -> ensure HITL label + Ready + sticky', () => {
    const items = [{ issue: 1, itemId: 'i1', status: 'Review', kind: 'Issue', hitlLabel: true, aiStatus: null, size: 'small' }];
    const deps = makeProjectionDeps({
        prByIssue: { 1: { number: 100 } },
        prInfo: { 100: { isDraft: true, labels: [AUTOPILOT_LABEL] } },
        issueLabels: { 1: [AUTOPILOT_LABEL] },
    });
    const state = { running: new Map() };
    // force=true models the authoritative handoff transition
    applyPrProjection(items, makeCfg(), state, () => {}, { ...deps, force: true });
    // PR converted to Ready (was draft, HITL=Yes wants Ready)
    assert.deepEqual(deps.calls.setPrDraft, [{ prNumber: 100, action: 'ready' }]);
    // HITL label added on both issue and PR
    const prEdit = deps.calls.editLabels.find((e) => e.type === 'pr');
    assert.ok(prEdit.add.includes(HITL_LABEL));
    const issueEdit = deps.calls.editLabels.find((e) => e.type === 'issue');
    assert.ok(issueEdit.add.includes(HITL_LABEL));
    // sticky upserted with marker
    assert.deepEqual(deps.calls.sticky, [{ prNumber: 100, hasMarker: true }]);
});

test('applyPrProjection: per-tick on Review does NOT re-add a human-removed HITL label', () => {
    const items = [{ issue: 1, itemId: 'i1', status: 'Review', kind: 'Issue', hitlLabel: true }];
    const deps = makeProjectionDeps({
        prByIssue: { 1: { number: 100 } },
        // human removed the HITL label from the PR (release gesture); only autopilot label remains
        prInfo: { 100: { isDraft: false, labels: [AUTOPILOT_LABEL] } },
        issueLabels: { 1: [AUTOPILOT_LABEL, HITL_LABEL] },
    });
    const state = { running: new Map() };
    applyPrProjection(items, makeCfg(), state, () => {}, deps); // non-force (steady-state)
    // no HITL label add anywhere (release must survive)
    for (const e of deps.calls.editLabels) assert.ok(!(e.add || []).includes(HITL_LABEL));
    // draft unchanged (already Ready), so no toggle
    assert.deepEqual(deps.calls.setPrDraft, []);
});

test('applyPrProjection: HITL=No reconciles labels off and PR back to Draft', () => {
    const items = [{ issue: 1, itemId: 'i1', status: 'In Progress', kind: 'Issue', hitlLabel: false, aiStatus: 'Implementing' }];
    const deps = makeProjectionDeps({
        prByIssue: { 1: { number: 100 } },
        prInfo: { 100: { isDraft: false, labels: [AUTOPILOT_LABEL, HITL_LABEL] } },
        issueLabels: { 1: [AUTOPILOT_LABEL, HITL_LABEL] },
    });
    const state = { running: new Map() };
    applyPrProjection(items, makeCfg(), state, () => {}, deps);
    // PR back to Draft (was Ready)
    assert.deepEqual(deps.calls.setPrDraft, [{ prNumber: 100, action: 'draft' }]);
    // HITL label removed on issue and PR
    assert.ok(deps.calls.editLabels.find((e) => e.type === 'pr').remove.includes(HITL_LABEL));
    assert.ok(deps.calls.editLabels.find((e) => e.type === 'issue').remove.includes(HITL_LABEL));
});

test('applyPrProjection: skips running items (does not fight a live phase)', () => {
    const items = [{ issue: 1, itemId: 'i1', status: 'Review', kind: 'Issue', hitlLabel: true }];
    const deps = makeProjectionDeps({ prByIssue: { 1: { number: 100 } } });
    const state = { running: new Map([[1, { phase: 'review' }]]) };
    applyPrProjection(items, makeCfg(), state, () => {}, deps);
    assert.deepEqual(deps.calls.editLabels, []);
    assert.deepEqual(deps.calls.setPrDraft, []);
    assert.deepEqual(deps.calls.sticky, []);
});

test('applyPrProjection: no PR yet -> only the issue label is reconciled', () => {
    const items = [{ issue: 1, itemId: 'i1', status: 'Blocked', kind: 'Issue', hitlLabel: true }];
    const deps = makeProjectionDeps({ issueLabels: { 1: [AUTOPILOT_LABEL] } });
    const state = { running: new Map() };
    applyPrProjection(items, makeCfg(), state, () => {}, deps);
    assert.deepEqual(deps.calls.setPrDraft, []);
    assert.deepEqual(deps.calls.sticky, []);
    const issueEdit = deps.calls.editLabels.find((e) => e.type === 'issue');
    assert.ok(issueEdit.add.includes(HITL_LABEL));
});

test('runTickOnce: runs tick once and returns its summary (ran:true)', async () => {
    const state = { paused: false, running: new Map(), ticking: false };
    let calls = 0;
    let tickingDuringRun = null;
    const fakeTick = async () => {
        calls += 1;
        tickingDuringRun = state.ticking; // re-entrancy flag must be held during the run
        return { paused: false, picked: [1, 2] };
    };
    const result = await runTickOnce(makeCfg(), state, () => {}, { tick: fakeTick });
    assert.equal(calls, 1);
    assert.equal(tickingDuringRun, true);
    assert.equal(result.ran, true);
    assert.equal(result.paused, false);
    assert.deepEqual(result.picked, [1, 2]);
    // flag released after completion
    assert.equal(state.ticking, false);
});

test('runTickOnce: re-entrancy guard returns busy (409) without calling tick', async () => {
    const state = { paused: false, running: new Map(), ticking: true }; // a tick is already in flight
    let calls = 0;
    const fakeTick = async () => { calls += 1; return { paused: false, picked: [] }; };
    const result = await runTickOnce(makeCfg(), state, () => {}, { tick: fakeTick });
    assert.equal(calls, 0);
    assert.equal(result.ran, false);
    assert.equal(result.busy, true);
});

test('runTickOnce: paused tick is a no-op surfaced in the response', async () => {
    const state = { paused: true, running: new Map(), ticking: false };
    const fakeTick = async () => ({ paused: true, picked: [] });
    const result = await runTickOnce(makeCfg(), state, () => {}, { tick: fakeTick });
    assert.equal(result.ran, true);
    assert.equal(result.paused, true);
    assert.deepEqual(result.picked, []);
});

test('runTickOnce: releases the ticking flag even when tick throws', async () => {
    const state = { paused: false, running: new Map(), ticking: false };
    const fakeTick = async () => { throw new Error('boom'); };
    await assert.rejects(() => runTickOnce(makeCfg(), state, () => {}, { tick: fakeTick }), /boom/);
    assert.equal(state.ticking, false);
});

test('applyPrProjection: a failing item does not block others', () => {
    const items = [
        { issue: 1, itemId: 'i1', status: 'Review', kind: 'Issue', hitlLabel: true },
        { issue: 2, itemId: 'i2', status: 'In Progress', kind: 'Issue', hitlLabel: false },
    ];
    const deps = makeProjectionDeps({
        prByIssue: { 1: { number: 100 }, 2: { number: 200 } },
        prInfo: { 100: { isDraft: true, labels: [] }, 200: { isDraft: true, labels: [AUTOPILOT_LABEL] } },
        issueLabels: { 1: [], 2: [AUTOPILOT_LABEL] },
    });
    const origGetPrInfo = deps.getPrInfo;
    deps.getPrInfo = (repo, n) => { if (n === 100) throw new Error('boom'); return origGetPrInfo(repo, n); };
    const state = { running: new Map() };
    applyPrProjection(items, makeCfg(), state, () => {}, deps);
    // issue 2 still processed (sticky on PR 200)
    assert.ok(deps.calls.sticky.some((s) => s.prNumber === 200));
});

// === #821: applyDodHandoffs（DoD 引き継ぎ生成） ===

/** Build an injectable double for applyDodHandoffs that records posted comments. */
function makeDodDeps({ prByIssue = {}, commentsByPr = {}, issueBody = {} } = {}) {
    const calls = { posted: [] };
    return {
        calls,
        token: 't',
        findPrForIssue: (repo, issue) => prByIssue[issue] || null,
        listIssueComments: (repo, prNumber) => commentsByPr[prNumber] || [],
        getIssueBody: (repo, issue) => issueBody[issue] || '',
        postIssueComment: (repo, prNumber, body) => calls.posted.push({ prNumber, body }),
    };
}

test('applyDodHandoffs: DoD leaf with PR + no handoff -> posts one handoff comment', () => {
    const items = [{ issue: 631, itemId: 'i', status: 'DoD', kind: 'Issue', hitlLabel: true }];
    const deps = makeDodDeps({
        prByIssue: { 631: { number: 818, branch: 'topic/autopilot-631' } },
        commentsByPr: { 818: [{ id: 1, body: 'Preview: https://smalruby.jp/smalruby3-editor/topic/autopilot-631/' }] },
        issueBody: { 631: '## DoD\n\n- [ ] ボタンが表示される\n\n## 備考\nx' },
    });
    const state = { running: new Map() };
    applyDodHandoffs(items, makeCfg(), state, () => {}, deps);
    assert.equal(deps.calls.posted.length, 1);
    assert.equal(deps.calls.posted[0].prNumber, 818);
    assert.match(deps.calls.posted[0].body, /<!-- autopilot:dod-handoff issue=631 pr=818 -->/);
    assert.match(deps.calls.posted[0].body, /https:\/\/smalruby\.jp\/smalruby3-editor\/topic\/autopilot-631\//);
    assert.match(deps.calls.posted[0].body, /- \[ \] ボタンが表示される/);
});

test('applyDodHandoffs: idempotent — existing handoff comment is not reposted', () => {
    const items = [{ issue: 631, itemId: 'i', status: 'DoD', kind: 'Issue', hitlLabel: true }];
    const deps = makeDodDeps({
        prByIssue: { 631: { number: 818, branch: 'b' } },
        commentsByPr: { 818: [{ id: 1, body: '<!-- autopilot:dod-handoff issue=631 pr=818 -->\nalready here' }] },
        issueBody: { 631: '## DoD\n- [ ] x' },
    });
    const state = { running: new Map() };
    applyDodHandoffs(items, makeCfg(), state, () => {}, deps);
    assert.equal(deps.calls.posted.length, 0);
});

test('applyDodHandoffs: skips non-DoD, EPIC, no-PR, and running items', () => {
    const items = [
        { issue: 1, status: 'Review', kind: 'Issue' }, // not DoD
        { issue: 2, status: 'DoD', kind: 'EPIC' }, // EPIC
        { issue: 3, status: 'DoD', kind: 'Issue' }, // no PR
        { issue: 4, status: 'DoD', kind: 'Issue' }, // running
    ];
    const deps = makeDodDeps({ prByIssue: { 4: { number: 404, branch: 'b' } }, issueBody: { 4: '## DoD\n- [ ] y' } });
    const state = { running: new Map([[4, { phase: 'address-review' }]]) };
    applyDodHandoffs(items, makeCfg(), state, () => {}, deps);
    assert.equal(deps.calls.posted.length, 0);
});

test('applyDodHandoffs: a failing item does not block others', () => {
    const items = [
        { issue: 1, status: 'DoD', kind: 'Issue' }, // findPr throws
        { issue: 2, status: 'DoD', kind: 'Issue' }, // ok -> posts
    ];
    const deps = makeDodDeps({
        prByIssue: { 2: { number: 200, branch: 'b' } },
        commentsByPr: { 200: [] },
        issueBody: { 2: '## DoD\n- [ ] z' },
    });
    const origFind = deps.findPrForIssue;
    deps.findPrForIssue = (repo, issue) => { if (issue === 1) throw new Error('boom'); return origFind(repo, issue); };
    const state = { running: new Map() };
    applyDodHandoffs(items, makeCfg(), state, () => {}, deps);
    assert.deepEqual(deps.calls.posted.map((p) => p.prNumber), [200]);
});

// === 🧭 tracking: applyEpicTracking（分解済み親のトラッカー化） ===

test('applyEpicTracking: ラベル無し EPIC に 🧭 tracking を付与、終端/付与済み/実行中/leaf はスキップ', () => {
    const { TRACKING_LABEL } = require('../src/phases');
    const items = [
        { issue: 1, status: 'In Progress', kind: 'EPIC', labels: [] }, // 付与
        { issue: 2, status: 'In Progress', kind: 'EPIC', labels: [TRACKING_LABEL] }, // 付与済み
        { issue: 3, status: 'Close', kind: 'EPIC', labels: [] }, // 終端
        { issue: 4, status: 'In Progress', kind: 'Issue', labels: [] }, // leaf
        { issue: 5, status: 'Backlog', kind: 'EPIC', labels: [] }, // 実行中
    ];
    const added = [];
    const state = { running: new Map([[5, { phase: 'decompose' }]]) };
    applyEpicTracking(items, makeCfg(), state, () => {}, {
        token: 't',
        editLabels: (repo, number, type, diff) => added.push({ number, type, ...diff }),
    });
    assert.deepEqual(added, [{ number: 1, type: 'issue', add: [TRACKING_LABEL] }]);
});

test('applyEpicTracking: 1 件の失敗は他を止めない', () => {
    const items = [
        { issue: 1, status: 'Backlog', kind: 'EPIC', labels: [] },
        { issue: 2, status: 'Backlog', kind: 'EPIC', labels: [] },
    ];
    const added = [];
    const state = { running: new Map() };
    applyEpicTracking(items, makeCfg(), state, () => {}, {
        token: 't',
        editLabels: (repo, number) => { if (number === 1) throw new Error('boom'); added.push(number); },
    });
    assert.deepEqual(added, [2]);
});

// === 人間ゲート: collectGateContexts（コメント解除 + watermark） ===

test('collectGateContexts: 発言アクティビティから humanSpokeLast を導く（コメント解除の配線）', () => {
    const { isGateItem } = require('../src/daemon');
    const items = [
        { issue: 1, status: 'Review', kind: 'Issue', hitlLabel: true }, // 人間が最後に発言 → 解除
        { issue: 2, status: 'DoD', kind: 'Issue', hitlLabel: true }, // bot が最後 → 待ち
        { issue: 3, status: 'Blocked', kind: 'Issue', hitlLabel: true }, // PR 無しゲートも収集
        { issue: 4, status: 'Backlog', aiStatus: 'Discussing', kind: 'Issue', hitlLabel: true }, // 議論ゲート
        { issue: 5, status: 'Sprint Backlog', kind: 'Issue' }, // ゲートではない
    ];
    assert.equal(isGateItem(items[4]), false);
    const gateCtx = {
        1: { hitlSignals: { issueLabel: true, prLabel: true }, review: {}, pr: 10, activity: { lastHumanAt: 200, lastBotAt: 100 } },
        2: { hitlSignals: { issueLabel: true, prLabel: true }, review: {}, pr: 20, activity: { lastHumanAt: 100, lastBotAt: 200 } },
        3: { hitlSignals: { issueLabel: true }, review: null, pr: null, activity: { lastHumanAt: 300, lastBotAt: 100 } },
        4: { hitlSignals: { issueLabel: true }, review: null, pr: null, activity: { lastHumanAt: 400, lastBotAt: 100 } },
    };
    const state = { running: new Map() };
    const contexts = collectGateContexts(makeCfg(), items, new Set(), state, () => {}, {
        token: 't',
        getGateContext: (repo, issue) => gateCtx[issue],
    });
    assert.equal(contexts[1].humanSpokeLast, true);
    assert.equal(contexts[2].humanSpokeLast, false);
    assert.equal(contexts[3].humanSpokeLast, true);
    assert.equal(contexts[4].humanSpokeLast, true);
    assert.ok(!(5 in contexts));
});

test('collectGateContexts: watermark（gateHandled）より古い発言では再発火しない', () => {
    const items = [{ issue: 1, status: 'Review', kind: 'Issue', hitlLabel: true }];
    const state = { running: new Map(), gateHandled: new Map([[1, 250]]) };
    const deps = {
        token: 't',
        getGateContext: () => ({
            hitlSignals: { issueLabel: true, prLabel: true }, review: {}, pr: 10,
            activity: { lastHumanAt: 200, lastBotAt: 100 },
        }),
    };
    const contexts = collectGateContexts(makeCfg(), items, new Set(), state, () => {}, deps);
    assert.equal(contexts[1].humanSpokeLast, false); // 200 < watermark 250
    // watermark 後に人間がさらに発言 → 再度解除
    deps.getGateContext = () => ({
        hitlSignals: { issueLabel: true, prLabel: true }, review: {}, pr: 10,
        activity: { lastHumanAt: 300, lastBotAt: 100 },
    });
    const contexts2 = collectGateContexts(makeCfg(), items, new Set(), state, () => {}, deps);
    assert.equal(contexts2[1].humanSpokeLast, true);
});

// === directives: getDirectives（autopilot-base / autopilot-after の TTL キャッシュ） ===

test('getDirectives: 本文から base/after を導き TTL 内はキャッシュを返す', () => {
    let fetches = 0;
    let now = 0;
    const cfg = { ...makeCfg(), now: () => now, directiveTtlMs: 1000 };
    const state = {};
    const deps = {
        token: 't',
        getIssueBody: () => { fetches += 1; return 'autopilot-base: topic/x\nautopilot-after: #9'; },
    };
    const d1 = getDirectives(cfg, state, 5, () => {}, deps);
    assert.equal(d1.base, 'topic/x');
    assert.deepEqual(d1.after, [9]);
    assert.equal(fetches, 1);
    // TTL 内は再取得しない
    now = 999;
    getDirectives(cfg, state, 5, () => {}, deps);
    assert.equal(fetches, 1);
    // TTL 超過で再取得
    now = 1001;
    getDirectives(cfg, state, 5, () => {}, deps);
    assert.equal(fetches, 2);
});

test('getDirectives: 取得失敗は空ディレクティブへフォールバックし次回再取得', () => {
    let calls = 0;
    const cfg = { ...makeCfg(), now: () => 0, directiveTtlMs: 1000 };
    const state = {};
    const deps = {
        token: 't',
        getIssueBody: () => { calls += 1; if (calls === 1) throw new Error('boom'); return 'autopilot-after: #3'; },
    };
    const d1 = getDirectives(cfg, state, 5, () => {}, deps);
    assert.equal(d1.base, null);
    assert.deepEqual(d1.after, []);
    // 失敗エントリは TTL 切れ扱い → 次回すぐ再取得して成功する
    const d2 = getDirectives(cfg, state, 5, () => {}, deps);
    assert.deepEqual(d2.after, [3]);
});

// === #816: markBlocked / detectStuck（失敗・stall 時の人間ハンドオフ） ===

test('markBlocked: Blocked + 説明コメント + 🙋 face sync を行う', () => {
    const deps = makeBlockDeps();
    const item = { issue: 9, itemId: 'i9', status: 'In Progress', kind: 'Issue' };
    markBlocked(item, 'run が失敗しました', makeCfg(), () => {}, deps);
    assert.deepEqual(deps.calls.setField, [{ itemId: 'i9', field: 'Status', value: 'Blocked' }]);
    assert.equal(deps.calls.comments.length, 1);
    assert.match(deps.calls.comments[0].body, /run が失敗しました/);
    // face sync は Blocked + hitlLabel:true（人間の番）で呼ばれる
    assert.equal(deps.calls.syncFaces[0].status, 'Blocked');
    assert.equal(deps.calls.syncFaces[0].hitlLabel, true);
});

test('markBlocked: body 無しならコメントしない（Status と face sync のみ）', () => {
    const deps = makeBlockDeps();
    markBlocked({ issue: 9, itemId: 'i9' }, null, makeCfg(), () => {}, deps);
    assert.equal(deps.calls.comments.length, 0);
    assert.equal(deps.calls.setField.length, 1);
});

test('detectStuck: stuckMs 未満は記録のみ、超過で Blocked + コメント (#816)', () => {
    const deps = makeBlockDeps();
    const cfg = { ...makeCfg(), now: () => 1000, stuckMs: 5000 };
    const state = { running: new Map() };
    const items = [{ issue: 7, itemId: 'i7', status: 'In Progress', aiStatus: 'Implementing' }];
    // 1 回目: 初観測 -> 記録のみ、まだ block しない
    detectStuck(items, cfg, state, () => {}, deps);
    assert.equal(deps.calls.setField.length, 0);
    assert.equal(state.stuckSince.get(7), 1000);
    // stuckMs 経過後 -> Blocked + コメント
    cfg.now = () => 1000 + 5000;
    detectStuck(items, cfg, state, () => {}, deps);
    assert.deepEqual(deps.calls.setField, [{ itemId: 'i7', field: 'Status', value: 'Blocked' }]);
    assert.match(deps.calls.comments[0].body, /In Progress/);
    assert.equal(state.stuckSince.has(7), false); // 追跡解除
});

test('detectStuck: 実行中の run が所有する item は触らない', () => {
    const deps = makeBlockDeps();
    const cfg = { ...makeCfg(), now: () => 0, stuckMs: 1 };
    const state = { running: new Map([[7, { phase: 'implement' }]]), stuckSince: new Map([[7, -10000]]) };
    const items = [{ issue: 7, itemId: 'i7', status: 'In Progress', aiStatus: 'Implementing' }];
    detectStuck(items, cfg, state, () => {}, deps);
    assert.equal(deps.calls.setField.length, 0);
});

test('detectStuck: 候補でなくなった item は追跡から外す', () => {
    const deps = makeBlockDeps();
    const cfg = { ...makeCfg(), now: () => 0, stuckMs: 1000 };
    const state = { running: new Map(), stuckSince: new Map([[7, -100]]) };
    // status が Review に進んだ -> stuck 候補ではない
    const items = [{ issue: 7, itemId: 'i7', status: 'Review', aiStatus: null }];
    detectStuck(items, cfg, state, () => {}, deps);
    assert.equal(deps.calls.setField.length, 0);
    assert.equal(state.stuckSince.has(7), false);
});
