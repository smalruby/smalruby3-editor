'use strict';

// Regression tests for Issue #1137: `bin/autopilot-worktree` (lightweight mode)
// symlinks husky's generated helper directory `.husky/_` from the main checkout.
//
// Why: `core.hooksPath=.husky` is a *shared* git config, so `.husky/commit-msg`
// runs in every worktree. That hook sources `.husky/_/husky.sh`, which is a
// gitignored artifact produced by `npm install` (= the `prepare` lifecycle running
// `husky install`). A lightweight worktree never runs npm install, so the file is
// missing and every commit — including the merge commit the daemon creates when
// following the base branch — fails with:
//
//   .husky/commit-msg: 2: .: cannot open .husky/_/husky.sh: No such file
//
// which the daemon then misreports as `base-follow-conflict` (Issue #957).
//
// Same trap as Issues #801 / #1001 on the ignore side: husky self-ignores `.husky/_`
// via `.husky/_/.gitignore` (containing `*`), but git does not traverse a *symlink*
// to find that file, so the symlink itself shows up as untracked. The worktree's
// shared info/exclude therefore carries an explicit `.husky/_` pattern.

const { test } = require('node:test');
const assert = require('node:assert');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');
const SCRIPT = path.join(REPO_ROOT, 'bin', 'autopilot-worktree');

const HUSKY_HELPER_PATH = '.husky/_';

// Build a throwaway git repo, create a *symlink* at repo-relative `relPath`, and
// return whether git ignores it. `selfIgnore` reproduces husky's own
// `.husky/_/.gitignore` (`*`) inside the symlink target directory.
function symlinkIgnored(relPath, { selfIgnore = false, exclude } = {}) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wt-husky-ignore-'));
    const target = fs.mkdtempSync(path.join(os.tmpdir(), 'wt-husky-target-'));
    try {
        execFileSync('git', ['init', '-q'], { cwd: dir });
        if (selfIgnore) {
            fs.writeFileSync(path.join(target, '.gitignore'), '*\n');
        }
        if (exclude) {
            const infoDir = path.join(dir, '.git', 'info');
            fs.mkdirSync(infoDir, { recursive: true });
            fs.appendFileSync(path.join(infoDir, 'exclude'), exclude);
        }
        const abs = path.join(dir, relPath);
        fs.mkdirSync(path.dirname(abs), { recursive: true });
        fs.symlinkSync(target, abs);
        execFileSync('git', ['check-ignore', '-q', relPath], { cwd: dir });
        // execFileSync throws on non-zero exit; reaching here means ignored.
        return true;
    } catch (err) {
        // `git check-ignore -q` exits 1 when the path is NOT ignored.
        if (err && err.status === 1) {
            return false;
        }
        throw err;
    } finally {
        fs.rmSync(dir, { recursive: true, force: true });
        fs.rmSync(target, { recursive: true, force: true });
    }
}

test("husky's own .gitignore does NOT ignore a .husky/_ symlink (the bug)", () => {
    assert.strictEqual(
        symlinkIgnored(HUSKY_HELPER_PATH, { selfIgnore: true }),
        false,
        '.husky/_ symlink unexpectedly ignored without info/exclude',
    );
});

test('the info/exclude pattern DOES ignore a .husky/_ symlink (the fix)', () => {
    assert.strictEqual(
        symlinkIgnored(HUSKY_HELPER_PATH, {
            selfIgnore: true,
            exclude: `${HUSKY_HELPER_PATH}\n`,
        }),
        true,
        '.husky/_ symlink not ignored even with the info/exclude pattern',
    );
});

test('bin/autopilot-worktree symlinks .husky/_ from main in lightweight mode', () => {
    const src = fs.readFileSync(SCRIPT, 'utf8');
    assert.ok(
        src.includes(HUSKY_HELPER_PATH),
        'bin/autopilot-worktree should reference .husky/_ (symlink + exclude)',
    );
    assert.ok(
        /link_husky_helpers\s+"\$\{wt\}"/.test(src),
        'lightweight setup must call link_husky_helpers',
    );
});

test('bin/autopilot-worktree records .husky/_ in git info/exclude', () => {
    const src = fs.readFileSync(SCRIPT, 'utf8');
    assert.ok(
        /Issue #1137/.test(src),
        'exclude block should reference Issue #1137 for traceability',
    );
});
