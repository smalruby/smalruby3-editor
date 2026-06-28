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
    for (const ep of ['/status', '/pause', '/resume', '/stop?issue=', '/log?issue=', '/tick']) {
        assert.ok(MONITOR_HTML.includes(ep), `should reference ${ep}`);
    }
});

test('MONITOR_HTML exposes a "poll now" (即時 tick) control', () => {
    assert.match(MONITOR_HTML, /id="ticknow"/);
    // the button posts to /tick
    assert.match(MONITOR_HTML, /'\/tick',\s*'POST'|\/tick['"],\s*\{\s*method:\s*'POST'/);
});
