'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const os = require('os');
const fs = require('fs');
const path = require('path');
const { validateResult, readResultFile, detectToken, TOKENS } = require('../src/contract');

test('validateResult: accepts a valid done payload', () => {
    const r = validateResult({
        issue: 760, phase: 'triage', signal: 'done', summary: 'ok',
        nextStatus: 'Backlog', nextAiStatus: null, hitl: false, size: 'middle', kind: 'Issue',
        createdSubIssues: [], prUrl: null,
    });
    assert.deepEqual(r, { ok: true, errors: [] });
});

test('validateResult: rejects bad signal', () => {
    const r = validateResult({ issue: 1, phase: 'triage', signal: 'nope', summary: 's' });
    assert.equal(r.ok, false);
    assert.ok(r.errors.some(e => e.includes('signal')));
});

test('validateResult: done requires boolean hitl and valid size/kind', () => {
    const r = validateResult({ issue: 1, phase: 'triage', signal: 'done', summary: 's', hitl: 'yes', size: 'huge', kind: 'X' });
    assert.equal(r.ok, false);
    assert.ok(r.errors.some(e => e.includes('hitl')));
    assert.ok(r.errors.some(e => e.includes('size')));
    assert.ok(r.errors.some(e => e.includes('kind')));
});

test('validateResult: done accepts subIssueSizes with valid sizes (#914)', () => {
    const r = validateResult({
        issue: 906, phase: 'decompose', signal: 'done', summary: 'ok', hitl: false,
        createdSubIssues: [910, 911], subIssueSizes: { 910: 'small', 911: 'middle' },
    });
    assert.deepEqual(r, { ok: true, errors: [] });
});

test('validateResult: done rejects subIssueSizes with an invalid size (#914)', () => {
    const r = validateResult({
        issue: 906, phase: 'decompose', signal: 'done', summary: 'ok', hitl: false,
        createdSubIssues: [910], subIssueSizes: { 910: 'huge' },
    });
    assert.equal(r.ok, false);
    assert.ok(r.errors.some(e => e.includes('subIssueSizes')));
});

test('validateResult: done rejects subIssueSizes that is not an object (#914)', () => {
    const r = validateResult({
        issue: 906, phase: 'decompose', signal: 'done', summary: 'ok', hitl: false,
        createdSubIssues: [910], subIssueSizes: ['small'],
    });
    assert.equal(r.ok, false);
    assert.ok(r.errors.some(e => e.includes('subIssueSizes')));
});

test('validateResult: hitl signal requires reason', () => {
    const r = validateResult({ issue: 1, phase: 'triage', signal: 'hitl', summary: 's' });
    assert.equal(r.ok, false);
    assert.ok(r.errors.some(e => e.includes('reason')));
});

test('validateResult: error signal requires error message', () => {
    const r = validateResult({ issue: 1, phase: 'triage', signal: 'error', summary: 's' });
    assert.equal(r.ok, false);
    assert.ok(r.errors.some(e => e.includes('error')));
});

test('readResultFile: parses and validates a file', () => {
    const p = path.join(os.tmpdir(), `autopilot-test-${process.pid}.json`);
    fs.writeFileSync(p, JSON.stringify({ issue: 5, phase: 'triage', signal: 'done', summary: 'x', hitl: false }));
    const r = readResultFile(p);
    fs.unlinkSync(p);
    assert.equal(r.ok, true);
    assert.equal(r.result.issue, 5);
});

test('readResultFile: reports missing file', () => {
    const r = readResultFile('/no/such/file.json');
    assert.equal(r.ok, false);
});

test('detectToken: returns the last token seen', () => {
    assert.equal(detectToken('blah\nAUTOPILOT_DONE\n'), TOKENS.DONE);
    assert.equal(detectToken('AUTOPILOT_DONE then AUTOPILOT_HITL'), TOKENS.HITL);
    assert.equal(detectToken('nothing here'), null);
});

// ---- モニターで答える質問（signal=hitl の questions） ----

const hitlBase = { issue: 1, phase: 'triage', signal: 'hitl', summary: 's', reason: 'どちらにしますか' };
const goodQuestions = [
    {
        id: 'q1', text: 'どちらの案にしますか',
        options: [{ key: 'a', label: '案 A', desc: '速い' }, { key: 'b', label: '案 B' }],
        recommended: 'a',
    },
    { id: 'q2', text: '名前は', options: [{ key: 'keep', label: 'そのまま' }] },
];

test('validateResult: hitl accepts questions with options and recommended', () => {
    assert.deepEqual(validateResult({ ...hitlBase, questions: goodQuestions }), { ok: true, errors: [] });
});

test('validateResult: questions only with signal=hitl (no new signal)', () => {
    const r = validateResult({ issue: 1, phase: 'triage', signal: 'done', summary: 's', hitl: true, questions: goodQuestions });
    assert.equal(r.ok, false);
    assert.ok(r.errors.some((e) => e.includes('only when signal=hitl')));
});

test('validateResult: questions rejects bad ids, duplicate keys, unknown recommended', () => {
    const bad = (questions) => validateResult({ ...hitlBase, questions });
    assert.equal(bad([]).ok, false);
    assert.equal(bad([{ ...goodQuestions[0], id: 'q 1 -->' }]).ok, false);
    assert.equal(bad([goodQuestions[0], { ...goodQuestions[1], id: 'q1' }]).ok, false);
    assert.equal(bad([{ ...goodQuestions[0], options: [{ key: 'a', label: 'x' }, { key: 'a', label: 'y' }] }]).ok, false);
    assert.equal(bad([{ ...goodQuestions[0], recommended: 'z' }]).ok, false);
    assert.equal(bad([{ ...goodQuestions[0], options: [] }]).ok, false);
    assert.equal(bad([{ ...goodQuestions[0], text: ' ' }]).ok, false);
    assert.equal(bad([{ ...goodQuestions[0], options: [{ key: 'a', label: '' }] }]).ok, false);
    assert.equal(bad([{ ...goodQuestions[0], options: [{ key: 'a', label: 'x', desc: 3 }] }]).ok, false);
});
