'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const {
    PHASE_BY_COMMAND,
    DEFAULT_CLAUDE_COMMAND,
    applyResult,
    isHitlReleased,
    progressOnMerge,
    reviewPhase,
    mergeProgressionIntents,
    selectMergeCandidates,
    phaseForItem,
    isActionable,
    selectActionable,
    shouldResend,
    evaluate,
    DEFAULT_WATCHDOG,
} = require('../src/phases');

test('shouldResend: resend after accept window if attempts remain', () => {
    const cfg = { maxAttempts: 4, acceptWindowMs: 8000 };
    // まだ猶予内 -> 再送しない
    assert.equal(shouldResend({ sinceSendMs: 5000, attempts: 1, ...cfg }), false);
    // 猶予超過 & 上限内 -> 再送
    assert.equal(shouldResend({ sinceSendMs: 9000, attempts: 1, ...cfg }), true);
    // 上限到達 -> 再送しない
    assert.equal(shouldResend({ sinceSendMs: 9000, attempts: 4, ...cfg }), false);
});

test('phaseForItem: New Item -> triage', () => {
    assert.equal(phaseForItem({ status: 'New Item' }), 'triage');
    assert.equal(phaseForItem({}), 'triage'); // status 未設定も New Item 扱い
});

test('phaseForItem: Sprint Backlog -> decompose(EPIC) / implement(Issue)', () => {
    assert.equal(phaseForItem({ status: 'Sprint Backlog', kind: 'EPIC' }), 'decompose');
    assert.equal(phaseForItem({ status: 'Sprint Backlog', kind: 'Issue' }), 'implement');
});

test('phaseForItem: HITL=Yes or human-driven states -> null', () => {
    assert.equal(phaseForItem({ status: 'Sprint Backlog', kind: 'Issue', hitl: 'Yes' }), null);
    assert.equal(phaseForItem({ status: 'Review' }), null); // ctx 無し（レビュー状態不明）
    assert.equal(phaseForItem({ status: 'Backlog' }), null);
    assert.equal(phaseForItem({ status: 'In Progress' }), null);
});

test('reviewPhase: unaddressed comments / changes-requested -> address-review', () => {
    assert.equal(reviewPhase({ unresolvedHumanComments: 1 }), 'address-review');
    assert.equal(reviewPhase({ changesRequested: true }), 'address-review');
    // コメントは approve より優先（approve しつつ未対応コメントを残したケース）
    assert.equal(reviewPhase({ approved: true, unresolvedHumanComments: 2 }), 'address-review');
});

test('reviewPhase: approve only -> verify', () => {
    assert.equal(reviewPhase({ approved: true }), 'verify');
    assert.equal(reviewPhase({ approved: true, unresolvedHumanComments: 0, changesRequested: false }), 'verify');
});

test('reviewPhase: no signal / null -> null (conservative wait)', () => {
    assert.equal(reviewPhase(null), null);
    assert.equal(reviewPhase(undefined), null);
    assert.equal(reviewPhase({}), null);
    assert.equal(reviewPhase({ approved: false, unresolvedHumanComments: 0 }), null);
});

test('phaseForItem: Review still HITL=Yes (project field) -> null', () => {
    assert.equal(
        phaseForItem({ status: 'Review', hitl: 'Yes' }, { review: { approved: true } }),
        null,
    );
});

test('phaseForItem: Review released (project field No) dispatches by review state', () => {
    assert.equal(
        phaseForItem({ status: 'Review', hitl: 'No' }, { review: { approved: true } }),
        'verify',
    );
    assert.equal(
        phaseForItem({ status: 'Review', hitl: 'No' }, { review: { changesRequested: true } }),
        'address-review',
    );
});

test('phaseForItem: Review released via PR label only (OR semantics) -> dispatched', () => {
    // Project HITL フィールドは Yes のままだが、PR の HITL ラベルが外れている
    const item = { status: 'Review', hitl: 'Yes' };
    const ctx = {
        hitlSignals: { projectField: true, issueLabel: true, prLabel: false },
        review: { approved: true },
    };
    assert.equal(phaseForItem(item, ctx), 'verify');
});

test('phaseForItem: Review with all HITL signals waiting -> null', () => {
    const item = { status: 'Review', hitl: 'Yes' };
    const ctx = {
        hitlSignals: { projectField: true, issueLabel: true, prLabel: true },
        review: { approved: true },
    };
    assert.equal(phaseForItem(item, ctx), null);
});

test('phaseForItem: Review released but review state unknown -> null (wait)', () => {
    assert.equal(phaseForItem({ status: 'Review', hitl: 'No' }, {}), null);
});

test('isActionable: paused -> false', () => {
    assert.equal(isActionable({ status: 'New Item' }, { paused: true }), false);
    assert.equal(isActionable({ status: 'New Item' }, { paused: false }), true);
});

