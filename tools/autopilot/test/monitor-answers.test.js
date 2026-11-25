'use strict';
/**
 * モニターで答える（ui-policy §8 の U1・U2）: phases.js の純粋関数と monitor-answers.js の置き場・受け口。
 * GitHub の I/O は deps で差し替える（実 GitHub に触らない）。
 */
const { test } = require('node:test');
const assert = require('node:assert');
const os = require('os');
const fs = require('fs');
const path = require('path');
const {
    monitorQuestionsMarker, monitorAnswerMarker, planMonitorQuestionsComment, renderMonitorQuestionsComment,
    normalizeMonitorAnswerBody, planMonitorAnswer, planMonitorAnswerComments, renderMonitorAnswersForPrompt,
    monitorQuestionsView, pruneMonitorReleases, withMonitorReleases, hitlLabelAction, labelActions,
    phasePromptCommand, HITL_LABEL,
} = require('../src/phases');
const {
    createAnswerStore, answerOnce, recordHitlQuestions, proceedMonitorAnswer, deliverMonitorAnswers,
} = require('../src/monitor-answers');

const QUESTIONS = [
    { id: 'q1', text: 'どちらの案にしますか', options: [{ key: 'a', label: '案 A', desc: '速い' }, { key: 'b', label: '案 B' }], recommended: 'a' },
    { id: 'q2', text: '名前は', options: [{ key: 'keep', label: 'そのまま' }] },
];
const entry = (over = {}) => ({ issue: 7, phase: 'triage', round: 2, questions: QUESTIONS, status: 'open', drafts: {}, ...over });

test('questions comment: marker, recommended, sanitized text', () => {
    const body = renderMonitorQuestionsComment(7, 1, [{ ...QUESTIONS[0], text: 'token ghp_abcdefghijklmnopqrstuvwxyz0123' }], { phase: 'triage', reason: 'r' });
    assert.ok(body.startsWith(monitorQuestionsMarker(7, 1)));
    assert.ok(body.includes('`a` 案 A — 速い **（おすすめ）**'));
    assert.ok(!body.includes('ghp_abcdefghijklmnopqrstuvwxyz0123'));
});

test('planMonitorQuestionsComment: first is round 1, same questions skip, new questions next round', () => {
    const p1 = planMonitorQuestionsComment([], 7, QUESTIONS, { phase: 'triage' });
    assert.deepEqual([p1.action, p1.round], ['post', 1]);
    const comments = [{ id: 11, body: p1.body }, { id: 12, body: monitorQuestionsMarker(8, 5) }];
    assert.deepEqual(planMonitorQuestionsComment(comments, 7, QUESTIONS, { phase: 'triage' }).action, 'skip');
    const p2 = planMonitorQuestionsComment(comments, 7, [QUESTIONS[1]], { phase: 'triage' });
    assert.deepEqual([p2.action, p2.round], ['post', 2]);
});

test('normalizeMonitorAnswerBody: validates shape', () => {
    assert.equal(normalizeMonitorAnswerBody({ issue: 7, answers: [{ q: 'q1', key: 'a' }] }).ok, false); // proceed 必須
    assert.equal(normalizeMonitorAnswerBody({ issue: 0, answers: [], proceed: true }).ok, false);
    assert.equal(normalizeMonitorAnswerBody({ issue: 7, answers: [{ q: 'q1' }], proceed: false }).ok, false); // key か note
    assert.equal(normalizeMonitorAnswerBody({ issue: 7, answers: [{ q: 'q1', note: 'x'.repeat(2001) }], proceed: false }).ok, false);
    const n = normalizeMonitorAnswerBody({ issue: '7', answers: [{ q: 'q1', note: ' 別案で ' }], proceed: false });
    assert.deepEqual(n, { ok: true, issue: 7, answers: [{ q: 'q1', key: null, note: '別案で' }], proceed: false });
});

test('planMonitorAnswer: drafts merge, unknown q/key rejected, proceed needs all answers', () => {
    assert.equal(planMonitorAnswer(null, { answers: [] }, 1).status, 404);
    assert.equal(planMonitorAnswer(entry({ status: 'answered' }), { answers: [] }, 1).status, 409);
    assert.equal(planMonitorAnswer(entry(), { answers: [{ q: 'zz', key: 'a' }] }, 1).status, 400);
    assert.equal(planMonitorAnswer(entry(), { answers: [{ q: 'q1', key: 'z' }] }, 1).status, 400);
    const partial = planMonitorAnswer(entry(), { answers: [{ q: 'q1', key: 'a', note: null }], proceed: true }, 1);
    assert.equal(partial.status, 400);
    assert.match(partial.error, /q2/);
    const ok = planMonitorAnswer(entry({ drafts: { q1: { key: 'b', note: 'メモ', at: 1 } } }),
        { answers: [{ q: 'q2', key: 'keep', note: null }], proceed: true }, 5);
    assert.equal(ok.ok, true);
    assert.deepEqual(ok.records, [
        { q: 'q1', key: 'b', label: '案 B', note: 'メモ', at: 1 },
        { q: 'q2', key: 'keep', label: 'そのまま', note: null, at: 5 },
    ]);
});

