'use strict';
/**
 * lint-changed.js — 変えたファイルだけに lint をかける（Issue #2463）。
 *
 * ルートの `npm run lint` は scratch-vm と scratch-gui の全ファイルに eslint と prettier を
 * かけるので重く、worker が流すとコンテナがもたつく。全体は CI が流すので、手元では
 * base との差分・まだコミットしていない変更・新しいファイルだけを検査すれば足りる
 * （`.claude/rules/parallel-work.md` の「重い処理の一覧」）。
 *
 * 判断（パッケージへの振り分け・コマンドの組み立て）は純粋関数、git と子プロセスは
 * `main` の `deps` に置く（lockfile.js と同じ形）。入口は `bin/lint-changed`。
 */

const fs = require('fs');
const path = require('path');
const { execFileSync, spawnSync } = require('child_process');

/** eslint にかける拡張子（それ以外は prettier だけ）。 */
const ESLINT_EXTS = ['.js', '.jsx', '.mjs', '.cjs', '.ts', '.tsx'];

/** パッケージのディレクトリ（packages/<name>/・infra/<name>/・tools/autopilot/）。 */
const PACKAGE_RE = /^(packages\/[^/]+|infra\/[^/]+|tools\/autopilot)\//;

/** これを変えたときだけ hosting のスクリプトのテスト（`test:hosting-scripts`）を流す。 */
const HOSTING_TEST_RE = /^scripts\/(hosting\/|precompress-assets)/;

/**
 * ファイルが属するパッケージのディレクトリ。パッケージの外なら null。
 * @param {string} file リポジトリ root からの相対パス
 * @returns {(string|null)}
 */
function packageDirOf(file) {
    const m = PACKAGE_RE.exec(file);
    return m ? m[1] : null;
}

/**
 * 変えたファイルをパッケージごとに分ける。パッケージ内のパスはパッケージからの相対パスにする
 * （各パッケージのディレクトリでコマンドを流すため）。
 * @param {string[]} files リポジトリ root からの相対パス
 * @returns {{packages: Object<string, string[]>, root: string[]}}
 */
function groupByPackage(files) {
    const packages = {};
    const root = [];
    for (const file of [...new Set(files)]) {
        const dir = packageDirOf(file);
        if (!dir) {
            root.push(file);
            continue;
        }
        (packages[dir] = packages[dir] || []).push(file.slice(dir.length + 1));
    }
    return { packages, root };
}

/**
 * パッケージの `lint` スクリプトにある `format-message lint` の引数（glob は除く）。
 * 変えたファイルに同じ設定でかけるため。無ければ null。
 * @param {string} lintScript package.json の scripts.lint
 * @returns {(string[]|null)}
 */
function formatMessageArgs(lintScript) {
    const segment = String(lintScript || '')
        .split('&&')
        .map(s => s.trim())
        .find(s => s.startsWith('format-message lint'));
    if (!segment) return null;
    return segment
        .split(/\s+/)
        .slice(2)
        .filter(t => !t.includes('*'));
}

/**
 * パッケージの `lint` スクリプトにある `format-message lint` の glob。無ければ空。
 * @param {string} lintScript package.json の scripts.lint
 * @returns {string[]}
 */
function formatMessageGlobs(lintScript) {
    const segment = String(lintScript || '')
        .split('&&')
        .map(s => s.trim())
        .find(s => s.startsWith('format-message lint'));
    if (!segment) return [];
    return segment.split(/\s+/).filter(t => t.includes('*'));
}

/**
 * npm の scripts を流す sh（globstar なし）と同じ意味で glob に合うか。sh では `**` も `*` と同じで
 * `/` をまたがないので、scratch-vm の glob（src の下の 2 つ星）は `src/<dir>/<file>.js` だけに合う。
 * 全体の lint が見ないファイル（`src/extensions/<ext>/index.js` など）に format-message をかけると、
 * 古いパーサーが `?.` や `import()` で落ち、CI は通るのに手元だけ落ちる。
 * @param {string} glob パッケージからの相対の glob
 * @param {string} file パッケージからの相対パス
 * @returns {boolean}
 */
function shGlobMatch(glob, file) {
    const re = glob
        .split('')
        .map(c => {
            if (c === '*') return '[^/]*';
            if (c === '?') return '[^/]';
            return c.replace(/[\\^$.+()|{}[\]]/g, '\\$&');
        })
        .join('');
    return new RegExp(`^${re}$`).test(file);
}

/**
 * eslint の `--max-warnings` の値。パッケージの `lint` の eslint と同じにする（upstream の
 * scratch-render・scratch-svg-renderer は警告を許していて、0 にすると触っただけで落ちる）。
 * `lint` に eslint が無いパッケージ（Smalruby のもの）は 0（警告も残さない決まり）。
 * @param {string} lintScript package.json の scripts.lint
 * @returns {(string|null)} 付けないときは null
 */
