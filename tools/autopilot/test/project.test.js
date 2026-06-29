'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const { normalizeProjectItem, selectClosingPr } = require('../src/project');
const { HITL_LABEL, AUTOPILOT_LABEL } = require('../src/phases');

test('normalizeProjectItem: surfaces labels and derives hitlLabel from 🙋 label (#813)', () => {
    const raw = {
        id: 'PVTI_x',
        content: { number: 813, title: 'refactor HITL' },
        status: 'Review',
        'aI Status': null,
        kind: 'Issue',
        size: 'small',
        labels: [AUTOPILOT_LABEL, HITL_LABEL],
    };
    const item = normalizeProjectItem(raw);
    assert.equal(item.issue, 813);
    assert.equal(item.itemId, 'PVTI_x');
    assert.equal(item.title, 'refactor HITL');
    assert.equal(item.status, 'Review');
    assert.equal(item.aiStatus, null);
    assert.equal(item.kind, 'Issue');
    assert.equal(item.size, 'small');
    assert.deepEqual(item.labels, [AUTOPILOT_LABEL, HITL_LABEL]);
    assert.equal(item.hitlLabel, true);
});

test('normalizeProjectItem: no 🙋 label -> hitlLabel false; does not read HITL field', () => {
    const raw = {
        id: 'PVTI_y',
        content: { number: 1, title: 't' },
        status: 'In Progress',
        aiStatus: 'Implementing',
        labels: [AUTOPILOT_LABEL],
        // a stale Project HITL field value must be ignored (#813: daemon never reads it)
        hITL: 'Yes',
    };
    const item = normalizeProjectItem(raw);
    assert.equal(item.hitlLabel, false);
    assert.equal(item.aiStatus, 'Implementing');
    assert.ok(!('hitl' in item)); // no Project-field-derived HITL key
});

test('normalizeProjectItem: missing labels array defaults to empty (hitlLabel false)', () => {
    const item = normalizeProjectItem({ id: 'z', content: { number: 2, title: 't' }, status: 'New Item' });
    assert.deepEqual(item.labels, []);
    assert.equal(item.hitlLabel, false);
});

// selectClosingPr (#825): pick the PR that GitHub recognizes as actually closing the
// issue (closedByPullRequestsReferences), preferring open over merged/closed. This
// replaces the old `Closes #N in:body` full-text search that false-hit on PRs which
// merely mention `#N` in their body/commits.

const prNode = (number, state, extra = {}) => ({
    number,
    state,
    isDraft: false,
    headRefName: `topic/${number}`,
    labels: { nodes: [] },
    ...extra,
});

test('selectClosingPr: prefers an open PR over a merged one that also closes the issue', () => {
    // The reproduction from #825: #631 is closed by open PR 818, but PR 822 (merged)
    // appears in the reference set. The open PR must win.
    const nodes = [prNode(822, 'MERGED'), prNode(818, 'OPEN')];
    const pr = selectClosingPr(nodes);
    assert.equal(pr.number, 818);
    assert.equal(pr.isDraft, false);
    assert.equal(pr.branch, 'topic/818');
});

test('selectClosingPr: among multiple open PRs, picks the newest (highest number)', () => {
    const nodes = [prNode(818, 'OPEN'), prNode(905, 'OPEN'), prNode(870, 'OPEN')];
    assert.equal(selectClosingPr(nodes).number, 905);
});

test('selectClosingPr: normalizes labels to a name array', () => {
    const nodes = [prNode(900, 'OPEN', { labels: { nodes: [{ name: '🤖 autopilot' }, { name: '🙋 HITL' }] } })];
    assert.deepEqual(selectClosingPr(nodes).labels, ['🤖 autopilot', '🙋 HITL']);
});

test('selectClosingPr: returns null when no open PR closes the issue', () => {
    assert.equal(selectClosingPr([prNode(822, 'MERGED'), prNode(700, 'CLOSED')]), null);
    assert.equal(selectClosingPr([]), null);
    assert.equal(selectClosingPr(null), null);
});
