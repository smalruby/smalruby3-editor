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
// Issue #1456: that `npm ci` goes into a store keyed by the lock's sha256
// (`<WT_ROOT>/.infra-node-modules/<project>-<hash>/`) shared by all worktrees with the same lock.

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

// Functions link_infra_node_modules / prune_infra_store need, sliced from the script.
const INFRA_FUNCTIONS = [
    'infra_sha256',
    'acquire_dir_lock',
    'release_dir_lock',
    'ensure_infra_store',
    'link_infra_node_modules',
    'infra_store_referenced',
    'prune_infra_store',
];
const PROJ = 'smalruby-rubytee-relay';

// A fake main checkout + store root. `npm` is replaced by a stub that records the call
// and "installs" by copying the project's lock into node_modules/.package-lock.json
// (what a real `npm ci` leaves).
function makeEnv() {
    const root = tmpDir('wt-infra-nm-');
    const env = {
        root,
        mainDir: path.join(root, 'main'),
        wtRoot: path.join(root, 'wts'),
        binDir: path.join(root, 'bin'),
        npmLog: path.join(root, 'npm.log'),
    };
    env.store = path.join(env.wtRoot, '.infra-node-modules');
    fs.mkdirSync(env.binDir, { recursive: true });
    fs.writeFileSync(
        path.join(env.binDir, 'npm'),
        [
            '#!/usr/bin/env bash',
            `echo "$PWD $*" >> ${JSON.stringify(env.npmLog)}`,
            'rm -rf node_modules && mkdir -p node_modules',
            'cp package-lock.json node_modules/.package-lock.json',
            '',
        ].join('\n'),
        { mode: 0o755 },
    );
    return env;
}

function setupMain(env, { mainLock, mainInstalled }) {
    if (mainLock) writeJson(path.join(env.mainDir, 'infra', PROJ, 'package-lock.json'), mainLock);
    if (mainInstalled) {
        writeJson(path.join(env.mainDir, 'infra', PROJ, 'node_modules', '.package-lock.json'), mainInstalled);
    }
}

function setupWorktree(env, name, { wtLock, wtExisting }) {
    const wtDir = path.join(env.wtRoot, name);
    writeJson(path.join(wtDir, 'infra', PROJ, 'package.json'), { name: 'proj', version: '0.1.0' });
    writeJson(path.join(wtDir, 'infra', PROJ, 'package-lock.json'), wtLock);
    if (wtExisting === 'symlink-to-main') {
        fs.symlinkSync(
            path.join(env.mainDir, 'infra', PROJ, 'node_modules'),
            path.join(wtDir, 'infra', PROJ, 'node_modules'),
        );
    } else if (wtExisting) {
        // a real directory left by an earlier `npm ci` (wtExisting = its installed lock)
        writeJson(path.join(wtDir, 'infra', PROJ, 'node_modules', '.package-lock.json'), wtExisting);
    }
    return wtDir;
}

// Run a shell snippet with the infra functions loaded. `list_worktree_paths` (git) is
// replaced by the worktree dirs under wtRoot.
function runShell(env, body) {
    const src = fs.readFileSync(SCRIPT, 'utf8');
    // Point the comparison at this checkout's lockfile.js (BASH_SOURCE is not the
    // real script path when the function is evaluated from a string).
    const fns = INFRA_FUNCTIONS.map((name) => shellFunction(src, name)).join('\n').replace(
        /compare="\$\(cd "\$\(dirname "\$\{BASH_SOURCE\[0\]\}"\)\/\.\." && pwd\)\/tools\/autopilot\/src\/lockfile\.js"/,
        `compare=${JSON.stringify(LOCKFILE_JS)}`,
    );
    assert.ok(fns.includes(LOCKFILE_JS), 'failed to point link_infra_node_modules at lockfile.js');
    const script = [
        'set -euo pipefail',
        `MAIN_CHECKOUT=${JSON.stringify(env.mainDir)}`,
        `WT_ROOT=${JSON.stringify(env.wtRoot)}`,
        'INFRA_STORE="${WT_ROOT}/.infra-node-modules"',
        `list_worktree_paths() { echo ${JSON.stringify(env.mainDir)}; ls -d "\${WT_ROOT}"/wt-* 2>/dev/null || true; }`,
        fns,
        body,
    ].join('\n');
    return execFileSync('bash', ['-c', script], {
        env: { ...process.env, PATH: `${env.binDir}:${process.env.PATH}` },
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
    });
}

