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

// ---- 「AI に任せる」（POST /delegate・#2404）
const { normalizeDelegateBody, planDelegate, humanWaitRows } = require('../src/phases');
const { delegateOnce } = require('../src/monitor-answers');

const wait = (over = {}) => ({ issue: 9, itemId: 'PVTI_9', status: 'Sprint Backlog', aiStatus: null, kind: 'Issue', hitlLabel: true, labels: [HITL_LABEL], ...over });

test('normalizeDelegateBody: positive integer issue only', () => {
    assert.equal(normalizeDelegateBody(null).ok, false);
    assert.equal(normalizeDelegateBody({ issue: 0 }).ok, false);
    assert.equal(normalizeDelegateBody({ issue: 1.5 }).ok, false);
    assert.equal(normalizeDelegateBody({ issue: 'abc' }).ok, false);
    assert.deepEqual(normalizeDelegateBody({ issue: '12' }), { ok: true, issue: 12 });
});

test('planDelegate: per item kind', () => {
    // Sprint Backlog の leaf は 🙋 を外すだけ
    assert.deepEqual(planDelegate(wait()), { ok: true, status: 200, action: 'release', intents: [], nextPhase: 'implement' });
    // まだ分解していない EPIC は Sprint Backlog へ（decompose）
    const epic = planDelegate(wait({ status: 'Backlog', kind: 'EPIC' }));
    assert.deepEqual([epic.action, epic.intents, epic.nextPhase], ['decompose', [{ field: 'Status', value: 'Sprint Backlog' }], 'decompose']);
    // 人間ゲートは 🙋 を外すと開く
    assert.equal(planDelegate(wait({ status: 'Review' })).nextPhase, 'address-review');
    assert.equal(planDelegate(wait({ status: 'Blocked' })).nextPhase, 'triage');
    assert.equal(planDelegate(wait({ status: 'Blocked' }), { pr: true }).nextPhase, 'address-review');
    assert.equal(planDelegate(wait({ status: 'Backlog', aiStatus: 'Discussing' })).nextPhase, 'discuss');
    assert.equal(planDelegate(wait({ status: 'In Progress', aiStatus: 'Decomposing', kind: 'EPIC' })).nextPhase, 'decompose');
    assert.equal(planDelegate(wait({ status: 'New Item' })).nextPhase, 'triage');
    // 受けないもの
    const code = (it, o) => planDelegate(it, o).code;
    assert.equal(planDelegate(null).status, 404);
    assert.equal(code(wait({ hitlLabel: false })), 'not-human-wait');
    assert.equal(code(wait(), { running: true }), 'running');
    assert.equal(code(wait(), { openQuestions: true }), 'open-questions');
    assert.equal(code(wait({ status: 'Backlog' })), 'human-work');
    assert.equal(code(wait({ status: 'In Progress', aiStatus: 'EPIC Decomposed', kind: 'EPIC' })), 'tracker');
    assert.equal(code(wait({ status: 'Sprint Backlog', kind: 'EPIC', labels: [HITL_LABEL, '🧭 tracking'] })), 'tracker');
    assert.equal(code(wait({ status: 'Icebox' })), 'resting');
    assert.equal(code(wait({ status: 'Close' })), 'resting');
    assert.equal(code(wait({ status: 'In Progress', aiStatus: null })), 'no-ai-phase'); // セッションの作業
    assert.ok(planDelegate(wait({ status: 'Backlog' })).status >= 400);
});

test('humanWaitRows: only 🙋 non-terminal items, with delegate availability', () => {
    const rows = humanWaitRows([
        wait({ issue: 1, title: 't1' }),
        wait({ issue: 2, status: 'Backlog' }),
        wait({ issue: 3, hitlLabel: false }),
        wait({ issue: 4, status: 'Close' }),
        wait({ issue: 5 }),
    ], { running: [5], questionIssues: [] });
    assert.deepEqual(rows.map((r) => r.issue), [1, 2, 5]);
    assert.deepEqual(rows[0], { issue: 1, title: 't1', status: 'Sprint Backlog', aiStatus: null, kind: 'Issue', delegate: { ok: true, action: 'release', nextPhase: 'implement' } });
    assert.equal(rows[1].delegate.code, 'human-work');
    assert.equal(rows[2].delegate.code, 'running');
});

