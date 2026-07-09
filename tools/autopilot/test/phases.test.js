'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const {
    PHASE_BY_COMMAND,
    phasePromptCommand,
    parseBaseBranch,
    parseAfterIssues,
    unresolvedAfterIssues,
    DEFAULT_CLAUDE_COMMAND,
    applyResult,
    subIssueSetupIntents,
    hitlDesireFromResult,
    isHitlReleased,
    isGateReleased,
    hasUnhandledChangesRequest,
    progressOnMerge,
    computeReviewApproval,
    mergeProgressionIntents,
    selectMergeCandidates,
    selectClosedToReconcile,
    TERMINAL_STATUSES,
    phaseForItem,
    isActionable,
    isStuckCandidate,
    itemOwner,
    ownsItem,
    statusRank,
    orderItemsLikeBoard,
    selectActionable,
    shouldResend,
    evaluate,
    sanitizeForSurface,
    DEFAULT_WATCHDOG,
    HITL_LABEL,
    AUTOPILOT_LABEL,
    TRACKING_LABEL,
    isTrackerItem,
    hasTrackingLabel,
    waitingLabelAction,
    protectedPaths,
    STICKY_MARKER,
    PR_SYNC_STATUSES,
    READY_STATUSES,
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
    selectMarkedCommentIds,
    selectMarkedComments,
    stickyUpsertPlan,
    rateLimitPlan,
    selectClosedCheckIssues,
    selectBoardItems,
    PR_LINK_MARKER,
    needsPrLinkSticky,
    renderPrLinkSticky,
    dodHandoffMarker,
    isDodHandoffComment,
    hasDodHandoffComment,
    extractPreviewUrl,
    extractDodChecklist,
    needsDodHandoff,
    dodHandoffBody,
} = require('../src/phases');
const { PROMPT_RE } = require('../src/runner');

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

test('phaseForItem: 🙋 ラベルあり or human-driven states -> null', () => {
    assert.equal(phaseForItem({ status: 'Sprint Backlog', kind: 'Issue', hitlLabel: true }), null);
    assert.equal(phaseForItem({ status: 'Review', hitlLabel: true }), null); // 🙋 あり=人間の番
    assert.equal(phaseForItem({ status: 'Backlog' }), null);
    assert.equal(phaseForItem({ status: 'In Progress' }), null);
});

test('phaseForItem: In Progress + Self-Reviewing -> review (auto self-review dispatch)', () => {
    // implement 完了後の状態（#805）: daemon が autopilot-review を自動ディスパッチする
    assert.equal(
        phaseForItem({ status: 'In Progress', aiStatus: 'Self-Reviewing', hitlLabel: false }),
        'review',
    );
    // 他の AI Status の In Progress は実行中の run が所有するので null のまま
    assert.equal(phaseForItem({ status: 'In Progress', aiStatus: 'Implementing' }), null);
    // Self-Reviewing でも 🙋 ラベルあり（人間の番）なら review へ渡さない
    assert.equal(
        phaseForItem({ status: 'In Progress', aiStatus: 'Self-Reviewing', hitlLabel: true }),
        null,
    );
});

// #815: Review 解除時は構造化シグナルで分岐せず、必ず address-review へ渡す
// （diff + 全コメントを読んでスキルが分類する）。
test('phaseForItem: Review still 🙋 ラベルあり -> null (human turn)', () => {
    assert.equal(
        phaseForItem({ status: 'Review', hitlLabel: true }, { review: { approved: true } }),
        null,
    );
});

test('phaseForItem: Review released (Issue label removed) -> address-review (#815)', () => {
    // approve だろうが changes-requested だろうが、解除されたら一律 address-review
    assert.equal(
        phaseForItem({ status: 'Review', hitlLabel: false }, { review: { approved: true } }),
        'address-review',
    );
    assert.equal(
        phaseForItem({ status: 'Review', hitlLabel: false }, { review: { changesRequested: true } }),
        'address-review',
    );
});

test('phaseForItem: Review released via PR label only (OR semantics) -> address-review (#815)', () => {
    // Issue の 🙋 ラベルは残っているが、PR の 🙋 ラベルが外れている（人間の解除ジェスチャ）
    const item = { status: 'Review', hitlLabel: true };
    const ctx = { hitlSignals: { issueLabel: true, prLabel: false }, review: { approved: true } };
    assert.equal(phaseForItem(item, ctx), 'address-review');
});

test('phaseForItem: Review with all HITL signals waiting -> null', () => {
    const item = { status: 'Review', hitlLabel: true };
    const ctx = { hitlSignals: { issueLabel: true, prLabel: true }, review: { approved: true } };
    assert.equal(phaseForItem(item, ctx), null);
});

test('phaseForItem: Review released even without review state -> address-review (#815)', () => {
    // 旧実装は review 状態不明だと null（待ち）。新実装は解除されたらスキルに判断を委ねる。
    assert.equal(phaseForItem({ status: 'Review', hitlLabel: false }, {}), 'address-review');
});

test('hasUnhandledChangesRequest: 未処理の新しい changesRequested だけ true (#894)', () => {
    // changesRequested でない（approve のみ）→ false（無限ループしない）
    assert.equal(hasUnhandledChangesRequest({ approved: true }, null), false);
    assert.equal(hasUnhandledChangesRequest(null, null), false);
    assert.equal(hasUnhandledChangesRequest(undefined, 100), false);
    // changesRequested だが時刻不明 → false（誤発火を避ける）
    assert.equal(hasUnhandledChangesRequest({ changesRequested: true }, null), false);
    // watermark 未設定で changesRequested あり → 未処理なので true
    assert.equal(
        hasUnhandledChangesRequest({ changesRequested: true, changesRequestedAt: 200 }, null),
        true,
    );
    // watermark より新しい → true（新しい Request changes）
    assert.equal(
        hasUnhandledChangesRequest({ changesRequested: true, changesRequestedAt: 300 }, 200),
        true,
    );
    // watermark と同じ（一度処理済み）→ false（毎 tick 再発火しない）
    assert.equal(
        hasUnhandledChangesRequest({ changesRequested: true, changesRequestedAt: 200 }, 200),
        false,
    );
    // watermark より古い → false
    assert.equal(
        hasUnhandledChangesRequest({ changesRequested: true, changesRequestedAt: 100 }, 200),
        false,
    );
    // ISO 文字列でも動く（GraphQL の submittedAt）
    assert.equal(
        hasUnhandledChangesRequest(
            { changesRequested: true, changesRequestedAt: '2026-07-08T10:00:00Z' },
            '2026-07-08T09:00:00Z',
        ),
        true,
    );
});

test('isGateReleased: 未処理 changesRequested でも解除する (#894)', () => {
    const item = { hitlLabel: true };
    // ラベルも発言解除も無いが、未処理の changesRequested があれば解除
    assert.equal(isGateReleased(item, { unhandledChangesRequested: true }), true);
    // 未処理 changesRequested 無し + ラベルあり → 待ち
    assert.equal(isGateReleased(item, { unhandledChangesRequested: false }), false);
});

