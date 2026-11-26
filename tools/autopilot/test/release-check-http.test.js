'use strict';
/**
 * release-check-http.test.js — リリース確認（#2430）の I/O。deps を差し替え、実 GitHub に触らない。
 */
const { test } = require('node:test');
const assert = require('node:assert');
const {
    applyReleaseCheckEntries, releaseCheckViewOnce, releaseReviewOnce, rememberPreview,
    loadReleasePages, releasePageEnv, rememberReleasePage, postReleasePageAnswer,
} = require('../src/release-check-http');
const { refreshBoardAndProjectTrackers } = require('../src/daemon');
const rc = require('../src/release-check');
const { TRACKING_LABEL } = require('../src/phases');

const bot = { login: 'smalruby3-editor-bot[bot]', type: 'Bot' };
const cfg = { repo: 'o/r', projectId: 'P', fields: {}, assignee: 'takaokouji' };
const CHECK = [rc.releaseCheckMarker(1), '**プレビュー**: https://preview.smalruby.app/topic-x/', '### R1. 開ける', '開けば OK'].join('\n');
const trackerItem = (over = {}) => ({
    issue: 10, itemId: 'PVTI_10', labels: [TRACKING_LABEL], kind: 'EPIC', status: 'In Progress',
    aiStatus: 'Release Check', hitl: true, subIssues: { total: 1, completed: 1 }, ...over,
});

test('applyReleaseCheckEntries: 子が全部済んだトラッカーの AI Status を書き、1 件の失敗はほかを止めない', async () => {
    const items = [
        trackerItem({ issue: 1, itemId: 'A', aiStatus: 'EPIC Decomposed', hitl: false }),
        trackerItem({ issue: 2, itemId: 'B', aiStatus: 'EPIC Decomposed', hitl: false }),
        trackerItem({ issue: 3, itemId: 'C', aiStatus: 'EPIC Decomposed', hitl: false, subIssues: { total: 2, completed: 1 } }),
    ];
    const written = [];
    const done = await applyReleaseCheckEntries(items, cfg, {}, () => {}, {
        botToken: async () => 't',
        applyIntents: async (ctx, itemId, intents) => {
            if (itemId === 'A') throw new Error('boom');
            written.push([itemId, intents]);
        },
    });
    assert.deepEqual(done, [2]);
    assert.deepEqual(written, [['B', [{ field: 'AI Status', value: 'Release Check' }]]]);
    assert.equal(items[1].aiStatus, 'Release Check', 'board のキャッシュも追従する');
});

test('applyReleaseCheckEntries: 対象が無ければトークンも取らない', async () => {
    const done = await applyReleaseCheckEntries([trackerItem()], cfg, {}, () => {}, {
        botToken: async () => { throw new Error('should not be called'); },
    });
    assert.deepEqual(done, []);
});

test('refreshBoardAndProjectTrackers: ボードの再取得のあとにリリース確認へ入れる', async () => {
    const state = { running: new Map() };
    const written = [];
    await refreshBoardAndProjectTrackers({ ...cfg, owner: 'o', project: 4, now: () => 0, statusOrder: [] }, state, () => {}, {
        token: 't',
        noTickAfterEntry: true,
        listItems: () => [{ issue: 10, itemId: 'PVTI_10', status: 'In Progress', aiStatus: 'EPIC Decomposed', kind: 'EPIC', title: 'e', labels: [TRACKING_LABEL], assignees: ['takaokouji'] }],
        getBoardEnrichment: () => ({ 10: { subIssues: { total: 2, completed: 2, percent: 100 }, prs: [] } }),
        listHeadPrs: () => [],
        upsertMarkedComment: () => {},
        releaseCheck: { botToken: async () => 't', applyIntents: async (ctx, itemId, intents) => written.push([itemId, intents]) },
    });
    assert.deepEqual(written, [['PVTI_10', [{ field: 'AI Status', value: 'Release Check' }]]]);
    assert.equal(state.board.items[0].aiStatus, 'Release Check');
});

