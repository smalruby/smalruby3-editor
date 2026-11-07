'use strict';

// コンフリクトの検知と AI による解消（#1348）。
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const {
    PHASE_BY_COMMAND,
    prConflictState,
    canResolveConflict,
    resolveConflictFailureBody,
    normalizeBoardEnrichment,
    phaseForItem,
} = require('../src/phases');
const { followBaseBranch, runConflictResolver, resolveInline, dispatchResolveConflict } = require('../src/daemon');
const { MONITOR_HTML } = require('../src/monitor');

test('resolve-conflict フェーズは AI Status=Resolving Conflicts に対応する', () => {
    assert.deepEqual(PHASE_BY_COMMAND['resolve-conflict'], {
        skill: 'autopilot-resolve-conflict', aiStatus: 'Resolving Conflicts',
    });
    assert.ok(fs.existsSync(path.join(__dirname, '..', 'prompts', 'autopilot-resolve-conflict.md')));
});

test('phaseForItem は resolve-conflict を自動で選ばない（ボタンか着手時の追従からだけ起動する）', () => {
    for (const status of ['Review', 'DoD', 'Blocked', 'In Progress', 'Sprint Backlog']) {
        for (const hitlLabel of [false, true]) {
            const phase = phaseForItem({ issue: 1, status, aiStatus: 'Resolving Conflicts', hitlLabel, labels: [] }, { pr: 1 });
            assert.notEqual(phase, 'resolve-conflict');
        }
    }
});

test('normalizeBoardEnrichment は PR の mergeable を持ち回る', () => {
    const out = normalizeBoardEnrichment({
        state: 'OPEN',
        closedByPullRequestsReferences: { nodes: [
            { number: 1, state: 'OPEN', isDraft: false, mergeable: 'CONFLICTING' },
            { number: 2, state: 'MERGED', isDraft: false },
        ] },
    });
    assert.equal(out.prs[0].mergeable, 'CONFLICTING');
    assert.equal(out.prs[1].mergeable, null);
});

test('prConflictState: OPEN の PR だけを見て conflict / unknown / clean / null を返す', () => {
    assert.equal(prConflictState([]), null);
    assert.equal(prConflictState([{ state: 'MERGED', mergeable: 'CONFLICTING' }]), null);
    assert.equal(prConflictState([{ state: 'OPEN', mergeable: 'CONFLICTING' }]), 'conflict');
    assert.equal(prConflictState([{ state: 'OPEN', mergeable: 'UNKNOWN' }]), 'unknown');
    assert.equal(prConflictState([{ state: 'OPEN', mergeable: null }]), 'unknown');
    assert.equal(prConflictState([{ state: 'OPEN', mergeable: 'MERGEABLE' }]), 'clean');
    assert.equal(prConflictState([
        { state: 'OPEN', mergeable: 'MERGEABLE' }, { state: 'OPEN', mergeable: 'CONFLICTING' },
    ]), 'conflict');
});

test('canResolveConflict: コンフリクトした OPEN の PR があり、終端でなく、実行中でないときだけ', () => {
    const it = { issue: 5, status: 'Review', prs: [{ state: 'OPEN', mergeable: 'CONFLICTING' }] };
    assert.equal(canResolveConflict(it, []), true);
    assert.equal(canResolveConflict(it, [5]), false);
    assert.equal(canResolveConflict({ ...it, status: 'Close' }, []), false);
    assert.equal(canResolveConflict({ ...it, prs: [{ state: 'OPEN', mergeable: 'UNKNOWN' }] }, []), false);
    assert.equal(canResolveConflict({ ...it, prs: [] }, []), false);
    assert.equal(canResolveConflict(null, []), false);
});

test('canResolveConflict はブラウザに埋め込める（自己完結）', () => {
    // eslint-disable-next-line no-new-func
    const fn = new Function(`${String(canResolveConflict)}; return canResolveConflict;`)();
    assert.equal(fn({ issue: 1, status: 'Blocked', prs: [{ state: 'OPEN', mergeable: 'CONFLICTING' }] }, []), true);
    assert.match(MONITOR_HTML, /function canResolveConflict/);
    assert.match(MONITOR_HTML, /\/resolve-conflict\?issue=/);
});

test('resolveConflictFailureBody はファイルと理由を載せ、🙋 を外す案内をする', () => {
    const body = resolveConflictFailureBody('origin/develop', ['package-lock.json', 'a.js'], 'テストが通らない');
    assert.match(body, /`origin\/develop`/);
    assert.match(body, /- `package-lock.json`\n- `a.js`/);
    assert.match(body, /テストが通らない/);
    assert.match(body, /🙋 HITL/);
});

