'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const {
    isArtifactUrl, planCurrentStatusOutcome, currentStatusView, draftDataFromMaterial,
    renderCurrentStatusHtml, TEMPLATE_DATA_TOKEN,
} = require('../src/current-status');
const job = require('../src/current-status-job');
const { buildStatusMaterial } = require('../src/epic-summary');

const URL1 = 'https://claude.ai/artifact/AbC123';
const URL2 = 'https://claude.ai/code/artifact/0f1e-22';
const ok = (result) => ({ ok: true, result: { issue: 0, phase: 'current-status', summary: '', hitl: false, ...result } });

test('isArtifactUrl: claude.ai の artifact の URL だけ', () => {
    assert.equal(isArtifactUrl(URL1), true);
    assert.equal(isArtifactUrl(URL2), true);
    assert.equal(isArtifactUrl('https://example.com/artifact/x'), false);
    assert.equal(isArtifactUrl('https://claude.ai/chat/x'), false);
    assert.equal(isArtifactUrl(null), false);
});

test('planCurrentStatusOutcome: 初回は URL を記録、更新は同じ URL、失敗は前のまま', () => {
    const first = planCurrentStatusOutcome({ prev: {}, run: { ok: true }, parsed: ok({ signal: 'done', artifactUrl: URL1, templateNotes: [' a ', '', 3] }), now: 5 });
    assert.equal(first.ok, true);
    assert.deepEqual(first.state, { url: URL1, updatedAt: 5, lastRunAt: 5, lastError: null });
    assert.deepEqual(first.notes, ['a']);
    // URL を返さなくても前の URL を使い続ける
    const again = planCurrentStatusOutcome({ prev: first.state, run: { ok: true }, parsed: ok({ signal: 'done' }), now: 9 });
    assert.equal(again.state.url, URL1);
    assert.equal(again.state.updatedAt, 9);
    // 失敗: URL と updatedAt は前のまま
    const fail = planCurrentStatusOutcome({ prev: first.state, run: { ok: false, reason: 'stall' }, parsed: null, now: 20 });
    assert.equal(fail.ok, false);
    assert.equal(fail.state.url, URL1);
    assert.equal(fail.state.updatedAt, 5);
    assert.match(fail.state.lastError, /stall/);
    // 初回で URL が無いのは失敗
    assert.equal(planCurrentStatusOutcome({ prev: {}, run: { ok: true }, parsed: ok({ signal: 'done', artifactUrl: 'bad' }), now: 1 }).ok, false);
    // error signal
    const err = planCurrentStatusOutcome({ prev: {}, run: { ok: true }, parsed: ok({ signal: 'error', error: 'no tool' }), now: 1 });
    assert.equal(err.state.lastError, 'no tool');
});

test('currentStatusView: 走っているか・メモの数', () => {
    assert.deepEqual(currentStatusView({ url: URL1, updatedAt: 3 }, { startedAt: 7 }, 2), {
        url: URL1, updatedAt: 3, lastRunAt: null, lastError: null, running: true, startedAt: 7, notesCount: 2,
    });
    assert.equal(currentStatusView(null, null).running, false);
});

const MATERIAL = buildStatusMaterial({
    items: [
        { issue: 10, title: 'EPIC', kind: 'EPIC', status: 'In Progress', subIssues: { total: 2, completed: 1 }, url: 'u' },
        { issue: 11, title: 'child', status: 'Review', parent: { number: 10 }, waitReason: 'review', url: 'u11' },
    ],
    running: [], history: [], concurrency: 2, now: Date.UTC(2026, 10, 24), repo: 'o/r',
});

test('draftDataFromMaterial: テンプレートの形', () => {
    const d = draftDataFromMaterial(MATERIAL);
    assert.equal(d.schema, 1);
    assert.equal(d.waits[0].label, '#11');
    assert.equal(d.epics[0].n, 10);
    assert.equal(d.epics[0].stageLabel, '実装');
    assert.ok(d.nextInterview.at);
    assert.match(d.footer, /o\/r/);
});

test('renderCurrentStatusHtml: データを埋め込み、</script> を閉じさせない', () => {
    const html = renderCurrentStatusHtml(`<script>const D = ${TEMPLATE_DATA_TOKEN};</script>`, { lead: '</script><b>' });
    assert.ok(!html.includes('</script><b>'));
    assert.match(html, /\\u003c\/script>/);
    assert.throws(() => renderCurrentStatusHtml('<p>no token</p>', {}));
});

