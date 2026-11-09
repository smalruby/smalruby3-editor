'use strict';

// Tests for Issue #1454: lightweight worktrees set up `infra/<project>/node_modules`
// from the worktree's own lockfile.
//
// Why: the main checkout is shared with a human and can lag behind develop. Symlinking
// its `infra/<project>/node_modules` blindly meant worktree tests ran against stale
// dependencies (on 2026-11-09 `@anthropic-ai/sdk`, added by #1442, was missing and
// three rubytee-relay test files could not even load). `bin/autopilot-worktree` now
// compares main's installed versions (`node_modules/.package-lock.json`) with the
// worktree's `package-lock.json`: symlink when they match, `npm ci` otherwise.

const { test } = require('node:test');
const assert = require('node:assert');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { lockPackageSet, compareInstalledToLock, main } = require('../src/lockfile');

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');
const SCRIPT = path.join(REPO_ROOT, 'bin', 'autopilot-worktree');
const LOCKFILE_JS = path.join(REPO_ROOT, 'tools', 'autopilot', 'src', 'lockfile.js');

const pkg = (version, extra = {}) => ({
    version,
    resolved: `https://registry.npmjs.org/x/-/x-${version}.tgz`,
    ...extra,
});

const lockOf = (packages) => ({
    name: 'proj',
    lockfileVersion: 3,
    requires: true,
    packages: { '': { name: 'proj', version: '0.1.0' }, ...packages },
});

// npm's hidden lockfile has no root entry and only what is actually installed.
const installedOf = (packages) => ({ name: 'proj', lockfileVersion: 3, requires: true, packages });

test('lockPackageSet skips the root entry', () => {
    const set = lockPackageSet(lockOf({ 'node_modules/a': pkg('1.0.0') }));
    assert.deepStrictEqual([...set.keys()], ['node_modules/a']);
});

test('installed deps that equal the lock match', () => {
    const r = compareInstalledToLock(
        installedOf({ 'node_modules/a': pkg('1.0.0'), 'node_modules/b': pkg('2.0.0') }),
        lockOf({ 'node_modules/a': pkg('1.0.0'), 'node_modules/b': pkg('2.0.0') }),
    );
    assert.deepStrictEqual(r, { match: true, reasons: [] });
});

test('a dependency added to the lock but not installed is a mismatch (the #1442 case)', () => {
    const r = compareInstalledToLock(
        installedOf({ 'node_modules/a': pkg('1.0.0') }),
        lockOf({ 'node_modules/a': pkg('1.0.0'), 'node_modules/@anthropic-ai/sdk': pkg('1.5.0') }),
    );
    assert.strictEqual(r.match, false);
    assert.match(r.reasons[0], /missing node_modules\/@anthropic-ai\/sdk@1\.5\.0/);
});

test('a different version is a mismatch', () => {
    const r = compareInstalledToLock(
        installedOf({ 'node_modules/a': pkg('1.0.0') }),
        lockOf({ 'node_modules/a': pkg('1.1.0') }),
    );
    assert.strictEqual(r.match, false);
    assert.match(r.reasons[0], /differs node_modules\/a: 1\.0\.0 != 1\.1\.0/);
});

test('a different resolved URL with the same version is a mismatch', () => {
    const r = compareInstalledToLock(
        installedOf({ 'node_modules/a': pkg('1.0.0', { resolved: 'https://mirror/a-1.0.0.tgz' }) }),
        lockOf({ 'node_modules/a': pkg('1.0.0') }),
    );
    assert.strictEqual(r.match, false);
});

test('resolved is only compared when both sides have it', () => {
    const r = compareInstalledToLock(
        installedOf({ 'node_modules/a': { version: '1.0.0' } }),
        lockOf({ 'node_modules/a': pkg('1.0.0') }),
    );
    assert.strictEqual(r.match, true);
});

test('an installed package that is not in the lock is a mismatch', () => {
    const r = compareInstalledToLock(
        installedOf({ 'node_modules/a': pkg('1.0.0'), 'node_modules/old': pkg('0.1.0') }),
        lockOf({ 'node_modules/a': pkg('1.0.0') }),
    );
    assert.strictEqual(r.match, false);
    assert.match(r.reasons[0], /extra node_modules\/old@0\.1\.0/);
});

test('optional packages for other platforms may be absent', () => {
    const r = compareInstalledToLock(
        installedOf({ 'node_modules/a': pkg('1.0.0') }),
        lockOf({
            'node_modules/a': pkg('1.0.0'),
            'node_modules/@esbuild/darwin-arm64': pkg('0.25.0', { optional: true }),
        }),
    );
    assert.strictEqual(r.match, true);
});

