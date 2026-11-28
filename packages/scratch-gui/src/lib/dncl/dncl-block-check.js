// === Smalruby: This file is Smalruby-specific (check that the Japanese can become blocks) ===
//
// Japanese that ja-notation reads makes Ruby, but the Ruby may still have no
// blocks (`a, b = b, a`, `"a" + 1`, a change of an argument of a function).
// The Code tab finds it when it makes the blocks; the Japanese tab checks the
// same while the student writes and before it gives the program to the Ruby
// tab, so the error is told on the Japanese line and in Japanese words
// (Issue #2547).
import { jaCodeOfLine } from './dncl-source-map';
import { dnclToRuby } from './dncl-to-ruby';
import { codeOfLine, stringEndAt } from './dncl-trailing-comment';
import { isNameChar, isWholeWordAt, NAME_PATTERN } from './paren-utils';

/**
 * The id of the error for a string literal and a number literal joined with
 * `+` (`"残り" + 3`). The Ruby of it is an error (Ruby does not join a String
 * and an Integer), so it has no blocks; a variable (`"残り" + a`) becomes the
 * join block. The editor shows the error in the language of the UI by this id.
 */
const STRING_PLUS_NUMBER_ERROR_ID = 'stringPlusNumber';

const PLUS = new Set(['+', '＋']);
const NUMBER_RE = /^[0-9０-９]+(?:[.．][0-9０-９]+)?/;

/**
 * The index after the spaces from `i`.
 * @param {string} code - The code.
 * @param {number} i - The index.
 * @returns {number} The index of the next character that is not a space.
 */
const skipSpaces = (code, i) => {
    let j = i;
    while (j < code.length && /\s/.test(code[j])) j++;
    return j;
};

/**
 * The first string literal and number literal a Japanese line joins with `+`
 * (`"a" + 1`, `1 + "a"`, `「残り」 ＋ 3`). A number in a name (`a1`) is not taken.
 * @param {string} line - A line of the Japanese.
 * @returns {?{string: string, number: string, numberFirst: boolean}} The string (with its
 *   quotes) and the number as written, and whether the number comes first; null when the line
 *   has no such `+`.
 */
const findStringPlusNumber = (line) => {
    const code = codeOfLine(line);
    let i = 0;
    // The number just before (only spaces and a `+` after it), or null.
    let lastNumber = null;
    while (i < code.length) {
        const end = stringEndAt(code, i);
        if (end !== -1) {
            const string = code.substring(i, end);
            // A number, then `+`, then this string.
            if (lastNumber) {
                const plus = skipSpaces(code, lastNumber.end);
                if (PLUS.has(code[plus]) && skipSpaces(code, plus + 1) === i) {
                    return { string, number: lastNumber.text, numberFirst: true };
                }
            }
            // This string, then `+`, then a number.
            const plus = skipSpaces(code, end);
            if (PLUS.has(code[plus])) {
                const start = skipSpaces(code, plus + 1);
                const number = code.substring(start).match(NUMBER_RE);
                if (number && !isNameChar(code[start + number[0].length] || '')) {
                    return { string, number: number[0], numberFirst: false };
                }
            }
            lastNumber = null;
            i = end;
            continue;
        }
        const number = !isNameChar(code[i - 1] || '') && code.substring(i).match(NUMBER_RE);
        if (number && !isNameChar(code[i + number[0].length] || '')) {
            lastNumber = { text: number[0], end: i + number[0].length };
            i = lastNumber.end;
            continue;
        }
        if (!/\s/.test(code[i]) && !PLUS.has(code[i])) lastNumber = null;
        i++;
    }
    return null;
};

/**
 * Whether a Japanese line joins a string literal and a number literal with `+`.
 * @param {string} line - A line of the Japanese.
 * @returns {boolean} True when the line has such a `+`.
 */
const joinsStringAndNumber = (line) => findStringPlusNumber(line) !== null;

/**
 * How to write the `+` of a string and a number of a line, in the words of the line
 * (`"a" + 1` → `"a" + 文字列(1)` and `"a1"`), so the example of the error is the
 * expression the student wrote (B21 of #1731).
 * @param {string} line - A line of the Japanese.
 * @returns {?{number: string, fixed: string, inline: string}} The number, the expression with
 *   the number made a string, and the string with the number in it; null when there is no such `+`.
 */
