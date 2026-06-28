'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const { applyMergeProgression } = require('../src/daemon');

function makeCfg() {
    return { owner: 'smalruby', project: 4, repo: 'smalruby/smalruby3-editor', projectId: 'P', fields: {} };
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
    });
    assert.deepEqual(applied, ['i2']);
});
