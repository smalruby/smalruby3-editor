'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const { parseCommitLog, readVersion, checkAutopilotUpdate } = require('../src/version');

const SEP = '\x1f';

test('parseCommitLog: %h<SEP>%s を新しい順にパース', () => {
    const out = `abc1234${SEP}feat: A\ndef5678${SEP}fix: B\n`;
    assert.deepStrictEqual(parseCommitLog(out), [
        { shortCommit: 'abc1234', subject: 'feat: A' },
        { shortCommit: 'def5678', subject: 'fix: B' },
    ]);
});

test('parseCommitLog: 空文字/空白のみは空配列', () => {
    assert.deepStrictEqual(parseCommitLog(''), []);
    assert.deepStrictEqual(parseCommitLog('\n  \n'), []);
});

test('parseCommitLog: SEP が無い行は subject 空でフォールバック', () => {
    assert.deepStrictEqual(parseCommitLog('abc1234\n'), [{ shortCommit: 'abc1234', subject: '' }]);
});

test('readVersion: branch/commit/shortCommit を取得', async () => {
    const calls = [];
    const execFileP = async (_cmd, args) => {
        calls.push(args.join(' '));
        const sub = args.slice(2).join(' ');
        if (sub === 'rev-parse --abbrev-ref HEAD') return { stdout: 'develop\n' };
        if (sub === 'rev-parse HEAD') return { stdout: '9380da0abcdef1234567890\n' };
        if (sub === 'rev-parse --short HEAD') return { stdout: '9380da0\n' };
        throw new Error('unexpected ' + sub);
    };
    const v = await readVersion('/app', { execFileP });
    assert.deepStrictEqual(v, { branch: 'develop', commit: '9380da0abcdef1234567890', shortCommit: '9380da0' });
    assert.ok(calls.every((c) => c.startsWith('-C /app')));
});

test('readVersion: git 失敗時は全フィールド null（グレースフル）', async () => {
    const execFileP = async () => { throw new Error('not a git repo'); };
    assert.deepStrictEqual(await readVersion('/x', { execFileP }),
        { branch: null, commit: null, shortCommit: null });
});

test('checkAutopilotUpdate: tools/autopilot に新コミットあり → available', async () => {
    const calls = [];
    const execFileP = async (_cmd, args) => {
        const sub = args.slice(2).join(' ');
        calls.push(sub);
        if (sub.startsWith('fetch')) return { stdout: '' };
        if (sub.startsWith('log')) return { stdout: `aaa1111${SEP}feat(autopilot): X\nbbb2222${SEP}fix(autopilot): Y\n` };
        throw new Error('unexpected ' + sub);
    };
    const r = await checkAutopilotUpdate(
        { repoRoot: '/app', baseBranch: 'develop', bootCommit: 'boot0', now: () => 42 },
        { execFileP },
    );
    assert.strictEqual(r.available, true);
    assert.strictEqual(r.behind, 2);
    assert.strictEqual(r.commits.length, 2);
    assert.strictEqual(r.commits[0].subject, 'feat(autopilot): X');
    assert.strictEqual(r.checkedAt, 42);
    assert.strictEqual(r.error, null);
    // fetch は origin develop、log は boot0..origin/develop -- tools/autopilot
    assert.ok(calls.some((c) => c === 'fetch origin develop'));
    assert.ok(calls.some((c) => c.includes('boot0..origin/develop') && c.includes('tools/autopilot')));
});

test('checkAutopilotUpdate: 差分なし → available:false, behind:0', async () => {
    const execFileP = async (_cmd, args) => {
        const sub = args.slice(2).join(' ');
        if (sub.startsWith('fetch')) return { stdout: '' };
        return { stdout: '' };
    };
    const r = await checkAutopilotUpdate(
        { repoRoot: '/app', baseBranch: 'develop', bootCommit: 'boot0', now: () => 1 },
        { execFileP },
    );
    assert.strictEqual(r.available, false);
    assert.strictEqual(r.behind, 0);
    assert.deepStrictEqual(r.commits, []);
    assert.strictEqual(r.error, null);
});

test('checkAutopilotUpdate: fetch 失敗 → error を載せて available:false', async () => {
    const execFileP = async (_cmd, args) => {
        const sub = args.slice(2).join(' ');
        if (sub.startsWith('fetch')) throw new Error('Could not read from remote repository');
        return { stdout: '' };
    };
    const r = await checkAutopilotUpdate(
        { repoRoot: '/app', baseBranch: 'develop', bootCommit: 'boot0', now: () => 7 },
        { execFileP },
    );
    assert.strictEqual(r.available, false);
    assert.match(r.error, /Could not read from remote/);
    assert.strictEqual(r.checkedAt, 7);
});

test('checkAutopilotUpdate: bootCommit 未設定は error（fetch しない）', async () => {
    let fetched = false;
    const execFileP = async () => { fetched = true; return { stdout: '' }; };
    const r = await checkAutopilotUpdate(
        { repoRoot: '/app', baseBranch: 'develop', bootCommit: null, now: () => 3 },
        { execFileP },
    );
    assert.strictEqual(r.available, false);
    assert.match(r.error, /no boot commit/);
    assert.strictEqual(fetched, false);
});
