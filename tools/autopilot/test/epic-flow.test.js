'use strict';
/** epic-flow.test.js — EPIC 単位の確認（#2385）の純粋関数と、epic-merge.js の I/O のつなぎ */
const { test } = require('node:test');
const assert = require('node:assert');
const ef = require('../src/epic-flow');
const em = require('../src/epic-merge');
const { validateResult } = require('../src/contract');
const { phaseForItem, renderReviewFindingsComment, addressReviewMarker } = require('../src/phases');

const fields = (intents) => Object.fromEntries(intents.map((i) => [i.field, i.value]));

test('isEpicFlowBase: topic/ のブランチだけ', () => {
    assert.equal(ef.isEpicFlowBase('topic/autopilot-redesign-2384'), true);
    assert.equal(ef.isEpicFlowBase('develop'), false);
    assert.equal(ef.isEpicFlowBase('feature/x'), false);
    assert.equal(ef.isEpicFlowBase(null), false);
    assert.equal(ef.isEpicFlowBase('topic/x', 'topic/x'), false);
});

test('altBranchName: topic/<epic>-alt-<番号>', () => {
    assert.equal(ef.altBranchName('topic/autopilot-redesign-2384', 2385), 'topic/autopilot-redesign-2384-alt-2385');
});

test('mustFixPlan: Must 0 はマージ、3 回直すまでは直す、そのあとは止める', () => {
    assert.equal(ef.mustFixPlan({ mustCount: 0, round: 5 }), 'merge');
    assert.equal(ef.mustFixPlan({ mustCount: 2, round: 1 }), 'fix');
    assert.equal(ef.mustFixPlan({ mustCount: 2, round: 3 }), 'fix');
    assert.equal(ef.mustFixPlan({ mustCount: 2, round: 4 }), 'escalate');
});

const review = (extra) => ({ issue: 1, phase: 'review', signal: 'done', summary: 's', hitl: true, nextStatus: 'Review', nextAiStatus: null, ...extra });

test('resolveRunOutcome: EPIC の流れでない結果は従来どおり', () => {
    const o = ef.resolveRunOutcome(review({ mustCount: 0 }), { epicFlow: false });
    assert.equal(o.hitl, true);
    assert.equal(fields(o.intents).Status, 'Review');
    assert.equal(o.plan, null);
});

test('resolveRunOutcome: review の Must 0 は Review + 🙋 なし（自動マージ待ち）', () => {
    const o = ef.resolveRunOutcome(review({ mustCount: 0, round: 1 }), { epicFlow: true });
    assert.deepEqual(fields(o.intents), { Status: 'Review', 'AI Status': null });
    assert.equal(o.hitl, false);
});

test('resolveRunOutcome: review の Must ありは In Progress + Addressing Comments（🙋 なし）', () => {
    const o = ef.resolveRunOutcome(review({ mustCount: 1, round: 2 }), { epicFlow: true });
    assert.deepEqual(fields(o.intents), { Status: 'In Progress', 'AI Status': 'Addressing Comments' });
    assert.equal(o.hitl, false);
    // その状態から address-review が起動する
    assert.equal(phaseForItem({ status: 'In Progress', aiStatus: 'Addressing Comments', hitlLabel: false, kind: 'Issue', labels: [] }), 'address-review');
});

test('resolveRunOutcome: 3 回直しても Must が残ったら Blocked + 🙋 + escalation', () => {
    const o = ef.resolveRunOutcome(review({ mustCount: 2, round: 4 }), { epicFlow: true });
    assert.equal(fields(o.intents).Status, 'Blocked');
    assert.equal(o.hitl, true);
    assert.deepEqual(o.escalation, { kind: 'must-exhausted', mustCount: 2, round: 4 });
});

test('resolveRunOutcome: mustCount の無い review は従来どおり', () => {
    const o = ef.resolveRunOutcome(review({}), { epicFlow: true });
    assert.equal(o.hitl, true);
    assert.equal(o.plan, null);
});

