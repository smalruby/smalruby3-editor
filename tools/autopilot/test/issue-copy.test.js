'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const vm = require('node:vm');
const { issueCopyText, splitPrsForTitle } = require('../src/phases');

const REPO = 'https://github.com/smalruby/smalruby3-editor';
const open = (n) => ({ number: n, state: 'OPEN', isDraft: false });
const draft = (n) => ({ number: n, state: 'OPEN', isDraft: true });
const merged = (n) => ({ number: n, state: 'MERGED', isDraft: false });
const closed = (n) => ({ number: n, state: 'CLOSED', isDraft: false });
const item = (prs, title = 'feat(classroom): 先生のログインを復元する') => ({ issue: 1199, title, prs });

test('issueCopyText: PR なし → #Issue タイトル + Issue の URL だけ', () => {
    for (const prs of [undefined, null, []]) {
        assert.strictEqual(issueCopyText(item(prs), REPO),
            '#1199 feat(classroom): 先生のログインを復元する\n' + REPO + '/issues/1199');
    }
});

test('issueCopyText: open 1 つ → PR#N を Issue 番号の後ろに入れ、PR の URL 行を足す', () => {
    assert.strictEqual(issueCopyText(item([open(1220)]), REPO),
        '#1199 PR#1220 feat(classroom): 先生のログインを復元する\n'
        + REPO + '/issues/1199\n' + REPO + '/pull/1220');
});

test('issueCopyText: open 複数（draft 含む）→ prs の順で全部並べる', () => {
    assert.strictEqual(issueCopyText(item([open(1220), draft(1222)]), REPO),
        '#1199 PR#1220 PR#1222 feat(classroom): 先生のログインを復元する\n'
        + REPO + '/issues/1199\n' + REPO + '/pull/1220\n' + REPO + '/pull/1222');
});

test('issueCopyText: merged / closed は含めない（インライン表示と同じ集合）', () => {
    assert.strictEqual(issueCopyText(item([merged(1215), closed(1212)]), REPO),
        '#1199 feat(classroom): 先生のログインを復元する\n' + REPO + '/issues/1199');
    const mixed = [merged(1215), open(1220), closed(1212)];
    assert.strictEqual(issueCopyText(item(mixed), REPO),
        '#1199 PR#1220 feat(classroom): 先生のログインを復元する\n'
        + REPO + '/issues/1199\n' + REPO + '/pull/1220');
    assert.deepStrictEqual(splitPrsForTitle(mixed).inline.map((p) => p.number), [1220]);
});

test('issueCopyText: タイトルの記号はエスケープも省略もせずそのまま入れる', () => {
    const title = 'fix: `a` & <b> "c" \'d\' — 「e」 #12 PR#3 ' + 'x'.repeat(200);
    assert.strictEqual(issueCopyText(item([], title), REPO), '#1199 ' + title + '\n' + REPO + '/issues/1199');
});

test('issueCopyText: タイトルが無くても壊れない', () => {
    assert.strictEqual(issueCopyText({ issue: 5 }, REPO), '#5\n' + REPO + '/issues/5');
});

test('issueCopyText は splitPrsForTitle と一緒なら自己完結（モニタへ toString 埋め込み）', () => {
    const ctx = vm.createContext({});
    vm.runInContext(String(splitPrsForTitle) + '\n' + String(issueCopyText), ctx);
    const r = vm.runInContext('issueCopyText({issue:1,title:"t",prs:[{number:2,state:"OPEN"}]}, "R")', ctx);
    assert.strictEqual(r, '#1 PR#2 t\nR/issues/1\nR/pull/2');
});
