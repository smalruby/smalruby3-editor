'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const { normalizeProjectItem } = require('../src/project');
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
