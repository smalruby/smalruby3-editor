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
    // updatedAt は「読取時刻(now)」ではなく usage ファイルの mtime を使う（#1027）。
    // 高頻度に読み直しても、古いファイルなら age が正しく増える（stale を隠さない）。
    const u = readClaudeUsage(file, { now: () => 999, statSync: () => ({ mtimeMs: 555000 }) });
    assert.strictEqual(u.session.percent, 12.5);
    assert.strictEqual(u.weekly.percent, 80);
    assert.strictEqual(u.updatedAt, 555000);
});

test('readClaudeUsage: updatedAt は実ファイルの mtime（読取時刻ではない）', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'usage-file-'));
    const file = path.join(dir, 'claude-usage.json');
    fs.writeFileSync(file, JSON.stringify({
        rate_limits: { five_hour: { used_percentage: 5 } },
    }) + '\n');
    // mtime を過去（60 秒前）に固定し、それが updatedAt に反映されることを確認する。
    const mtimeMs = fs.statSync(file).mtimeMs - 60_000;
    fs.utimesSync(file, mtimeMs / 1000, mtimeMs / 1000);
    const u = readClaudeUsage(file);
    // fs の mtime 精度で丸めが入りうるので近似で比較（ms 未満は許容）
    assert.ok(Math.abs(u.updatedAt - mtimeMs) < 1000, `updatedAt=${u.updatedAt} mtimeMs=${mtimeMs}`);
});

test('readClaudeUsage: mtime を再取得しても古いファイルなら age が誤って 0 にならない', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'usage-file-'));
    const file = path.join(dir, 'claude-usage.json');
    fs.writeFileSync(file, JSON.stringify({
        rate_limits: { five_hour: { used_percentage: 5 } },
    }) + '\n');
    // 「今」が進んでもファイルが更新されなければ updatedAt は一定（= mtime）のまま。
    const first = readClaudeUsage(file, { now: () => 1000, statSync: () => ({ mtimeMs: 100 }) });
    const second = readClaudeUsage(file, { now: () => 9999, statSync: () => ({ mtimeMs: 100 }) });
    assert.strictEqual(first.updatedAt, 100);
    assert.strictEqual(second.updatedAt, 100);
});

test('readClaudeUsage: stat 失敗時は now() にフォールバック', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'usage-file-'));
    const file = path.join(dir, 'claude-usage.json');
    fs.writeFileSync(file, JSON.stringify({
        rate_limits: { five_hour: { used_percentage: 5 } },
    }) + '\n');
    const u = readClaudeUsage(file, {
        now: () => 42,
        statSync: () => { throw new Error('stat failed'); },
    });
    assert.strictEqual(u.updatedAt, 42);
});

test('readClaudeUsage: ファイル無し / 使用量無しは null（グレースフル）', () => {
    assert.strictEqual(readClaudeUsage('/no/such/file.json'), null);
    assert.strictEqual(readClaudeUsage(''), null);
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'usage-file-'));
    const file = path.join(dir, 'empty.json');
    fs.writeFileSync(file, '{"cwd":"/x"}\n');
    assert.strictEqual(readClaudeUsage(file), null);
});
