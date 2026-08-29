'use strict';

// Regression tests for Issue #1158: `bin/sync-worktree-env` must copy the
// gitignored per-stage env files of **every** infra project, not just the three
// that existed when the script was written (mesh-v2 / rubytee-relay / classroom).
//
// Why here: `bin/autopilot-worktree` (lightweight mode) delegates env copying to
// `bin/sync-worktree-env`, so a missing `.env.<stage>` breaks autopilot worktrees
// exactly like the missing husky/node_modules symlinks covered by the sibling
// `worktree-*.test.js` files. `tools/autopilot/test` is the only dependency-free
// (node:test) harness that exercises the repo's `bin/` shell scripts.
//
// The script now *scans* `infra/*/.env.<stage>` instead of hardcoding a list, so
// these tests pin the scan rules: skip the tracked `.env.example`, skip dated /
// suffixed backups (`.env.prod.20260719`), and never copy the `.env` symlink
// (stage selection stays local — see `.claude/rules/env-file.md`).

const { test } = require('node:test');
const assert = require('node:assert');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');
const SCRIPT = path.join(REPO_ROOT, 'bin', 'sync-worktree-env');

// Files laid out in the fake main checkout: [relative path, contents].
// Mirrors the real repo's messy state (mixed `.env.production` / `.env.prod`,
// dated backups, per-project `.env` symlinks).
const MAIN_FILES = [
    '.env',
    '.env.stg',
    'infra/smalruby-mesh-v2/.env.stg',
    'infra/smalruby-mesh-v2/.env.stg2',
    'infra/smalruby-mesh-v2/.env.production',
    'infra/smalruby-rubytee-relay/.env.stg',
    'infra/smalruby-rubytee-relay/.env.prod',
    'infra/smalruby-classroom/.env.stg',
    'infra/smalruby-classroom/.env.prod',
    'infra/smalruby-api/.env.stg',
    'infra/smalruby-api/.env.prod',
    'infra/smalruby-bug-report/.env.stg',
    'infra/smalruby-bug-report/.env.prod',
    'infra/smalruby-admin/.env.stg',
    'infra/smalruby-admin/.env.prod',
];

// Present in main but must NOT be copied.
const MAIN_NOISE = [
    'infra/smalruby-api/.env.example',
    'infra/smalruby-bug-report/.env.prod.20260719',
    'infra/smalruby-bug-report/.env.stg.bak-bootstrap',
];

/**
 * 使い捨ての main checkout + worktree を作り、`bin/sync-worktree-env` を worktree 内で実行する。
 * 一時ディレクトリは `t.after` で必ず片付ける（兄弟の worktree-*.test.js と同じ方針。
 * 片付けないと 1 回の `node --test` ごとに git worktree 入りの temp dir が 4 つ残る）。
 * @param {object} t node:test のテストコンテキスト（後片付けの登録に使う）。
 * @param {object} options オプション。
 * @param {string[]} options.args スクリプトに渡す引数（`--force` など）。
 * @param {Function} options.before 実行前に worktree を触るフック。引数は worktree の絶対パス。
 * @returns {{main: string, worktree: string, stdout: string}} 生成パスと標準出力。
 */
function runSync(t, { args = [], before } = {}) {
    const base = fs.mkdtempSync(path.join(os.tmpdir(), 'sync-env-'));
    t.after(() => fs.rmSync(base, { recursive: true, force: true }));
    const main = path.join(base, 'main');
    const worktree = path.join(base, 'wt');
    fs.mkdirSync(main);

    execFileSync('git', ['init', '-q', '-b', 'main'], { cwd: main });
    execFileSync('git', ['config', 'user.email', 'test@example.com'], { cwd: main });
    execFileSync('git', ['config', 'user.name', 'test'], { cwd: main });
    fs.writeFileSync(path.join(main, 'README.md'), 'test\n');
    execFileSync('git', ['add', '-A'], { cwd: main });
    execFileSync('git', ['commit', '-q', '-m', 'init', '--no-verify'], { cwd: main });

    for (const rel of [...MAIN_FILES, ...MAIN_NOISE]) {
        const abs = path.join(main, rel);
        fs.mkdirSync(path.dirname(abs), { recursive: true });
        fs.writeFileSync(abs, `${rel}\n`);
    }
    // Per-project `.env` symlinks (stage selection) must be ignored.
    for (const project of ['smalruby-mesh-v2', 'smalruby-classroom']) {
        fs.symlinkSync('.env.stg', path.join(main, 'infra', project, '.env'));
    }

    execFileSync('git', ['worktree', 'add', '-q', worktree, '-b', 'topic/test'], { cwd: main });
    if (before) {
        before(worktree);
    }

    const stdout = execFileSync(SCRIPT, args, { cwd: worktree, encoding: 'utf8' });
    return { main, worktree, stdout };
}

test('copies per-stage env files of every infra project', (t) => {
    const { worktree } = runSync(t);

    for (const rel of MAIN_FILES) {
        assert.strictEqual(
            fs.readFileSync(path.join(worktree, rel), 'utf8'),
            `${rel}\n`,
            `${rel} should be copied into the worktree`,
        );
    }
});

test('skips .env.example, dated backups, and the .env symlink', (t) => {
    const { worktree } = runSync(t);

    for (const rel of MAIN_NOISE) {
        assert.ok(!fs.existsSync(path.join(worktree, rel)), `${rel} should not be copied`);
    }
    for (const project of ['smalruby-mesh-v2', 'smalruby-classroom']) {
        const rel = `infra/${project}/.env`;
        assert.ok(!fs.existsSync(path.join(worktree, rel)), `${rel} symlink should not be copied`);
    }
});

test('tolerates infra projects that have no env file in main', (t) => {
    const { worktree, stdout } = runSync(t, {
        before: (wt) => {
            // An infra project that exists only in the worktree (no env in main).
            fs.mkdirSync(path.join(wt, 'infra', 'smalruby-future'), { recursive: true });
        },
    });

    assert.match(stdout, /summary: \d+ copied/);
    assert.ok(fs.existsSync(path.join(worktree, 'infra/smalruby-admin/.env.prod')));
});

test('is idempotent: a second run keeps existing files unless --force', (t) => {
    const rel = 'infra/smalruby-admin/.env.prod';
    const { worktree } = runSync(t);

    fs.writeFileSync(path.join(worktree, rel), 'local edit\n');
    execFileSync(SCRIPT, [], { cwd: worktree, encoding: 'utf8' });
    assert.strictEqual(fs.readFileSync(path.join(worktree, rel), 'utf8'), 'local edit\n');

    execFileSync(SCRIPT, ['--force'], { cwd: worktree, encoding: 'utf8' });
    assert.strictEqual(fs.readFileSync(path.join(worktree, rel), 'utf8'), `${rel}\n`);
});
