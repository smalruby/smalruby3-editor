'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const {
    applyMergeProgression, applyClosedReconcile, applyPrProjection, applyDodHandoffs, runTickOnce,
    detectStuck, recoverOrphanedWorkers, recoverStalledInFlightWorkers, markBlocked, getDirectives, populateAssigneeDirectives,
    applyLabelHealing, applyAfterWaitLabels, collectGateContexts,
    applyDecomposeSubIssueSetup,
    parseSsoDeviceOutput, startReauth,
    updateClaudeUsage, boardResponse, statusResponse,
    checkForUpdate, startUpdateChecks,
    patchBoardCache,
    ensureCheckpointCommit, readContinuationFromWorktree, applyCheckpointHandling,
    collectContinuationContexts, checkpointEscalationBody,
    applyTrackerStickies, refreshBoardAndProjectTrackers,
    followBaseBranch,
} = require('../src/daemon');
const { EventEmitter } = require('node:events');
const { HITL_LABEL, AUTOPILOT_LABEL, continuationMarker, TRACKER_STICKY_MARKER } = require('../src/phases');

/** Build an injectable double for markBlocked/detectStuck that records side effects. */
function makeBlockDeps() {
    const calls = { setField: [], comments: [], syncFaces: [] };
    return {
        calls,
        token: 't',
        findItemId: () => 'x',
        setField: (ctx, itemId, field, value) => calls.setField.push({ itemId, field, value }),
        postIssueComment: (repo, number, body) => calls.comments.push({ number, body }),
        syncFaces: (item) => calls.syncFaces.push(item),
    };
}

function makeCfg() {
    return { owner: 'smalruby', project: 4, repo: 'smalruby/smalruby3-editor', projectId: 'P', fields: {} };
}

/** Build an injectable I/O double that records every side effect. */
function makeProjectionDeps({ prByIssue = {}, prInfo = {}, issueLabels = {} } = {}) {
    const calls = { editLabels: [], setPrDraft: [], sticky: [] };
    return {
        calls,
        token: 't',
        findPrForIssue: (repo, issue) => prByIssue[issue] || null,
        getPrInfo: (repo, prNumber) => prInfo[prNumber] || { isDraft: true, labels: [] },
        getIssueLabels: (repo, issue) => issueLabels[issue] || [],
        editLabels: (repo, number, type, diff) => calls.editLabels.push({ number, type, ...diff }),
        setPrDraft: (repo, prNumber, action) => calls.setPrDraft.push({ prNumber, action }),
        upsertStickyComment: (repo, prNumber, body) => calls.sticky.push({ prNumber, hasMarker: /autopilot-sticky-status/.test(body) }),
    };
}

test('applyMergeProgression: closes leaf with merged PR; skips not-merged/EPIC/terminal', async () => {
    const items = [
        { issue: 1, itemId: 'i1', status: 'Review', kind: 'Issue' }, // merged -> Close
        { issue: 2, itemId: 'i2', status: 'DoD', kind: 'Issue' }, // not merged -> skip
        { issue: 3, itemId: 'i3', status: 'Review', kind: 'EPIC' }, // EPIC -> not a candidate
        { issue: 4, itemId: 'i4', status: 'Close', kind: 'Issue' }, // terminal -> not a candidate
    ];
    const mergedMap = { 1: true, 2: false };
    const applied = [];
    const state = { running: new Map() };
    await applyMergeProgression(items, makeCfg(), state, () => {}, {
        token: 't',
        hasMergedPullRequest: (repo, issue) => mergedMap[issue],
        applyIntents: (ctx, itemId, intents) => {
            applied.push({ itemId, intents });
            return intents.map((i) => `${i.field}=${i.value}`);
        },
        findItemId: () => 'x',
        syncFaces: () => {},
    });
    assert.equal(applied.length, 1);
    assert.equal(applied[0].itemId, 'i1');
    const m = Object.fromEntries(applied[0].intents.map((i) => [i.field, i.value]));
    assert.equal(m.Status, 'Close');
    assert.equal(m['AI Status'], null);
});

test('applyMergeProgression: also closes the GitHub issue (Fix A, #843)', async () => {
    // 非デフォルト base 宛て PR では GitHub の `Closes #N` 自動 close が効かないので、
    // leaf を Close へ前進させたら GitHub issue も明示 close する（冪等）。
    const items = [
        { issue: 1, itemId: 'i1', status: 'Review', kind: 'Issue' }, // merged -> Close + gh close
        { issue: 2, itemId: 'i2', status: 'Review', kind: 'Issue' }, // not merged -> no close
    ];
    const mergedMap = { 1: true, 2: false };
    const closed = [];
    const state = { running: new Map() };
    await applyMergeProgression(items, makeCfg(), state, () => {}, {
        token: 't',
        hasMergedPullRequest: (repo, issue) => mergedMap[issue],
        applyIntents: (ctx, itemId, intents) => intents.map((i) => `${i.field}=${i.value}`),
        findItemId: () => 'x',
        closeIssue: (repo, issue) => closed.push(issue),
        syncFaces: () => {},
    });
    assert.deepEqual(closed, [1]);
});

test('applyMergeProgression: a failing gh close does not abort the loop (#843)', async () => {
    const items = [
        { issue: 1, itemId: 'i1', status: 'Review', kind: 'Issue' },
        { issue: 2, itemId: 'i2', status: 'Review', kind: 'Issue' },
    ];
    const applied = [];
    const state = { running: new Map() };
    await applyMergeProgression(items, makeCfg(), state, () => {}, {
        token: 't',
        hasMergedPullRequest: () => true,
        applyIntents: (ctx, itemId) => { applied.push(itemId); return []; },
        findItemId: () => 'x',
        closeIssue: (repo, issue) => { if (issue === 1) throw new Error('boom'); },
        syncFaces: () => {},
    });
    assert.deepEqual(applied, ['i1', 'i2']);
});

test('applyClosedReconcile: closed non-terminal items -> Status=Close + clear AI Status (incl. EPIC)', async () => {
    const items = [
        { issue: 738, itemId: 'e1', status: 'Review', kind: 'EPIC' }, // closed EPIC -> reconcile
        { issue: 839, itemId: 'i1', status: 'Review', kind: 'Issue' }, // closed leaf -> reconcile
        { issue: 900, itemId: 'i2', status: 'Close', kind: 'Issue' }, // closed but terminal -> skip
        { issue: 901, itemId: 'i3', status: 'In Progress', kind: 'Issue' }, // open on GitHub -> skip
    ];
    const applied = [];
    const faces = [];
    const state = { running: new Map() };
    await applyClosedReconcile(items, makeCfg(), state, () => {}, {
        token: 't',
        listClosedIssueNumbers: () => new Set([738, 839, 900]),
        applyIntents: (ctx, itemId, intents) => { applied.push({ itemId, intents }); return []; },
        findItemId: () => 'x',
        syncFaces: (item) => faces.push(item.issue),
    });
    assert.deepEqual(applied.map((a) => a.itemId).sort(), ['e1', 'i1']);
    for (const a of applied) {
        const m = Object.fromEntries(a.intents.map((i) => [i.field, i.value]));
        assert.equal(m.Status, 'Close');
        assert.equal(m['AI Status'], null);
    }
    assert.deepEqual(faces.sort((x, y) => x - y), [738, 839]);
});

test('applyClosedReconcile: skips running items (does not fight a live phase)', async () => {
    const items = [{ issue: 839, itemId: 'i1', status: 'Review', kind: 'Issue' }];
    const applied = [];
    const state = { running: new Map([[839, { phase: 'review' }]]) };
    await applyClosedReconcile(items, makeCfg(), state, () => {}, {
        token: 't',
        listClosedIssueNumbers: () => new Set([839]),
        applyIntents: (ctx, itemId) => { applied.push(itemId); return []; },
        findItemId: () => 'x',
        syncFaces: () => {},
    });
    assert.deepEqual(applied, []);
});

test('applyClosedReconcile: a failing listClosedIssueNumbers is a no-op (does not throw)', async () => {
    const items = [{ issue: 839, itemId: 'i1', status: 'Review', kind: 'Issue' }];
    const applied = [];
    const state = { running: new Map() };
    await assert.doesNotReject(() => applyClosedReconcile(items, makeCfg(), state, () => {}, {
        token: 't',
        listClosedIssueNumbers: () => { throw new Error('rate limit'); },
        applyIntents: (ctx, itemId) => { applied.push(itemId); return []; },
        findItemId: () => 'x',
        syncFaces: () => {},
    }));
    assert.deepEqual(applied, []);
});

test('applyClosedReconcile: one failing item does not block others', async () => {
    const items = [
        { issue: 1, itemId: 'i1', status: 'Review', kind: 'Issue' }, // apply throws
        { issue: 2, itemId: 'i2', status: 'Review', kind: 'Issue' }, // ok
    ];
    const applied = [];
    const state = { running: new Map() };
    await applyClosedReconcile(items, makeCfg(), state, () => {}, {
        token: 't',
        listClosedIssueNumbers: () => new Set([1, 2]),
        applyIntents: (ctx, itemId) => {
            if (itemId === 'i1') throw new Error('boom');
            applied.push(itemId);
            return [];
        },
        findItemId: () => 'x',
        syncFaces: () => {},
    });
    assert.deepEqual(applied, ['i2']);
});

test('applyMergeProgression: skips items currently running (does not fight a live phase)', async () => {
    const items = [{ issue: 1, itemId: 'i1', status: 'Review', kind: 'Issue' }];
    const applied = [];
    const state = { running: new Map([[1, { phase: 'review' }]]) };
    await applyMergeProgression(items, makeCfg(), state, () => {}, {
        token: 't',
        hasMergedPullRequest: () => true,
        applyIntents: (ctx, itemId, intents) => {
            applied.push(intents);
            return [];
        },
        findItemId: () => 'x',
        syncFaces: () => {},
    });
    assert.equal(applied.length, 0);
});

test('applyMergeProgression: a failing merge check on one item does not block others', async () => {
    const items = [
        { issue: 1, itemId: 'i1', status: 'Review', kind: 'Issue' }, // check throws
        { issue: 2, itemId: 'i2', status: 'Review', kind: 'Issue' }, // merged -> Close
    ];
    const applied = [];
    const state = { running: new Map() };
    await applyMergeProgression(items, makeCfg(), state, () => {}, {
        token: 't',
        hasMergedPullRequest: (repo, issue) => {
            if (issue === 1) throw new Error('boom');
            return true;
        },
        applyIntents: (ctx, itemId, intents) => {
            applied.push(itemId);
            return [];
        },
        findItemId: () => 'x',
        syncFaces: () => {},
    });
    assert.deepEqual(applied, ['i2']);
});

test('applyPrProjection: Review handoff (HITL=Yes) -> ensure HITL label + Ready + sticky', async () => {
    const items = [{ issue: 1, itemId: 'i1', status: 'Review', kind: 'Issue', hitlLabel: true, aiStatus: null, size: 'small' }];
    const deps = makeProjectionDeps({
        prByIssue: { 1: { number: 100 } },
        prInfo: { 100: { isDraft: true, labels: [AUTOPILOT_LABEL] } },
        issueLabels: { 1: [AUTOPILOT_LABEL] },
    });
    const state = { running: new Map() };
    // force=true models the authoritative handoff transition
    await applyPrProjection(items, makeCfg(), state, () => {}, { ...deps, force: true });
    // PR converted to Ready (was draft, HITL=Yes wants Ready)
    assert.deepEqual(deps.calls.setPrDraft, [{ prNumber: 100, action: 'ready' }]);
    // HITL label added on both issue and PR
    const prEdit = deps.calls.editLabels.find((e) => e.type === 'pr');
    assert.ok(prEdit.add.includes(HITL_LABEL));
    const issueEdit = deps.calls.editLabels.find((e) => e.type === 'issue');
    assert.ok(issueEdit.add.includes(HITL_LABEL));
    // sticky upserted with marker
    assert.deepEqual(deps.calls.sticky, [{ prNumber: 100, hasMarker: true }]);
});

test('applyPrProjection: per-tick on Review does NOT re-add a human-removed HITL label', async () => {
    const items = [{ issue: 1, itemId: 'i1', status: 'Review', kind: 'Issue', hitlLabel: true }];
    const deps = makeProjectionDeps({
        prByIssue: { 1: { number: 100 } },
        // human removed the HITL label from the PR (release gesture); only autopilot label remains
        prInfo: { 100: { isDraft: false, labels: [AUTOPILOT_LABEL] } },
        issueLabels: { 1: [AUTOPILOT_LABEL, HITL_LABEL] },
    });
    const state = { running: new Map() };
    await applyPrProjection(items, makeCfg(), state, () => {}, deps); // non-force (steady-state)
    // no HITL label add anywhere (release must survive)
    for (const e of deps.calls.editLabels) assert.ok(!(e.add || []).includes(HITL_LABEL));
    // draft unchanged (already Ready), so no toggle
    assert.deepEqual(deps.calls.setPrDraft, []);
});

test('applyPrProjection: HITL=No reconciles labels off and PR back to Draft', async () => {
    const items = [{ issue: 1, itemId: 'i1', status: 'In Progress', kind: 'Issue', hitlLabel: false, aiStatus: 'Implementing' }];
    const deps = makeProjectionDeps({
        prByIssue: { 1: { number: 100 } },
        prInfo: { 100: { isDraft: false, labels: [AUTOPILOT_LABEL, HITL_LABEL] } },
        issueLabels: { 1: [AUTOPILOT_LABEL, HITL_LABEL] },
    });
    const state = { running: new Map() };
    await applyPrProjection(items, makeCfg(), state, () => {}, deps);
    // PR back to Draft (was Ready)
    assert.deepEqual(deps.calls.setPrDraft, [{ prNumber: 100, action: 'draft' }]);
    // HITL label removed on issue and PR
    assert.ok(deps.calls.editLabels.find((e) => e.type === 'pr').remove.includes(HITL_LABEL));
    assert.ok(deps.calls.editLabels.find((e) => e.type === 'issue').remove.includes(HITL_LABEL));
});