const stringPlusNumberExample = (line) => {
    const found = findStringPlusNumber(line);
    if (!found) return null;
    const { string, number, numberFirst } = found;
    const open = string[0];
    const close = string[string.length - 1];
    const inner = string.substring(1, string.length - 1);
    return numberFirst
        ? { number, fixed: `文字列(${number}) + ${string}`, inline: `${open}${number}${inner}${close}` }
        : { number, fixed: `${string} + 文字列(${number})`, inline: `${open}${inner}${number}${close}` };
};

/**
 * The id of the error for several variables assigned at once (`a, b = b, a`). ja-notation
 * reads it, but the converter has no block for it and would tell it in the words of the
 * blocks; the Japanese tab tells to assign one by one instead (B21 of #1731).
 */
const MULTIPLE_ASSIGNMENT_ERROR_ID = 'multipleAssignment';

// A variable or an element of an array (`a`, `A[i + 1]`).
const TARGET_PATTERN = `${NAME_PATTERN}(?:\\[[^\\]]*\\])?`;
const MULTIPLE_ASSIGNMENT_RE = new RegExp(
    `^(${TARGET_PATTERN}(?:\\s*,\\s*${TARGET_PATTERN})+)\\s*(←|=(?!=))\\s*(.+)$`,
    'u',
);

/**
 * The expressions separated by the commas of an expression that are not in brackets or strings.
 * @param {string} code - The expression.
 * @returns {Array<string>} The trimmed expressions.
 */
const splitTopLevelCommas = (code) => {
    const parts = [];
    let depth = 0;
    let start = 0;
    let i = 0;
    while (i < code.length) {
        const end = stringEndAt(code, i);
        if (end !== -1) {
            i = end;
            continue;
        }
        const ch = code[i];
        if (ch === '(' || ch === '[') depth++;
        else if (ch === ')' || ch === ']') depth--;
        else if ((ch === ',' || ch === '，') && depth === 0) {
            parts.push(code.substring(start, i).trim());
            start = i + 1;
        }
        i++;
    }
    parts.push(code.substring(start).trim());
    return parts;
};

const NAME_AT_START_RE = new RegExp(`^${NAME_PATTERN}`, 'u');

/**
 * Whether an expression uses a name (as a whole word, not in a string).
 * @param {string} code - The expression.
 * @param {string} name - The name.
 * @returns {boolean} True when the expression uses the name.
 */
const usesName = (code, name) => {
    let i = 0;
    while (i < code.length) {
        const end = stringEndAt(code, i);
        if (end !== -1) {
            i = end;
            continue;
        }
        if (isWholeWordAt(code, i, name)) return true;
        i++;
    }
    return false;
};

/**
 * Whether assigning the values one by one does the same as assigning them at once: no value
 * (and no index of a variable) uses a variable assigned before it (`a, b = b, a + b` does not).
 * @param {Array<string>} names - The variables or elements of arrays.
 * @param {Array<string>} values - The values, one for each.
 * @returns {boolean} True when they can be assigned one by one in the same order.
 */
const assignsSameOneByOne = (names, values) => {
    const bases = names.map((name) => name.match(NAME_AT_START_RE)[0]);
    return names.every((name, i) => {
        const before = bases.slice(0, i);
        const index = name.substring(bases[i].length);
        return before.every((base) => !usesName(values[i], base) && !usesName(index, base));
    });
};

/**
 * How to write the assignment of several variables at once of a line one by one
 * (`a, b = 1, 2` → `a = 1、b = 2`; the swap `a, b = b, a` → `t = a、a = b、b = t`, also of the
 * elements of an array). The variable of the swap is one the program does not use, so
 * following the example does not change another variable.
 * @param {string} line - A line of the Japanese.
 * @param {string} [program] - The whole Japanese, where the variable of the swap is looked for.
 * @returns {?{example: ?string}} The example (null when the values do not match the
 *   variables one to one, or when assigning them one by one in the same order would use a
 *   variable already changed, like `a, b = b, a + b`, or when the program uses every variable
 *   the swap could take), or null when the line does not assign several variables at once.
 */
