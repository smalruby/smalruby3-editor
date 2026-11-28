'use strict';

// Regression tests for Issue #2534: `bin/autopilot-worktree` symlinks bot helper
// commands (`bin/bot-gh`) from the main checkout when the branch does not track them.
//
// Why: the daemon runs the phase prompts from its own checkout (main), and those
// prompts call `bin/bot-gh`. A topic branch (the base of an EPIC sub-issue) that has
// not merged develop yet does not have `bin/bot-gh`, so every gh call of the worker
// would fail with `No such file or directory`.
//
// The symlink is untracked, so it is ignored via the worktree's info/exclude. Because
// git treats ignored files as expendable, merging develop (which tracks bin/bot-gh)
// later overwrites the symlink instead of failing.
//
// Also checks that the "no bot token" sentinel is the same value everywhere it is used.

const { test } = require('node:test');
const assert = require('node:assert');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { BOT_TOKEN_UNAVAILABLE } = require('../src/phases');

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');
const SCRIPT = path.join(REPO_ROOT, 'bin', 'autopilot-worktree');
const HELPER_PATH = 'bin/bot-gh';

function git(cwd, ...args) {
    return execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@example.com', ...args], {
        cwd,
        encoding: 'utf8',
    });
}

function shellFunctionBody(src, name) {
    const start = src.indexOf(`${name}() {`);
    assert.notStrictEqual(start, -1, `${name}() not found in bin/autopilot-worktree`);
    const end = src.indexOf('\n}\n', start);
    assert.notStrictEqual(end, -1, `${name}() has no closing brace`);
    return src.slice(start, end);
}

test('an excluded bin/bot-gh symlink is ignored and overwritten by a merge that tracks it', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wt-bot-helpers-'));
    try {
        git(dir, 'init', '-q', '-b', 'main');
        fs.mkdirSync(path.join(dir, 'bin'));
        fs.writeFileSync(path.join(dir, 'bin', 'other'), 'x\n');
        git(dir, 'add', '.');
        git(dir, 'commit', '-qm', 'init');
        git(dir, 'checkout', '-qb', 'topic');
        git(dir, 'checkout', '-q', 'main');
        fs.writeFileSync(path.join(dir, HELPER_PATH), 'tracked\n');
        git(dir, 'add', '.');
        git(dir, 'commit', '-qm', 'add bot-gh');
        git(dir, 'checkout', '-q', 'topic');

        fs.symlinkSync('/bin/true', path.join(dir, HELPER_PATH));
        fs.appendFileSync(path.join(dir, '.git', 'info', 'exclude'), `${HELPER_PATH}\n`);
        assert.strictEqual(git(dir, 'status', '--porcelain'), '', 'symlink should not show up as untracked');

        git(dir, 'merge', '-q', '--no-edit', 'main');
        const st = fs.lstatSync(path.join(dir, HELPER_PATH));
        assert.strictEqual(st.isSymbolicLink(), false, 'merge should replace the symlink with the tracked file');
        assert.strictEqual(fs.readFileSync(path.join(dir, HELPER_PATH), 'utf8'), 'tracked\n');
    } finally {
        fs.rmSync(dir, { recursive: true, force: true });
    }
});

test('bin/autopilot-worktree links bot helpers and records them in info/exclude', () => {
    const src = fs.readFileSync(SCRIPT, 'utf8');
    assert.ok(/BOT_HELPERS=\(bot-gh\)/.test(src), 'BOT_HELPERS should list bot-gh');
    assert.ok(/link_bot_helpers\s+"\$\{wt\}"/.test(src), 'create must call link_bot_helpers');
    const lines = shellFunctionBody(src, 'exclude_node_modules')
        .split('\n')
        .map((line) => line.trim());
    assert.ok(lines.includes(`echo "${HELPER_PATH}"`), 'exclude_node_modules must append bin/bot-gh');
    assert.ok(lines.some((line) => line.includes('Issue #2534')), 'exclude block should reference Issue #2534');
});

test('the no-token sentinel is the same in bin/bot-token, bin/bot-gh, bin/bot-git and phases.js', () => {
    for (const name of ['bot-token', 'bot-gh', 'bot-git']) {
        const src = fs.readFileSync(path.join(REPO_ROOT, 'bin', name), 'utf8');
        assert.ok(src.includes(BOT_TOKEN_UNAVAILABLE), `bin/${name} should use ${BOT_TOKEN_UNAVAILABLE}`);
    }
});