test('applyPrProjection: skips running items (does not fight a live phase)', async () => {
    const items = [{ issue: 1, itemId: 'i1', status: 'Review', kind: 'Issue', hitlLabel: true }];
    const deps = makeProjectionDeps({ prByIssue: { 1: { number: 100 } } });
    const state = { running: new Map([[1, { phase: 'review' }]]) };
    await applyPrProjection(items, makeCfg(), state, () => {}, deps);
    assert.deepEqual(deps.calls.editLabels, []);
    assert.deepEqual(deps.calls.setPrDraft, []);
    assert.deepEqual(deps.calls.sticky, []);
});

test('applyPrProjection: no PR yet -> only the issue label is reconciled', async () => {
    const items = [{ issue: 1, itemId: 'i1', status: 'Blocked', kind: 'Issue', hitlLabel: true }];
    const deps = makeProjectionDeps({ issueLabels: { 1: [AUTOPILOT_LABEL] } });
    const state = { running: new Map() };
    await applyPrProjection(items, makeCfg(), state, () => {}, deps);
    assert.deepEqual(deps.calls.setPrDraft, []);
    assert.deepEqual(deps.calls.sticky, []);
    const issueEdit = deps.calls.editLabels.find((e) => e.type === 'issue');
    assert.ok(issueEdit.add.includes(HITL_LABEL));
});

test('runTickOnce: runs tick once and returns its summary (ran:true)', async () => {
    const state = { paused: false, running: new Map(), ticking: false };
    let calls = 0;
    let tickingDuringRun = null;
    const fakeTick = async () => {
        calls += 1;
        tickingDuringRun = state.ticking; // re-entrancy flag must be held during the run
        return { paused: false, picked: [1, 2] };
    };
    const result = await runTickOnce(makeCfg(), state, () => {}, { tick: fakeTick });
    assert.equal(calls, 1);
    assert.equal(tickingDuringRun, true);
    assert.equal(result.ran, true);
    assert.equal(result.paused, false);
    assert.deepEqual(result.picked, [1, 2]);
    // flag released after completion
    assert.equal(state.ticking, false);
});

test('runTickOnce: re-entrancy guard returns busy (409) without calling tick', async () => {
    const state = { paused: false, running: new Map(), ticking: true }; // a tick is already in flight
    let calls = 0;
    const fakeTick = async () => { calls += 1; return { paused: false, picked: [] }; };
    const result = await runTickOnce(makeCfg(), state, () => {}, { tick: fakeTick });
    assert.equal(calls, 0);
    assert.equal(result.ran, false);
    assert.equal(result.busy, true);
});

test('runTickOnce: paused tick is a no-op surfaced in the response', async () => {
    const state = { paused: true, running: new Map(), ticking: false };
    const fakeTick = async () => ({ paused: true, picked: [] });
    const result = await runTickOnce(makeCfg(), state, () => {}, { tick: fakeTick });
    assert.equal(result.ran, true);
    assert.equal(result.paused, true);
    assert.deepEqual(result.picked, []);
});

test('runTickOnce: tick が throw してもプロセスを落とさず error:true で返し flag を解放（#949）', async () => {
    // 無人運用のため runTickOnce は tick 内の例外を再送出しない（main の while は try/catch を
    // 持たないので、reject すると daemon プロセスごと落ちる）。非認証エラーは log して継続する。
    const state = { paused: false, pausedBy: null, running: new Map(), ticking: false };
    const fakeTick = async () => { throw new Error('boom'); };
    const result = await runTickOnce(makeCfg(), state, () => {}, { tick: fakeTick });
    assert.equal(result.ran, false);
    assert.equal(result.error, true);
    assert.equal(state.ticking, false);
    // 非認証エラーで勝手に auto-pause しない
    assert.equal(state.paused, false);
    assert.equal(state.pausedBy, null);
});

test('runTickOnce: tick 途中の認証エラー（SSO 失効）は auto-pause へ合流し落ちない（#949）', async () => {
    const state = { paused: false, pausedBy: null, authError: null, running: new Map(), ticking: false };
    const fakeTick = async () => {
        const e = new Error('Command failed: /app/bin/bot-token');
        e.stderr = 'aws: Error when retrieving token from sso: Token has expired and refresh failed';
        throw e;
    };
    const result = await runTickOnce(makeCfg(), state, () => {}, { tick: fakeTick });
    assert.equal(result.ran, false);
    assert.equal(result.authPaused, true);
    assert.equal(state.paused, true);
    assert.equal(state.pausedBy, 'auth');
    assert.match(state.authError, /expired|bot-token/i);
    assert.equal(state.ticking, false);
});

// === プロセスレベルの安全網: installProcessSafetyNet / handleProcessError（#949/#953） ===

/** exit を記録するだけの fake process。テストで実プロセスを落とさないため必須。 */
function makeFakeProc() {
    const proc = new EventEmitter();
    proc.exits = [];
    proc.exit = (code) => proc.exits.push(code);
    return proc;
}

test('handleProcessError: 認証系エラーは auto-pause、非認証は exit(1)（#953）', () => {
    const { handleProcessError } = require('../src/daemon');
    // 認証系 → auto-pause（exit しない）
    const authState = { paused: false, pausedBy: null, authError: null, running: new Map() };
    const proc = makeFakeProc();
    const e = new Error('AWS 認証が失効/未設定のため Secrets Manager から秘密鍵を取得できません');
    handleProcessError(authState, e, () => {}, 'unhandledRejection', proc);
    assert.equal(authState.paused, true);
    assert.equal(authState.pausedBy, 'auth');
    assert.match(authState.authError, /失効/);
    assert.deepEqual(proc.exits, []); // 認証系は exit しない
    // 非認証 → auto-pause せず、log してから exit(1)（Node 準拠でクラッシュ扱い）
    const otherState = { paused: false, pausedBy: null, running: new Map() };
    const logs = [];
    handleProcessError(otherState, new Error('random glitch'), (m) => logs.push(m), 'uncaughtException', proc);
    assert.equal(otherState.paused, false);
    assert.equal(otherState.pausedBy, null);
    assert.ok(logs.some((m) => /random glitch/.test(m)));
    assert.deepEqual(proc.exits, [1]); // supervisor に再起動を委ねる
});

test('handleProcessError: 人間の pause を auth の自動処理で上書きしない（#949）', () => {
    const { handleProcessError } = require('../src/daemon');
    const proc = makeFakeProc();
    const state = { paused: true, pausedBy: 'human', authError: null, running: new Map() };
    handleProcessError(state, new Error('token has expired'), () => {}, 'unhandledRejection', proc);
    assert.equal(state.pausedBy, 'human'); // 上書きしない
    assert.equal(state.paused, true);
    assert.match(state.authError, /expired/); // エラーだけ surface
    assert.deepEqual(proc.exits, []); // 認証系は exit しない
});

test('installProcessSafetyNet: 認証系は auto-pause で耐え、非認証は exit(1) で supervisor に委ねる（#953）', () => {
    const { installProcessSafetyNet } = require('../src/daemon');
    const proc = makeFakeProc();
    const state = { paused: false, pausedBy: null, authError: null, running: new Map() };
    installProcessSafetyNet(state, () => {}, proc);
    assert.equal(proc.listenerCount('unhandledRejection'), 1);
    assert.equal(proc.listenerCount('uncaughtException'), 1);
    // 認証系の rejection を投げてもプロセスは落ちず auto-pause に落ちる
    proc.emit('unhandledRejection', Object.assign(new Error('bot-token failed'), {
        stderr: 'Token has expired and refresh failed',
    }));
    assert.equal(state.paused, true);
    assert.equal(state.pausedBy, 'auth');
    assert.deepEqual(proc.exits, []); // 認証系は exit しない
    // 非認証 rejection は exit(1)（auto-pause しない）
    state.paused = false; state.pausedBy = null;
    proc.emit('uncaughtException', new Error('some non-auth error'));
    assert.equal(state.paused, false);
    assert.equal(state.pausedBy, null);
    assert.deepEqual(proc.exits, [1]);
});

// === ストール worker の自動復帰: recoverStalledInFlightWorkers（#953 起動時 → #995 定常 tick） ===

test('recoverStalledInFlightWorkers: worker 不在の in-flight を再ディスパッチ、生存中は触らない', async () => {
    const items = [
        // stalled（Implementing だが worker セッション無し）→ 再ディスパッチ
        { issue: 10, itemId: 'i10', status: 'In Progress', aiStatus: 'Implementing', hitlLabel: false },
        // 生存 worker あり（address-review セッションが tmux に残っている）→ 触らない
        { issue: 20, itemId: 'i20', status: 'In Progress', aiStatus: 'Addressing Comments', hitlLabel: false },
        // 人間の判断待ち HITL（実作業系でない Triaging）→ 対象外
        { issue: 30, itemId: 'i30', status: 'In Progress', aiStatus: 'Triaging', hitlLabel: true },
        // Self-Reviewing（実作業系）+ worker 不在 → #995 で復帰対象に変更（review へ）
        { issue: 40, itemId: 'i40', status: 'In Progress', aiStatus: 'Self-Reviewing', hitlLabel: false },
    ];
    const dispatched = [];
    const state = { running: new Map() };
    const recovered = await recoverStalledInFlightWorkers(items, makeCfg(), state, () => {}, {
        listSessions: () => ['autopilot-address-review-20', 'other-session'],
        dispatch: (item) => dispatched.push({ issue: item.issue, phase: item.phase }),
    });
    assert.deepEqual(recovered, [
        { issue: 10, phase: 'implement' },
        { issue: 40, phase: 'review' },
    ]);
    assert.deepEqual(dispatched, [
        { issue: 10, phase: 'implement' },
        { issue: 40, phase: 'review' },
    ]);
});

test('#972 回帰: In Progress + Addressing Comments + 🙋 HITL + worker 不在 → address-review へ再ディスパッチ', async () => {
    // Blocked マーキングが SSO 失効で失敗し 🙋 だけ残った残渣（#972）。worker 不在なら
    // 人間の番ではなく異常終了の残渣として address-review へ再開する。
    const items = [
        { issue: 973, itemId: 'i973', status: 'In Progress', aiStatus: 'Addressing Comments', hitlLabel: true },
    ];
    const dispatched = [];
    const recovered = await recoverStalledInFlightWorkers(items, makeCfg(), { running: new Map() }, () => {}, {
        listSessions: () => [], // worker 不在
        dispatch: (item) => dispatched.push({ issue: item.issue, phase: item.phase }),
    });
    assert.deepEqual(recovered, [{ issue: 973, phase: 'address-review' }]);
    assert.deepEqual(dispatched, [{ issue: 973, phase: 'address-review' }]);
});

test('recoverStalledInFlightWorkers: in-memory running の item は再開しない（tmux 不在でも）', async () => {
    // 定常 tick では in-memory running が最新。tmux セッション名が拾えなくても
    // running に居れば「走行中」なので横取りしない（live = running ∪ tmux のユニオン）。
    const items = [
        { issue: 50, itemId: 'i50', status: 'In Progress', aiStatus: 'Implementing', hitlLabel: false },
    ];
    const dispatched = [];
    const state = { running: new Map([[50, { phase: 'implement' }]]) };
    const recovered = await recoverStalledInFlightWorkers(items, makeCfg(), state, () => {}, {
        listSessions: () => [], // tmux では見えない
        dispatch: (item) => dispatched.push(item.issue),
    });
    assert.deepEqual(recovered, []);
    assert.deepEqual(dispatched, []);
});

test('recoverStalledInFlightWorkers: 並行上限を尊重し、溢れた分は再開しない（#995）', async () => {
    // Self-Reviewing の happy-path が毎 tick recovery に載っても capacity を跨がないこと。
    const items = [
        { issue: 61, itemId: 'i61', status: 'In Progress', aiStatus: 'Self-Reviewing', hitlLabel: false },
        { issue: 62, itemId: 'i62', status: 'In Progress', aiStatus: 'Self-Reviewing', hitlLabel: false },
        { issue: 63, itemId: 'i63', status: 'In Progress', aiStatus: 'Implementing', hitlLabel: false },
    ];
    const dispatched = [];
    const state = { running: new Map() };
    const cfg = { ...makeCfg(), concurrency: 2 };
    const recovered = await recoverStalledInFlightWorkers(items, cfg, state, () => {}, {
        listSessions: () => [],
        // 本物の dispatch と同じく running を同期 set する double（capacity カウントの前提）
        dispatch: (item) => { dispatched.push(item.issue); state.running.set(item.issue, {}); },
    });
    assert.equal(recovered.length, 2, '空き容量 2 の分だけ再開する');
    assert.deepEqual(dispatched, [61, 62]);
    assert.equal(state.running.size, 2);
});

test('recoverStalledInFlightWorkers: 既に capacity 一杯なら 1 件も再開しない（#995）', async () => {
    const items = [
        { issue: 71, itemId: 'i71', status: 'In Progress', aiStatus: 'Addressing Comments', hitlLabel: true },
    ];
    const dispatched = [];
    const state = { running: new Map([[99, { phase: 'implement' }], [98, { phase: 'review' }]]) };
    const cfg = { ...makeCfg(), concurrency: 2 };
    const recovered = await recoverStalledInFlightWorkers(items, cfg, state, () => {}, {
        listSessions: () => [],
        dispatch: (item) => { dispatched.push(item.issue); state.running.set(item.issue, {}); },
    });
    assert.deepEqual(recovered, []);
    assert.deepEqual(dispatched, []);
});