test('an installed optional package must still have the locked version', () => {
    const r = compareInstalledToLock(
        installedOf({ 'node_modules/@esbuild/linux-x64': pkg('0.24.0') }),
        lockOf({ 'node_modules/@esbuild/linux-x64': pkg('0.25.0', { optional: true }) }),
    );
    assert.strictEqual(r.match, false);
});

test('formatting differences do not matter (only name/version/resolved)', () => {
    const lock = lockOf({ 'node_modules/a': pkg('1.0.0', { integrity: 'sha512-x', license: 'MIT' }) });
    const installed = installedOf({ 'node_modules/a': pkg('1.0.0', { dependencies: { b: '^1' } }) });
    assert.strictEqual(compareInstalledToLock(installed, lock).match, true);
});

// --- CLI ---------------------------------------------------------------------

function tmpDir(prefix) {
    return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function writeJson(file, obj) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(obj, null, 2));
}

test('CLI exits 0 on match, 1 on mismatch / missing install, 2 on bad input', () => {
    const dir = tmpDir('lockfile-cli-');
    const origWrite = process.stderr.write;
    process.stderr.write = () => true;
    try {
        const lock = path.join(dir, 'package-lock.json');
        const installed = path.join(dir, 'node_modules', '.package-lock.json');
        writeJson(lock, lockOf({ 'node_modules/a': pkg('1.0.0') }));
        writeJson(installed, installedOf({ 'node_modules/a': pkg('1.0.0') }));
        assert.strictEqual(main([installed, lock]), 0);

        writeJson(lock, lockOf({ 'node_modules/a': pkg('1.1.0') }));
        assert.strictEqual(main([installed, lock]), 1);

        assert.strictEqual(main([path.join(dir, 'nope', '.package-lock.json'), lock]), 1);

        fs.writeFileSync(lock, '{ broken');
        assert.strictEqual(main([installed, lock]), 2);
        assert.strictEqual(main([]), 2);
    } finally {
        process.stderr.write = origWrite;
        fs.rmSync(dir, { recursive: true, force: true });
    }
});

// --- bin/autopilot-worktree ---------------------------------------------------

// Slice out a shell function so the test exercises the real implementation without
// running the script's top-level dispatch (which needs a real git checkout).
function shellFunction(src, name) {
    const start = src.indexOf(`${name}() {`);
    assert.notStrictEqual(start, -1, `${name}() not found in bin/autopilot-worktree`);
    const end = src.indexOf('\n}\n', start);
    assert.notStrictEqual(end, -1, `${name}() has no closing brace`);
    return src.slice(start, end + 2);
}

// Run link_infra_node_modules against a fake main checkout + worktree.
// `npm` is replaced by a stub that records the call and "installs" by copying the
// project's lock into node_modules/.package-lock.json (what a real `npm ci` leaves).
function runLinkInfra({ mainLock, mainInstalled, wtLock, wtExisting }) {
    const root = tmpDir('wt-infra-nm-');
    const mainDir = path.join(root, 'main');
    const wtDir = path.join(root, 'wt');
    const binDir = path.join(root, 'bin');
    const npmLog = path.join(root, 'npm.log');
    const proj = 'smalruby-rubytee-relay';
    if (mainLock) writeJson(path.join(mainDir, 'infra', proj, 'package-lock.json'), mainLock);
    if (mainInstalled) {
        writeJson(path.join(mainDir, 'infra', proj, 'node_modules', '.package-lock.json'), mainInstalled);
    }
    writeJson(path.join(wtDir, 'infra', proj, 'package-lock.json'), wtLock);
    if (wtExisting === 'symlink-to-main') {
        fs.symlinkSync(
            path.join(mainDir, 'infra', proj, 'node_modules'),
            path.join(wtDir, 'infra', proj, 'node_modules'),
        );
    }
    fs.mkdirSync(binDir, { recursive: true });
    fs.writeFileSync(
        path.join(binDir, 'npm'),
        [
            '#!/usr/bin/env bash',
            `echo "$PWD $*" >> ${JSON.stringify(npmLog)}`,
            'rm -rf node_modules && mkdir -p node_modules',
            'cp package-lock.json node_modules/.package-lock.json',
            '',
        ].join('\n'),
        { mode: 0o755 },
    );

    const src = fs.readFileSync(SCRIPT, 'utf8');
    // Point the comparison at this checkout's lockfile.js (BASH_SOURCE is not the
    // real script path when the function is evaluated from a string).
    const fn = shellFunction(src, 'link_infra_node_modules').replace(
        /compare="\$\(cd "\$\(dirname "\$\{BASH_SOURCE\[0\]\}"\)\/\.\." && pwd\)\/tools\/autopilot\/src\/lockfile\.js"/,
        `compare=${JSON.stringify(LOCKFILE_JS)}`,
    );
    assert.ok(fn.includes(LOCKFILE_JS), 'failed to point link_infra_node_modules at lockfile.js');
    const script = `set -euo pipefail\nMAIN_CHECKOUT=${JSON.stringify(mainDir)}\n${fn}\nlink_infra_node_modules ${JSON.stringify(wtDir)}\n`;
    const out = execFileSync('bash', ['-c', script], {
        env: { ...process.env, PATH: `${binDir}:${process.env.PATH}` },
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
    });
    const dst = path.join(wtDir, 'infra', proj, 'node_modules');
    const result = {
        out,
        isSymlink: fs.lstatSync(dst).isSymbolicLink(),
        target: fs.lstatSync(dst).isSymbolicLink() ? fs.readlinkSync(dst) : null,
        npmCalls: fs.existsSync(npmLog) ? fs.readFileSync(npmLog, 'utf8').trim().split('\n') : [],
        mainNodeModules: path.join(mainDir, 'infra', proj, 'node_modules'),
    };
    fs.rmSync(root, { recursive: true, force: true });
    return result;
}

