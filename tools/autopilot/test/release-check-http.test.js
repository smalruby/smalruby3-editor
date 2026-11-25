'use strict';
/**
 * release-check-http.test.js — リリース確認（#2430）の I/O。deps を差し替え、実 GitHub に触らない。
 */
const { test } = require('node:test');
const assert = require('node:assert');
const { applyReleaseCheckEntries, releaseCheckViewOnce, releaseReviewOnce } = require('../src/release-check-http');
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