const multipleAssignmentExample = (line, program = line) => {
    const match = jaCodeOfLine(line).match(MULTIPLE_ASSIGNMENT_RE);
    if (!match) return null;
    const names = splitTopLevelCommas(match[1]);
    const op = match[2];
    const values = splitTopLevelCommas(match[3]);
    if (names.length === 2 && values.length === 2 && values[0] === names[1] && values[1] === names[0]) {
        const [a, b] = names;
        const temp = ['t', 'tmp', '一時'].find((name) => !names.includes(name) && !usesName(program, name));
        if (!temp) return { example: null };
        return { example: `${temp} ${op} ${a}、${a} ${op} ${b}、${b} ${op} ${temp}` };
    }
    if (values.length !== names.length || !assignsSameOneByOne(names, values)) return { example: null };
    return { example: names.map((name, i) => `${name} ${op} ${values[i]}`).join('、') };
};

/**
 * Give the id `stringPlusNumber` to the errors on a line that joins a string
 * literal and a number literal with `+`, and the `example` of how to write it
 * (`stringPlusNumberExample`), so the editor says how to write it.
 * Both the check while writing and the conversion of the Code tab use it, so
 * they say the same words.
 * @param {Array<object>} errors - Errors with `row` from 0 on the Japanese lines.
 * @param {Array<string>} lines - The lines of the Japanese.
 * @returns {Array<object>} The errors, with the id on such lines.
 */
const withStringPlusNumberIds = (errors, lines) =>
    errors.map((err) => {
        const example = stringPlusNumberExample(lines[err.row] || '');
        return example ? { ...err, id: STRING_PLUS_NUMBER_ERROR_ID, example } : err;
    });

/**
 * Give the errors of a line the id of the words the Japanese tab tells them in: a `+` of a
 * string and a number literal (`stringPlusNumber`) and several variables assigned at once
 * (`multipleAssignment`), with the `example` of how to write it. The other errors keep the
 * words of the converter.
 * @param {Array<object>} errors - Errors with `row` from 0 on the Japanese lines.
 * @param {Array<string>} lines - The lines of the Japanese.
 * @returns {Array<object>} The errors, with the ids on such lines.
 */
const withJapaneseErrorIds = (errors, lines) =>
    withStringPlusNumberIds(errors, lines).map((err) => {
        if (err.id) return err;
        const found = multipleAssignmentExample(lines[err.row] || '', lines.join('\n'));
        return found ? { ...err, id: MULTIPLE_ASSIGNMENT_ERROR_ID, example: found.example } : err;
    });

/**
 * The errors of the blocks of the Japanese, on its lines.
 *
 * The Japanese is made into Ruby and the Ruby is converted by `convert` (a dry
 * run: the blocks are not applied). The errors of the converter are moved to
 * the Japanese lines and quote the Japanese (`DnclSourceMap#rubyErrorsToDncl`).
 * The errors the Japanese tab tells in its own words get their ids
 * (`withJapaneseErrorIds`), so the editor says how to write them.
 * @param {string} dncl - The Japanese.
 * @param {function(string): Promise<{result: boolean, errors: Array<object>}>} convert -
 *   Convert the Ruby to blocks without applying them.
 * @returns {Promise<?Array<object>>} The errors (`row` / `column` from 0 on the Japanese
 *   lines, `text`, and `id` for the ones the editor translates), `[]` when the Japanese
 *   becomes blocks, or null when it makes no Ruby (its errors are told by `dnclToRuby`).
 */
const japaneseBlockErrors = async (dncl, convert) => {
    const { ruby, sourceMap } = dnclToRuby(dncl);
    if (ruby === null) return null;
    const { result, errors } = await convert(ruby);
    if (result) return [];
    return withJapaneseErrorIds(sourceMap.rubyErrorsToDncl(errors), dncl.split('\n'));
};

export {
    japaneseBlockErrors,
    joinsStringAndNumber,
    MULTIPLE_ASSIGNMENT_ERROR_ID,
    multipleAssignmentExample,
    STRING_PLUS_NUMBER_ERROR_ID,
    stringPlusNumberExample,
    withJapaneseErrorIds,
    withStringPlusNumberIds,
};
