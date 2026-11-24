'use strict';
/**
 * herdr の runner（#2387）: 端末の backend・blocked の扱い・人間の答え・置き場の HTTP。
 * 実 herdr / 実 tmux / 実 claude には触らない（fake の端末と judge を注入する）。
 */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const { createBlockedHandler } = require('../src/blocked-handler');
const { createBlockedHub, handleBlockedHttp } = require('../src/blocked-hub');
const { createHerdrBackend, createTmuxBackend, createTerminal } = require('../src/terminal');
const { runPhase } = require('../src/runner');
const { resolveTerminalSettings } = require('../src/blocked');

const PERMISSION = fs.readFileSync(path.join(__dirname, 'fixtures', 'blocked-bash-permission.txt'), 'utf8');
const QUESTION = 'Which design?\n ❯ 1. Plan A\n   2. Plan B\n Esc to cancel';
const SETTINGS = resolveTerminalSettings({});

function fakeTerm() {
    const sent = [];
    return {
        kind: 'fake', sent,
        sendKeys: (n, keys) => sent.push({ keys }),
        sendLine: (n, text) => sent.push({ text }),
    };
}

test('handler: 決まった形はルールで答え、待たない', async () => {
    const term = fakeTerm();
    const h = createBlockedHandler({ term, session: 's', settings: SETTINGS, judge: async () => { throw new Error('呼ばれない'); } });
    const r = await h.step({ blocked: true, screen: PERMISSION, now: 1000 });
    assert.deepStrictEqual(r, { paused: false, answered: true });
    assert.deepStrictEqual(term.sent, [{ keys: ['1'] }]);
    // 答えた直後は画面が変わるのを待つ（二重に答えない）
    await h.step({ blocked: true, screen: PERMISSION, now: 2000 });
    assert.strictEqual(term.sent.length, 1);
});

test('handler: 同じ画面に何度も答えても進まなければ待つ', async () => {
    const term = fakeTerm();
    const hub = createBlockedHub({ now: () => 0 });
    const h = createBlockedHandler({ term, session: 's', settings: SETTINGS, channel: hub.channel(7, 'implement', 's'), cooldownMs: 0 });
    for (let i = 0; i < 3; i++) await h.step({ blocked: true, screen: PERMISSION, now: i });
    const r = await h.step({ blocked: true, screen: PERMISSION, now: 10 });
    assert.strictEqual(r.paused, true);
    assert.strictEqual(hub.list()[0].issue, 7);
});

test('handler: AI が NG → 一時停止 → モニターの答えで続ける。待った時間は数えない', async () => {
    const term = fakeTerm();
    const hub = createBlockedHub({ now: () => 5000 });
    const ch = hub.channel(42, 'implement', 'autopilot-implement-42');
    const h = createBlockedHandler({
        term, session: 's', settings: SETTINGS, channel: ch,
        judge: async () => '{"verdict":"ng","reason":"design question"}',
    });
    let r = await h.step({ blocked: true, screen: QUESTION, now: 1000 });
    assert.strictEqual(r.paused, true);
    assert.strictEqual(hub.list().length, 1);
    assert.match(hub.list()[0].reason, /NG/);
    r = await h.step({ blocked: true, screen: QUESTION, now: 61_000 });
    assert.strictEqual(r.paused, true);
    assert.strictEqual(h.pausedMs(61_000), 60_000);
    assert.strictEqual(hub.answer(42, { keys: ['2'] }).ok, true);
    r = await h.step({ blocked: true, screen: QUESTION, now: 70_000 });
    assert.deepStrictEqual(r, { paused: false, answered: true });
    assert.deepStrictEqual(term.sent, [{ keys: ['2'] }]);
    assert.strictEqual(hub.list().length, 0);
    assert.strictEqual(h.pausedMs(100_000), 69_000);
    assert.deepStrictEqual(hub.history().map((e) => e.type), ['resumed', 'answered', 'paused']);
});

test('handler: AI が ok なら判定のキーで答える', async () => {
    const term = fakeTerm();
    const h = createBlockedHandler({ term, session: 's', settings: SETTINGS, judge: async () => '{"verdict":"ok","keys":["1"],"reason":"fine"}' });
    const r = await h.step({ blocked: true, screen: QUESTION, now: 0 });
    assert.strictEqual(r.answered, true);
    assert.deepStrictEqual(term.sent, [{ keys: ['1'] }]);
});

test('handler: 人間が herdr で直接答えて画面が進んだら、待つのをやめる', async () => {
    const hub = createBlockedHub();
    const h = createBlockedHandler({ term: fakeTerm(), session: 's', settings: { ...SETTINGS, judge: false }, channel: hub.channel(1, 'p', 's') });
    await h.step({ blocked: true, screen: QUESTION, now: 0 });
    const r = await h.step({ blocked: false, screen: 'working', now: 100 });
    assert.strictEqual(r.paused, false);
    assert.strictEqual(hub.size(), 0);
});

