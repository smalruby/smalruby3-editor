'use strict';
// merge で Close した Issue の worktree / ローカルブランチの自動片付け（#1362）
const { test } = require('node:test');
const assert = require('node:assert');
const { shouldCleanupWorktree } = require('../src/phases');
const { cleanupIssueWorktree, applyMergeProgression, applyClosedReconcile } = require('../src/daemon');

test('shouldCleanupWorktree: 実行中 / 未コミット / 未マージ / ブランチ無しは消さない', () => {
    assert.deepEqual(shouldCleanupWorktree({ running: true, dirty: false, branch: 'b', mergedIntoBase: true }),
        { cleanup: false, reason: 'running' });
    assert.deepEqual(shouldCleanupWorktree({ running: false, dirty: true, branch: 'b', mergedIntoBase: true }),
        { cleanup: false, reason: 'dirty' });
    assert.deepEqual(shouldCleanupWorktree({ running: false, dirty: false, branch: null, mergedIntoBase: true }),
        { cleanup: false, reason: 'detached' });
    assert.deepEqual(shouldCleanupWorktree({ running: false, dirty: false, branch: 'b', mergedIntoBase: false }),
        { cleanup: false, reason: 'not-merged' });
    // 判定できなかった事実（undefined）は安全側＝消さない
    assert.equal(shouldCleanupWorktree({ running: false }).cleanup, false);
    assert.equal(shouldCleanupWorktree({}).cleanup, false);
});

test('shouldCleanupWorktree: クリーン・base にマージ済み・非実行中なら消す', () => {
    assert.deepEqual(shouldCleanupWorktree({ running: false, dirty: false, branch: 'b', mergedIntoBase: true }),
        { cleanup: true, reason: null });
});

/**
 * git / autopilot-worktree 呼び出しを記録する execFileP の偽物。
 * @param {object} o status / branch / ancestor(true|false|'error') の挙動
 */
function makeExec({ status = '', branch = 'topic/autopilot-7', ancestor = true } = {}) {
    const calls = [];
    const exec = async (cmd, args, opts = {}) => {
        calls.push({ cmd, args, cwd: opts.cwd });
        if (/autopilot-worktree$/.test(cmd) && args[0] === 'path') return { stdout: `/wt/issue-${args[1]}\n` };
        if (cmd !== 'git') throw new Error(`unexpected ${cmd}`);
        const sub = args[0];
        if (sub === 'status') return { stdout: status };
        if (sub === 'symbolic-ref') {
            if (!branch) throw Object.assign(new Error('not a symbolic ref'), { code: 128 });
            return { stdout: `${branch}\n` };
        }
        if (sub === 'fetch') return { stdout: '' };
        if (sub === 'merge-base') {
            if (ancestor === true) return { stdout: '' };
            if (ancestor === false) throw Object.assign(new Error('not ancestor'), { code: 1 });
            throw Object.assign(new Error('fatal: bad object'), { code: 128 });
        }
        if (sub === 'worktree' || sub === 'branch') return { stdout: '' };
        throw new Error(`unexpected git ${sub}`);
    };
    return { exec, calls };
}

function baseDeps(exec, extra = {}) {
    return {
        execFileP: exec,
        existsSync: () => true,
        getDirectives: async () => ({ base: null, after: [] }),
        ...extra,
    };
}

const cfg = { repo: 'smalruby/smalruby3-editor' };
const removedOps = (calls) => calls.filter((c) => c.cmd === 'git' && ['worktree', 'branch'].includes(c.args[0]));

test('cleanupIssueWorktree: マージ済みでクリーンなら worktree とローカルブランチを消す', async () => {
    const { exec, calls } = makeExec();
    const logs = [];
    const r = await cleanupIssueWorktree({ issue: 7 }, cfg, { running: new Map() }, (m) => logs.push(m), baseDeps(exec));
    assert.equal(r.status, 'removed');
    const ops = removedOps(calls).map((c) => c.args);
    assert.deepEqual(ops, [
        ['worktree', 'remove', '--force', '/wt/issue-7'],
        ['branch', '-D', 'topic/autopilot-7'],
    ]);
    // base は既定 develop で判定する
    const mb = calls.find((c) => c.args[0] === 'merge-base');
    assert.deepEqual(mb.args, ['merge-base', '--is-ancestor', 'topic/autopilot-7', 'origin/develop']);
    assert.ok(logs.some((m) => /片付け/.test(m)));
});

test('cleanupIssueWorktree: EPIC サブ（autopilot-base あり）は宣言 base で判定する', async () => {
    const { exec, calls } = makeExec();
    await cleanupIssueWorktree({ issue: 7 }, cfg, { running: new Map() }, () => {},
        baseDeps(exec, { getDirectives: async () => ({ base: 'topic/epic-1', after: [] }) }));
    assert.deepEqual(calls.find((c) => c.args[0] === 'fetch').args, ['fetch', 'origin', 'topic/epic-1']);
    assert.equal(calls.find((c) => c.args[0] === 'merge-base').args[3], 'origin/topic/epic-1');
});

