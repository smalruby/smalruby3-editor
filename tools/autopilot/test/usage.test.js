'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {
    findRateLimits, toWindow, parseClaudeUsage, readClaudeUsage,
} = require('../src/usage');

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

test('parseClaudeUsage: status line JSON から five_hour→session / seven_day→weekly を抽出', () => {
    // 実際の status line stdin JSON の形（トップレベル rate_limits）
    const text = JSON.stringify({
        rate_limits: {
            five_hour: { used_percentage: 23.5, resets_at: 1738425600 },
            seven_day: { used_percentage: 41.2, resets_at: 1738857600 },
        },
    });
    const u = parseClaudeUsage(text);
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
    assert.strictEqual(parseClaudeUsage('{"cwd":"/x"}\nnot-json\n'), null);
});

test('readClaudeUsage: usage ファイルから使用量を読む', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'usage-file-'));
    const file = path.join(dir, 'claude-usage.json');
    fs.writeFileSync(file, JSON.stringify({
        rate_limits: {
            five_hour: { used_percentage: 12.5, resets_at: 100 },
            seven_day: { used_percentage: 80, resets_at: 200 },
        },
    }) + '\n');
    const u = readClaudeUsage(file, { now: () => 999 });
    assert.strictEqual(u.session.percent, 12.5);
    assert.strictEqual(u.weekly.percent, 80);
    assert.strictEqual(u.updatedAt, 999);
});

test('readClaudeUsage: ファイル無し / 使用量無しは null（グレースフル）', () => {
    assert.strictEqual(readClaudeUsage('/no/such/file.json'), null);
    assert.strictEqual(readClaudeUsage(''), null);
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'usage-file-'));
    const file = path.join(dir, 'empty.json');
    fs.writeFileSync(file, '{"cwd":"/x"}\n');
    assert.strictEqual(readClaudeUsage(file), null);
});