test('phaseForItem: approve 後の Request changes は HITL ラベルが残っていても address-review (#894)', () => {
    // approve 済みで 🙋 ラベルは付いたまま（projection が付け直した）状態でも、
    // 未処理の新しい changesRequested があれば address-review へ倒す（行き止まり解消）。
    const item = { status: 'Review', hitlLabel: true };
    const ctx = {
        hitlSignals: { issueLabel: true, prLabel: true },
        review: { approved: false, changesRequested: true, changesRequestedAt: 300 },
        unhandledChangesRequested: true,
    };
    assert.equal(phaseForItem(item, ctx), 'address-review');
    // 一度処理して watermark が追いついた（unhandledChangesRequested=false）→ 待ちに戻る
    assert.equal(
        phaseForItem(item, { ...ctx, unhandledChangesRequested: false }),
        null,
    );
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
        { issue: 5, status: 'Sprint Backlog', kind: 'Issue', hitlLabel: true }, // human's turn
    ];
    const picked = selectActionable(items, { limit: 2, running: new Set() });
    assert.deepEqual(picked.map((p) => [p.issue, p.phase]), [[1, 'triage'], [2, 'implement']]);
    // 1 running -> only 1 more slot
    const picked2 = selectActionable(items, { limit: 2, running: new Set([1]) });
    assert.deepEqual(picked2.map((p) => p.issue), [2]);
});

test('selectActionable: released Review items dispatch address-review via contexts (#815)', () => {
    const items = [
        { issue: 10, status: 'Review', hitlLabel: false }, // released -> address-review
        { issue: 11, status: 'Review', hitlLabel: false }, // released -> address-review
        { issue: 12, status: 'Review', hitlLabel: true }, // still human's turn -> skipped
    ];
    const contexts = {
        10: { review: { approved: true }, pr: 100 },
        11: { review: { unresolvedHumanComments: 2 }, pr: 101 },
        12: { review: { approved: true }, pr: 102 },
    };
    const picked = selectActionable(items, { limit: 5, running: new Set(), contexts });
    assert.deepEqual(
        picked.map((p) => [p.issue, p.phase, p.pr]),
        [[10, 'address-review', 100], [11, 'address-review', 101]],
    );
});

test('isTrackerItem / hasTrackingLabel: EPIC またはラベルでトラッカー判定', () => {
    assert.equal(isTrackerItem({ kind: 'EPIC' }), true);
    assert.equal(isTrackerItem({ kind: 'Issue', labels: [TRACKING_LABEL] }), true);
    assert.equal(isTrackerItem({ kind: 'Issue', labels: [] }), false);
    assert.equal(isTrackerItem(null), false);
    // hasTrackingLabel は Kind を見ない（未分解 EPIC は decompose 対象のため）
    assert.equal(hasTrackingLabel({ kind: 'EPIC', labels: [] }), false);
    assert.equal(hasTrackingLabel({ labels: [TRACKING_LABEL] }), true);
});

test('waitingLabelAction: 待ち↔ラベルの差分だけ add/remove を返す', () => {
    assert.equal(waitingLabelAction(false, true), 'add'); // 待ち & ラベル無し
    assert.equal(waitingLabelAction(true, false), 'remove'); // 解決 & ラベル有り
    assert.equal(waitingLabelAction(true, true), null); // 待ち継続 → 無操作
    assert.equal(waitingLabelAction(false, false), null); // 解決済み → 無操作
});

test('phaseForItem: 🧭 tracking ラベル付きは作業 item ではない（常に null）', () => {
    assert.equal(phaseForItem({ status: 'New Item', labels: [TRACKING_LABEL] }), null);
    assert.equal(phaseForItem({ status: 'Sprint Backlog', kind: 'EPIC', labels: [TRACKING_LABEL] }), null);
    assert.equal(phaseForItem({ status: 'Review', hitlLabel: false, labels: [TRACKING_LABEL] }), null);
    // ラベルの無い EPIC は従来どおり decompose 対象
    assert.equal(phaseForItem({ status: 'Sprint Backlog', kind: 'EPIC', labels: [] }), 'decompose');
});

test('selectMergeCandidates / selectPrSyncCandidates: 🧭 tracking も除外', () => {
    const items = [
        { issue: 1, status: 'Review', kind: 'Issue' },
        { issue: 2, status: 'Review', kind: 'EPIC' },
        { issue: 3, status: 'Review', kind: 'Issue', labels: [TRACKING_LABEL] },
    ];
    assert.deepEqual(selectMergeCandidates(items).map((i) => i.issue), [1]);
    assert.deepEqual(selectPrSyncCandidates(items).map((i) => i.issue), [1]);
});

test('labelActions: Kind=EPIC には 🧭 tracking を担保する（自動では外さない）', () => {
    const epic = { kind: 'EPIC', hitlLabel: false, status: 'In Progress' };
    assert.ok(labelActions(epic, [AUTOPILOT_LABEL]).add.includes(TRACKING_LABEL));
    // 既に付いていれば何もしない
    assert.ok(!labelActions(epic, [AUTOPILOT_LABEL, TRACKING_LABEL]).add.includes(TRACKING_LABEL));
    // leaf に人間が手動で付けた tracking は剥がさない
    const leaf = { kind: 'Issue', hitlLabel: false, status: 'In Progress' };
    assert.ok(!labelActions(leaf, [AUTOPILOT_LABEL, TRACKING_LABEL]).remove.includes(TRACKING_LABEL));
});

test('needsPrLinkSticky: base 非デフォルト時のみ true', () => {
    assert.equal(needsPrLinkSticky({ number: 1, base: 'topic/epic-738' }), true);
    assert.equal(needsPrLinkSticky({ number: 1, base: 'develop' }), false);
    assert.equal(needsPrLinkSticky({ number: 1 }), false); // base 不明は投稿しない
    assert.equal(needsPrLinkSticky(null), false);
    // defaultBase の上書き
    assert.equal(needsPrLinkSticky({ number: 1, base: 'main' }, 'main'), false);
});

test('renderPrLinkSticky: マーカー + PR リンク + base を含む', () => {
    const body = renderPrLinkSticky({ number: 870, base: 'topic/epic-738' }, 'smalruby/smalruby3-editor');
    assert.ok(body.startsWith(PR_LINK_MARKER));
    assert.match(body, /https:\/\/github\.com\/smalruby\/smalruby3-editor\/pull\/870/);
    assert.match(body, /topic\/epic-738/);
});

test('selectMarkedCommentIds: 任意マーカーでコメント id を抽出', () => {
    const comments = [
        { id: 1, body: 'ふつうのコメント' },
        { id: 2, body: `${PR_LINK_MARKER}\n対応 PR: #870` },
        { id: 3, body: 'また別' },
        { id: 4, body: `${PR_LINK_MARKER} dup` },
    ];
    assert.deepEqual(selectMarkedCommentIds(comments, [PR_LINK_MARKER]), [2, 4]);
    assert.deepEqual(selectMarkedCommentIds(comments, ['<!-- other -->']), []);
    assert.deepEqual(selectMarkedCommentIds(null, [PR_LINK_MARKER]), []);
});