test('recoverStalledInFlightWorkers: enroll フィルタ（自分がオーナーの item だけ復帰）', async () => {
    const items = [
        { issue: 11, itemId: 'i11', status: 'In Progress', aiStatus: 'Implementing', hitlLabel: false, assignees: ['alice'] },
        { issue: 12, itemId: 'i12', status: 'In Progress', aiStatus: 'Implementing', hitlLabel: false, assignees: ['bob'] },
    ];
    const dispatched = [];
    const cfg = { ...makeCfg(), assignee: 'alice' };
    await recoverStalledInFlightWorkers(items, cfg, { running: new Map() }, () => {}, {
        listSessions: () => [],
        dispatch: (item) => dispatched.push(item.issue),
    });
    assert.deepEqual(dispatched, [11]); // bob の 12 は復帰しない
});

test('recoverOrphanedWorkers: 起動時ラッパは items を fetch して core へ委譲する', async () => {
    const items = [
        { issue: 10, itemId: 'i10', status: 'In Progress', aiStatus: 'Implementing', hitlLabel: false },
    ];
    const dispatched = [];
    const recovered = await recoverOrphanedWorkers(makeCfg(), { running: new Map() }, () => {}, {
        listSessions: () => [],
        listItems: async () => items,
        readToken: async () => 't',
        dispatch: (item) => dispatched.push({ issue: item.issue, phase: item.phase }),
    });
    assert.deepEqual(recovered, [{ issue: 10, phase: 'implement' }]);
    assert.deepEqual(dispatched, [{ issue: 10, phase: 'implement' }]);
});

test('recoverOrphanedWorkers: poll 失敗でも落ちず空配列を返す', async () => {
    const logs = [];
    const recovered = await recoverOrphanedWorkers(makeCfg(), { running: new Map() }, (m) => logs.push(m), {
        listSessions: () => [],
        listItems: async () => { throw new Error('poll boom'); },
        readToken: async () => 't',
        dispatch: () => { throw new Error('should not dispatch'); },
    });
    assert.deepEqual(recovered, []);
    assert.ok(logs.some((m) => /poll boom/.test(m)));
});

test('applyPrProjection: a failing item does not block others', async () => {
    const items = [
        { issue: 1, itemId: 'i1', status: 'Review', kind: 'Issue', hitlLabel: true },
        { issue: 2, itemId: 'i2', status: 'In Progress', kind: 'Issue', hitlLabel: false },
    ];
    const deps = makeProjectionDeps({
        prByIssue: { 1: { number: 100 }, 2: { number: 200 } },
        prInfo: { 100: { isDraft: true, labels: [] }, 200: { isDraft: true, labels: [AUTOPILOT_LABEL] } },
        issueLabels: { 1: [], 2: [AUTOPILOT_LABEL] },
    });
    const origGetPrInfo = deps.getPrInfo;
    deps.getPrInfo = (repo, n) => { if (n === 100) throw new Error('boom'); return origGetPrInfo(repo, n); };
    const state = { running: new Map() };
    await applyPrProjection(items, makeCfg(), state, () => {}, deps);
    // issue 2 still processed (sticky on PR 200)
    assert.ok(deps.calls.sticky.some((s) => s.prNumber === 200));
});

// === #821: applyDodHandoffs（DoD 引き継ぎ生成） ===

/** Build an injectable double for applyDodHandoffs that records posted comments. */
function makeDodDeps({ prByIssue = {}, commentsByPr = {}, issueBody = {} } = {}) {
    const calls = { posted: [] };
    return {
        calls,
        token: 't',
        findPrForIssue: (repo, issue) => prByIssue[issue] || null,
        listIssueComments: (repo, prNumber) => commentsByPr[prNumber] || [],
        getIssueBody: (repo, issue) => issueBody[issue] || '',
        postIssueComment: (repo, prNumber, body) => calls.posted.push({ prNumber, body }),
    };
}