/** runPhase を fake の端末で回す（画面の並びを順に返す） */
function scriptedTerm(frames, onSend) {
    const sent = [];
    let i = 0;
    let killed = false;
    return {
        kind: 'fake', sent,
        launch() {}, killSession() { killed = true; }, get killed() { return killed; },
        snapshot() { const f = frames[Math.min(i, frames.length - 1)]; i += 1; return { alive: true, ...f }; },
        sendLine(n, text) { sent.push({ text }); if (onSend) onSend({ text }); },
        sendKeys(n, keys) { sent.push({ keys }); if (onSend) onSend({ keys }); },
    };
}

test('runPhase(herdr): 起動時のフォルダの信頼に答えてから指示を送り、結果で終わる', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ap2387-'));
    const resultFile = path.join(dir, 'r.json');
    const trust = ' Quick safety check: trust?\n ❯ No, exit\n   Yes, I trust this folder\n Enter to confirm';
    const frames = [
        { screen: trust, status: 'blocked' }, { screen: trust, status: 'blocked' },
        { screen: '❯ ', status: 'idle' }, { screen: '❯ ', status: 'idle' }, { screen: '❯ ', status: 'idle' },
        { screen: 'working', status: 'working' }, { screen: 'working', status: 'working' },
    ];
    const term = scriptedTerm(frames, (s) => { if (s.text && s.text.includes('autopilot-implement')) fs.writeFileSync(resultFile, '{}'); });
    let clock = 0;
    const snap = term.snapshot;
    term.snapshot = () => { clock += 1000; return snap(); };
    const res = await runPhase({
        session: 'autopilot-implement-1', cwd: dir, env: {}, command: 'claude', skill: 'autopilot-implement', issue: 1,
        resultFile, terminal: term, terminalSettings: SETTINGS, judge: async () => { throw new Error('no'); },
        now: () => clock, watchdog: { pollMs: 1, minBootMs: 0, acceptWindowMs: 10_000 },
    });
    assert.strictEqual(res.action, 'collect');
    assert.deepStrictEqual(term.sent[0], { keys: ['down', 'enter'] });
    assert.ok(term.sent.some((s) => s.text && s.text.includes('autopilot-implement')));
    assert.ok(term.killed);
});

test('runPhase(herdr): 人間の口が無いまま NG で止まったら HITL', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ap2387-'));
    const frames = [{ screen: QUESTION, status: 'blocked' }];
    const res = await runPhase({
        session: 's', cwd: dir, env: {}, command: 'claude', skill: 'autopilot-implement', issue: 1,
        resultFile: path.join(dir, 'r.json'), terminal: scriptedTerm(frames), terminalSettings: { ...SETTINGS, judge: false },
        watchdog: { pollMs: 1, minBootMs: 0 },
    });
    assert.strictEqual(res.action, 'hitl');
});

test('runPhase(herdr): 人間を待っているあいだは tMax が進まない', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ap2387-'));
    const resultFile = path.join(dir, 'r.json');
    const hub = createBlockedHub();
    const ch = hub.channel(9, 'implement', 's');
    let clock = 0;
    let polls = 0;
    const term = scriptedTerm([{ screen: QUESTION, status: 'blocked' }]);
    term.snapshot = () => {
        polls += 1;
        clock += 60_000; // 1 回の見回りで 1 分すすむ
        if (polls === 6) hub.answer(9, { keys: ['1'] });
        if (polls > 7) fs.writeFileSync(resultFile, '{}');
        return { alive: true, screen: polls > 6 ? 'working' : QUESTION, status: polls > 6 ? 'working' : 'blocked' };
    };
    const res = await runPhase({
        session: 's', cwd: dir, env: {}, command: 'claude', skill: 'autopilot-implement', issue: 9,
        resultFile, terminal: term, terminalSettings: { ...SETTINGS, judge: false }, blocked: ch, now: () => clock,
        watchdog: { pollMs: 1, minBootMs: 0, tMaxMs: 3 * 60_000, tReadyMs: 10 * 60_000 },
    });
    assert.strictEqual(res.action, 'collect', res.reason);
    assert.deepStrictEqual(term.sent.find((s) => s.keys), { keys: ['1'] });
});