test('テンプレート: 印を 1 つ持ち、artifact の決まり（タイトル・トークン・ダークモード・背景）を満たす', () => {
    const t = fs.readFileSync(path.join(__dirname, '..', 'templates', 'current-status', 'template.html'), 'utf8');
    assert.equal(t.split(TEMPLATE_DATA_TOKEN).length, 2);
    assert.match(t, /<title>開発の現在地<\/title>/);
    assert.match(t, /:root \{/);
    assert.match(t, /prefers-color-scheme: dark\) \{ :root:not\(\[data-theme="light"\]\)/);
    assert.match(t, /:root\[data-theme="dark"\]/);
    assert.match(t, /body \{[^}]*background: var\(--bg\)/);
    // 描画したページのスクリプトが文法として正しい
    const html = renderCurrentStatusHtml(t, draftDataFromMaterial(MATERIAL));
    const script = html.match(/<script>([\s\S]*)<\/script>/)[1];
    // eslint-disable-next-line no-new-func
    assert.doesNotThrow(() => new Function(script.replace('render(DATA);', '')));
});

test('bin/current-status-render.js: 下書き → HTML', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cs-render-'));
    const bin = path.join(__dirname, '..', 'bin', 'current-status-render.js');
    fs.writeFileSync(path.join(dir, 'm.json'), JSON.stringify(MATERIAL));
    execFileSync('node', [bin, '--material', path.join(dir, 'm.json'), '--draft', path.join(dir, 'd.json')]);
    execFileSync('node', [bin, '--data', path.join(dir, 'd.json'), '--out', path.join(dir, 'p.html')]);
    const html = fs.readFileSync(path.join(dir, 'p.html'), 'utf8');
    assert.ok(!html.includes(TEMPLATE_DATA_TOKEN));
    assert.match(html, /"stageLabel":"実装"/);
    fs.rmSync(dir, { recursive: true, force: true });
});

test('runCurrentStatusJob: worker を 1 回起動し、URL を残し、メモをためる（runPhase は差し替え）', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cs-job-'));
    const env = { AUTOPILOT_STATE_DIR: path.join(dir, 'state') };
    const prevCmd = process.env.AUTOPILOT_CLAUDE_CMD;
    process.env.AUTOPILOT_CLAUDE_CMD = 'true';
    const state = {};
    const calls = [];
    const cfg = { port: 9999, repo: 'o/r', now: () => 42, settings: null };
    const runPhase = async (opts) => {
        calls.push(opts);
        assert.equal(state.currentStatusJob.startedAt, 42); // 走っている間は二重起動を止める印がある
        assert.equal(opts.env.AUTOPILOT_ARTIFACT_URL, calls.length === 1 ? '' : URL1);
        assert.ok(fs.existsSync(opts.env.AUTOPILOT_STATUS_JSON));
        fs.writeFileSync(opts.resultFile, JSON.stringify({
            issue: 0, phase: 'current-status', signal: 'done', summary: 's', hitl: false,
            artifactUrl: URL1, templateNotes: ['note1'],
        }));
        return { ok: true, action: 'collect', reason: 'result' };
    };
    try {
        const r1 = await job.runCurrentStatusJob(cfg, state, () => {}, { env, runPhase, material: () => MATERIAL, workDir: path.join(dir, 'work') });
        assert.deepEqual(r1, { ok: true, url: URL1 });
        assert.equal(state.currentStatusJob, null);
        assert.equal(state.currentStatus.url, URL1);
        assert.equal(state.currentStatus.notesCount, 1);
        assert.equal(calls[0].skill, 'autopilot-current-status');
        assert.equal(calls[0].issue, 0);
        // 状態は再起動をまたいで読める
        assert.equal(job.loadCurrentStatusState({}, { env }).url, URL1);
        // 2 回目は同じ URL を渡す
        await job.runCurrentStatusJob(cfg, state, () => {}, { env, runPhase, material: () => MATERIAL, workDir: path.join(dir, 'work') });
        assert.equal(calls.length, 2);
        assert.equal(job.countNotes({ env }), 2);
        // 走っている間は起動しない
        state.currentStatusJob = { startedAt: 1 };
        assert.deepEqual(await job.runCurrentStatusJob(cfg, state, () => {}, { env, runPhase, material: () => MATERIAL }), { ok: false, error: 'already running' });
    } finally {
        if (prevCmd == null) delete process.env.AUTOPILOT_CLAUDE_CMD; else process.env.AUTOPILOT_CLAUDE_CMD = prevCmd;
        fs.rmSync(dir, { recursive: true, force: true });
    }
});

test('loadCurrentStatusState: 状態が無ければ settings の currentStatus.artifactUrl から始める', () => {
    const env = { AUTOPILOT_STATE_DIR: path.join(os.tmpdir(), `cs-none-${process.pid}`) };
    assert.equal(job.loadCurrentStatusState({ settings: { currentStatus: { artifactUrl: URL2 } } }, { env }).url, URL2);
    assert.equal(job.loadCurrentStatusState({}, { env }).url, undefined);
});