test('cleanupIssueWorktree: 未コミット変更があれば消さず理由をログ', async () => {
    const { exec, calls } = makeExec({ status: ' M src/a.js\n' });
    const logs = [];
    const r = await cleanupIssueWorktree({ issue: 7 }, cfg, { running: new Map() }, (m) => logs.push(m), baseDeps(exec));
    assert.equal(r.status, 'kept');
    assert.equal(r.reason, 'dirty');
    assert.equal(removedOps(calls).length, 0);
    assert.ok(logs.some((m) => /#7/.test(m) && /未コミット/.test(m)));
});

test('cleanupIssueWorktree: base にマージされていなければ消さない', async () => {
    const { exec, calls } = makeExec({ ancestor: false });
    const logs = [];
    const r = await cleanupIssueWorktree({ issue: 7 }, cfg, { running: new Map() }, (m) => logs.push(m), baseDeps(exec));
    assert.equal(r.reason, 'not-merged');
    assert.equal(removedOps(calls).length, 0);
    assert.ok(logs.some((m) => /origin\/develop/.test(m)));
});

test('cleanupIssueWorktree: merge-base が判定不能（エラー）でも消さない', async () => {
    const { exec, calls } = makeExec({ ancestor: 'error' });
    const r = await cleanupIssueWorktree({ issue: 7 }, cfg, { running: new Map() }, () => {}, baseDeps(exec));
    assert.equal(r.status, 'error');
    assert.equal(removedOps(calls).length, 0);
});

test('cleanupIssueWorktree: 実行中なら git に触らず消さない', async () => {
    const { exec, calls } = makeExec();
    const r = await cleanupIssueWorktree({ issue: 7 }, cfg, { running: new Map([[7, {}]]) }, () => {}, baseDeps(exec));
    assert.equal(r.reason, 'running');
    assert.equal(calls.filter((c) => c.cmd === 'git').length, 0);
});

test('cleanupIssueWorktree: worktree が無ければ何もしない', async () => {
    const { exec, calls } = makeExec();
    const r = await cleanupIssueWorktree({ issue: 7 }, cfg, { running: new Map() }, () => {},
        baseDeps(exec, { existsSync: () => false }));
    assert.equal(r.status, 'absent');
    assert.equal(calls.filter((c) => c.cmd === 'git').length, 0);
});

test('cleanupIssueWorktree: detached HEAD は消さない', async () => {
    const { exec, calls } = makeExec({ branch: null });
    const r = await cleanupIssueWorktree({ issue: 7 }, cfg, { running: new Map() }, () => {}, baseDeps(exec));
    assert.equal(r.reason, 'detached');
    assert.equal(removedOps(calls).length, 0);
});

test('cleanupIssueWorktree: autopilot 以外のブランチは worktree だけ消してブランチは残す', async () => {
    const { exec, calls } = makeExec({ branch: 'topic/human-feature' });
    const r = await cleanupIssueWorktree({ issue: 7 }, cfg, { running: new Map() }, () => {}, baseDeps(exec));
    assert.equal(r.status, 'removed');
    assert.deepEqual(removedOps(calls).map((c) => c.args[0]), ['worktree']);
});

test('cleanupIssueWorktree: 削除の失敗は例外にせずログのみ', async () => {
    const { exec: inner } = makeExec();
    const exec = async (cmd, args, opts) => {
        if (cmd === 'git' && args[0] === 'worktree') throw new Error('boom');
        return inner(cmd, args, opts);
    };
    const logs = [];
    const r = await cleanupIssueWorktree({ issue: 7 }, cfg, { running: new Map() }, (m) => logs.push(m), baseDeps(exec));
    assert.equal(r.status, 'error');
    assert.ok(logs.some((m) => /boom/.test(m)));
});

const mergeDeps = (extra) => ({
    token: 't',
    applyIntents: (ctx, itemId, intents) => intents.map((i) => `${i.field}=${i.value}`),
    findItemId: () => 'x',
    closeIssue: () => {},
    syncFaces: () => {},
    ...extra,
});

test('applyMergeProgression: Close に進めた Issue だけ worktree を片付ける（🧱 infra も対象）', async () => {
    const items = [
        { issue: 1, itemId: 'i1', status: 'Review', kind: 'Issue' },
        { issue: 2, itemId: 'i2', status: 'Review', kind: 'Issue' }, // 未 merge
        { issue: 3, itemId: 'i3', status: 'Review', kind: 'Issue', labels: ['🧱 infra'] },
    ];
    const cleaned = [];
    await applyMergeProgression(items, cfg, { running: new Map() }, () => {}, mergeDeps({
        hasMergedPullRequest: (repo, issue) => issue !== 2,
        cleanupWorktree: async (item) => { cleaned.push(item.issue); },
    }));
    assert.deepEqual(cleaned, [1, 3]);
});

test('applyMergeProgression: 片付けの失敗は merge 進行を止めない', async () => {
    const items = [
        { issue: 1, itemId: 'i1', status: 'Review', kind: 'Issue' },
        { issue: 2, itemId: 'i2', status: 'Review', kind: 'Issue' },
    ];
    const applied = [];
    const logs = [];
    await applyMergeProgression(items, cfg, { running: new Map() }, (m) => logs.push(m), mergeDeps({
        hasMergedPullRequest: () => true,
        applyIntents: (ctx, itemId) => { applied.push(itemId); return []; },
        cleanupWorktree: async () => { throw new Error('cleanup boom'); },
    }));
    assert.deepEqual(applied, ['i1', 'i2']);
    assert.equal(items[1].status, 'Close');
    assert.ok(logs.some((m) => /cleanup boom/.test(m)));
});

test('applyClosedReconcile: closed で Close に整合した Issue の worktree も片付ける', async () => {
    const items = [
        { issue: 10, itemId: 'a', status: 'Review', kind: 'Issue' },
        { issue: 11, itemId: 'b', status: 'In Progress', kind: 'Issue' }, // open
    ];
    const cleaned = [];
    await applyClosedReconcile(items, cfg, { running: new Map() }, () => {}, {
        token: 't',
        closedSet: new Set([10]),
        applyIntents: () => [],
        findItemId: () => 'x',
        syncFaces: () => {},
        cleanupWorktree: async (item) => { cleaned.push(item.issue); },
    });
    assert.deepEqual(cleaned, [10]);
});