test('applyDodHandoffs: DoD leaf with PR + no handoff -> posts one handoff comment', async () => {
    const items = [{ issue: 631, itemId: 'i', status: 'DoD', kind: 'Issue', hitlLabel: true }];
    const deps = makeDodDeps({
        prByIssue: { 631: { number: 818, branch: 'topic/autopilot-631' } },
        commentsByPr: { 818: [{ id: 1, body: 'Preview: https://smalruby.jp/smalruby3-editor/topic/autopilot-631/' }] },
        issueBody: { 631: '## DoD\n\n- [ ] ボタンが表示される\n\n## 備考\nx' },
    });
    const state = { running: new Map() };
    await applyDodHandoffs(items, makeCfg(), state, () => {}, deps);
    assert.equal(deps.calls.posted.length, 1);
    assert.equal(deps.calls.posted[0].prNumber, 818);
    assert.match(deps.calls.posted[0].body, /<!-- autopilot:dod-handoff issue=631 pr=818 -->/);
    assert.match(deps.calls.posted[0].body, /https:\/\/smalruby\.jp\/smalruby3-editor\/topic\/autopilot-631\//);
    assert.match(deps.calls.posted[0].body, /- \[ \] ボタンが表示される/);
});

test('applyDodHandoffs: idempotent — existing handoff comment is not reposted', async () => {
    const items = [{ issue: 631, itemId: 'i', status: 'DoD', kind: 'Issue', hitlLabel: true }];
    const deps = makeDodDeps({
        prByIssue: { 631: { number: 818, branch: 'b' } },
        commentsByPr: { 818: [{ id: 1, body: '<!-- autopilot:dod-handoff issue=631 pr=818 -->\nalready here' }] },
        issueBody: { 631: '## DoD\n- [ ] x' },
    });
    const state = { running: new Map() };
    await applyDodHandoffs(items, makeCfg(), state, () => {}, deps);
    assert.equal(deps.calls.posted.length, 0);
});

test('applyDodHandoffs: skips non-DoD, EPIC, no-PR, and running items', async () => {
    const items = [
        { issue: 1, status: 'Review', kind: 'Issue' }, // not DoD
        { issue: 2, status: 'DoD', kind: 'EPIC' }, // EPIC
        { issue: 3, status: 'DoD', kind: 'Issue' }, // no PR
        { issue: 4, status: 'DoD', kind: 'Issue' }, // running
    ];
    const deps = makeDodDeps({ prByIssue: { 4: { number: 404, branch: 'b' } }, issueBody: { 4: '## DoD\n- [ ] y' } });
    const state = { running: new Map([[4, { phase: 'address-review' }]]) };
    await applyDodHandoffs(items, makeCfg(), state, () => {}, deps);
    assert.equal(deps.calls.posted.length, 0);
});

test('applyDodHandoffs: a failing item does not block others', async () => {
    const items = [
        { issue: 1, status: 'DoD', kind: 'Issue' }, // findPr throws
        { issue: 2, status: 'DoD', kind: 'Issue' }, // ok -> posts
    ];
    const deps = makeDodDeps({
        prByIssue: { 2: { number: 200, branch: 'b' } },
        commentsByPr: { 200: [] },
        issueBody: { 2: '## DoD\n- [ ] z' },
    });
    const origFind = deps.findPrForIssue;
    deps.findPrForIssue = (repo, issue) => { if (issue === 1) throw new Error('boom'); return origFind(repo, issue); };
    const state = { running: new Map() };
    await applyDodHandoffs(items, makeCfg(), state, () => {}, deps);
    assert.deepEqual(deps.calls.posted.map((p) => p.prNumber), [200]);
});

// === ラベル整合: applyLabelHealing（🤖 autopilot 担保 + 🧭 tracking トラッカー化） ===

test('applyLabelHealing: 非終端 item に 🤖 を、分解済み EPIC には 🧭 も担保。終端/付与済み/実行中はスキップ', async () => {
    const { TRACKING_LABEL, AUTOPILOT_LABEL } = require('../src/phases');
    const items = [
        { issue: 1, status: 'In Progress', kind: 'EPIC', labels: [] }, // 分解済み → 🤖 + 🧭
        { issue: 2, status: 'In Progress', kind: 'EPIC', labels: [AUTOPILOT_LABEL, TRACKING_LABEL] }, // 完備
        { issue: 3, status: 'Close', kind: 'EPIC', labels: [] }, // 終端 → 触らない
        { issue: 4, status: 'In Progress', kind: 'Issue', labels: [] }, // leaf → 🤖 のみ
        { issue: 5, status: 'Backlog', kind: 'EPIC', labels: [] }, // 実行中 → 触らない
        { issue: 6, status: 'Review', kind: 'Issue', labels: [AUTOPILOT_LABEL] }, // 完備
    ];
    const added = [];
    const state = { running: new Map([[5, { phase: 'decompose' }]]) };
    await applyLabelHealing(items, makeCfg(), state, () => {}, {
        token: 't',
        readToken: 'r',
        getBoardEnrichment: () => ({ 1: { subIssues: { total: 3, completed: 1, percent: 33 } } }),
        editLabels: (repo, number, type, diff) => added.push({ number, type, ...diff }),
    });
    assert.deepEqual(added, [
        { number: 1, type: 'issue', add: [AUTOPILOT_LABEL, TRACKING_LABEL] },
        { number: 4, type: 'issue', add: [AUTOPILOT_LABEL] },
    ]);
});

test('applyLabelHealing: 未分解 EPIC に 🧭 tracking を付けない（decompose デッドロック回帰・#1130）', async () => {
    const { TRACKING_LABEL, AUTOPILOT_LABEL } = require('../src/phases');
    // #1129 の状況: decompose が分解案 HITL で停止中（sub-issue はまだ 0 件）
    const items = [{ issue: 1129, status: 'In Progress', aiStatus: 'Decomposing', kind: 'EPIC', hitlLabel: true, labels: [] }];
    const added = [];
    const state = { running: new Map() };
    await applyLabelHealing(items, makeCfg(), state, () => {}, {
        token: 't',
        readToken: 'r',
        getBoardEnrichment: () => ({ 1129: { subIssues: { total: 0, completed: 0, percent: 0 } } }),
        editLabels: (repo, number, type, diff) => added.push({ number, type, ...diff }),
    });
    assert.deepEqual(added, [{ number: 1129, type: 'issue', add: [AUTOPILOT_LABEL] }]);
    assert.ok(!added.some((a) => (a.add || []).includes(TRACKING_LABEL)));
});

test('applyLabelHealing: 人間が外した 🙋 HITL を再付与しない（#1130）', async () => {
    const { HITL_LABEL: HL, AUTOPILOT_LABEL } = require('../src/phases');
    const items = [
        // Project 上は HITL だが人間が 🙋 を外した（= 解除シグナル）→ healing は触らない
        { issue: 1, status: 'Review', kind: 'Issue', hitlLabel: true, labels: [AUTOPILOT_LABEL] },
        { issue: 2, status: 'Blocked', kind: 'Issue', hitlLabel: true, labels: [AUTOPILOT_LABEL] },
        // 🙋 が残っているが Project 上は非 HITL → 除去も healing の責務ではない（面同期が行う）
        { issue: 3, status: 'Sprint Backlog', kind: 'Issue', hitlLabel: false, labels: [AUTOPILOT_LABEL, HL] },
    ];
    const calls = [];
    const state = { running: new Map() };
    await applyLabelHealing(items, makeCfg(), state, () => {}, {
        token: 't',
        readToken: 'r',
        getBoardEnrichment: () => ({}),
        editLabels: (repo, number, type, diff) => calls.push({ number, ...diff }),
    });
    assert.deepEqual(calls, []);
});

test('applyLabelHealing: sub-issue 件数は board キャッシュを優先し、不足分だけバッチ取得する（#1130）', async () => {
    const { TRACKING_LABEL, AUTOPILOT_LABEL } = require('../src/phases');
    const items = [
        { issue: 1, status: 'In Progress', kind: 'EPIC', labels: [] }, // board キャッシュ済み（分解済み）
        { issue: 2, status: 'In Progress', kind: 'EPIC', labels: [] }, // キャッシュ外 → 取得
    ];
    const fetched = [];
    const added = [];
    const state = {
        running: new Map(),
        board: { items: [{ issue: 1, subIssues: { total: 2, completed: 0, percent: 0 } }] },
    };
    await applyLabelHealing(items, makeCfg(), state, () => {}, {
        token: 't',
        readToken: 'r',
        getBoardEnrichment: (repo, nums) => {
            fetched.push(...nums);
            return { 2: { subIssues: { total: 0, completed: 0, percent: 0 } } };
        },
        editLabels: (repo, number, type, diff) => added.push({ number, ...diff }),
    });
    assert.deepEqual(fetched, [2], 'board キャッシュにある item は再取得しない');
    assert.deepEqual(added, [
        { number: 1, add: [AUTOPILOT_LABEL, TRACKING_LABEL] },
        { number: 2, add: [AUTOPILOT_LABEL] },
    ]);
});

test('applyLabelHealing: sub-issue 件数の取得失敗でも 🤖 担保は続行し 🧭 は付けない（#1130）', async () => {
    const { TRACKING_LABEL, AUTOPILOT_LABEL } = require('../src/phases');
    const items = [{ issue: 1, status: 'In Progress', kind: 'EPIC', labels: [] }];
    const added = [];
    const state = { running: new Map() };
    await applyLabelHealing(items, makeCfg(), state, () => {}, {
        token: 't',
        readToken: 'r',
        getBoardEnrichment: () => { throw new Error('boom'); },
        editLabels: (repo, number, type, diff) => added.push({ number, ...diff }),
    });
    assert.deepEqual(added, [{ number: 1, add: [AUTOPILOT_LABEL] }]);
    assert.ok(!added.some((a) => a.add.includes(TRACKING_LABEL)));
});

// === decompose 完了後の sub-issue Project フィールド補完（#914） ===

test('applyDecomposeSubIssueSetup: 新規 sub-issue に Status/Kind/Size を設定する (#914)', async () => {
    const result = {
        issue: 906, phase: 'decompose', signal: 'done', summary: 's',
        createdSubIssues: [910, 911], subIssueSizes: { 910: 'small', 911: 'middle' },
    };
    const applied = [];
    await applyDecomposeSubIssueSetup(result, makeCfg(), () => {}, {
        token: 't',
        addIssue: (owner, project, repo, num) => `item-${num}`,
        listItems: () => [],
        applyIntents: (ctx, itemId, intents) => {
            applied.push({ itemId, intents });
            return intents.map(i => `${i.field}=${i.value}`);
        },
    });
    assert.deepEqual(applied, [
        {
            itemId: 'item-910',
            intents: [
                { field: 'Status', value: 'Sprint Backlog' },
                { field: 'Kind', value: 'Issue' },
                { field: 'Size', value: 'small' },
            ],
        },
        {
            itemId: 'item-911',
            intents: [
                { field: 'Status', value: 'Sprint Backlog' },
                { field: 'Kind', value: 'Issue' },
                { field: 'Size', value: 'middle' },
            ],
        },
    ]);
});

test('applyDecomposeSubIssueSetup: createdSubIssues が空なら何もしない (#914)', async () => {
    const result = { issue: 906, phase: 'decompose', signal: 'done', summary: 's', createdSubIssues: [] };
    const calls = [];
    await applyDecomposeSubIssueSetup(result, makeCfg(), () => {}, {
        token: 't',
        addIssue: () => { calls.push('addIssue'); },
        listItems: () => { calls.push('listItems'); return []; },
        applyIntents: () => { calls.push('applyIntents'); },
    });
    assert.deepEqual(calls, []);
});

test('applyDecomposeSubIssueSetup: 既に値が入っている項目は上書きしない（冪等・#914）', async () => {
    const result = {
        issue: 906, phase: 'decompose', signal: 'done', summary: 's',
        createdSubIssues: [910], subIssueSizes: { 910: 'small' },
    };
    const applied = [];
    await applyDecomposeSubIssueSetup(result, makeCfg(), () => {}, {
        token: 't',
        addIssue: () => 'item-910',
        listItems: () => [{ issue: 910, status: 'Sprint Backlog', kind: 'Issue', size: 'large' }],
        applyIntents: (ctx, itemId, intents) => { applied.push(intents); },
    });
    assert.deepEqual(applied, []);
});

test('applyDecomposeSubIssueSetup: 1 件の失敗は他の sub-issue を止めない (#914)', async () => {
    const result = {
        issue: 906, phase: 'decompose', signal: 'done', summary: 's',
        createdSubIssues: [910, 911], subIssueSizes: {},
    };
    const applied = [];
    await applyDecomposeSubIssueSetup(result, makeCfg(), () => {}, {
        token: 't',
        addIssue: (owner, project, repo, num) => { if (num === 910) throw new Error('boom'); return `item-${num}`; },
        listItems: () => [],
        applyIntents: (ctx, itemId) => { applied.push(itemId); },
    });
    assert.deepEqual(applied, ['item-911']);
});

test('applyLabelHealing: 1 件の失敗は他を止めない', async () => {
    const items = [
        { issue: 1, status: 'Backlog', kind: 'EPIC', labels: [] },
        { issue: 2, status: 'Backlog', kind: 'EPIC', labels: [] },
    ];
    const added = [];
    const state = { running: new Map() };
    await applyLabelHealing(items, makeCfg(), state, () => {}, {
        token: 't',
        readToken: 'r',
        getBoardEnrichment: () => ({}),
        editLabels: (repo, number) => { if (number === 1) throw new Error('boom'); added.push(number); },
    });
    assert.deepEqual(added, [2]);
});

// === ⏳ waiting ラベル: applyAfterWaitLabels（autopilot-after ゲート可視化） ===

test('applyAfterWaitLabels: 待ち=付与 / 解決=除去 / 変化なし・examined 外はスキップ', async () => {
    const { WAITING_LABEL } = require('../src/phases');
    const candidates = [
        { issue: 1, labels: [] }, // 待ち & ラベル無し → add
        { issue: 2, labels: [WAITING_LABEL] }, // 解決 & ラベル有り → remove
        { issue: 3, labels: [WAITING_LABEL] }, // 待ち継続 & ラベル有り → 無操作
        { issue: 4, labels: [] }, // 解決 & ラベル無し → 無操作
        { issue: 5, labels: [] }, // examined 外（waitingByIssue に無い）→ スキップ
    ];
    const waitingByIssue = new Map([[1, true], [2, false], [3, true], [4, false]]);
    const calls = [];
    await applyAfterWaitLabels(candidates, waitingByIssue, makeCfg(), () => {}, {
        token: 't',
        editLabels: (repo, number, type, diff) => calls.push({ number, ...diff }),
    });
    assert.deepEqual(calls, [
        { number: 1, add: [WAITING_LABEL] },
        { number: 2, remove: [WAITING_LABEL] },
    ]);
});

test('applyAfterWaitLabels: 付け外しが無ければ token も取らない（副作用ゼロ）', async () => {
    const { WAITING_LABEL } = require('../src/phases');
    const candidates = [{ issue: 3, labels: [WAITING_LABEL] }];
    const waitingByIssue = new Map([[3, true]]); // 変化なし
    let tokenAsked = false;
    await applyAfterWaitLabels(candidates, waitingByIssue, makeCfg(), () => {}, {
        get token() { tokenAsked = true; return 't'; },
        editLabels: () => { throw new Error('should not be called'); },
    });
    assert.equal(tokenAsked, false);
});

// === 俯瞰ボード: refreshBoard / recordHistory ===

test('refreshBoard: 非終端 item を Board 順で enrich し state.board に置く', async () => {
    const { refreshBoard } = require('../src/daemon');
    const cfg = { ...makeCfg(), now: () => 1234, statusOrder: ['Backlog', 'Sprint Backlog', 'In Progress', 'Blocked', 'Review', 'DoD', 'Close', 'Icebox'] };
    const state = { running: new Map() };
    const items = [
        { issue: 1, status: 'Review', kind: 'Issue', title: 'r', labels: [], assignees: ['me'] },
        { issue: 2, status: 'Close', kind: 'Issue', title: 'c', labels: [] }, // 終端 → 除外
        { issue: 3, status: 'Sprint Backlog', kind: 'Issue', title: 's', labels: [] },
        { issue: 4, status: 'Icebox', kind: 'Issue', title: 'i', labels: [] }, // 保留 → 除外
        { issue: 5, status: 'In Progress', kind: 'EPIC', title: 'e', labels: ['🧭 tracking'] },
    ];
    await refreshBoard(cfg, state, () => {}, {
        token: 't',
        listItems: () => items,
        getBoardEnrichment: () => ({
            1: { subIssues: { total: 0, completed: 0, percent: 0 }, prs: [{ number: 100, state: 'OPEN', isDraft: false }] },
            5: { subIssues: { total: 4, completed: 2, percent: 50 }, prs: [] },
        }),
        listHeadPrs: () => [],
    });
    // Board 順: Sprint Backlog(3) → In Progress(5) → Review(1)。Close/Icebox は除外
    assert.deepEqual(state.board.items.map((i) => i.issue), [3, 5, 1]);
    assert.equal(state.board.updatedAt, 1234);
    const r1 = state.board.items.find((i) => i.issue === 1);
    assert.deepEqual(r1.prs, [{ number: 100, state: 'OPEN', isDraft: false }]);
    assert.deepEqual(r1.assignees, ['me']);
    const r5 = state.board.items.find((i) => i.issue === 5);
    assert.equal(r5.subIssues.percent, 50);
    assert.equal(r5.tracker, true);
});

test('refreshBoard: close リンクに PR が無い post-PR item は head ブランチで補完', async () => {
    const { refreshBoard } = require('../src/daemon');
    const cfg = { ...makeCfg(), now: () => 0, statusOrder: [] };
    const state = { running: new Map() };
    const headCalls = [];
    await refreshBoard(cfg, state, () => {}, {
        token: 't',
        listItems: () => [
            { issue: 7, status: 'Review', kind: 'Issue', title: 'x', labels: [] }, // PR 無し → head 補完
            { issue: 8, status: 'Backlog', kind: 'Issue', title: 'y', labels: [] }, // pre-PR → 補完しない
        ],
        getBoardEnrichment: () => ({}),
        listHeadPrs: (repo, issue) => { headCalls.push(issue); return [{ number: 70, state: 'MERGED', isDraft: false }]; },
    });
    assert.deepEqual(headCalls, [7]);
    assert.deepEqual(state.board.items.find((i) => i.issue === 7).prs[0].state, 'MERGED');
});

test('refreshBoard: Awaiting Continuation item は continuation ファイルの残タスク数を continuationRemaining に添える（#913）', async () => {
    const { refreshBoard } = require('../src/daemon');
    const cfg = { ...makeCfg(), now: () => 0, statusOrder: [] };
    const state = { running: new Map() };
    await refreshBoard(cfg, state, () => {}, {
        token: 't',
        listItems: () => [
            { issue: 10, status: 'In Progress', aiStatus: 'Awaiting Continuation', kind: 'Issue', title: 'x', labels: [] },
            { issue: 11, status: 'In Progress', aiStatus: 'Implementing', kind: 'Issue', title: 'y', labels: [] },
        ],
        getBoardEnrichment: () => ({}),
        listHeadPrs: () => [],
        execFileP: async () => ({ stdout: '/tmp/wt\n' }),
        existsSync: () => true,
        readFileSync: () => [continuationMarker(10, 'implement', 1), '## 残タスク', '- a', '- b', '- c'].join('\n'),
    });
    const r10 = state.board.items.find((i) => i.issue === 10);
    assert.equal(r10.continuationRemaining, 3);
    const r11 = state.board.items.find((i) => i.issue === 11);
    assert.equal(r11.continuationRemaining, null);
});

test('refreshBoard: continuation ファイルの読み取りに失敗しても board 構築は続く（continuationRemaining=null）', async () => {
    const { refreshBoard } = require('../src/daemon');
    const cfg = { ...makeCfg(), now: () => 0, statusOrder: [] };
    const state = { running: new Map() };
    await refreshBoard(cfg, state, () => {}, {
        token: 't',
        listItems: () => [
            { issue: 12, status: 'In Progress', aiStatus: 'Awaiting Continuation', kind: 'Issue', title: 'x', labels: [] },
        ],
        getBoardEnrichment: () => ({}),
        listHeadPrs: () => [],
        execFileP: async () => { throw new Error('worktree not found'); },
    });
    const r12 = state.board.items.find((i) => i.issue === 12);
    assert.equal(r12.continuationRemaining, null);
});

test('recordHistory: 新しい run が先頭、上限 100 件', () => {
    const { recordHistory } = require('../src/daemon');
    const state = {};
    for (let i = 0; i < 105; i++) recordHistory(state, { issue: i, phase: 'triage', outcome: 'done' });
    assert.equal(state.history.length, 100);
    assert.equal(state.history[0].issue, 104); // 最新が先頭
});

test('refreshBoard: assignee 指定でボードは「自分が Assignees のいずれか」に限定される（#938）', async () => {
    const { refreshBoard } = require('../src/daemon');
    const cfg = { ...makeCfg(), now: () => 0, statusOrder: [], assignee: 'me' };
    const state = { running: new Map() };
    await refreshBoard(cfg, state, () => {}, {
        token: 't',
        listItems: () => [
            { issue: 1, status: 'Review', kind: 'Issue', title: 'mine', labels: [], assignees: ['me'] },
            { issue: 2, status: 'Review', kind: 'Issue', title: 'other', labels: [], assignees: ['other'] },
            { issue: 3, status: 'Review', kind: 'Issue', title: 'none', labels: [], assignees: [] }, // 未 assign
            // 共同担当（辞書順先頭ではない=オーナーでない）も観察のため表示対象になる
            { issue: 4, status: 'Review', kind: 'Issue', title: 'second', labels: [], assignees: ['aa', 'me'] },
        ],
        getBoardEnrichment: () => ({}),
        listHeadPrs: () => [],
        getIssueBody: () => '', // 4 は 2 人 assign なのでディレクティブ解決の本文 fetch が走る
    });
    assert.deepEqual(state.board.items.map((i) => i.issue), [1, 4]);
    // owner はディレクティブ無しなので辞書順先頭（'aa'）— 'me' はオーナーではない=観察対象
    const item4 = state.board.items.find((i) => i.issue === 4);
    assert.equal(item4.owner, 'aa');
});

test('refreshBoard: autopilot-assignee ディレクティブが board の owner 表示に反映される（#938）', async () => {
    const { refreshBoard } = require('../src/daemon');
    const cfg = { ...makeCfg(), now: () => 0, statusOrder: [], assignee: 'me' };
    const state = { running: new Map() };
    await refreshBoard(cfg, state, () => {}, {
        token: 't',
        listItems: () => [
            { issue: 4, status: 'Review', kind: 'Issue', title: 'second', labels: [], assignees: ['aa', 'me'] },
        ],
        getBoardEnrichment: () => ({}),
        listHeadPrs: () => [],
        getIssueBody: () => 'autopilot-assignee: me',
    });
    const item4 = state.board.items.find((i) => i.issue === 4);
    assert.equal(item4.owner, 'me');
});

test('refreshBoard: 非表示（終端 / 非自分担当）の multi-assignee item は本文 fetch しない（#938・API 予算）', async () => {
    const { refreshBoard } = require('../src/daemon');
    const cfg = { ...makeCfg(), now: () => 0, statusOrder: [], assignee: 'me' };
    const state = { running: new Map() };
    const fetched = [];
    await refreshBoard(cfg, state, () => {}, {
        token: 't',
        listItems: () => [
            // 表示対象（自分が Assignees・非終端・2人）→ fetch する
            { issue: 1, status: 'Review', kind: 'Issue', title: 'mine', labels: [], assignees: ['aa', 'me'] },
            // 終端 Status の 2人 assign → selectBoardItems で除外されるので fetch しない
            { issue: 2, status: 'Close', kind: 'Issue', title: 'done', labels: [], assignees: ['aa', 'bb'] },
            // 自分が Assignees でない 2人 assign → 表示対象外なので fetch しない
            { issue: 3, status: 'Review', kind: 'Issue', title: 'others', labels: [], assignees: ['aa', 'bb'] },
        ],
        getBoardEnrichment: () => ({}),
        listHeadPrs: () => [],
        getIssueBody: (repo, issue) => { fetched.push(issue); return ''; },
    });
    assert.deepEqual(fetched, [1]); // 表示対象の 1 だけ本文 fetch
    assert.deepEqual(state.board.items.map((i) => i.issue), [1]);
});

test('refreshBoard: レート残量僅少（skipLowPriority）では更新せず前回キャッシュを維持', async () => {
    const { refreshBoard } = require('../src/daemon');
    const cfg = { ...makeCfg(), now: () => 0, statusOrder: [] };
    const state = {
        running: new Map(),
        board: { updatedAt: 1, items: [{ issue: 9 }] },
        ratePlan: { skipLowPriority: true, minRemaining: 10, minAt: 'bot/graphql' },
    };
    let called = 0;
    await refreshBoard(cfg, state, () => {}, { token: 't', listItems: () => { called += 1; return []; } });
    assert.equal(called, 0);
    assert.deepEqual(state.board.items.map((i) => i.issue), [9]);
});

// === #934: applyTrackerStickies（分解済み EPIC の sub-issue 進捗 + Close 指示 sticky） ===

test('applyTrackerStickies: トラッカーで sub-issue 未完了 -> sticky を upsert する', async () => {
    const boardItems = [
        { issue: 906, tracker: true, status: 'In Progress', subIssues: { total: 4, completed: 2, percent: 50 } },
        { issue: 1, tracker: false, status: 'In Progress', subIssues: { total: 0, completed: 0, percent: 0 } }, // 対象外
    ];
    const calls = [];
    const deps = {
        token: 't',
        upsertMarkedComment: (repo, number, markers, body) => calls.push({ number, markers, body }),
    };
    await applyTrackerStickies(boardItems, makeCfg(), () => {}, deps);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].number, 906);
    assert.deepEqual(calls[0].markers, [TRACKER_STICKY_MARKER]);
    assert.match(calls[0].body, /2\/4 \(50%\)/);
});

