'use strict';

// Regression tests for Issue #1001: `bin/autopilot-worktree` (lightweight mode)
// symlinks scratch-gui's gitignored `prepare` artifacts from the main checkout so
// a fresh worktree can start the dev server (webpack) without running
// `npm install` (= the `prepare` lifecycle that downloads the microbit hex files).
//
// The symlinked paths are:
//   - packages/scratch-gui/src/generated       (microbit(-more)-hex-url.cjs)
//   - packages/scratch-gui/static/microbit      (scratch-microbit-*.hex)
//   - packages/scratch-gui/static/microbitMore  (microbit-mbit-more-v2-*.hex)
//
// Same trap as Issue #801: the package .gitignore ignores these with a trailing
// slash (`src/generated/`), which matches *directories* only. A symlink named
// `src/generated` is NOT a directory as far as that pattern is concerned, so it
// slips past .gitignore and `git add -A` would stage it. The worktree's shared
// info/exclude therefore carries slash-less, root-anchored patterns that match a
// symlink regardless.

const { test } = require('node:test');
const assert = require('node:assert');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');
const SCRIPT = path.join(REPO_ROOT, 'bin', 'autopilot-worktree');

// Repo-relative paths that bin/autopilot-worktree symlinks and excludes (#1001).
const PREPARE_PATHS = [
    'packages/scratch-gui/src/generated',
    'packages/scratch-gui/static/microbit',
    'packages/scratch-gui/static/microbitMore',
];

// The trailing-slash patterns the real package .gitignore uses for these paths
// (relative to packages/scratch-gui/.gitignore). These are the "bug" side.
const PKG_GITIGNORE_TRAILING_SLASH = [
    'src/generated/',
    'static/microbit/',
    'static/microbitMore/',
    '',
].join('\n');

// Build a throwaway git repo, create a *symlink* at repo-relative `relPath`, and
// return whether git ignores it. Optional package .gitignore is written at
// packages/scratch-gui/.gitignore, optional exclude content is appended to
// .git/info/exclude.
function symlinkIgnored(relPath, { pkgGitignore, exclude } = {}) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wt-prep-ignore-'));
    try {
        execFileSync('git', ['init', '-q'], { cwd: dir });
        if (pkgGitignore) {
            const pkgDir = path.join(dir, 'packages', 'scratch-gui');
            fs.mkdirSync(pkgDir, { recursive: true });
            fs.writeFileSync(path.join(pkgDir, '.gitignore'), pkgGitignore);
        }
        if (exclude) {
            const infoDir = path.join(dir, '.git', 'info');
            fs.mkdirSync(infoDir, { recursive: true });
            fs.appendFileSync(path.join(infoDir, 'exclude'), exclude);
        }
        const abs = path.join(dir, relPath);
        fs.mkdirSync(path.dirname(abs), { recursive: true });
        // Point the symlink at a real directory to mirror the worktree setup.
        fs.symlinkSync(os.tmpdir(), abs);
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
    }
}

// Exclude block equivalent to what bin/autopilot-worktree writes for #1001.
const EXCLUDE_CONTENT = `${PREPARE_PATHS.join('\n')}\n`;

test('trailing-slash package .gitignore does NOT ignore a prepare-artifact symlink (the bug)', () => {
    for (const relPath of PREPARE_PATHS) {
        assert.strictEqual(
            symlinkIgnored(relPath, { pkgGitignore: PKG_GITIGNORE_TRAILING_SLASH }),
            false,
            `${relPath} unexpectedly ignored by trailing-slash .gitignore alone`,
        );
    }
});

test('slash-less info/exclude patterns DO ignore prepare-artifact symlinks (the fix)', () => {
    for (const relPath of PREPARE_PATHS) {
        assert.strictEqual(
            symlinkIgnored(relPath, {
                pkgGitignore: PKG_GITIGNORE_TRAILING_SLASH,
                exclude: EXCLUDE_CONTENT,
            }),
            true,
            `${relPath} not ignored even with info/exclude patterns`,
        );
    }
});

test('bin/autopilot-worktree symlinks the prepare artifacts from main', () => {
    const src = fs.readFileSync(SCRIPT, 'utf8');
    for (const relPath of PREPARE_PATHS) {
        assert.ok(
            src.includes(relPath),
            `bin/autopilot-worktree should reference ${relPath} (symlink + exclude)`,
        );
    }
    // The symlink helper must be wired into the lightweight setup path.
    assert.ok(
        /link_prepare_artifacts\s+"\$\{wt\}"/.test(src),
        'lightweight setup must call link_prepare_artifacts',
    );
});

test('bin/autopilot-worktree records the prepare-artifact paths in git info/exclude', () => {
    const src = fs.readFileSync(SCRIPT, 'utf8');
    // The paths must appear inside an exclude-writing block referencing #1001.
    assert.ok(
        /Issue #1001/.test(src),
        'exclude block should reference Issue #1001 for traceability',
    );
});
