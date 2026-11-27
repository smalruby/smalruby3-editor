'use strict';
/**
 * release-merge.test.js — リリース確認が全部 OK の EPIC を、モニターから develop へマージする（#2544）。
 * 判断（release-merge.js / human-action.js）と I/O（release-check-http.js）。I/O は deps で差し替え、実 GitHub に触らない。
 */
const { test } = require('node:test');
const assert = require('node:assert');
const rc = require('../src/release-check');
const rm = require('../src/release-merge');
const { developMergeWindow, humanAction, forYouModel } = require('../src/human-action');
const {
    releaseMergeOnce, applyReleaseMergedEpics, rememberReleaseMerge, releaseMergeOf,
} = require('../src/release-check-http');
const { TRACKING_LABEL, HITL_LABEL } = require('../src/phases');

const HEAD = 'abc1234def5678abc1234def5678abc1234def56';
/** 日本時間の時刻（ms epoch）。2026-11-23 は月曜、11-28 は土曜 */
const jst = (d, h, m = 0) => Date.UTC(2026, 10, d, h - 9, m);
const LUNCH = jst(25, 13, 0);

const c = (body) => ({ body });
const check = (n) => c(`${rc.releaseCheckMarker(n)}\n### R1. 開ける`);
const review = (n) => c(rc.renderReleaseReviewComment({ round: n, results: [{ id: 'R1', verdict: 'ok', note: '' }], comment: '' }));
const allOk = (n, pr = 2479, head = HEAD) => c(`${rc.releaseResultMarker(n, { allOk: true, pr, head })}\n全部 OK`);
const ngResult = (n) => c(`${rc.releaseResultMarker(n)}\nNG から #1 を作りました`);
const okComments = () => [check(1), review(1), allOk(1)];

const prFacts = (over = {}) => ({
    number: 2479, state: 'OPEN', isDraft: true, baseRefName: 'develop', headRefOid: HEAD, mergeable: 'MERGEABLE',
    statusCheckRollup: [{ __typename: 'CheckRun', name: 'test', status: 'COMPLETED', conclusion: 'SUCCESS' }],
    files: [{ path: 'packages/scratch-gui/src/lib/foo.js' }], ...over,
});

test('releaseResultMarker / parseReleaseResultMarker: 全部 OK の印・PR・head の SHA を読み戻す', () => {
    const s = rc.releaseResultMarker(2, { allOk: true, pr: 2479, head: HEAD.toUpperCase() });
    assert.equal(s, `<!-- autopilot-release-result round=2 allOk=1 pr=2479 head=${HEAD} -->`);
    assert.deepEqual(rc.parseReleaseResultMarker(s), { round: 2, allOk: true, pr: 2479, head: HEAD });
    // 今までの形（NG のとき）はそのまま
    assert.equal(rc.releaseResultMarker(3), '<!-- autopilot-release-result round=3 -->');
    assert.deepEqual(rc.parseReleaseResultMarker(rc.releaseResultMarker(3)), { round: 3, allOk: false, pr: null, head: null });
    // 印が付いても段の判断（releaseCheckMode）は round を読む
    assert.deepEqual(rc.releaseCheckMode([check(2), review(2), c(s)]), { mode: 'collect', round: 3 });
});

test('releaseMergeReadiness: 全部 OK の round のあとだけ ready', () => {
    assert.deepEqual(rm.releaseMergeReadiness({ comments: okComments(), prFeedback: [] }),
        { ready: true, round: 1, pr: 2479, head: HEAD });
    assert.equal(rm.releaseMergeReadiness({ comments: [check(1)] }).code, 'no-result');
    // NG がある（全部 OK の印が無い）
    assert.equal(rm.releaseMergeReadiness({ comments: [check(1), review(1), ngResult(1)] }).code, 'not-all-ok');
    // 全部 OK のあとに新しい round の観点・結果
    assert.equal(rm.releaseMergeReadiness({ comments: [...okComments(), check(2)] }).code, 'new-round');
    assert.equal(rm.releaseMergeReadiness({ comments: [...okComments(), review(2)] }).code, 'new-round');
    // PR にまだ受けていないレビュー・コメント
    assert.equal(rm.releaseMergeReadiness({ comments: okComments(), prFeedback: [{ ref: 'review-1' }] }).code, 'pr-feedback');
    // head の SHA が無い古い形
    assert.equal(rm.releaseMergeReadiness({ comments: [check(1), review(1), c(rc.releaseResultMarker(1, { allOk: true, pr: 5 }))] }).code, 'no-head');
    // 人間が目印をまねて書いたコメントは数えない（bot のものだけ）
    const fake = { body: allOk(1).body, user: { login: 'someone', type: 'User' } };
    assert.equal(rm.releaseMergeReadiness({ comments: [check(1), review(1), fake] }).code, 'no-result');
});

