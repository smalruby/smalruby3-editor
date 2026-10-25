'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const vm = require('node:vm');
const { splitPrsForTitle } = require('../src/phases');

const open = (n) => ({ number: n, state: 'OPEN', isDraft: false });
const draft = (n) => ({ number: n, state: 'OPEN', isDraft: true });
const merged = (n) => ({ number: n, state: 'MERGED', isDraft: false });
const closed = (n) => ({ number: n, state: 'CLOSED', isDraft: false });
const nums = (xs) => xs.map((p) => p.number);

test('splitPrsForTitle: PR なし → インラインもメニューも無し', () => {
    for (const prs of [[], undefined, null]) {
        const r = splitPrsForTitle(prs);
        assert.deepStrictEqual(r, { inline: [], menu: [], hasMenu: false });
    }
});

test('splitPrsForTitle: open のみ → インラインに並べ、▼ は出さない', () => {
    const r = splitPrsForTitle([open(1220)]);
    assert.deepStrictEqual(nums(r.inline), [1220]);
    assert.strictEqual(r.hasMenu, false);
    assert.deepStrictEqual(r.menu, []);
});

test('splitPrsForTitle: open 複数 → prs の順でインラインに並べる', () => {
    const r = splitPrsForTitle([draft(1221), open(1222)]);
    assert.deepStrictEqual(nums(r.inline), [1221, 1222]);
    assert.strictEqual(r.hasMenu, false);
});

test('splitPrsForTitle: merged のみ → インライン無し・▼ メニューに出す', () => {
    const r = splitPrsForTitle([merged(1215)]);
    assert.deepStrictEqual(r.inline, []);
    assert.strictEqual(r.hasMenu, true);
    assert.deepStrictEqual(r.menu.map((m) => [m.number, m.kind]), [[1215, 'merged']]);
});

test('splitPrsForTitle: closed（未 merge）のみ → インライン無し・▼ メニューに出す', () => {
    const r = splitPrsForTitle([closed(1212)]);
    assert.deepStrictEqual(r.inline, []);
    assert.strictEqual(r.hasMenu, true);
    assert.deepStrictEqual(r.menu.map((m) => [m.number, m.kind]), [[1212, 'closed']]);
});

test('splitPrsForTitle: 混在 → インラインは open だけ、メニューは open も含む全 PR（順序維持）', () => {
    const r = splitPrsForTitle([open(1220), merged(1215), draft(1221), closed(1212)]);
    assert.deepStrictEqual(nums(r.inline), [1220, 1221]);
    assert.strictEqual(r.hasMenu, true);
    assert.deepStrictEqual(r.menu.map((m) => [m.number, m.kind]),
        [[1220, 'open'], [1215, 'merged'], [1221, 'draft'], [1212, 'closed']]);
});

test('splitPrsForTitle: draft は open として扱う（インラインに出し、▼ の理由にならない）', () => {
    const r = splitPrsForTitle([draft(1221)]);
    assert.deepStrictEqual(nums(r.inline), [1221]);
    assert.strictEqual(r.hasMenu, false);
});

test('splitPrsForTitle: 入力を変更しない', () => {
    const prs = Object.freeze([Object.freeze(open(1)), Object.freeze(merged(2))]);
    const r = splitPrsForTitle(prs);
    assert.strictEqual(r.inline[0], prs[0]);
    assert.strictEqual(prs[0].kind, undefined);
});

test('splitPrsForTitle は自己完結（モニタへ toString 埋め込みで単独評価できる）', () => {
    const ctx = vm.createContext({});
    vm.runInContext(String(splitPrsForTitle), ctx);
    const r = vm.runInContext('splitPrsForTitle([{number:1,state:"OPEN",isDraft:true},{number:2,state:"MERGED"}])', ctx);
    assert.strictEqual(r.inline.length, 1);
    assert.strictEqual(r.hasMenu, true);
});
