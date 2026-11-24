'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const L = require('../src/learnings');

const NOW = Date.parse('2026-11-25T00:00:00Z');
const entry = (id, areas, kind = 'intent', createdAt = '2026-11-24T00:00:00Z') => ({ id, kind, areas, text: `t-${id}`, createdAt });

test('normalizeAreas: 形の悪いものを捨て、空なら general', () => {
    assert.deepEqual(L.normalizeAreas(['Scratch-GUI', 'bad area', 'scratch-gui', '']), ['scratch-gui']);
    assert.deepEqual(L.normalizeAreas([]), ['general']);
    assert.deepEqual(L.normalizeAreas('autopilot, infra'), ['autopilot', 'infra']);
});

test('newLearningEntry: 時刻と suffix から id を作り、検証を通る', () => {
    const e = L.newLearningEntry({ kind: 'review', areas: ['autopilot'], text: ' 見る ', reason: 'なぜ', source: { epic: 2384, junk: 1 } },
        { nowMs: NOW, suffix: 'ab' });
    assert.equal(e.id, '20261125-000000Z-review-ab');
    assert.equal(e.text, '見る');
    assert.deepEqual(e.source, { epic: 2384 });
    assert.ok(L.validateLearning(e).ok);
    assert.equal(L.learningFileName(e), '20261125-000000Z-review-ab.json');
});

test('validateLearning: 足りないものを挙げる', () => {
    const v = L.validateLearning({ id: 'x y', kind: 'other', areas: [], text: '' });
    assert.equal(v.ok, false);
    assert.equal(v.errors.length, 5);
});

test('groupLearningsByArea: 2 分野の学びは両方に入り、古い順', () => {
    const g = L.groupLearningsByArea([
        entry('b', ['autopilot', 'scratch-gui'], 'intent', '2026-11-24T02:00:00Z'),
        entry('a', ['autopilot'], 'review', '2026-11-24T01:00:00Z'),
    ]);
    assert.deepEqual(g.map((x) => [x.area, x.entries.map((e) => e.id)]), [['autopilot', ['a', 'b']], ['scratch-gui', ['b']]]);
});

test('learningsPrPlan: 件数・古さ・開いている PR で決める', () => {
    const few = [entry('a', ['general'])];
    assert.equal(L.learningsPrPlan([], { nowMs: NOW }).ready, false);
    assert.equal(L.learningsPrPlan(few, { nowMs: NOW }).ready, false);
    assert.equal(L.learningsPrPlan(few, { nowMs: NOW, threshold: 1 }).ready, true);
    const old = [entry('a', ['general'], 'intent', '2026-11-01T00:00:00Z')];
    assert.equal(L.learningsPrPlan(old, { nowMs: NOW }).ready, true);
    const five = ['a', 'b', 'c', 'd', 'e'].map((id) => entry(id, ['general']));
    assert.equal(L.learningsPrPlan(five, { nowMs: NOW }).ready, true);
    const withPr = L.learningsPrPlan(five, { nowMs: NOW, pr: { number: 9, ids: ['a', 'b'] } });
    assert.equal(withPr.ready, false);
    assert.equal(withPr.count, 3);
});

test('summarizeChecks', () => {
    assert.equal(L.summarizeChecks([]), 'none');
    assert.equal(L.summarizeChecks([{ status: 'completed', conclusion: 'success' }, { status: 'completed', conclusion: 'skipped' }]), 'success');
    assert.equal(L.summarizeChecks([{ status: 'in_progress', conclusion: null }]), 'pending');
    assert.equal(L.summarizeChecks([{ status: 'in_progress' }, { status: 'completed', conclusion: 'failure' }]), 'failure');
});

test('canMergeLearningsPr: docs/.claude だけ・develop 宛て・CI が通ったときだけ', () => {
    const ok = { state: 'open', base: 'develop', files: ['docs/autopilot/learned/general.md'], checks: 'success' };
    assert.equal(L.canMergeLearningsPr(ok).ok, true);
    assert.equal(L.canMergeLearningsPr({ ...ok, files: ['tools/autopilot/src/x.js'] }).ok, false);
    assert.equal(L.canMergeLearningsPr({ ...ok, checks: 'pending' }).ok, false);
    assert.equal(L.canMergeLearningsPr({ ...ok, checks: 'failure' }).ok, false);
    assert.equal(L.canMergeLearningsPr({ ...ok, base: 'topic/x' }).ok, false);
    assert.equal(L.canMergeLearningsPr({ ...ok, draft: true }).ok, false);
    assert.equal(L.canMergeLearningsPr({ ...ok, state: 'closed' }).ok, false);
});

test('learningsAction', () => {
    assert.equal(L.learningsAction({ plan: { ready: true, count: 5 }, pr: null }).action, 'create');
    assert.equal(L.learningsAction({ plan: { ready: false }, pr: { number: 3 } }).action, 'merge');
    assert.equal(L.learningsAction({ plan: { ready: true }, pr: null, creating: true }).action, 'creating');
    assert.equal(L.learningsAction({ plan: { ready: false, reason: 'x' }, pr: null }).disabled, true);
});

test('renderLearningsWorkFile: 分野ごとに書き直す先と中身を並べる', () => {
    const md = L.renderLearningsWorkFile([{ ...entry('a', ['autopilot']), reason: 'r', source: { epic: 1, answer: 'B' } }]);
    assert.match(md, /^<!-- autopilot-learnings-work -->/);
    assert.match(md, /## autopilot/);
    assert.match(md, /docs\/autopilot\/learned\/autopilot\.md/);
    assert.match(md, /人間の理由: r/);
    assert.match(md, /人間の答え: B/);
});

test('learnedRuleFilesFor: general と触った分野だけ', () => {
    assert.deepEqual(L.learnedRuleFilesFor(['packages/scratch-gui/src/a.js', 'README.md']),
        ['docs/autopilot/learned/general.md', 'docs/autopilot/learned/scratch-gui.md']);
});
