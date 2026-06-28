'use strict';

// Regression tests for Issue #801: a symlinked `node_modules` (created by
// `bin/autopilot-worktree` to share build artifacts) must be git-ignored.
//
// Root cause: the gitignore pattern `node_modules/` (trailing slash) matches
// only *directories*. A symlink named `node_modules` is NOT a directory as far
// as the pattern is concerned, so it slipped past `.gitignore` and got staged
// by `git add -A` (observed in PR #800). The pattern `node_modules` (no slash)
// matches files, directories, and symlinks alike.

const { test } = require('node:test');
const assert = require('node:assert');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');

// Create a throwaway git repo with the given root `.gitignore` content, drop a
// `node_modules` *symlink* into it, and return whether git ignores that symlink.
function symlinkIgnoredWithGitignore(gitignoreContent) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wt-nm-ignore-'));
    try {
        execFileSync('git', ['init', '-q'], { cwd: dir });
        fs.writeFileSync(path.join(dir, '.gitignore'), gitignoreContent);
        // Point the symlink at an arbitrary existing dir; target need not exist
        // for the ignore check, but a real target keeps it realistic.
        fs.symlinkSync(os.tmpdir(), path.join(dir, 'node_modules'));
        const status = execFileSync(
            'git',
            ['check-ignore', '-q', 'node_modules'],
            { cwd: dir },
        );
        // execFileSync throws on non-zero exit; reaching here means ignored.
        void status;
        return true;
    } catch (err) {
        // `git check-ignore -q` exits 1 when the path is NOT ignored.
        if (err && err.status === 1) {
            return false;
        }
        throw err;
    } finally {
        fs.rmSync(dir, { recursive: true, force: true });
    }
}

test('trailing-slash pattern `node_modules/` does NOT ignore a symlink (the bug)', () => {
    assert.strictEqual(symlinkIgnoredWithGitignore('node_modules/\n'), false);
});

test('slash-less pattern `node_modules` DOES ignore a symlink (the fix)', () => {
    assert.strictEqual(symlinkIgnoredWithGitignore('node_modules\n'), true);
});

test('repo root .gitignore ignores a node_modules symlink', () => {
    const content = fs.readFileSync(path.join(REPO_ROOT, '.gitignore'), 'utf8');
    assert.strictEqual(symlinkIgnoredWithGitignore(content), true);
});

test('packages/scratch-media-lib-scripts/.gitignore ignores a node_modules symlink', () => {
    const content = fs.readFileSync(
        path.join(REPO_ROOT, 'packages', 'scratch-media-lib-scripts', '.gitignore'),
        'utf8',
    );
    assert.strictEqual(symlinkIgnoredWithGitignore(content), true);
});

test('every package .gitignore ignores a node_modules symlink', () => {
    const pkgRoot = path.join(REPO_ROOT, 'packages');
    const pkgs = fs
        .readdirSync(pkgRoot, { withFileTypes: true })
        .filter((d) => d.isDirectory())
        .map((d) => path.join(pkgRoot, d.name, '.gitignore'))
        .filter((p) => fs.existsSync(p));
    assert.ok(pkgs.length > 0, 'expected at least one package .gitignore');
    for (const gi of pkgs) {
        const content = fs.readFileSync(gi, 'utf8');
        assert.strictEqual(
            symlinkIgnoredWithGitignore(content),
            true,
            `${path.relative(REPO_ROOT, gi)} should ignore a node_modules symlink`,
        );
    }
});