// ---- git をまねる exec ----
function fakeExec(handlers, calls) {
    return async (cmd, args) => {
        const key = [path.basename(cmd), ...args].join(' ');
        calls.push(key);
        for (const [re, fn] of handlers) {
            if (re.test(key)) return fn(key);
        }
        return { stdout: '' };
    };
}
const fail = (msg) => () => { const e = new Error(msg); e.stderr = msg; throw e; };

test('followBaseBranch: コンフリクトしたファイルを返し、keepConflict なら merge を中断しない', async () => {
    const handlers = [
        [/^git rev-list --count/, () => ({ stdout: '4\n' })],
        [/^bot-git merge/, fail('CONFLICT (content): Merge conflict in package-lock.json')],
        [/^git diff --name-only --diff-filter=U/, () => ({ stdout: 'package-lock.json\n' })],
    ];
    const kept = [];
    const r1 = await followBaseBranch('/w', 'develop', () => {}, { execFileP: fakeExec(handlers, kept), botGitBin: 'bot-git', keepConflict: true });
    assert.equal(r1.status, 'conflict');
    assert.deepEqual(r1.files, ['package-lock.json']);
    assert.ok(!kept.some((c) => c.startsWith('git merge --abort')));

    const aborted = [];
    const r2 = await followBaseBranch('/w', 'develop', () => {}, { execFileP: fakeExec(handlers, aborted), botGitBin: 'bot-git' });
    assert.equal(r2.status, 'conflict');
    assert.ok(aborted.some((c) => c.startsWith('git merge --abort')));
});

function resolverFixture({ signal = 'done', merging = false, remoteHead = 'abc', pr = 10 } = {}) {
    const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'rc-'));
    const calls = [];
    const exec = fakeExec([
        [/^git rev-parse -q --verify MERGE_HEAD/, () => (merging ? { stdout: 'x' } : fail('no')())],
        [/^git diff --name-only --diff-filter=U/, () => ({ stdout: '' })],
        [/^git merge-base --is-ancestor/, () => ({ stdout: '' })],
        [/^git rev-parse HEAD/, () => ({ stdout: 'abc\n' })],
        [/^git rev-parse --abbrev-ref HEAD/, () => ({ stdout: 'topic/autopilot-1\n' })],
        [/^git rev-parse origin\//, () => ({ stdout: `${remoteHead}\n` })],
    ], calls);
    let env = null;
    const deps = {
        execFileP: exec,
        workerCommand: () => ({ command: 'true', promptDir: undefined }),
        runPhase: async (o) => { env = o.env; return { ok: true }; },
        readResultFile: () => ({ ok: true, result: { signal, summary: 'lock を作り直した' } }),
    };
    const p = {
        issue: 1, cwd, baseBranch: 'develop', baseRef: 'origin/develop', files: ['package-lock.json'], pr,
        cfg: { project: 4, repo: 'o/r' }, log: () => {}, deps,
    };
    return { p, calls, getEnv: () => env };
}

test('runConflictResolver: 解消・push 済みなら ok。worker にファイルと PR を渡す', async () => {
    const f = resolverFixture();
    const r = await runConflictResolver(f.p);
    assert.deepEqual(r, { ok: true, summary: 'lock を作り直した' });
    assert.equal(f.getEnv().AUTOPILOT_CONFLICT_FILES, 'package-lock.json');
    assert.equal(f.getEnv().AUTOPILOT_PR, '10');
    assert.equal(f.getEnv().AUTOPILOT_BASE_REF, 'origin/develop');
});

test('runConflictResolver: worker が hitl なら失敗として返す', async () => {
    const f = resolverFixture({ signal: 'hitl', merging: true });
    const r = await runConflictResolver(f.p);
    assert.equal(r.ok, false);
    assert.ok(f.calls.some((c) => c.startsWith('git merge --abort')));
});

test('runConflictResolver: done でも merge 途中・未 push なら失敗にする', async () => {
    const merging = await runConflictResolver(resolverFixture({ merging: true }).p);
    assert.equal(merging.ok, false);
    assert.match(merging.reason, /MERGE_HEAD/);
    const unpushed = await runConflictResolver(resolverFixture({ remoteHead: 'old' }).p);
    assert.equal(unpushed.ok, false);
    assert.match(unpushed.reason, /push/);
    // PR が無ければリモートは確かめない
    const noPr = await runConflictResolver(resolverFixture({ remoteHead: 'old', pr: null }).p);
    assert.equal(noPr.ok, true);
});

