'use strict';
// 状況板の左端の Issue・PR のリンクと、列を動かさない優先度の ▲▼（#2471）
const test = require('node:test');
const assert = require('node:assert');
const { MONITOR_HTML } = require('../src/monitor');
const { splitPrsForTitle } = require('../src/phases');

const script = MONITOR_HTML.match(/<script>([\s\S]*)<\/script>/)[1];
const esc = (v) => String(v ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const pickFn = (name, args) => {
    const m = script.match(new RegExp(`function ${name}\\(${args}\\) \\{[\\s\\S]*?\\n\\}`));
    assert.ok(m, `${name} exists`);
    const repoUrl = 'https://github.com/smalruby/smalruby3-editor';
    const prMenuBtn = () => '<button class="prmenu-btn">▼</button>';
    return new Function('esc', 'repoUrl', 'splitPrsForTitle', 'prMenuBtn', 'ICON_EXT',
        `${m[0]}; return ${name};`)(esc, repoUrl, splitPrsForTitle, prMenuBtn, '<svg class="ext"></svg>');
};

test('状況板の見出し: 左端が Issue · PR の列・右端の PR の列は無い', () => {
    assert.match(MONITOR_HTML, /<th><\/th><th>Issue · PR<\/th><th>題名<\/th><th>優先<\/th><th>状態<\/th><th>次の動き<\/th><th>時刻<\/th><th>進み<\/th><th>人間待ち<\/th><th><\/th>/);
    assert.doesNotMatch(MONITOR_HTML, /<th>PR<\/th>/);
    assert.doesNotMatch(MONITOR_HTML, /colspan="11"/);
});

test('優先度の ▲▼ は visibility だけを切りかえる（display を切りかえない）', () => {
    assert.match(MONITOR_HTML, /#board \.prio button \{ visibility: hidden; \}/);
    assert.match(MONITOR_HTML, /#board tr:hover \.prio button, #board tr:focus-within \.prio button \{ visibility: visible; \}/);
    assert.doesNotMatch(MONITOR_HTML, /#board \.prio button \{ display: none/);
    assert.doesNotMatch(MONITOR_HTML, /#board tr:hover \.prio b \{ display: none/);
});

test('外部リンクのアイコンは自己完結のインライン SVG（currentColor・aria-hidden）', () => {
    const m = MONITOR_HTML.match(/const ICON_EXT = ("[^\n]*");/);
    assert.ok(m, 'ICON_EXT exists');
    const svg = JSON.parse(m[1]);
    assert.match(svg, /^<svg /);
    assert.match(svg, /aria-hidden="true"/);
    assert.match(svg, /currentColor/);
    assert.doesNotMatch(svg, /https?:/);
});

test('boardLinks: Issue と PR を番号で出す（#2455 · PR #2465・#2601）', () => {
    const boardLinks = pickFn('boardLinks', 'it');
    const h = boardLinks({ issue: 2455, url: 'https://github.com/smalruby/smalruby3-editor/issues/2455',
        prs: [{ number: 2465, state: 'OPEN', isDraft: true }] });
    assert.match(h, /href="https:\/\/github\.com\/smalruby\/smalruby3-editor\/issues\/2455"/);
    assert.match(h, /aria-label="Issue #2455 を GitHub で開く"/);
    assert.match(h, /title="#2455"/);
    assert.match(h, />#2455<\/a>/);
    assert.match(h, /href="https:\/\/github\.com\/smalruby\/smalruby3-editor\/pull\/2465"/);
    assert.match(h, /aria-label="PR #2465 を GitHub で開く"/);
    assert.match(h, /title="#2465/);
    assert.match(h, />PR #2465<\/a>/);
    assert.doesNotMatch(h, /svg class="ext"/);
    assert.strictEqual((h.match(/target="_blank" rel="noopener"/g) || []).length, 2);
    assert.doesNotMatch(h, /prmenu-btn/);
});

test('boardLinks: PR が無ければ Issue だけ・番号の無い行は空', () => {
    const boardLinks = pickFn('boardLinks', 'it');
    const h = boardLinks({ issue: 7, prs: [] });
    assert.match(h, /issues\/7"/);
    assert.doesNotMatch(h, />PR /);
    assert.strictEqual(boardLinks(null), '');
    assert.strictEqual(boardLinks({}), '');
});

test('boardLinks: merged / closed の PR があれば ▼ のメニューを添える・コンフリクトは印を残す', () => {
    const boardLinks = pickFn('boardLinks', 'it');
    const h = boardLinks({ issue: 9, prs: [
        { number: 10, state: 'MERGED', isDraft: false },
        { number: 11, state: 'OPEN', isDraft: false, mergeable: 'CONFLICTING' },
    ] });
    assert.match(h, /pull\/11"/);
    assert.doesNotMatch(h, /pull\/10"/);
    assert.match(h, /prmenu-btn/);
    assert.match(h, /data-testid="board-pr-conflict"/);
    assert.match(h, /コンフリクト/);
});

test('linkNums: 次の動きの #番号を別のタブで開くリンクにする（ほかの文字はエスケープ）', () => {
    const linkNums = pickFn('linkNums', 's');
    const h = linkNums('#2455 review・<b>');
    assert.match(h, /<a class="ilink" href="https:\/\/github\.com\/smalruby\/smalruby3-editor\/issues\/2455" target="_blank" rel="noopener">#2455<\/a>/);
    assert.match(h, /&lt;b&gt;/);
});

test('探す欄: 上の行に置き、状況板の中の絞り込み欄は無い（#2601）', () => {
    const top = MONITOR_HTML.match(/<header class="panel topline"[\s\S]*?<\/header>/)[0];
    assert.match(top, /<input id="q" type="search"[^>]*data-testid="monitor-find"/);
    assert.match(top, /placeholder="#番号・PR・題名で探す"/);
    assert.doesNotMatch(MONITOR_HTML, /data-testid="board-filter"/);
    // `/` で欄へ・URL の #番号 で開く
    assert.match(script, /e\.key === '\/' && !inInput/);
    assert.match(script, /addEventListener\('hashchange', findFromHash\)/);
});

test('markHit: 当たった文字に印を付け、ほかはエスケープする（#2601）', () => {
    const markHit = pickFn('markHit', 'text, q');
    assert.strictEqual(markHit('fix <b> rainbow', 'rain'), 'fix &lt;b&gt; <mark class="hit">rain</mark>bow');
    assert.strictEqual(markHit('abc', ''), 'abc');
    assert.strictEqual(markHit('abc', 'zz'), 'abc');
});

test('行の ⋯ のリンクの項目（GitHub で開く）を押すと、メニューを閉じる', () => {
    assert.match(script, /inMenu\.id === 'rowmenu' && t\.tagName === 'A'\) \{ setTimeout\(closeMenus, 0\); return; \}/);
});
