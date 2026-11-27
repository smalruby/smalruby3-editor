'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const {
    parseScreenOptions, keysToSelect, classifyBlockedScreen, parseJudgeReply, decideBlocked,
    normalizeHumanAnswer, activeElapsedMs, resolveTerminalSettings, screenSignature, MAX_SAME_SCREEN_ANSWERS,
} = require('../src/blocked');

// herdr 0.9.5 + Claude Code で実際に出た画面（パスだけ置きかえ）
const BASH_PERMISSION = fs.readFileSync(path.join(__dirname, 'fixtures', 'blocked-bash-permission.txt'), 'utf8');
const TRUST = [
    '───────────────────────────',
    ' Accessing workspace:',
    '',
    ' /app/.autopilot-worktrees/issue-1',
    '',
    ' Quick safety check: Is this a project you created or one you trust?',
    '',
    ' ❯ No, exit',
    '   Yes, I trust this folder',
    '',
    ' Enter to confirm · Esc to cancel',
].join('\n');

test('parseScreenOptions: 番号つきの選択肢を読む', () => {
    const o = parseScreenOptions(BASH_PERMISSION);
    assert.deepStrictEqual(o.map((x) => x.number), [1, 2, 3, 4]);
    assert.strictEqual(o[0].selected, true);
    assert.strictEqual(o[0].label, 'Yes');
});

test('parseScreenOptions: 番号なし（フォルダの信頼）', () => {
    const o = parseScreenOptions(TRUST);
    assert.deepStrictEqual(o.map((x) => x.label), ['No, exit', 'Yes, I trust this folder']);
    assert.deepStrictEqual(keysToSelect(o, 1), ['down', 'enter']);
});

test('classifyBlockedScreen: 許可の確認は 1. Yes（今回だけ）', () => {
    const c = classifyBlockedScreen(BASH_PERMISSION);
    assert.strictEqual(c.action, 'answer');
    assert.strictEqual(c.kind, 'permission');
    assert.deepStrictEqual(c.keys, ['1']);
});

test('classifyBlockedScreen: フォルダの信頼は「信頼する」を選ぶ', () => {
    const c = classifyBlockedScreen(TRUST);
    assert.strictEqual(c.kind, 'trust-folder');
    assert.deepStrictEqual(c.keys, ['down', 'enter']);
});

test('classifyBlockedScreen: NG（force push・.env・cdk deploy）は pause', () => {
    for (const cmd of ['git push --force origin x', 'cat .env', 'npx cdk deploy --all', 'rm -rf /app']) {
        const c = classifyBlockedScreen(BASH_PERMISSION.replaceAll('touch hello-2387.txt', cmd));
        assert.strictEqual(c.action, 'pause', cmd);
    }
});

test('classifyBlockedScreen: 知らない形は judge', () => {
    const c = classifyBlockedScreen('Which approach do you prefer?\n ❯ 1. Plan A\n   2. Plan B\n Esc to cancel');
    assert.strictEqual(c.action, 'judge');
});

test('parseJudgeReply: ok / ng / 壊れた返事', () => {
    assert.deepStrictEqual(parseJudgeReply('x {"verdict":"ok","keys":["1"],"reason":"safe"} y'), { verdict: 'ok', keys: ['1'], reason: 'safe' });
    assert.strictEqual(parseJudgeReply('{"verdict":"ng","reason":"deploy"}').verdict, 'ng');
    assert.strictEqual(parseJudgeReply('no json'), null);
    assert.strictEqual(parseJudgeReply('{"verdict":"ok","keys":["rm -rf"]}'), null);
    assert.strictEqual(parseJudgeReply('{"verdict":"maybe"}'), null);
});

test('decideBlocked: ルール → 判定 → 回数の上限', () => {
    const answer = classifyBlockedScreen(BASH_PERMISSION);
    const unknown = { action: 'judge', keys: [], reason: 'x', options: [] };
    assert.strictEqual(decideBlocked({ classification: answer, judgeEnabled: true, sameScreenAnswers: 0 }).source, 'rule');
    assert.strictEqual(decideBlocked({ classification: answer, judgeEnabled: true, sameScreenAnswers: MAX_SAME_SCREEN_ANSWERS }).action, 'pause');
    assert.strictEqual(decideBlocked({ classification: unknown, judgeEnabled: true, sameScreenAnswers: 0 }).action, 'judge');
    assert.strictEqual(decideBlocked({ classification: unknown, judgeEnabled: false, sameScreenAnswers: 0 }).action, 'pause');
    assert.strictEqual(decideBlocked({ classification: unknown, judgeEnabled: true, sameScreenAnswers: 0, judge: null }).action, 'pause');
    assert.strictEqual(decideBlocked({ classification: unknown, judgeEnabled: true, sameScreenAnswers: 0, judge: { verdict: 'ng', keys: [], reason: 'r' } }).action, 'pause');
    const ok = decideBlocked({ classification: unknown, judgeEnabled: true, sameScreenAnswers: 0, judge: { verdict: 'ok', keys: ['2'], reason: 'r' } });
    assert.deepStrictEqual([ok.action, ok.source, ok.keys], ['answer', 'judge', ['2']]);
});

test('normalizeHumanAnswer', () => {
    assert.deepStrictEqual(normalizeHumanAnswer({ keys: ['1'] }), { ok: true, answer: { keys: ['1'] } });
    assert.deepStrictEqual(normalizeHumanAnswer({ keys: [3] }).answer, { keys: ['3'] });
    assert.strictEqual(normalizeHumanAnswer({ keys: ['ctrl+c'] }).ok, false);
    assert.deepStrictEqual(normalizeHumanAnswer({ text: 'A でお願いします' }).answer, { text: 'A でお願いします' });
    assert.strictEqual(normalizeHumanAnswer({ text: '  ' }).ok, false);
    assert.strictEqual(normalizeHumanAnswer({}).ok, false);
});

test('activeElapsedMs: 待っていた時間を引く', () => {
    assert.strictEqual(activeElapsedMs(100_000, 30_000, 10_000), 60_000);
    assert.strictEqual(activeElapsedMs(1_000, 5_000), 0);
});

test('screenSignature: spinner と秒数の揺れを無視する', () => {
    assert.strictEqual(screenSignature('✻ Working 3s\nDo you?'), screenSignature('✶ Working 12s\nDo you?'));
});

test('resolveTerminalSettings: 既定は herdr + handle + judge、env が最優先', () => {
    const d = resolveTerminalSettings({});
    assert.deepStrictEqual([d.backend, d.herdrSession, d.blockedMode, d.judge, d.judgeModel], ['herdr', 'autopilot', 'handle', true, 'haiku']);
    assert.strictEqual(resolveTerminalSettings({ terminal: { backend: 'tmux' } }).backend, 'tmux');
    assert.strictEqual(resolveTerminalSettings({ terminal: { backend: 'tmux' } }, { AUTOPILOT_TERMINAL: 'herdr' }).backend, 'herdr');
    assert.strictEqual(resolveTerminalSettings({ terminal: { backend: 'zellij' } }).backend, 'herdr');
    assert.strictEqual(resolveTerminalSettings({ blocked: { mode: 'hitl', judge: false } }).judge, false);
});

test('promptRegion: 実線の上の会話は見ない（会話の .env で NG にしない）', () => {
    const { promptRegion } = require('../src/blocked');
    const screen = '❯ steps: cat .env || true\n  Read file (6 lines)\n' + BASH_PERMISSION;
    assert.ok(!promptRegion(screen).includes('cat .env'));
    assert.strictEqual(classifyBlockedScreen(screen).action, 'answer');
});