test('herdr backend: workspace の label で worker を引き、exec で起こす', () => {
    const calls = [];
    const state = { workspaces: [] };
    const exec = (cmd, args) => {
        calls.push(args.join(' '));
        if (args[0] === 'session' && args[1] === 'list') return 'name status\nautopilot running /x /y\n';
        if (args[0] === '--version') return 'herdr 0.9.5';
        const a = args.slice(2);
        if (a[0] === 'workspace' && a[1] === 'list') return JSON.stringify({ result: { workspaces: state.workspaces } });
        if (a[0] === 'workspace' && a[1] === 'create') {
            state.workspaces.push({ workspace_id: 'w1', label: a[a.indexOf('--label') + 1] });
            return JSON.stringify({ result: { root_pane: { pane_id: 'w1:p1' } } });
        }
        if (a[0] === 'pane' && a[1] === 'list') return JSON.stringify({ result: { panes: [{ pane_id: 'w1:p1', agent_status: 'blocked' }] } });
        if (a[0] === 'pane' && a[1] === 'read') return 'SCREEN';
        return '{"result":{"type":"ok"}}';
    };
    const b = createHerdrBackend({ session: 'autopilot', exec });
    b.launch('autopilot-implement-5', '/w', { AUTOPILOT_ISSUE: '5' }, 'claude --model opus');
    assert.ok(calls.some((c) => c.includes('workspace create --cwd /w --label autopilot-implement-5 --no-focus --env AUTOPILOT_ISSUE=5')));
    assert.ok(calls.some((c) => c === '--session autopilot pane run w1:p1 exec claude --model opus'));
    assert.deepStrictEqual(b.listSessions(), ['autopilot-implement-5']);
    assert.deepStrictEqual(b.snapshot('autopilot-implement-5'), { alive: true, screen: 'SCREEN', status: 'blocked' });
    b.sendKeys('autopilot-implement-5', ['down', 'enter']);
    assert.ok(calls.includes('--session autopilot pane send-keys w1:p1 down enter'));
    b.shutdown();
    assert.ok(calls.includes('session stop autopilot'));
    assert.deepStrictEqual(b.snapshot('nope'), { alive: false, screen: '', status: null });
});

test('tmux backend: shutdown は自分が起こした worker だけを止める', () => {
    const calls = [];
    const b = createTmuxBackend({ exec: (cmd, args) => { calls.push(args.join(' ')); return ''; } });
    b.launch('autopilot-implement-1', '/w', {}, 'claude');
    b.shutdown();
    const kills = calls.filter((c) => c.startsWith('kill-session'));
    assert.deepStrictEqual(kills, ['kill-session -t autopilot-implement-1', 'kill-session -t autopilot-implement-1']);
});

test('createTerminal: herdr が無ければ tmux に戻す', () => {
    const logs = [];
    const t = createTerminal({ backend: 'herdr', herdrBin: 'herdr' }, (m) => logs.push(m), { exec: () => { throw new Error('ENOENT'); } });
    assert.strictEqual(t.kind, 'tmux');
    assert.match(logs[0], /tmux/);
});

test('handleBlockedHttp: 一覧と答え', async () => {
    const hub = createBlockedHub();
    hub.channel(3, 'review', 's').open({ reason: 'NG', screen: 'x', options: [] });
    const server = http.createServer((req, res) => {
        const url = new URL(req.url, 'http://localhost');
        if (!handleBlockedHttp(req, res, url, hub)) { res.writeHead(418); res.end(); }
    });
    await new Promise((r) => server.listen(0, r));
    const base = `http://127.0.0.1:${server.address().port}`;
    try {
        const list = await fetch(`${base}/blocked`).then((r) => r.json());
        assert.strictEqual(list.waiting[0].issue, 3);
        const bad = await fetch(`${base}/blocked/answer`, { method: 'POST', body: JSON.stringify({ issue: 3, keys: ['rm'] }) });
        assert.strictEqual(bad.status, 400);
        const none = await fetch(`${base}/blocked/answer`, { method: 'POST', body: JSON.stringify({ issue: 4, keys: ['1'] }) });
        assert.strictEqual(none.status, 404);
        const ok = await fetch(`${base}/blocked/answer`, { method: 'POST', body: JSON.stringify({ issue: 3, text: 'A で' }) });
        assert.strictEqual(ok.status, 200);
        assert.strictEqual((await fetch(`${base}/other`)).status, 418);
    } finally { server.close(); }
});

test('monitor: 止まっている worker の欄を埋め込み、script が構文として妥当', () => {
    const { MONITOR_HTML } = require('../src/monitor');
    const { BLOCKED_PANEL_HTML } = require('../src/blocked-panel');
    assert.ok(MONITOR_HTML.includes('data-testid="blocked-panel"'));
    const m = BLOCKED_PANEL_HTML.match(/<script data-panel="blocked">([\s\S]*)<\/script>/);
    assert.doesNotThrow(() => new Function(m[1]));
    assert.ok(m[1].includes('/blocked/answer'));
});

test('hub: Issue に結びつかない worker（issue=0）は worker の名前で分けて答えられる', () => {
    const hub = createBlockedHub();
    hub.channel(0, 'task', 'autopilot-task-a').open({ reason: 'NG', screen: 'x', options: [] });
    hub.channel(0, 'current-status', 'autopilot-current-status-8787').open({ reason: 'NG', screen: 'y', options: [] });
    assert.deepStrictEqual(hub.list().map((w) => w.key).sort(), ['autopilot-current-status-8787', 'autopilot-task-a']);
    assert.strictEqual(hub.answer('autopilot-task-a', { keys: ['1'] }).ok, true);
    assert.strictEqual(hub.answer(0, { keys: ['1'] }).ok, false);
});
