'use strict';
// Claude 使用量による自動 pause / 強制再開の判定（#1193）。
const { test } = require('node:test');
const assert = require('node:assert');
const {
    DEFAULT_USAGE_PAUSE_THRESHOLDS, usageResetMs, usagePausePlan, usageForceOverrides, usagePauseAction,
} = require('../src/phases');

const NOW = Date.parse('2026-10-25T10:00:00Z');
const H = 3600_000;
const usage = (session, weekly, { sessionReset = NOW + 2 * H, weeklyReset = NOW + 72 * H, updatedAt = NOW } = {}) => ({
    session: session == null ? null : { percent: session, resetsAt: sessionReset },
    weekly: weekly == null ? null : { percent: weekly, resetsAt: weeklyReset },
    updatedAt,
});

test('既定閾値はセッション 90 / 週間 95', () => {
    assert.deepStrictEqual(DEFAULT_USAGE_PAUSE_THRESHOLDS, { session: 90, weekly: 95 });
});

test('usageResetMs: 秒 / ms epoch を ms に正規化し、無効値は null', () => {
    assert.strictEqual(usageResetMs(1_800_000_000), 1_800_000_000_000);
    assert.strictEqual(usageResetMs(1_800_000_000_000), 1_800_000_000_000);
    for (const v of [null, undefined, 0, -1, NaN, '1800000000']) assert.strictEqual(usageResetMs(v), null);
});

test('閾値の境界: セッション 89.9 は止めず 90 で止める', () => {
    assert.strictEqual(usagePausePlan(usage(89.9, 10), null, {}, NOW).pause, false);
    const p = usagePausePlan(usage(90, 10), null, {}, NOW);
    assert.strictEqual(p.pause, true);
    assert.strictEqual(p.window, 'session');
    assert.strictEqual(p.percent, 90);
    assert.strictEqual(p.threshold, 90);
    assert.strictEqual(p.resetsAt, NOW + 2 * H);
});

test('閾値の境界: 週間 94.9 は止めず 95 で止める', () => {
    assert.strictEqual(usagePausePlan(usage(10, 94.9), null, {}, NOW).pause, false);
    const p = usagePausePlan(usage(10, 95), null, {}, NOW);
    assert.strictEqual(p.pause, true);
    assert.strictEqual(p.window, 'weekly');
});

test('両方超過ならセッションを理由にする', () => {
    assert.strictEqual(usagePausePlan(usage(99, 99), null, {}, NOW).window, 'session');
});

test('閾値は上書きできる（部分指定は既定とマージ）', () => {
    const p = usagePausePlan(usage(80, 10), { session: 75 }, {}, NOW);
    assert.strictEqual(p.pause, true);
    assert.deepStrictEqual(p.thresholds, { session: 75, weekly: 95 });
    assert.strictEqual(usagePausePlan(usage(99, 10), { session: 101 }, {}, NOW).pause, false);
});

test('usage なし（null / 枠の値なし）は判定しない', () => {
    assert.strictEqual(usagePausePlan(null, null, {}, NOW).pause, false);
    assert.strictEqual(usagePausePlan({ session: null, weekly: null, updatedAt: NOW }, null, {}, NOW).pause, false);
    assert.strictEqual(usagePausePlan(usage(null, 50), null, {}, NOW).pause, false);
});

test('resetsAt を過ぎた枠はリセット済みとして判定しない（据え置き usage でも自動再開できる）', () => {
    const u = usage(95, 10, { sessionReset: NOW - 1 });
    assert.strictEqual(usagePausePlan(u, null, {}, NOW).pause, false);
    // 秒 epoch でも同じ
    const u2 = usage(95, 10, { sessionReset: Math.floor((NOW - 1000) / 1000) });
    assert.strictEqual(usagePausePlan(u2, null, {}, NOW).pause, false);
});

test('resetsAt が無い枠は updatedAt が枠の長さより古ければ判定しない', () => {
    const fresh = { session: { percent: 95, resetsAt: null }, weekly: null, updatedAt: NOW - 4 * H };
    assert.strictEqual(usagePausePlan(fresh, null, {}, NOW).pause, true);
    const stale = { ...fresh, updatedAt: NOW - 5 * H };
    assert.strictEqual(usagePausePlan(stale, null, {}, NOW).pause, false);
});

