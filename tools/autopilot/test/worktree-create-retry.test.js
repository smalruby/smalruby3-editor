'use strict';

// Regression tests for Issue #1226: `bin/autopilot-worktree create` must survive a
// `.git/config` lock conflict that happens *after* `git worktree add -b` already
// created the branch ref.
//
// Why: `git worktree add -b <branch> <wt> <start>` creates `refs/heads/<branch>`
// first and only then locks the shared `.git/config` to record the upstream. When
// two creates run in parallel (two Issues dispatched in the same tick), the lock
// fails, the ref stays behind, and the old retry re-ran the *same* `-b` command —
// which then failed with `a branch named ... already exists` (not a lock error), so
// the Issue went Blocked until a human deleted the branch (#1221).
//
// The lock failure is injected deterministically with a `git` shim on PATH that,
// on the first `worktree add -b`, creates the branch with the real git and then
// reports the lock error — exactly the state the real race leaves behind.

const { test } = require('node:test');
const assert = require('node:assert');
const { execFileSync, spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');
const WORKTREE_SCRIPT = path.join(REPO_ROOT, 'bin', 'autopilot-worktree');
const SYNC_SCRIPT = path.join(REPO_ROOT, 'bin', 'sync-worktree-env');
const REAL_GIT = execFileSync('sh', ['-c', 'command -v git'], { encoding: 'utf8' }).trim();

// git shim: the first `worktree add -b <branch> <wt> <start>` creates the branch
// (at FAKE_BRANCH_START when given, to simulate an unrelated branch) and then fails
// like a `.git/config` lock conflict. Everything else is passed to the real git.
const GIT_SHIM = `#!/usr/bin/env bash
args=("$@")
if [[ " $* " == *" worktree add -b "* && ! -e "\${FAIL_MARKER}" ]]; then
    : > "\${FAIL_MARKER}"
    for i in "\${!args[@]}"; do
        if [[ "\${args[$i]}" == "-b" ]]; then
            br="\${args[$((i + 1))]}"
            start="\${args[$((i + 3))]}"
        fi
    done
    "\${REAL_GIT}" -C "\${FAKE_MAIN}" branch --no-track "\${br}" "\${FAKE_BRANCH_START:-\${start}}" >/dev/null
    echo "error: could not lock config file .git/config: File exists" >&2
    exit 255
fi
exec "\${REAL_GIT}" "$@"
`;

const git = (cwd, ...args) =>
    execFileSync(REAL_GIT, args, { cwd, encoding: 'utf8' }).trim();

/**
 * origin（bare）と main checkout を作り、main の bin/ に対象スクリプトを置く。
 * 一時ディレクトリは `t.after` で片付ける（兄弟の worktree-*.test.js と同じ方針）。
 * @param {object} t node:test のテストコンテキスト。
 * @returns {{base: string, main: string, shim: string, env: object}} パスと実行用 env。
 */
function setup(t) {
    const base = fs.mkdtempSync(path.join(os.tmpdir(), 'wt-create-retry-'));
    t.after(() => fs.rmSync(base, { recursive: true, force: true }));
    const origin = path.join(base, 'origin.git');
    const seed = path.join(base, 'seed');
    const main = path.join(base, 'main');
    const shim = path.join(base, 'shim');

    git(base, 'init', '-q', '--bare', origin);
    git(base, 'init', '-q', '-b', 'develop', seed);
    git(seed, 'config', 'user.email', 'test@example.com');
    git(seed, 'config', 'user.name', 'test');
    fs.writeFileSync(path.join(seed, 'README.md'), 'test\n');
    git(seed, 'add', '-A');
    git(seed, 'commit', '-q', '-m', 'init', '--no-verify');
    git(seed, 'checkout', '-q', '-b', 'feature/existing');
    fs.writeFileSync(path.join(seed, 'feature.txt'), 'feature\n');
    git(seed, 'add', '-A');
    git(seed, 'commit', '-q', '-m', 'feature', '--no-verify');
    git(seed, 'push', '-q', origin, 'develop', 'feature/existing');

    git(base, 'clone', '-q', '-b', 'develop', origin, main);
    git(main, 'config', 'user.email', 'test@example.com');
    git(main, 'config', 'user.name', 'test');
    fs.mkdirSync(path.join(main, 'bin'));
    fs.copyFileSync(WORKTREE_SCRIPT, path.join(main, 'bin', 'autopilot-worktree'));
    fs.copyFileSync(SYNC_SCRIPT, path.join(main, 'bin', 'sync-worktree-env'));
    fs.chmodSync(path.join(main, 'bin', 'autopilot-worktree'), 0o755);
    fs.chmodSync(path.join(main, 'bin', 'sync-worktree-env'), 0o755);

    fs.mkdirSync(shim);
    fs.writeFileSync(path.join(shim, 'git'), GIT_SHIM, { mode: 0o755 });

    const env = {
        ...process.env,
        REAL_GIT,
        FAKE_MAIN: main,
        FAIL_MARKER: path.join(base, 'lock-failed-once'),
        AUTOPILOT_WORKTREE_ROOT: path.join(base, 'worktrees'),
    };
    return { base, main, shim, env };
}

const runCreate = (main, env, args) =>
    execFileSync(path.join(main, 'bin', 'autopilot-worktree'), ['create', ...args], {
        cwd: main,
        env,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
    });

test('lock conflict that leaves the new branch behind: retry reuses it (#1226)', (t) => {
    const { base, main, shim, env } = setup(t);
    const withShim = { ...env, PATH: `${shim}:${env.PATH}` };

    runCreate(main, withShim, ['1']);

    assert.ok(fs.existsSync(env.FAIL_MARKER), 'the shim should have injected one lock failure');
    const wt = path.join(base, 'worktrees', 'issue-1');
    assert.strictEqual(git(wt, 'rev-parse', '--abbrev-ref', 'HEAD'), 'topic/autopilot-1');
    assert.strictEqual(git(wt, 'rev-parse', 'HEAD'), git(main, 'rev-parse', 'origin/develop'));
    // The upstream the failed `-b` could not record is restored (best effort).
    assert.strictEqual(
        git(main, 'rev-parse', '--abbrev-ref', 'topic/autopilot-1@{upstream}'),
        'origin/develop',
    );
});

test('lock conflict on the remote-tracking (--branch) path is retried too (#1226)', (t) => {
    const { base, main, shim, env } = setup(t);
    const withShim = { ...env, PATH: `${shim}:${env.PATH}` };

    runCreate(main, withShim, ['2', '--branch', 'feature/existing']);

    assert.ok(fs.existsSync(env.FAIL_MARKER), 'the shim should have injected one lock failure');
    const wt = path.join(base, 'worktrees', 'issue-2');
    assert.strictEqual(git(wt, 'rev-parse', '--abbrev-ref', 'HEAD'), 'feature/existing');
    assert.strictEqual(git(wt, 'rev-parse', 'HEAD'), git(main, 'rev-parse', 'origin/feature/existing'));
    assert.strictEqual(
        git(main, 'rev-parse', '--abbrev-ref', 'feature/existing@{upstream}'),
        'origin/feature/existing',
    );
});

test('a leftover branch at a different commit is NOT adopted (#1226)', (t) => {
    const { base, main, shim, env } = setup(t);
    const withShim = {
        ...env,
        PATH: `${shim}:${env.PATH}`,
        // Simulate an unrelated branch appearing under the same name.
        FAKE_BRANCH_START: 'origin/feature/existing',
    };

    assert.throws(
        () => runCreate(main, withShim, ['3']),
        (err) => /not created from/.test(String(err.stderr)),
    );
    assert.ok(!fs.existsSync(path.join(base, 'worktrees', 'issue-3')), 'no worktree should be created');
    // The unrelated branch is left untouched for a human to inspect.
    assert.strictEqual(
        git(main, 'rev-parse', 'topic/autopilot-3'),
        git(main, 'rev-parse', 'origin/feature/existing'),
    );
});

test('parallel creates all succeed', async (t) => {
    const { base, main, env } = setup(t);
    const issues = ['11', '12', '13'];

    const results = await Promise.all(
        issues.map(
            (issue) =>
                new Promise((resolve) => {
                    const child = spawn(path.join(main, 'bin', 'autopilot-worktree'), ['create', issue], {
                        cwd: main,
                        env,
                    });
                    let stderr = '';
                    child.stderr.on('data', (d) => {
                        stderr += d;
                    });
                    child.on('close', (code) => resolve({ issue, code, stderr }));
                }),
        ),
    );

    for (const { issue, code, stderr } of results) {
        assert.strictEqual(code, 0, `create ${issue} failed: ${stderr}`);
        const wt = path.join(base, 'worktrees', `issue-${issue}`);
        assert.strictEqual(git(wt, 'rev-parse', '--abbrev-ref', 'HEAD'), `topic/autopilot-${issue}`);
    }
});

test('existing-branch path and remove keep working', (t) => {
    const { base, main, env } = setup(t);

    runCreate(main, env, ['21']);
    // Re-create while registered: re-prepares instead of failing.
    runCreate(main, env, ['21']);
    const wt = path.join(base, 'worktrees', 'issue-21');

    execFileSync(path.join(main, 'bin', 'autopilot-worktree'), ['remove', '21'], { cwd: main, env });
    assert.ok(!fs.existsSync(wt));
    // Branch survives remove without --delete-branch, and create picks it up again.
    runCreate(main, env, ['21']);
    assert.strictEqual(git(wt, 'rev-parse', '--abbrev-ref', 'HEAD'), 'topic/autopilot-21');

    execFileSync(path.join(main, 'bin', 'autopilot-worktree'), ['remove', '21', '--delete-branch'], {
        cwd: main,
        env,
    });
    assert.throws(() => git(main, 'rev-parse', '--verify', '--quiet', 'refs/heads/topic/autopilot-21'));
});

test('a non-lock worktree add error makes create fail right away', (t) => {
    const { base, main, env } = setup(t);

    // An unknown base ref: `git worktree add` fails with a non-lock error. The old
    // retry returned 0 here (`$?` after `if ...; fi`), so create carried on and
    // died later on `cd` into the missing worktree.
    assert.throws(
        () => runCreate(main, env, ['31', 'no-such-base']),
        (err) => err.status !== 0 && !/line \d+: cd:/.test(String(err.stderr)),
    );
    assert.ok(!fs.existsSync(path.join(base, 'worktrees', 'issue-31')));
});