test('sanitizeForSurface: トークン・鍵・機密変数・URL クエリを redact する', () => {
    const raw = [
        'push failed: remote rejected with GH_TOKEN=ghs_abcdefghijklmnopqrstuvwx1234',
        'aws error: AKIAIOSFODNN7EXAMPLE not authorized',
        'header Authorization: Bearer abcdef1234567890abcdef',
        'GOOGLE_API_KEY=AIzaSyA-1234567890abcdefghijklmnopqrs',
        'presigned https://s3.amazonaws.com/bucket/key?X-Amz-Signature=deadbeef&X-Amz-Credential=AKID',
        'jwt eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N',
        '-----BEGIN RSA PRIVATE KEY-----\nMIIEow...\n-----END RSA PRIVATE KEY-----',
        'MY_SECRET: "hunter2" DB_PASSWORD=p@ssw0rd!',
    ].join('\n');
    const s = sanitizeForSurface(raw, 5000);
    assert.doesNotMatch(s, /ghs_abcdefghijklmnopqrstuvwx1234/);
    assert.doesNotMatch(s, /AKIAIOSFODNN7EXAMPLE/);
    assert.doesNotMatch(s, /Bearer abcdef1234567890abcdef/);
    assert.doesNotMatch(s, /AIzaSyA-1234567890abcdefghijklmnopqrs/);
    assert.doesNotMatch(s, /X-Amz-Signature/);
    assert.doesNotMatch(s, /eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9\./);
    assert.doesNotMatch(s, /MIIEow/);
    assert.doesNotMatch(s, /hunter2/);
    assert.doesNotMatch(s, /p@ssw0rd!/);
    // 無害な情報（何が起きたか）は残る
    assert.match(s, /push failed/);
    assert.match(s, /not authorized/);
    assert.match(s, /https:\/\/s3\.amazonaws\.com\/bucket\/key\?\[REDACTED\]/);
});

test('protectedPaths: Bot 権限外パス（workflows/actions）を抽出する', () => {
    const files = [
        'packages/scratch-gui/src/index.js',
        '.github/workflows/ci-cd.yml',
        '.github/actions/setup/action.yml',
        '.github/ISSUE_TEMPLATE/bug.md', // workflows/actions 以外の .github は対象外
        'docs/autopilot/README.md',
    ];
    assert.deepEqual(protectedPaths(files), ['.github/workflows/ci-cd.yml', '.github/actions/setup/action.yml']);
    assert.deepEqual(protectedPaths([]), []);
    assert.deepEqual(protectedPaths(null), []);
});

test('sanitizeForSurface: 長文は切り詰め、空入力は空文字', () => {
    assert.equal(sanitizeForSurface(''), '');
    assert.equal(sanitizeForSurface(null), '');
    const long = 'x'.repeat(1000);
    const s = sanitizeForSurface(long, 100);
    assert.ok(s.length < 200);
    assert.match(s, /切り詰め/);
});

test('stickyUpsertPlan: 同一内容なら PATCH をスキップ、重複は集約、無ければ POST', () => {
    // 無ければ新規 POST
    assert.deepEqual(stickyUpsertPlan([], 'body'), { action: 'post', keepId: null, deleteIds: [] });
    // 既存と同一 → skip（書き込み予算の節約）。重複の削除だけは行う
    assert.deepEqual(
        stickyUpsertPlan([{ id: 1, body: 'same' }, { id: 2, body: 'dup' }], 'same'),
        { action: 'skip', keepId: 1, deleteIds: [2] },
    );
    // 内容が変わった → PATCH
    assert.deepEqual(
        stickyUpsertPlan([{ id: 1, body: 'old' }], 'new'),
        { action: 'patch', keepId: 1, deleteIds: [] },
    );
});

test('selectMarkedComments: マーカーを含むコメントを {id, body} のまま返す', () => {
    const comments = [
        { id: 1, body: 'plain' },
        { id: 2, body: `${PR_LINK_MARKER} x` },
    ];
    assert.deepEqual(selectMarkedComments(comments, [PR_LINK_MARKER]), [{ id: 2, body: `${PR_LINK_MARKER} x` }]);
    assert.deepEqual(selectMarkedComments(null, [PR_LINK_MARKER]), []);
});

test('rateLimitPlan: 全トークン×リソースの最小残量で warn / skipLowPriority を決める', () => {
    const plan = rateLimitPlan({
        bot: { core: { remaining: 4000, limit: 5000 }, graphql: { remaining: 150, limit: 5000 } },
        read: { core: { remaining: 3000, limit: 5000 }, graphql: { remaining: 2500, limit: 5000 } },
    });
    assert.equal(plan.minRemaining, 150);
    assert.equal(plan.minAt, 'bot/graphql');
    assert.equal(plan.warn, true); // < 500
    assert.equal(plan.skipLowPriority, true); // < 200
    // 余裕があれば通常運転
    const ok = rateLimitPlan({ bot: { core: { remaining: 4800, limit: 5000 }, graphql: { remaining: 4700, limit: 5000 } } });
    assert.equal(ok.warn, false);
    assert.equal(ok.skipLowPriority, false);
    // 情報無し → 判断しない（スキップもしない）
    const none = rateLimitPlan({});
    assert.equal(none.minRemaining, null);
    assert.equal(none.skipLowPriority, false);
    // 欠損リソースは無視する
    const partial = rateLimitPlan({ bot: { core: { remaining: 300, limit: 5000 }, graphql: undefined } });
    assert.equal(partial.minRemaining, 300);
});

test('selectClosedCheckIssues: 非終端 + 🤖 ラベル付きだけを closed 確認の対象にする', () => {
    const items = [
        { issue: 1, status: 'Review', labels: [AUTOPILOT_LABEL] }, // 対象
        { issue: 2, status: 'Close', labels: [AUTOPILOT_LABEL] }, // 終端 → 除外（ステータス限定）
        { issue: 3, status: 'Done', labels: [AUTOPILOT_LABEL] }, // 終端 → 除外
        { issue: 4, status: 'Backlog', labels: [] }, // ラベル無し → 除外（ラベル限定）
        { issue: 5, status: 'In Progress', labels: [AUTOPILOT_LABEL, HITL_LABEL] }, // 対象
    ];
    assert.deepEqual(selectClosedCheckIssues(items), [1, 5]);
    assert.deepEqual(selectClosedCheckIssues([]), []);
});

test('selectBoardItems: assignee 指定でボード表示も enroll 判定（ownsItem）に限定', () => {
    const items = [
        { issue: 1, status: 'Review', assignees: ['me'] },
        { issue: 2, status: 'Review', assignees: ['other'] },
        { issue: 3, status: 'Review', assignees: [] }, // 未 assign（daemon が素通りする item）
        { issue: 4, status: 'Close', assignees: ['me'] }, // 終端
    ];
    assert.deepEqual(selectBoardItems(items, 'me').map((i) => i.issue), [1]);
    // 未指定は従来どおり（非終端すべて）
    assert.deepEqual(selectBoardItems(items).map((i) => i.issue), [1, 2, 3]);
});

test('itemOwner: 辞書順先頭の assignee が決定的な単一オーナー', () => {
    assert.equal(itemOwner({ assignees: ['takaokouji'] }), 'takaokouji');
    // 複数 assignee は辞書順先頭（入力順に依存しない）
    assert.equal(itemOwner({ assignees: ['zeta', 'alpha', 'mike'] }), 'alpha');
    assert.equal(itemOwner({ assignees: ['alpha', 'zeta'] }), 'alpha');
    // 未 assign はオーナー不在
    assert.equal(itemOwner({ assignees: [] }), null);
    assert.equal(itemOwner({}), null);
    assert.equal(itemOwner(null), null);
});

test('ownsItem: assignee モードでは単一オーナーのみ処理、未設定は全件', () => {
    // login 未設定（従来運用）→ 全件処理
    assert.equal(ownsItem({ assignees: [] }, null), true);
    assert.equal(ownsItem({ assignees: ['someone'] }, null), true);
    // assignee モード: 自分がオーナー
    assert.equal(ownsItem({ assignees: ['me'] }, 'me'), true);
    assert.equal(ownsItem({ assignees: ['me', 'zz'] }, 'me'), true);
    // 複数 assignee で自分が辞書順先頭でない → 処理しない（他人の daemon が拾う）
    assert.equal(ownsItem({ assignees: ['aa', 'me'] }, 'me'), false);
    // 他人の item / 未 assign → 処理しない
    assert.equal(ownsItem({ assignees: ['other'] }, 'me'), false);
    assert.equal(ownsItem({ assignees: [] }, 'me'), false);
});