test('applyTrackerStickies: 追加の GraphQL 無しに board キャッシュだけで動く（listItems 等は呼ばない）', async () => {
    const boardItems = [
        { issue: 906, tracker: true, status: 'In Progress', subIssues: { total: 4, completed: 4, percent: 100 } },
    ];
    const calls = [];
    await applyTrackerStickies(boardItems, makeCfg(), () => {}, {
        token: 't',
        upsertMarkedComment: (repo, number, markers, body) => calls.push({ number, body }),
        listItems: () => { throw new Error('listItems should not be called'); },
    });
    assert.equal(calls.length, 1);
    assert.match(calls[0].body, /全 sub-issue が完了しました（4\/4）/);
});

test('applyTrackerStickies: 対象が無ければ何もしない（token 取得もしない）', async () => {
    let tokenCalls = 0;
    await applyTrackerStickies([], makeCfg(), () => {}, {
        get token() { tokenCalls += 1; return 't'; },
        upsertMarkedComment: () => { throw new Error('should not be called'); },
    });
    assert.equal(tokenCalls, 0);
});

test('applyTrackerStickies: 1 件の失敗は他を止めない', async () => {
    const boardItems = [
        { issue: 1, tracker: true, status: 'In Progress', subIssues: { total: 2, completed: 1, percent: 50 } },
        { issue: 2, tracker: true, status: 'In Progress', subIssues: { total: 2, completed: 2, percent: 100 } },
    ];
    const posted = [];
    await applyTrackerStickies(boardItems, makeCfg(), () => {}, {
        token: 't',
        upsertMarkedComment: (repo, number) => {
            if (number === 1) throw new Error('boom');
            posted.push(number);
        },
    });
    assert.deepEqual(posted, [2]);
});

test('refreshBoardAndProjectTrackers: refreshBoard 後に board キャッシュでトラッカー sticky を投影する', async () => {
    const cfg = { ...makeCfg(), now: () => 0, statusOrder: [] };
    const state = { running: new Map() };
    const posted = [];
    await refreshBoardAndProjectTrackers(cfg, state, () => {}, {
        token: 't',
        listItems: () => [
            { issue: 906, status: 'In Progress', kind: 'EPIC', title: 'e', labels: ['🧭 tracking'] },
        ],
        getBoardEnrichment: () => ({ 906: { subIssues: { total: 2, completed: 2, percent: 100 }, prs: [] } }),
        listHeadPrs: () => [],
        upsertMarkedComment: (repo, number, markers, body) => posted.push({ number, body }),
    });
    assert.equal(posted.length, 1);
    assert.equal(posted[0].number, 906);
    assert.match(posted[0].body, /全 sub-issue が完了しました（2\/2）/);
});

test('refreshBoardAndProjectTrackers: レート僅少では再投影しない（board 更新自体も refreshBoard 側でスキップ）', async () => {
    const cfg = { ...makeCfg(), now: () => 0, statusOrder: [] };
    const state = {
        running: new Map(),
        board: { updatedAt: 1, items: [{ issue: 9, tracker: true, status: 'In Progress', subIssues: { total: 1, completed: 1, percent: 100 } }] },
        ratePlan: { skipLowPriority: true, minRemaining: 10, minAt: 'bot/graphql' },
    };
    let posted = 0;
    await refreshBoardAndProjectTrackers(cfg, state, () => {}, {
        token: 't',
        listItems: () => { throw new Error('should not be called'); },
        upsertMarkedComment: () => { posted += 1; },
    });
    assert.equal(posted, 0);
});

test('refreshRateLimits: bot/read 両トークンの残量から実行計画を立てる', async () => {
    const { refreshRateLimits } = require('../src/daemon');
    const state = {};
    await refreshRateLimits({}, state, () => {}, {
        token: 'bot-t',
        readToken: 'read-t',
        getRateLimit: async (tok) => (tok === 'bot-t'
            ? { core: { remaining: 4000, limit: 5000 }, graphql: { remaining: 100, limit: 5000 } }
            : { core: { remaining: 3000, limit: 5000 }, graphql: { remaining: 2500, limit: 5000 } }),
    });
    assert.equal(state.ratePlan.minRemaining, 100);
    assert.equal(state.ratePlan.minAt, 'bot/graphql');
    assert.equal(state.ratePlan.skipLowPriority, true); // 100 < 200
    // 取得失敗時は前回の計画を維持
    await refreshRateLimits({}, state, () => {}, {
        token: 'bot-t', readToken: 'read-t',
        getRateLimit: async () => { throw new Error('boom'); },
    });
    assert.equal(state.ratePlan.minRemaining, 100);
});

// === 認証ヘルスチェック: checkAuthHealth（SSO 無人運用の auto-pause / auto-resume） ===

test('checkAuthHealth: 失効で auto-pause、回復で auto-resume', async () => {
    const { checkAuthHealth } = require('../src/daemon');
    const state = { paused: false, pausedBy: null, authError: null, running: new Map() };
    let ok = false;
    const deps = { botToken: async () => { if (!ok) throw new Error('AWS 認証が失効しています'); return 't'; } };
    // 失効 → auto-pause + エラー surface
    assert.equal(await checkAuthHealth({}, state, () => {}, deps), false);
    assert.equal(state.paused, true);
    assert.equal(state.pausedBy, 'auth');
    assert.match(state.authError, /失効/);
    // 再認証後 → auto-resume
    ok = true;
    assert.equal(await checkAuthHealth({}, state, () => {}, deps), true);
    assert.equal(state.paused, false);
    assert.equal(state.pausedBy, null);
    assert.equal(state.authError, null);
});

test('checkAuthHealth: 人間の pause は上書きしない（回復しても勝手に resume しない）', async () => {
    const { checkAuthHealth } = require('../src/daemon');
    const state = { paused: true, pausedBy: 'human', authError: null, running: new Map() };
    // 失敗してもエラー記録のみ（pausedBy は human のまま）
    await checkAuthHealth({}, state, () => {}, { botToken: async () => { throw new Error('boom'); } });
    assert.equal(state.pausedBy, 'human');
    assert.equal(state.paused, true);
    // 成功しても human pause は解除しない
    await checkAuthHealth({}, state, () => {}, { botToken: async () => 't' });
    assert.equal(state.paused, true);
    assert.equal(state.pausedBy, 'human');
});

test('checkAuthHealth: 機密はサニタイズして surface する', async () => {
    const { checkAuthHealth } = require('../src/daemon');
    const state = { paused: false, pausedBy: null, running: new Map() };
    await checkAuthHealth({}, state, () => {}, {
        botToken: async () => { throw new Error('token ghs_abcdefghijklmnopqrstuvwx1234 rejected'); },
    });
    assert.doesNotMatch(state.authError, /ghs_abcdefghijklmnopqrstuvwx1234/);
    assert.match(state.authError, /rejected/);
});

// === 人間ゲート: collectGateContexts（コメント解除 + watermark） ===

test('collectGateContexts: 発言アクティビティから humanSpokeLast を導く（コメント解除の配線）', async () => {
    const { isGateItem } = require('../src/daemon');
    const items = [
        { issue: 1, status: 'Review', kind: 'Issue', hitlLabel: true }, // 人間が最後に発言 → 解除
        { issue: 2, status: 'DoD', kind: 'Issue', hitlLabel: true }, // bot が最後 → 待ち
        { issue: 3, status: 'Blocked', kind: 'Issue', hitlLabel: true }, // PR 無しゲートも収集
        { issue: 4, status: 'Backlog', aiStatus: 'Discussing', kind: 'Issue', hitlLabel: true }, // 議論ゲート
        { issue: 5, status: 'Sprint Backlog', kind: 'Issue' }, // ゲートではない
    ];
    assert.equal(isGateItem(items[4]), false);
    const gateCtx = {
        1: { hitlSignals: { issueLabel: true, prLabel: true }, review: {}, pr: 10, activity: { lastHumanAt: 200, lastBotAt: 100 } },
        2: { hitlSignals: { issueLabel: true, prLabel: true }, review: {}, pr: 20, activity: { lastHumanAt: 100, lastBotAt: 200 } },
        3: { hitlSignals: { issueLabel: true }, review: null, pr: null, activity: { lastHumanAt: 300, lastBotAt: 100 } },
        4: { hitlSignals: { issueLabel: true }, review: null, pr: null, activity: { lastHumanAt: 400, lastBotAt: 100 } },
    };
    const state = { running: new Map() };
    const contexts = await collectGateContexts(makeCfg(), items, new Set(), state, () => {}, {
        token: 't',
        getGateContext: (repo, issue) => gateCtx[issue],
    });
    assert.equal(contexts[1].humanSpokeLast, true);
    assert.equal(contexts[2].humanSpokeLast, false);
    assert.equal(contexts[3].humanSpokeLast, true);
    assert.equal(contexts[4].humanSpokeLast, true);
    assert.ok(!(5 in contexts));
});

test('collectGateContexts: watermark（gateHandled）より古い発言では再発火しない', async () => {
    const items = [{ issue: 1, status: 'Review', kind: 'Issue', hitlLabel: true }];
    const state = { running: new Map(), gateHandled: new Map([[1, 250]]) };
    const deps = {
        token: 't',
        getGateContext: () => ({
            hitlSignals: { issueLabel: true, prLabel: true }, review: {}, pr: 10,
            activity: { lastHumanAt: 200, lastBotAt: 100 },
        }),
    };
    const contexts = await collectGateContexts(makeCfg(), items, new Set(), state, () => {}, deps);
    assert.equal(contexts[1].humanSpokeLast, false); // 200 < watermark 250
    // watermark 後に人間がさらに発言 → 再度解除
    deps.getGateContext = () => ({
        hitlSignals: { issueLabel: true, prLabel: true }, review: {}, pr: 10,
        activity: { lastHumanAt: 300, lastBotAt: 100 },
    });
    const contexts2 = await collectGateContexts(makeCfg(), items, new Set(), state, () => {}, deps);
    assert.equal(contexts2[1].humanSpokeLast, true);
});

test('collectGateContexts: 未処理 changesRequested を構造化シグナルとして導く (#894)', async () => {
    // approve 後の Request changes: bot sticky が lastBotAt を now に更新し humanSpokeLast が
    // false でも、changesRequested の submittedAt が review watermark より新しければ解除する。
    const items = [{ issue: 1, status: 'Review', kind: 'Issue', hitlLabel: true }];
    const state = { running: new Map() };
    const deps = {
        token: 't',
        getGateContext: () => ({
            hitlSignals: { issueLabel: true, prLabel: true },
            review: { approved: false, changesRequested: true, changesRequestedAt: 300 },
            pr: 10,
            // bot sticky が leapfrog: lastBotAt > lastHumanAt → humanSpokeLast は false
            activity: { lastHumanAt: 300, lastBotAt: 999 },
        }),
    };
    const contexts = await collectGateContexts(makeCfg(), items, new Set(), state, () => {}, deps);
    assert.equal(contexts[1].humanSpokeLast, false, 'sticky leapfrog で発言解除は効かない');
    assert.equal(contexts[1].unhandledChangesRequested, true, '構造化シグナルで解除される');

    // watermark を進める（dispatch 済み相当）と同じ changesRequested では再発火しない
    state.gateReviewHandled = new Map([[1, 300]]);
    const contexts2 = await collectGateContexts(makeCfg(), items, new Set(), state, () => {}, deps);
    assert.equal(contexts2[1].unhandledChangesRequested, false, '同じレビューでは再発火しない');

    // さらに新しい Request changes（submittedAt=400）が来たら再度解除
    deps.getGateContext = () => ({
        hitlSignals: { issueLabel: true, prLabel: true },
        review: { approved: false, changesRequested: true, changesRequestedAt: 400 },
        pr: 10,
        activity: { lastHumanAt: 400, lastBotAt: 999 },
    });
    const contexts3 = await collectGateContexts(makeCfg(), items, new Set(), state, () => {}, deps);
    assert.equal(contexts3[1].unhandledChangesRequested, true, '新しい changesRequested で再度解除');
});

