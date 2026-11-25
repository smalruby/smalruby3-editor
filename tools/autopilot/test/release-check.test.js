'use strict';
/**
 * release-check.test.js — 分解済み EPIC のリリース確認（#2430）の純粋関数。
 */
const { test } = require('node:test');
const assert = require('node:assert');
const rc = require('../src/release-check');
const { TRACKING_LABEL, RELEASE_CHECK_AI_STATUS, phaseForItem, planDelegate, humanWaitReason, isStuckCandidate } = require('../src/phases');

const bot = { login: 'smalruby3-editor-bot[bot]', type: 'Bot' };
const human = { login: 'someone', type: 'User' };
const tracker = (over = {}) => ({
    issue: 10, itemId: 'PVTI_10', labels: [TRACKING_LABEL], kind: 'EPIC', status: 'In Progress',
    aiStatus: 'EPIC Decomposed', hitl: false, subIssues: { total: 3, completed: 3 }, ...over,
});

test('releaseCheckReady: 子が全部済んだ 🧭 トラッカーだけ入る', () => {
    assert.equal(rc.releaseCheckReady(tracker(), []), true);
    assert.equal(rc.releaseCheckReady(tracker({ hitl: true }), []), false, '人間が持っている間は動かさない');
    assert.equal(rc.releaseCheckReady(tracker({ aiStatus: RELEASE_CHECK_AI_STATUS }), []), false, 'もう入っている');
    assert.equal(rc.releaseCheckReady(tracker({ labels: [] }), []), false, '未分解の EPIC');
    assert.equal(rc.releaseCheckReady(tracker({ subIssues: { total: 0, completed: 0 } }), []), false);
    assert.equal(rc.releaseCheckReady(tracker({ status: 'Close' }), []), false);
    assert.equal(rc.releaseCheckReady(tracker({ subIssues: { total: 3, completed: 2 } }), []), false);
});

test('releaseCheckReady: 残りが 🚀 after-release だけなら入る（ボードで数えられないものがあれば入らない）', () => {
    const t = tracker({ subIssues: { total: 3, completed: 2 } });
    const child = { issue: 11, parent: { number: 10 }, status: 'Backlog', labels: [rc.AFTER_RELEASE_LABEL] };
    assert.equal(rc.releaseCheckReady(t, [t, child]), true);
    assert.equal(rc.releaseCheckReady(t, [t, { ...child, labels: [] }]), false);
    assert.equal(rc.releaseCheckReady(t, [t, { ...child, parent: { number: 99 } }]), false);
    const t2 = tracker({ subIssues: { total: 4, completed: 2 } });
    assert.equal(rc.releaseCheckReady(t2, [t2, child]), false, 'もう 1 件はボードに無い');
});

test('selectReleaseCheckEntries: AI Status を Release Check にする意図（itemId が要る）', () => {
    const out = rc.selectReleaseCheckEntries([tracker(), tracker({ issue: 12, itemId: null })]);
    assert.deepEqual(out.map((x) => [x.item.issue, x.intents]), [[10, [{ field: 'AI Status', value: 'Release Check' }]]]);
});

test('releaseCheckMode: 目印付きの bot コメントだけで段を決める', () => {
    const c = (body, user = bot) => ({ id: Math.random(), body, user });
    assert.deepEqual(rc.releaseCheckMode([]), { mode: 'collect', round: 1 });
    const check1 = c(rc.releaseCheckMarker(1));
    assert.deepEqual(rc.releaseCheckMode([check1]), { mode: 'collect', round: 1 }, '結果を書かずに外した → 書き直す');
    const review1 = c(rc.releaseReviewMarker(1));
    assert.deepEqual(rc.releaseCheckMode([check1, review1]), { mode: 'result', round: 1 });
    const result1 = c(rc.releaseResultMarker(1));
    assert.deepEqual(rc.releaseCheckMode([check1, review1, result1]), { mode: 'collect', round: 2 });
    // 人間が目印をまねて書いたものは数えない
    assert.deepEqual(rc.releaseCheckMode([check1, c(rc.releaseReviewMarker(1), human)]), { mode: 'collect', round: 1 });
});