function eslintMaxWarnings(lintScript) {
    const segment = String(lintScript || '')
        .split('&&')
        .map(s => s.trim())
        .find(s => /^eslint(\s|$)/.test(s));
    if (!segment) return '0';
    const m = /--max-warnings[\s=]+(\d+)/.exec(segment);
    return m ? m[1] : null;
}

/**
 * 1 パッケージで流すコマンド。eslint は設定のあるパッケージだけ、prettier は `lint` に
 * prettier があるパッケージだけ（`.prettierignore` のホワイトリストは prettier が自分で見る）。
 * @param {string} dir パッケージのディレクトリ
 * @param {string[]} files パッケージからの相対パス
 * @param {{hasEslintConfig:boolean, lintScript:string}} info
 * @returns {{cwd:string, args:string[]}[]}
 */
function packageCommands(dir, files, info) {
    const cmds = [];
    const lintScript = (info && info.lintScript) || '';
    const eslintFiles = files.filter(f => ESLINT_EXTS.includes(path.extname(f)));
    if (info && info.hasEslintConfig && eslintFiles.length > 0) {
        const maxWarnings = eslintMaxWarnings(lintScript);
        // --no-warn-ignored: 設定で外したファイルを渡しても警告にしない（--max-warnings 0 で落ちるため）
        cmds.push({
            cwd: dir,
            args: [
                'npx',
                'eslint',
                ...(maxWarnings === null ? [] : ['--max-warnings', maxWarnings]),
                '--no-warn-ignored',
                ...eslintFiles,
            ],
        });
    }
    const fmArgs = formatMessageArgs(lintScript);
    const fmGlobs = formatMessageGlobs(lintScript);
    const fmFiles = files.filter(f => fmGlobs.some(g => shGlobMatch(g, f)));
    if (fmArgs && fmFiles.length > 0) {
        cmds.push({ cwd: dir, args: ['npx', 'format-message', 'lint', ...fmArgs, ...fmFiles] });
    }
    if (/\bprettier\b/.test(lintScript) && files.length > 0) {
        cmds.push({
            cwd: dir,
            args: ['npx', 'prettier', '--check', '--ignore-unknown', '--no-error-on-unmatched-pattern', ...files],
        });
    }
    return cmds;
}

/**
 * リポジトリ root で流すコマンド。秘密の検査は軽いのでいつも流す。
 * @param {string[]} files 変えたファイル（root からの相対パス・全部）
 * @returns {{cwd:string, args:string[]}[]}
 */
function rootCommands(files) {
    const cmds = [{ cwd: '.', args: ['npm', 'run', 'lint:secrets'] }];
    if (files.some(f => HOSTING_TEST_RE.test(f))) {
        cmds.push({ cwd: '.', args: ['npm', 'run', 'test:hosting-scripts'] });
    }
    return cmds;
}

/**
 * 変えたファイルから、流すコマンドの一覧を作る。変えたファイルが無ければ空。
 * @param {string[]} files 変えたファイル
 * @param {Object<string, {hasEslintConfig:boolean, lintScript:string}>} infos パッケージの情報
 * @returns {{cwd:string, args:string[]}[]}
 */
function planCommands(files, infos) {
    if (!files || files.length === 0) return [];
    const { packages } = groupByPackage(files);
    const cmds = rootCommands(files);
    for (const dir of Object.keys(packages).sort()) {
        cmds.push(...packageCommands(dir, packages[dir], (infos || {})[dir]));
    }
    return cmds;
}

/**
 * dry-run・失敗の表示用に、コマンドを 1 行の shell の形にする。
 * @param {{cwd:string, args:string[]}} cmd
 * @returns {string}
 */
function formatCommand(cmd) {
    const quote = a => (/^[\w@%+=:,./-]+$/.test(a) ? a : `'${a.replace(/'/g, "'\\''")}'`);
    const line = cmd.args.map(quote).join(' ');
    return cmd.cwd === '.' ? line : `(cd ${quote(cmd.cwd)} && ${line})`;
}

/**
 * @param {string[]} argv
 * @returns {{base:(string|null), dryRun:boolean, help:boolean}}
 */
function parseArgs(argv) {
    const opts = { base: null, dryRun: false, help: false };
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i];
        if (a === '--dry-run') opts.dryRun = true;
        else if (a === '-h' || a === '--help') opts.help = true;
        else if (a === '--base') {
            if (i + 1 >= argv.length) throw new Error('--base needs a ref');
            opts.base = argv[++i];
        } else throw new Error(`unknown option: ${a}`);
    }
    return opts;
}

/**
 * 比べる base の候補（先に解決できたものを使う）。手元の develop は古いことがあるので
 * origin/ を先に試す。
 * @param {(string|null)} base --base の値
 * @param {object} env 環境変数（AUTOPILOT_BASE_BRANCH）
 * @returns {string[]}
 */
function baseCandidates(base, env) {
    const b = base || (env && env.AUTOPILOT_BASE_BRANCH) || 'develop';
    if (b.startsWith('origin/')) return [b];
    return base ? [`origin/${b}`, b] : [`origin/${b}`];
}