function linkState(env, wtDir) {
    const dst = path.join(wtDir, 'infra', PROJ, 'node_modules');
    const isSymlink = fs.lstatSync(dst).isSymbolicLink();
    return {
        isSymlink,
        target: isSymlink ? fs.readlinkSync(dst) : null,
        npmCalls: fs.existsSync(env.npmLog) ? fs.readFileSync(env.npmLog, 'utf8').trim().split('\n') : [],
        mainNodeModules: path.join(env.mainDir, 'infra', PROJ, 'node_modules'),
    };
}

const storeEntries = (env) =>
    fs.existsSync(env.store) ? fs.readdirSync(env.store).sort() : [];

// Run link_infra_node_modules for one worktree.
function runLinkInfra({ mainLock, mainInstalled, wtLock, wtExisting }) {
    const env = makeEnv();
    try {
        setupMain(env, { mainLock, mainInstalled });
        const wtDir = setupWorktree(env, 'wt-a', { wtLock, wtExisting });
        const out = runShell(env, `link_infra_node_modules ${JSON.stringify(wtDir)}`);
        return { out, ...linkState(env, wtDir), store: env.store, entries: storeEntries(env) };
    } finally {
        fs.rmSync(env.root, { recursive: true, force: true });
    }
}

const CURRENT = { 'node_modules/a': pkg('1.0.0'), 'node_modules/@anthropic-ai/sdk': pkg('1.5.0') };
const STALE = { 'node_modules/a': pkg('1.0.0') };
const NEWER = { 'node_modules/a': pkg('2.0.0') };
const STORE_NAME = new RegExp(`^${PROJ}-[0-9a-f]{16}$`);

test('main deps equal to the worktree lock → symlink to main, no npm ci', () => {
    const r = runLinkInfra({
        mainLock: lockOf(CURRENT),
        mainInstalled: installedOf(CURRENT),
        wtLock: lockOf(CURRENT),
    });
    assert.strictEqual(r.isSymlink, true);
    assert.strictEqual(r.target, r.mainNodeModules);
    assert.deepStrictEqual(r.npmCalls, []);
    assert.deepStrictEqual(r.entries, []);
});

test('main deps older than the worktree lock → npm ci once in the shared store (the #1454 bug)', () => {
    const r = runLinkInfra({
        mainLock: lockOf(STALE),
        mainInstalled: installedOf(STALE),
        wtLock: lockOf(CURRENT),
    });
    assert.strictEqual(r.isSymlink, true);
    assert.strictEqual(r.npmCalls.length, 1);
    assert.match(r.npmCalls[0], /\/\.infra-node-modules\/smalruby-rubytee-relay-[0-9a-f]{16}\.tmp\.\d+ ci --no-audit --no-fund$/);
    // the partial install was renamed into place and the lock released
    assert.strictEqual(r.entries.length, 1);
    assert.match(r.entries[0], STORE_NAME);
    assert.strictEqual(r.target, path.join(r.store, r.entries[0], 'node_modules'));
});

test('main without node_modules → npm ci in the shared store', () => {
    const r = runLinkInfra({ mainLock: lockOf(CURRENT), wtLock: lockOf(CURRENT) });
    assert.strictEqual(r.isSymlink, true);
    assert.strictEqual(r.npmCalls.length, 1);
    assert.ok(r.target.startsWith(`${r.store}/`));
});

test('worktrees with the same lock share one install; a different lock gets its own (#1456)', () => {
    const env = makeEnv();
    try {
        setupMain(env, { mainLock: lockOf(STALE), mainInstalled: installedOf(STALE) });
        const a = setupWorktree(env, 'wt-a', { wtLock: lockOf(CURRENT) });
        const b = setupWorktree(env, 'wt-b', { wtLock: lockOf(CURRENT) });
        const c = setupWorktree(env, 'wt-c', { wtLock: lockOf(NEWER) });
        runShell(env, [a, b, c].map((w) => `link_infra_node_modules ${JSON.stringify(w)}`).join('\n'));
        const sa = linkState(env, a);
        const sb = linkState(env, b);
        const sc = linkState(env, c);
        assert.strictEqual(sa.target, sb.target);
        assert.notStrictEqual(sa.target, sc.target);
        assert.strictEqual(sc.npmCalls.length, 2, 'one npm ci per distinct lock');
        assert.strictEqual(storeEntries(env).length, 2);
    } finally {
        fs.rmSync(env.root, { recursive: true, force: true });
    }
});

