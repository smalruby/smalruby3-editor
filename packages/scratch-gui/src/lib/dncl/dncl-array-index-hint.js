// === Smalruby: This file is Smalruby-specific (DNCL 0-based array index hints) ===

import { dnclV2PreprocessWithLineMap } from './dncl-v2-preprocessor';

// Smalruby DNCL arrays start at index 0, like the 共通テスト notation by
// default. A program written for a problem that says "the index starts at 1"
// reads past the end of an array, but the Scratch VM silently returns an
// empty value there, so the user gets wrong output and no error (Issue
// #1357). These hints point at the accesses that run past the end so the
// editor can tell the user that indices start at 0.

const ID = '[A-Za-z_\\u3040-\\u309F\\u30A0-\\u30FF\\u4E00-\\u9FFF][\\w\\u3040-\\u309F\\u30A0-\\u30FF\\u4E00-\\u9FFF]*';
const ID_CHAR = '[\\w\\u3040-\\u309F\\u30A0-\\u30FF\\u4E00-\\u9FFF]';

const FOR_RE = new RegExp(`^(${ID})\\s+を\\s+(.+?)\\s+から\\s+(.+?)\\s+まで\\s+(.+?)\\s+ずつ(増やし|減らし)ながら$`);
const ASSIGN_RE = new RegExp(`^(${ID})\\s*(?:=(?!=)|←|\\+=|-=|\\*=|\\/=)`);
const ARRAY_LITERAL_RE = new RegExp(`^(${ID})\\s*(?:=|←)\\s*\\[(.*)\\]$`);
const INT_ASSIGN_RE = new RegExp(`^(${ID})\\s*(?:=|←)\\s*(-?\\d+)$`);
const ACCESS_RE = new RegExp(`(?<!${ID_CHAR})(${ID})\\[\\s*([^\\[\\]]*?)\\s*\\]`, 'g');
const BOUND_RE = new RegExp(`^(-?\\d+|${ID}|要素数\\(\\s*(${ID})\\s*\\))(?:\\s*([+-])\\s*(\\d+))?$`);
const FUNCTION_RE = new RegExp(`^関数\\s+${ID}\\s*\\(([^)]*)\\)$`);
// List blocks that add or remove items appear as these Ruby calls in DNCL.
const RESIZE_RE = new RegExp(`(?<!${ID_CHAR})(${ID})\\.(?:push|insert|delete_at|delete|clear|pop|shift|unshift|concat)(?!${ID_CHAR})`, 'g');

const OPENERS = [/^もし\s+.+\s+(?:なら|ならば)$/, /^.+\s+の間$/, /^関数\s/];
const CLOSERS = ['を繰り返す', 'を実行する', 'と定義する', 'を定義する'];

/**
 * Blank out string literals and drop a trailing `#` comment, keeping the
 * other characters in place.
 * @param {string} line - A DNCL source line.
 * @returns {string} The code part of the line.
 */
const codeOf = (line) => {
    let out = '';
    let quote = null;
    for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (quote) {
            if (ch === '\\' && quote !== '」') {
                out += '  ';
                i++;
            } else {
                out += ch === quote ? ch : ' ';
                if (ch === quote) quote = null;
            }
            continue;
        }
        if (ch === '#') break;
        if (ch === '"' || ch === "'") quote = ch;
        if (ch === '「') quote = '」';
        out += ch;
    }
    return out;
};

/**
 * Count the elements of an array literal body (`1, [2, 3], "a"`).
 * @param {string} body - The text between the outer brackets.
 * @returns {number} The number of top-level elements.
 */
const countElements = (body) => {
    if (body.trim() === '') return 0;
    let depth = 0;
    let count = 1;
    for (const ch of body) {
        if (ch === '[' || ch === '(') depth++;
        else if (ch === ']' || ch === ')') depth--;
        else if (ch === ',' && depth === 0) count++;
    }
    return count;
};

/**
 * Collect the arrays and integer variables whose value is fixed for the
 * whole program: assigned exactly once, by a literal, and (for arrays) never
 * resized by a call such as `X.push(v)`.
 * @param {Array<string>} lines - The code parts of the source lines.
 * @returns {{lengths: Map<string, number>, constants: Map<string, number>}}
 *   The array lengths and the integer constants by name.
 */
const collectFixedValues = (lines) => {
    const assignCounts = new Map();
    const lengths = new Map();
    const constants = new Map();
    for (const raw of lines) {
        const line = raw.trim();
        const forMatch = line.match(FOR_RE);
        const assigned = forMatch ? forMatch[1] : (line.match(ASSIGN_RE) || [])[1];
        if (!assigned) continue;
        assignCounts.set(assigned, (assignCounts.get(assigned) || 0) + 1);
        const arrayMatch = line.match(ARRAY_LITERAL_RE);
        if (arrayMatch) lengths.set(assigned, countElements(arrayMatch[2]));
        const intMatch = line.match(INT_ASSIGN_RE);
        if (intMatch) constants.set(assigned, Number(intMatch[2]));
    }
    for (const line of lines) {
        for (const [, name] of line.matchAll(RESIZE_RE)) lengths.delete(name);
    }
    for (const map of [lengths, constants]) {
        for (const name of map.keys()) {
            if (assignCounts.get(name) !== 1) map.delete(name);
        }
    }
    for (const [name, length] of lengths) {
        if (length === 0) lengths.delete(name);
    }
    return { lengths, constants };
};

