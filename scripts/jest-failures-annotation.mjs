// List the failed jest tests as one GitHub Actions check-run annotation.
//
// The jest `github-actions` reporter adds one annotation per failed test, with the
// expected / received diff. GitHub keeps only 10 error annotations per step (50 per job),
// and a test file that fails to run (syntax error, missing module) gets none. This script
// reads the `--json --outputFile` result of the same run and prints one `::error::` with
// every failed test and test file, so their names can be read from the check-run
// annotations API (`gh api repos/{owner}/{repo}/check-runs/<id>/annotations`) even then.
//
// CLI: node scripts/jest-failures-annotation.mjs <jest-results.json> [...]
//   Prints nothing when every test passed.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

export const MAX_LISTED = 100;

// https://github.com/actions/toolkit/blob/main/packages/core/src/command.ts
const escapeData = s => s.replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A');
const escapeProperty = s => escapeData(s).replace(/:/g, '%3A').replace(/,/g, '%2C');

// The first line that says why, skipping jest's `● Test suite failed to run` heading.
const firstLine = s =>
    String(s || '')
        .split('\n')
        .map(line => line.trim())
        .find(line => line !== '' && !line.startsWith('●')) || '';

/**
 * Collect the failed tests and the test files that failed to run.
 * @param {object} results - The jest `--json` result.
 * @param {string} cwd - Directory the test file paths are shown relative to.
 * @returns {string[]} One line per failure (`<file> › <test name>`).
 */
export const failedEntries = (results, cwd) => {
    const entries = [];
    for (const suite of results.testResults || []) {
        const file = path.relative(cwd, suite.name || '') || suite.name;
        const failed = (suite.assertionResults || []).filter(a => a.status === 'failed');
        for (const a of failed) {
            entries.push(`${file} › ${a.fullName || [...(a.ancestorTitles || []), a.title].join(' ')}`);
        }
        if (failed.length === 0 && suite.status === 'failed') {
            const reason = firstLine(suite.testExecError?.message || suite.message);
            entries.push(`${file} › (test file failed to run)${reason ? `: ${reason}` : ''}`);
        }
    }
    return entries;
};

/**
 * Build the workflow command for the failures.
 * @param {string[]} entries - From `failedEntries`.
 * @param {string} label - What ran (e.g. the result file name).
 * @returns {string|null} The `::error` line, or null when nothing failed.
 */
export const annotationCommand = (entries, label) => {
    if (entries.length === 0) return null;
    const listed = entries.slice(0, MAX_LISTED);
    const rest = entries.length - listed.length;
    const lines = rest > 0 ? [...listed, `... and ${rest} more`] : listed;
    const title = `jest: ${entries.length} failed (${label})`;
    return `::error title=${escapeProperty(title)}::${escapeData(lines.join('\n'))}`;
};

const main = files => {
    for (const file of files) {
        if (!fs.existsSync(file)) {
            // jest stopped before writing its result (crash, out of memory, timeout).
            console.log(
                `::error title=${escapeProperty(`jest: no result (${file})`)}::` +
                    escapeData(`${file} was not written. jest may have stopped before the end of the run.`),
            );
            continue;
        }
        const results = JSON.parse(fs.readFileSync(file, 'utf8'));
        const command = annotationCommand(failedEntries(results, process.cwd()), path.basename(file));
        if (command) console.log(command);
    }
};

if (process.argv[1] === fileURLToPath(import.meta.url)) {
    main(process.argv.slice(2));
}