test('resolveRunOutcome: 自動の直しの address-review は review へ戻す', () => {
    const r = { issue: 1, phase: 'address-review', signal: 'done', summary: 's', hitl: true, nextStatus: 'Review' };
    const o = ef.resolveRunOutcome(r, { epicFlow: true, priorStatus: 'In Progress', priorAiStatus: 'Addressing Comments' });
    assert.deepEqual(fields(o.intents), { Status: 'In Progress', 'AI Status': 'Self-Reviewing' });
    assert.equal(o.hitl, false);
    // 人間ゲートからの address-review は従来どおり
    const h = ef.resolveRunOutcome(r, { epicFlow: true, priorStatus: 'Review', priorAiStatus: null });
    assert.equal(h.hitl, true);
});

test('resolveRunOutcome: checkpoint は 🙋 なしで続ける', () => {
    const r = { issue: 1, phase: 'implement', signal: 'hitl', summary: 's', reason: 'checkpoint', nextAiStatus: 'Awaiting Continuation' };
    const o = ef.resolveRunOutcome(r, { epicFlow: true });
    assert.equal(o.hitl, false);
    assert.equal(fields(o.intents)['AI Status'], 'Awaiting Continuation');
    // 🙋 なしの Awaiting Continuation は元のフェーズへ再開する
    assert.equal(phaseForItem({ status: 'In Progress', aiStatus: 'Awaiting Continuation', hitlLabel: false, kind: 'Issue', labels: [] }), 'implement');
});

test('resolveRunOutcome: EPIC の子の想定外の 🙋 は残して警告する。diverge / environment は警告しない', () => {
    const r = { issue: 1, phase: 'triage', signal: 'hitl', summary: 's', reason: 'どちらにしますか' };
    const o = ef.resolveRunOutcome(r, { epicFlow: true });
    assert.equal(o.hitl, true);
    assert.deepEqual(o.warnings, ['unexpected-hitl']);
    assert.deepEqual(ef.resolveRunOutcome({ ...r, hitlKind: 'diverge' }, { epicFlow: true }).warnings, []);
    assert.deepEqual(ef.resolveRunOutcome({ ...r, phase: 'implement' }, { epicFlow: true }).warnings, []);
});