function dispatchFixture({ follow, resolver } = {}) {
    const writes = [];
    const comments = [];
    const faces = [];
    const stops = [];
    const state = {
        running: new Map(),
        history: [],
        board: { items: [{ issue: 7, status: 'Review', aiStatus: null, prs: [{ number: 70, state: 'OPEN', mergeable: 'CONFLICTING' }] }] },
        itemsCache: { items: [{ issue: 7, itemId: 'I7', status: 'Review', aiStatus: null, hitlLabel: true, labels: [] }] },
    };
    const cfg = { now: () => 1000, repo: 'o/r', owner: 'o', project: 4, projectId: 'P', fields: {} };
    const deps = {
        readToken: async () => 'r',
        botToken: async () => 'b',
        getDirectives: async () => ({ base: null }),
        ensureWorktree: async () => '/w',
        followBaseBranch: async () => follow,
        runConflictResolver: async () => resolver,
        setField: async (ctx, itemId, field, value) => writes.push([field, value]),
        postIssueComment: async (repo, issue, body) => comments.push(body),
        syncFaces: async (it) => faces.push(it),
        execFileP: async () => ({ stdout: '' }),
        stopDevServers: (opts) => { stops.push(opts.issues); return []; },
    };
    return { state, cfg, deps, writes, comments, faces, stops };
}

test('dispatchResolveConflict: 解消できたら AI Status を元に戻し、Status には触らない', async () => {
    const f = dispatchFixture({
        follow: { status: 'conflict', baseRef: 'origin/develop', files: ['package-lock.json'] },
        resolver: { ok: true, summary: 'ok' },
    });
    await dispatchResolveConflict({ issue: 7, pr: 70 }, f.cfg, f.state, () => {}, f.deps);
    assert.deepEqual(f.writes, [['AI Status', 'Resolving Conflicts'], ['AI Status', null]]);
    assert.equal(f.comments.length, 0);
    assert.equal(f.state.running.size, 0);
    assert.equal(f.state.board.items[0].prs[0].mergeable, 'MERGEABLE');
    assert.equal(f.state.history[0].outcome, 'done');
    // run が終わったら、その worktree の dev server を止める（#1381）
    assert.deepEqual(f.stops, [[7]]);
});

test('dispatchResolveConflict: 解消できなければコメントして 🙋 を付ける（Status は変えない）', async () => {
    const f = dispatchFixture({
        follow: { status: 'conflict', baseRef: 'origin/develop', files: ['a.js'] },
        resolver: { ok: false, reason: '仕様の判断が要る' },
    });
    await dispatchResolveConflict({ issue: 7, pr: 70 }, f.cfg, f.state, () => {}, f.deps);
    assert.ok(f.writes.every(([field]) => field === 'AI Status'));
    assert.equal(f.comments.length, 1);
    assert.match(f.comments[0], /仕様の判断が要る/);
    assert.equal(f.faces.length, 1);
    assert.equal(f.faces[0].hitlLabel, true);
    assert.equal(f.faces[0].status, 'Review');
    assert.equal(f.state.history[0].outcome, 'hitl');
});

test('dispatchResolveConflict: clean に merge できたら worker を起動せず push だけ', async () => {
    let resolverCalled = false;
    const f = dispatchFixture({ follow: { status: 'followed', baseRef: 'origin/develop' } });
    f.deps.runConflictResolver = async () => { resolverCalled = true; return { ok: true }; };
    const pushed = [];
    f.deps.execFileP = async (cmd, args) => { pushed.push(args.join(' ')); return { stdout: '' }; };
    await dispatchResolveConflict({ issue: 7, pr: 70 }, f.cfg, f.state, () => {}, f.deps);
    assert.equal(resolverCalled, false);
    assert.deepEqual(pushed, ['push origin HEAD']);
    assert.deepEqual(f.writes, []);
});

test('dispatchResolveConflict: PR が無ければ何もしない', async () => {
    const f = dispatchFixture({ follow: { status: 'current', baseRef: 'origin/develop' } });
    f.deps.findPrForIssue = async () => null;
    await dispatchResolveConflict({ issue: 7 }, f.cfg, f.state, () => {}, f.deps);
    assert.equal(f.state.history[0].outcome, 'skipped');
    assert.deepEqual(f.writes, []);
});

test('resolveInline: 着手時のコンフリクトは解消中だけ phase と AI Status を切り替える', async () => {
    const state = { running: new Map([[3, { phase: 'address-review', session: 's', since: 0 }]]), board: null };
    const ai = [];
    let seenPhase = null;
    const r = await resolveInline({ issue: 3 }, {
        cwd: '/w', baseBranch: 'develop', follow: { baseRef: 'origin/develop', files: ['x'] }, pr: 30,
        cfg: {}, state, log: () => {}, setAi: async (v) => ai.push(v),
        runConflictResolver: async (q) => { seenPhase = state.running.get(3).phase; assert.equal(q.pr, 30); return { ok: true, summary: 's' }; },
    });
    assert.equal(r.ok, true);
    assert.equal(seenPhase, 'resolve-conflict');
    assert.equal(state.running.get(3).phase, 'address-review');
    assert.deepEqual(ai, ['Resolving Conflicts']);
});
