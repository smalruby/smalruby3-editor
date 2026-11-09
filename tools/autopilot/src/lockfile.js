'use strict';
/**
 * lockfile.js — npm が入れた依存（`node_modules/.package-lock.json`）が、ある
 * `package-lock.json` と同じ版の集合かを判定する（Issue #1454）。
 *
 * 用途: 軽量 worktree（`bin/autopilot-worktree`）は `infra/<project>/node_modules` を
 * main checkout のものへ symlink して共有したい。ただし main checkout は人間と共有で
 * develop より古いことがあり、そのまま共有すると worktree の lock に足された依存
 * （#1442 の `@anthropic-ai/sdk` 等）が無くテストが読み込めない。そこで main の
 * 「入っている版」と worktree の lock を比べ、一致するときだけ symlink し、違えば
 * worktree で `npm ci` する。
 *
 * 比べ方: ファイルの完全一致ではなく `packages` の各 entry の `version` / `resolved` の
 * 集合で見る（npm の版で書式やメタデータが変わりうるため）。
 *   - ルート entry（キー `""`）は lock にしか無いので比べない。
 *   - lock の `optional: true` の entry（esbuild の他プラットフォーム版など）は、
 *     入っていなくてよい。入っていれば版は一致していること。
 *   - 入っているのに lock に無い entry があれば不一致（余計な版が混ざっている）。
 */

const fs = require('fs');

/**
 * lock の `packages` から比較対象の entry を取り出す（ルート entry を除く）。
 * @param {object} lock package-lock.json / .package-lock.json の中身
 * @returns {Map<string, {version:(string|null), resolved:(string|null), optional:boolean}>}
 */
function lockPackageSet(lock) {
    const set = new Map();
    const packages = (lock && typeof lock === 'object' && lock.packages) || {};
    for (const [key, entry] of Object.entries(packages)) {
        if (key === '' || !entry || typeof entry !== 'object') continue;
        set.set(key, {
            version: entry.version || null,
            resolved: entry.resolved || null,
            optional: entry.optional === true,
        });
    }
    return set;
}

/**
 * 2 つの entry が同じ版か。`resolved` は両方にあるときだけ比べる
 * （npm の版によって片方に無いことがあるため）。
 * @param {{version:(string|null), resolved:(string|null)}} a
 * @param {{version:(string|null), resolved:(string|null)}} b
 * @returns {boolean}
 */
function sameEntry(a, b) {
    if (a.version !== b.version) return false;
    if (a.resolved && b.resolved && a.resolved !== b.resolved) return false;
    return true;
}

/**
 * 入っている依存（installed = `node_modules/.package-lock.json`）が lock と一致するか。
 * 不一致の理由も返す（スクリプトのログ用。先頭の数件だけ）。
 * @param {object} installed node_modules/.package-lock.json の中身
 * @param {object} lock package-lock.json の中身
 * @returns {{match:boolean, reasons:string[]}}
 */
function compareInstalledToLock(installed, lock) {
    const have = lockPackageSet(installed);
    const want = lockPackageSet(lock);
    const reasons = [];
    for (const [key, w] of want) {
        const h = have.get(key);
        if (!h) {
            if (!w.optional) reasons.push(`missing ${key}@${w.version}`);
            continue;
        }
        if (!sameEntry(h, w)) reasons.push(`differs ${key}: ${h.version} != ${w.version}`);
    }
    for (const [key, h] of have) {
        if (!want.has(key)) reasons.push(`extra ${key}@${h.version}`);
    }
    return { match: reasons.length === 0, reasons };
}

/**
 * CLI: `node lockfile.js <installed .package-lock.json> <package-lock.json>`
 * 一致 = exit 0、不一致 = exit 1（理由を stderr）、読めない = exit 2。
 * installed が無い（node_modules が無い）のも「一致しない」として 1 を返す。
 * @param {string[]} argv
 * @returns {number} exit code
 */
function main(argv) {
    const [installedPath, lockPath] = argv;
    if (!installedPath || !lockPath) {
        process.stderr.write('usage: lockfile.js <installed .package-lock.json> <package-lock.json>\n');
        return 2;
    }
    if (!fs.existsSync(installedPath)) {
        process.stderr.write(`no installed lock: ${installedPath}\n`);
        return 1;
    }
    let installed;
    let lock;
    try {
        installed = JSON.parse(fs.readFileSync(installedPath, 'utf8'));
        lock = JSON.parse(fs.readFileSync(lockPath, 'utf8'));
    } catch (err) {
        process.stderr.write(`cannot read lock files: ${err.message}\n`);
        return 2;
    }
    const { match, reasons } = compareInstalledToLock(installed, lock);
    if (!match) {
        const shown = reasons.slice(0, 5).join('; ');
        const more = reasons.length > 5 ? ` (+${reasons.length - 5} more)` : '';
        process.stderr.write(`${shown}${more}\n`);
    }
    return match ? 0 : 1;
}

if (require.main === module) {
    process.exitCode = main(process.argv.slice(2));
}

module.exports = { lockPackageSet, sameEntry, compareInstalledToLock, main };