test('有効な override がある枠は pause せず forced に載せる', () => {
    const overrides = { session: { resetsAt: NOW + 2 * H, percent: 92, forcedAt: NOW - H } };
    const p = usagePausePlan(usage(93, 10), null, overrides, NOW);
    assert.strictEqual(p.pause, false);
    assert.deepStrictEqual(p.forced, [{ window: 'session', percent: 93, threshold: 90, resetsAt: NOW + 2 * H }]);
    assert.deepStrictEqual(p.overrides, overrides);
});

test('override 期限切れは外れて通常判定に戻る', () => {
    const overrides = { session: { resetsAt: NOW - 1, percent: 92, forcedAt: NOW - 3 * H } };
    // 新しい枠でも再び 90% を超えていれば改めて pause
    const p = usagePausePlan(usage(91, 10, { sessionReset: NOW + 5 * H }), null, overrides, NOW);
    assert.strictEqual(p.pause, true);
    assert.deepStrictEqual(p.overrides, {});
    assert.deepStrictEqual(p.forced, []);
});

test('override は枠ごと: セッション強制中でも週間超過で pause する', () => {
    const overrides = { session: { resetsAt: NOW + 2 * H, percent: 92, forcedAt: NOW } };
    const p = usagePausePlan(usage(93, 96), null, overrides, NOW);
    assert.strictEqual(p.pause, true);
    assert.strictEqual(p.window, 'weekly');
    assert.strictEqual(p.forced.length, 1);
});

test('usageForceOverrides: 超過中の枠だけに次のリセットまでの override を付ける', () => {
    const o = usageForceOverrides(usage(92, 50), null, {}, NOW);
    assert.deepStrictEqual(o, { session: { resetsAt: NOW + 2 * H, percent: 92, forcedAt: NOW } });
    assert.strictEqual(usagePausePlan(usage(92, 50), null, o, NOW).pause, false);
    // 両方超過なら両方
    const both = usageForceOverrides(usage(92, 97), null, {}, NOW);
    assert.deepStrictEqual(Object.keys(both).sort(), ['session', 'weekly']);
    assert.strictEqual(both.weekly.resetsAt, NOW + 72 * H);
});

test('usageForceOverrides: 期限内の既存 override は引き継ぎ、期限切れは捨てる', () => {
    const keep = { session: { resetsAt: NOW + H, percent: 91, forcedAt: NOW - H } };
    assert.deepStrictEqual(usageForceOverrides(usage(95, 10), null, keep, NOW), keep);
    const expired = { weekly: { resetsAt: NOW - 1, percent: 96, forcedAt: NOW - 100 * H } };
    assert.deepStrictEqual(usageForceOverrides(usage(10, 10), null, expired, NOW), {});
});

test('usageForceOverrides: resetsAt が無い枠は枠の長さを期限にする', () => {
    const u = { session: { percent: 95, resetsAt: null }, weekly: null, updatedAt: NOW };
    assert.strictEqual(usageForceOverrides(u, null, {}, NOW).session.resetsAt, NOW + 5 * H);
});

test('usagePauseAction: 未 pause → pause、usage pause 中に閾値割れ → resume', () => {
    assert.strictEqual(usagePauseAction({ paused: false, pausedBy: null }, { pause: true }), 'pause');
    assert.strictEqual(usagePauseAction({ paused: true, pausedBy: 'usage' }, { pause: true }), null);
    assert.strictEqual(usagePauseAction({ paused: true, pausedBy: 'usage' }, { pause: false }), 'resume');
    assert.strictEqual(usagePauseAction({ paused: false, pausedBy: null }, { pause: false }), null);
});

test('usagePauseAction: human / auth の pause は上書きも自動再開もしない', () => {
    for (const by of ['human', 'auth']) {
        assert.strictEqual(usagePauseAction({ paused: true, pausedBy: by }, { pause: true }), null);
        assert.strictEqual(usagePauseAction({ paused: true, pausedBy: by }, { pause: false }), null);
    }
});
