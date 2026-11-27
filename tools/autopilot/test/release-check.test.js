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
    // 分解済みの EPIC は 🙋 を付けたままにする決まり（human-wait.md）。🙋 ありで入ると人間の番（#16c）になる
    assert.equal(rc.releaseCheckReady(tracker({ hitl: true }), []), true, '🙋 ありの EPIC も入る');
    assert.equal(rc.releaseCheckReady(tracker({ hitlLabel: true }), []), true);
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
    assert.deepEqual(ok, { ok: true, issue: 10, round: 2, results: [{ id: 'R1', verdict: 'ng', note: '崩れる' }], comment: '', decisions: [], source: 'monitor' });
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

test('releaseCheckReady: 親 EPIC を autopilot-after で待つ子は、ラベルが無くてもリリース後の作業とみなす（#2459）', () => {
    const t = tracker({ subIssues: { total: 3, completed: 2 } });
    const child = { issue: 11, parent: { number: 10 }, status: 'Sprint Backlog', labels: [] };
    // 本文のキャッシュ（daemon の state.directives）だけで見る。無ければ数えない（追加の read はしない）
    assert.equal(rc.releaseCheckReady(t, [t, child]), false);
    assert.equal(rc.releaseCheckReady(t, [t, child], { afterOf: (n) => (n === 11 ? [10] : null) }), true);
    assert.equal(rc.releaseCheckReady(t, [t, child], { afterOf: (n) => (n === 11 ? [12] : null) }), false, 'ほかを待つ子は数えない');
    assert.equal(rc.isAfterReleaseItem(child, { trackerIssue: 10, afterOf: () => [10] }), true);
    assert.equal(rc.isAfterReleaseItem(child), false);
    const out = rc.selectReleaseCheckEntries([t, child], { afterOf: () => [10] });
    assert.deepEqual(out.map((x) => x.item.issue), [10]);
});

// PR #2206 と同じ形: topic → develop の draft PR に、人間が Request changes と行コメントを書いた
const prReviews = [
    { id: 6073229022, user: human, state: 'CHANGES_REQUESTED', body: '冒頭の説明文を常体にしてください', html_url: 'https://github.com/o/r/pull/2206#pullrequestreview-6073229022' },
    { id: 7001, user: human, state: 'APPROVED', body: '' }, // 本文の無い承認は直してほしいことではない
    { id: 7002, user: bot, state: 'COMMENTED', body: '<!-- autopilot-review-findings round=1 -->' },
    { id: 7003, user: human, state: 'PENDING', body: '下書き' },
    { id: 7004, user: human, state: 'DISMISSED', body: '取り下げた' },
];
const prReviewComments = [
    { id: 8001, user: human, body: 'ここは「，」にそろえる', path: 'docs/dncl/policy.md', line: 12, pull_request_review_id: 6073229022 },
    { id: 8002, user: { login: 'github-actions[bot]', type: 'Bot' }, body: 'lint' },
];
const prIssueComments = [
    { id: 9001, user: human, body: 'プレビューの色が薄い' },
    { id: 9002, user: bot, body: 'Preview: https://preview.smalruby.app/topic-x/' },
];

test('selectPrFeedback: 人間のレビュー・行コメント・PR のコメントだけを、まだ受けていないものから選ぶ（#2459）', () => {
    const all = rc.selectPrFeedback({ reviews: prReviews, reviewComments: prReviewComments, issueComments: prIssueComments });
    assert.deepEqual(all.map((f) => f.ref), ['review-6073229022', 'review-comment-8001', 'comment-9001']);
    assert.equal(all[0].state, 'CHANGES_REQUESTED');
    assert.equal(all[0].author, 'someone');
    assert.deepEqual([all[1].path, all[1].line], ['docs/dncl/policy.md', 12]);
    const rest = rc.selectPrFeedback({
        reviews: prReviews, reviewComments: prReviewComments, issueComments: prIssueComments,
        handled: new Set(['review-6073229022', 'comment-9001']),
    });
    assert.deepEqual(rest.map((f) => f.ref), ['review-comment-8001']);
});