const STATUS_ORDER = ['Backlog', 'Sprint Backlog', 'In Progress', 'Blocked', 'Review', 'DoD', 'Close', 'Icebox'];

test('statusRank: New Item(No Status) は最左、option 定義順、未知は末尾', () => {
    assert.equal(statusRank('New Item', STATUS_ORDER), -1);
    assert.equal(statusRank(undefined, STATUS_ORDER), -1); // 未設定は New Item 扱い
    assert.ok(statusRank('Backlog', STATUS_ORDER) < statusRank('Sprint Backlog', STATUS_ORDER));
    assert.ok(statusRank('Review', STATUS_ORDER) < statusRank('DoD', STATUS_ORDER));
    assert.equal(statusRank('Unknown Status', STATUS_ORDER), Number.MAX_SAFE_INTEGER);
});

test('orderItemsLikeBoard: Status 列順に並べ、同 Status 内は手動並び順（入力順）を保つ', () => {
    const items = [
        { issue: 1, status: 'Review' },
        { issue: 2, status: 'Sprint Backlog' },
        { issue: 3, status: 'Review' },
        { issue: 4, status: 'New Item' },
        { issue: 5, status: 'Sprint Backlog' },
    ];
    const ordered = orderItemsLikeBoard(items, STATUS_ORDER);
    assert.deepEqual(ordered.map((i) => i.issue), [4, 2, 5, 1, 3]);
    // 元配列は破壊しない
    assert.deepEqual(items.map((i) => i.issue), [1, 2, 3, 4, 5]);
});

test('selectActionable: statusOrder 指定で投入順が Board view の見た目に揃う', () => {
    const items = [
        // 手動並び順: Review 系が後ろ、Sprint Backlog が先頭付近にある想定を崩した入力
        { issue: 1, status: 'Sprint Backlog', kind: 'Issue' },
        { issue: 2, status: 'New Item' },
        { issue: 3, status: 'Sprint Backlog', kind: 'Issue' },
    ];
    const picked = selectActionable(items, { limit: 3, running: new Set(), statusOrder: STATUS_ORDER });
    // New Item(No Status 列) が最左 → 先頭。Sprint Backlog 内は手動並び順 1 → 3
    assert.deepEqual(picked.map((p) => p.issue), [2, 1, 3]);
});

test('selectActionable: assignee 指定で自分がオーナーの item だけ拾う（enroll モデル）', () => {
    const items = [
        { issue: 1, status: 'Sprint Backlog', kind: 'Issue', assignees: ['me'] },
        { issue: 2, status: 'Sprint Backlog', kind: 'Issue', assignees: ['other'] },
        { issue: 3, status: 'Sprint Backlog', kind: 'Issue', assignees: [] }, // 未 assign は誰も拾わない
        { issue: 4, status: 'Sprint Backlog', kind: 'Issue', assignees: ['aa', 'me'] }, // 先頭でない
        { issue: 5, status: 'Sprint Backlog', kind: 'Issue', assignees: ['me', 'zz'] }, // 先頭
    ];
    const picked = selectActionable(items, { limit: 10, running: new Set(), assignee: 'me' });
    assert.deepEqual(picked.map((p) => p.issue), [1, 5]);
    // assignee 未指定は従来動作（全件）
    const all = selectActionable(items, { limit: 10, running: new Set() });
    assert.deepEqual(all.map((p) => p.issue), [1, 2, 3, 4, 5]);
});

test('PHASE_BY_COMMAND maps triage to the skill and AI status', () => {
    assert.deepEqual(PHASE_BY_COMMAND.triage, { skill: 'autopilot-triage', aiStatus: 'Triaging' });
    assert.equal(PHASE_BY_COMMAND['address-review'].skill, 'autopilot-address-review');
    assert.deepEqual(PHASE_BY_COMMAND.discuss, { skill: 'autopilot-discuss', aiStatus: 'Discussing' });
});

test('phaseForItem: 実装前ディスカッション（AI Status=Discussing）の往復', () => {
    // 人間が 🙋 を外した（返信した）→ discuss を起動
    assert.equal(phaseForItem({ status: 'Backlog', aiStatus: 'Discussing', hitlLabel: false }), 'discuss');
    assert.equal(phaseForItem({ status: 'New Item', aiStatus: 'Discussing', hitlLabel: false }), 'discuss');
    // 🙋 あり = 人間の番（提案への返信待ち）
    assert.equal(phaseForItem({ status: 'Backlog', aiStatus: 'Discussing', hitlLabel: true }), null);
    // Discussing でない Backlog は従来どおり人間駆動（何もしない）
    assert.equal(phaseForItem({ status: 'Backlog', aiStatus: null, hitlLabel: false }), null);
    // 承認後（discuss done）は Sprint Backlog + AI Status クリア → implement へ直接ハンドオフ
    assert.equal(phaseForItem({ status: 'Sprint Backlog', kind: 'Issue', aiStatus: null, hitlLabel: false }), 'implement');
});

