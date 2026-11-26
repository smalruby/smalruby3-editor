'use strict';
const test = require('node:test');
const assert = require('node:assert');
const lc = require('../src/lint-changed');

const VM_LINT =
    'eslint && format-message lint -e customrules -c .format-message-lint.json src/**/*.js && prettier --check .';
const GUI_LINT = 'eslint --max-warnings 0 && prettier --check .';

test('packageDirOf: packages / infra / tools/autopilot だけをパッケージにする', () => {
    assert.equal(lc.packageDirOf('packages/scratch-gui/src/a.jsx'), 'packages/scratch-gui');
    assert.equal(lc.packageDirOf('infra/smalruby-api/lambda/x.ts'), 'infra/smalruby-api');
    assert.equal(lc.packageDirOf('tools/autopilot/src/phases.js'), 'tools/autopilot');
    assert.equal(lc.packageDirOf('docs/autopilot/README.md'), null);
    assert.equal(lc.packageDirOf('packages/README.md'), null);
    assert.equal(lc.packageDirOf('bin/lint-changed'), null);
});

test('groupByPackage: パッケージごとに相対パスへ分け、重複を除く', () => {
    const g = lc.groupByPackage([
        'packages/scratch-gui/src/a.jsx',
        'packages/scratch-gui/src/a.jsx',
        'packages/scratch-vm/src/b.js',
        'docs/x.md',
    ]);
    assert.deepEqual(g.packages, {
        'packages/scratch-gui': ['src/a.jsx'],
        'packages/scratch-vm': ['src/b.js'],
    });
    assert.deepEqual(g.root, ['docs/x.md']);
});

test('formatMessageArgs: lint スクリプトから glob を除いた format-message lint の引数を取る', () => {
    assert.deepEqual(lc.formatMessageArgs(VM_LINT), ['-e', 'customrules', '-c', '.format-message-lint.json']);
    assert.equal(lc.formatMessageArgs(GUI_LINT), null);
    assert.equal(lc.formatMessageArgs(''), null);
});

test('packageCommands: eslint は lint 対象の拡張子だけ・設定の無いパッケージは飛ばす', () => {
    const cmds = lc.packageCommands('packages/scratch-gui', ['src/a.jsx', 'src/b.css', 'README.md'], {
        hasEslintConfig: true,
        lintScript: GUI_LINT,
    });
    assert.deepEqual(cmds, [
        {
            cwd: 'packages/scratch-gui',
            args: ['npx', 'eslint', '--max-warnings', '0', '--no-warn-ignored', 'src/a.jsx'],
        },
        {
            cwd: 'packages/scratch-gui',
            args: [
                'npx',
                'prettier',
                '--check',
                '--ignore-unknown',
                '--no-error-on-unmatched-pattern',
                'src/a.jsx',
                'src/b.css',
                'README.md',
            ],
        },
    ]);
    assert.deepEqual(
        lc.packageCommands('infra/smalruby-api', ['lambda/x.ts'], { hasEslintConfig: false, lintScript: '' }),
        [],
    );
});

test('packageCommands: scratch-vm の format-message は src/**/*.js を変えたときだけ', () => {
    const info = { hasEslintConfig: true, lintScript: VM_LINT };
    const withSrc = lc.packageCommands('packages/scratch-vm', ['src/x.js', 'test/unit/y.js'], info);
    assert.deepEqual(
        withSrc.map(c => c.args.slice(0, 3)),
        [
            ['npx', 'eslint', '--max-warnings'],
            ['npx', 'format-message', 'lint'],
            ['npx', 'prettier', '--check'],
        ],
    );
    assert.deepEqual(withSrc[1].args.slice(-1), ['src/x.js']);
    const testOnly = lc.packageCommands('packages/scratch-vm', ['test/unit/y.js'], info);
    assert.equal(
        testOnly.some(c => c.args[1] === 'format-message'),
        false,
    );
});

