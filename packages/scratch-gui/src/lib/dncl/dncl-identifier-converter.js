// === Smalruby: This file is Smalruby-specific (DNCL→Ruby identifier conversion) ===
import { DNCL_KEYWORDS, RUBY_LITERALS } from './dncl-keywords';
import { addArrayName, isArrayName, isFunctionName, isFunctionParam, mapVarName } from './dncl-state';
import { stringEndAt } from './dncl-trailing-comment';
import { isLogicalWordAt, isSingleOperand, skipString, wrapIntegerDivisions } from './paren-utils';

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
 * A number from its first digit: the digits, a decimal part, and the letters,
 * `_` and exponent sign Ruby reads as a part of it (`0x5`, `1_000`, `1.5e-3`).
 */
const NUMBER_RE = /^\d+(?:\.\d+)?(?:[a-zA-Z0-9_]|(?<=[eE])[+-](?=\d)|\.(?=\d))*/;

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

/** DNCL `かつ` / `または` and the Ruby operators they become. */
const LOGICAL_OPERATORS = [
    ['かつ', '&&'],
    ['または', '||'],
];

/**
 * The `[word, operator]` pair of the `かつ` / `または` operator at `line[i]`.
 * @param {string} line - The line.
 * @param {number} i - Index to test.
 * @returns {Array<string>|undefined} The pair, or undefined when none is there.
 */
const logicalOperatorAt = (line, i) => LOGICAL_OPERATORS.find(([word]) => isLogicalWordAt(line, i, word));

/**
 * Turn `かつ` / `または` into `&&` / `||`. Whether a word is the operator is
 * decided by whether it is part of a name (`isLogicalWordAt`), not by the
 * spaces around it, so `(a > 0)かつ(b > 0)` is `(a > 0) && (b > 0)` while
 * `かつお` and `たかつき` stay names (Issue #1697). A space is put on a side
 * that has none, so the Ruby reads as usual.
 * Strings and the trailing comment are left as they are.
 * @param {string} line - A line (or condition) of DNCL code.
 * @returns {string} The line with `&&` / `||`.
 */
const convertLogicalWords = (line) => {
    let result = '';
    let i = 0;
    while (i < line.length) {
        // Strings and the comment are kept as written.
        const end = stringEndAt(line, i);
        if (end !== -1) {
            result += line.substring(i, end);
            i = end;
            continue;
        }
        if (line[i] === '#') return result + line.substring(i);
        const found = logicalOperatorAt(line, i);
        if (!found) {
            result += line[i];
            i++;
            continue;
        }
        const [word, op] = found;
        const next = line[i + word.length];
        const spaceBefore = result !== '' && !/\s$/.test(result) ? ' ' : '';
        const spaceAfter = i + word.length < line.length && !/\s/.test(next) ? ' ' : '';
        result += `${spaceBefore}${op}${spaceAfter}`;
        i += word.length;
    }
    return result;
};

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
    // Smalruby's `//` is the integer quotient too: it is read as `÷`, so it
    // has the same operands and precedence (`(a + b) // 2` is
    // `((a + b) / 2).to_i`, `a * 3 // 2` is `(a * 3 / 2).to_i`).
    // Japanese names are operands as well (`合計 // 個数`, Issue #1711).
    result = result.replace(/\s*\/\/\s*/g, ' ÷ ');
    result = result.replace(/≦/g, '<=');
    result = result.replace(/≧/g, '>=');

    // `!` / `(` before them come from `でない` (`真 でない` → `!真`).
    result = result.replace(/(?<=[\s!(]|^)真(?=[\s),]|$)/g, 'true');
    result = result.replace(/(?<=[\s!(]|^)偽(?=[\s),]|$)/g, 'false');

    // The Ruby-side blocks converter maps `.to_i` to the floor mathop block
    // for actual runtime truncation.
    result = wrapIntegerDivisions(result);
    // A `÷` whose operands could not be read (nothing before or after it, as
    // in `a = ÷ 2`) is left as Ruby `/`, so the Ruby error points at it.
    result = result.replace(/÷/g, '/');

    return result;
};

/** Words that end the operand of a `でない` (it binds tighter than they do). */
const LOGICAL_WORDS = ['かつ', 'または', '&&', '||'];

/** The postfix logical NOT of DNCL. */
const NEGATION = 'でない';

/**
 * Whether `word` starts at `i` as a whole word. `&&` / `||` always are;
 * a DNCL word (`かつ` / `または` / `でない`) is when it is not part of a name
 * (`isLogicalWordAt`), so `(a > 0)でない` negates `(a > 0)` while
 * `できでない` stays a name (Issue #1697).
 * @param {string} line - The source line.
 * @param {number} i - The position to check.
 * @param {string} word - The word.
 * @returns {boolean} True if the word is there as a whole word.
 */
const isWordAt = (line, i, word) => (/^[&|]/.test(word) ? line.startsWith(word, i) : isLogicalWordAt(line, i, word));

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
        const end = stringEndAt(line, i);
        if (end !== -1) {
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

        // A number is copied as it is, letters and all (`0x5`, `1_000`,
        // `1e3`), so no `@` gets inside it (issue #1745). The validator tells
        // such numbers as errors; this keeps the number whole in any case.
        // A digit here starts a number: the digits of a name are read with it.
        if (/\d/.test(segment[i])) {
            const number = segment.substring(i).match(NUMBER_RE)[0];
            result += number;
            i += number.length;
            afterDot = false;
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
    // `かつ` / `または` are converted on the whole line too, so a space can be
    // put between them and a string next to them (`「はい」かつ b`).
    const line = convertLogicalWords(convertNegation(source));
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