const delegateIo = (calls, over = {}) => ({
    botToken: async () => 'bot', readToken: async () => 'read',
    getIssueLabels: async () => [HITL_LABEL],
    findPrForIssue: async () => over.pr === undefined ? { number: 90, labels: [HITL_LABEL] } : over.pr,
    editLabels: async (repo, n, type, diff) => { calls.push(['labels', n, type, diff.remove]); },
    applyIntents: async (ctx, itemId, intents) => {
        if (over.failIntents) throw new Error('boom ghp_abcdefghijklmnopqrstuvwxyz0123');
        calls.push(['intents', itemId, intents]);
    },
});

test('delegateOnce: releases 🙋 (Issue and PR), remembers it, then asks for a tick', async () => {
    const calls = [];
    const ticks = [];
    const state = { running: new Map(), board: { items: [wait()] } };
    const ctx = { cfg: { repo: 'o/r' }, state, log: () => {}, now: () => 5, afterRelease: (n) => ticks.push(n) };
    const r = await delegateOnce(ctx, { issue: 9 }, delegateIo(calls));
    assert.deepEqual(r, { status: 200, body: { ok: true, issue: 9, action: 'release', nextPhase: 'implement' } });
    assert.deepEqual(calls, [['labels', 9, 'issue', [HITL_LABEL]], ['labels', 90, 'pr', [HITL_LABEL]]]);
    assert.deepEqual(state.monitorReleases, { 9: 5 });
    assert.equal(state.board.items[0].hitlLabel, false);
    assert.deepEqual(state.board.items[0].labels, []);
    assert.deepEqual(ticks, [9]);
    // もう 🙋 が無いので二度目は受けない
    assert.equal((await delegateOnce(ctx, { issue: 9 }, delegateIo([]))).status, 409);
});

test('delegateOnce: Backlog EPIC moves to Sprint Backlog before releasing 🙋', async () => {
    const calls = [];
    const state = { running: new Map(), board: { items: [wait({ status: 'Backlog', kind: 'EPIC' })] } };
    const r = await delegateOnce({ cfg: { repo: 'o/r', projectId: 'P', fields: {} }, state, log: () => {}, now: () => 1 },
        { issue: 9 }, delegateIo(calls, { pr: null }));
    assert.equal(r.body.action, 'decompose');
    assert.deepEqual(calls, [['intents', 'PVTI_9', [{ field: 'Status', value: 'Sprint Backlog' }]], ['labels', 9, 'issue', [HITL_LABEL]]]);
    assert.equal(state.board.items[0].status, 'Sprint Backlog');
});

test('delegateOnce: rejects bad input, unknown items, open questions; failures keep 🙋 and are sanitized', async () => {
    const base = () => ({ running: new Map(), board: { items: [wait()] } });
    const ctx = (state) => ({ cfg: { repo: 'o/r' }, state, log: () => {}, now: () => 1 });
    assert.equal((await delegateOnce(ctx(base()), { issue: -1 }, delegateIo([]))).status, 400);
    assert.equal((await delegateOnce(ctx(base()), { issue: 99 }, delegateIo([]))).status, 404);
    const withQ = base();
    withQ.answerStore = createAnswerStore();
    withQ.answerStore.setQuestions(9, { phase: 'triage', round: 1, questions: QUESTIONS });
    assert.equal((await delegateOnce(ctx(withQ), { issue: 9 }, delegateIo([]))).body.code, 'open-questions');
    const epic = { running: new Map(), board: { items: [wait({ status: 'Backlog', kind: 'EPIC' })] } };
    const r = await delegateOnce(ctx(epic), { issue: 9 }, delegateIo([], { failIntents: true }));
    assert.equal(r.status, 502);
    assert.ok(!r.body.error.includes('ghp_abcdefghijklmnopqrstuvwxyz0123'));
    assert.equal(epic.monitorReleases, undefined);
    assert.equal(epic.board.items[0].hitlLabel, true);
});

