'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const {
    applyMergeProgression, applyClosedReconcile, applyPrProjection, applyDodHandoffs, runTickOnce,
    detectStuck, markBlocked, getDirectives, applyLabelHealing, collectGateContexts,
    parseSsoDeviceOutput, startReauth,
    updateClaudeUsage, boardResponse, statusResponse,
    patchBoardCache,
} = require('../src/daemon');
const { EventEmitter } = require('node:events');
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