test('collectGateContexts: approve 単独（changesRequested 無し）は解除しない (#894)', async () => {
    const items = [{ issue: 1, status: 'Review', kind: 'Issue', hitlLabel: true }];
    const state = { running: new Map() };
    const deps = {
        token: 't',
        getGateContext: () => ({
            hitlSignals: { issueLabel: true, prLabel: true },
            review: { approved: true, changesRequested: false, changesRequestedAt: null },
            pr: 10,
            activity: { lastHumanAt: 100, lastBotAt: 999 },
        }),
    };
    const contexts = await collectGateContexts(makeCfg(), items, new Set(), state, () => {}, deps);
    assert.equal(contexts[1].unhandledChangesRequested, false);
});

// === directives: getDirectives（autopilot-base / autopilot-after の TTL キャッシュ） ===

test('getDirectives: 本文から base/after を導き TTL 内はキャッシュを返す', async () => {
    let fetches = 0;
    let now = 0;
    const cfg = { ...makeCfg(), now: () => now, directiveTtlMs: 1000 };
    const state = {};
    const deps = {
        token: 't',
        getIssueBody: () => { fetches += 1; return 'autopilot-base: topic/x\nautopilot-after: #9'; },
    };
    const d1 = await getDirectives(cfg, state, 5, () => {}, deps);
    assert.equal(d1.base, 'topic/x');
    assert.deepEqual(d1.after, [9]);
    assert.equal(fetches, 1);
    // TTL 内は再取得しない
    now = 999;
    await getDirectives(cfg, state, 5, () => {}, deps);
    assert.equal(fetches, 1);
    // TTL 超過で再取得
    now = 1001;
    await getDirectives(cfg, state, 5, () => {}, deps);
    assert.equal(fetches, 2);
});

test('getDirectives: 取得失敗は空ディレクティブへフォールバックし次回再取得', async () => {
    let calls = 0;
    const cfg = { ...makeCfg(), now: () => 0, directiveTtlMs: 1000 };
    const state = {};
    const deps = {
        token: 't',
        getIssueBody: () => { calls += 1; if (calls === 1) throw new Error('boom'); return 'autopilot-after: #3'; },
    };
    const d1 = await getDirectives(cfg, state, 5, () => {}, deps);
    assert.equal(d1.base, null);
    assert.deepEqual(d1.after, []);
    assert.equal(d1.assignee, null);
    // 失敗エントリは TTL 切れ扱い → 次回すぐ再取得して成功する
    const d2 = await getDirectives(cfg, state, 5, () => {}, deps);
    assert.deepEqual(d2.after, [3]);
});

test('getDirectives: 本文の autopilot-assignee ディレクティブも解決する（#938）', async () => {
    const cfg = { ...makeCfg(), now: () => 0, directiveTtlMs: 1000 };
    const state = {};
    const deps = { token: 't', getIssueBody: () => 'autopilot-assignee: takaokouji' };
    const d = await getDirectives(cfg, state, 5, () => {}, deps);
    assert.equal(d.assignee, 'takaokouji');
});

// === #938: populateAssigneeDirectives（assignees 2人以上の item だけ本文 fetch） ===

test('populateAssigneeDirectives: assignees が 2 人以上の item だけ本文を fetch して assigneeDirective を補う', async () => {
    let fetches = 0;
    const cfg = { ...makeCfg(), now: () => 0 };
    const state = {};
    const deps = {
        token: 't',
        getIssueBody: (repo, issue) => { fetches += 1; return issue === 4 ? 'autopilot-assignee: me' : ''; },
    };
    const items = [
        { issue: 1, assignees: ['me'] }, // 1人 → fetch しない
        { issue: 2, assignees: [] }, // 未 assign → fetch しない
        { issue: 3, assignees: ['aa', 'bb'] }, // 2人 → fetch する（ディレクティブ無し）
        { issue: 4, assignees: ['aa', 'me'] }, // 2人 → fetch する（ディレクティブ有り）
    ];
    const out = await populateAssigneeDirectives(items, cfg, state, () => {}, deps);
    assert.equal(fetches, 2);
    assert.equal(out.find((i) => i.issue === 1).assigneeDirective, undefined);
    assert.equal(out.find((i) => i.issue === 2).assigneeDirective, undefined);
    assert.equal(out.find((i) => i.issue === 3).assigneeDirective, null);
    assert.equal(out.find((i) => i.issue === 4).assigneeDirective, 'me');
    // 元の配列/item は変更しない
    assert.equal(items[3].assigneeDirective, undefined);
});

test('populateAssigneeDirectives: TTL キャッシュを getDirectives と共用する（重複 fetch なし）', async () => {
    let fetches = 0;
    const cfg = { ...makeCfg(), now: () => 0, directiveTtlMs: 1000 };
    const state = {};
    const deps = { token: 't', getIssueBody: () => { fetches += 1; return 'autopilot-assignee: me'; } };
    const items = [{ issue: 9, assignees: ['aa', 'me'] }];
    await populateAssigneeDirectives(items, cfg, state, () => {}, deps);
    await getDirectives(cfg, state, 9, () => {}, deps); // base/after 解決も同じキャッシュを見る
    assert.equal(fetches, 1);
});

// === #816: markBlocked / detectStuck（失敗・stall 時の人間ハンドオフ） ===

test('markBlocked: Blocked + 説明コメント + 🙋 face sync を行う', async () => {
    const deps = makeBlockDeps();
    const item = { issue: 9, itemId: 'i9', status: 'In Progress', kind: 'Issue' };
    await markBlocked(item, 'run が失敗しました', makeCfg(), () => {}, deps);
    assert.deepEqual(deps.calls.setField, [{ itemId: 'i9', field: 'Status', value: 'Blocked' }]);
    assert.equal(deps.calls.comments.length, 1);
    assert.match(deps.calls.comments[0].body, /run が失敗しました/);
    // face sync は Blocked + hitlLabel:true（人間の番）で呼ばれる
    assert.equal(deps.calls.syncFaces[0].status, 'Blocked');
    assert.equal(deps.calls.syncFaces[0].hitlLabel, true);
});

test('markBlocked: body 無しならコメントしない（Status と face sync のみ）', async () => {
    const deps = makeBlockDeps();
    await markBlocked({ issue: 9, itemId: 'i9' }, null, makeCfg(), () => {}, deps);
    assert.equal(deps.calls.comments.length, 0);
    assert.equal(deps.calls.setField.length, 1);
});

test('markBlocked: state を渡すと board キャッシュも Blocked へ live 反映する (#888)', async () => {
    const deps = makeBlockDeps();
    const state = { board: { items: [{ issue: 9, status: 'In Progress', aiStatus: 'Implementing' }] } };
    const item = { issue: 9, itemId: 'i9', status: 'In Progress', kind: 'Issue' };
    await markBlocked(item, null, makeCfg(), () => {}, deps, state);
    assert.equal(state.board.items[0].status, 'Blocked');
    // AI Status は markBlocked が触らないので保持される
    assert.equal(state.board.items[0].aiStatus, 'Implementing');
});

test('markBlocked: state 未指定でも従来どおり動く（board 反映はスキップ・後方互換）', async () => {
    const deps = makeBlockDeps();
    await markBlocked({ issue: 9, itemId: 'i9' }, null, makeCfg(), () => {}, deps);
    assert.equal(deps.calls.setField.length, 1);
});

test('markBlocked: setField 失敗時は board キャッシュを汚さない (#888)', async () => {
    const deps = makeBlockDeps();
    deps.setField = () => { throw new Error('boom'); };
    const state = { board: { items: [{ issue: 9, status: 'In Progress' }] } };
    await markBlocked({ issue: 9, itemId: 'i9' }, null, makeCfg(), () => {}, deps, state);
    // 書き込みが失敗したら board も Blocked にしない（Project の実状態と一致させる）
    assert.equal(state.board.items[0].status, 'In Progress');
});

test('detectStuck: stuckMs 未満は記録のみ、超過で Blocked + コメント (#816)', async () => {
    const deps = makeBlockDeps();
    const cfg = { ...makeCfg(), now: () => 1000, stuckMs: 5000 };
    const state = { running: new Map() };
    const items = [{ issue: 7, itemId: 'i7', status: 'In Progress', aiStatus: 'Implementing' }];
    // 1 回目: 初観測 -> 記録のみ、まだ block しない
    await detectStuck(items, cfg, state, () => {}, deps);
    assert.equal(deps.calls.setField.length, 0);
    assert.equal(state.stuckSince.get(7), 1000);
    // stuckMs 経過後 -> Blocked + コメント
    cfg.now = () => 1000 + 5000;
    await detectStuck(items, cfg, state, () => {}, deps);
    assert.deepEqual(deps.calls.setField, [{ itemId: 'i7', field: 'Status', value: 'Blocked' }]);
    assert.match(deps.calls.comments[0].body, /In Progress/);
    assert.equal(state.stuckSince.has(7), false); // 追跡解除
});

test('detectStuck: 実行中の run が所有する item は触らない', async () => {
    const deps = makeBlockDeps();
    const cfg = { ...makeCfg(), now: () => 0, stuckMs: 1 };
    const state = { running: new Map([[7, { phase: 'implement' }]]), stuckSince: new Map([[7, -10000]]) };
    const items = [{ issue: 7, itemId: 'i7', status: 'In Progress', aiStatus: 'Implementing' }];
    await detectStuck(items, cfg, state, () => {}, deps);
    assert.equal(deps.calls.setField.length, 0);
});

test('detectStuck: 候補でなくなった item は追跡から外す', async () => {
    const deps = makeBlockDeps();
    const cfg = { ...makeCfg(), now: () => 0, stuckMs: 1000 };
    const state = { running: new Map(), stuckSince: new Map([[7, -100]]) };
    // status が Review に進んだ -> stuck 候補ではない
    const items = [{ issue: 7, itemId: 'i7', status: 'Review', aiStatus: null }];
    await detectStuck(items, cfg, state, () => {}, deps);
    assert.equal(deps.calls.setField.length, 0);
    assert.equal(state.stuckSince.has(7), false);
});

// ---- 協調的チェックポイント（EPIC #906・実装コンポーネント D・#912） ----

/** git status/bot-git の呼び出しを記録するフェイク execFileP を作る */
function makeExecDeps(dirty) {
    const calls = [];
    return {
        calls,
        execFileP: async (cmd, args, opts) => {
            calls.push({ cmd, args, opts });
            if (cmd === 'git' && args[0] === 'status') return { stdout: dirty ? ' M file.js\n' : '' };
            return { stdout: '' };
        },
    };
}

test('ensureCheckpointCommit: 未コミットの WIP があれば add + bot-git commit する', async () => {
    const deps = makeExecDeps(true);
    const committed = await ensureCheckpointCommit('/wt', 912, () => {}, deps);
    assert.equal(committed, true);
    assert.equal(deps.calls.length, 3); // status, add, commit
    assert.equal(deps.calls[0].args[0], 'status');
    assert.deepEqual(deps.calls[1].args, ['add', '-A']);
    assert.equal(deps.calls[2].args[0], 'commit');
    assert.match(deps.calls[2].args.join(' '), /checkpoint/);
    // 全呼び出しが対象 worktree の cwd で実行される
    assert.ok(deps.calls.every((c) => c.opts.cwd === '/wt'));
});

test('ensureCheckpointCommit: クリーンな worktree では何もしない', async () => {
    const deps = makeExecDeps(false);
    const committed = await ensureCheckpointCommit('/wt', 912, () => {}, deps);
    assert.equal(committed, false);
    assert.equal(deps.calls.length, 1); // status チェックのみ
});

/**
 * followBaseBranch 用の execFileP フェイク（#950）。
 * @param {object} opts { dirty, behind, mergeFails }
 */
function makeFollowDeps({ dirty = false, behind = 0, mergeFails = false } = {}) {
    const calls = [];
    return {
        calls,
        botGitBin: '/bot-git',
        execFileP: async (cmd, args) => {
            calls.push({ cmd, args });
            if (cmd === 'git' && args[0] === 'status') return { stdout: dirty ? ' M f.js\n' : '' };
            if (cmd === 'git' && args[0] === 'rev-list') return { stdout: `${behind}\n` };
            if (cmd === '/bot-git' && args[0] === 'merge') {
                if (mergeFails) { const e = new Error('merge failed'); e.stderr = 'CONFLICT (content): f.js'; throw e; }
                return { stdout: '' };
            }
            return { stdout: '' };
        },
    };
}

test('followBaseBranch: base より遅れていなければ merge しない（current・#950）', async () => {
    const deps = makeFollowDeps({ behind: 0 });
    const res = await followBaseBranch('/wt', null, () => {}, deps);
    assert.equal(res.status, 'current');
    assert.equal(res.baseRef, 'origin/develop');
    // merge/abort は呼ばれない
    assert.ok(!deps.calls.some((c) => c.args[0] === 'merge'));
});

test('followBaseBranch: base が先行していれば bot-git で merge する（followed・#950）', async () => {
    const deps = makeFollowDeps({ behind: 3 });
    const res = await followBaseBranch('/wt', 'develop', () => {}, deps);
    assert.equal(res.status, 'followed');
    assert.equal(res.behind, 3);
    const merge = deps.calls.find((c) => c.cmd === '/bot-git' && c.args[0] === 'merge');
    assert.ok(merge, 'bot-git で merge する');
    assert.deepEqual(merge.args, ['merge', '--no-edit', 'origin/develop']);
    assert.ok(!deps.calls.some((c) => c.args[0] === 'merge' && c.args[1] === '--abort'));
});