test('handledPrFeedbackRefs: sub-issue の本文と、トラッカーの bot の結果のコメントの目印から集める（二重に作らない）', () => {
    const bodies = [
        `${rc.releasePrMarker({ epic: 10, ref: 'review-6073229022' })}\n${rc.releasePrMarker({ epic: 10, ref: 'review-comment-8001' })}\n本文`,
        rc.releasePrMarker({ epic: 99, ref: 'comment-1' }), // ほかの EPIC のもの
    ];
    const comments = [
        { id: 1, user: bot, body: `${rc.releaseResultMarker(1)}\n${rc.releasePrSeenMarker(['comment-9001'])}` },
        { id: 2, user: human, body: rc.releasePrSeenMarker(['comment-5']) }, // 人間がまねたものは数えない
    ];
    const handled = rc.handledPrFeedbackRefs({ epic: 10, existingBodies: bodies, comments });
    assert.deepEqual([...handled].sort(), ['comment-9001', 'review-6073229022', 'review-comment-8001']);
    const rest = rc.selectPrFeedback({ reviews: prReviews, reviewComments: prReviewComments, issueComments: prIssueComments, handled });
    assert.deepEqual(rest, []);
    assert.equal(rc.releasePrSeenMarker([]), '');
});

test('releaseCheckMode: topic → develop の PR にまだ受けていない人間のレビューがあれば、結果を受ける段にする（#2459）', () => {
    const c = (body) => ({ id: Math.random(), body, user: bot });
    const check1 = c(rc.releaseCheckMarker(1));
    assert.deepEqual(rc.releaseCheckMode([check1], { pendingPrFeedback: 2 }), { mode: 'result', round: 1, prOnly: true });
    assert.deepEqual(rc.releaseCheckMode([check1], { pendingPrFeedback: 0 }), { mode: 'collect', round: 1 });
    // モニターの結果もあれば、その round で両方を受ける
    const review1 = c(rc.releaseReviewMarker(1));
    assert.deepEqual(rc.releaseCheckMode([check1, review1], { pendingPrFeedback: 1 }), { mode: 'result', round: 1 });
    // 受けた後に人間が新しいレビューを書いた → 受けた round を読み直さず、PR のレビューだけを受けて次の round へ
    const result1 = c(rc.releaseResultMarker(1));
    assert.deepEqual(rc.releaseCheckMode([check1, review1, result1], { pendingPrFeedback: 1 }), { mode: 'result', round: 2, prOnly: true });
    // 観点をまとめる前でも受ける
    assert.deepEqual(rc.releaseCheckMode([], { pendingPrFeedback: 1 }), { mode: 'result', round: 1, prOnly: true });
    // PR のレビューだけを受けた段は結果の目印を書かない（seen の目印だけ）。あとで人間がその round の
    // モニターの結果を書いても取りこぼさない
    const seen = c(rc.releasePrSeenMarker(['comment-9001']));
    assert.deepEqual(rc.releaseCheckMode([check1, seen, review1]), { mode: 'result', round: 1 });
});

test('planReleaseResult: PR のレビューも直してほしいことの候補として返す（#2459）', () => {
    const pr = rc.selectPrFeedback({ reviews: prReviews, reviewComments: prReviewComments, issueComments: prIssueComments });
    const plan = rc.planReleaseResult({ epic: 10, round: 1, review: null, prFeedback: pr });
    assert.equal(plan.allOk, false);
    assert.deepEqual(plan.prFeedback.map((f) => [f.ref, f.marker]), [
        ['review-6073229022', '<!-- autopilot-release-pr epic=10 ref=review-6073229022 -->'],
        ['review-comment-8001', '<!-- autopilot-release-pr epic=10 ref=review-comment-8001 -->'],
        ['comment-9001', '<!-- autopilot-release-pr epic=10 ref=comment-9001 -->'],
    ]);
    assert.deepEqual(plan.create, []);
    const none = rc.planReleaseResult({ epic: 10, round: 1, review: { results: [{ id: 'R1', verdict: 'ok' }], comment: '' }, prFeedback: [] });
    assert.equal(none.allOk, true);
    assert.deepEqual(none.prFeedback, []);
});

