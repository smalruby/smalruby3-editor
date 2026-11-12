// === Smalruby: This file is Smalruby-specific (DNCL→Ruby identifier conversion) ===
import { DNCL_KEYWORDS, RUBY_LITERALS } from './dncl-keywords';
import { addArrayName, isArrayName, isFunctionName, isFunctionParam, mapVarName } from './dncl-state';
import { isSingleOperand, skipString, wrapIntegerDivisions } from './paren-utils';

/**
 * Check if a character is the start of an identifier.
 * @param {string} ch - The character to check.
 * @returns {boolean} True if the character starts an identifier.
 */
const isIdentStart = (ch) => /[a-zA-Z_぀-ゟ゠-ヿ一-鿿]/.test(ch);

/**
 * Check if a character is part of an identifier.
 * @param {string} ch - The character to check.
 * @returns {boolean} True if the character is part of an identifier.
 */
const isIdentChar = (ch) => /[a-zA-Z0-9_぀-ゟ゠-ヿ一-鿿]/.test(ch);

/**
 * Convert a single DNCL token/identifier to its Ruby equivalent.
 * @param {string} name - The identifier.
 * @returns {string} The Ruby variable reference.
 */
const convertIdentifier = (name) => {
    if (DNCL_KEYWORDS.has(name)) return name;
    if (RUBY_LITERALS.has(name)) return name;
    if (isFunctionName(name)) return name;
    // Inside a `関数 ... と定義する` block, a parameter name should stay as
    // a bare local identifier — Ruby's method parameter — not be prefixed
    // with `@` (instance variable). Without this check, the def body
    // would silently reference the sprite's instance vars instead of the
    // arguments it was called with. (Issue #642)
    if (isFunctionParam(name)) return name;
    if (/^\d/.test(name)) return name;
    if (/^[A-Z]/.test(name)) {
        return mapVarName(name, isArrayName(name));
    }
    return `@${name}`;
};

/**
 * Convert Japanese bracket strings 「...」 to "..." in a line.
 * 「」 inside a `"..."` / `'...'` literal are part of that string's text
 * (a Japanese sentence often quotes words with 「」), so they are left as
 * they are. (Issue #1457)
 * @param {string} line - The source line.
 * @returns {string} The line with converted strings.
 */
const convertJapaneseStrings = (line) => {
    let result = '';
    let i = 0;
    while (i < line.length) {
        const ch = line[i];
        if (ch === '"' || ch === "'") {
            const end = skipString(line, i, ch);
            result += line.substring(i, end);
            i = end;
            continue;
        }
        if (ch === '「') {
            const close = line.indexOf('」', i + 1);
            if (close !== -1) {
                result += `"${line.substring(i + 1, close)}"`;
                i = close + 1;
                continue;
            }
        }
        result += ch;
        i++;
    }
    return result;
};

/**
 * Convert arrow assignment ← to = in a string.
 * @param {string} str - The string to convert.
 * @returns {string} The string with arrows replaced.
 */
const convertArrow = (str) => str.replace(/\s*←\s*/g, ' = ');

/**
 * Convert operators in a line segment (outside strings).
 * @param {string} segment - A code segment outside of strings.
 * @returns {string} The segment with converted operators.
 */
const convertOperators = (segment) => {
    let result = segment;

    // 共通テスト用プログラム表記: `/` is the ordinary division and `÷` the
    // integer quotient; `wrapIntegerDivisions` below turns each `÷` into
    // `(A / B).to_i`. (Issue #1701, replacing E of #665)
    // Smalruby's `//` is the integer quotient too. It keeps its own rewrite,
    // so its output stays as it was (the `÷` in it becomes `/` below).
    result = result.replace(/(\S+)\s*\/\/\s*(\S+)/g, (_, left, right) => `(${left} ÷ ${right}).to_i`);
    result = result.replace(/≦/g, '<=');
    result = result.replace(/≧/g, '>=');

    // Japanese logical/boolean keywords (no \b for CJK characters)
    result = result.replace(/(?<=\s|^)かつ(?=\s|$)/g, '&&');
    result = result.replace(/(?<=\s|^)または(?=\s|$)/g, '||');
    // `!` / `(` before them come from `でない` (`真 でない` → `!真`).
    result = result.replace(/(?<=[\s!(]|^)真(?=[\s),]|$)/g, 'true');
    result = result.replace(/(?<=[\s!(]|^)偽(?=[\s),]|$)/g, 'false');

    // The Ruby-side blocks converter maps `.to_i` to the floor mathop block
    // for actual runtime truncation.
    result = wrapIntegerDivisions(result);
    // A `÷` whose operands could not be read (a Japanese name before it) is
    // left as Ruby `/`, as before.
    result = result.replace(/÷/g, '/');

    return result;
};

/** Words that end the operand of a `でない` (it binds tighter than they do). */
const LOGICAL_WORDS = ['かつ', 'または', '&&', '||'];

/** The postfix logical NOT of DNCL. */
const NEGATION = 'でない';