test('planMonitorAnswerComments: one comment per question, same answer is not written twice', () => {
    const recs = [{ q: 'q1', key: 'a', label: '案 A', note: null }, { q: 'q2', key: null, label: null, note: 'note' }];
    const first = planMonitorAnswerComments([], 7, entry(), recs);
    assert.deepEqual(first.map((p) => p.action), ['post', 'post']);
    assert.ok(first[0].body.startsWith(monitorAnswerMarker(7, 2, 'q1')));
    assert.ok(first[1].body.includes('メモで答えた'));
    const comments = first.map((p, i) => ({ id: i + 1, body: p.body }));
    assert.deepEqual(planMonitorAnswerComments(comments, 7, entry(), recs).map((p) => p.action), ['skip', 'skip']);
    const changed = planMonitorAnswerComments(comments, 7, entry(), [{ ...recs[0], key: 'b', label: '案 B' }]);
    assert.deepEqual([changed[0].action, changed[0].keepId], ['patch', 1]);
    // 次の round の同じ ID は前の答えを上書きしない
    assert.equal(planMonitorAnswerComments(comments, 7, entry({ round: 3 }), [recs[0]])[0].action, 'post');
});

test('renderMonitorAnswersForPrompt and phasePromptCommand pass answers to the worker', () => {
    const text = renderMonitorAnswersForPrompt(7, entry({ records: [{ q: 'q1', key: 'a', label: '案 A', note: '急ぎ' }] }));
    assert.ok(text.includes('## q1. どちらの案にしますか'));
    assert.ok(text.includes('`a` 案 A'));
    assert.ok(text.includes('急ぎ'));
    assert.ok(!phasePromptCommand('autopilot-triage', 7, '/p').includes('Read し、その答え'));
    assert.ok(phasePromptCommand('autopilot-triage', 7, '/p', { answersFile: '/w/tmp/a.md' }).includes('/w/tmp/a.md'));
});

test('monitorQuestionsView: answered counts for open and answered entries', () => {
    const v = monitorQuestionsView({
        7: entry({ askedAt: '2026-01-02T00:00:00Z', drafts: { q1: { key: 'a', note: null, at: 1 } } }),
        8: entry({ issue: 8, askedAt: '2026-01-01T00:00:00Z', status: 'answered', records: [{ q: 'q1' }, { q: 'q2' }] }),
    });
    assert.deepEqual(v.map((e) => [e.issue, e.status, e.answered, e.total]), [[8, 'answered', 2, 2], [7, 'open', 1, 2]]);
});

test('monitor releases: prune when the list shows 🙋 gone, and mark ctx', () => {
    const r = pruneMonitorReleases({ 7: 1, 8: 2, 9: 3 }, [{ issue: 7, hitlLabel: true }, { issue: 8, hitlLabel: false }]);
    assert.deepEqual(r, { 7: 1 });
    assert.deepEqual(withMonitorReleases({ 7: { pr: 3 } }, r), { 7: { pr: 3, monitorReleased: true } });
});

test('hitlLabelAction: monitorReleased does not re-add 🙋 from a stale item (force still adds)', () => {
    const stale = { status: 'Blocked', hitlLabel: true };
    assert.equal(hitlLabelAction(stale, false, {}), 'add'); // これまでの挙動
    assert.equal(hitlLabelAction(stale, false, { monitorReleased: true }), null);
    assert.equal(hitlLabelAction(stale, true, { monitorReleased: true }), 'remove');
    assert.equal(hitlLabelAction(stale, false, { monitorReleased: true, force: true }), 'add');
    assert.ok(!labelActions(stale, [], { monitorReleased: true }).add.includes(HITL_LABEL));
});

test('store: drafts persist to file, take returns only answered entries', () => {
    const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'ap-answers-')), 'monitor-answers.json');
    const s1 = createAnswerStore({ file, now: () => 0 });
    s1.setQuestions(7, { phase: 'triage', round: 1, questions: QUESTIONS });
    s1.saveDrafts(7, { q1: { key: 'a', note: null, at: 1 } });
    const s2 = createAnswerStore({ file });
    assert.deepEqual(s2.get(7).drafts, { q1: { key: 'a', note: null, at: 1 } });
    assert.equal(s2.take(7), null); // 答えていない質問は worker を起こすときに捨てる
    assert.equal(s2.get(7), null);
    s2.setQuestions(8, { phase: 'triage', round: 1, questions: QUESTIONS });
    s2.markAnswered(8, {}, [{ q: 'q1' }]);
    assert.equal(s2.take(8).status, 'answered');
});