test('refreshBoardAndProjectTrackers: ボードを取り直せなかった（別の再取得の最中）ときは、古いボードで入れない', async () => {
    // NG から子を作って EPIC Decomposed に戻した直後の board キャッシュ: 子の数は古い（全部済んだ）まま
    const stale = { issue: 10, itemId: 'PVTI_10', status: 'In Progress', aiStatus: 'EPIC Decomposed', kind: 'EPIC',
        labels: [TRACKING_LABEL], subIssues: { total: 2, completed: 2, percent: 100 } };
    const state = { running: new Map(), boardRefreshing: true, board: { updatedAt: 1, items: [stale] } };
    const written = [];
    await refreshBoardAndProjectTrackers({ ...cfg, owner: 'o', project: 4, now: () => 0, statusOrder: [] }, state, () => {}, {
        token: 't',
        noTickAfterEntry: true,
        listItems: () => { throw new Error('should not be called'); },
        upsertMarkedComment: () => {},
        releaseCheck: { botToken: async () => 't', applyIntents: async (ctx, itemId, intents) => written.push([itemId, intents]) },
    });
    assert.deepEqual(written, []);
    assert.equal(state.board.items[0].aiStatus, 'EPIC Decomposed');
});

test('rememberPreview: http(s) の URL だけを覚える（javascript: などをリンクにしない）', () => {
    const state = { board: { items: [trackerItem()] } };
    rememberPreview(state, 10, 'javascript:alert(1)');
    rememberPreview(state, 10, 'https://x/" onclick="a');
    rememberPreview(state, 10, null);
    assert.equal(state.releasePreviews, undefined);
    assert.equal(state.board.items[0].previewUrl, undefined);
    rememberPreview(state, 10, 'https://preview.smalruby.app/topic-x/');
    assert.equal(state.board.items[0].previewUrl, 'https://preview.smalruby.app/topic-x/');
});

test('releaseCheckViewOnce: 観点とプレビューを返し、プレビューを board の行に載せる', async () => {
    const state = { board: { items: [trackerItem()] } };
    const r = await releaseCheckViewOnce({ cfg, state }, '10', {
        readToken: async () => 'r',
        listIssueComments: async () => [{ id: 7, body: CHECK, user: bot }],
    });
    assert.equal(r.status, 200);
    assert.equal(r.body.check.round, 1);
    assert.deepEqual(r.body.check.points.map((p) => p.id), ['R1']);
    assert.equal(state.board.items[0].previewUrl, 'https://preview.smalruby.app/topic-x/');
    assert.equal(state.releasePreviews[10], 'https://preview.smalruby.app/topic-x/');
    assert.equal((await releaseCheckViewOnce({ cfg, state }, 'x')).status, 400);
    assert.equal((await releaseCheckViewOnce({ cfg, state }, '99')).status, 404);
});

function reviewDeps(comments, posted, released) {
    return {
        readToken: async () => 'r', botToken: async () => 'b',
        listIssueComments: async () => comments,
        postIssueComment: async (repo, n, body) => posted.push({ n, body }),
        releaseHumanGate: async (issue) => { released.push(issue); return { ok: true }; },
    };
}

test('releaseReviewOnce: 結果を Bot で書いてから 🙋 を外す・押し直しで二重に書かない', async () => {
    const state = { board: { items: [trackerItem()] } };
    const posted = [];
    const released = [];
    let ticked = 0;
    const ctx = { cfg, state, log: () => {}, afterRelease: () => { ticked += 1; } };
    const body = { issue: 10, round: 1, results: [{ id: 'R1', verdict: 'ng', note: '開かない' }], comment: '' };
    const r = await releaseReviewOnce(ctx, body, reviewDeps([{ id: 7, body: CHECK, user: bot }], posted, released));
    assert.equal(r.status, 200);
    assert.equal(r.body.ng, 1);
    assert.equal(posted.length, 1);
    assert.equal(posted[0].n, 10);
    assert.deepEqual(rc.parseReleaseReview(posted[0].body).results, body.results);
    assert.deepEqual(released, [10]);
    assert.equal(ticked, 1);
    // 🙋 を外すのに失敗して押し直した: 同じ round の結果はもう書かない
    const again = await releaseReviewOnce(ctx, body, reviewDeps([{ id: 7, body: CHECK, user: bot }, { id: 8, body: posted[0].body, user: bot }], posted, released));
    assert.equal(again.body.action, 'skip');
    assert.equal(posted.length, 1);
});

