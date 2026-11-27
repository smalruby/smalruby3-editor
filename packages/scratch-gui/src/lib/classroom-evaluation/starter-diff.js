/**
 * What a submission added to the starter project (#2423).
 *
 * Students start from the teacher's starter project, so most of a submission
 * is the starter itself. What shows the student's work is the scripts that
 * run (◆, attached to an event) and are not in the starter. Scripts that do
 * not run (◇) are left out: they do nothing when the work is played.
 *
 * Pure module: works on the pseudocode text of `analyzeProject`.
 */
import { humanizePseudocode } from './robot-humanize.js';

const RUNS = '◆';
const LOOSE = '◇';

/**
 * Split pseudocode into scripts.
 * @param {string} pseudocode - pseudocode of `analyzeProject`
 * @returns {Array<{runs: boolean, lines: string[]}>} scripts; lines keep their indentation
 */
const splitScripts = (pseudocode) => {
    const scripts = [];
    let current = null;
    for (const raw of humanizePseudocode(pseudocode).split('\n')) {
        const line = raw.replace(/\s+$/, '');
        if (line.startsWith(RUNS) || line.startsWith(LOOSE)) {
            current = { runs: line.startsWith(RUNS), lines: [] };
            scripts.push(current);
        } else if (line.startsWith('=== ')) {
            current = null;
        } else if (current && line.trim()) {
            current.lines.push(line);
        }
    }
    return scripts;
};

/**
 * Normalize a script to the text compared with the starter. Indentation is
 * kept (it shows what is inside a loop) but made relative to the hat.
 * @param {string[]} lines - lines of one script
 * @returns {string} the script text
 */
const scriptText = (lines) => {
    const base = Math.min(...lines.map((l) => l.length - l.trimStart().length));
    return lines.map((l) => l.slice(base)).join('\n');
};

/**
 * The running scripts of a pseudocode that do more than the hat alone.
 * @param {string} pseudocode - pseudocode text
 * @returns {string[]} script texts
 */
const runningScripts = (pseudocode) =>
    splitScripts(pseudocode)
        .filter((s) => s.runs && s.lines.length > 1)
        .map((s) => scriptText(s.lines));

/**
 * Accept either a pseudocode string or an `analyzeProject` result.
 * @param {string|object} value - pseudocode or analysis
 * @returns {string} pseudocode text
 */
const pseudocodeOf = (value) => (value && typeof value === 'object' ? value.pseudocode || '' : value || '');

/**
 * The running scripts a submission has that the starter does not.
 * Raw robot opcodes are humanized on both sides first, so an analysis saved
 * before the phrases existed still compares equal.
 * @param {string|object} pseudocode - the submission (pseudocode or analysis)
 * @param {string|object} starterPseudocode - the starter (pseudocode or analysis)
 * @returns {{added: string[], unchanged: boolean}} added scripts (without the ◆ line);
 *   unchanged is true when nothing running was added
 */
const diffFromStarter = (pseudocode, starterPseudocode) => {
    const starter = new Set(runningScripts(pseudocodeOf(starterPseudocode)));
    const seen = new Set();
    const added = [];
    for (const script of runningScripts(pseudocodeOf(pseudocode))) {
        if (starter.has(script) || seen.has(script)) continue;
        seen.add(script);
        added.push(script);
    }
    return { added, unchanged: added.length === 0 };
};

export { diffFromStarter, splitScripts, runningScripts };