test('rootCommands: 秘密の検査はいつも・hosting のテストは対象を変えたときだけ', () => {
    assert.deepEqual(
        lc.rootCommands(['docs/x.md']).map(c => c.args),
        [['npm', 'run', 'lint:secrets']],
    );
    assert.deepEqual(
        lc.rootCommands(['scripts/hosting/dns-compare.mjs']).map(c => c.args),
        [
            ['npm', 'run', 'lint:secrets'],
            ['npm', 'run', 'test:hosting-scripts'],
        ],
    );
    assert.equal(
        lc.rootCommands(['scripts/precompress-assets.mjs']).length,
        2,
    );
});

test('planCommands: 変えたファイルが無ければ空', () => {
    assert.deepEqual(lc.planCommands([], {}), []);
});

test('planCommands: scratch-gui のファイルだけなら scratch-vm の lint は走らない', () => {
    const infos = {
        'packages/scratch-gui': { hasEslintConfig: true, lintScript: GUI_LINT },
        'packages/scratch-vm': { hasEslintConfig: true, lintScript: VM_LINT },
    };
    const cmds = lc.planCommands(['packages/scratch-gui/src/a.jsx'], infos);
    assert.equal(
        cmds.some(c => c.cwd === 'packages/scratch-vm'),
        false,
    );
    assert.deepEqual(
        cmds.map(c => c.cwd),
        ['.', 'packages/scratch-gui', 'packages/scratch-gui'],
    );
});

test('formatCommand: dry-run 用の 1 行', () => {
    assert.equal(lc.formatCommand({ cwd: '.', args: ['npm', 'run', 'lint:secrets'] }), 'npm run lint:secrets');
    assert.equal(
        lc.formatCommand({ cwd: 'packages/x', args: ['npx', 'eslint', 'a b.js'] }),
        "(cd packages/x && npx eslint 'a b.js')",
    );
});

test('parseArgs: --base と --dry-run', () => {
    assert.deepEqual(lc.parseArgs(['--base', 'topic/x', '--dry-run']), { base: 'topic/x', dryRun: true, help: false });
    assert.deepEqual(lc.parseArgs([]), { base: null, dryRun: false, help: false });
    assert.throws(() => lc.parseArgs(['--base']));
    assert.throws(() => lc.parseArgs(['--nope']));
});

test('baseCandidates: origin/ を先に試す', () => {
    assert.deepEqual(lc.baseCandidates(null, {}), ['origin/develop']);
    assert.deepEqual(lc.baseCandidates(null, { AUTOPILOT_BASE_BRANCH: 'topic/a' }), ['origin/topic/a']);
    assert.deepEqual(lc.baseCandidates('topic/a', {}), ['origin/topic/a', 'topic/a']);
    assert.deepEqual(lc.baseCandidates('origin/develop', {}), ['origin/develop']);
});

test('main: 失敗したコマンドがあれば 1 を返し、失敗したものを出す', () => {
    const out = [];
    const ran = [];
    const deps = {
        changedFiles: () => ['packages/scratch-gui/src/a.jsx'],
        packageInfo: () => ({ hasEslintConfig: true, lintScript: GUI_LINT }),
        run: cmd => {
            ran.push(cmd);
            return cmd.args[1] === 'eslint' ? 1 : 0;
        },
        log: s => out.push(s),
    };
    assert.equal(lc.main([], deps), 1);
    assert.equal(ran.length, 3);
    assert.ok(out.some(s => s.includes('failed') && s.includes('eslint')));
});

test('main: --dry-run は実行せず、変えたファイルが無ければ 0', () => {
    const out = [];
    const deps = {
        changedFiles: () => ['packages/scratch-gui/src/a.jsx'],
        packageInfo: () => ({ hasEslintConfig: true, lintScript: GUI_LINT }),
        run: () => {
            throw new Error('should not run');
        },
        log: s => out.push(s),
    };
    assert.equal(lc.main(['--dry-run'], deps), 0);
    assert.ok(out.includes('npm run lint:secrets'));
    assert.equal(lc.main([], { ...deps, changedFiles: () => [] }), 0);
});
