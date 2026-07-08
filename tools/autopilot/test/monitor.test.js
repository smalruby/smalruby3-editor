'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const { MONITOR_HTML } = require('../src/monitor');

test('MONITOR_HTML is a self-contained html document', () => {
    assert.match(MONITOR_HTML, /^<!doctype html>/i);
    assert.match(MONITOR_HTML, /<title>autopilot monitor<\/title>/);
    // 外部リソースを読み込まない（自己完結）
    assert.doesNotMatch(MONITOR_HTML, /<script[^>]+src=/);
    assert.doesNotMatch(MONITOR_HTML, /<link[^>]+href=/);
});

test('MONITOR_HTML wires the daemon control endpoints', () => {
    for (const ep of ['/board', '/pause', '/resume', '/log?issue=', '/tick']) {
        assert.ok(MONITOR_HTML.includes(ep), `should reference ${ep}`);
    }
});

test('MONITOR_HTML exposes a "poll now" (即時 tick) control', () => {
    assert.match(MONITOR_HTML, /id="ticknow"/);
    assert.match(MONITOR_HTML, /\/tick['"],\s*\{\s*method:\s*'POST'/);
});

test('MONITOR_HTML: 俯瞰ボード構造（first view はボード、履歴は最下部、log はモーダル）', () => {
    // 俯瞰ボード（縦並びテーブル）+ 実行履歴 + log モーダル
    assert.match(MONITOR_HTML, /id="board"/);
    assert.match(MONITOR_HTML, /id="hist"/);
    assert.match(MONITOR_HTML, /id="modal"/);
    // ボードがモーダル・履歴より前（first view）にある
    const iBoard = MONITOR_HTML.indexOf('id="board"');
    const iHist = MONITOR_HTML.indexOf('実行履歴');
    assert.ok(iBoard < iHist, 'board must render before history');
    // PR chips（draft/ready/merged/closed の色分け）と sub-issue バー
    for (const cls of ['pr-draft', 'pr-ready', 'pr-merged', 'pr-closed', 'class="bar"']) {
        assert.ok(MONITOR_HTML.includes(cls), `should include ${cls}`);
    }
});

test('MONITOR_HTML: アラート表示と check autopilot ショートカット', () => {
    assert.match(MONITOR_HTML, /check autopilot/);
    assert.match(MONITOR_HTML, /authError/);
    assert.match(MONITOR_HTML, /Blocked/);
});

test('MONITOR_HTML: log モーダルを開いている間 10 秒ごとに自動更新し、閉じると止める', () => {
    // openLog で 10 秒間隔の自動ポーリングを開始する
    assert.match(MONITOR_HTML, /setInterval\(loadLog,\s*10000\)/);
    // interval を保持する変数を持つ
    assert.match(MONITOR_HTML, /let logTimer = null/);
    // closeModal で interval をクリアする（リーク・多重化防止）
    assert.match(MONITOR_HTML, /clearInterval\(logTimer\)/);
    // 自動更新でも叩くのは /log のみ（新規 API を増やさない）
    const autoFetches = MONITOR_HTML.match(/fetch\('\/log\?issue='/g) || [];
    assert.ok(autoFetches.length >= 1, 'loadLog must fetch /log');
});

test('MONITOR_HTML: インライン script が構文的に妥当', () => {
    const m = MONITOR_HTML.match(/<script>([\s\S]*)<\/script>/);
    assert.ok(m, 'script block exists');
    // DOM は無い環境なので Function コンストラクタで構文チェックのみ行う
    assert.doesNotThrow(() => new Function(m[1]));
});