test('followBaseBranch: コンフリクトなら merge --abort で戻し conflict を返す（#950）', async () => {
    const deps = makeFollowDeps({ behind: 2, mergeFails: true });
    const res = await followBaseBranch('/wt', null, () => {}, deps);
    assert.equal(res.status, 'conflict');
    assert.match(res.detail, /CONFLICT/);
    const abort = deps.calls.find((c) => c.cmd === 'git' && c.args[0] === 'merge' && c.args[1] === '--abort');
    assert.ok(abort, 'merge --abort で元に戻す');
});

test('followBaseBranch: ダーティな worktree では触らない（skipped-dirty・#950）', async () => {
    const deps = makeFollowDeps({ dirty: true, behind: 5 });
    const res = await followBaseBranch('/wt', null, () => {}, deps);
    assert.equal(res.status, 'skipped-dirty');
    // fetch / rev-list / merge は行わない
    assert.equal(deps.calls.length, 1);
    assert.equal(deps.calls[0].args[0], 'status');
});

test('followBaseBranch: 宣言 base を尊重する（origin/<branch>・#950）', async () => {
    const deps = makeFollowDeps({ behind: 1 });
    const res = await followBaseBranch('/wt', 'epic/koshien-738', () => {}, deps);
    assert.equal(res.baseRef, 'origin/epic/koshien-738');
    const fetch = deps.calls.find((c) => c.args[0] === 'fetch');
    assert.deepEqual(fetch.args, ['fetch', 'origin', 'epic/koshien-738']);
});

test('readContinuationFromWorktree: ファイルが無ければ null、あれば解析結果を返す', () => {
    const missing = readContinuationFromWorktree('/wt', 912, { existsSync: () => false });
    assert.equal(missing, null);
    const content = [continuationMarker(912, 'address-review', 2), '## 残タスク', '- x'].join('\n');
    const parsed = readContinuationFromWorktree('/wt', 912, {
        existsSync: () => true,
        readFileSync: () => content,
    });
    assert.equal(parsed.phase, 'address-review');
    assert.equal(parsed.iteration, 2);
});

/** applyCheckpointHandling 用の I/O フェイク一式 */
function makeCheckpointDeps({ dirty = false, hasFile = true, iteration = 1, phase = 'implement' } = {}) {
    const calls = { comments: [], blocked: [] };
    return {
        calls,
        execFileP: async (cmd, args) => (cmd === 'git' && args[0] === 'status'
            ? { stdout: dirty ? ' M x\n' : '' }
            : { stdout: '' }),
        existsSync: () => hasFile,
        readFileSync: () => [continuationMarker(1, phase, iteration), '## 残タスク', '- foo'].join('\n'),
        token: 't',
        readToken: 't',
        upsertMarkedComment: (repo, issue, markers, body) => calls.comments.push({ issue, body }),
        markBlocked: (item, body) => calls.blocked.push({ item, body }),
    };
}

test('applyCheckpointHandling: 上限内なら continuation コメントを upsert し Blocked にはしない', async () => {
    const deps = makeCheckpointDeps({ iteration: 1 });
    const item = { issue: 1, itemId: 'i1', status: 'In Progress' };
    const result = { signal: 'hitl', nextAiStatus: 'Awaiting Continuation' };
    await applyCheckpointHandling(item, '/wt', result, makeCfg(), {}, () => {}, deps);
    assert.equal(deps.calls.comments.length, 1);
    assert.equal(deps.calls.comments[0].issue, 1);
    assert.match(deps.calls.comments[0].body, /残タスク/);
    assert.match(deps.calls.comments[0].body, /- foo/);
    assert.equal(deps.calls.blocked.length, 0);
});

test('applyCheckpointHandling: 反復上限（既定3）超過で markBlocked にエスカレーションする', async () => {
    const deps = makeCheckpointDeps({ iteration: 4 });
    const item = { issue: 1, itemId: 'i1', status: 'In Progress' };
    const result = { signal: 'hitl', nextAiStatus: 'Awaiting Continuation' };
    await applyCheckpointHandling(item, '/wt', result, makeCfg(), {}, () => {}, deps);
    assert.equal(deps.calls.blocked.length, 1);
    assert.equal(deps.calls.blocked[0].item.issue, 1);
    assert.match(deps.calls.blocked[0].body, /反復上限/);
    // continuation コメント自体は escalate でも投稿する（人間への文脈提供）
    assert.equal(deps.calls.comments.length, 1);
});

test('applyCheckpointHandling: continuation ファイルが無ければコメントもエスカレーションもしない', async () => {
    const deps = makeCheckpointDeps({ hasFile: false });
    const item = { issue: 1, itemId: 'i1', status: 'In Progress' };
    const result = { signal: 'hitl', nextAiStatus: 'Awaiting Continuation' };
    await applyCheckpointHandling(item, '/wt', result, makeCfg(), {}, () => {}, deps);
    assert.equal(deps.calls.comments.length, 0);
    assert.equal(deps.calls.blocked.length, 0);
});

test('applyCheckpointHandling: 未コミット WIP があれば保険commit してから処理を続ける', async () => {
    const deps = makeCheckpointDeps({ dirty: true, iteration: 1 });
    const item = { issue: 1, itemId: 'i1', status: 'In Progress' };
    const result = { signal: 'hitl', nextAiStatus: 'Awaiting Continuation' };
    await applyCheckpointHandling(item, '/wt', result, makeCfg(), {}, () => {}, deps);
    assert.equal(deps.calls.comments.length, 1); // 保険commit 後も continuation 処理は続く
});

test('checkpointEscalationBody: 反復回数と上限を含み、worker のエラーではないと明示する', () => {
    const body = checkpointEscalationBody({ issue: 42 }, 4, 3);
    assert.match(body, /4 回/);
    assert.match(body, /3 回/);
    assert.match(body, /Blocked/);
    assert.match(body, /worker 自身がエラーを報告した/);
    // Blocked からの再開は phaseForItem の Blocked 分岐（address-review / triage）に従う。
    // continuation phase へは戻らないので、案内文言も指摘対応/再トリアージに揃える。
    assert.match(body, /指摘対応/);
    assert.match(body, /再トリアージ/);
});

test('collectContinuationContexts: Awaiting Continuation の item だけ continuation ファイルを読む', async () => {
    const pathCalls = [];
    const deps = {
        execFileP: async (cmd, args) => {
            pathCalls.push(args);
            return { stdout: '/wt/issue-5\n' };
        },
        existsSync: () => true,
        readFileSync: () => [continuationMarker(5, 'address-review', 2), '## 残タスク', '- foo'].join('\n'),
    };
    const items = [
        { issue: 5, status: 'In Progress', aiStatus: 'Awaiting Continuation' },
        { issue: 6, status: 'In Progress', aiStatus: 'Implementing' },
        { issue: 7, status: 'Review', aiStatus: null },
    ];
    const contexts = await collectContinuationContexts(items, new Set(), () => {}, deps);
    assert.deepEqual(Object.keys(contexts), ['5']);
    assert.equal(contexts[5].continuation.phase, 'address-review');
    assert.equal(contexts[5].continuation.iteration, 2);
    assert.equal(pathCalls.length, 1); // #6/#7 は対象外なので worktree にすら問い合わせない
});

test('collectContinuationContexts: 実行中の item は触らない（live phase と競合しない）', async () => {
    const deps = { execFileP: async () => { throw new Error('should not be called'); } };
    const items = [{ issue: 5, status: 'In Progress', aiStatus: 'Awaiting Continuation' }];
    const contexts = await collectContinuationContexts(items, new Set([5]), () => {}, deps);
    assert.deepEqual(contexts, {});
});

test('collectContinuationContexts: worktree にファイルが無い item は結果に含まれない（implement フォールバック側で処理）', async () => {
    const deps = {
        execFileP: async () => ({ stdout: '/wt/issue-5\n' }),
        existsSync: () => false,
    };
    const items = [{ issue: 5, status: 'In Progress', aiStatus: 'Awaiting Continuation' }];
    const contexts = await collectContinuationContexts(items, new Set(), () => {}, deps);
    assert.deepEqual(contexts, {});
});

// ---- SSO 再接続（device code フロー）: parseSsoDeviceOutput / startReauth ----

test('parseSsoDeviceOutput: URL + コードを抽出し completeUrl を組み立てる', () => {
    const out = 'If the browser does not open, open the following URL:\n\n'
        + 'https://device.sso.ap-northeast-1.amazonaws.com/\n\nThen enter the code:\n\nMNOP-4321\n';
    const p = parseSsoDeviceOutput(out);
    assert.equal(p.url, 'https://device.sso.ap-northeast-1.amazonaws.com/');
    assert.equal(p.code, 'MNOP-4321');
    assert.equal(p.completeUrl, 'https://device.sso.ap-northeast-1.amazonaws.com/?user_code=MNOP-4321');
});

test('parseSsoDeviceOutput: user_code 埋め込み URL からコードを取り出す', () => {
    const out = 'Please visit: https://device.sso.us-east-1.amazonaws.com/?user_code=QRST-8765';
    const p = parseSsoDeviceOutput(out);
    assert.equal(p.code, 'QRST-8765');
    assert.equal(p.completeUrl, 'https://device.sso.us-east-1.amazonaws.com/?user_code=QRST-8765');
});

test('parseSsoDeviceOutput: 何も一致しなければ null', () => {
    assert.equal(parseSsoDeviceOutput('nothing useful here'), null);
});

/** startReauth 用の spawn 差し替え（stdout/stderr を持つ EventEmitter ベースの子プロセス） */
function fakeChild() {
    const child = new EventEmitter();
    child.stdout = new EventEmitter();
    child.stderr = new EventEmitter();
    return child;
}

test('startReauth: device 出力から pending(url/code/completeUrl) を surface する', async () => {
    const child = fakeChild();
    const state = { reauth: null, now: () => 1000 };
    const p = startReauth(state, () => {}, { spawn: () => child, waitMs: 5000 });
    child.stdout.emit('data', Buffer.from(
        'open the following URL:\n\nhttps://device.sso.ap-northeast-1.amazonaws.com/\n\n'
        + 'Then enter the code:\n\nABCD-EFGH\n'));
    const r = await p;
    assert.equal(r.status, 'pending');
    assert.equal(r.code, 'ABCD-EFGH');
    assert.equal(r.url, 'https://device.sso.ap-northeast-1.amazonaws.com/');
    assert.equal(r.completeUrl, 'https://device.sso.ap-northeast-1.amazonaws.com/?user_code=ABCD-EFGH');
    assert.equal(state.reauth.status, 'pending');
});

test('startReauth: exit 0 で state.reauth を消し onSuccess を呼ぶ', async () => {
    const child = fakeChild();
    const state = { reauth: null };
    let onSuccessCalled = false;
    const p = startReauth(state, () => {}, {
        spawn: () => child, waitMs: 5000, onSuccess: () => { onSuccessCalled = true; },
    });
    child.stdout.emit('data', Buffer.from('https://device.sso.x/ AAAA-BBBB'));
    await p;
    child.emit('exit', 0);
    await new Promise((r) => setImmediate(r)); // Promise.resolve().then(onSuccess) の microtask を待つ
    assert.equal(state.reauth, null);
    assert.equal(onSuccessCalled, true);
});

test('startReauth: pending 中は二重に spawn しない', async () => {
    const child = fakeChild();
    let spawnCount = 0;
    const mkSpawn = () => { spawnCount += 1; return child; };
    const state = { reauth: null };
    const p = startReauth(state, () => {}, { spawn: mkSpawn, waitMs: 5000 });
    child.stdout.emit('data', Buffer.from('https://device.sso.x/ CCCC-DDDD'));
    await p;
    await startReauth(state, () => {}, { spawn: mkSpawn, waitMs: 5000 });
    assert.equal(spawnCount, 1);
});

test('startReauth: spawn 失敗は status=error になる', async () => {
    const state = { reauth: null };
    const r = await startReauth(state, () => {}, {
        spawn: () => { throw new Error('aws not found'); }, waitMs: 5000,
    });
    assert.equal(r.status, 'error');
    assert.match(r.error, /aws not found/);
});

// ---- Claude 使用量表示（#879） --------------------------------------------

test('boardResponse: state.claudeUsage を含める（無ければ null）', () => {
    const cfg = { assignee: 'me', concurrency: 2 };
    const empty = boardResponse(cfg, { running: new Map() });
    assert.strictEqual(empty.claudeUsage, null);
    const usage = { session: { percent: 23.5 }, weekly: { percent: 41.2 }, updatedAt: 1 };
    const withUsage = boardResponse(cfg, { running: new Map(), claudeUsage: usage });
    assert.deepStrictEqual(withUsage.claudeUsage, usage);
});

test('statusResponse: state.claudeUsage を含める', () => {
    const cfg = { assignee: null, concurrency: 1 };
    const usage = { session: { percent: 5 }, weekly: { percent: 9 }, updatedAt: 2 };
    assert.deepStrictEqual(statusResponse(cfg, { running: new Map(), claudeUsage: usage }).claudeUsage, usage);
    assert.strictEqual(statusResponse(cfg, { running: new Map() }).claudeUsage, null);
});

test('updateClaudeUsage: usage ファイルから使用量を読み state に反映（updatedAt=mtime・#1027）', () => {
    const fs = require('node:fs');
    const os = require('node:os');
    const path = require('node:path');
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'daemon-usage-'));
    const usageFile = path.join(dir, 'claude-usage.json');
    fs.writeFileSync(usageFile, JSON.stringify({
        rate_limits: {
            five_hour: { used_percentage: 30 }, seven_day: { used_percentage: 60 },
        },
    }) + '\n');
    const state = { claudeUsage: null };
    // updatedAt は mtime 由来（読取時刻 now ではない）
    updateClaudeUsage(state, { usageFile, now: () => 42, statSync: () => ({ mtimeMs: 700 }) }, () => {});
    assert.strictEqual(state.claudeUsage.session.percent, 30);
    assert.strictEqual(state.claudeUsage.weekly.percent, 60);
    assert.strictEqual(state.claudeUsage.updatedAt, 700);
    // ファイルが更新されなければ、高頻度に読み直しても updatedAt は mtime のまま（age を偽装しない）
    updateClaudeUsage(state, { usageFile, now: () => 9999, statSync: () => ({ mtimeMs: 700 }) }, () => {});
    assert.strictEqual(state.claudeUsage.updatedAt, 700);
    // 取得できないときは既存値を保持（null 上書きしない）
    updateClaudeUsage(state, { usageFile: '/no/such/file.json', now: () => 99 }, () => {});
    assert.strictEqual(state.claudeUsage.updatedAt, 700);
});