/**
 * Whether `word` starts at `i` as a whole word: a space or the line edge
 * before it, and a space, the line edge, a closing bracket or a comma after
 * it (`表示する(a でない)`). DNCL words like `かつ` have no `\b` boundary in
 * a regex.
 * @param {string} line - The source line.
 * @param {number} i - The position to check.
 * @param {string} word - The word.
 * @returns {boolean} True if the word is there as a whole word.
 */
const isWordAt = (line, i, word) =>
    line.startsWith(word, i) &&
    (i === 0 || /\s/.test(line[i - 1])) &&
    /^(\s|$|[)\],])/.test(line.slice(i + word.length));

/**
 * The first of `words` that starts at `i` as a whole word.
 * @param {string} line - The source line.
 * @param {number} i - The position to check.
 * @param {Array<string>} words - The words.
 * @returns {string|undefined} The word, or undefined.
 */
const wordAt = (line, i, words) => words.find((w) => isWordAt(line, i, w));

/**
 * Whether the `=` at `i` is an assignment (not part of `==`, `!=`, `<=`, `>=`).
 * @param {string} line - The source line.
 * @param {number} i - The position of `=`.
 * @returns {boolean} True for an assignment `=`.
 */
const isAssignmentAt = (line, i) => line[i] === '=' && !/[=!<>]/.test(line[i - 1] || '') && line[i + 1] !== '=';

/**
 * Convert the postfix `でない` to Ruby's `!`. `でない` negates the whole
 * condition just before it, up to the nearest `かつ` / `または`, comma,
 * assignment or open bracket — 論理演算は比較演算より弱く、`でない` は
 * `かつ` / `または` より強い. So `a > 10 でない` is `!(a > 10)` (not
 * `a > !10`), `x でない かつ y` is `!x && y`, and `(a かつ b) でない` is
 * `!(a && b)`. (Issue #1662)
 * @param {string} line - A line (or condition) of DNCL code.
 * @returns {string} The line with every `でない` turned into `!`.
 */
const convertNegation = (line) => {
    if (!line.includes(NEGATION)) return line;
    let out = '';
    // Where the operand of a `でない` would start, one entry per open bracket.
    const starts = [0];
    const markStart = () => {
        starts[starts.length - 1] = out.length;
    };
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
        if (ch === '(' || ch === '[') {
            out += ch;
            i++;
            starts.push(out.length);
            continue;
        }
        if (ch === ')' || ch === ']') {
            if (starts.length > 1) starts.pop();
            out += ch;
            i++;
            continue;
        }
        if (isWordAt(line, i, NEGATION)) {
            const start = starts[starts.length - 1];
            const segment = out.substring(start);
            const operand = segment.trim();
            if (operand !== '') {
                const lead = segment.match(/^\s*/)[0];
                const negated = isSingleOperand(operand) ? `!${operand}` : `!(${operand})`;
                out = `${out.substring(0, start)}${lead}${negated}`;
                i += NEGATION.length;
                continue;
            }
        }
        const word = wordAt(line, i, LOGICAL_WORDS);
        if (word) {
            out += word;
            i += word.length;
            markStart();
            continue;
        }
        out += ch;
        i++;
        if (ch === ',' || ch === '←' || isAssignmentAt(line, i - 1)) {
            markStart();
        }
    }
    return out;
};

/**
 * Convert identifiers in a code segment, adding @ prefix for variables.
 * @param {string} segment - A code segment.
 * @returns {string} The segment with converted identifiers.
 */
const convertIdentifiers = (segment) => {
    let result = '';
    let i = 0;
    let afterDot = false;

    while (i < segment.length) {
        if (segment[i] === '.') {
            result += '.';
            afterDot = true;
            i++;
            continue;
        }

        if (isIdentStart(segment[i])) {
            let name = '';
            while (i < segment.length && isIdentChar(segment[i])) {
                name += segment[i];
                i++;
            }

            // After '.', don't add @ prefix (e.g., .to_i, .length)
            if (afterDot) {
                result += name;
                afterDot = false;
                continue;
            }

            // Check for array access: Name[...]
            if (/^[A-Z]/.test(name) && i < segment.length && segment[i] === '[') {
                addArrayName(name);
                result += mapVarName(name, true);
                continue;
            }

            result += convertIdentifier(name);
            afterDot = false;
            continue;
        }

        afterDot = false;
        result += segment[i];
        i++;
    }

    return result;
};

/**
 * Process a line, splitting it into string/non-string parts. Apply
 * conversions only to non-string parts.
 * @param {string} source - A single line of code.
 * @returns {string} The converted line.
 */
const processSegments = (source) => {
    // `でない` may need the whole condition, strings included, so it is
    // converted on the whole line before splitting it at strings.
    const line = convertNegation(source);
    let result = '';
    let i = 0;

    while (i < line.length) {
        if (line[i] === '#') {
            // Rest is a comment, pass through
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
        // Collect non-string segment
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
            segment = convertIdentifiers(segment);
            result += segment;
            i = segEnd;
        }
    }

    return result;
};

export {
    convertArrow,
    convertIdentifier,
    convertJapaneseStrings,
    convertNegation,
    convertOperators,
    processSegments,
};