// 俯瞰ボード（GET /board）の item は 🙋 を `hitl` で持つ（listItems の `hitlLabel` ではない）。どちらでも読む（#2404）
test('humanWaitRows / planDelegate: read board-shaped items (hitl instead of hitlLabel)', () => {
    const boardItem = { issue: 2374, itemId: 'PVTI_x', status: 'Sprint Backlog', kind: 'Issue', hitl: true, labels: ['🙋 HITL'] };
    const rows = humanWaitRows([boardItem, { issue: 1, status: 'Sprint Backlog', kind: 'Issue', hitl: false }]);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].issue, 2374);
    assert.equal(rows[0].delegate.ok, true);
    assert.equal(planDelegate(boardItem).nextPhase, 'implement');
    assert.equal(planDelegate({ ...boardItem, hitl: false }).code, 'not-human-wait');
});

// ---- 「AI に直してもらう」で指摘を見せて指示を受ける（#2415）
const {
    MONITOR_INSTRUCTION_MARKER, isMonitorInstructionComment, monitorInstructionText, renderMonitorInstructionComment,
    selectMonitorInstructions, normalizeDelegateInstruction, planMonitorInstructionPost, openPrNumber, reviewFindingsView,
    addressReviewMarker, handledReviewIds, handledInstructionIds, renderReviewFindingsComment,
} = require('../src/phases');
const { findingsOnce, handleDelegateHttp } = require('../src/monitor-answers');

const BOT = { login: 'smalruby3-editor-bot[bot]', type: 'Bot' };
const HUMAN = { login: 'takaokouji', type: 'User' };
const instr = (id, text, over = {}) => ({ id, body: renderMonitorInstructionComment({ text, login: 'takaokouji' }), user: BOT, ...over });

test('renderMonitorInstructionComment: marker, who, text; monitorInstructionText reverses it', () => {
    const body = renderMonitorInstructionComment({ text: '  FYI1 と FYI3 は直して。\nFYI2 はそのままで  ', login: '@takaokouji' });
    assert.ok(body.startsWith(MONITOR_INSTRUCTION_MARKER));
    assert.match(body, /モニターから `@takaokouji` の指示/);
    assert.equal(monitorInstructionText(body), 'FYI1 と FYI3 は直して。\nFYI2 はそのままで');
    assert.match(renderMonitorInstructionComment({ text: 'x' }), /モニターから 人間 の指示/);
    assert.equal(monitorInstructionText('no marker'), '');
});

test('isMonitorInstructionComment: only marked comments by the Bot (user-less comments go by the marker)', () => {
    assert.equal(isMonitorInstructionComment(instr(1, 'a')), true);
    assert.equal(isMonitorInstructionComment(instr(1, 'a', { user: HUMAN })), false); // 人間が目印を写しても指示にしない
    assert.equal(isMonitorInstructionComment({ id: 1, body: renderMonitorInstructionComment({ text: 'a' }) }), true);
    assert.equal(isMonitorInstructionComment({ id: 2, body: 'FYI1 を直して', user: HUMAN }), false);
    assert.equal(isMonitorInstructionComment(null), false);
});

test('addressReviewMarker: handled-instructions round-trips and keeps the old form', () => {
    assert.equal(addressReviewMarker([12]), '<!-- autopilot-address-review handled-reviews=12 -->');
    const m = addressReviewMarker([12], [300, '301', 300, 0]);
    assert.equal(m, '<!-- autopilot-address-review handled-reviews=12 handled-instructions=300,301 -->');
    const comments = [{ body: `${m}\n対応` }, { body: addressReviewMarker([], [302]) }];
    assert.deepEqual([...handledReviewIds(comments)], [12]);
    assert.deepEqual([...handledInstructionIds(comments)], [300, 301, 302]);
    assert.deepEqual([...handledInstructionIds([{ body: addressReviewMarker([5]) }])], []);
});

test('selectMonitorInstructions: unhandled marked comments only, oldest first', () => {
    const comments = [
        instr(11, 'second', { created_at: '2026-11-25T02:00:00Z' }),
        instr(10, 'first', { created_at: '2026-11-25T01:00:00Z' }),
        { id: 12, body: 'ふつうのコメント', user: HUMAN },
        instr(13, 'done'),
        { id: 14, body: addressReviewMarker([], [13]), user: BOT },
    ];
    assert.deepEqual(selectMonitorInstructions(comments).map((c) => c.id), [10, 11]);
    comments.push({ id: 15, body: addressReviewMarker([], [10, 11]), user: BOT });
    assert.deepEqual(selectMonitorInstructions(comments), []);
});