test('決定待ち: 正規化・重複の置きかえ・まとめコメントの往復', () => {
    const d1 = ef.normalizeDecision({ kind: 'question', ref: 'Q1', title: '名前', recommendation: 'A', alternatives: ['B'] }, { issue: 10, pr: 20 });
    assert.equal(d1.issue, 10);
    assert.equal(d1.pr, 20);
    assert.equal(ef.normalizeDecision({ kind: 'nope', title: 'x' }), null);
    assert.equal(ef.normalizeDecision({ kind: 'question', title: ' ' }), null);
    const d2 = ef.normalizeDecision({ kind: 'two-way', title: '並べ方', recommendation: '縦', alternatives: ['横'], adopted: '縦', altPr: 21, preview: 'https://p/a/', altPreview: 'https://p/b/' }, { issue: 11, pr: 22 });
    const body = ef.nextEpicDecisionsBody(null, [d1, d2]);
    assert.ok(body.startsWith(`${ef.EPIC_DECISIONS_MARKER} count=2 -->`));
    // EPIC の欄の「決定待ち」の数（epic-summary.js）が読める
    assert.equal(require('../src/epic-summary').countEpicDecisions(body), 2);
    assert.equal(ef.findEpicDecisionsComment([{ id: 1, body: 'x' }, { id: 2, body }]).id, 2);
    assert.equal(ef.findEpicDecisionsComment([{ id: 3, body: '<!-- autopilot-epic-decisions -->' }]).id, 3);
    assert.match(body, /### #10 \/ PR #20/);
    assert.match(body, /別案 #21（draft）/);
    assert.match(body, /プレビュー https:\/\/p\/a\//);
    assert.deepEqual(ef.parseEpicDecisionsData(body), [d1, d2]);
    // 同じものを足しても変わらない → 書かない
    assert.equal(ef.nextEpicDecisionsBody({ id: 1, body }, [d1]), null);
    // 同じ題の新しい内容は置きかえる
    const changed = ef.nextEpicDecisionsBody({ id: 1, body }, [{ ...d1, recommendation: 'C' }]);
    const parsed = ef.parseEpicDecisionsData(changed);
    assert.equal(parsed.length, 2);
    assert.equal(parsed[0].recommendation, 'C');
    assert.equal(ef.nextEpicDecisionsBody(null, []), null);
});

test('決定待ち: 止めているものを先に出す', () => {
    const a = ef.normalizeDecision({ kind: 'ai-decision', title: 'a' }, { issue: 1 });
    const b = ef.daemonDecision({ kind: 'must-exhausted', mustCount: 2, round: 4 }, { issue: 1, pr: 5 });
    const body = ef.renderEpicDecisionsComment([a, b]);
    assert.ok(body.indexOf('Must が残った') < body.indexOf('AI が決めたこと'));
    assert.match(body, /止めているもの 1 件/);
});

test('ciStateFromRollup', () => {
    assert.equal(ef.ciStateFromRollup([]), 'none');
    assert.equal(ef.ciStateFromRollup([{ __typename: 'CheckRun', status: 'COMPLETED', conclusion: 'SUCCESS' }, { __typename: 'CheckRun', status: 'COMPLETED', conclusion: 'SKIPPED' }]), 'success');
    assert.equal(ef.ciStateFromRollup([{ __typename: 'CheckRun', status: 'IN_PROGRESS' }]), 'pending');
    assert.equal(ef.ciStateFromRollup([{ __typename: 'CheckRun', status: 'COMPLETED', conclusion: 'FAILURE' }, { __typename: 'CheckRun', status: 'IN_PROGRESS' }]), 'failure');
    assert.equal(ef.ciStateFromRollup([{ __typename: 'StatusContext', state: 'PENDING' }]), 'pending');
    assert.equal(ef.ciStateFromRollup([{ __typename: 'StatusContext', state: 'ERROR' }]), 'failure');
});

const facts = (extra) => ({
    number: 5, state: 'OPEN', isDraft: false, baseRefName: 'topic/x-1', mergeable: 'MERGEABLE',
    reviewDecision: '', statusCheckRollup: [{ __typename: 'CheckRun', status: 'COMPLETED', conclusion: 'SUCCESS' }],
    updatedAt: '2026-11-24T00:00:00Z', ...extra,
});

test('autoMergePlan', () => {
    const now = Date.parse('2026-11-24T01:00:00Z');
    assert.equal(ef.autoMergePlan(facts(), { nowMs: now }).action, 'merge');
    assert.equal(ef.autoMergePlan(facts({ baseRefName: 'develop' }), { nowMs: now }).action, 'skip');
    assert.equal(ef.autoMergePlan(facts({ state: 'MERGED' }), { nowMs: now }).action, 'skip');
    assert.equal(ef.autoMergePlan(facts({ mergeable: 'CONFLICTING' }), { nowMs: now }).action, 'conflict');
    assert.equal(ef.autoMergePlan(facts({ mergeable: 'UNKNOWN' }), { nowMs: now }).action, 'wait');
    assert.equal(ef.autoMergePlan(facts({ isDraft: true }), { nowMs: now }).action, 'wait');
    assert.equal(ef.autoMergePlan(facts({ reviewDecision: 'CHANGES_REQUESTED' }), { nowMs: now }).action, 'fix');
    // 対応済みの Request changes だけなら（reviewDecision が残っていても）マージ
    assert.equal(ef.autoMergePlan(facts({ reviewDecision: 'CHANGES_REQUESTED', unhandledRequestedReviews: 0 }), { nowMs: now }).action, 'merge');
    assert.equal(ef.autoMergePlan(facts({ statusCheckRollup: [{ __typename: 'CheckRun', status: 'COMPLETED', conclusion: 'FAILURE' }] }), { nowMs: now }).action, 'fix');
    assert.equal(ef.autoMergePlan(facts({ statusCheckRollup: [{ __typename: 'CheckRun', status: 'QUEUED' }] }), { nowMs: now }).action, 'wait');
    // チェックが無い PR は push 直後なら待ち、しばらく経てばマージ
    assert.equal(ef.autoMergePlan(facts({ statusCheckRollup: [], updatedAt: '2026-11-24T00:55:00Z' }), { nowMs: now }).action, 'wait');
    assert.equal(ef.autoMergePlan(facts({ statusCheckRollup: [] }), { nowMs: now }).action, 'merge');
    assert.equal(ef.autoMergePlan(null).action, 'skip');
});

test('phaseForItem: Review + 🙋 なしは autoMerge のとき動かない（daemon の自動マージ待ち）', () => {
    const item = { status: 'Review', hitlLabel: false, kind: 'Issue', labels: [] };
    assert.equal(phaseForItem(item, { autoMerge: true }), null);
    assert.equal(phaseForItem(item, {}), 'address-review');
    // 🙋 が付いていれば従来どおり待つ
    assert.equal(phaseForItem({ ...item, hitlLabel: true }, { autoMerge: true }), null);
});

test('markAutoMergeContexts / selectAutoMergeCandidates', () => {
    const ctx = ef.markAutoMergeContexts({ 1: { pr: 5, prBase: 'topic/x' }, 2: { pr: 6, prBase: 'develop' }, 3: { pr: null } });
    assert.equal(ctx[1].autoMerge, true);
    assert.equal(ctx[2].autoMerge, undefined);
    const items = [
        { issue: 1, status: 'Review', hitlLabel: false, kind: 'Issue', labels: [] },
        { issue: 2, status: 'Review', hitlLabel: false, kind: 'Issue', labels: [] },
        { issue: 4, status: 'Review', hitlLabel: true, kind: 'Issue', labels: [] },
    ];
    assert.deepEqual(ef.selectAutoMergeCandidates(items, new Set(), ctx).map((i) => i.issue), [1]);
    assert.deepEqual(ef.selectAutoMergeCandidates(items, new Set([1]), ctx), []);
});

test('contract: mustCount / round / hitlKind / decisions を検証する', () => {
    const base = { issue: 1, phase: 'review', signal: 'done', summary: 's', hitl: false };
    assert.equal(validateResult({ ...base, mustCount: 0, round: 1, decisions: [{ kind: 'question', title: 'x', alternatives: ['a'], pr: 3 }] }).ok, true);
    assert.equal(validateResult({ ...base, mustCount: -1 }).ok, false);
    assert.equal(validateResult({ ...base, round: 0 }).ok, false);
    assert.equal(validateResult({ ...base, decisions: {} }).ok, false);
    assert.equal(validateResult({ ...base, decisions: [{ kind: 'x', title: 'y' }] }).ok, false);
    assert.equal(validateResult({ ...base, decisions: [{ kind: 'question', title: 'y', alternatives: [1] }] }).ok, false);
    const hitl = { issue: 1, phase: 'implement', signal: 'hitl', summary: 's', reason: 'r' };
    assert.equal(validateResult({ ...hitl, hitlKind: 'diverge' }).ok, true);
    assert.equal(validateResult({ ...hitl, hitlKind: 'other' }).ok, false);
});

const cfg = { repo: 'o/r', owner: 'o', project: 4, projectId: 'P', fields: {}, now: () => Date.parse('2026-11-24T01:00:00Z') };
const quiet = () => {};

test('applyEpicRunSideEffects: decisions と escalation を EPIC のまとめコメントに書く', async () => {
    const calls = [];
    const counts = {};
    const deps = {
        token: 'b', readToken: 'r', onDecisions: (epic, n) => { counts[epic] = n; },
        getParentIssueNumber: async () => 100,
        listIssueComments: async () => [],
        upsertMarkedComment: async (repo, n, markers, body) => calls.push({ kind: 'upsert', n, body }),
        postIssueComment: async (repo, n, body) => calls.push({ kind: 'post', n, body }),
    };
    const result = { issue: 7, phase: 'review', signal: 'done', summary: 's', hitl: false, mustCount: 2, round: 4,
        decisions: [{ kind: 'not-adopted', ref: 'FYI1', title: '名前を変える', recommendation: '見送り' }] };
    const outcome = ef.resolveRunOutcome(result, { epicFlow: true });
    await em.applyEpicRunSideEffects({ issue: 7 }, result, outcome, { pr: 8 }, cfg, quiet, deps);
    const up = calls.find((c) => c.kind === 'upsert');
    assert.equal(up.n, 100);
    const data = ef.parseEpicDecisionsData(up.body);
    assert.deepEqual(data.map((d) => d.kind), ['not-adopted', 'must-exhausted']);
    assert.deepEqual(counts, { 100: 2 });
    const post = calls.find((c) => c.kind === 'post');
    assert.equal(post.n, 7);
    assert.match(post.body, /EPIC #100/);
});

test('applyEpicRunSideEffects: 親が無ければ書かない・何も無ければ問い合わせない', async () => {
    let asked = 0;
    const deps = { token: 'b', readToken: 'r', getParentIssueNumber: async () => { asked++; return null; },
        upsertMarkedComment: async () => { throw new Error('書いてはいけない'); } };
    await em.applyEpicRunSideEffects({ issue: 7 }, { decisions: [] }, { warnings: [] }, {}, cfg, quiet, deps);
    assert.equal(asked, 0);
    await em.applyEpicRunSideEffects({ issue: 7 }, { decisions: [{ kind: 'ai-decision', title: 'x' }] }, { warnings: [] }, {}, cfg, quiet, deps);
    assert.equal(asked, 1);
});

test('applyEpicAutoMerge: merge / conflict / fix / 直しの上限', async () => {
    const items = [
        { issue: 1, itemId: 'I1', status: 'Review', hitlLabel: false, kind: 'Issue', labels: [] },
        { issue: 2, itemId: 'I2', status: 'Review', hitlLabel: false, kind: 'Issue', labels: [] },
        { issue: 3, itemId: 'I3', status: 'Review', hitlLabel: false, kind: 'Issue', labels: [] },
        { issue: 4, itemId: 'I4', status: 'Review', hitlLabel: false, kind: 'Issue', labels: [] },
        { issue: 5, itemId: 'I5', status: 'Review', hitlLabel: false, kind: 'Issue', labels: [] },
    ];
    const contexts = ef.markAutoMergeContexts({
        1: { pr: 11, prBase: 'topic/x' }, 2: { pr: 12, prBase: 'topic/x' },
        3: { pr: 13, prBase: 'topic/x' }, 4: { pr: 14, prBase: 'topic/x' }, 5: { pr: 15, prBase: 'topic/x' },
    });
    const byPr = {
        11: facts(), 12: facts({ mergeable: 'CONFLICTING' }),
        13: facts({ reviewDecision: 'CHANGES_REQUESTED' }), 14: facts({ reviewDecision: 'CHANGES_REQUESTED' }),
        15: facts({ reviewDecision: 'CHANGES_REQUESTED' }),
    };
    const findings = (round) => ({ id: round, body: renderReviewFindingsComment({ round, findings: [] }) });
    // #15 の Request changes（id 900）は address-review が対応済み（マーカーあり）→ マージしてよい
    const comments = {
        13: [findings(1)], 14: [findings(1), findings(2), findings(3), findings(4)],
        15: [{ id: 1, body: addressReviewMarker([900]) }],
    };
    const human = { login: 'h', type: 'User' };
    const reviews = (pr) => [{ id: pr === 15 ? 900 : 800 + pr, state: 'CHANGES_REQUESTED', user: human }];
    const merged = [];
    const resolved = [];
    const intentsBy = {};
    const deps = {
        token: 'b', readToken: 'r',
        getPrMergeFacts: async (repo, pr) => byPr[pr],
        mergePr: async (repo, pr) => merged.push(pr),
        listIssueComments: async (repo, n) => comments[n] || [],
        listPrReviews: async (repo, pr) => reviews(pr),
        applyIntents: async (ctx, itemId, intents) => { intentsBy[itemId] = fields(intents); return []; },
        resolveConflict: (it) => resolved.push(it.issue),
        hasCapacity: () => true,
        syncFaces: async () => {},
        getParentIssueNumber: async () => null,
        postIssueComment: async () => {},
    };
    const done = await em.applyEpicAutoMerge(items, contexts, cfg, { running: new Map() }, quiet, deps);
    assert.deepEqual(merged, [11, 15]);
    assert.deepEqual(resolved, [2]);
    assert.deepEqual(intentsBy.I3, { Status: 'In Progress', 'AI Status': 'Addressing Comments' });
    assert.deepEqual(intentsBy.I4, { Status: 'Blocked', 'AI Status': null });
    assert.deepEqual(done.map((d) => d.action), ['merge', 'conflict', 'fix', 'escalate', 'merge']);
});