test('answerOnce: memo only saves locally, proceed calls onProceed once and marks answered', async () => {
    const store = createAnswerStore({ now: () => 0 });
    store.setQuestions(7, { phase: 'triage', round: 1, questions: QUESTIONS });
    let calls = 0;
    const ctx = { store, now: () => 9, onProceed: async () => { calls += 1; return { status: 200, body: { released: true } }; } };
    const memo = await answerOnce(ctx, { issue: 7, answers: [{ q: 'q1', key: 'a' }], proceed: false });
    assert.equal(memo.status, 200);
    assert.equal(calls, 0);
    assert.equal(store.get(7).status, 'open');
    assert.equal((await answerOnce(ctx, { issue: 7, answers: [], proceed: true })).status, 400); // q2 が無い
    const r = await answerOnce(ctx, { issue: 7, answers: [{ q: 'q2', key: 'keep' }], proceed: true });
    assert.equal(r.status, 200);
    assert.equal(calls, 1);
    assert.equal(store.get(7).status, 'answered');
    assert.equal((await answerOnce(ctx, { issue: 7, answers: [], proceed: true })).status, 409); // 二重に進めない
});

test('answerOnce: a failed onProceed keeps the entry open', async () => {
    const store = createAnswerStore();
    store.setQuestions(7, { phase: 'triage', round: 1, questions: [QUESTIONS[1]] });
    const ctx = { store, onProceed: async () => ({ status: 502, body: { error: 'x' } }) };
    assert.equal((await answerOnce(ctx, { issue: 7, answers: [{ q: 'q2', key: 'keep' }], proceed: true })).status, 502);
    assert.equal(store.get(7).status, 'open');
});

const fakeIo = (calls, over = {}) => ({
    botToken: async () => 'bot', readToken: async () => 'read',
    applyCommentPlans: async (repo, n, planFn) => { const plans = planFn(over.comments || []); calls.push(['comments', n, plans.map((p) => p.action)]); return plans; },
    getIssueLabels: async () => over.issueLabels || [HITL_LABEL],
    findPrForIssue: async () => over.pr === undefined ? { number: 70, labels: [HITL_LABEL] } : over.pr,
    editLabels: async (repo, n, type, diff) => { calls.push(['labels', n, type, diff.remove]); },
});

test('recordHitlQuestions: stores questions and writes the marked comment', async () => {
    const calls = [];
    const store = createAnswerStore();
    const r = await recordHitlQuestions(7, { signal: 'hitl', phase: 'triage', reason: 'r', questions: QUESTIONS },
        { cfg: { repo: 'o/r' }, store, log: () => {} }, fakeIo(calls));
    assert.deepEqual(r, { recorded: true, round: 1, action: 'post' });
    assert.deepEqual(calls, [['comments', 7, ['post']]]);
    assert.equal(store.get(7).questions.length, 2);
    assert.deepEqual(await recordHitlQuestions(7, { signal: 'done' }, { store }, fakeIo([])), { recorded: false });
});

test('proceedMonitorAnswer: writes answers, removes 🙋 on Issue and PR, remembers the release', async () => {
    const calls = [];
    const state = { running: new Map(), board: { items: [{ issue: 7, hitlLabel: true }] } };
    const plan = { records: [{ q: 'q1', key: 'a', label: '案 A', note: null }] };
    const r = await proceedMonitorAnswer(7, entry(), plan, { cfg: { repo: 'o/r' }, state, log: () => {}, now: () => 42 }, fakeIo(calls));
    assert.equal(r.status, 200);
    assert.deepEqual(calls, [['comments', 7, ['post']], ['labels', 7, 'issue', [HITL_LABEL]], ['labels', 70, 'pr', [HITL_LABEL]]]);
    assert.deepEqual(state.monitorReleases, { 7: 42 });
    assert.equal(state.board.items[0].hitlLabel, false);
    // 実行中の worker がいれば受けない
    state.running.set(8, {});
    assert.equal((await proceedMonitorAnswer(8, entry(), plan, { cfg: {}, state, log: () => {} }, fakeIo([]))).status, 409);
});

test('proceedMonitorAnswer: a GitHub failure does not release', async () => {
    const state = { running: new Map() };
    const io = { ...fakeIo([]), applyCommentPlans: async () => { throw new Error('boom'); } };
    const r = await proceedMonitorAnswer(7, entry(), { records: [] }, { cfg: { repo: 'o/r' }, state, log: () => {} }, io);
    assert.equal(r.status, 502);
    assert.equal(state.monitorReleases, undefined);
});

test('deliverMonitorAnswers: writes the answers file once and clears the release', () => {
    const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'ap-wt-'));
    const store = createAnswerStore();
    store.setQuestions(7, { phase: 'triage', round: 1, questions: QUESTIONS });
    store.markAnswered(7, {}, [{ q: 'q1', key: 'a', label: '案 A', note: null }]);
    const state = { answerStore: store, monitorReleases: { 7: 1 } };
    const file = deliverMonitorAnswers(7, cwd, state);
    assert.equal(file, path.join(cwd, 'tmp', 'autopilot-answers-7.md'));
    assert.ok(fs.readFileSync(file, 'utf8').includes('`a` 案 A'));
    assert.deepEqual(state.monitorReleases, {});
    assert.equal(deliverMonitorAnswers(7, cwd, state), null);
});