const CHECK_BODY = [
    rc.releaseCheckMarker(2),
    '## リリース確認（round 2）',
    '**プレビュー**: https://preview.smalruby.app/topic-japanese-mode-1731/',
    '',
    '### R1. 日本語モードに切りかえられる',
    'Ruby タブで「日本語」を押す → 行番号つきで表示されれば OK',
    '### R2: 例題を動かせる',
    '旗を押す → 出力が出れば OK',
    '## 参考',
    'ここは観点ではない',
].join('\n');

test('parseReleaseCheckPoints / releasePreviewUrl', () => {
    assert.deepEqual(rc.parseReleaseCheckPoints(CHECK_BODY), [
        { id: 'R1', title: '日本語モードに切りかえられる', body: 'Ruby タブで「日本語」を押す → 行番号つきで表示されれば OK' },
        { id: 'R2', title: '例題を動かせる', body: '旗を押す → 出力が出れば OK' },
    ]);
    assert.equal(rc.releasePreviewUrl(CHECK_BODY), 'https://preview.smalruby.app/topic-japanese-mode-1731/');
    assert.equal(rc.releasePreviewUrl('なし'), null);
});

test('releaseCheckView: いちばん新しい round と、結果を送ったか', () => {
    const comments = [
        { id: 1, body: rc.releaseCheckMarker(1), user: bot },
        { id: 2, body: CHECK_BODY, user: bot },
    ];
    const v = rc.releaseCheckView(comments);
    assert.equal(v.check.round, 2);
    assert.equal(v.check.id, 2);
    assert.equal(v.check.points.length, 2);
    assert.equal(v.reviewed, false);
    assert.equal(rc.releaseCheckView([...comments, { id: 3, body: rc.releaseReviewMarker(2), user: bot }]).reviewed, true);
    assert.deepEqual(rc.releaseCheckView([]), { check: null, reviewed: false });
});

test('normalizeReleaseReviewBody: 形を検証する', () => {
    const ok = rc.normalizeReleaseReviewBody({ issue: '10', round: 2, results: [{ id: 'R1', verdict: 'ng', note: ' 崩れる \r\n' }], comment: '' });
    assert.deepEqual(ok, { ok: true, issue: 10, round: 2, results: [{ id: 'R1', verdict: 'ng', note: '崩れる' }], comment: '' });
    assert.equal(rc.normalizeReleaseReviewBody({ issue: 10, round: 1 }).ok, false, '結果もコメントも無い');
    assert.equal(rc.normalizeReleaseReviewBody({ issue: 10, round: 1, comment: '全体に良い' }).ok, true);
    assert.equal(rc.normalizeReleaseReviewBody({ issue: 10, round: 1, results: [{ id: 'X1', verdict: 'ok' }] }).ok, false);
    assert.equal(rc.normalizeReleaseReviewBody({ issue: 10, round: 1, results: [{ id: 'R1', verdict: 'maybe' }] }).ok, false);
    assert.equal(rc.normalizeReleaseReviewBody({ issue: 10, round: 1, results: [{ id: 'R1', verdict: 'ok' }, { id: 'R1', verdict: 'ng' }] }).ok, false);
    assert.equal(rc.normalizeReleaseReviewBody({ issue: 10, round: 0, comment: 'x' }).ok, false);
    assert.equal(rc.normalizeReleaseReviewBody({ issue: 10, round: 1, comment: 'x'.repeat(rc.MAX_RELEASE_COMMENT + 1) }).ok, false);
});

