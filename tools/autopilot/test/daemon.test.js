'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const {
    applyMergeProgression, applyClosedReconcile, applyPrProjection, applyDodHandoffs, runTickOnce,
    detectStuck, markBlocked, getDirectives, applyLabelHealing, applyAfterWaitLabels, collectGateContexts,
    applyDecomposeSubIssueSetup,
    parseSsoDeviceOutput, startReauth,
    updateClaudeUsage, boardResponse, statusResponse,
    checkForUpdate, startUpdateChecks,
    patchBoardCache,
    ensureCheckpointCommit, readContinuationFromWorktree, applyCheckpointHandling,
    collectContinuationContexts, checkpointEscalationBody,
    applyTrackerStickies, refreshBoardAndProjectTrackers,
} = require('../src/daemon');
const { EventEmitter } = require('node:events');
const { HITL_LABEL, AUTOPILOT_LABEL, continuationMarker, TRACKER_STICKY_MARKER } = require('../src/phases');

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

test('applyMergeProgression: closes leaf with merged PR; skips not-merged/EPIC/terminal', async () => {
    const items = [
        { issue: 1, itemId: 'i1', status: 'Review', kind: 'Issue' }, // merged -> Close
        { issue: 2, itemId: 'i2', status: 'DoD', kind: 'Issue' }, // not merged -> skip
        { issue: 3, itemId: 'i3', status: 'Review', kind: 'EPIC' }, // EPIC -> not a candidate
        { issue: 4, itemId: 'i4', status: 'Close', kind: 'Issue' }, // terminal -> not a candidate
    ];
    const mergedMap = { 1: true, 2: false };
    const applied = [];
    const state = { running: new Map() };
    await applyMergeProgression(items, makeCfg(), state, () => {}, {
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

test('applyMergeProgression: also closes the GitHub issue (Fix A, #843)', async () => {
    // 非デフォルト base 宛て PR では GitHub の `Closes #N` 自動 close が効かないので、
    // leaf を Close へ前進させたら GitHub issue も明示 close する（冪等）。
    const items = [
        { issue: 1, itemId: 'i1', status: 'Review', kind: 'Issue' }, // merged -> Close + gh close
        { issue: 2, itemId: 'i2', status: 'Review', kind: 'Issue' }, // not merged -> no close
    ];
    const mergedMap = { 1: true, 2: false };
    const closed = [];
    const state = { running: new Map() };
    await applyMergeProgression(items, makeCfg(), state, () => {}, {
        token: 't',
        hasMergedPullRequest: (repo, issue) => mergedMap[issue],
        applyIntents: (ctx, itemId, intents) => intents.map((i) => `${i.field}=${i.value}`),
        findItemId: () => 'x',
        closeIssue: (repo, issue) => closed.push(issue),
        syncFaces: () => {},
    });
    assert.deepEqual(closed, [1]);
});

test('applyMergeProgression: a failing gh close does not abort the loop (#843)', async () => {
    const items = [
        { issue: 1, itemId: 'i1', status: 'Review', kind: 'Issue' },
        { issue: 2, itemId: 'i2', status: 'Review', kind: 'Issue' },
    ];
    const applied = [];
    const state = { running: new Map() };
    await applyMergeProgression(items, makeCfg(), state, () => {}, {
        token: 't',
        hasMergedPullRequest: () => true,
        applyIntents: (ctx, itemId) => { applied.push(itemId); return []; },
        findItemId: () => 'x',
        closeIssue: (repo, issue) => { if (issue === 1) throw new Error('boom'); },
        syncFaces: () => {},
    });
    assert.deepEqual(applied, ['i1', 'i2']);
});

test('applyClosedReconcile: closed non-terminal items -> Status=Close + clear AI Status (incl. EPIC)', async () => {
    const items = [
        { issue: 738, itemId: 'e1', status: 'Review', kind: 'EPIC' }, // closed EPIC -> reconcile
        { issue: 839, itemId: 'i1', status: 'Review', kind: 'Issue' }, // closed leaf -> reconcile
        { issue: 900, itemId: 'i2', status: 'Close', kind: 'Issue' }, // closed but terminal -> skip
        { issue: 901, itemId: 'i3', status: 'In Progress', kind: 'Issue' }, // open on GitHub -> skip
    ];
    const applied = [];
    const faces = [];
    const state = { running: new Map() };
    await applyClosedReconcile(items, makeCfg(), state, () => {}, {
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

test('applyClosedReconcile: skips running items (does not fight a live phase)', async () => {
    const items = [{ issue: 839, itemId: 'i1', status: 'Review', kind: 'Issue' }];
    const applied = [];
    const state = { running: new Map([[839, { phase: 'review' }]]) };
    await applyClosedReconcile(items, makeCfg(), state, () => {}, {
        token: 't',
        listClosedIssueNumbers: () => new Set([839]),
        applyIntents: (ctx, itemId) => { applied.push(itemId); return []; },
        findItemId: () => 'x',
        syncFaces: () => {},
    });
    assert.deepEqual(applied, []);
});

test('applyClosedReconcile: a failing listClosedIssueNumbers is a no-op (does not throw)', async () => {
    const items = [{ issue: 839, itemId: 'i1', status: 'Review', kind: 'Issue' }];
    const applied = [];
    const state = { running: new Map() };
    await assert.doesNotReject(() => applyClosedReconcile(items, makeCfg(), state, () => {}, {
        token: 't',
        listClosedIssueNumbers: () => { throw new Error('rate limit'); },
        applyIntents: (ctx, itemId) => { applied.push(itemId); return []; },
        findItemId: () => 'x',
        syncFaces: () => {},
    }));
    assert.deepEqual(applied, []);
});

test('applyClosedReconcile: one failing item does not block others', async () => {
    const items = [
        { issue: 1, itemId: 'i1', status: 'Review', kind: 'Issue' }, // apply throws
        { issue: 2, itemId: 'i2', status: 'Review', kind: 'Issue' }, // ok
    ];
    const applied = [];
    const state = { running: new Map() };
    await applyClosedReconcile(items, makeCfg(), state, () => {}, {
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

test('applyMergeProgression: skips items currently running (does not fight a live phase)', async () => {
    const items = [{ issue: 1, itemId: 'i1', status: 'Review', kind: 'Issue' }];
    const applied = [];
    const state = { running: new Map([[1, { phase: 'review' }]]) };
    await applyMergeProgression(items, makeCfg(), state, () => {}, {
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

test('applyMergeProgression: a failing merge check on one item does not block others', async () => {
    const items = [
        { issue: 1, itemId: 'i1', status: 'Review', kind: 'Issue' }, // check throws
        { issue: 2, itemId: 'i2', status: 'Review', kind: 'Issue' }, // merged -> Close
    ];
    const applied = [];
    const state = { running: new Map() };
    await applyMergeProgression(items, makeCfg(), state, () => {}, {
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

test('applyPrProjection: Review handoff (HITL=Yes) -> ensure HITL label + Ready + sticky', async () => {
    const items = [{ issue: 1, itemId: 'i1', status: 'Review', kind: 'Issue', hitlLabel: true, aiStatus: null, size: 'small' }];
    const deps = makeProjectionDeps({
        prByIssue: { 1: { number: 100 } },
        prInfo: { 100: { isDraft: true, labels: [AUTOPILOT_LABEL] } },
        issueLabels: { 1: [AUTOPILOT_LABEL] },
    });
    const state = { running: new Map() };
    // force=true models the authoritative handoff transition
    await applyPrProjection(items, makeCfg(), state, () => {}, { ...deps, force: true });
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

test('applyPrProjection: per-tick on Review does NOT re-add a human-removed HITL label', async () => {
    const items = [{ issue: 1, itemId: 'i1', status: 'Review', kind: 'Issue', hitlLabel: true }];
    const deps = makeProjectionDeps({
        prByIssue: { 1: { number: 100 } },
        // human removed the HITL label from the PR (release gesture); only autopilot label remains
        prInfo: { 100: { isDraft: false, labels: [AUTOPILOT_LABEL] } },
        issueLabels: { 1: [AUTOPILOT_LABEL, HITL_LABEL] },
    });
    const state = { running: new Map() };
    await applyPrProjection(items, makeCfg(), state, () => {}, deps); // non-force (steady-state)
    // no HITL label add anywhere (release must survive)
    for (const e of deps.calls.editLabels) assert.ok(!(e.add || []).includes(HITL_LABEL));
    // draft unchanged (already Ready), so no toggle
    assert.deepEqual(deps.calls.setPrDraft, []);
});

test('applyPrProjection: HITL=No reconciles labels off and PR back to Draft', async () => {
    const items = [{ issue: 1, itemId: 'i1', status: 'In Progress', kind: 'Issue', hitlLabel: false, aiStatus: 'Implementing' }];
    const deps = makeProjectionDeps({
        prByIssue: { 1: { number: 100 } },
        prInfo: { 100: { isDraft: false, labels: [AUTOPILOT_LABEL, HITL_LABEL] } },
        issueLabels: { 1: [AUTOPILOT_LABEL, HITL_LABEL] },
    });
    const state = { running: new Map() };
    await applyPrProjection(items, makeCfg(), state, () => {}, deps);
    // PR back to Draft (was Ready)
    assert.deepEqual(deps.calls.setPrDraft, [{ prNumber: 100, action: 'draft' }]);
    // HITL label removed on issue and PR
    assert.ok(deps.calls.editLabels.find((e) => e.type === 'pr').remove.includes(HITL_LABEL));
    assert.ok(deps.calls.editLabels.find((e) => e.type === 'issue').remove.includes(HITL_LABEL));
});

test('applyPrProjection: skips running items (does not fight a live phase)', async () => {
    const items = [{ issue: 1, itemId: 'i1', status: 'Review', kind: 'Issue', hitlLabel: true }];
    const deps = makeProjectionDeps({ prByIssue: { 1: { number: 100 } } });
    const state = { running: new Map([[1, { phase: 'review' }]]) };
    await applyPrProjection(items, makeCfg(), state, () => {}, deps);
    assert.deepEqual(deps.calls.editLabels, []);
    assert.deepEqual(deps.calls.setPrDraft, []);
    assert.deepEqual(deps.calls.sticky, []);
});

test('applyPrProjection: no PR yet -> only the issue label is reconciled', async () => {
    const items = [{ issue: 1, itemId: 'i1', status: 'Blocked', kind: 'Issue', hitlLabel: true }];
    const deps = makeProjectionDeps({ issueLabels: { 1: [AUTOPILOT_LABEL] } });
    const state = { running: new Map() };
    await applyPrProjection(items, makeCfg(), state, () => {}, deps);
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

test('applyPrProjection: a failing item does not block others', async () => {
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
    await applyPrProjection(items, makeCfg(), state, () => {}, deps);
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

test('applyDodHandoffs: DoD leaf with PR + no handoff -> posts one handoff comment', async () => {
    const items = [{ issue: 631, itemId: 'i', status: 'DoD', kind: 'Issue', hitlLabel: true }];
    const deps = makeDodDeps({
        prByIssue: { 631: { number: 818, branch: 'topic/autopilot-631' } },
        commentsByPr: { 818: [{ id: 1, body: 'Preview: https://smalruby.jp/smalruby3-editor/topic/autopilot-631/' }] },
        issueBody: { 631: '## DoD\n\n- [ ] ボタンが表示される\n\n## 備考\nx' },
    });
    const state = { running: new Map() };
    await applyDodHandoffs(items, makeCfg(), state, () => {}, deps);
    assert.equal(deps.calls.posted.length, 1);
    assert.equal(deps.calls.posted[0].prNumber, 818);
    assert.match(deps.calls.posted[0].body, /<!-- autopilot:dod-handoff issue=631 pr=818 -->/);
    assert.match(deps.calls.posted[0].body, /https:\/\/smalruby\.jp\/smalruby3-editor\/topic\/autopilot-631\//);
    assert.match(deps.calls.posted[0].body, /- \[ \] ボタンが表示される/);
});

test('applyDodHandoffs: idempotent — existing handoff comment is not reposted', async () => {
    const items = [{ issue: 631, itemId: 'i', status: 'DoD', kind: 'Issue', hitlLabel: true }];
    const deps = makeDodDeps({
        prByIssue: { 631: { number: 818, branch: 'b' } },
        commentsByPr: { 818: [{ id: 1, body: '<!-- autopilot:dod-handoff issue=631 pr=818 -->\nalready here' }] },
        issueBody: { 631: '## DoD\n- [ ] x' },
    });
    const state = { running: new Map() };
    await applyDodHandoffs(items, makeCfg(), state, () => {}, deps);
    assert.equal(deps.calls.posted.length, 0);
});

test('applyDodHandoffs: skips non-DoD, EPIC, no-PR, and running items', async () => {
    const items = [
        { issue: 1, status: 'Review', kind: 'Issue' }, // not DoD
        { issue: 2, status: 'DoD', kind: 'EPIC' }, // EPIC
        { issue: 3, status: 'DoD', kind: 'Issue' }, // no PR
        { issue: 4, status: 'DoD', kind: 'Issue' }, // running
    ];
    const deps = makeDodDeps({ prByIssue: { 4: { number: 404, branch: 'b' } }, issueBody: { 4: '## DoD\n- [ ] y' } });
    const state = { running: new Map([[4, { phase: 'address-review' }]]) };
    await applyDodHandoffs(items, makeCfg(), state, () => {}, deps);
    assert.equal(deps.calls.posted.length, 0);
});

test('applyDodHandoffs: a failing item does not block others', async () => {
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
    await applyDodHandoffs(items, makeCfg(), state, () => {}, deps);
    assert.deepEqual(deps.calls.posted.map((p) => p.prNumber), [200]);
});

// === ラベル整合: applyLabelHealing（🤖 autopilot 担保 + 🧭 tracking トラッカー化） ===

test('applyLabelHealing: 非終端 item に 🤖 を、EPIC には 🧭 も担保。終端/付与済み/実行中はスキップ', async () => {
    const { TRACKING_LABEL, AUTOPILOT_LABEL } = require('../src/phases');
    const items = [
        { issue: 1, status: 'In Progress', kind: 'EPIC', labels: [] }, // 🤖 + 🧭
        { issue: 2, status: 'In Progress', kind: 'EPIC', labels: [AUTOPILOT_LABEL, TRACKING_LABEL] }, // 完備
        { issue: 3, status: 'Close', kind: 'EPIC', labels: [] }, // 終端 → 触らない
        { issue: 4, status: 'In Progress', kind: 'Issue', labels: [] }, // leaf → 🤖 のみ
        { issue: 5, status: 'Backlog', kind: 'EPIC', labels: [] }, // 実行中 → 触らない
        { issue: 6, status: 'Review', kind: 'Issue', labels: [AUTOPILOT_LABEL] }, // 完備
    ];
    const added = [];
    const state = { running: new Map([[5, { phase: 'decompose' }]]) };
    await applyLabelHealing(items, makeCfg(), state, () => {}, {
        token: 't',
        editLabels: (repo, number, type, diff) => added.push({ number, type, ...diff }),
    });
    assert.deepEqual(added, [
        { number: 1, type: 'issue', add: [AUTOPILOT_LABEL, TRACKING_LABEL] },
        { number: 4, type: 'issue', add: [AUTOPILOT_LABEL] },
    ]);
});

// === decompose 完了後の sub-issue Project フィールド補完（#914） ===

test('applyDecomposeSubIssueSetup: 新規 sub-issue に Status/Kind/Size を設定する (#914)', async () => {
    const result = {
        issue: 906, phase: 'decompose', signal: 'done', summary: 's',
        createdSubIssues: [910, 911], subIssueSizes: { 910: 'small', 911: 'middle' },
    };
    const applied = [];
    await applyDecomposeSubIssueSetup(result, makeCfg(), () => {}, {
        token: 't',
        addIssue: (owner, project, repo, num) => `item-${num}`,
        listItems: () => [],
        applyIntents: (ctx, itemId, intents) => {
            applied.push({ itemId, intents });
            return intents.map(i => `${i.field}=${i.value}`);
        },
    });
    assert.deepEqual(applied, [
        {
            itemId: 'item-910',
            intents: [
                { field: 'Status', value: 'Sprint Backlog' },
                { field: 'Kind', value: 'Issue' },
                { field: 'Size', value: 'small' },
            ],
        },
        {
            itemId: 'item-911',
            intents: [
                { field: 'Status', value: 'Sprint Backlog' },
                { field: 'Kind', value: 'Issue' },
                { field: 'Size', value: 'middle' },
            ],
        },
    ]);
});

test('applyDecomposeSubIssueSetup: createdSubIssues が空なら何もしない (#914)', async () => {
    const result = { issue: 906, phase: 'decompose', signal: 'done', summary: 's', createdSubIssues: [] };
    const calls = [];
    await applyDecomposeSubIssueSetup(result, makeCfg(), () => {}, {
        token: 't',
        addIssue: () => { calls.push('addIssue'); },
        listItems: () => { calls.push('listItems'); return []; },
        applyIntents: () => { calls.push('applyIntents'); },
    });
    assert.deepEqual(calls, []);
});

test('applyDecomposeSubIssueSetup: 既に値が入っている項目は上書きしない（冪等・#914）', async () => {
    const result = {
        issue: 906, phase: 'decompose', signal: 'done', summary: 's',
        createdSubIssues: [910], subIssueSizes: { 910: 'small' },
    };
    const applied = [];
    await applyDecomposeSubIssueSetup(result, makeCfg(), () => {}, {
        token: 't',
        addIssue: () => 'item-910',
        listItems: () => [{ issue: 910, status: 'Sprint Backlog', kind: 'Issue', size: 'large' }],
        applyIntents: (ctx, itemId, intents) => { applied.push(intents); },
    });
    assert.deepEqual(applied, []);
});

test('applyDecomposeSubIssueSetup: 1 件の失敗は他の sub-issue を止めない (#914)', async () => {
    const result = {
        issue: 906, phase: 'decompose', signal: 'done', summary: 's',
        createdSubIssues: [910, 911], subIssueSizes: {},
    };
    const applied = [];
    await applyDecomposeSubIssueSetup(result, makeCfg(), () => {}, {
        token: 't',
        addIssue: (owner, project, repo, num) => { if (num === 910) throw new Error('boom'); return `item-${num}`; },
        listItems: () => [],
        applyIntents: (ctx, itemId) => { applied.push(itemId); },
    });
    assert.deepEqual(applied, ['item-911']);
});

test('applyLabelHealing: 1 件の失敗は他を止めない', async () => {
    const items = [
        { issue: 1, status: 'Backlog', kind: 'EPIC', labels: [] },
        { issue: 2, status: 'Backlog', kind: 'EPIC', labels: [] },
    ];
    const added = [];
    const state = { running: new Map() };
    await applyLabelHealing(items, makeCfg(), state, () => {}, {
        token: 't',
        editLabels: (repo, number) => { if (number === 1) throw new Error('boom'); added.push(number); },
    });
    assert.deepEqual(added, [2]);
});

// === ⏳ waiting ラベル: applyAfterWaitLabels（autopilot-after ゲート可視化） ===

test('applyAfterWaitLabels: 待ち=付与 / 解決=除去 / 変化なし・examined 外はスキップ', async () => {
    const { WAITING_LABEL } = require('../src/phases');
    const candidates = [
        { issue: 1, labels: [] }, // 待ち & ラベル無し → add
        { issue: 2, labels: [WAITING_LABEL] }, // 解決 & ラベル有り → remove
        { issue: 3, labels: [WAITING_LABEL] }, // 待ち継続 & ラベル有り → 無操作
        { issue: 4, labels: [] }, // 解決 & ラベル無し → 無操作
        { issue: 5, labels: [] }, // examined 外（waitingByIssue に無い）→ スキップ
    ];
    const waitingByIssue = new Map([[1, true], [2, false], [3, true], [4, false]]);
    const calls = [];
    await applyAfterWaitLabels(candidates, waitingByIssue, makeCfg(), () => {}, {
        token: 't',
        editLabels: (repo, number, type, diff) => calls.push({ number, ...diff }),
    });
    assert.deepEqual(calls, [
        { number: 1, add: [WAITING_LABEL] },
        { number: 2, remove: [WAITING_LABEL] },
    ]);
});

test('applyAfterWaitLabels: 付け外しが無ければ token も取らない（副作用ゼロ）', async () => {
    const { WAITING_LABEL } = require('../src/phases');
    const candidates = [{ issue: 3, labels: [WAITING_LABEL] }];
    const waitingByIssue = new Map([[3, true]]); // 変化なし
    let tokenAsked = false;
    await applyAfterWaitLabels(candidates, waitingByIssue, makeCfg(), () => {}, {
        get token() { tokenAsked = true; return 't'; },
        editLabels: () => { throw new Error('should not be called'); },
    });
    assert.equal(tokenAsked, false);
});

// === 俯瞰ボード: refreshBoard / recordHistory ===

test('refreshBoard: 非終端 item を Board 順で enrich し state.board に置く', async () => {
    const { refreshBoard } = require('../src/daemon');
    const cfg = { ...makeCfg(), now: () => 1234, statusOrder: ['Backlog', 'Sprint Backlog', 'In Progress', 'Blocked', 'Review', 'DoD', 'Close', 'Icebox'] };
    const state = { running: new Map() };
    const items = [
        { issue: 1, status: 'Review', kind: 'Issue', title: 'r', labels: [], assignees: ['me'] },
        { issue: 2, status: 'Close', kind: 'Issue', title: 'c', labels: [] }, // 終端 → 除外
        { issue: 3, status: 'Sprint Backlog', kind: 'Issue', title: 's', labels: [] },
        { issue: 4, status: 'Icebox', kind: 'Issue', title: 'i', labels: [] }, // 保留 → 除外
        { issue: 5, status: 'In Progress', kind: 'EPIC', title: 'e', labels: ['🧭 tracking'] },
    ];
    await refreshBoard(cfg, state, () => {}, {
        token: 't',
        listItems: () => items,
        getBoardEnrichment: () => ({
            1: { subIssues: { total: 0, completed: 0, percent: 0 }, prs: [{ number: 100, state: 'OPEN', isDraft: false }] },
            5: { subIssues: { total: 4, completed: 2, percent: 50 }, prs: [] },
        }),
        listHeadPrs: () => [],
    });
    // Board 順: Sprint Backlog(3) → In Progress(5) → Review(1)。Close/Icebox は除外
    assert.deepEqual(state.board.items.map((i) => i.issue), [3, 5, 1]);
    assert.equal(state.board.updatedAt, 1234);
    const r1 = state.board.items.find((i) => i.issue === 1);
    assert.deepEqual(r1.prs, [{ number: 100, state: 'OPEN', isDraft: false }]);
    assert.deepEqual(r1.assignees, ['me']);
    const r5 = state.board.items.find((i) => i.issue === 5);
    assert.equal(r5.subIssues.percent, 50);
    assert.equal(r5.tracker, true);
});

test('refreshBoard: close リンクに PR が無い post-PR item は head ブランチで補完', async () => {
    const { refreshBoard } = require('../src/daemon');
    const cfg = { ...makeCfg(), now: () => 0, statusOrder: [] };
    const state = { running: new Map() };
    const headCalls = [];
    await refreshBoard(cfg, state, () => {}, {
        token: 't',
        listItems: () => [
            { issue: 7, status: 'Review', kind: 'Issue', title: 'x', labels: [] }, // PR 無し → head 補完
            { issue: 8, status: 'Backlog', kind: 'Issue', title: 'y', labels: [] }, // pre-PR → 補完しない
        ],
        getBoardEnrichment: () => ({}),
        listHeadPrs: (repo, issue) => { headCalls.push(issue); return [{ number: 70, state: 'MERGED', isDraft: false }]; },
    });
    assert.deepEqual(headCalls, [7]);
    assert.deepEqual(state.board.items.find((i) => i.issue === 7).prs[0].state, 'MERGED');
});

test('refreshBoard: Awaiting Continuation item は continuation ファイルの残タスク数を continuationRemaining に添える（#913）', async () => {
    const { refreshBoard } = require('../src/daemon');
    const cfg = { ...makeCfg(), now: () => 0, statusOrder: [] };
    const state = { running: new Map() };
    await refreshBoard(cfg, state, () => {}, {
        token: 't',
        listItems: () => [
            { issue: 10, status: 'In Progress', aiStatus: 'Awaiting Continuation', kind: 'Issue', title: 'x', labels: [] },
            { issue: 11, status: 'In Progress', aiStatus: 'Implementing', kind: 'Issue', title: 'y', labels: [] },
        ],
        getBoardEnrichment: () => ({}),
        listHeadPrs: () => [],
        execFileP: async () => ({ stdout: '/tmp/wt\n' }),
        existsSync: () => true,
        readFileSync: () => [continuationMarker(10, 'implement', 1), '## 残タスク', '- a', '- b', '- c'].join('\n'),
    });
    const r10 = state.board.items.find((i) => i.issue === 10);
    assert.equal(r10.continuationRemaining, 3);
    const r11 = state.board.items.find((i) => i.issue === 11);
    assert.equal(r11.continuationRemaining, null);
});

test('refreshBoard: continuation ファイルの読み取りに失敗しても board 構築は続く（continuationRemaining=null）', async () => {
    const { refreshBoard } = require('../src/daemon');
    const cfg = { ...makeCfg(), now: () => 0, statusOrder: [] };
    const state = { running: new Map() };
    await refreshBoard(cfg, state, () => {}, {
        token: 't',
        listItems: () => [
            { issue: 12, status: 'In Progress', aiStatus: 'Awaiting Continuation', kind: 'Issue', title: 'x', labels: [] },
        ],
        getBoardEnrichment: () => ({}),
        listHeadPrs: () => [],
        execFileP: async () => { throw new Error('worktree not found'); },
    });
    const r12 = state.board.items.find((i) => i.issue === 12);
    assert.equal(r12.continuationRemaining, null);
});

test('recordHistory: 新しい run が先頭、上限 100 件', () => {
    const { recordHistory } = require('../src/daemon');
    const state = {};
    for (let i = 0; i < 105; i++) recordHistory(state, { issue: i, phase: 'triage', outcome: 'done' });
    assert.equal(state.history.length, 100);
    assert.equal(state.history[0].issue, 104); // 最新が先頭
});

test('refreshBoard: assignee 指定でボードも enroll 判定（ownsItem）に限定される', async () => {
    const { refreshBoard } = require('../src/daemon');
    const cfg = { ...makeCfg(), now: () => 0, statusOrder: [], assignee: 'me' };
    const state = { running: new Map() };
    await refreshBoard(cfg, state, () => {}, {
        token: 't',
        listItems: () => [
            { issue: 1, status: 'Review', kind: 'Issue', title: 'mine', labels: [], assignees: ['me'] },
            { issue: 2, status: 'Review', kind: 'Issue', title: 'other', labels: [], assignees: ['other'] },
            { issue: 3, status: 'Review', kind: 'Issue', title: 'none', labels: [], assignees: [] }, // 未 assign
            { issue: 4, status: 'Review', kind: 'Issue', title: 'second', labels: [], assignees: ['aa', 'me'] }, // 先頭でない
        ],
        getBoardEnrichment: () => ({}),
        listHeadPrs: () => [],
    });
    assert.deepEqual(state.board.items.map((i) => i.issue), [1]);
});

test('refreshBoard: レート残量僅少（skipLowPriority）では更新せず前回キャッシュを維持', async () => {
    const { refreshBoard } = require('../src/daemon');
    const cfg = { ...makeCfg(), now: () => 0, statusOrder: [] };
    const state = {
        running: new Map(),
        board: { updatedAt: 1, items: [{ issue: 9 }] },
        ratePlan: { skipLowPriority: true, minRemaining: 10, minAt: 'bot/graphql' },
    };
    let called = 0;
    await refreshBoard(cfg, state, () => {}, { token: 't', listItems: () => { called += 1; return []; } });
    assert.equal(called, 0);
    assert.deepEqual(state.board.items.map((i) => i.issue), [9]);
});

// === #934: applyTrackerStickies（分解済み EPIC の sub-issue 進捗 + Close 指示 sticky） ===

test('applyTrackerStickies: トラッカーで sub-issue 未完了 -> sticky を upsert する', async () => {
    const boardItems = [
        { issue: 906, tracker: true, status: 'In Progress', subIssues: { total: 4, completed: 2, percent: 50 } },
        { issue: 1, tracker: false, status: 'In Progress', subIssues: { total: 0, completed: 0, percent: 0 } }, // 対象外
    ];
    const calls = [];
    const deps = {
        token: 't',
        upsertMarkedComment: (repo, number, markers, body) => calls.push({ number, markers, body }),
    };
    await applyTrackerStickies(boardItems, makeCfg(), () => {}, deps);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].number, 906);
    assert.deepEqual(calls[0].markers, [TRACKER_STICKY_MARKER]);
    assert.match(calls[0].body, /2\/4 \(50%\)/);
});

test('applyTrackerStickies: 追加の GraphQL 無しに board キャッシュだけで動く（listItems 等は呼ばない）', async () => {
    const boardItems = [
        { issue: 906, tracker: true, status: 'In Progress', subIssues: { total: 4, completed: 4, percent: 100 } },
    ];
    const calls = [];
    await applyTrackerStickies(boardItems, makeCfg(), () => {}, {
        token: 't',
        upsertMarkedComment: (repo, number, markers, body) => calls.push({ number, body }),
        listItems: () => { throw new Error('listItems should not be called'); },
    });
    assert.equal(calls.length, 1);
    assert.match(calls[0].body, /全 sub-issue が完了しました（4\/4）/);
});

test('applyTrackerStickies: 対象が無ければ何もしない（token 取得もしない）', async () => {
    let tokenCalls = 0;
    await applyTrackerStickies([], makeCfg(), () => {}, {
        get token() { tokenCalls += 1; return 't'; },
        upsertMarkedComment: () => { throw new Error('should not be called'); },
    });
    assert.equal(tokenCalls, 0);
});

test('applyTrackerStickies: 1 件の失敗は他を止めない', async () => {
    const boardItems = [
        { issue: 1, tracker: true, status: 'In Progress', subIssues: { total: 2, completed: 1, percent: 50 } },
        { issue: 2, tracker: true, status: 'In Progress', subIssues: { total: 2, completed: 2, percent: 100 } },
    ];
    const posted = [];
    await applyTrackerStickies(boardItems, makeCfg(), () => {}, {
        token: 't',
        upsertMarkedComment: (repo, number) => {
            if (number === 1) throw new Error('boom');
            posted.push(number);
        },
    });
    assert.deepEqual(posted, [2]);
});

test('refreshBoardAndProjectTrackers: refreshBoard 後に board キャッシュでトラッカー sticky を投影する', async () => {
    const cfg = { ...makeCfg(), now: () => 0, statusOrder: [] };
    const state = { running: new Map() };
    const posted = [];
    await refreshBoardAndProjectTrackers(cfg, state, () => {}, {
        token: 't',
        listItems: () => [
            { issue: 906, status: 'In Progress', kind: 'EPIC', title: 'e', labels: ['🧭 tracking'] },
        ],
        getBoardEnrichment: () => ({ 906: { subIssues: { total: 2, completed: 2, percent: 100 }, prs: [] } }),
        listHeadPrs: () => [],
        upsertMarkedComment: (repo, number, markers, body) => posted.push({ number, body }),
    });
    assert.equal(posted.length, 1);
    assert.equal(posted[0].number, 906);
    assert.match(posted[0].body, /全 sub-issue が完了しました（2\/2）/);
});

test('refreshBoardAndProjectTrackers: レート僅少では再投影しない（board 更新自体も refreshBoard 側でスキップ）', async () => {
    const cfg = { ...makeCfg(), now: () => 0, statusOrder: [] };
    const state = {
        running: new Map(),
        board: { updatedAt: 1, items: [{ issue: 9, tracker: true, status: 'In Progress', subIssues: { total: 1, completed: 1, percent: 100 } }] },
        ratePlan: { skipLowPriority: true, minRemaining: 10, minAt: 'bot/graphql' },
    };
    let posted = 0;
    await refreshBoardAndProjectTrackers(cfg, state, () => {}, {
        token: 't',
        listItems: () => { throw new Error('should not be called'); },
        upsertMarkedComment: () => { posted += 1; },
    });
    assert.equal(posted, 0);
});

test('refreshRateLimits: bot/read 両トークンの残量から実行計画を立てる', async () => {
    const { refreshRateLimits } = require('../src/daemon');
    const state = {};
    await refreshRateLimits({}, state, () => {}, {
        token: 'bot-t',
        readToken: 'read-t',
        getRateLimit: async (tok) => (tok === 'bot-t'
            ? { core: { remaining: 4000, limit: 5000 }, graphql: { remaining: 100, limit: 5000 } }
            : { core: { remaining: 3000, limit: 5000 }, graphql: { remaining: 2500, limit: 5000 } }),
    });
    assert.equal(state.ratePlan.minRemaining, 100);
    assert.equal(state.ratePlan.minAt, 'bot/graphql');
    assert.equal(state.ratePlan.skipLowPriority, true); // 100 < 200
    // 取得失敗時は前回の計画を維持
    await refreshRateLimits({}, state, () => {}, {
        token: 'bot-t', readToken: 'read-t',
        getRateLimit: async () => { throw new Error('boom'); },
    });
    assert.equal(state.ratePlan.minRemaining, 100);
});

// === 認証ヘルスチェック: checkAuthHealth（SSO 無人運用の auto-pause / auto-resume） ===

test('checkAuthHealth: 失効で auto-pause、回復で auto-resume', async () => {
    const { checkAuthHealth } = require('../src/daemon');
    const state = { paused: false, pausedBy: null, authError: null, running: new Map() };
    let ok = false;
    const deps = { botToken: async () => { if (!ok) throw new Error('AWS 認証が失効しています'); return 't'; } };
    // 失効 → auto-pause + エラー surface
    assert.equal(await checkAuthHealth({}, state, () => {}, deps), false);
    assert.equal(state.paused, true);
    assert.equal(state.pausedBy, 'auth');
    assert.match(state.authError, /失効/);
    // 再認証後 → auto-resume
    ok = true;
    assert.equal(await checkAuthHealth({}, state, () => {}, deps), true);
    assert.equal(state.paused, false);
    assert.equal(state.pausedBy, null);
    assert.equal(state.authError, null);
});

test('checkAuthHealth: 人間の pause は上書きしない（回復しても勝手に resume しない）', async () => {
    const { checkAuthHealth } = require('../src/daemon');
    const state = { paused: true, pausedBy: 'human', authError: null, running: new Map() };
    // 失敗してもエラー記録のみ（pausedBy は human のまま）
    await checkAuthHealth({}, state, () => {}, { botToken: async () => { throw new Error('boom'); } });
    assert.equal(state.pausedBy, 'human');
    assert.equal(state.paused, true);
    // 成功しても human pause は解除しない
    await checkAuthHealth({}, state, () => {}, { botToken: async () => 't' });
    assert.equal(state.paused, true);
    assert.equal(state.pausedBy, 'human');
});

test('checkAuthHealth: 機密はサニタイズして surface する', async () => {
    const { checkAuthHealth } = require('../src/daemon');
    const state = { paused: false, pausedBy: null, running: new Map() };
    await checkAuthHealth({}, state, () => {}, {
        botToken: async () => { throw new Error('token ghs_abcdefghijklmnopqrstuvwx1234 rejected'); },
    });
    assert.doesNotMatch(state.authError, /ghs_abcdefghijklmnopqrstuvwx1234/);
    assert.match(state.authError, /rejected/);
});

// === 人間ゲート: collectGateContexts（コメント解除 + watermark） ===

test('collectGateContexts: 発言アクティビティから humanSpokeLast を導く（コメント解除の配線）', async () => {
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
    const contexts = await collectGateContexts(makeCfg(), items, new Set(), state, () => {}, {
        token: 't',
        getGateContext: (repo, issue) => gateCtx[issue],
    });
    assert.equal(contexts[1].humanSpokeLast, true);
    assert.equal(contexts[2].humanSpokeLast, false);
    assert.equal(contexts[3].humanSpokeLast, true);
    assert.equal(contexts[4].humanSpokeLast, true);
    assert.ok(!(5 in contexts));
});

test('collectGateContexts: watermark（gateHandled）より古い発言では再発火しない', async () => {
    const items = [{ issue: 1, status: 'Review', kind: 'Issue', hitlLabel: true }];
    const state = { running: new Map(), gateHandled: new Map([[1, 250]]) };
    const deps = {
        token: 't',
        getGateContext: () => ({
            hitlSignals: { issueLabel: true, prLabel: true }, review: {}, pr: 10,
            activity: { lastHumanAt: 200, lastBotAt: 100 },
        }),
    };
    const contexts = await collectGateContexts(makeCfg(), items, new Set(), state, () => {}, deps);
    assert.equal(contexts[1].humanSpokeLast, false); // 200 < watermark 250
    // watermark 後に人間がさらに発言 → 再度解除
    deps.getGateContext = () => ({
        hitlSignals: { issueLabel: true, prLabel: true }, review: {}, pr: 10,
        activity: { lastHumanAt: 300, lastBotAt: 100 },
    });
    const contexts2 = await collectGateContexts(makeCfg(), items, new Set(), state, () => {}, deps);
    assert.equal(contexts2[1].humanSpokeLast, true);
});

test('collectGateContexts: 未処理 changesRequested を構造化シグナルとして導く (#894)', async () => {
    // approve 後の Request changes: bot sticky が lastBotAt を now に更新し humanSpokeLast が
    // false でも、changesRequested の submittedAt が review watermark より新しければ解除する。
    const items = [{ issue: 1, status: 'Review', kind: 'Issue', hitlLabel: true }];
    const state = { running: new Map() };
    const deps = {
        token: 't',
        getGateContext: () => ({
            hitlSignals: { issueLabel: true, prLabel: true },
            review: { approved: false, changesRequested: true, changesRequestedAt: 300 },
            pr: 10,
            // bot sticky が leapfrog: lastBotAt > lastHumanAt → humanSpokeLast は false
            activity: { lastHumanAt: 300, lastBotAt: 999 },
        }),
    };
    const contexts = await collectGateContexts(makeCfg(), items, new Set(), state, () => {}, deps);
    assert.equal(contexts[1].humanSpokeLast, false, 'sticky leapfrog で発言解除は効かない');
    assert.equal(contexts[1].unhandledChangesRequested, true, '構造化シグナルで解除される');

    // watermark を進める（dispatch 済み相当）と同じ changesRequested では再発火しない
    state.gateReviewHandled = new Map([[1, 300]]);
    const contexts2 = await collectGateContexts(makeCfg(), items, new Set(), state, () => {}, deps);
    assert.equal(contexts2[1].unhandledChangesRequested, false, '同じレビューでは再発火しない');

    // さらに新しい Request changes（submittedAt=400）が来たら再度解除
    deps.getGateContext = () => ({
        hitlSignals: { issueLabel: true, prLabel: true },
        review: { approved: false, changesRequested: true, changesRequestedAt: 400 },
        pr: 10,
        activity: { lastHumanAt: 400, lastBotAt: 999 },
    });
    const contexts3 = await collectGateContexts(makeCfg(), items, new Set(), state, () => {}, deps);
    assert.equal(contexts3[1].unhandledChangesRequested, true, '新しい changesRequested で再度解除');
});

test('collectGateContexts: approve 単独（changesRequested 無し）は解除しない (#894)', async () => {
    const items = [{ issue: 1, status: 'Review', kind: 'Issue', hitlLabel: true }];
    const state = { running: new Map() };
    const deps = {
        token: 't',
        getGateContext: () => ({
            hitlSignals: { issueLabel: true, prLabel: true },
            review: { approved: true, changesRequested: false, changesRequestedAt: null },
            pr: 10,
            activity: { lastHumanAt: 100, lastBotAt: 999 },
        }),
    };
    const contexts = await collectGateContexts(makeCfg(), items, new Set(), state, () => {}, deps);
    assert.equal(contexts[1].unhandledChangesRequested, false);
});

// === directives: getDirectives（autopilot-base / autopilot-after の TTL キャッシュ） ===

test('getDirectives: 本文から base/after を導き TTL 内はキャッシュを返す', async () => {
    let fetches = 0;
    let now = 0;
    const cfg = { ...makeCfg(), now: () => now, directiveTtlMs: 1000 };
    const state = {};
    const deps = {
        token: 't',
        getIssueBody: () => { fetches += 1; return 'autopilot-base: topic/x\nautopilot-after: #9'; },
    };
    const d1 = await getDirectives(cfg, state, 5, () => {}, deps);
    assert.equal(d1.base, 'topic/x');
    assert.deepEqual(d1.after, [9]);
    assert.equal(fetches, 1);
    // TTL 内は再取得しない
    now = 999;
    await getDirectives(cfg, state, 5, () => {}, deps);
    assert.equal(fetches, 1);
    // TTL 超過で再取得
    now = 1001;
    await getDirectives(cfg, state, 5, () => {}, deps);
    assert.equal(fetches, 2);
});

test('getDirectives: 取得失敗は空ディレクティブへフォールバックし次回再取得', async () => {
    let calls = 0;
    const cfg = { ...makeCfg(), now: () => 0, directiveTtlMs: 1000 };
    const state = {};
    const deps = {
        token: 't',
        getIssueBody: () => { calls += 1; if (calls === 1) throw new Error('boom'); return 'autopilot-after: #3'; },
    };
    const d1 = await getDirectives(cfg, state, 5, () => {}, deps);
    assert.equal(d1.base, null);
    assert.deepEqual(d1.after, []);
    // 失敗エントリは TTL 切れ扱い → 次回すぐ再取得して成功する
    const d2 = await getDirectives(cfg, state, 5, () => {}, deps);
    assert.deepEqual(d2.after, [3]);
});

// === #816: markBlocked / detectStuck（失敗・stall 時の人間ハンドオフ） ===

test('markBlocked: Blocked + 説明コメント + 🙋 face sync を行う', async () => {
    const deps = makeBlockDeps();
    const item = { issue: 9, itemId: 'i9', status: 'In Progress', kind: 'Issue' };
    await markBlocked(item, 'run が失敗しました', makeCfg(), () => {}, deps);
    assert.deepEqual(deps.calls.setField, [{ itemId: 'i9', field: 'Status', value: 'Blocked' }]);
    assert.equal(deps.calls.comments.length, 1);
    assert.match(deps.calls.comments[0].body, /run が失敗しました/);
    // face sync は Blocked + hitlLabel:true（人間の番）で呼ばれる
    assert.equal(deps.calls.syncFaces[0].status, 'Blocked');
    assert.equal(deps.calls.syncFaces[0].hitlLabel, true);
});

test('markBlocked: body 無しならコメントしない（Status と face sync のみ）', async () => {
    const deps = makeBlockDeps();
    await markBlocked({ issue: 9, itemId: 'i9' }, null, makeCfg(), () => {}, deps);
    assert.equal(deps.calls.comments.length, 0);
    assert.equal(deps.calls.setField.length, 1);
});

test('markBlocked: state を渡すと board キャッシュも Blocked へ live 反映する (#888)', async () => {
    const deps = makeBlockDeps();
    const state = { board: { items: [{ issue: 9, status: 'In Progress', aiStatus: 'Implementing' }] } };
    const item = { issue: 9, itemId: 'i9', status: 'In Progress', kind: 'Issue' };
    await markBlocked(item, null, makeCfg(), () => {}, deps, state);
    assert.equal(state.board.items[0].status, 'Blocked');
    // AI Status は markBlocked が触らないので保持される
    assert.equal(state.board.items[0].aiStatus, 'Implementing');
});

test('markBlocked: state 未指定でも従来どおり動く（board 反映はスキップ・後方互換）', async () => {
    const deps = makeBlockDeps();
    await markBlocked({ issue: 9, itemId: 'i9' }, null, makeCfg(), () => {}, deps);
    assert.equal(deps.calls.setField.length, 1);
});

test('markBlocked: setField 失敗時は board キャッシュを汚さない (#888)', async () => {
    const deps = makeBlockDeps();
    deps.setField = () => { throw new Error('boom'); };
    const state = { board: { items: [{ issue: 9, status: 'In Progress' }] } };
    await markBlocked({ issue: 9, itemId: 'i9' }, null, makeCfg(), () => {}, deps, state);
    // 書き込みが失敗したら board も Blocked にしない（Project の実状態と一致させる）
    assert.equal(state.board.items[0].status, 'In Progress');
});

test('detectStuck: stuckMs 未満は記録のみ、超過で Blocked + コメント (#816)', async () => {
    const deps = makeBlockDeps();
    const cfg = { ...makeCfg(), now: () => 1000, stuckMs: 5000 };
    const state = { running: new Map() };
    const items = [{ issue: 7, itemId: 'i7', status: 'In Progress', aiStatus: 'Implementing' }];
    // 1 回目: 初観測 -> 記録のみ、まだ block しない
    await detectStuck(items, cfg, state, () => {}, deps);
    assert.equal(deps.calls.setField.length, 0);
    assert.equal(state.stuckSince.get(7), 1000);
    // stuckMs 経過後 -> Blocked + コメント
    cfg.now = () => 1000 + 5000;
    await detectStuck(items, cfg, state, () => {}, deps);
    assert.deepEqual(deps.calls.setField, [{ itemId: 'i7', field: 'Status', value: 'Blocked' }]);
    assert.match(deps.calls.comments[0].body, /In Progress/);
    assert.equal(state.stuckSince.has(7), false); // 追跡解除
});

test('detectStuck: 実行中の run が所有する item は触らない', async () => {
    const deps = makeBlockDeps();
    const cfg = { ...makeCfg(), now: () => 0, stuckMs: 1 };
    const state = { running: new Map([[7, { phase: 'implement' }]]), stuckSince: new Map([[7, -10000]]) };
    const items = [{ issue: 7, itemId: 'i7', status: 'In Progress', aiStatus: 'Implementing' }];
    await detectStuck(items, cfg, state, () => {}, deps);
    assert.equal(deps.calls.setField.length, 0);
});

test('detectStuck: 候補でなくなった item は追跡から外す', async () => {
    const deps = makeBlockDeps();
    const cfg = { ...makeCfg(), now: () => 0, stuckMs: 1000 };
    const state = { running: new Map(), stuckSince: new Map([[7, -100]]) };
    // status が Review に進んだ -> stuck 候補ではない
    const items = [{ issue: 7, itemId: 'i7', status: 'Review', aiStatus: null }];
    await detectStuck(items, cfg, state, () => {}, deps);
    assert.equal(deps.calls.setField.length, 0);
    assert.equal(state.stuckSince.has(7), false);
});

// ---- 協調的チェックポイント（EPIC #906・実装コンポーネント D・#912） ----

/** git status/bot-git の呼び出しを記録するフェイク execFileP を作る */
function makeExecDeps(dirty) {
    const calls = [];
    return {
        calls,
        execFileP: async (cmd, args, opts) => {
            calls.push({ cmd, args, opts });
            if (cmd === 'git' && args[0] === 'status') return { stdout: dirty ? ' M file.js\n' : '' };
            return { stdout: '' };
        },
    };
}

test('ensureCheckpointCommit: 未コミットの WIP があれば add + bot-git commit する', async () => {
    const deps = makeExecDeps(true);
    const committed = await ensureCheckpointCommit('/wt', 912, () => {}, deps);
    assert.equal(committed, true);
    assert.equal(deps.calls.length, 3); // status, add, commit
    assert.equal(deps.calls[0].args[0], 'status');
    assert.deepEqual(deps.calls[1].args, ['add', '-A']);
    assert.equal(deps.calls[2].args[0], 'commit');
    assert.match(deps.calls[2].args.join(' '), /checkpoint/);
    // 全呼び出しが対象 worktree の cwd で実行される
    assert.ok(deps.calls.every((c) => c.opts.cwd === '/wt'));
});

test('ensureCheckpointCommit: クリーンな worktree では何もしない', async () => {
    const deps = makeExecDeps(false);
    const committed = await ensureCheckpointCommit('/wt', 912, () => {}, deps);
    assert.equal(committed, false);
    assert.equal(deps.calls.length, 1); // status チェックのみ
});

test('readContinuationFromWorktree: ファイルが無ければ null、あれば解析結果を返す', () => {
    const missing = readContinuationFromWorktree('/wt', 912, { existsSync: () => false });
    assert.equal(missing, null);
    const content = [continuationMarker(912, 'address-review', 2), '## 残タスク', '- x'].join('\n');
    const parsed = readContinuationFromWorktree('/wt', 912, {
        existsSync: () => true,
        readFileSync: () => content,
    });
    assert.equal(parsed.phase, 'address-review');
    assert.equal(parsed.iteration, 2);
});

/** applyCheckpointHandling 用の I/O フェイク一式 */
function makeCheckpointDeps({ dirty = false, hasFile = true, iteration = 1, phase = 'implement' } = {}) {
    const calls = { comments: [], blocked: [] };
    return {
        calls,
        execFileP: async (cmd, args) => (cmd === 'git' && args[0] === 'status'
            ? { stdout: dirty ? ' M x\n' : '' }
            : { stdout: '' }),
        existsSync: () => hasFile,
        readFileSync: () => [continuationMarker(1, phase, iteration), '## 残タスク', '- foo'].join('\n'),
        token: 't',
        readToken: 't',
        upsertMarkedComment: (repo, issue, markers, body) => calls.comments.push({ issue, body }),
        markBlocked: (item, body) => calls.blocked.push({ item, body }),
    };
}

test('applyCheckpointHandling: 上限内なら continuation コメントを upsert し Blocked にはしない', async () => {
    const deps = makeCheckpointDeps({ iteration: 1 });
    const item = { issue: 1, itemId: 'i1', status: 'In Progress' };
    const result = { signal: 'hitl', nextAiStatus: 'Awaiting Continuation' };
    await applyCheckpointHandling(item, '/wt', result, makeCfg(), {}, () => {}, deps);
    assert.equal(deps.calls.comments.length, 1);
    assert.equal(deps.calls.comments[0].issue, 1);
    assert.match(deps.calls.comments[0].body, /残タスク/);
    assert.match(deps.calls.comments[0].body, /- foo/);
    assert.equal(deps.calls.blocked.length, 0);
});

test('applyCheckpointHandling: 反復上限（既定3）超過で markBlocked にエスカレーションする', async () => {
    const deps = makeCheckpointDeps({ iteration: 4 });
    const item = { issue: 1, itemId: 'i1', status: 'In Progress' };
    const result = { signal: 'hitl', nextAiStatus: 'Awaiting Continuation' };
    await applyCheckpointHandling(item, '/wt', result, makeCfg(), {}, () => {}, deps);
    assert.equal(deps.calls.blocked.length, 1);
    assert.equal(deps.calls.blocked[0].item.issue, 1);
    assert.match(deps.calls.blocked[0].body, /反復上限/);
    // continuation コメント自体は escalate でも投稿する（人間への文脈提供）
    assert.equal(deps.calls.comments.length, 1);
});

test('applyCheckpointHandling: continuation ファイルが無ければコメントもエスカレーションもしない', async () => {
    const deps = makeCheckpointDeps({ hasFile: false });
    const item = { issue: 1, itemId: 'i1', status: 'In Progress' };
    const result = { signal: 'hitl', nextAiStatus: 'Awaiting Continuation' };
    await applyCheckpointHandling(item, '/wt', result, makeCfg(), {}, () => {}, deps);
    assert.equal(deps.calls.comments.length, 0);
    assert.equal(deps.calls.blocked.length, 0);
});

test('applyCheckpointHandling: 未コミット WIP があれば保険commit してから処理を続ける', async () => {
    const deps = makeCheckpointDeps({ dirty: true, iteration: 1 });
    const item = { issue: 1, itemId: 'i1', status: 'In Progress' };
    const result = { signal: 'hitl', nextAiStatus: 'Awaiting Continuation' };
    await applyCheckpointHandling(item, '/wt', result, makeCfg(), {}, () => {}, deps);
    assert.equal(deps.calls.comments.length, 1); // 保険commit 後も continuation 処理は続く
});

test('checkpointEscalationBody: 反復回数と上限を含み、worker のエラーではないと明示する', () => {
    const body = checkpointEscalationBody({ issue: 42 }, 4, 3);
    assert.match(body, /4 回/);
    assert.match(body, /3 回/);
    assert.match(body, /Blocked/);
    assert.match(body, /worker 自身がエラーを報告した/);
    // Blocked からの再開は phaseForItem の Blocked 分岐（address-review / triage）に従う。
    // continuation phase へは戻らないので、案内文言も指摘対応/再トリアージに揃える。
    assert.match(body, /指摘対応/);
    assert.match(body, /再トリアージ/);
});

test('collectContinuationContexts: Awaiting Continuation の item だけ continuation ファイルを読む', async () => {
    const pathCalls = [];
    const deps = {
        execFileP: async (cmd, args) => {
            pathCalls.push(args);
            return { stdout: '/wt/issue-5\n' };
        },
        existsSync: () => true,
        readFileSync: () => [continuationMarker(5, 'address-review', 2), '## 残タスク', '- foo'].join('\n'),
    };
    const items = [
        { issue: 5, status: 'In Progress', aiStatus: 'Awaiting Continuation' },
        { issue: 6, status: 'In Progress', aiStatus: 'Implementing' },
        { issue: 7, status: 'Review', aiStatus: null },
    ];
    const contexts = await collectContinuationContexts(items, new Set(), () => {}, deps);
    assert.deepEqual(Object.keys(contexts), ['5']);
    assert.equal(contexts[5].continuation.phase, 'address-review');
    assert.equal(contexts[5].continuation.iteration, 2);
    assert.equal(pathCalls.length, 1); // #6/#7 は対象外なので worktree にすら問い合わせない
});

test('collectContinuationContexts: 実行中の item は触らない（live phase と競合しない）', async () => {
    const deps = { execFileP: async () => { throw new Error('should not be called'); } };
    const items = [{ issue: 5, status: 'In Progress', aiStatus: 'Awaiting Continuation' }];
    const contexts = await collectContinuationContexts(items, new Set([5]), () => {}, deps);
    assert.deepEqual(contexts, {});
});

test('collectContinuationContexts: worktree にファイルが無い item は結果に含まれない（implement フォールバック側で処理）', async () => {
    const deps = {
        execFileP: async () => ({ stdout: '/wt/issue-5\n' }),
        existsSync: () => false,
    };
    const items = [{ issue: 5, status: 'In Progress', aiStatus: 'Awaiting Continuation' }];
    const contexts = await collectContinuationContexts(items, new Set(), () => {}, deps);
    assert.deepEqual(contexts, {});
});

// ---- SSO 再接続（device code フロー）: parseSsoDeviceOutput / startReauth ----

test('parseSsoDeviceOutput: URL + コードを抽出し completeUrl を組み立てる', () => {
    const out = 'If the browser does not open, open the following URL:\n\n'
        + 'https://device.sso.ap-northeast-1.amazonaws.com/\n\nThen enter the code:\n\nMNOP-4321\n';
    const p = parseSsoDeviceOutput(out);
    assert.equal(p.url, 'https://device.sso.ap-northeast-1.amazonaws.com/');
    assert.equal(p.code, 'MNOP-4321');
    assert.equal(p.completeUrl, 'https://device.sso.ap-northeast-1.amazonaws.com/?user_code=MNOP-4321');
});

test('parseSsoDeviceOutput: user_code 埋め込み URL からコードを取り出す', () => {
    const out = 'Please visit: https://device.sso.us-east-1.amazonaws.com/?user_code=QRST-8765';
    const p = parseSsoDeviceOutput(out);
    assert.equal(p.code, 'QRST-8765');
    assert.equal(p.completeUrl, 'https://device.sso.us-east-1.amazonaws.com/?user_code=QRST-8765');
});

test('parseSsoDeviceOutput: 何も一致しなければ null', () => {
    assert.equal(parseSsoDeviceOutput('nothing useful here'), null);
});

/** startReauth 用の spawn 差し替え（stdout/stderr を持つ EventEmitter ベースの子プロセス） */
function fakeChild() {
    const child = new EventEmitter();
    child.stdout = new EventEmitter();
    child.stderr = new EventEmitter();
    return child;
}

test('startReauth: device 出力から pending(url/code/completeUrl) を surface する', async () => {
    const child = fakeChild();
    const state = { reauth: null, now: () => 1000 };
    const p = startReauth(state, () => {}, { spawn: () => child, waitMs: 5000 });
    child.stdout.emit('data', Buffer.from(
        'open the following URL:\n\nhttps://device.sso.ap-northeast-1.amazonaws.com/\n\n'
        + 'Then enter the code:\n\nABCD-EFGH\n'));
    const r = await p;
    assert.equal(r.status, 'pending');
    assert.equal(r.code, 'ABCD-EFGH');
    assert.equal(r.url, 'https://device.sso.ap-northeast-1.amazonaws.com/');
    assert.equal(r.completeUrl, 'https://device.sso.ap-northeast-1.amazonaws.com/?user_code=ABCD-EFGH');
    assert.equal(state.reauth.status, 'pending');
});

test('startReauth: exit 0 で state.reauth を消し onSuccess を呼ぶ', async () => {
    const child = fakeChild();
    const state = { reauth: null };
    let onSuccessCalled = false;
    const p = startReauth(state, () => {}, {
        spawn: () => child, waitMs: 5000, onSuccess: () => { onSuccessCalled = true; },
    });
    child.stdout.emit('data', Buffer.from('https://device.sso.x/ AAAA-BBBB'));
    await p;
    child.emit('exit', 0);
    await new Promise((r) => setImmediate(r)); // Promise.resolve().then(onSuccess) の microtask を待つ
    assert.equal(state.reauth, null);
    assert.equal(onSuccessCalled, true);
});

test('startReauth: pending 中は二重に spawn しない', async () => {
    const child = fakeChild();
    let spawnCount = 0;
    const mkSpawn = () => { spawnCount += 1; return child; };
    const state = { reauth: null };
    const p = startReauth(state, () => {}, { spawn: mkSpawn, waitMs: 5000 });
    child.stdout.emit('data', Buffer.from('https://device.sso.x/ CCCC-DDDD'));
    await p;
    await startReauth(state, () => {}, { spawn: mkSpawn, waitMs: 5000 });
    assert.equal(spawnCount, 1);
});

test('startReauth: spawn 失敗は status=error になる', async () => {
    const state = { reauth: null };
    const r = await startReauth(state, () => {}, {
        spawn: () => { throw new Error('aws not found'); }, waitMs: 5000,
    });
    assert.equal(r.status, 'error');
    assert.match(r.error, /aws not found/);
});

// ---- Claude 使用量表示（#879） --------------------------------------------

test('boardResponse: state.claudeUsage を含める（無ければ null）', () => {
    const cfg = { assignee: 'me', concurrency: 2 };
    const empty = boardResponse(cfg, { running: new Map() });
    assert.strictEqual(empty.claudeUsage, null);
    const usage = { session: { percent: 23.5 }, weekly: { percent: 41.2 }, updatedAt: 1 };
    const withUsage = boardResponse(cfg, { running: new Map(), claudeUsage: usage });
    assert.deepStrictEqual(withUsage.claudeUsage, usage);
});

test('statusResponse: state.claudeUsage を含める', () => {
    const cfg = { assignee: null, concurrency: 1 };
    const usage = { session: { percent: 5 }, weekly: { percent: 9 }, updatedAt: 2 };
    assert.deepStrictEqual(statusResponse(cfg, { running: new Map(), claudeUsage: usage }).claudeUsage, usage);
    assert.strictEqual(statusResponse(cfg, { running: new Map() }).claudeUsage, null);
});

test('updateClaudeUsage: usage ファイルから使用量を読み state に反映', () => {
    const fs = require('node:fs');
    const os = require('node:os');
    const path = require('node:path');
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'daemon-usage-'));
    const usageFile = path.join(dir, 'claude-usage.json');
    fs.writeFileSync(usageFile, JSON.stringify({
        rate_limits: {
            five_hour: { used_percentage: 30 }, seven_day: { used_percentage: 60 },
        },
    }) + '\n');
    const state = { claudeUsage: null };
    updateClaudeUsage(state, { usageFile, now: () => 42 }, () => {});
    assert.strictEqual(state.claudeUsage.session.percent, 30);
    assert.strictEqual(state.claudeUsage.weekly.percent, 60);
    assert.strictEqual(state.claudeUsage.updatedAt, 42);
    // 取得できないときは既存値を保持（null 上書きしない）
    updateClaudeUsage(state, { usageFile: '/no/such/file.json', now: () => 99 }, () => {});
    assert.strictEqual(state.claudeUsage.updatedAt, 42);
});

// ---- 稼働バージョン表示 + 更新検知（#885） --------------------------------

test('boardResponse/statusResponse: version と autopilotUpdate を含める（無ければ null）', () => {
    const cfg = { assignee: 'me', concurrency: 2 };
    const empty = boardResponse(cfg, { running: new Map() });
    assert.strictEqual(empty.version, null);
    assert.strictEqual(empty.autopilotUpdate, null);
    const version = { branch: 'develop', commit: 'abcdef0123', shortCommit: 'abcdef0' };
    const upd = { available: true, behind: 2, commits: [], checkedAt: 1, error: null };
    const b = boardResponse(cfg, { running: new Map(), version, autopilotUpdate: upd });
    assert.deepStrictEqual(b.version, version);
    assert.deepStrictEqual(b.autopilotUpdate, upd);
    const s = statusResponse({ assignee: null, concurrency: 1 }, { running: new Map(), version, autopilotUpdate: upd });
    assert.deepStrictEqual(s.version, version);
    assert.deepStrictEqual(s.autopilotUpdate, upd);
});

test('checkForUpdate: 更新ありを state.autopilotUpdate に反映', async () => {
    const state = { version: { commit: 'boot0' }, autopilotUpdate: null };
    const cfg = { repoRoot: '/app', updateBranch: 'develop', now: () => 100 };
    const logs = [];
    const check = async (args) => {
        assert.strictEqual(args.bootCommit, 'boot0');
        assert.strictEqual(args.baseBranch, 'develop');
        return { available: true, behind: 3, commits: [{ shortCommit: 'a', subject: 'x' }], checkedAt: 100, error: null };
    };
    await checkForUpdate(cfg, state, (m) => logs.push(m), { check });
    assert.strictEqual(state.autopilotUpdate.available, true);
    assert.strictEqual(state.autopilotUpdate.behind, 3);
    // 更新あり初検知でログ
    assert.ok(logs.some((m) => /update available/.test(m)));
});

test('checkForUpdate: 失敗時は前回の available/behind を保持し error だけ更新', async () => {
    const state = {
        version: { commit: 'boot0' },
        autopilotUpdate: { available: true, behind: 5, commits: [{ shortCommit: 'a', subject: 'x' }], checkedAt: 1, error: null },
    };
    const cfg = { repoRoot: '/app', updateBranch: 'develop', now: () => 200 };
    const check = async () => ({ available: false, behind: 0, commits: [], checkedAt: 200, error: 'network down' });
    await checkForUpdate(cfg, state, () => {}, { check });
    // 前回値保持
    assert.strictEqual(state.autopilotUpdate.available, true);
    assert.strictEqual(state.autopilotUpdate.behind, 5);
    assert.strictEqual(state.autopilotUpdate.commits.length, 1);
    // error と checkedAt は更新
    assert.match(state.autopilotUpdate.error, /network down/);
    assert.strictEqual(state.autopilotUpdate.checkedAt, 200);
});

test('startUpdateChecks: 起動時に 1 回チェックし unref タイマーを張る', async () => {
    const state = { version: { commit: 'boot0' }, autopilotUpdate: null };
    const cfg = { repoRoot: '/app', updateBranch: 'develop', updateCheckMs: 999, now: () => 1 };
    let checkCalls = 0;
    const check = async () => { checkCalls++; return { available: false, behind: 0, commits: [], checkedAt: 1, error: null }; };
    let unrefed = false;
    let scheduledMs = null;
    const setInterval = (fn, ms) => { scheduledMs = ms; return { unref: () => { unrefed = true; } }; };
    await startUpdateChecks(cfg, state, () => {}, { check, setInterval });
    assert.strictEqual(checkCalls, 1); // 起動直後 1 回
    assert.strictEqual(scheduledMs, 999);
    assert.strictEqual(unrefed, true);
});

// ---- ローカル状態の live 反映（#888） --------------------------------
test('patchBoardCache: applies intents to the cached board item (no GraphQL)', () => {
    const state = {
        board: {
            updatedAt: 1,
            items: [
                { issue: 10, status: 'In Progress', aiStatus: 'Implementing', hitl: false },
                { issue: 11, status: 'Backlog', aiStatus: null },
            ],
        },
    };
    const patched = patchBoardCache(state, 10, [
        { field: 'Status', value: 'In Progress' },
        { field: 'AI Status', value: 'Self-Reviewing' },
    ]);
    assert.strictEqual(patched, true);
    assert.strictEqual(state.board.items[0].aiStatus, 'Self-Reviewing');
    assert.strictEqual(state.board.items[0].status, 'In Progress');
    // hitl などフィールド外のキーは保持される
    assert.strictEqual(state.board.items[0].hitl, false);
    // 他の item は変わらない
    assert.strictEqual(state.board.items[1].status, 'Backlog');
});

test('patchBoardCache: null value clears the field (e.g. AI Status on close)', () => {
    const state = { board: { items: [{ issue: 5, status: 'Review', aiStatus: 'Self-Reviewing' }] } };
    const patched = patchBoardCache(state, 5, [
        { field: 'Status', value: 'Close' },
        { field: 'AI Status', value: null },
    ]);
    assert.strictEqual(patched, true);
    assert.strictEqual(state.board.items[0].status, 'Close');
    assert.strictEqual(state.board.items[0].aiStatus, null);
});

test('patchBoardCache: skips when cache is absent or issue not present (no throw)', () => {
    // board 未在（refreshBoard 前）
    assert.strictEqual(patchBoardCache({}, 10, [{ field: 'Status', value: 'X' }]), false);
    assert.strictEqual(
        patchBoardCache({ board: { items: null } }, 10, [{ field: 'Status', value: 'X' }]),
        false,
    );
    // 当該 issue がキャッシュに無い
    const state = { board: { items: [{ issue: 99, status: 'Backlog' }] } };
    assert.strictEqual(patchBoardCache(state, 10, [{ field: 'Status', value: 'X' }]), false);
    assert.strictEqual(state.board.items[0].status, 'Backlog');
});

test('patchBoardCache: skips on empty/missing intents', () => {
    const state = { board: { items: [{ issue: 10, status: 'Backlog' }] } };
    assert.strictEqual(patchBoardCache(state, 10, []), false);
    assert.strictEqual(patchBoardCache(state, 10, null), false);
    assert.strictEqual(state.board.items[0].status, 'Backlog');
});

test('patchBoardCache: does not mutate the original cached item object (replaces reference)', () => {
    const original = { issue: 10, status: 'In Progress', aiStatus: 'Implementing' };
    const state = { board: { items: [original] } };
    patchBoardCache(state, 10, [{ field: 'AI Status', value: 'Self-Reviewing' }]);
    // 元オブジェクトは破壊されず、配列の参照が差し替わる（applyIntentsToItem は copy を返す）
    assert.strictEqual(original.aiStatus, 'Implementing');
    assert.notStrictEqual(state.board.items[0], original);
    assert.strictEqual(state.board.items[0].aiStatus, 'Self-Reviewing');
});