const USAGE = `usage: bin/lint-changed [--base <ref>] [--dry-run]
  --base <ref>  比べる base（既定: origin/$AUTOPILOT_BASE_BRANCH、無ければ origin/develop）
  --dry-run     流すコマンドだけを出す
`;

/**
 * git から変えたファイルを集める（base との差分 + まだコミットしていない変更 + 新しいファイル）。
 * 消したファイルは含めない。
 * @param {string} repoRoot
 * @param {string[]} candidates base の候補
 * @returns {string[]}
 */
function gitChangedFiles(repoRoot, candidates) {
    const git = args => execFileSync('git', args, { cwd: repoRoot, encoding: 'utf8' });
    const nul = s => s.split('\0').filter(Boolean);
    let mergeBase = null;
    for (const ref of candidates) {
        try {
            mergeBase = git(['merge-base', ref, 'HEAD']).trim();
            break;
        } catch {
            // 次の候補を試す
        }
    }
    if (!mergeBase) throw new Error(`cannot resolve base: ${candidates.join(' / ')}`);
    // -z: 日本語などのファイル名を "\\346..." の形に引用させない（引用されると existsSync で消える）
    const files = [
        // merge-base と作業ツリーの差分 = コミット済みの差分 + まだコミットしていない変更
        ...nul(git(['diff', '--name-only', '-z', '--diff-filter=ACMR', mergeBase])),
        ...nul(git(['ls-files', '-z', '--others', '--exclude-standard'])),
    ];
    return [...new Set(files)].filter(f => fs.existsSync(path.join(repoRoot, f))).sort();
}

/**
 * パッケージの情報（eslint の設定があるか・lint スクリプト）を読む。
 * @param {string} repoRoot
 * @param {string} dir
 * @returns {{hasEslintConfig:boolean, lintScript:string}}
 */
function readPackageInfo(repoRoot, dir) {
    const abs = path.join(repoRoot, dir);
    const hasEslintConfig = fs.existsSync(abs) && fs.readdirSync(abs).some(f => /^eslint\.config\.[cm]?[jt]s$/.test(f));
    let lintScript = '';
    try {
        const pkg = JSON.parse(fs.readFileSync(path.join(abs, 'package.json'), 'utf8'));
        lintScript = (pkg.scripts && pkg.scripts.lint) || '';
    } catch {
        // package.json の無いディレクトリは prettier も流さない
    }
    return { hasEslintConfig, lintScript };
}

/**
 * @param {string[]} argv
 * @param {object} [deps] テスト用の差し替え（changedFiles / packageInfo / run / log）
 * @returns {number} 終了コード
 */
function main(argv, deps = {}) {
    const log = deps.log || (s => process.stdout.write(`${s}\n`));
    let opts;
    try {
        opts = parseArgs(argv);
    } catch (err) {
        process.stderr.write(`${err.message}\n${USAGE}`);
        return 2;
    }
    if (opts.help) {
        log(USAGE.trimEnd());
        return 0;
    }
    const repoRoot =
        deps.repoRoot ||
        (deps.changedFiles ? '.' : execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim());
    const changedFiles = deps.changedFiles || (() => gitChangedFiles(repoRoot, baseCandidates(opts.base, process.env)));
    const packageInfo = deps.packageInfo || (dir => readPackageInfo(repoRoot, dir));
    const run =
        deps.run ||
        (cmd => {
            const r = spawnSync(cmd.args[0], cmd.args.slice(1), { cwd: path.join(repoRoot, cmd.cwd), stdio: 'inherit' });
            return r.status === null ? 1 : r.status;
        });

    let files;
    try {
        files = changedFiles();
    } catch (err) {
        process.stderr.write(`lint-changed: ${err.message}\n`);
        return 2;
    }
    if (files.length === 0) {
        log('lint-changed: no changed files');
        return 0;
    }
    const infos = {};
    for (const dir of Object.keys(groupByPackage(files).packages)) infos[dir] = packageInfo(dir);
    const cmds = planCommands(files, infos);
    if (opts.dryRun) {
        for (const cmd of cmds) log(formatCommand(cmd));
        return 0;
    }
    const failed = [];
    for (const cmd of cmds) {
        log(`lint-changed: ${formatCommand(cmd)}`);
        if (run(cmd) !== 0) failed.push(cmd);
    }
    if (failed.length > 0) {
        log(`lint-changed: ${failed.length} command(s) failed:`);
        for (const cmd of failed) log(`  failed [${cmd.cwd}] ${formatCommand(cmd)}`);
        return 1;
    }
    log('lint-changed: ok');
    return 0;
}

if (require.main === module) {
    process.exitCode = main(process.argv.slice(2));
}

module.exports = {
    ESLINT_EXTS,
    packageDirOf,
    groupByPackage,
    formatMessageArgs,
    formatMessageGlobs,
    shGlobMatch,
    eslintMaxWarnings,
    packageCommands,
    rootCommands,
    planCommands,
    formatCommand,
    parseArgs,
    baseCandidates,
    gitChangedFiles,
    readPackageInfo,
    main,
};