test('applyResult: hitl + nextAiStatus=Discussing で議論状態を維持できる', () => {
    const intents = applyResult({
        signal: 'hitl', issue: 1, phase: 'triage', summary: 's',
        reason: 'r', nextStatus: 'Backlog', nextAiStatus: 'Discussing',
    });
    const m = Object.fromEntries(intents.map((i) => [i.field, i.value]));
    assert.equal(m.Status, 'Backlog');
    assert.equal(m['AI Status'], 'Discussing');
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

test('mergeProgressionIntents: merged leaf -> Close, clear AI Status (no HITL field)', () => {
    const intents = mergeProgressionIntents({ issue: 1, status: 'Review', kind: 'Issue' }, true);
    const m = Object.fromEntries(intents.map((i) => [i.field, i.value]));
    assert.equal(m.Status, 'Close');
    assert.equal(m['AI Status'], null);
    // HITL は Project フィールドではなく 🙋 ラベル（#813）。Project 意図に HITL は含めない。
    assert.ok(!('HITL' in m));
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

test('selectClosedToReconcile: GitHub-closed items not yet at a terminal Status (incl. EPIC)', () => {
    const items = [
        { issue: 1, status: 'Review', kind: 'Issue' }, // closed + non-terminal -> reconcile
        { issue: 2, status: 'Close', kind: 'Issue' }, // closed but already terminal -> skip (idempotent)
        { issue: 3, status: 'Done', kind: 'Issue' }, // closed but terminal -> skip
        { issue: 4, status: 'Review', kind: 'EPIC' }, // closed EPIC + non-terminal -> reconcile (EPIC included)
        { issue: 5, status: 'In Progress', kind: 'Issue' }, // open on GitHub -> skip
        { issue: 6, status: undefined, kind: 'Issue' }, // closed, no Status -> reconcile
    ];
    const closedSet = new Set([1, 2, 3, 4, 6]);
    assert.deepEqual(
        selectClosedToReconcile(items, closedSet).map((i) => i.issue),
        [1, 4, 6],
    );
});

test('selectClosedToReconcile: accepts an array (not only a Set) as closedSet', () => {
    const items = [{ issue: 7, status: 'DoD', kind: 'Issue' }];
    assert.deepEqual(selectClosedToReconcile(items, [7]).map((i) => i.issue), [7]);
});

test('selectClosedToReconcile: empty/missing inputs -> empty array', () => {
    assert.deepEqual(selectClosedToReconcile([], new Set([1])), []);
    assert.deepEqual(selectClosedToReconcile(null, null), []);
    assert.deepEqual(selectClosedToReconcile([{ issue: 1, status: 'Review' }], new Set()), []);
});

test('TERMINAL_STATUSES: Close and Done are terminal', () => {
    assert.ok(TERMINAL_STATUSES.has('Close'));
    assert.ok(TERMINAL_STATUSES.has('Done'));
    assert.ok(!TERMINAL_STATUSES.has('Review'));
});

test('applyResult: done sets Status/Size/Kind, clears AI Status, no HITL field (#813)', () => {
    const intents = applyResult({
        issue: 1, phase: 'triage', signal: 'done', summary: 's',
        nextStatus: 'Backlog', nextAiStatus: null, hitl: false, size: 'middle', kind: 'Issue', createdSubIssues: [],
    });
    const m = Object.fromEntries(intents.map(i => [i.field, i.value]));
    assert.equal(m.Status, 'Backlog');
    assert.equal(m['AI Status'], null);
    assert.ok(!('HITL' in m)); // HITL は 🙋 ラベルで表現（Project 意図に含めない）
    assert.equal(m.Size, 'middle');
    assert.equal(m.Kind, 'Issue');
});

test('subIssueSetupIntents: 未設定の新規 sub-issue に Status/Kind/Size を設定する (#914)', () => {
    const intents = subIssueSetupIntents('small', {});
    const m = Object.fromEntries(intents.map(i => [i.field, i.value]));
    assert.equal(m.Status, 'Sprint Backlog');
    assert.equal(m.Kind, 'Issue');
    assert.equal(m.Size, 'small');
});

test('subIssueSetupIntents: size が無ければ Size は設定しない (#914)', () => {
    const intents = subIssueSetupIntents(null, {});
    const m = Object.fromEntries(intents.map(i => [i.field, i.value]));
    assert.equal(m.Status, 'Sprint Backlog');
    assert.equal(m.Kind, 'Issue');
    assert.ok(!('Size' in m));
});

test('subIssueSetupIntents: 既に設定済みのフィールドは上書きしない（冪等・#914）', () => {
    const intents = subIssueSetupIntents('large', { status: 'In Progress', kind: 'Issue', size: 'small' });
    assert.deepEqual(intents, []);
});

test('subIssueSetupIntents: 一部だけ設定済みなら残りだけ設定する (#914)', () => {
    const intents = subIssueSetupIntents('middle', { status: 'Sprint Backlog' });
    const m = Object.fromEntries(intents.map(i => [i.field, i.value]));
    assert.ok(!('Status' in m));
    assert.equal(m.Kind, 'Issue');
    assert.equal(m.Size, 'middle');
});

test('applyResult: hitl sets optional Status but no HITL field', () => {
    const intents = applyResult({ issue: 1, phase: 'triage', signal: 'hitl', summary: 's', reason: 'r', nextStatus: 'Icebox' });
    const m = Object.fromEntries(intents.map(i => [i.field, i.value]));
    assert.ok(!('HITL' in m));
    assert.equal(m.Status, 'Icebox');
});

test('applyResult: error blocks (HITL handled via label, not field)', () => {
    const intents = applyResult({ issue: 1, phase: 'triage', signal: 'error', summary: 's', error: 'boom' });
    const m = Object.fromEntries(intents.map(i => [i.field, i.value]));
    assert.equal(m.Status, 'Blocked');
    assert.ok(!('HITL' in m));
});

test('hitlDesireFromResult: done follows result.hitl; hitl/error -> true', () => {
    assert.equal(hitlDesireFromResult({ signal: 'done', hitl: true }), true);
    assert.equal(hitlDesireFromResult({ signal: 'done', hitl: false }), false);
    assert.equal(hitlDesireFromResult({ signal: 'done' }), false); // missing -> false
    assert.equal(hitlDesireFromResult({ signal: 'hitl', reason: 'r' }), true);
    assert.equal(hitlDesireFromResult({ signal: 'error', error: 'boom' }), true);
    assert.equal(hitlDesireFromResult(null), false);
});

test('isHitlReleased: all label signals waiting -> not released', () => {
    assert.equal(isHitlReleased({ issueLabel: true, prLabel: true }), false);
});

test('isHitlReleased: any one label cleared -> released (OR semantics)', () => {
    assert.equal(isHitlReleased({ issueLabel: true, prLabel: false }), true);
    assert.equal(isHitlReleased({ issueLabel: false, prLabel: true }), true);
    assert.equal(isHitlReleased({ issueLabel: false, prLabel: false }), true);
});

test('isHitlReleased: non-applicable (undefined) signals are ignored', () => {
    // PR が無い（prLabel undefined）ときに誤って released にしない
    assert.equal(isHitlReleased({ issueLabel: true, prLabel: undefined }), false);
    assert.equal(isHitlReleased({ issueLabel: false, prLabel: undefined }), true);
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

// #815: Draft/Ready は Status 基準（HITL ラベルではない）。Review で approve しつつ 🙋 を
// 外して AI に差し戻しても Status は Review のまま → Ready を維持する（旧バグ #808 の回避）。
test('desiredDraft: Status 基準（Review/DoD/Close/Blocked のみ Ready）(#815)', () => {
    assert.equal(desiredDraft({ status: 'In Progress' }), true); // AI 作業中 -> Draft
    assert.equal(desiredDraft({ status: 'Sprint Backlog' }), true);
    assert.equal(desiredDraft({ status: 'Review' }), false); // 人間が見る -> Ready
    assert.equal(desiredDraft({ status: 'DoD' }), false);
    assert.equal(desiredDraft({ status: 'Close' }), false);
    assert.equal(desiredDraft({ status: 'Blocked' }), false);
    // HITL ラベルの有無に依らず Status だけで決まる（解除しても Review のままなら Ready）
    assert.equal(desiredDraft({ status: 'Review', hitlLabel: false }), false);
    assert.equal(desiredDraft({ status: 'In Progress', hitlLabel: true }), true);
    assert.ok(READY_STATUSES.has('Review') && !READY_STATUSES.has('In Progress'));
});

test('draftAction: only acts on a diff (idempotent, Status 基準) (#815)', () => {
    // Review = Ready 希望。currently draft -> ready
    assert.equal(draftAction(true, { status: 'Review' }), 'ready');
    // Review, currently ready -> no change
    assert.equal(draftAction(false, { status: 'Review' }), null);
    // In Progress = Draft 希望。currently ready -> draft
    assert.equal(draftAction(false, { status: 'In Progress' }), 'draft');
    // In Progress, currently draft -> no change
    assert.equal(draftAction(true, { status: 'In Progress' }), null);
});

// #815: reviewDecision が空でも reviews から approve を導く
test('computeReviewApproval: reviewDecision 優先 (APPROVED/CHANGES_REQUESTED)', () => {
    assert.deepEqual(computeReviewApproval([], 'APPROVED'), { approved: true, changesRequested: false });
    assert.deepEqual(
        computeReviewApproval([{ author: { login: 'x' }, state: 'APPROVED' }], 'CHANGES_REQUESTED'),
        { approved: false, changesRequested: true },
    );
});

test('computeReviewApproval: reviewDecision 空なら reviews の著者別最新 state で判定 (#815)', () => {
    const isHuman = (l) => l !== 'bot';
    // approve のみ -> approved
    assert.deepEqual(
        computeReviewApproval([{ author: { login: 'ko' }, state: 'APPROVED' }], '', isHuman),
        { approved: true, changesRequested: false },
    );
    // 同一著者の最新が優先（古い→新しい順）。後の CHANGES_REQUESTED が勝つ
    assert.deepEqual(
        computeReviewApproval(
            [{ author: { login: 'ko' }, state: 'APPROVED' }, { author: { login: 'ko' }, state: 'CHANGES_REQUESTED' }],
            '', isHuman,
        ),
        { approved: false, changesRequested: true },
    );
    // COMMENTED は承認判断に効かない。bot の approve は人間判定で除外
    assert.deepEqual(
        computeReviewApproval(
            [{ author: { login: 'ko' }, state: 'COMMENTED' }, { author: { login: 'bot' }, state: 'APPROVED' }],
            null, isHuman,
        ),
        { approved: false, changesRequested: false },
    );
    // 変更要求が1人でもあれば approve より優先
    assert.deepEqual(
        computeReviewApproval(
            [{ author: { login: 'a' }, state: 'APPROVED' }, { author: { login: 'b' }, state: 'CHANGES_REQUESTED' }],
            '', isHuman,
        ),
        { approved: false, changesRequested: true },
    );
});

// #816: In Progress + AI 作業中マーカーのまま止まった item の検知（純粋部分）
test('isStuckCandidate: In Progress + 作業中 AI Status のみ true', () => {
    assert.equal(isStuckCandidate({ status: 'In Progress', aiStatus: 'Implementing' }), true);
    assert.equal(isStuckCandidate({ status: 'In Progress', aiStatus: 'Decomposing' }), true);
    // Self-Reviewing は次 tick で自動 dispatch されるので対象外
    assert.equal(isStuckCandidate({ status: 'In Progress', aiStatus: 'Self-Reviewing' }), false);
    // EPIC Decomposed は decompose 完了済み EPIC の resting 状態（子の実装待ち）で
    // run が無くて当然 → stuck 対象外（#856）
    assert.equal(isStuckCandidate({ status: 'In Progress', aiStatus: 'EPIC Decomposed' }), false);
    // AI Status 空の In Progress（人間操作）は対象外
    assert.equal(isStuckCandidate({ status: 'In Progress', aiStatus: null }), false);
    assert.equal(isStuckCandidate({ status: 'In Progress' }), false);
    // In Progress 以外は対象外
    assert.equal(isStuckCandidate({ status: 'Review', aiStatus: 'Implementing' }), false);
    assert.equal(isStuckCandidate(null), false);
});

test('hitlLabelAction: non-Review reconciles toward the Issue canonical (hitlLabel)', () => {
    assert.equal(hitlLabelAction({ status: 'Blocked', hitlLabel: true }, false), 'add');
    assert.equal(hitlLabelAction({ status: 'Blocked', hitlLabel: true }, true), null);
    assert.equal(hitlLabelAction({ status: 'In Progress', hitlLabel: false }, true), 'remove');
    assert.equal(hitlLabelAction({ status: 'In Progress', hitlLabel: false }, false), null);
});

test('hitlLabelAction: Review label is human-controlled in steady-state (no re-add)', () => {
    // canonical=Yes but label removed by human (release gesture) -> do NOT re-add per-tick
    assert.equal(hitlLabelAction({ status: 'Review', hitlLabel: true }, false), null);
    // canonical=No -> still allow removal toward No
    assert.equal(hitlLabelAction({ status: 'Review', hitlLabel: false }, true), 'remove');
    // already present + canonical=Yes -> nothing to do
    assert.equal(hitlLabelAction({ status: 'Review', hitlLabel: true }, true), null);
});

test('hitlLabelAction: Review with force (authoritative handoff) sets the label', () => {
    // entering Review at handoff -> force-add the label even though status is Review
    assert.equal(hitlLabelAction({ status: 'Review', hitlLabel: true }, false, { force: true }), 'add');
    assert.equal(hitlLabelAction({ status: 'Review', hitlLabel: false }, true, { force: true }), 'remove');
});

test('labelActions: ensures autopilot label and reconciles HITL label', () => {
    // missing both labels, 🙋 canonical=Yes (non-Review) -> add both
    let d = labelActions({ status: 'Blocked', hitlLabel: true }, []);
    assert.deepEqual(d.add.sort(), [AUTOPILOT_LABEL, HITL_LABEL].sort());
    assert.deepEqual(d.remove, []);
    // autopilot present, HITL present but canonical=No -> remove HITL only
    d = labelActions({ status: 'In Progress', hitlLabel: false }, [AUTOPILOT_LABEL, HITL_LABEL]);
    assert.deepEqual(d.add, []);
    assert.deepEqual(d.remove, [HITL_LABEL]);
    // Review steady-state with canonical=Yes, HITL label absent -> leave alone, still ensure autopilot
    d = labelActions({ status: 'Review', hitlLabel: true }, []);
    assert.deepEqual(d.add, [AUTOPILOT_LABEL]);
    assert.deepEqual(d.remove, []);
});

test('renderSticky: includes marker and projects Status/AI Status/HITL/Size', () => {
    const body = renderSticky({ issue: 794, status: 'Review', aiStatus: null, hitlLabel: true, size: 'small' });
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
    const item = { issue: 1, status: 'In Progress', aiStatus: 'Implementing', hitlLabel: false, size: 'small', kind: 'Issue' };
    const out = applyIntentsToItem(item, [
        { field: 'Status', value: 'Review' },
        { field: 'AI Status', value: null },
    ]);
    assert.equal(out.status, 'Review');
    assert.equal(out.aiStatus, null);
    assert.equal(out.hitlLabel, false); // HITL はラベルなので intent では触らない
    assert.equal(out.size, 'small'); // untouched
    assert.equal(item.status, 'In Progress'); // original not mutated
});

test('applyIntentsToItem composes with applyResult + hitlDesireFromResult (review handoff)', () => {
    const item = { issue: 1, status: 'In Progress', aiStatus: 'Self-Reviewing', hitlLabel: false, kind: 'Issue' };
    const result = {
        issue: 1, phase: 'review', signal: 'done', summary: 's',
        nextStatus: 'Review', nextAiStatus: null, hitl: true,
    };
    // daemon は結果から導いた HITL 希望を hitlLabel として item に載せてから投影する（#813）
    const out = applyIntentsToItem({ ...item, hitlLabel: hitlDesireFromResult(result) }, applyResult(result));
    assert.equal(out.status, 'Review');
    assert.equal(out.hitlLabel, true);
    assert.equal(desiredDraft(out), false); // -> Ready for review
});

// ---- DoD handoff (#821) ----

test('phaseForItem: DoD still 🙋 ラベルあり -> null (human/host turn)', () => {
    assert.equal(phaseForItem({ status: 'DoD', hitlLabel: true }), null);
});

test('phaseForItem: DoD released (🙋 removed) -> address-review (NG 差し戻し・#821)', () => {
    // Review と対称: DoD で人間が NG 判断して 🙋 を外したら address-review へ
    assert.equal(phaseForItem({ status: 'DoD', hitlLabel: false }), 'address-review');
});

test('phaseForItem: DoD released via PR label only (OR semantics) -> address-review (#821)', () => {
    const item = { status: 'DoD', hitlLabel: true };
    const ctx = { hitlSignals: { issueLabel: true, prLabel: false } };
    assert.equal(phaseForItem(item, ctx), 'address-review');
});

test('phaseForItem: DoD with all HITL signals waiting -> null', () => {
    const item = { status: 'DoD', hitlLabel: true };
    const ctx = { hitlSignals: { issueLabel: true, prLabel: true } };
    assert.equal(phaseForItem(item, ctx), null);
});

test('hitlLabelAction: DoD steady-state does NOT re-add a human-removed label (#821)', () => {
    // canonical=Yes but label removed by human (NG 差し戻しジェスチャ) -> do NOT re-add per-tick
    assert.equal(hitlLabelAction({ status: 'DoD', hitlLabel: true }, false), null);
    // canonical=No -> still allow removal toward No
    assert.equal(hitlLabelAction({ status: 'DoD', hitlLabel: false }, true), 'remove');
});

test('hitlLabelAction: DoD with force (authoritative) sets the label', () => {
    assert.equal(hitlLabelAction({ status: 'DoD', hitlLabel: true }, false, { force: true }), 'add');
});

test('renderSticky: DoD adds a 1-line handoff pointer (separate comment, not overwritten)', () => {
    const body = renderSticky({ issue: 821, status: 'DoD', aiStatus: null, hitlLabel: true, size: 'small' });
    assert.match(body, /DoD 引き継ぎあり/);
    assert.match(body, /autopilot:dod-handoff/);
    // sticky body itself keeps its own marker (it is not the handoff comment)
    assert.match(body, new RegExp(STICKY_MARKER.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
});

test('renderSticky: non-DoD has no handoff pointer', () => {
    const body = renderSticky({ issue: 1, status: 'Review', aiStatus: null, hitlLabel: true, size: null });
    assert.ok(!/DoD 引き継ぎあり/.test(body));
});

test('dodHandoffMarker / isDodHandoffComment / hasDodHandoffComment', () => {
    assert.equal(dodHandoffMarker(631, 818), '<!-- autopilot:dod-handoff issue=631 pr=818 -->');
    assert.equal(isDodHandoffComment('<!-- autopilot:dod-handoff issue=1 pr=2 -->\n...'), true);
    // 接頭辞のみで判定（issue/pr 番号に依存しない＝冪等チェックに使える）
    assert.equal(isDodHandoffComment('<!-- autopilot:dod-handoff -->'), true);
    assert.equal(isDodHandoffComment('just a comment'), false);
    assert.equal(isDodHandoffComment(''), false);
    assert.equal(isDodHandoffComment(null), false);
    assert.equal(hasDodHandoffComment([{ body: 'x' }, { body: '<!-- autopilot:dod-handoff issue=1 pr=2 -->' }]), true);
    assert.equal(hasDodHandoffComment([{ body: 'x' }, { body: 'y' }]), false);
    assert.equal(hasDodHandoffComment([]), false);
    assert.equal(hasDodHandoffComment(null), false);
});

test('extractPreviewUrl: finds branch preview URL from CI comments', () => {
    const comments = [
        { body: 'some build log' },
        { body: 'Preview: https://smalruby.jp/smalruby3-editor/topic/autopilot-631/ ready' },
    ];
    assert.equal(extractPreviewUrl(comments), 'https://smalruby.jp/smalruby3-editor/topic/autopilot-631/');
    assert.equal(extractPreviewUrl([{ body: 'no url here' }]), null);
    assert.equal(extractPreviewUrl([]), null);
    assert.equal(extractPreviewUrl(null), null);
});

test('extractDodChecklist: extracts the DoD section until the next heading', () => {
    const body = [
        '## 概要', 'foo', '', '## DoD', '', '- [ ] item A', '- [ ] item B', '', '## 備考', 'bar',
    ].join('\n');
    const checklist = extractDodChecklist(body);
    assert.match(checklist, /- \[ \] item A/);
    assert.match(checklist, /- \[ \] item B/);
    assert.ok(!/概要/.test(checklist));
    assert.ok(!/備考/.test(checklist)); // 次の見出しで打ち切る
});

test('extractDodChecklist: missing section -> null', () => {
    assert.equal(extractDodChecklist('## 概要\nno dod here'), null);
    assert.equal(extractDodChecklist(''), null);
    assert.equal(extractDodChecklist(null), null);
});

test('needsDodHandoff: DoD + PR + not yet generated -> true; otherwise false (idempotent)', () => {
    const leaf = { status: 'DoD', kind: 'Issue' };
    assert.equal(needsDodHandoff(leaf, { hasHandoffComment: false, hasPr: true }), true);
    // 生成済み -> false（二重投稿しない）
    assert.equal(needsDodHandoff(leaf, { hasHandoffComment: true, hasPr: true }), false);
    // PR 無し -> false
    assert.equal(needsDodHandoff(leaf, { hasHandoffComment: false, hasPr: false }), false);
    // DoD 以外 -> false
    assert.equal(needsDodHandoff({ status: 'Review', kind: 'Issue' }, { hasHandoffComment: false, hasPr: true }), false);
    // EPIC -> false（実装 PR を持たない）
    assert.equal(needsDodHandoff({ status: 'DoD', kind: 'EPIC' }, { hasHandoffComment: false, hasPr: true }), false);
    assert.equal(needsDodHandoff(null, { hasHandoffComment: false, hasPr: true }), false);
});

test('dodHandoffBody: includes marker, preview URL, checklist, headful steps, report exits', () => {
    const body = dodHandoffBody({
        issue: 631, pr: 818, repo: 'smalruby/smalruby3-editor', branch: 'topic/autopilot-631',
        previewUrl: 'https://smalruby.jp/smalruby3-editor/topic/autopilot-631/',
        dodChecklist: '- [ ] ボタンが表示される\n- [ ] クリックでキャッシュ',
    });
    // 冪等判定に使うマーカー
    assert.match(body, /<!-- autopilot:dod-handoff issue=631 pr=818 -->/);
    // プレビュー URL
    assert.match(body, /https:\/\/smalruby\.jp\/smalruby3-editor\/topic\/autopilot-631\//);
    // Issue の DoD チェックリストの転記
    assert.match(body, /- \[ \] ボタンが表示される/);
    // 定型 headful 手順
    assert.match(body, /\?no_beforeunload=1/);
    assert.match(body, /headful/);
    assert.match(body, /tmp\//);
    assert.match(body, /docs\/<feature>\/screenshots\//);
    assert.match(body, /\.env/); // 秘密情報はローカル .env 参照
    // 報告の出口（OK / NG→address-review / 判断に迷う）
    assert.match(body, /すべて OK/);
    assert.match(body, /address-review/);
    assert.match(body, /🙋 HITL/);
    // PR/Issue 参照
    assert.match(body, /#818/);
    assert.match(body, /#631/);
    assert.match(body, /topic\/autopilot-631/);
});

test('dodHandoffBody: graceful fallbacks when previewUrl / checklist are missing', () => {
    const body = dodHandoffBody({ issue: 5, pr: 9, previewUrl: null, dodChecklist: null });
    assert.match(body, /<!-- autopilot:dod-handoff issue=5 pr=9 -->/);
    assert.match(body, /プレビュー URL を CI コメントから取得できませんでした/);
    assert.match(body, /DoD チェックリストが見つかりませんでした/);
    // repo/branch 省略でも壊れない
    assert.match(body, /#9/);
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

test('evaluate: 対話プロンプトが tPromptMs 継続 -> hitl（質問させず即打ち切り）', () => {
    const a = evaluate({
        resultPresent: false, ready: true, dead: false, elapsedMs: 5000, idleMs: 1000, restarts: 0,
        promptingMs: cfg.tPromptMs + 1,
    }, cfg);
    assert.equal(a.action, 'hitl');
});

test('evaluate: プロンプトが短時間（tPromptMs 未満）なら wait（誤検知しない）', () => {
    const a = evaluate({
        resultPresent: false, ready: true, dead: false, elapsedMs: 5000, idleMs: 1000, restarts: 0,
        promptingMs: 1000,
    }, cfg);
    assert.equal(a.action, 'wait');
});

test('evaluate: 結果ファイルがあればプロンプト検知より優先して collect', () => {
    const a = evaluate({
        resultPresent: true, ready: true, dead: false, elapsedMs: 5000, idleMs: 0, restarts: 0,
        promptingMs: cfg.tPromptMs + 1,
    }, cfg);
    assert.equal(a.action, 'collect');
});

test('PROMPT_RE: 許可/確認/選択ダイアログを検知し、通常出力は誤検知しない', () => {
    // 実際に worker が停止したプロンプト群
    assert.match('❯ 1. Yes\n  2. No\n Esc to cancel · Tab to amend', PROMPT_RE);
    assert.match('Do you want to proceed?', PROMPT_RE);
    assert.match('Do you want to create comment.md?', PROMPT_RE);
    // 通常の作業ログは誤検知しない
    assert.doesNotMatch('Ran 3 shell commands, read 2 files', PROMPT_RE);
    assert.doesNotMatch('● The logic chain is coherent.', PROMPT_RE);
});

// === #827: Issue 本文からの base ブランチ宣言の抽出 ===

test('parseBaseBranch: 宣言が無ければ null（= 既定 develop）', () => {
    assert.equal(parseBaseBranch(''), null);
    assert.equal(parseBaseBranch(null), null);
    assert.equal(parseBaseBranch('ふつうの issue 本文。develop で実装する。'), null);
});

test('parseBaseBranch: autopilot-base ディレクティブ（最優先）', () => {
    assert.equal(parseBaseBranch('autopilot-base: topic/koshien-epic-738'), 'topic/koshien-epic-738');
    assert.equal(parseBaseBranch('<!-- autopilot-base: `feature/x` -->'), 'feature/x');
    assert.equal(parseBaseBranch('blah\nAutopilot-Base:  topic/abc \nblah'), 'topic/abc');
});

test('parseBaseBranch: 「## ベースブランチ」セクション（#827 形式）', () => {
    const body = [
        '## やること', '...',
        '## ベースブランチ', '',
        '- **`topic/koshien-epic-738`**（Epic #738 の一部。PR はこの epic ブランチを対象にする）',
        '## 関連',
    ].join('\n');
    assert.equal(parseBaseBranch(body), 'topic/koshien-epic-738');
});

test('parseBaseBranch: 英語 "Base branch" ラベルも認識', () => {
    assert.equal(parseBaseBranch('Base branch\n`topic/foo-bar`'), 'topic/foo-bar');
});

test('parseBaseBranch: ディレクティブはセクションより優先', () => {
    const body = 'autopilot-base: topic/win\n## ベースブランチ\n- `topic/lose`';
    assert.equal(parseBaseBranch(body), 'topic/win');
});

test('parseBaseBranch: ディレクティブは行頭のみ反応（本文中の言及では発火しない）', () => {
    // 例: 「この修正を autopilot に任せる」Issue の説明に仕様として書かれた場合
    assert.equal(parseBaseBranch('説明のために autopilot-base: topic/x と書くとブランチを指定できる'), null);
    assert.equal(parseBaseBranch('- リスト内の autopilot-base: topic/x も無効'), null);
    // 行頭なら反応する（HTML コメントも行頭からなら可）
    assert.equal(parseBaseBranch('前置き\nautopilot-base: topic/ok\n後書き'), 'topic/ok');
    assert.equal(parseBaseBranch('前置き\n<!-- autopilot-base: topic/ok -->'), 'topic/ok');
    // 行頭に空白があるものは行頭扱いしない
    assert.equal(parseBaseBranch('  autopilot-base: topic/indented'), null);
});

test('parseAfterIssues: 行頭の autopilot-after 宣言から依存 Issue を抽出', () => {
    assert.deepEqual(parseAfterIssues('autopilot-after: #123'), [123]);
    assert.deepEqual(parseAfterIssues('autopilot-after: #12, #34 56'), [12, 34, 56]);
    assert.deepEqual(parseAfterIssues('<!-- autopilot-after: #7 -->'), [7]);
    // 複数行の宣言は合算・重複除去
    assert.deepEqual(parseAfterIssues('autopilot-after: #1\n本文\nautopilot-after: #2 #1'), [1, 2]);
    // 行頭以外の言及では発火しない
    assert.deepEqual(parseAfterIssues('説明: autopilot-after: #99 と書ける'), []);
    assert.deepEqual(parseAfterIssues(''), []);
    assert.deepEqual(parseAfterIssues(null), []);
});

test('parseAfterIssues: 説明用の安全表記（スペース入り・非行頭）は依存として拾わない', () => {
    // ⚠️ 自己参照の罠の回帰テスト（#898）:
    // 機能を説明する Issue/ドキュメント/プロンプトが依存ディレクティブを「例示」しても、
    // 本物の依存として誤検出してはならない。安全な書き方が実際に no-match であることを固定する。

    // 1. スペース入り表記（autopilot - after）はコロン前で切れるので発火しない
    assert.deepEqual(parseAfterIssues('autopilot - after: #12 と書くと直列化できる'), []);
    assert.deepEqual(parseAfterIssues('autopilot -after: #34'), []);

    // 2. 行頭でない言及（インデント含む）は発火しない
    assert.deepEqual(parseAfterIssues('  autopilot-after: #56'), []);
    assert.deepEqual(parseAfterIssues('- autopilot-after: #78 のように書く'), []);
    assert.deepEqual(parseAfterIssues('例: `autopilot-after: #90` を行頭に置く'), []);

    // 3. 複数行の文書中で、本物の宣言（行頭）だけを拾い、説明用の言及は無視する
    const doc = [
        '依存の書き方を説明する。',
        '`autopilot-after: #999` のように書く（このバッククォート囲みは拾われない）。',
        'autopilot - after: #888 のようにスペース入りでも安全。',
        'autopilot-after: #123',
    ].join('\n');
    assert.deepEqual(parseAfterIssues(doc), [123]);
});

test('unresolvedAfterIssues: closed or 終端 Status の依存は解決済み', () => {
    const ctx = {
        closedSet: new Set([10]),
        statusByIssue: { 11: 'Close', 12: 'In Progress', 13: 'Done' },
    };
    // 10=closed, 11=Close, 13=Done は解決済み。12=In Progress と 99=不明 は未解決
    assert.deepEqual(unresolvedAfterIssues([10, 11, 12, 13, 99], ctx), [12, 99]);
    assert.deepEqual(unresolvedAfterIssues([], ctx), []);
    // 情報が無い依存は保守的に「未完了」扱い
    assert.deepEqual(unresolvedAfterIssues([10], {}), [10]);
    // closedSet が配列でも動く
    assert.deepEqual(unresolvedAfterIssues([10, 12], { closedSet: [10] }), [12]);
});

// === プロンプト起動メッセージ（Skill スラッシュではなくファイル参照） ===

test('phasePromptCommand: プロンプトファイルを Read させ Issue 番号を含む（スラッシュではない）', () => {
    const cmd = phasePromptCommand('autopilot-triage', 833);
    assert.match(cmd, /tools\/autopilot\/prompts\/autopilot-triage\.md/);
    assert.match(cmd, /AUTOPILOT_ISSUE=833/);
    assert.ok(!cmd.startsWith('/'), 'スラッシュコマンドではない');
});
