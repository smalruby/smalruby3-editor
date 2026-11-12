// === Smalruby: This file is Smalruby-specific (Ruby→DNCL identifier conversion) ===
import { findMatchingClose, skipString } from './paren-utils';

/** Regex character class for identifiers: word chars + CJK (hiragana, katakana, kanji). */
const ID = '\\w\\u3040-\\u309F\\u30A0-\\u30FF\\u4E00-\\u9FFF';

/**
 * Convert a Ruby variable reference back to DNCL name.
 * `@_var_X_` → `X`, `@_array_X_` → `X`, `@x` → `x`.
 * @param {string} segment - Code segment.
 * @returns {string} Segment with Ruby vars converted to DNCL.
 */
const convertVarRefs = (segment) => {
    let result = segment;
    // @_array_Name_ → Name
    result = result.replace(new RegExp(`@_array_([${ID}]+)_`, 'g'), '$1');
    // @_var_Name_ → Name
    result = result.replace(new RegExp(`@_var_([${ID}]+)_`, 'g'), '$1');
    // @name → name (but not @@ or @_ prefixed patterns already handled)
    result = result.replace(new RegExp(`@([${ID}]+)`, 'g'), '$1');
    return result;
};

/**
 * Convert Ruby operators back to DNCL operators.
 * @param {string} segment - Code segment outside strings.
 * @returns {string} Segment with DNCL operators.
 */
const convertOperators = (segment) => {
    let result = segment;
    result = result.replace(/(?<=\s|^)&&(?=\s|$)/g, 'かつ');
    result = result.replace(/(?<=\s|^)\|\|(?=\s|$)/g, 'または');
    result = result.replace(/(?<=\s|^)true(?=\s|$)/g, '真');
    result = result.replace(/(?<=\s|^)false(?=\s|$)/g, '偽');

    return result;
};

/** Characters of a name in an operand: `@var`, `obj.method?`. */
const NAME_CHAR_RE = new RegExp(`[${ID}@.?]`);

/**
 * Find the `]` that closes the `[` at `open`, skipping strings.
 * @param {string} text - The text.
 * @param {number} open - Position of `[`.
 * @returns {number} Position of the matching `]`, or -1.
 */
const findMatchingBracket = (text, open) => {
    let depth = 0;
    let i = open;
    while (i < text.length) {
        const ch = text[i];
        if (ch === '"' || ch === "'") {
            i = skipString(text, i, ch);
            continue;
        }
        if (ch === '[') depth++;
        if (ch === ']' && --depth === 0) return i;
        i++;
    }
    return -1;
};

/**
 * End of the operand of a `!` that starts at `start`: a name with its
 * calls / indexes (`f(x)`, `A[i]`, `touching?("_edge_")`), a `( ... )`
 * group, a string, or another `!operand`.
 * @param {string} text - The line.
 * @param {number} start - Where the operand starts.
 * @returns {number} The position just after the operand (`start` if none).
 */
const operandEnd = (text, start) => {
    if (text[start] === '!') {
        const end = operandEnd(text, start + 1);
        return end === start + 1 ? start : end;
    }
    let i = start;
    while (i < text.length) {
        const ch = text[i];
        if (ch === '(') {
            const close = findMatchingClose(text, i);
            if (close === -1) return i;
            i = close + 1;
        } else if (ch === '[' && i > start) {
            const close = findMatchingBracket(text, i);
            if (close === -1) return i;
            i = close + 1;
        } else if ((ch === '"' || ch === "'") && i === start) {
            i = skipString(text, i, ch);
        } else if (NAME_CHAR_RE.test(ch)) {
            i++;
        } else {
            break;
        }
    }
    return i;
};

/**
 * Whether the `=` at `i` is an assignment (`=`, `+=`, ...), not part of
 * `==`, `!=`, `<=`, `>=`, `=~` or `=>`.
 * @param {string} line - The line.
 * @param {number} i - The position of `=`.
 * @returns {boolean} True for an assignment `=`.
 */
const isAssignmentAt = (line, i) =>
    line[i] === '=' && !/[=!<>]/.test(line[i - 1] || '') && !/[=~>]/.test(line[i + 1] || '');

/**
 * Convert Ruby's `!operand` to DNCL's postfix `operand でない`. The whole
 * operand moves in front of `でない` — `!f(x)` is `f(x) でない` and
 * `!(a > 10)` is `(a > 10) でない` — so `dnclToRuby` negates the same
 * thing again. `!=` and method names like `save!` are left as they are.
 * (Issue #1662)
 * @param {string} line - A line of Ruby code.
 * @returns {string} The line with `!` turned into `でない`.
 */
const convertNot = (line) => {
    if (!line.includes('!')) return line;
    let out = '';
    // Where the current term starts in `out`, one entry per open bracket.
    const starts = [0];
    let i = 0;
    while (i < line.length) {
        const ch = line[i];
        if (ch === '#') {
            out += line.substring(i);
            break;
        }
        if (ch === '"' || ch === "'") {
            const end = skipString(line, i, ch);
            out += line.substring(i, end);
            i = end;
            continue;
        }
        if (ch === '!' && line[i + 1] !== '=' && !(i > 0 && NAME_CHAR_RE.test(line[i - 1]))) {
            let start = i + 1;
            while (line[start] === ' ') start++;
            const end = operandEnd(line, start);
            if (end > start) {
                const negated = `${convertNot(line.substring(start, end))} でない`;
                // `でない` negates everything before it up to かつ / または, so a
                // `!` in the middle of a term (`a == !b`) is put in parentheses:
                // `a == (b でない)`, not `a == b でない` (= `!(a == b)`).
                const inTerm = out.substring(starts[starts.length - 1]).trim() !== '';
                out += inTerm ? `(${negated})` : negated;
                i = end;
                continue;
            }
        }
        const logical = line.slice(i).match(/^(&&|\|\||\s(?:and|or)\s)/);
        if (logical) {
            out += logical[0];
            i += logical[0].length;
            starts[starts.length - 1] = out.length;
            continue;
        }
        out += ch;
        i++;
        if (ch === '(' || ch === '[') {
            starts.push(out.length);
        } else if (ch === ')' || ch === ']') {
            if (starts.length > 1) starts.pop();
        } else if (ch === ',' || isAssignmentAt(line, i - 1)) {
            starts[starts.length - 1] = out.length;
        }
    }
    return out;
};

/**
 * Process a line, applying conversions only outside strings and comments.
 * @param {string} source - A line of code.
 * @returns {string} The converted line.
 */
const processSegments = (source) => {
    // The operand of `!` may hold a string (`!f("x")`), so `!` is converted
    // on the whole line before splitting it at strings.
    const line = convertNot(source);
    let result = '';
    let i = 0;

    while (i < line.length) {
        if (line[i] === '#') {
            result += line.substring(i);
            break;
        }
        if (line[i] === '"' || line[i] === "'") {
            const quote = line[i];
            const end = skipString(line, i, quote);
            result += line.substring(i, end);
            i = end;
            continue;
        }
        let segEnd = i;
        while (segEnd < line.length) {
            if (line[segEnd] === '"' || line[segEnd] === "'" || line[segEnd] === '#') {
                break;
            }
            segEnd++;
        }
        if (segEnd > i) {
            let segment = line.substring(i, segEnd);
            segment = convertOperators(segment);
            segment = convertVarRefs(segment);
            result += segment;
            i = segEnd;
        }
    }

    return result;
};

export { ID, convertNot, convertOperators, convertVarRefs, processSegments };
