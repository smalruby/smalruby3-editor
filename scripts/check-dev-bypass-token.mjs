// Fail when a tracked file contains a real DEV_BYPASS_TOKEN value (#1393).
//
// The stg login bypass (`?devlogin=<DEV_BYPASS_TOKEN>`) leaked once through a commit that
// hard-coded the value. This check stops the same mistake before it is committed (husky
// pre-commit) and in CI (`npm run lint`). Empty values (`.env.example`) and placeholders such
// as `<DEV_BYPASS_TOKEN>` / `${DEV_BYPASS_TOKEN}` / `process.env.DEV_BYPASS_TOKEN` pass.
//
// CLI:
//   node scripts/check-dev-bypass-token.mjs           -> tracked files in the working tree
//   node scripts/check-dev-bypass-token.mjs --staged  -> staged contents (pre-commit)

import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// KEY=value / KEY: value / "KEY": "value" / KEY || 'value' / KEY ?? 'value'.
// The value must be at least 16 token characters and must not continue as an identifier,
// a member access or a call (`DEV_BYPASS_TOKEN = readTokenFromEnvironment()` is not a value).
// A period that ends a sentence (`DEV_BYPASS_TOKEN=<value>.` in docs) is still a value.
const LEAK_RE =
    /DEV_BYPASS_TOKEN['"]?\s*(?:[:=]|\|\||\?\?)\s*['"`]?[A-Za-z0-9_-]{16,}(?![A-Za-z0-9_(-]|\.[A-Za-z_$])/;

/**
 * Lines that contain a DEV_BYPASS_TOKEN value.
 * @param {Array<{file: string, line: number, text: string}>} lines candidate lines
 * @returns {Array<{file: string, line: number}>} the offending lines (without their text, so
 *     the value is never printed)
 */
const findLeaks = (lines) =>
    lines.filter(({ text }) => LEAK_RE.test(text)).map(({ file, line }) => ({ file, line }));

/**
 * Parse `git grep -z -n` output (`file\0line\0text\n`).
 * @param {string} out git grep output
 * @returns {Array<{file: string, line: number, text: string}>} parsed lines
 */
const parseGitGrep = (out) =>
    out
        .split('\n')
        .filter(Boolean)
        .map((row) => {
            const [file, line, ...rest] = row.split('\0');
            return { file, line: Number(line), text: rest.join('\0') };
        });

const candidateLines = (staged) => {
    const args = ['grep', '-z', '-n', '-I', '--fixed-strings'];
    if (staged) args.push('--cached');
    args.push('-e', 'DEV_BYPASS_TOKEN');
    try {
        return parseGitGrep(execFileSync('git', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }));
    } catch (e) {
        if (e.status === 1) return []; // no match
        throw e;
    }
};

const main = () => {
    const staged = process.argv.includes('--staged');
    const leaks = findLeaks(candidateLines(staged));
    if (!leaks.length) return 0;
    console.error('DEV_BYPASS_TOKEN の値がファイルに入っています（値は表示しません）:');
    for (const { file, line } of leaks) console.error(`  ${file}:${line}`);
    console.error(
        '値をファイルに書かず、.env から読んでください。手順は `?devlogin=<DEV_BYPASS_TOKEN>` のようにキー名で書きます。',
    );
    return 1;
};

if (process.argv[1] === fileURLToPath(import.meta.url)) {
    process.exitCode = main();
}

export { LEAK_RE, findLeaks, parseGitGrep };
