'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const T = require('../src/tasks');

const iso = (s) => Date.parse(s);
const cronTask = (cron, extra = {}) => ({ id: 'c', title: 'c', prompt: 'p', schedule: { type: 'cron', cron, tz: '+09:00' }, ...extra });

test('parseTzOffset', () => {
    assert.equal(T.parseTzOffset('+09:00'), 540);
    assert.equal(T.parseTzOffset('-0530'), -330);
    assert.equal(T.parseTzOffset('Z'), 0);
    assert.equal(T.parseTzOffset(undefined), 540);
    assert.equal(T.parseTzOffset('JST'), null);
});

test('parseCron: 範囲・刻み・一覧・曜日 7', () => {
    const c = T.parseCron('*/15 9-10 * * 1-5,7');
    assert.deepEqual([...c.minute], [0, 15, 30, 45]);
    assert.deepEqual([...c.hour], [9, 10]);
    assert.ok(c.dow.has(0) && !c.dow.has(6));
    assert.equal(T.parseCron('* * *'), null);
    assert.equal(T.parseCron('60 * * * *'), null);
});

test('nextCronRun: JST の平日 8:30', () => {
    const c = T.parseCron('30 8 * * 1-5');
    // 2026-11-27(金) 09:00 JST の次は 11-30(月) 08:30 JST
    assert.equal(T.nextCronRun(c, iso('2026-11-27T09:00:00+09:00'), 540), iso('2026-11-30T08:30:00+09:00'));
    // ちょうどその時刻からは次の日
    assert.equal(T.nextCronRun(c, iso('2026-11-30T08:30:00+09:00'), 540), iso('2026-12-01T08:30:00+09:00'));
});

test('nextCronRun: 日と曜日の両方の指定はどちらか', () => {
    const c = T.parseCron('0 0 1 * 0');
    // 2026-11-24(火) の次は 11-29(日)
    assert.equal(T.nextCronRun(c, iso('2026-11-24T00:00:00Z'), 0), iso('2026-11-29T00:00:00Z'));
});

test('validateTask / mergeTaskDefs: 手元が勝ち、壊れた定義は invalid', () => {
    const repo = [cronTask('0 9 * * *'), { id: 'bad', title: 'x', schedule: { type: 'cron', cron: 'nope' } }];
    const local = [{ id: 'c', enabled: false }, { id: 'n', title: 'n', prompt: 'p', schedule: { type: 'once' } }];
    const r = T.mergeTaskDefs(repo, local);
    assert.deepEqual(r.tasks.map((t) => [t.id, t.enabled, t.source]), [['c', false, 'repo'], ['n', true, 'local']]);
    assert.deepEqual(r.invalid.map((x) => x.id), ['bad']);
    assert.equal(T.validateTask({ id: 'a', title: 'a', promptFile: '../x', schedule: { type: 'once' } }).ok, false);
});

test('taskNextRunAt: once（いま・時刻）と cron', () => {
    const once = { id: 'o', title: 'o', prompt: 'p', schedule: { type: 'once' } };
    assert.equal(T.taskNextRunAt(once, { firstSeenAt: 5 }), 5);
    assert.equal(T.taskNextRunAt(once, { firstSeenAt: 5, lastRunAt: 6 }), null);
    const at = { ...once, schedule: { type: 'once', at: '2026-11-25T09:00:00+09:00' } };
    assert.equal(T.taskNextRunAt(at, {}), iso('2026-11-25T09:00:00+09:00'));
    const c = cronTask('0 9 * * *');
    assert.equal(T.taskNextRunAt(c, {}), null); // まだ見ていない
    assert.equal(T.taskNextRunAt(c, { firstSeenAt: iso('2026-11-25T10:00:00+09:00') }), iso('2026-11-26T09:00:00+09:00'));
    assert.equal(T.taskNextRunAt({ ...c, enabled: false }, { firstSeenAt: 0 }), null);
});

test('dueTasks: いま実行を先に、上限と実行中を守る', () => {
    const now = iso('2026-11-26T12:00:00+09:00');
    const tasks = [cronTask('0 9 * * *'), { id: 'o', title: 'o', prompt: 'p', schedule: { type: 'once' } }];
    const st = { c: { firstSeenAt: iso('2026-11-25T10:00:00+09:00') }, o: { firstSeenAt: now - 1000 } };
    assert.deepEqual(T.dueTasks(tasks, st, { nowMs: now, limit: 2 }).map((x) => x.id), ['c', 'o']);
    assert.deepEqual(T.dueTasks(tasks, st, { nowMs: now, limit: 1, forced: ['o'] }), [{ id: 'o', reason: 'forced' }]);
    assert.deepEqual(T.dueTasks(tasks, st, { nowMs: now, limit: 1, running: ['c'] }), []);
    assert.deepEqual(T.dueTasks(tasks, st, { nowMs: now, limit: 2, running: ['c'] }).map((x) => x.id), ['o']);
    assert.deepEqual(T.dueTasks(tasks, st, { nowMs: now, forced: ['nope'] }).map((x) => x.id), ['c']);
});

test('seedTaskState / recordTaskRun: 手の実行は cron の予定を動かさず、once は済む', () => {
    const s = T.seedTaskState([cronTask('0 9 * * *')], {}, 100);
    assert.equal(s.changed, true);
    assert.equal(T.seedTaskState([cronTask('0 9 * * *')], s.state, 200).changed, false);
    const c = cronTask('0 9 * * *');
    const r1 = T.recordTaskRun({ firstSeenAt: 1 }, { def: c, reason: 'forced', startedAt: 10, endedAt: 20, outcome: 'done' });
    assert.equal(r1.lastRunAt, undefined);
    assert.equal(r1.lastManualRunAt, 10);
    const once = { id: 'o', title: 'o', prompt: 'p', schedule: { type: 'once' } };
    assert.equal(T.recordTaskRun({}, { def: once, reason: 'forced', startedAt: 10, endedAt: 20, outcome: 'done' }).lastRunAt, 10);
});

test('taskFromInput / taskRows', () => {
    const now = iso('2026-11-25T01:02:00Z');
    const r = T.taskFromInput({ title: ' 確認 ', prompt: 'do', cron: '0 9 * * 1' }, now);
    assert.ok(r.ok);
    assert.equal(r.task.id, 't202611250102');
    assert.equal(r.task.schedule.type, 'cron');
    assert.equal(T.taskFromInput({ title: '', prompt: '' }, now).ok, false);
    const rows = T.taskRows([{ ...r.task, enabled: true }], {}, { running: [r.task.id] });
    assert.equal(rows[0].running, true);
    assert.match(rows[0].schedule, /^定期/);
});
