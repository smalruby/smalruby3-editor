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
    HITL_LABEL,
    AUTOPILOT_LABEL,
    STICKY_MARKER,
    PR_SYNC_STATUSES,
    selectPrSyncCandidates,
    desiredDraft,
    draftAction,
    hitlLabelAction,
    labelActions,
    renderSticky,
    applyIntentsToItem,
    STICKY_MARKERS,
    LEGACY_STICKY_MARKERS,
    isStickyComment,
    selectStickyCommentIds,
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

test('phaseForItem: In Progress + Self-Reviewing -> review (auto self-review dispatch)', () => {
    // implement 完了後の状態（#805）: daemon が autopilot-review を自動ディスパッチする
    assert.equal(
        phaseForItem({ status: 'In Progress', aiStatus: 'Self-Reviewing', hitl: 'No' }),
        'review',
    );
    // 他の AI Status の In Progress は実行中の run が所有するので null のまま
    assert.equal(phaseForItem({ status: 'In Progress', aiStatus: 'Implementing' }), null);
    // Self-Reviewing でも HITL=Yes なら人間の番（review へ渡さない）
    assert.equal(
        phaseForItem({ status: 'In Progress', aiStatus: 'Self-Reviewing', hitl: 'Yes' }),
        null,
    );
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

// ---- PR projection (#794): labels / Draft-Ready / sticky ----

test('selectPrSyncCandidates: non-EPIC items in post-PR statuses', () => {
    const items = [
        { issue: 1, status: 'In Progress', kind: 'Issue' }, // yes
        { issue: 2, status: 'Review', kind: 'Issue' }, // yes
        { issue: 3, status: 'DoD', kind: 'Issue' }, // yes
        { issue: 4, status: 'Blocked', kind: 'Issue' }, // yes (HITL=Yes, PR may exist)
        { issue: 5, status: 'Review', kind: 'EPIC' }, // no (EPIC has no impl PR)
        { issue: 6, status: 'Sprint Backlog', kind: 'Issue' }, // no (no PR yet)
        { issue: 7, status: 'Close', kind: 'Issue' }, // no (terminal)
    ];
    assert.deepEqual(selectPrSyncCandidates(items).map((i) => i.issue), [1, 2, 3, 4]);
    assert.deepEqual(selectPrSyncCandidates(null), []);
});

test('desiredDraft: Draft while AI works, Ready when HITL=Yes (human turn)', () => {
    assert.equal(desiredDraft({ status: 'In Progress', hitl: 'No' }), true);
    assert.equal(desiredDraft({ status: 'Review', hitl: 'Yes' }), false);
    assert.equal(desiredDraft({ status: 'In Progress' }), true); // hitl unset -> draft
});

test('draftAction: only acts on a diff (idempotent)', () => {
    // currently draft, want draft -> no change
    assert.equal(draftAction(true, { hitl: 'No' }), null);
    // currently draft, want ready (HITL=Yes) -> ready
    assert.equal(draftAction(true, { hitl: 'Yes' }), 'ready');
    // currently ready, want draft -> draft
    assert.equal(draftAction(false, { hitl: 'No' }), 'draft');
    // currently ready, want ready -> no change
    assert.equal(draftAction(false, { hitl: 'Yes' }), null);
});

test('hitlLabelAction: non-Review reconciles toward Project field', () => {
    assert.equal(hitlLabelAction({ status: 'Blocked', hitl: 'Yes' }, false), 'add');
    assert.equal(hitlLabelAction({ status: 'Blocked', hitl: 'Yes' }, true), null);
    assert.equal(hitlLabelAction({ status: 'In Progress', hitl: 'No' }, true), 'remove');
    assert.equal(hitlLabelAction({ status: 'In Progress', hitl: 'No' }, false), null);
});

test('hitlLabelAction: Review label is human-controlled in steady-state (no re-add)', () => {
    // field=Yes but label removed by human (release gesture) -> do NOT re-add per-tick
    assert.equal(hitlLabelAction({ status: 'Review', hitl: 'Yes' }, false), null);
    // field=No -> still allow removal toward No
    assert.equal(hitlLabelAction({ status: 'Review', hitl: 'No' }, true), 'remove');
    // already present + field=Yes -> nothing to do
    assert.equal(hitlLabelAction({ status: 'Review', hitl: 'Yes' }, true), null);
});

test('hitlLabelAction: Review with force (authoritative handoff) sets the label', () => {
    // entering Review at handoff -> force-add the label even though status is Review
    assert.equal(hitlLabelAction({ status: 'Review', hitl: 'Yes' }, false, { force: true }), 'add');
    assert.equal(hitlLabelAction({ status: 'Review', hitl: 'No' }, true, { force: true }), 'remove');
});

test('labelActions: ensures autopilot label and reconciles HITL label', () => {
    // missing both labels, HITL=Yes (non-Review) -> add both
    let d = labelActions({ status: 'Blocked', hitl: 'Yes' }, []);
    assert.deepEqual(d.add.sort(), [AUTOPILOT_LABEL, HITL_LABEL].sort());
    assert.deepEqual(d.remove, []);
    // autopilot present, HITL present but field=No -> remove HITL only
    d = labelActions({ status: 'In Progress', hitl: 'No' }, [AUTOPILOT_LABEL, HITL_LABEL]);
    assert.deepEqual(d.add, []);
    assert.deepEqual(d.remove, [HITL_LABEL]);
    // Review steady-state with field=Yes, HITL label absent -> leave alone, still ensure autopilot
    d = labelActions({ status: 'Review', hitl: 'Yes' }, []);
    assert.deepEqual(d.add, [AUTOPILOT_LABEL]);
    assert.deepEqual(d.remove, []);
});

test('renderSticky: includes marker and projects Status/AI Status/HITL/Size', () => {
    const body = renderSticky({ issue: 794, status: 'Review', aiStatus: null, hitl: 'Yes', size: 'small' });
    assert.match(body, new RegExp(STICKY_MARKER.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    assert.match(body, /Review/);
    assert.match(body, /Yes/);
    assert.match(body, /small/);
    assert.match(body, /#794/);
    assert.match(body, /—/); // null AI Status rendered as em dash
});

test('STICKY_MARKER: canonical marker matches the contract spec', () => {
    // #809: implementation must conform to the contract-specified marker.
    assert.equal(STICKY_MARKER, '<!-- autopilot-sticky-status -->');
    // The legacy daemon (#794) marker stays recognized for absorption.
    assert.ok(LEGACY_STICKY_MARKERS.includes('<!-- autopilot:sticky -->'));
    assert.ok(STICKY_MARKERS.includes(STICKY_MARKER));
    assert.ok(STICKY_MARKERS.includes('<!-- autopilot:sticky -->'));
});

test('renderSticky: emits the canonical marker, not the legacy one', () => {
    const body = renderSticky({ issue: 1, status: 'Review', aiStatus: null, hitl: 'No', size: null });
    assert.ok(body.includes('<!-- autopilot-sticky-status -->'));
    assert.ok(!body.includes('<!-- autopilot:sticky -->'));
});

test('isStickyComment: matches both canonical and legacy markers (#809)', () => {
    assert.equal(isStickyComment('foo\n<!-- autopilot-sticky-status -->\nbar'), true);
    assert.equal(isStickyComment('foo\n<!-- autopilot:sticky -->\nbar'), true);
    assert.equal(isStickyComment('just a normal comment'), false);
    assert.equal(isStickyComment(''), false);
    assert.equal(isStickyComment(null), false);
    assert.equal(isStickyComment(undefined), false);
});

test('selectStickyCommentIds: returns ids of comments matching either marker (#809)', () => {
    const comments = [
        { id: 1, body: 'normal comment' },
        { id: 2, body: '<!-- autopilot:sticky -->\nlegacy daemon sticky' },
        { id: 3, body: 'another normal' },
        { id: 4, body: '<!-- autopilot-sticky-status -->\ncanonical sticky' },
    ];
    assert.deepEqual(selectStickyCommentIds(comments), [2, 4]);
    assert.deepEqual(selectStickyCommentIds([]), []);
    assert.deepEqual(selectStickyCommentIds(null), []);
});

test('applyIntentsToItem: applies field intents onto a copy (null clears)', () => {
    const item = { issue: 1, status: 'In Progress', aiStatus: 'Implementing', hitl: 'No', size: 'small', kind: 'Issue' };
    const out = applyIntentsToItem(item, [
        { field: 'Status', value: 'Review' },
        { field: 'AI Status', value: null },
        { field: 'HITL', value: 'Yes' },
    ]);
    assert.equal(out.status, 'Review');
    assert.equal(out.aiStatus, null);
    assert.equal(out.hitl, 'Yes');
    assert.equal(out.size, 'small'); // untouched
    assert.equal(item.status, 'In Progress'); // original not mutated
});

test('applyIntentsToItem composes with applyResult (review handoff projection)', () => {
    const item = { issue: 1, status: 'In Progress', aiStatus: 'Self-Reviewing', hitl: 'No', kind: 'Issue' };
    const out = applyIntentsToItem(item, applyResult({
        issue: 1, phase: 'review', signal: 'done', summary: 's',
        nextStatus: 'Review', nextAiStatus: null, hitl: true,
    }));
    assert.equal(out.status, 'Review');
    assert.equal(out.hitl, 'Yes');
    assert.equal(desiredDraft(out), false); // -> Ready for review
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