test('re-preparing reuses the store entry without another npm ci', () => {
    const env = makeEnv();
    try {
        setupMain(env, { mainLock: lockOf(STALE), mainInstalled: installedOf(STALE) });
        const a = setupWorktree(env, 'wt-a', { wtLock: lockOf(CURRENT) });
        runShell(env, `link_infra_node_modules ${JSON.stringify(a)}\nlink_infra_node_modules ${JSON.stringify(a)}`);
        const s = linkState(env, a);
        assert.strictEqual(s.isSymlink, true);
        assert.strictEqual(s.npmCalls.length, 1);
    } finally {
        fs.rmSync(env.root, { recursive: true, force: true });
    }
});

test('a broken store entry (install does not match the lock) is reinstalled', () => {
    const env = makeEnv();
    try {
        setupMain(env, { mainLock: lockOf(STALE), mainInstalled: installedOf(STALE) });
        const a = setupWorktree(env, 'wt-a', { wtLock: lockOf(CURRENT) });
        runShell(env, `link_infra_node_modules ${JSON.stringify(a)}`);
        const [entry] = storeEntries(env);
        writeJson(path.join(env.store, entry, 'node_modules', '.package-lock.json'), installedOf(STALE));
        runShell(env, `link_infra_node_modules ${JSON.stringify(a)}`);
        assert.strictEqual(linkState(env, a).npmCalls.length, 2);
        assert.deepStrictEqual(storeEntries(env), [entry]);
    } finally {
        fs.rmSync(env.root, { recursive: true, force: true });
    }
});

test('a lock held by a live process falls back to npm ci in the worktree', () => {
    const env = makeEnv();
    try {
        setupMain(env, { mainLock: lockOf(STALE), mainInstalled: installedOf(STALE) });
        const a = setupWorktree(env, 'wt-a', { wtLock: lockOf(CURRENT) });
        const out = runShell(
            env,
            [
                `key="${PROJ}-$(infra_sha256 ${JSON.stringify(path.join(a, 'infra', PROJ, 'package-lock.json'))} | cut -c1-16)"`,
                'mkdir -p "${INFRA_STORE}/${key}.lock"',
                'echo $$ > "${INFRA_STORE}/${key}.lock/pid"',
                `AUTOPILOT_INFRA_LOCK_WAIT=0 link_infra_node_modules ${JSON.stringify(a)}`,
            ].join('\n'),
        );
        const s = linkState(env, a);
        assert.strictEqual(s.isSymlink, false);
        assert.strictEqual(s.npmCalls.length, 1);
        assert.match(s.npmCalls[0], /wt-a\/infra\/smalruby-rubytee-relay ci --no-audit --no-fund$/);
        assert.match(out, /installed: infra\/smalruby-rubytee-relay\/node_modules \(npm ci\)/);
    } finally {
        fs.rmSync(env.root, { recursive: true, force: true });
    }
});

test('a lock left by a dead process is taken over', () => {
    const env = makeEnv();
    try {
        setupMain(env, { mainLock: lockOf(STALE), mainInstalled: installedOf(STALE) });
        const a = setupWorktree(env, 'wt-a', { wtLock: lockOf(CURRENT) });
        runShell(
            env,
            [
                `key="${PROJ}-$(infra_sha256 ${JSON.stringify(path.join(a, 'infra', PROJ, 'package-lock.json'))} | cut -c1-16)"`,
                'mkdir -p "${INFRA_STORE}/${key}.lock"',
                // a pid that is not running
                '( exit 0 ) & dead=$!; wait "${dead}"',
                'echo "${dead}" > "${INFRA_STORE}/${key}.lock/pid"',
                `AUTOPILOT_INFRA_LOCK_WAIT=0 link_infra_node_modules ${JSON.stringify(a)}`,
            ].join('\n'),
        );
        const s = linkState(env, a);
        assert.strictEqual(s.isSymlink, true);
        assert.ok(s.target.startsWith(`${env.store}/`));
        assert.strictEqual(storeEntries(env).length, 1, 'lock released after linking');
    } finally {
        fs.rmSync(env.root, { recursive: true, force: true });
    }
});

