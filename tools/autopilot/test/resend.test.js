'use strict';
/**
 * 送り直しの決まり（#2504）: 入力欄に文が残っていれば Enter だけ・使い切ったら再起動・重いときは長く待つ。
 * 実 herdr / 実 tmux には触らない（fake の端末を注入する）。
 */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { promptStillInInput, acceptWindowFor, planResend, phasePromptCommand } = require('../src/phases');
const { runPhase } = require('../src/runner');
const { resolveTerminalSettings } = require('../src/blocked');

const TEXT = phasePromptCommand('autopilot-resolve-conflict', 1731, '/tmp/autopilot-run-abc/prompts');
const RULE = '─'.repeat(60);
// 指示の文が 2 回分つながって入力欄に残り、折り返されている画面
const STUCK = [
    ' Claude Code v2',
    '',
    RULE,
    `❯ ${TEXT.slice(0, 50)}`,
    `  ${TEXT.slice(50)}${TEXT.slice(0, 30)}`,
    `  ${TEXT.slice(30)}`,
    RULE,
    '  ? for shortcuts',
].join('\n');
const EMPTY = [' Claude Code v2', '', RULE, '❯ ', RULE, '  ? for shortcuts'].join('\n');
// 送信済みの文は入力欄より上（会話の履歴）に出る。入力欄は空
const SUBMITTED = [RULE, `> ${TEXT}`, '', RULE, '❯ ', RULE].join('\n');

test('promptStillInInput: 入力欄に残っている文を、折り返しと重なりがあっても見つける', () => {
    assert.strictEqual(promptStillInInput(STUCK, TEXT), true);
});

test('promptStillInInput: 入力欄が空なら false（履歴に出ている文は数えない）', () => {
    assert.strictEqual(promptStillInInput(EMPTY, TEXT), false);
    assert.strictEqual(promptStillInInput(SUBMITTED, TEXT), false);
    assert.strictEqual(promptStillInInput('', TEXT), false);
    assert.strictEqual(promptStillInInput(STUCK, ''), false);
});

test('promptStillInInput: 枠のある古い入力欄（│ > …│）でも見つける', () => {
    const boxed = ['╭' + RULE + '╮', `│ > ${TEXT.slice(0, 40)} │`, `│   ${TEXT.slice(40)} │`, '╰' + RULE + '╯'].join('\n');
    assert.strictEqual(promptStillInInput(boxed, TEXT), true);
});

test('acceptWindowFor: 1 CPU あたりの負荷で延ばす（上限 4 倍・値が無ければそのまま）', () => {
    assert.strictEqual(acceptWindowFor(8000, {}), 8000);
    assert.strictEqual(acceptWindowFor(8000, undefined), 8000);
    assert.strictEqual(acceptWindowFor(8000, { load1: 2, cpus: 5 }), 8000);
    assert.strictEqual(acceptWindowFor(8000, { load1: 10, cpus: 5 }), 16000);
    assert.strictEqual(acceptWindowFor(8000, { load1: 17, cpus: 5 }), 27200);
    assert.strictEqual(acceptWindowFor(8000, { load1: 100, cpus: 5 }), 32000);
    assert.strictEqual(acceptWindowFor(8000, { load1: 3, cpus: null }), 8000);
});

const base = { maxAttempts: 4, acceptWindowMs: 8000, text: TEXT, restarts: 0, maxRestarts: 2 };

test('planResend: 猶予のうちは待つ', () => {
    assert.strictEqual(planResend({ ...base, sinceSendMs: 5000, attempts: 1, screen: STUCK }).action, 'wait');
});

test('planResend: 入力欄に文が残っていれば Enter だけ', () => {
    assert.strictEqual(planResend({ ...base, sinceSendMs: 9000, attempts: 1, screen: STUCK }).action, 'enter');
});

test('planResend: 入力欄が空なら文と Enter', () => {
    assert.strictEqual(planResend({ ...base, sinceSendMs: 9000, attempts: 1, screen: EMPTY }).action, 'line');
});

test('planResend: 使い切って猶予を過ぎたら再起動、再起動の上限なら fail', () => {
    assert.strictEqual(planResend({ ...base, sinceSendMs: 5000, attempts: 4, screen: STUCK }).action, 'wait');
    assert.strictEqual(planResend({ ...base, sinceSendMs: 9000, attempts: 4, screen: STUCK }).action, 'restart');
    assert.strictEqual(planResend({ ...base, sinceSendMs: 9000, attempts: 4, screen: STUCK, restarts: 2 }).action, 'fail');
});

