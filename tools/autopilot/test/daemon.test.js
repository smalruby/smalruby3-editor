'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const { applyMergeProgression, applyPrProjection } = require('../src/daemon');
const { HITL_LABEL, AUTOPILOT_LABEL } = require('../src/phases');

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
        upsertStickyComment: (repo, prNumber, body) => calls.sticky.push({ prNumber, hasMarker: /autopilot:sticky/.test(body) }),
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
    const items = [{ issue: 1, itemId: 'i1', status: 'Review', kind: 'Issue', hitl: 'Yes', aiStatus: null, size: 'small' }];
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
    const items = [{ issue: 1, itemId: 'i1', status: 'Review', kind: 'Issue', hitl: 'Yes' }];
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
    const items = [{ issue: 1, itemId: 'i1', status: 'In Progress', kind: 'Issue', hitl: 'No', aiStatus: 'Implementing' }];
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
    const items = [{ issue: 1, itemId: 'i1', status: 'Review', kind: 'Issue', hitl: 'Yes' }];
    const deps = makeProjectionDeps({ prByIssue: { 1: { number: 100 } } });
    const state = { running: new Map([[1, { phase: 'review' }]]) };
    applyPrProjection(items, makeCfg(), state, () => {}, deps);
    assert.deepEqual(deps.calls.editLabels, []);
    assert.deepEqual(deps.calls.setPrDraft, []);
    assert.deepEqual(deps.calls.sticky, []);
});

test('applyPrProjection: no PR yet -> only the issue label is reconciled', () => {
    const items = [{ issue: 1, itemId: 'i1', status: 'Blocked', kind: 'Issue', hitl: 'Yes' }];
    const deps = makeProjectionDeps({ issueLabels: { 1: [AUTOPILOT_LABEL] } });
    const state = { running: new Map() };
    applyPrProjection(items, makeCfg(), state, () => {}, deps);
    assert.deepEqual(deps.calls.setPrDraft, []);
    assert.deepEqual(deps.calls.sticky, []);
    const issueEdit = deps.calls.editLabels.find((e) => e.type === 'issue');
    assert.ok(issueEdit.add.includes(HITL_LABEL));
});

test('applyPrProjection: a failing item does not block others', () => {
    const items = [
        { issue: 1, itemId: 'i1', status: 'Review', kind: 'Issue', hitl: 'Yes' },
        { issue: 2, itemId: 'i2', status: 'In Progress', kind: 'Issue', hitl: 'No' },
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