test('normalizeDelegateInstruction / planMonitorInstructionPost', () => {
    assert.deepEqual(normalizeDelegateInstruction({ issue: 1 }), { ok: true, instruction: null });
    assert.equal(normalizeDelegateInstruction({ instruction: '   \n ' }).ok, false);
    assert.equal(normalizeDelegateInstruction({ instruction: 3 }).ok, false);
    assert.equal(normalizeDelegateInstruction({ instruction: 'x'.repeat(4001) }).ok, false);
    assert.deepEqual(normalizeDelegateInstruction({ instruction: ' a\r\nb ' }), { ok: true, instruction: 'a\nb' });
    assert.deepEqual(planMonitorInstructionPost([instr(5, 'a')], 'a'), { action: 'skip', existingId: 5 });
    assert.deepEqual(planMonitorInstructionPost([instr(5, 'a'), { body: addressReviewMarker([], [5]) }], 'a'), { action: 'post' });
    assert.deepEqual(planMonitorInstructionPost([], 'a'), { action: 'post' });
});

test('openPrNumber / reviewFindingsView: latest round with its own counts', () => {
    assert.equal(openPrNumber([{ number: 1, state: 'MERGED' }, { number: 2, state: 'OPEN' }]), 2);
    assert.equal(openPrNumber([{ number: 1, state: 'CLOSED' }]), null);
    const r1 = renderReviewFindingsComment({ round: 1, findings: [{ category: 'Must', text: 'a' }] });
    const r2 = renderReviewFindingsComment({ round: 2, findings: [{ category: 'FYI', text: 'b' }, { category: 'FYI', text: 'c' }], start: { M: 2 } });
    const v = reviewFindingsView([{ id: 1, body: r1 }, { id: 2, body: r2 }, instr(3, 'FYI1 を直して')]);
    assert.equal(v.findings.round, 2);
    assert.equal(v.findings.id, 2);
    assert.deepEqual(v.findings.counts, { Must: 0, Question: 0, FYI: 2 });
    assert.deepEqual(v.pendingInstructions, ['FYI1 を直して']);
    assert.deepEqual(reviewFindingsView([]), { findings: null, pendingInstructions: [] });
});

const reviewItem = (over = {}) => wait({ status: 'Review', prs: [{ number: 90, state: 'OPEN', isDraft: false }], ...over });
const fixIo = (calls, over = {}) => ({
    ...delegateIo(calls, over),
    listIssueComments: async (repo, n, tok) => { calls.push(['list', n, tok]); return over.comments || []; },
    postIssueComment: async (repo, n, body, tok) => {
        if (over.failPost) throw new Error('post failed ghp_abcdefghijklmnopqrstuvwxyz0123');
        calls.push(['post', n, body, tok]);
    },
});

test('delegateOnce with instruction: posts a marked Bot comment on the PR, then releases 🙋', async () => {
    const calls = [];
    const state = { running: new Map(), board: { items: [reviewItem()] } };
    const ctx = { cfg: { repo: 'o/r', assignee: 'takaokouji' }, state, log: () => {}, now: () => 5 };
    const r = await delegateOnce(ctx, { issue: 9, instruction: ' FYI1 は直して ' }, fixIo(calls));
    assert.equal(r.status, 200);
    assert.deepEqual(r.body.instruction, { pr: 90, action: 'post' });
    assert.equal(r.body.nextPhase, 'address-review');
    assert.deepEqual(calls.map((c) => c[0]), ['list', 'post', 'labels', 'labels']);
    assert.equal(calls[0][2], 'read');
    assert.equal(calls[1][3], 'bot');
    assert.equal(monitorInstructionText(calls[1][2]), 'FYI1 は直して');
    assert.match(calls[1][2], /takaokouji/);
});