test('planReleaseMerge: 通るときは draft を外す → マージ → Close の順', () => {
    const readiness = rm.releaseMergeReadiness({ comments: okComments(), prFeedback: [] });
    const plan = rm.planReleaseMerge({ readiness, pr: prFacts(), nowMs: LUNCH, epic: 2438 });
    assert.equal(plan.action, 'merge');
    assert.deepEqual(plan.steps, ['ready', 'merge', 'close']);
    assert.equal(plan.pr, 2479);
    assert.match(plan.reason, /PR #2479 の draft を外して develop へマージし、EPIC #2438 を Close にする/);
    // draft でなければ外す段は無い
    assert.deepEqual(rm.planReleaseMerge({ readiness, pr: prFacts({ isDraft: false }), nowMs: LUNCH, epic: 2438 }).steps, ['merge', 'close']);
});

test('planReleaseMerge: CI・コンフリクト・SHA 違い・権限外・メッシュ・PR の状態で断る', () => {
    const readiness = rm.releaseMergeReadiness({ comments: okComments(), prFeedback: [] });
    const code = (pr, nowMs = LUNCH) => rm.planReleaseMerge({ readiness, pr, nowMs, epic: 2438 }).code;
    assert.equal(code(prFacts({ statusCheckRollup: [{ __typename: 'CheckRun', status: 'COMPLETED', conclusion: 'FAILURE' }] })), 'ci-failed');
    assert.equal(code(prFacts({ statusCheckRollup: [{ __typename: 'CheckRun', status: 'IN_PROGRESS' }] })), 'ci-pending');
    assert.equal(code(prFacts({ statusCheckRollup: [] })), 'no-ci');
    assert.equal(code(prFacts({ mergeable: 'CONFLICTING' })), 'conflict');
    assert.equal(code(prFacts({ mergeable: 'UNKNOWN' })), 'mergeable-unknown');
    assert.equal(code(prFacts({ headRefOid: 'ffff' + HEAD.slice(4) })), 'head-changed');
    assert.equal(code(prFacts({ state: 'MERGED' })), 'pr-not-open');
    assert.equal(code(prFacts({ number: 1 })), 'pr-mismatch');
    assert.equal(code(prFacts({ baseRefName: 'main' })), 'not-develop');
    assert.equal(code(null), 'no-pr');
    assert.equal(code(prFacts({ files: ['.github/workflows/ci-cd.yml'] })), 'protected');
    const mesh = prFacts({ files: [{ path: 'packages/scratch-vm/src/extensions/scratch3_mesh_v2/index.js' }] });
    assert.equal(code(mesh), 'mesh-daytime', '平日の昼はメッシュを確かめても通さない');
    assert.equal(rm.planReleaseMerge({ readiness, pr: mesh, nowMs: jst(28, 11), epic: 1 }).action, 'merge', '土日は通る');
    // ready でなければ理由をそのまま返す
    assert.equal(rm.planReleaseMerge({ readiness: { ready: false, code: 'pr-feedback' }, pr: prFacts(), nowMs: LUNCH }).code, 'pr-feedback');
    for (const k of Object.keys(rm.REFUSE_TEXT)) assert.ok(rm.REFUSE_TEXT[k].length > 5, k);
});

test('planReleaseMerge: 時間の外は確かめを求め、確かめたら通す', () => {
    const readiness = rm.releaseMergeReadiness({ comments: okComments(), prFeedback: [] });
    const p = rm.planReleaseMerge({ readiness, pr: prFacts(), nowMs: jst(25, 10), epic: 1 });
    assert.equal(p.action, 'confirm');
    assert.equal(p.code, 'off-hours');
    assert.match(p.reason, /いまは平日のマージの時間の外です/);
    assert.equal(rm.planReleaseMerge({ readiness, pr: prFacts(), nowMs: jst(25, 10), epic: 1, confirmOffHours: true }).action, 'merge');
});

test('developMergeWindow: 平日の 12:50〜13:15 と土日は時間の中。16:15 以降は予備として確かめる', () => {
    assert.equal(developMergeWindow(jst(25, 12, 50)).inWindow, true);
    assert.equal(developMergeWindow(jst(25, 13, 15)).inWindow, true);
    assert.equal(developMergeWindow(jst(25, 13, 16)).inWindow, false);
    assert.equal(developMergeWindow(jst(25, 12, 49)).inWindow, false);
    const late = developMergeWindow(jst(27, 16, 30));
    assert.equal(late.inWindow, false);
    assert.match(late.note, /予備の時間/);
    assert.equal(late.weekdayDaytime, true);
    assert.equal(developMergeWindow(jst(27, 20)).weekdayDaytime, false, '平日の夜はメッシュも通る');
    assert.deepEqual(developMergeWindow(jst(29, 10)), { inWindow: true, weekdayDaytime: false, note: '' });
    // 日本時間の月曜 0 時台（UTC では日曜）も平日として見る
    assert.equal(developMergeWindow(jst(23, 0, 30)).inWindow, false);
});

const epicItem = (over = {}) => ({
    issue: 2438, title: 'EPIC: grading', kind: 'EPIC', tracker: true, status: 'In Progress', aiStatus: 'Release Check', hitl: true,
    labels: [TRACKING_LABEL, HITL_LABEL], subIssues: { total: 3, completed: 3 }, releasePageUrl: 'https://claude.ai/artifact/x', ...over,
});

test('humanAction: 全部 OK の EPIC だけ主ボタンが「develop へマージする」になる', () => {
    const a = humanAction(epicItem({ releaseMerge: { pr: 2479, round: 2, head: HEAD } }), { now: LUNCH });
    assert.equal(a.button, 'develop へマージする');
    assert.equal(a.act, 'merge-epic');
    assert.equal(a.epicPhase, 'final-check');
    assert.deepEqual(a.targets, [2438]);
    assert.equal(a.url, 'https://claude.ai/artifact/x', '確認ページへのリンクは残す（⋯）');
    assert.equal(a.happens, 'topic → develop の PR #2479 の draft を外して develop へマージし、EPIC #2438 を Close にする');
    assert.match(a.state, /全部 OK（round 2）/);
    // 時間の外は確かめ（押すと:）に出す
    assert.match(humanAction(epicItem({ releaseMerge: { pr: 2479 } }), { now: jst(25, 10) }).happens, /⚠️ いまは平日のマージの時間の外です/);
    // 全部 OK の材料が無ければ今までどおり確認ページ
    assert.equal(humanAction(epicItem(), { now: LUNCH }).button, '確認ページを開く');
    // 🙋 が外れて AI が結果を受けているあいだは出さない
    assert.equal(humanAction(epicItem({ hitl: false, releaseMerge: { pr: 2479 } }), {}).button === 'develop へマージする', false);
    // forYouModel でも「確かめる」の欄に出る
    const fy = forYouModel({ items: [epicItem({ releaseMerge: { pr: 2479 } })] }, { now: LUNCH });
    assert.equal(fy.sections[0].kind, 'check');
    assert.equal(fy.sections[0].rows[0].act, 'merge-epic');
});

test('releaseMergeCandidate / rememberReleaseMerge: 全部 OK の結果のときだけ材料を覚え、ほかの結果で消す', () => {
    const ok = { signal: 'done', hitl: true, allOk: true, pr: 2479, headSha: HEAD, round: 2 };
    assert.deepEqual(rm.releaseMergeCandidate(ok), { round: 2, pr: 2479, head: HEAD });
    assert.equal(rm.releaseMergeCandidate({ ...ok, allOk: false }), null);
    assert.equal(rm.releaseMergeCandidate({ ...ok, hitl: false }), null);
    assert.equal(rm.releaseMergeCandidate({ ...ok, headSha: 'not-a-sha' }), null);
    const writes = [];
    const deps = { env: { AUTOPILOT_STATE_DIR: '/x' }, writeFileSync: (f, s) => writes.push([f, JSON.parse(s)]), mkdirSync: () => {} };
    const item = { issue: 2438, aiStatus: 'Release Check', hitlLabel: true };
    const state = { board: { items: [{ issue: 2438 }] } };
    assert.equal(rememberReleaseMerge(state, 2438, ok, () => {}, deps), true);
    assert.deepEqual(state.board.items[0].releaseMerge, { round: 2, pr: 2479, head: HEAD });
    assert.deepEqual(releaseMergeOf(state, item), { round: 2, pr: 2479, head: HEAD });
    assert.equal(releaseMergeOf(state, { ...item, hitlLabel: false }), null, '🙋 が無いときは出さない');
    assert.equal(rememberReleaseMerge(state, 2438, ok, () => {}, deps), false, '同じなら書かない');
    assert.equal(rememberReleaseMerge(state, 2438, { signal: 'done', hitl: false }, () => {}, deps), true);
    assert.equal(releaseMergeOf(state, item), null);
    assert.equal(writes.length, 2);
    assert.match(writes[0][0], /release-check-merges\.json$/);
});

/** releaseMergeOnce の I/O をまとめて差し替える（呼ばれた順を記録する） */
function mergeDeps(over = {}) {
    const calls = [];
    const deps = {
        readToken: async () => 'r', botToken: async () => 'b',
        listIssueComments: async () => okComments(),
        listPrFeedbackSources: async () => ({ reviews: [], reviewComments: [], issueComments: [] }),
        listSubIssueBodies: async () => [],
        getEpicMergeFacts: async () => prFacts(),
        markPrReady: async (repo, pr) => calls.push(['ready', pr]),
        mergePr: async (repo, pr) => calls.push(['merge', pr]),
        applyIntents: async (ctx, itemId, intents) => calls.push(['intents', itemId, intents]),
        editLabels: async (repo, n, type, diff) => calls.push(['labels', n, diff]),
        closeIssue: async (repo, n) => calls.push(['close', n]),
        writeFileSync: () => {}, mkdirSync: () => {},
        ...over,
    };
    return { deps, calls };
}
const cfg = { repo: 'o/r', projectId: 'P', fields: {} };
const ctxFor = (item, now = LUNCH) => ({
    cfg, log: () => {}, now: () => now,
    state: { running: new Map(), board: { items: [item] }, releaseMerges: { 2438: { pr: 2479, head: HEAD, round: 1 } } },
});

test('releaseMergeOnce: 確かめてから draft を外す → マージ → Close・🙋 を外す・Issue を閉じる', async () => {
    const item = epicItem({ itemId: 'PVTI_1' });
    const ctx = ctxFor(item);
    const { deps, calls } = mergeDeps();
    const r = await releaseMergeOnce(ctx, '2438', {}, deps);
    assert.equal(r.status, 200);
    assert.deepEqual(r.body, { ok: true, issue: 2438, pr: 2479, closed: true, failed: [] });
    assert.deepEqual(calls.map((x) => x[0]), ['ready', 'merge', 'intents', 'labels', 'close']);
    assert.deepEqual(calls[2][2], [{ field: 'Status', value: 'Close' }, { field: 'AI Status', value: null }]);
    assert.deepEqual(calls[3][2], { remove: [HITL_LABEL] });
    assert.equal(item.status, 'Close');
    assert.equal(ctx.state.releaseMerges[2438], undefined, '材料を消す');
});

test('releaseMergeOnce: 断るとき・時間の外・二重押し・Bot で通らないとき', async () => {
    // まだ受けていない PR のレビューがある → 409 で何も書かない
    let m = mergeDeps({
        listPrFeedbackSources: async () => ({ reviews: [{ id: 9, state: 'COMMENTED', body: '直して', user: { login: 'h', type: 'User' } }], reviewComments: [], issueComments: [] }),
    });
    let r = await releaseMergeOnce(ctxFor(epicItem({ itemId: 'I' })), 2438, {}, m.deps);
    assert.equal(r.status, 409);
    assert.equal(r.body.code, 'pr-feedback');
    assert.deepEqual(m.calls, []);
    // 時間の外は確かめを求め、confirmOffHours で通す
    m = mergeDeps();
    r = await releaseMergeOnce(ctxFor(epicItem({ itemId: 'I' }), jst(25, 10)), 2438, {}, m.deps);
    assert.equal(r.status, 409);
    assert.equal(r.body.code, 'off-hours');
    assert.equal(r.body.confirm, true);
    r = await releaseMergeOnce(ctxFor(epicItem({ itemId: 'I' }), jst(25, 10)), 2438, { confirmOffHours: true }, m.deps);
    assert.equal(r.status, 200);
    // worker が同じ EPIC を扱っている
    const busy = ctxFor(epicItem({ itemId: 'I' }));
    busy.state.running.set(2438, {});
    assert.equal((await releaseMergeOnce(busy, 2438, {}, mergeDeps().deps)).body.code, 'busy');
    // Release Check の 🙋 待ちでない
    assert.equal((await releaseMergeOnce(ctxFor(epicItem({ hitl: false })), 2438, {}, mergeDeps().deps)).body.code, 'not-release-check');
    // 二重押し: 1 回目の最中の 2 回目は断る
    let release;
    m = mergeDeps({ listIssueComments: () => new Promise((res) => { release = () => res(okComments()); }) });
    const ctx = ctxFor(epicItem({ itemId: 'I' }));
    const first = releaseMergeOnce(ctx, 2438, {}, m.deps);
    const second = await releaseMergeOnce(ctx, 2438, {}, m.deps);
    assert.equal(second.body.code, 'in-flight');
    release();
    assert.equal((await first).status, 200);
    // Bot の権限で通らない → 理由を返して GitHub でのマージを頼む。EPIC は閉じない
    m = mergeDeps({ mergePr: async () => { throw new Error('Resource not accessible by integration token=ghs_abcdefghijklmnopqrstuvwxyz0123456789'); } });
    r = await releaseMergeOnce(ctxFor(epicItem({ itemId: 'I', isDraft: false })), 2438, {}, m.deps);
    assert.equal(r.status, 502);
    assert.match(r.body.error, /GitHub でマージしてください/);
    assert.ok(!r.body.error.includes('ghs_abcdefghijklmnopqrstuvwxyz0123456789'), 'エラーはサニタイズする');
    assert.ok(!m.calls.some((x) => x[0] === 'close'));
});

test('applyReleaseMergedEpics: 人間が GitHub で topic → develop の PR をマージしたら EPIC を閉じる', async () => {
    const tracker = epicItem({ itemId: 'PVTI_T' });
    const kid = { issue: 2440, parent: { number: 2438 }, status: 'Close' };
    const other = epicItem({ issue: 5, itemId: 'PVTI_5' });
    const state = { board: { items: [tracker, kid, other] }, directives: new Map([[2440, { base: 'topic/classroom-grading-feedback', after: [] }]]) };
    const asked = [];
    const { deps, calls } = mergeDeps({
        findMergedTopicPr: async (repo, topic, base) => { asked.push([topic, base]); return 2479; },
    });
    const done = await applyReleaseMergedEpics(state.board.items, cfg, state, () => {}, deps);
    assert.deepEqual(done, [2438]);
    assert.deepEqual(asked, [['topic/classroom-grading-feedback', 'develop']], 'topic が分からない EPIC は読まない');
    assert.deepEqual(calls.map((x) => x[0]), ['intents', 'labels', 'close']);
    // merged の PR が無ければ何もしない
    const none = mergeDeps({ findMergedTopicPr: async () => null, botToken: async () => { throw new Error('no'); } });
    const tracker2 = epicItem({ itemId: 'PVTI_T' });
    assert.deepEqual(await applyReleaseMergedEpics([tracker2, kid], cfg, { directives: state.directives }, () => {}, none.deps), []);
    // topic が分からなくても、全部 OK の材料の PR が merged なら閉じる
    const byCand = mergeDeps({ getEpicMergeFacts: async () => prFacts({ state: 'MERGED' }) });
    assert.deepEqual(await applyReleaseMergedEpics([epicItem({ itemId: 'X' })], cfg,
        { releaseMerges: { 2438: { pr: 2479, head: HEAD } } }, () => {}, byCand.deps), [2438]);
});

test('selectMergedReleaseEpics / epicTopicBranch', () => {
    const items = [epicItem({ itemId: 'A' }), epicItem({ issue: 7, itemId: 'B', aiStatus: 'EPIC Decomposed' }), epicItem({ issue: 8, itemId: 'C', status: 'Close' })];
    assert.deepEqual(rm.selectMergedReleaseEpics(items, { 2438: 1, 7: 2, 8: 3 }).map((x) => x.item.issue), [2438]);
    const kids = [{ issue: 1, parent: { number: 9 } }, { issue: 2, parent: { number: 9 } }, { issue: 3, parent: { number: 9 } }, { issue: 4, parent: { number: 8 } }];
    const base = { 1: 'topic/a', 2: 'topic/a', 3: 'develop', 4: 'topic/b' };
    assert.equal(rm.epicTopicBranch(9, kids, (n) => base[n]), 'topic/a');
    assert.equal(rm.epicTopicBranch(10, kids, (n) => base[n]), null);
});
