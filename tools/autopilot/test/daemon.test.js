'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const {
    applyMergeProgression, applyPrProjection, runTickOnce, detectStuck, markBlocked,
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