test('prune_infra_store removes entries no worktree links to and keeps the rest (#1456)', () => {
    const env = makeEnv();
    try {
        setupMain(env, { mainLock: lockOf(STALE), mainInstalled: installedOf(STALE) });
        const a = setupWorktree(env, 'wt-a', { wtLock: lockOf(CURRENT) });
        const c = setupWorktree(env, 'wt-c', { wtLock: lockOf(NEWER) });
        runShell(env, `link_infra_node_modules ${JSON.stringify(a)}\nlink_infra_node_modules ${JSON.stringify(c)}`);
        const keep = path.basename(path.dirname(linkState(env, a).target));
        // wt-c goes away (as `git worktree remove` does), leaving its store entry unused
        fs.rmSync(c, { recursive: true, force: true });
        // a partial install whose owner is gone
        fs.mkdirSync(path.join(env.store, `${PROJ}-deadbeefdeadbeef.tmp.999999`), { recursive: true });
        const out = runShell(env, 'prune_infra_store');
        assert.deepStrictEqual(storeEntries(env), [keep]);
        assert.match(out, /removed: unused infra store/);
        assert.match(out, /removed: stale partial install/);
        assert.strictEqual(linkState(env, a).isSymlink, true);
        assert.ok(fs.existsSync(path.join(linkState(env, a).target, '.package-lock.json')));
    } finally {
        fs.rmSync(env.root, { recursive: true, force: true });
    }
});

test('prune_infra_store skips an entry whose lock is held', () => {
    const env = makeEnv();
    try {
        setupMain(env, { mainLock: lockOf(STALE), mainInstalled: installedOf(STALE) });
        const c = setupWorktree(env, 'wt-c', { wtLock: lockOf(NEWER) });
        runShell(env, `link_infra_node_modules ${JSON.stringify(c)}`);
        const [entry] = storeEntries(env);
        fs.rmSync(c, { recursive: true, force: true });
        runShell(env, `mkdir "\${INFRA_STORE}/${entry}.lock"\necho $$ > "\${INFRA_STORE}/${entry}.lock/pid"\nprune_infra_store`);
        assert.ok(storeEntries(env).includes(entry));
    } finally {
        fs.rmSync(env.root, { recursive: true, force: true });
    }
});

test('prune_infra_store is a no-op without a store', () => {
    const env = makeEnv();
    try {
        assert.strictEqual(runShell(env, 'prune_infra_store'), '');
    } finally {
        fs.rmSync(env.root, { recursive: true, force: true });
    }
});

test('re-preparing replaces a stale symlink to main with the shared store', () => {
    const r = runLinkInfra({
        mainLock: lockOf(STALE),
        mainInstalled: installedOf(STALE),
        wtLock: lockOf(CURRENT),
        wtExisting: 'symlink-to-main',
    });
    assert.strictEqual(r.isSymlink, true);
    assert.ok(r.target.startsWith(`${r.store}/`));
    assert.strictEqual(r.npmCalls.length, 1);
});

test('re-preparing keeps a real node_modules that equals the lock', () => {
    const r = runLinkInfra({
        mainLock: lockOf(STALE),
        mainInstalled: installedOf(STALE),
        wtLock: lockOf(CURRENT),
        wtExisting: installedOf(CURRENT),
    });
    assert.strictEqual(r.isSymlink, false);
    assert.deepStrictEqual(r.npmCalls, []);
});

test('re-preparing replaces a stale real node_modules with a symlink when main now matches', () => {
    const r = runLinkInfra({
        mainLock: lockOf(CURRENT),
        mainInstalled: installedOf(CURRENT),
        wtLock: lockOf(CURRENT),
        wtExisting: installedOf(STALE),
    });
    // `ln -s` into an existing directory would create node_modules/node_modules instead
    assert.strictEqual(r.isSymlink, true);
    assert.strictEqual(r.target, r.mainNodeModules);
    assert.deepStrictEqual(r.npmCalls, []);
});

test('bin/autopilot-worktree remove prunes the shared store', () => {
    const src = fs.readFileSync(SCRIPT, 'utf8');
    assert.ok(shellFunction(src, 'cmd_remove').includes('prune_infra_store'));
    assert.ok(/prune-infra-store\)\s+shift;\s+prune_infra_store/.test(src));
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