test('renderReleaseReviewComment ↔ parseReleaseReview: `-->` を含むメモでも読み戻せる', () => {
    const results = [{ id: 'R1', verdict: 'ok', note: '' }, { id: 'R2', verdict: 'ng', note: '矢印 --> が出る\n2 行目 <b>' }];
    const body = rc.renderReleaseReviewComment({ round: 2, results, comment: 'ほか -- もある', login: 'takaokouji' });
    assert.match(body, /^<!-- autopilot-release-review round=2 -->/);
    assert.match(body, /`@takaokouji`/, '@ は通知が飛ぶのでコードにする');
    assert.match(body, /- \*\*R2\*\*: ❌ NG/);
    // データの HTML コメントは途中で閉じない
    const data = body.split('\n')[1];
    assert.equal(data.indexOf('-->'), data.length - 3);
    assert.deepEqual(rc.parseReleaseReview(body), { round: 2, results, comment: 'ほか -- もある' });
    assert.equal(rc.parseReleaseReview('ただのコメント'), null);
});

test('planReleaseReviewPost: 同じ round の結果は二重に書かない', () => {
    assert.deepEqual(rc.planReleaseReviewPost([], 1), { action: 'post' });
    assert.deepEqual(rc.planReleaseReviewPost([{ id: 5, body: rc.releaseReviewMarker(1), user: bot }], 1), { action: 'skip', existingId: 5 });
    assert.deepEqual(rc.planReleaseReviewPost([{ id: 5, body: rc.releaseReviewMarker(1), user: bot }], 2), { action: 'post' });
});

test('planReleaseResult: NG ごとに sub-issue（作ってあれば作らない）・全部 OK の判定', () => {
    const review = { results: [{ id: 'R1', verdict: 'ok', note: '' }, { id: 'R2', verdict: 'ng', note: '出力が出ない' }, { id: 'R3', verdict: 'ng', note: '' }], comment: '' };
    const points = rc.parseReleaseCheckPoints(CHECK_BODY);
    const plan = rc.planReleaseResult({ epic: 10, round: 2, review, points, existingBodies: [
        `${rc.releaseNgMarker({ epic: 10, round: 2, point: 'R3' })}\n本文`,
        rc.releaseNgMarker({ epic: 10, round: 1, point: 'R2' }), // 前の round のものは別
    ] });
    assert.deepEqual(plan.create, [{ point: 'R2', title: '例題を動かせる', note: '出力が出ない', marker: '<!-- autopilot-release-ng epic=10 round=2 point=R2 -->' }]);
    assert.deepEqual(plan.existing, ['R3']);
    assert.equal(plan.allOk, false);
    const allOk = rc.planReleaseResult({ epic: 10, round: 2, review: { results: [{ id: 'R1', verdict: 'ok' }], comment: '' } });
    assert.equal(allOk.allOk, true);
    const withComment = rc.planReleaseResult({ epic: 10, round: 2, review: { results: [{ id: 'R1', verdict: 'ok' }], comment: '色が気になる' } });
    assert.equal(withComment.allOk, false, '全体のコメントはプロンプトが読んで決める');
    assert.equal(withComment.comment, '色が気になる');
});

test('phases: Release Check は 🙋 を外したときだけ release-check へ進む', () => {
    const t = tracker({ aiStatus: RELEASE_CHECK_AI_STATUS, hitlLabel: true });
    assert.equal(phaseForItem(t, {}), null);
    assert.equal(phaseForItem({ ...t, hitlLabel: false }, {}), 'release-check');
    assert.equal(phaseForItem(t, { monitorReleased: true }), 'release-check');
    assert.equal(phaseForItem({ ...t, aiStatus: 'EPIC Decomposed', hitlLabel: false }, {}), null, 'EPIC Decomposed のトラッカーは従来どおり');
    assert.equal(isStuckCandidate({ ...t, hitlLabel: false }), false, 'dispatch 前に Blocked にしない');
    assert.equal(humanWaitReason(t), 'release');
    const p = planDelegate({ ...t, hitl: true }, {});
    assert.equal(p.ok, true);
    assert.equal(p.nextPhase, 'release-check');
    assert.equal(planDelegate(tracker({ hitl: true }), {}).code, 'tracker', 'EPIC Decomposed は従来どおり受けない');
});