/**
 * Drop the values whose names a function parameter shadows: inside the
 * function, such a name holds whatever the caller passes.
 * @param {{lengths: Map<string, number>, constants: Map<string, number>}} fixed
 *   The values from `collectFixedValues`.
 * @param {Set<string>} params - The parameter names in scope.
 * @returns {{lengths: Map<string, number>, constants: Map<string, number>}}
 *   The values that still hold.
 */
const withoutParams = (fixed, params) => {
    if (params.size === 0) return fixed;
    const keep = (map) => new Map([...map].filter(([name]) => !params.has(name)));
    return { lengths: keep(fixed.lengths), constants: keep(fixed.constants) };
};

/**
 * Evaluate a loop bound such as `9`, `n`, `要素数(X)` or `要素数(X) - 1`.
 * @param {string} expr - The bound expression.
 * @param {{lengths: Map<string, number>, constants: Map<string, number>}} fixed
 *   The values from `collectFixedValues`.
 * @returns {?number} The value, or null when it is not known statically.
 */
const evaluateBound = (expr, fixed) => {
    const match = expr.trim().match(BOUND_RE);
    if (!match) return null;
    const [, term, lengthOf, sign, offset] = match;
    let value;
    if (lengthOf) value = fixed.lengths.get(lengthOf);
    else if (/^-?\d+$/.test(term)) value = Number(term);
    else value = fixed.constants.get(term);
    if (typeof value !== 'number') return null;
    if (sign) value += sign === '+' ? Number(offset) : -Number(offset);
    return value;
};

/**
 * Work out the largest value a counting loop gives its variable.
 * @param {string} from - The start expression.
 * @param {string} to - The end expression.
 * @param {string} step - The step expression.
 * @param {boolean} ascending - Whether the loop counts up.
 * @param {{lengths: Map<string, number>, constants: Map<string, number>}} fixed
 *   The values from `collectFixedValues`.
 * @returns {?number} The largest value, or null when it is not known
 *   statically or the loop never runs.
 */
const loopMaximum = (from, to, step, ascending, fixed) => {
    const start = evaluateBound(from, fixed);
    const end = evaluateBound(to, fixed);
    const by = evaluateBound(step, fixed);
    if (start !== null && end !== null && (ascending ? start > end : start < end)) return null;
    if (!ascending) return start;
    if (end === null || by === null || by <= 0) return null;
    // A step of 1 always ends at `to`; a larger one may stop short of it.
    if (by === 1) return end;
    if (start === null) return null;
    return start + Math.floor((end - start) / by) * by;
};

/**
 * Find array accesses that run past the end of the array, which is what a
 * program written with 1-based indices does. Two cases are detected:
 * `X[i]` inside a counting loop whose largest `i` is the length of `X` or
 * more, and `X[n]` with a constant `n` that is the length of `X` or more.
 * Only arrays assigned once by a literal and never resized (and bounds known
 * statically) are checked, and names that a function parameter shadows are
 * not used, so the hints never guess.
 * @param {string} source - The DNCL source code.
 * @returns {Array<object>} The hints, each with the 1-based DNCL source
 *   `line`, the `access` text (`Nissu[kougeihin]`), the `array` name, the
 *   `last` valid index, and a `fixed` access to suggest.
 */
const findArrayIndexHints = (source) => {
    const { source: normalized, lineMap } = dnclV2PreprocessWithLineMap(source);
    const lines = normalized.split('\n').map(codeOf);
    const fixed = collectFixedValues(lines);
    const hints = [];
    // Each open block; counting loops carry their variable and largest value,
    // functions their parameter names.
    const blocks = [];

    lines.forEach((raw, idx) => {
        const line = raw.trim();
        if (CLOSERS.includes(line)) {
            blocks.pop();
            return;
        }
        const params = new Set(blocks.flatMap((b) => (b && b.params) || []));
        const visible = withoutParams(fixed, params);
        for (const match of line.matchAll(ACCESS_RE)) {
            const [access, array, index] = match;
            const length = visible.lengths.get(array);
            if (typeof length !== 'number') continue;
            const loop = [...blocks].reverse().find((b) => b && b.loopVar === index);
            let hint = null;
            if (loop) {
                // One hint per array and loop is enough to explain the mistake.
                if (loop.max !== null && loop.max >= length && !loop.reported.has(array)) {
                    loop.reported.add(array);
                    hint = `${array}[${index} - 1]`;
                }
            } else if (/^\d+$/.test(index) && Number(index) >= length) {
                hint = `${array}[${Number(index) - 1}]`;
            }
            if (hint) {
                hints.push({
                    line: lineMap[idx] || idx + 1,
                    access,
                    array,
                    last: length - 1,
                    fixed: hint,
                });
            }
        }
        const forMatch = line.match(FOR_RE);
        if (forMatch) {
            const [, loopVar, from, to, step, direction] = forMatch;
            const max = loopMaximum(from, to, step, direction === '増やし', visible);
            blocks.push({ loopVar, max, reported: new Set() });
            return;
        }
        const functionMatch = line.match(FUNCTION_RE);
        if (functionMatch) {
            const names = functionMatch[1].split(',').map((p) => p.trim());
            blocks.push({ params: names.filter(Boolean) });
        } else if (OPENERS.some((re) => re.test(line))) {
            blocks.push(null);
        }
    });
    return hints;
};

export { findArrayIndexHints };