test('delegateOnce with instruction: no duplicate post, rejects empty, non-review, no PR; post failure keeps 🙋', async () => {
    const ctx = (state) => ({ cfg: { repo: 'o/r' }, state, log: () => {}, now: () => 1 });
    const fresh = (over) => ({ running: new Map(), board: { items: [reviewItem(over)] } });
    // 押し直し: 同じ指示がまだ対応されずに残っていれば書かない
    const calls = [];
    const r = await delegateOnce(ctx(fresh()), { issue: 9, instruction: 'a' }, fixIo(calls, { comments: [instr(70, 'a')] }));
    assert.deepEqual(r.body.instruction, { pr: 90, action: 'skip' });
    assert.ok(!calls.some((c) => c[0] === 'post'));
    // 空は送れない
    assert.equal((await delegateOnce(ctx(fresh()), { issue: 9, instruction: '  ' }, fixIo([]))).status, 400);
    // address-review にならない段では指示を受けない
    const sb = { running: new Map(), board: { items: [wait()] } };
    assert.equal((await delegateOnce(ctx(sb), { issue: 9, instruction: 'a' }, fixIo([]))).body.code, 'no-instruction-phase');
    // PR が無い
    const noPr = fresh({ prs: [] });
    assert.equal((await delegateOnce(ctx(noPr), { issue: 9, instruction: 'a' }, fixIo([], { pr: null }))).body.code, 'no-pr');
    // 書けなかったら 🙋 は外さない・秘密は出さない
    const st = fresh();
    const f = await delegateOnce(ctx(st), { issue: 9, instruction: 'a' }, fixIo([], { failPost: true }));
    assert.equal(f.status, 502);
    assert.ok(!f.body.error.includes('ghp_abcdefghijklmnopqrstuvwxyz0123'));
    assert.equal(st.board.items[0].hitlLabel, true);
    assert.equal(st.monitorReleases, undefined);
});

test('findingsOnce: reads PR comments once (read token) and returns the latest findings', async () => {
    const calls = [];
    const body = renderReviewFindingsComment({ round: 1, findings: [{ category: 'Must', text: 'x' }] });
    const state = { board: { items: [reviewItem()] } };
    const r = await findingsOnce({ cfg: { repo: 'o/r' }, state }, '9', fixIo(calls, { comments: [{ id: 4, body }] }));
    assert.equal(r.status, 200);
    assert.equal(r.body.pr, 90);
    assert.equal(r.body.findings.round, 1);
    assert.deepEqual(calls, [['list', 90, 'read']]);
    // board に PR が無ければ GitHub に聞く。PR が無ければ findings なし
    const st2 = { board: { items: [reviewItem({ prs: [] })] } };
    const r2 = await findingsOnce({ cfg: { repo: 'o/r' }, state: st2 }, 9, fixIo([], { pr: null }));
    assert.deepEqual(r2.body, { issue: 9, pr: null, findings: null, pendingInstructions: [] });
    assert.equal((await findingsOnce({ cfg: {}, state }, 'x', fixIo([]))).status, 400);
    assert.equal((await findingsOnce({ cfg: {}, state }, 99, fixIo([]))).status, 404);
});

test('handleDelegateHttp: GET /delegate/findings only; other paths are not handled', async () => {
    const state = { board: { items: [reviewItem()] } };
    const ctx = { cfg: { repo: 'o/r' }, state, deps: fixIo([], { comments: [] }) };
    const res = () => {
        const r = { code: null, body: null };
        r.done = new Promise((resolve) => {
            r.writeHead = (c) => { r.code = c; };
            r.end = (b) => { r.body = JSON.parse(b); resolve(); };
        });
        return r;
    };
    const r1 = res();
    assert.equal(handleDelegateHttp({ method: 'GET' }, r1, new URL('http://x/delegate/findings?issue=9'), ctx), true);
    await r1.done;
    assert.equal(r1.code, 200);
    assert.equal(r1.body.pr, 90);
    const r2 = res();
    assert.equal(handleDelegateHttp({ method: 'POST' }, r2, new URL('http://x/delegate/findings?issue=9'), ctx), true);
    await r2.done;
    assert.equal(r2.code, 405);
    assert.equal(handleDelegateHttp({ method: 'GET' }, res(), new URL('http://x/board'), ctx), false);
});
