'use strict';
/**
 * release-page.test.js — リリース確認の確認ページ（artifact・#2474）の下書き・描画・答えの読み取り・URL の状態。
 */
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('node:vm');
const rp = require('../src/release-page');
const rc = require('../src/release-check');
const { renderEpicDecisionsComment, normalizeDecision } = require('../src/epic-flow');

const bot = { login: 'smalruby3-editor-bot[bot]', type: 'Bot' };
const CHECK = [
    rc.releaseCheckMarker(2),
    '## 🚀 リリース確認（round 2）',
    '',
    '**プレビュー**: https://preview.smalruby.app/topic-x/',
    '',
    '### R1. 例題を動かせる',
    '- 開く: プレビューの Ruby タブ',
    '- する: 例題を選んで実行',
    '- OK: 出力が出る',
    '- 出どころ: #12 の DoD',
    '補足の行',
    '',
    '### R2. 行番号',
    '- OK: 行番号が残る',
].join('\n');
const DECISIONS = renderEpicDecisionsComment([
    normalizeDecision({ kind: 'not-adopted', issue: 12, pr: 34, title: '色を変える指摘', recommendation: '今のまま', alternatives: ['濃くする'] }),
    normalizeDecision({ kind: 'question', issue: 13, title: '添字の始まり', recommendation: '0 から', alternatives: ['1 から', '設定にする'] }),
]);
const COMMENTS = [
    { id: 1, body: DECISIONS, user: bot },
    { id: 2, body: CHECK.replace('round=2', 'round=1').replace('R1. 例題', 'R1. 古い'), user: bot },
    { id: 3, body: CHECK, user: bot },
];

test('draftReleasePageData: いちばん新しい観点と決定待ちからページのデータを作る', () => {
    const d = rp.draftReleasePageData({
        epic: 10, title: 'EPIC: 日本語モード', repo: 'o/r', comments: COMMENTS, prNumber: 99, generatedAt: '2026-11-26T03:00:00Z',
    });
    assert.equal(d.schema, rp.RELEASE_PAGE_SCHEMA);
    assert.equal(d.round, 2);
    assert.equal(d.previewUrl, 'https://preview.smalruby.app/topic-x/');
    assert.equal(d.prUrl, 'https://github.com/o/r/pull/99');
    assert.equal(d.trackerUrl, 'https://github.com/o/r/issues/10');
    assert.equal(d.checkUrl, 'https://github.com/o/r/issues/10#issuecomment-3');
    assert.equal(d.answerDoc, 'answers/round-2');
    assert.deepEqual(d.points[0], {
        id: 'R1', title: '例題を動かせる', open: 'プレビューの Ruby タブ', do: '例題を選んで実行', ok: '出力が出る',
        source: '#12 の DoD', rest: '補足の行',
    });
    assert.equal(d.points[1].ok, '行番号が残る');
    assert.deepEqual(d.decisions.map((x) => [x.id, x.kind, x.title, x.recommendation]), [
        ['D1', 'not-adopted', '色を変える指摘', '今のまま'],
        ['D2', 'question', '添字の始まり', '0 から'],
    ]);
    assert.equal(d.decisions[0].kindLabel, '採用しなかった指摘');
    assert.equal(d.decisions[0].prUrl, 'https://github.com/o/r/pull/34');
    assert.deepEqual(d.decisions[1].alternatives, ['1 から', '設定にする']);
});

test('draftReleasePageData: 観点も決定待ちも無ければ空で作る', () => {
    const d = rp.draftReleasePageData({ epic: 10, comments: [] });
    assert.deepEqual([d.round, d.points, d.decisions, d.answerDoc], [null, [], [], null]);
});

test('renderReleasePageHtml: テンプレートに埋め込み、テンプレートの JS がデータを読める', () => {
    const tpl = fs.readFileSync(path.join(__dirname, '..', 'templates', 'release-check', 'template.html'), 'utf8');
    assert.ok(tpl.includes(rp.RELEASE_PAGE_TOKEN));
    const data = rp.draftReleasePageData({ epic: 10, title: '</script><b>x', repo: 'o/r', comments: COMMENTS });
    const html = rp.renderReleasePageHtml(tpl, data);
    assert.ok(!html.includes('</script><b>'), '`</script>` で閉じない');
    const m = html.match(/const DATA = (.*);\n/);
    assert.deepEqual(JSON.parse(m[1]), data);
    // テンプレートの script が構文として正しい
    const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((x) => x[1]);
    assert.ok(scripts.length >= 1);
    for (const s of scripts) new vm.Script(s);
    assert.throws(() => rp.renderReleasePageHtml('<html></html>', data), /data token/);
});

test('answerToReviewBody: 送った答えだけを、その round のものだけ受ける', () => {
    const doc = {
        status: 'submitted', round: 2, results: [{ id: 'R1', verdict: 'ng', note: '出ない' }],
        decisions: [{ id: 'D2', title: '添字', choice: 'alternative', alternative: '1 から' }], comment: '全体に良い',
    };
    const body = rp.answerToReviewBody(doc, { issue: 10, round: 2 });
    assert.deepEqual(body, { issue: 10, round: 2, results: doc.results, decisions: doc.decisions, comment: '全体に良い', source: 'page' });
    const n = rc.normalizeReleaseReviewBody(body);
    assert.equal(n.ok, true);
    assert.equal(n.source, 'page');
    assert.equal(rp.answerToReviewBody({ ...doc, status: 'draft' }, { issue: 10, round: 2 }), null, '下書きは受けない');
    assert.equal(rp.answerToReviewBody({ ...doc, round: 1 }, { issue: 10, round: 2 }), null, 'ほかの round は受けない');
    assert.equal(rp.answerToReviewBody(null, { issue: 10, round: 2 }), null);
});

test('planReleasePageState: artifact の URL だけを EPIC ごとに覚え、2 回目は同じ場所を上書きする', () => {
    const url = 'https://claude.ai/artifact/abc-123';
    let s = rp.planReleasePageState({}, { issue: 10, round: 1, artifactUrl: url, now: 100 });
    assert.equal(s.changed, true);
    assert.deepEqual(s.pages, { 10: { url, round: 1, updatedAt: 100 } });
    s = rp.planReleasePageState(s.pages, { issue: 10, round: 2, artifactUrl: url, now: 200 });
    assert.deepEqual(s.pages[10], { url, round: 2, updatedAt: 200 });
    const bad = rp.planReleasePageState(s.pages, { issue: 10, artifactUrl: 'javascript:alert(1)', now: 300 });
    assert.equal(bad.changed, false);
    assert.equal(bad.pages[10].url, url);
    assert.equal(rp.releasePageUrl(s.pages, 10), url);
    assert.equal(rp.releasePageUrl(s.pages, 11), null);
});