test('updateClaudeUsage: 値が変わったときだけログする（毎 tick 読取でのログ肥大を防ぐ・#1027）', () => {
    const fs = require('node:fs');
    const os = require('node:os');
    const path = require('node:path');
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'daemon-usage-log-'));
    const usageFile = path.join(dir, 'claude-usage.json');
    const write = (pct) => fs.writeFileSync(usageFile, JSON.stringify({
        rate_limits: { five_hour: { used_percentage: pct }, seven_day: { used_percentage: 60 } },
    }) + '\n');
    const logs = [];
    const log = (m) => logs.push(m);
    const state = { claudeUsage: null };
    write(30);
    updateClaudeUsage(state, { usageFile, statSync: () => ({ mtimeMs: 1 }) }, log);
    // 値が同じなら再読取してもログしない（updatedAt=mtime だけ更新）
    updateClaudeUsage(state, { usageFile, statSync: () => ({ mtimeMs: 2 }) }, log);
    // 値が変わったらログする
    write(55);
    updateClaudeUsage(state, { usageFile, statSync: () => ({ mtimeMs: 3 }) }, log);
    const usageLogs = logs.filter((m) => m.startsWith('claude usage:'));
    assert.strictEqual(usageLogs.length, 2);
    assert.match(usageLogs[0], /session=30%/);
    assert.match(usageLogs[1], /session=55%/);
    assert.strictEqual(state.claudeUsage.updatedAt, 3);
});

test('tick: 毎 tick で Claude 使用量を読み直す（pause 中でも・#1027）', async () => {
    const { tick } = require('../src/daemon');
    const fs = require('node:fs');
    const os = require('node:os');
    const path = require('node:path');
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'daemon-tick-usage-'));
    const usageFile = path.join(dir, 'claude-usage.json');
    fs.writeFileSync(usageFile, JSON.stringify({
        rate_limits: { five_hour: { used_percentage: 12 }, seven_day: { used_percentage: 34 } },
    }) + '\n');
    // pause 中は project へ一切触れず即 return するが、その前に usage は更新される。
    // これにより GitHub をモックせずに「tick が usage を読む」配線を検証できる。
    const state = { paused: true, running: new Map(), claudeUsage: null };
    const res = await tick({ usageFile, statSync: () => ({ mtimeMs: 800 }) }, state, () => {});
    assert.deepStrictEqual(res, { paused: true, picked: [] });
    assert.strictEqual(state.claudeUsage.session.percent, 12);
    assert.strictEqual(state.claudeUsage.weekly.percent, 34);
    assert.strictEqual(state.claudeUsage.updatedAt, 800);
});

// ---- HTTP: usage をライブ読取（GET /board・POST /refresh・#1027） ----------

/** テスト用: 起動済み server に対して method/path でリクエストし JSON を返す小ヘルパー */
function httpRequestJson(port, method, pathname) {
    const http = require('node:http');
    return new Promise((resolve, reject) => {
        const req = http.request({ host: '127.0.0.1', port, method, path: pathname }, (res) => {
            let data = '';
            res.on('data', (c) => { data += c; });
            res.on('end', () => {
                try { resolve({ status: res.statusCode, body: data ? JSON.parse(data) : null }); } catch (e) { reject(e); }
            });
        });
        req.on('error', reject);
        req.end();
    });
}

/** startHttp を port 0 で起動し listening を待つ */
async function startTestHttp(cfg, state) {
    const { startHttp } = require('../src/daemon');
    const server = startHttp(cfg, state, () => {});
    if (!server.listening) await new Promise((r) => server.once('listening', r));
    return { server, port: server.address().port };
}

test('startHttp GET /board: usage をライブ読取して返す（worker 完了を待たない・#1027）', async () => {
    const fs = require('node:fs');
    const os = require('node:os');
    const path = require('node:path');
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'daemon-board-usage-'));
    const usageFile = path.join(dir, 'claude-usage.json');
    fs.writeFileSync(usageFile, JSON.stringify({
        rate_limits: { five_hour: { used_percentage: 22 }, seven_day: { used_percentage: 44 } },
    }) + '\n');
    const cfg = {
        ...makeCfg(), port: 0, assignee: null, concurrency: 1,
        now: () => 111, usageFile, statSync: () => ({ mtimeMs: 111 }),
    };
    const state = { paused: false, running: new Map(), board: null, claudeUsage: null };
    const { server, port } = await startTestHttp(cfg, state);
    try {
        const { status, body } = await httpRequestJson(port, 'GET', '/board');
        assert.strictEqual(status, 200);
        assert.strictEqual(body.claudeUsage.session.percent, 22);
        assert.strictEqual(body.claudeUsage.weekly.percent, 44);
        assert.strictEqual(body.claudeUsage.updatedAt, 111);
        // state にも反映されている（ライブ読取）
        assert.strictEqual(state.claudeUsage.session.percent, 22);
    } finally {
        await new Promise((r) => server.close(r));
    }
});

test('startHttp POST /refresh: レート残量が僅少でも usage は更新する（skipLowPriority 非適用・#1027）', async () => {
    const fs = require('node:fs');
    const os = require('node:os');
    const path = require('node:path');
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'daemon-refresh-usage-'));
    const usageFile = path.join(dir, 'claude-usage.json');
    fs.writeFileSync(usageFile, JSON.stringify({
        rate_limits: { five_hour: { used_percentage: 33 }, seven_day: { used_percentage: 66 } },
    }) + '\n');
    const cfg = {
        ...makeCfg(), port: 0, assignee: null, concurrency: 1,
        usageFile, statSync: () => ({ mtimeMs: 222 }),
    };
    // skipLowPriority=true: board refresh（GraphQL）はスキップされるが usage は更新されるべき
    const state = {
        paused: false, running: new Map(), board: null, claudeUsage: null,
        ratePlan: { skipLowPriority: true, minRemaining: 5 },
    };
    const { server, port } = await startTestHttp(cfg, state);
    try {
        const { status, body } = await httpRequestJson(port, 'POST', '/refresh');
        assert.strictEqual(status, 200);
        assert.strictEqual(body.refreshed, false); // board refresh はレート僅少でスキップ
        assert.strictEqual(body.skipped, 'rate-limited');
        // だが usage はライブ読取されている（API を叩かないため skipLowPriority を適用しない）
        assert.strictEqual(state.claudeUsage.session.percent, 33);
        assert.strictEqual(state.claudeUsage.updatedAt, 222);
    } finally {
        await new Promise((r) => server.close(r));
    }
});

// ---- 稼働バージョン表示 + 更新検知（#885） --------------------------------

test('boardResponse/statusResponse: version と autopilotUpdate を含める（無ければ null）', () => {
    const cfg = { assignee: 'me', concurrency: 2 };
    const empty = boardResponse(cfg, { running: new Map() });
    assert.strictEqual(empty.version, null);
    assert.strictEqual(empty.autopilotUpdate, null);
    const version = { branch: 'develop', commit: 'abcdef0123', shortCommit: 'abcdef0' };
    const upd = { available: true, behind: 2, commits: [], checkedAt: 1, error: null };
    const b = boardResponse(cfg, { running: new Map(), version, autopilotUpdate: upd });
    assert.deepStrictEqual(b.version, version);
    assert.deepStrictEqual(b.autopilotUpdate, upd);
    const s = statusResponse({ assignee: null, concurrency: 1 }, { running: new Map(), version, autopilotUpdate: upd });
    assert.deepStrictEqual(s.version, version);
    assert.deepStrictEqual(s.autopilotUpdate, upd);
});

test('checkForUpdate: 更新ありを state.autopilotUpdate に反映', async () => {
    const state = { version: { commit: 'boot0' }, autopilotUpdate: null };
    const cfg = { repoRoot: '/app', updateBranch: 'develop', now: () => 100 };
    const logs = [];
    const check = async (args) => {
        assert.strictEqual(args.bootCommit, 'boot0');
        assert.strictEqual(args.baseBranch, 'develop');
        return { available: true, behind: 3, commits: [{ shortCommit: 'a', subject: 'x' }], checkedAt: 100, error: null };
    };
    await checkForUpdate(cfg, state, (m) => logs.push(m), { check });
    assert.strictEqual(state.autopilotUpdate.available, true);
    assert.strictEqual(state.autopilotUpdate.behind, 3);
    // 更新あり初検知でログ
    assert.ok(logs.some((m) => /update available/.test(m)));
});

test('checkForUpdate: 失敗時は前回の available/behind を保持し error だけ更新', async () => {
    const state = {
        version: { commit: 'boot0' },
        autopilotUpdate: { available: true, behind: 5, commits: [{ shortCommit: 'a', subject: 'x' }], checkedAt: 1, error: null },
    };
    const cfg = { repoRoot: '/app', updateBranch: 'develop', now: () => 200 };
    const check = async () => ({ available: false, behind: 0, commits: [], checkedAt: 200, error: 'network down' });
    await checkForUpdate(cfg, state, () => {}, { check });
    // 前回値保持
    assert.strictEqual(state.autopilotUpdate.available, true);
    assert.strictEqual(state.autopilotUpdate.behind, 5);
    assert.strictEqual(state.autopilotUpdate.commits.length, 1);
    // error と checkedAt は更新
    assert.match(state.autopilotUpdate.error, /network down/);
    assert.strictEqual(state.autopilotUpdate.checkedAt, 200);
});

test('startUpdateChecks: 起動時に 1 回チェックし unref タイマーを張る', async () => {
    const state = { version: { commit: 'boot0' }, autopilotUpdate: null };
    const cfg = { repoRoot: '/app', updateBranch: 'develop', updateCheckMs: 999, now: () => 1 };
    let checkCalls = 0;
    const check = async () => { checkCalls++; return { available: false, behind: 0, commits: [], checkedAt: 1, error: null }; };
    let unrefed = false;
    let scheduledMs = null;
    const setInterval = (fn, ms) => { scheduledMs = ms; return { unref: () => { unrefed = true; } }; };
    await startUpdateChecks(cfg, state, () => {}, { check, setInterval });
    assert.strictEqual(checkCalls, 1); // 起動直後 1 回
    assert.strictEqual(scheduledMs, 999);
    assert.strictEqual(unrefed, true);
});

// ---- ローカル状態の live 反映（#888） --------------------------------
test('patchBoardCache: applies intents to the cached board item (no GraphQL)', () => {
    const state = {
        board: {
            updatedAt: 1,
            items: [
                { issue: 10, status: 'In Progress', aiStatus: 'Implementing', hitl: false },
                { issue: 11, status: 'Backlog', aiStatus: null },
            ],
        },
    };
    const patched = patchBoardCache(state, 10, [
        { field: 'Status', value: 'In Progress' },
        { field: 'AI Status', value: 'Self-Reviewing' },
    ]);
    assert.strictEqual(patched, true);
    assert.strictEqual(state.board.items[0].aiStatus, 'Self-Reviewing');
    assert.strictEqual(state.board.items[0].status, 'In Progress');
    // hitl などフィールド外のキーは保持される
    assert.strictEqual(state.board.items[0].hitl, false);
    // 他の item は変わらない
    assert.strictEqual(state.board.items[1].status, 'Backlog');
});

test('patchBoardCache: null value clears the field (e.g. AI Status on close)', () => {
    const state = { board: { items: [{ issue: 5, status: 'Review', aiStatus: 'Self-Reviewing' }] } };
    const patched = patchBoardCache(state, 5, [
        { field: 'Status', value: 'Close' },
        { field: 'AI Status', value: null },
    ]);
    assert.strictEqual(patched, true);
    assert.strictEqual(state.board.items[0].status, 'Close');
    assert.strictEqual(state.board.items[0].aiStatus, null);
});

test('patchBoardCache: skips when cache is absent or issue not present (no throw)', () => {
    // board 未在（refreshBoard 前）
    assert.strictEqual(patchBoardCache({}, 10, [{ field: 'Status', value: 'X' }]), false);
    assert.strictEqual(
        patchBoardCache({ board: { items: null } }, 10, [{ field: 'Status', value: 'X' }]),
        false,
    );
    // 当該 issue がキャッシュに無い
    const state = { board: { items: [{ issue: 99, status: 'Backlog' }] } };
    assert.strictEqual(patchBoardCache(state, 10, [{ field: 'Status', value: 'X' }]), false);
    assert.strictEqual(state.board.items[0].status, 'Backlog');
});

test('patchBoardCache: skips on empty/missing intents', () => {
    const state = { board: { items: [{ issue: 10, status: 'Backlog' }] } };
    assert.strictEqual(patchBoardCache(state, 10, []), false);
    assert.strictEqual(patchBoardCache(state, 10, null), false);
    assert.strictEqual(state.board.items[0].status, 'Backlog');
});

test('patchBoardCache: does not mutate the original cached item object (replaces reference)', () => {
    const original = { issue: 10, status: 'In Progress', aiStatus: 'Implementing' };
    const state = { board: { items: [original] } };
    patchBoardCache(state, 10, [{ field: 'AI Status', value: 'Self-Reviewing' }]);
    // 元オブジェクトは破壊されず、配列の参照が差し替わる（applyIntentsToItem は copy を返す）
    assert.strictEqual(original.aiStatus, 'Implementing');
    assert.notStrictEqual(state.board.items[0], original);
    assert.strictEqual(state.board.items[0].aiStatus, 'Self-Reviewing');
});
