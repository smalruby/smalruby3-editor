// === Smalruby: This file is Smalruby-specific (check that the Japanese can become blocks) ===
//
// Japanese that ja-notation reads makes Ruby, but the Ruby may still have no
// blocks (`a, b = b, a`, `"a" + 1`, a change of an argument of a function).
// The Code tab finds it when it makes the blocks; the Japanese tab checks the
// same while the student writes and before it gives the program to the Ruby
// tab, so the error is told on the Japanese line and in Japanese words
// (Issue #2547).
import { dnclToRuby } from './dncl-to-ruby';
import { codeOfLine, stringEndAt } from './dncl-trailing-comment';
import { isNameChar } from './paren-utils';

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
 * Whether a Japanese line joins a string literal and a number literal with `+`
 * (`"a" + 1`, `1 + "a"`, `「残り」 ＋ 3`). A number in a name (`a1`) is not taken.
 * @param {string} line - A line of the Japanese.
 * @returns {boolean} True when the line has such a `+`.
 */
const joinsStringAndNumber = (line) => {
    const code = codeOfLine(line);
    let i = 0;
    // The end of the number just before (only spaces and a `+` after it), or -1.
    let lastNumberEnd = -1;
    while (i < code.length) {
        const end = stringEndAt(code, i);
        if (end !== -1) {
            // A number, then `+`, then this string.
            if (lastNumberEnd !== -1) {
                const plus = skipSpaces(code, lastNumberEnd);
                if (PLUS.has(code[plus]) && skipSpaces(code, plus + 1) === i) return true;
            }
            // This string, then `+`, then a number.
            const plus = skipSpaces(code, end);
            if (PLUS.has(code[plus])) {
                const start = skipSpaces(code, plus + 1);
                const number = code.substring(start).match(NUMBER_RE);
                if (number && !isNameChar(code[start + number[0].length] || '')) return true;
            }
            lastNumberEnd = -1;
            i = end;
            continue;
        }
        const number = !isNameChar(code[i - 1] || '') && code.substring(i).match(NUMBER_RE);
        if (number && !isNameChar(code[i + number[0].length] || '')) {
            lastNumberEnd = i + number[0].length;
            i = lastNumberEnd;
            continue;
        }
        if (!/\s/.test(code[i]) && !PLUS.has(code[i])) lastNumberEnd = -1;
        i++;
    }
    return false;
};

/**
 * The errors of the blocks of the Japanese, on its lines.
 *
 * The Japanese is made into Ruby and the Ruby is converted by `convert` (a dry
 * run: the blocks are not applied). The errors of the converter are moved to
 * the Japanese lines and quote the Japanese (`DnclSourceMap#rubyErrorsToDncl`).
 * A `+` of a string and a number literal gets the id `stringPlusNumber`, so
 * the editor says how to write it.
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
    const lines = dncl.split('\n');
    return sourceMap
        .rubyErrorsToDncl(errors)
        .map((err) =>
            joinsStringAndNumber(lines[err.row] || '') ? { ...err, id: STRING_PLUS_NUMBER_ERROR_ID } : err,
        );
};

export { japaneseBlockErrors, joinsStringAndNumber, STRING_PLUS_NUMBER_ERROR_ID };