test('selectActionable: respects concurrency limit and running set', () => {
    const items = [
        { issue: 1, status: 'New Item' },
        { issue: 2, status: 'Sprint Backlog', kind: 'Issue' },
        { issue: 3, status: 'Sprint Backlog', kind: 'EPIC' },
        { issue: 4, status: 'Review' }, // not actionable
        { issue: 5, status: 'Sprint Backlog', kind: 'Issue', hitl: 'Yes' }, // human's turn
    ];
    const picked = selectActionable(items, { limit: 2, running: new Set() });
    assert.deepEqual(picked.map((p) => [p.issue, p.phase]), [[1, 'triage'], [2, 'implement']]);
    // 1 running -> only 1 more slot
    const picked2 = selectActionable(items, { limit: 2, running: new Set([1]) });
    assert.deepEqual(picked2.map((p) => p.issue), [2]);
});

test('selectActionable: Review items dispatch via contexts (review state + HITL signals)', () => {
    const items = [
        { issue: 10, status: 'Review', hitl: 'No' }, // approve -> verify
        { issue: 11, status: 'Review', hitl: 'No' }, // comments -> address-review
        { issue: 12, status: 'Review', hitl: 'Yes' }, // still human's turn -> skipped
    ];
    const contexts = {
        10: { review: { approved: true }, pr: 100 },
        11: { review: { unresolvedHumanComments: 2 }, pr: 101 },
        12: { review: { approved: true }, pr: 102 },
    };
    const picked = selectActionable(items, { limit: 5, running: new Set(), contexts });
    assert.deepEqual(
        picked.map((p) => [p.issue, p.phase, p.pr]),
        [[10, 'verify', 100], [11, 'address-review', 101]],
    );
});

test('PHASE_BY_COMMAND maps triage to the skill and AI status', () => {
    assert.deepEqual(PHASE_BY_COMMAND.triage, { skill: 'autopilot-triage', aiStatus: 'Triaging' });
    assert.equal(PHASE_BY_COMMAND['address-review'].skill, 'autopilot-address-review');
});

test('DEFAULT_CLAUDE_COMMAND is non-interactive (allows Bash so gh/git do not prompt)', () => {
    assert.match(DEFAULT_CLAUDE_COMMAND, /^claude /);
    assert.match(DEFAULT_CLAUDE_COMMAND, /--allowedTools\b/);
    assert.match(DEFAULT_CLAUDE_COMMAND, /\bBash\b/);
});

test('progressOnMerge: leaf Issue -> Close, EPIC -> null', () => {
    assert.equal(progressOnMerge('Issue'), 'Close');
    assert.equal(progressOnMerge('EPIC'), null);
    // 未指定は leaf 扱い
    assert.equal(progressOnMerge(undefined), 'Close');
});

test('selectMergeCandidates: leaf items in post-PR statuses; excludes EPIC and terminal/pre-PR', () => {
    const items = [
        { issue: 1, status: 'In Progress', kind: 'Issue' }, // yes
        { issue: 2, status: 'Review', kind: 'Issue' }, // yes
        { issue: 3, status: 'DoD', kind: 'Issue' }, // yes
        { issue: 4, status: 'Review', kind: 'EPIC' }, // no (EPIC, 子 PR では閉じない)
        { issue: 5, status: 'Close', kind: 'Issue' }, // no (terminal)
        { issue: 6, status: 'Sprint Backlog', kind: 'Issue' }, // no (まだ PR 無し)
        { issue: 7, status: 'New Item', kind: 'Issue' }, // no
    ];
    assert.deepEqual(selectMergeCandidates(items).map((i) => i.issue), [1, 2, 3]);
});

test('mergeProgressionIntents: merged leaf -> Close, clear AI Status, HITL No', () => {
    const intents = mergeProgressionIntents({ issue: 1, status: 'Review', kind: 'Issue' }, true);
    const m = Object.fromEntries(intents.map((i) => [i.field, i.value]));
    assert.equal(m.Status, 'Close');
    assert.equal(m['AI Status'], null);
    assert.equal(m.HITL, 'No');
});

test('mergeProgressionIntents: not merged -> no intents', () => {
    assert.deepEqual(mergeProgressionIntents({ status: 'Review', kind: 'Issue' }, false), []);
});

test('mergeProgressionIntents: EPIC merged -> no intents (child PR does not close EPIC)', () => {
    assert.deepEqual(mergeProgressionIntents({ status: 'Review', kind: 'EPIC' }, true), []);
});

test('mergeProgressionIntents: already at target Status -> no intents (idempotent)', () => {
    assert.deepEqual(mergeProgressionIntents({ status: 'Close', kind: 'Issue' }, true), []);
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

test('isHitlReleased: all signals waiting -> not released', () => {
    assert.equal(isHitlReleased({ projectField: true, issueLabel: true, prLabel: true }), false);
});

test('isHitlReleased: any one signal cleared -> released (OR semantics)', () => {
    assert.equal(isHitlReleased({ projectField: true, issueLabel: true, prLabel: false }), true);
    assert.equal(isHitlReleased({ projectField: false, issueLabel: true, prLabel: true }), true);
    assert.equal(isHitlReleased({ projectField: true, issueLabel: false }), true);
});

test('isHitlReleased: non-applicable (undefined) signals are ignored', () => {
    // PR が無い（prLabel undefined）ときに誤って released にしない
    assert.equal(isHitlReleased({ projectField: true, issueLabel: true, prLabel: undefined }), false);
    assert.equal(isHitlReleased({ projectField: false, prLabel: undefined }), true);
});

test('isHitlReleased: no applicable signals -> not released (conservative)', () => {
    assert.equal(isHitlReleased({}), false);
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