const CURRENT = { 'node_modules/a': pkg('1.0.0'), 'node_modules/@anthropic-ai/sdk': pkg('1.5.0') };
const STALE = { 'node_modules/a': pkg('1.0.0') };

test('main deps equal to the worktree lock → symlink to main, no npm ci', () => {
    const r = runLinkInfra({
        mainLock: lockOf(CURRENT),
        mainInstalled: installedOf(CURRENT),
        wtLock: lockOf(CURRENT),
    });
    assert.strictEqual(r.isSymlink, true);
    assert.strictEqual(r.target, r.mainNodeModules);
    assert.deepStrictEqual(r.npmCalls, []);
});

test('main deps older than the worktree lock → npm ci in the worktree (the #1454 bug)', () => {
    const r = runLinkInfra({
        mainLock: lockOf(STALE),
        mainInstalled: installedOf(STALE),
        wtLock: lockOf(CURRENT),
    });
    assert.strictEqual(r.isSymlink, false);
    assert.strictEqual(r.npmCalls.length, 1);
    assert.match(r.npmCalls[0], /infra\/smalruby-rubytee-relay ci --no-audit --no-fund$/);
});

test('main without node_modules → npm ci in the worktree', () => {
    const r = runLinkInfra({ mainLock: lockOf(CURRENT), wtLock: lockOf(CURRENT) });
    assert.strictEqual(r.isSymlink, false);
    assert.strictEqual(r.npmCalls.length, 1);
});

test('re-preparing replaces a stale symlink to main with npm ci', () => {
    const r = runLinkInfra({
        mainLock: lockOf(STALE),
        mainInstalled: installedOf(STALE),
        wtLock: lockOf(CURRENT),
        wtExisting: 'symlink-to-main',
    });
    assert.strictEqual(r.isSymlink, false);
    assert.strictEqual(r.npmCalls.length, 1);
});

test('lightweight setup calls link_infra_node_modules', () => {
    const src = fs.readFileSync(SCRIPT, 'utf8');
    assert.ok(/link_infra_node_modules\s+"\$\{wt\}"/.test(src));
});

test('bin/autopilot-worktree records infra/*/node_modules in git info/exclude', () => {
    const src = fs.readFileSync(SCRIPT, 'utf8');
    const lines = shellFunction(src, 'exclude_node_modules')
        .split('\n')
        .map((line) => line.trim());
    // Slash-less so the symlink is ignored too (the #801 trap).
    assert.ok(lines.includes('echo "infra/*/node_modules"'));
});

test('the infra/*/node_modules exclude pattern ignores a symlink', () => {
    const dir = tmpDir('wt-infra-ignore-');
    try {
        execFileSync('git', ['init', '-q'], { cwd: dir });
        fs.writeFileSync(path.join(dir, '.git', 'info', 'exclude'), 'infra/*/node_modules\n');
        fs.mkdirSync(path.join(dir, 'infra', 'proj'), { recursive: true });
        fs.writeFileSync(path.join(dir, 'infra', 'proj', '.gitignore'), 'node_modules/\n');
        fs.symlinkSync(os.tmpdir(), path.join(dir, 'infra', 'proj', 'node_modules'));
        execFileSync('git', ['check-ignore', '-q', 'infra/proj/node_modules'], { cwd: dir });
    } finally {
        fs.rmSync(dir, { recursive: true, force: true });
    }
});