test('normalizeReleaseReviewBody: 決定待ちの答えと出どころ（確認ページ・#2474）', () => {
    const ok = rc.normalizeReleaseReviewBody({
        issue: 10, round: 1, source: 'page', decisions: [
            { id: 'D1', title: ' 行番号の形 ', choice: 'recommended' },
            { id: 'D2', choice: 'alternative', alternative: '案 B', note: '' },
            { id: 'D3', choice: 'comment', note: 'あとで決めたい' },
        ],
    });
    assert.equal(ok.ok, true, '決定待ちの答えだけでも送れる');
    assert.equal(ok.source, 'page');
    assert.deepEqual(ok.decisions, [
        { id: 'D1', title: '行番号の形', choice: 'recommended', alternative: '', note: '' },
        { id: 'D2', title: '', choice: 'alternative', alternative: '案 B', note: '' },
        { id: 'D3', title: '', choice: 'comment', alternative: '', note: 'あとで決めたい' },
    ]);
    const bad = (decisions, extra = {}) => rc.normalizeReleaseReviewBody({ issue: 10, round: 1, decisions, ...extra }).ok;
    assert.equal(bad([{ id: 'X1', choice: 'recommended' }]), false);
    assert.equal(bad([{ id: 'D1', choice: 'maybe' }]), false);
    assert.equal(bad([{ id: 'D1', choice: 'recommended' }, { id: 'D1', choice: 'comment', note: 'x' }]), false);
    assert.equal(bad([{ id: 'D1', choice: 'alternative' }]), false, '別の案は案かメモが要る');
    assert.equal(bad([{ id: 'D1', choice: 'comment' }]), false, 'コメントはメモが要る');
    assert.equal(bad([{ id: 'D1', choice: 'comment', note: 3 }]), false);
    assert.equal(bad('D1'), false);
    assert.equal(bad([{ id: 'D1', choice: 'recommended' }], { source: 'mail' }), false);
});

test('renderReleaseReviewComment ↔ parseReleaseReview: 確認ページの答え（決定待ちを含む・#2474）', () => {
    const decisions = [
        { id: 'D1', title: '行番号', choice: 'recommended', alternative: '', note: '' },
        { id: 'D2', title: '罫線 --> の文字', choice: 'alternative', alternative: '案 B', note: '見やすい' },
    ];
    const body = rc.renderReleaseReviewComment({ round: 1, results: [], comment: '', decisions, source: 'page' });
    assert.match(body, /📄 確認ページから 人間 の/);
    assert.match(body, /- \*\*D2\*\* 罫線 --> の文字: 🔀 別の案/);
    assert.match(body, /  > 案: 案 B/);
    const data = body.split('\n')[1];
    assert.equal(data.indexOf('-->'), data.length - 3);
    assert.deepEqual(rc.parseReleaseReview(body), { round: 1, results: [], comment: '', decisions });
    // 決定待ちが無いときは今までと同じ形
    assert.doesNotMatch(rc.renderReleaseReviewComment({ round: 1, results: [], comment: 'x' }), /決定待ち/);
});

test('planReleaseResult: 推奨でよい以外の決定待ちは直しの候補（作ってあれば made）', () => {
    const review = {
        results: [{ id: 'R1', verdict: 'ok' }], comment: '', decisions: [
            { id: 'D1', title: 'a', choice: 'recommended' },
            { id: 'D2', title: 'b', choice: 'alternative', alternative: '案 B', note: '' },
            { id: 'D3', title: 'c', choice: 'comment', alternative: '', note: '気になる' },
        ],
    };
    const plan = rc.planReleaseResult({ epic: 10, round: 1, review, existingBodies: [rc.releaseNgMarker({ epic: 10, round: 1, point: 'D3' })] });
    assert.equal(plan.allOk, false);
    assert.deepEqual(plan.decisions.map((d) => [d.point, d.choice, d.made]), [['D2', 'alternative', false], ['D3', 'comment', true]]);
    assert.equal(plan.decisions[0].marker, '<!-- autopilot-release-ng epic=10 round=1 point=D2 -->');
    const allRec = rc.planReleaseResult({ epic: 10, round: 1, review: { results: [], comment: '', decisions: [review.decisions[0]] } });
    assert.equal(allRec.allOk, true, '全部 推奨でよい なら全部 OK');
});
