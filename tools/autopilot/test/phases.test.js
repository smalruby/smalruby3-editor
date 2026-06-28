'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const { PHASE_BY_COMMAND, applyResult, evaluate, DEFAULT_WATCHDOG } = require('../src/phases');

test('PHASE_BY_COMMAND maps triage to the skill and AI status', () => {
    assert.deepEqual(PHASE_BY_COMMAND.triage, { skill: 'autopilot-triage', aiStatus: 'Triaging' });
    assert.equal(PHASE_BY_COMMAND['address-review'].skill, 'autopilot-address-review');
});

test('applyResult: done sets Status/HITL/Size/Kind and clears AI Status', () => {
    const intents = applyResult({
        issue: 1, phase: 'triage', signal: 'done', summary: 's',
        nextStatus: 'Backlog', nextAiStatus: null, hitl: false, size: 'middle', kind: 'Issue', createdSubIssues: [],
    });
    const m = Object.fromEntries(intents.map(i => [i.field, i.value]));
    assert.equal(m.Status, 'Backlog');
    assert.equal(m['AI Status'], null);
    assert.equal(m.HITL, 'No');
    assert.equal(m.Size, 'middle');
    assert.equal(m.Kind, 'Issue');
});

test('applyResult: hitl sets HITL=Yes and optional Status', () => {
    const intents = applyResult({ issue: 1, phase: 'triage', signal: 'hitl', summary: 's', reason: 'r', nextStatus: 'Icebox' });
    const m = Object.fromEntries(intents.map(i => [i.field, i.value]));
    assert.equal(m.HITL, 'Yes');
    assert.equal(m.Status, 'Icebox');
});

test('applyResult: error blocks and flags HITL', () => {
    const intents = applyResult({ issue: 1, phase: 'triage', signal: 'error', summary: 's', error: 'boom' });
    const m = Object.fromEntries(intents.map(i => [i.field, i.value]));
    assert.equal(m.Status, 'Blocked');
    assert.equal(m.HITL, 'Yes');
});

const cfg = { ...DEFAULT_WATCHDOG };

test('evaluate: result present -> collect (highest priority)', () => {
    const a = evaluate({ resultPresent: true, ready: false, dead: true, elapsedMs: 9e9, idleMs: 9e9, restarts: 0 }, cfg);
    assert.equal(a.action, 'collect');
});

test('evaluate: tMax exceeded -> fail (課題3)', () => {
    const a = evaluate({ resultPresent: false, ready: true, dead: false, elapsedMs: cfg.tMaxMs + 1, idleMs: 0, restarts: 0 }, cfg);
    assert.equal(a.action, 'fail');
});

test('evaluate: dead without result -> restart, then fail at limit (課題4)', () => {
    const base = { resultPresent: false, ready: true, dead: true, elapsedMs: 1000, idleMs: 0 };
    assert.equal(evaluate({ ...base, restarts: 0 }, cfg).action, 'restart');
    assert.equal(evaluate({ ...base, restarts: cfg.maxRestarts }, cfg).action, 'fail');
});

test('evaluate: not ready within tReady -> restart (課題1)', () => {
    const a = evaluate({ resultPresent: false, ready: false, dead: false, elapsedMs: cfg.tReadyMs + 1, idleMs: 0, restarts: 0 }, cfg);
    assert.equal(a.action, 'restart');
});

test('evaluate: ready but idle beyond tIdle -> restart (課題2)', () => {
    const a = evaluate({ resultPresent: false, ready: true, dead: false, elapsedMs: 5000, idleMs: cfg.tIdleMs + 1, restarts: 0 }, cfg);
    assert.equal(a.action, 'restart');
});

test('evaluate: normal in-progress -> wait', () => {
    const a = evaluate({ resultPresent: false, ready: true, dead: false, elapsedMs: 5000, idleMs: 1000, restarts: 0 }, cfg);
    assert.equal(a.action, 'wait');
});
