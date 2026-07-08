'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {
    transcriptSlug, transcriptDir, findRateLimits, toWindow, parseClaudeUsage, readClaudeUsage,
} = require('../src/usage');

test('transcriptSlug: 英数字以外を - に置換（Claude Code の規則）', () => {
    assert.strictEqual(
        transcriptSlug('/app/.autopilot-worktrees/issue-879'),
        '-app--autopilot-worktrees-issue-879',
    );
    assert.strictEqual(transcriptSlug('/app'), '-app');
});

test('transcriptDir: home/.claude/projects/<slug>', () => {
    assert.strictEqual(
        transcriptDir('/app/x', '/home/me'),
        path.join('/home/me', '.claude', 'projects', '-app-x'),
    );
});

test('findRateLimits: 位置に依存せず rate_limits を再帰的に見つける', () => {
    const rl = { five_hour: { used_percentage: 1 }, seven_day: { used_percentage: 2 } };
    assert.deepStrictEqual(findRateLimits({ rate_limits: rl }), rl);
    assert.deepStrictEqual(findRateLimits({ a: { b: { rate_limits: rl } } }), rl);
    assert.strictEqual(findRateLimits({ foo: 1 }), null);
    assert.strictEqual(findRateLimits(null), null);
    // five_hour も seven_day も無い rate_limits は無視
    assert.strictEqual(findRateLimits({ rate_limits: { other: 1 } }), null);
});

test('toWindow: used_percentage/resets_at を正規化、無効値は null', () => {
    assert.deepStrictEqual(toWindow({ used_percentage: 23.5, resets_at: 1738425600 }),
        { percent: 23.5, resetsAt: 1738425600 });
    assert.deepStrictEqual(toWindow({ used_percentage: 10 }), { percent: 10, resetsAt: null });
    assert.strictEqual(toWindow({}), null);
    assert.strictEqual(toWindow(null), null);
});

test('parseClaudeUsage: JSONL から five_hour→session / seven_day→weekly を抽出', () => {
    const jsonl = [
        JSON.stringify({ type: 'user', message: {} }),
        JSON.stringify({
            type: 'assistant',
            message: {
                usage: {
                    rate_limits: {
                        five_hour: { used_percentage: 23.5, resets_at: 1738425600 },
                        seven_day: { used_percentage: 41.2, resets_at: 1738857600 },
                    },
                },
            },
        }),
    ].join('\n');
    const u = parseClaudeUsage(jsonl);
    assert.deepStrictEqual(u.session, { percent: 23.5, resetsAt: 1738425600 });
    assert.deepStrictEqual(u.weekly, { percent: 41.2, resetsAt: 1738857600 });
});

test('parseClaudeUsage: 複数行あれば後勝ち（最新行）を採用', () => {
    const jsonl = [
        JSON.stringify({ rate_limits: { five_hour: { used_percentage: 10 } } }),
        JSON.stringify({ rate_limits: { five_hour: { used_percentage: 55 } } }),
    ].join('\n');
    assert.strictEqual(parseClaudeUsage(jsonl).session.percent, 55);
});

test('parseClaudeUsage: rate_limits が無ければ null（非サブスク/初回応答前）', () => {
    assert.strictEqual(parseClaudeUsage(''), null);
    assert.strictEqual(parseClaudeUsage('{"type":"user"}\nnot-json\n'), null);
});

test('readClaudeUsage: transcript ディレクトリの jsonl から使用量を読む', () => {
    const home = fs.mkdtempSync(path.join(os.tmpdir(), 'usage-home-'));
    const dir = transcriptDir('/app/proj', home);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'sess.jsonl'), JSON.stringify({
        message: { usage: { rate_limits: {
            five_hour: { used_percentage: 12.5, resets_at: 100 },
            seven_day: { used_percentage: 80, resets_at: 200 },
        } } },
    }) + '\n');
    const u = readClaudeUsage('/app/proj', { home, now: () => 999 });
    assert.strictEqual(u.session.percent, 12.5);
    assert.strictEqual(u.weekly.percent, 80);
    assert.strictEqual(u.updatedAt, 999);
});

test('readClaudeUsage: ディレクトリ無し / 使用量無しは null（グレースフル）', () => {
    const home = fs.mkdtempSync(path.join(os.tmpdir(), 'usage-home-'));
    assert.strictEqual(readClaudeUsage('/nope/x', { home }), null);
    const dir = transcriptDir('/app/empty', home);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'a.jsonl'), '{"type":"user"}\n');
    assert.strictEqual(readClaudeUsage('/app/empty', { home }), null);
});