test('releaseReviewOnce: Release Check の 🙋 待ちでない・round が古い・形が悪いものは受けない', async () => {
    const posted = [];
    const released = [];
    const deps = reviewDeps([{ id: 7, body: CHECK, user: bot }], posted, released);
    const body = { issue: 10, round: 1, comment: 'ok' };
    const ctxOf = (item) => ({ cfg, state: { board: { items: [item] } }, log: () => {} });
    assert.equal((await releaseReviewOnce(ctxOf(trackerItem({ hitl: false })), body, deps)).body.code, 'not-release-check');
    assert.equal((await releaseReviewOnce(ctxOf(trackerItem({ aiStatus: 'EPIC Decomposed' })), body, deps)).body.code, 'not-release-check');
    assert.equal((await releaseReviewOnce(ctxOf(trackerItem()), { ...body, round: 2 }, deps)).body.code, 'stale-round');
    assert.equal((await releaseReviewOnce(ctxOf(trackerItem()), { issue: 10, round: 1 }, deps)).status, 400);
    assert.equal(posted.length, 0);
    assert.equal(released.length, 0);
});

test('applyReleaseCheckEntries: 親を autopilot-after で待つ子は、本文のキャッシュでリリース後の作業とみなす（#2459）', async () => {
    const t = trackerItem({ issue: 10, itemId: 'A', aiStatus: 'EPIC Decomposed', hitl: true, subIssues: { total: 2, completed: 1 } });
    const child = { issue: 11, parent: { number: 10 }, status: 'Sprint Backlog', labels: [] };
    const state = { directives: new Map([[11, { after: [10], at: 0 }]]) };
    const written = [];
    const done = await applyReleaseCheckEntries([t, child], cfg, state, () => {}, {
        botToken: async () => 't',
        applyIntents: async (ctx, itemId, intents) => { written.push([itemId, intents]); },
    });
    assert.deepEqual(done, [10]);
    assert.deepEqual(await applyReleaseCheckEntries([{ ...t, aiStatus: 'EPIC Decomposed' }, child], cfg, {}, () => {}, {
        botToken: async () => { throw new Error('should not be called'); },
    }), [], 'キャッシュが無ければ入らない');
});

const PAGE = 'https://claude.ai/artifact/page-1';

test('loadReleasePages / rememberReleasePage: EPIC ごとに URL を状態ファイルに持ち、board の行にも載せる（#2474）', () => {
    const files = {};
    const deps = {
        env: { AUTOPILOT_STATE_DIR: '/s' },
        mkdirSync: () => {}, writeFileSync: (f, v) => { files[f] = v; },
        readFileSync: (f) => { if (!(f in files)) throw new Error('ENOENT'); return files[f]; },
    };
    assert.deepEqual(loadReleasePages(deps), {}, '無ければ空');
    const state = { board: { items: [trackerItem()] }, releasePages: loadReleasePages(deps) };
    assert.equal(rememberReleasePage(state, 10, { artifactUrl: 'https://evil.example/x' }, 1, () => {}, deps), false);
    assert.deepEqual(files, {});
    assert.equal(rememberReleasePage(state, 10, { artifactUrl: PAGE, round: 1 }, 100, () => {}, deps), true);
    assert.equal(state.board.items[0].releasePageUrl, PAGE);
    assert.deepEqual(loadReleasePages(deps), { 10: { url: PAGE, round: 1, updatedAt: 100 } }, '再起動しても読める');
    // 2 回目の round: worker に同じ URL を渡し、同じ場所を上書きする
    const restarted = { releasePages: loadReleasePages(deps) };
    assert.equal(releasePageEnv(restarted, 10).AUTOPILOT_ARTIFACT_URL, PAGE);
    assert.equal(releasePageEnv(restarted, 11).AUTOPILOT_ARTIFACT_URL, '', 'まだ無い EPIC は初回');
    assert.match(releasePageEnv(restarted, 10).AUTOPILOT_RELEASE_PAGE_TEMPLATE, /templates[\\/]release-check[\\/]template\.html$/);
    rememberReleasePage(restarted, 10, { artifactUrl: PAGE, round: 2 }, 200, () => {}, deps);
    assert.deepEqual(loadReleasePages(deps), { 10: { url: PAGE, round: 2, updatedAt: 200 } });
});

