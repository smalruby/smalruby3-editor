'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const { parseArgs, parseViewport, defaultScreenshotPath, USAGE } = require('../src/pw-check');

test('parseArgs: positional URL with defaults', () => {
    const o = parseArgs(['http://localhost:8787/']);
    assert.equal(o.error, undefined);
    assert.equal(o.url, 'http://localhost:8787/');
    assert.equal(o.serveHtml, null);
    assert.equal(o.waitSelector, null);
    assert.equal(o.evalJs, null);
    assert.equal(o.timeoutMs, 30000);
    assert.deepEqual(o.viewport, { width: 1280, height: 800 });
    // screenshot defaults under tmp/
    assert.match(o.screenshot, /^tmp\/pw-check-.*\.png$/);
});

test('parseArgs: all flags', () => {
    const o = parseArgs([
        'http://localhost:8601/?no_beforeunload=1',
        '--screenshot', 'tmp/x.png',
        '--wait', '.gui_editor-wrapper',
        '--eval', 'document.title',
        '--timeout', '90000',
        '--viewport', '1024x768',
    ]);
    assert.equal(o.error, undefined);
    assert.equal(o.screenshot, 'tmp/x.png');
    assert.equal(o.waitSelector, '.gui_editor-wrapper');
    assert.equal(o.evalJs, 'document.title');
    assert.equal(o.timeoutMs, 90000);
    assert.deepEqual(o.viewport, { width: 1024, height: 768 });
});

test('parseArgs: --serve-html without positional URL is allowed', () => {
    const o = parseArgs(['--serve-html', '/some/monitor.html']);
    assert.equal(o.error, undefined);
    assert.equal(o.serveHtml, '/some/monitor.html');
    assert.equal(o.url, null);
    assert.match(o.screenshot, /^tmp\/pw-check-.*\.png$/);
});

test('parseArgs: neither URL nor --serve-html is an error', () => {
    const o = parseArgs([]);
    assert.match(o.error || '', /url|serve-html/i);
});

test('parseArgs: unknown flag is an error', () => {
    const o = parseArgs(['http://x', '--nope']);
    assert.match(o.error || '', /unknown/i);
});

test('parseArgs: flag missing its value is an error', () => {
    const o = parseArgs(['http://x', '--wait']);
    assert.match(o.error || '', /--wait/);
});

test('parseArgs: screenshot outside tmp/ is rejected', () => {
    const o = parseArgs(['http://x', '--screenshot', '/etc/passwd.png']);
    assert.match(o.error || '', /tmp\//);
});

test('parseViewport: valid', () => {
    assert.deepEqual(parseViewport('800x600'), { width: 800, height: 600 });
});

test('parseViewport: invalid throws', () => {
    assert.throws(() => parseViewport('800'), /viewport/i);
    assert.throws(() => parseViewport('axb'), /viewport/i);
});

test('defaultScreenshotPath: derives a tmp/ slug from a URL', () => {
    const p = defaultScreenshotPath('http://localhost:8787/');
    assert.match(p, /^tmp\/pw-check-.*\.png$/);
    // deterministic (no timestamp) so tests are stable
    assert.equal(p, defaultScreenshotPath('http://localhost:8787/'));
});

test('defaultScreenshotPath: derives a tmp/ slug from a file path', () => {
    const p = defaultScreenshotPath('/x/y/monitor.html');
    assert.match(p, /^tmp\/pw-check-monitor.*\.png$/);
});

test('USAGE mentions headless and bundled chromium', () => {
    assert.match(USAGE, /headless/i);
    assert.match(USAGE, /chromium/i);
});