test('planResend: 使い切っても画面が動いているあいだは殺さずに待つ（busy の見落としに備える）', () => {
    const s = { ...base, sinceSendMs: 9000, attempts: 4, screen: EMPTY };
    assert.strictEqual(planResend({ ...s, idleMs: 2000 }).action, 'wait');
    assert.strictEqual(planResend({ ...s, idleMs: 9000 }).action, 'restart');
});

/** 見回りのたびに画面を返す fake の端末。sent に送ったものを残す */
function fakeTerm(screenFor) {
    const sent = [];
    let launches = 0;
    return {
        kind: 'fake', sent, get launches() { return launches; },
        launch() { launches += 1; }, killSession() {},
        snapshot() { return { alive: true, screen: screenFor(sent), status: 'idle' }; },
        sendLine(n, text) { sent.push({ text }); },
        sendKeys(n, keys) { sent.push({ keys }); },
    };
}

function run(term, extra = {}) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ap2504-'));
    let clock = 0;
    const snap = term.snapshot.bind(term);
    term.snapshot = () => { clock += 1000; return snap(); };
    return runPhase({
        session: 's', cwd: dir, env: {}, command: 'claude', skill: 'autopilot-implement', issue: 1,
        resultFile: path.join(dir, 'r.json'), terminal: term,
        terminalSettings: { ...resolveTerminalSettings({}), judge: false }, now: () => clock,
        watchdog: { pollMs: 1, minBootMs: 0, acceptWindowMs: 3000, maxSendAttempts: 3, maxRestarts: 0, tIdleMs: 10_000_000 },
        ...extra,
    });
}

test('runPhase: 入力欄に文が残っていれば、送り直しは Enter だけ', async () => {
    const term = fakeTerm((sent) => (sent.length ? `${RULE}\n❯ ${sent[0].text}\n${RULE}` : EMPTY));
    const res = await run(term);
    assert.strictEqual(res.action, 'fail');
    assert.match(res.reason, /not accepted/);
    assert.ok(term.sent[0].text.includes('autopilot-implement'));
    assert.deepStrictEqual(term.sent.slice(1), [{ keys: ['enter'] }, { keys: ['enter'] }]);
});

test('runPhase: 入力欄が空なら、今までどおり文と Enter を送り直す', async () => {
    const term = fakeTerm(() => EMPTY);
    const res = await run(term);
    assert.strictEqual(res.action, 'fail');
    assert.strictEqual(term.sent.length, 3);
    assert.ok(term.sent.every((s) => s.text && s.text.includes('autopilot-implement')));
});

test('runPhase: 送り直しを使い切ったら再起動する（黙って待たない）', async () => {
    const term = fakeTerm(() => EMPTY);
    const res = await run(term, {
        watchdog: { pollMs: 1, minBootMs: 0, acceptWindowMs: 3000, maxSendAttempts: 2, maxRestarts: 1, tIdleMs: 10_000_000 },
    });
    assert.strictEqual(res.action, 'fail');
    assert.strictEqual(term.launches, 2);
});

test('runPhase: 重いときは受理を長く待つ（readLoad の負荷で延ばす）', async () => {
    const term = fakeTerm(() => EMPTY);
    const sentAt = [];
    const orig = term.sendLine;
    let clock = 0;
    term.sendLine = (n, text) => { sentAt.push(clock); orig(n, text); };
    const snap = term.snapshot.bind(term);
    term.snapshot = () => { clock += 1000; return snap(); };
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ap2504-'));
    await runPhase({
        session: 's', cwd: dir, env: {}, command: 'claude', skill: 'autopilot-implement', issue: 1,
        resultFile: path.join(dir, 'r.json'), terminal: term,
        terminalSettings: { ...resolveTerminalSettings({}), judge: false }, now: () => clock,
        readLoad: () => ({ load1: 20, cpus: 5 }),
        watchdog: { pollMs: 1, minBootMs: 0, acceptWindowMs: 3000, maxSendAttempts: 2, maxRestarts: 0, tIdleMs: 10_000_000 },
    });
    // 3000ms × 4 = 12000ms を過ぎてから送り直す
    assert.strictEqual(sentAt.length, 2);
    assert.ok(sentAt[1] - sentAt[0] > 12000, `${sentAt}`);
});