test('postReleasePageAnswer: 確認ページで送った答えから結果のコメントを書き、NG と別の案が sub-issue の計画になる（#2474）', async () => {
    const posted = [];
    const comments = [{ id: 7, body: CHECK, user: bot }];
    const deps = {
        readToken: async () => 'r', botToken: async () => 'b',
        listIssueComments: async () => comments,
        postIssueComment: async (repo, n, body) => { posted.push({ repo, n, body }); comments.push({ id: 8, body, user: bot }); },
    };
    const answer = {
        status: 'submitted', round: 1, results: [{ id: 'R1', verdict: 'ng', note: '開かない' }],
        decisions: [{ id: 'D1', title: '添字', choice: 'alternative', alternative: '1 から' }, { id: 'D2', title: '色', choice: 'recommended' }],
        comment: '',
    };
    const r = await postReleasePageAnswer({ cfg }, { issue: 10, answer }, deps);
    assert.deepEqual(r, { ok: true, action: 'post', round: 1, ng: 1 });
    assert.equal(posted.length, 1);
    assert.equal(posted[0].n, 10);
    assert.match(posted[0].body, /📄 確認ページから/);
    // 結果を受ける段が読むのと同じ道で、NG と「推奨でよい」以外が子の計画になる
    assert.deepEqual(rc.releaseCheckMode(comments), { mode: 'result', round: 1 });
    const review = rc.parseReleaseReview(posted[0].body);
    const plan = rc.planReleaseResult({ epic: 10, round: 1, review, points: rc.parseReleaseCheckPoints(CHECK), existingBodies: [] });
    assert.deepEqual(plan.create.map((c) => [c.point, c.title, c.note]), [['R1', '開ける', '開かない']]);
    assert.deepEqual(plan.decisions.map((d) => [d.point, d.choice, d.alternative]), [['D1', 'alternative', '1 から']]);
    // 押し直し（worker の再実行）でも二重に書かない
    assert.equal((await postReleasePageAnswer({ cfg }, { issue: 10, answer }, deps)).action, 'skip');
    assert.equal(posted.length, 1);
});

test('postReleasePageAnswer: 下書き・ほかの round・形の悪い答えは書かない', async () => {
    const posted = [];
    const deps = {
        readToken: async () => 'r', botToken: async () => 'b',
        listIssueComments: async () => [{ id: 7, body: CHECK, user: bot }],
        postIssueComment: async (repo, n, body) => posted.push(body),
    };
    const base = { status: 'submitted', round: 1, results: [{ id: 'R1', verdict: 'ok' }] };
    assert.equal((await postReleasePageAnswer({ cfg }, { issue: 10, answer: { ...base, status: 'draft' } }, deps)).action, 'none');
    assert.equal((await postReleasePageAnswer({ cfg }, { issue: 10, answer: { ...base, round: 2 } }, deps)).action, 'none');
    const bad = await postReleasePageAnswer({ cfg }, { issue: 10, answer: { ...base, results: [{ id: '<b>', verdict: 'ok' }] } }, deps);
    assert.equal(bad.ok, false);
    const none = await postReleasePageAnswer({ cfg }, { issue: 10, answer: base }, { ...deps, listIssueComments: async () => [] });
    assert.equal(none.ok, false, '観点のコメントが無い');
    assert.deepEqual(posted, []);
});
