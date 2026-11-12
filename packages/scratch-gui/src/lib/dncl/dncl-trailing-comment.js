// === Smalruby: This file is Smalruby-specific (trailing # comment of DNCL / Ruby lines) ===
import { skipString } from './paren-utils';

/**
 * The end (the index after the closing quote) of the string literal that
 * starts at `line[i]`: `"..."` / `'...'`, or the DNCL 「...」. -1 when no
 * string starts there; an unclosed 「 is not a string. Every scanner that
 * skips the strings of a DNCL line uses this, so they agree on what a
 * string is (Issue #1709).
 * @param {string} line - A DNCL or Ruby line.
 * @param {number} i - The index to look at.
 * @returns {number} The end of the string, or -1.
 */
const stringEndAt = (line, i) => {
    const ch = line[i];
    if (ch === '"' || ch === "'") return skipString(line, i, ch);
    if (ch === '「') {
        const close = line.indexOf('」', i + 1);
        if (close !== -1) return close + 1;
    }
    return -1;
};

/**
 * Index of the `#` that starts the comment of a line, or -1 when there is
 * none. A `#` inside a string literal (`"..."` / `'...'`, or the DNCL
 * 「...」) is text, not a comment. An unclosed 「 is not a string.
 * @param {string} line - A DNCL or Ruby line.
 * @returns {number} Index of the comment `#`, or -1.
 */
const commentIndex = (line) => {
    let i = 0;
    while (i < line.length) {
        const end = stringEndAt(line, i);
        if (end !== -1) {
            i = end;
            continue;
        }
        if (line[i] === '#') return i;
        i++;
    }
    return -1;
};

/**
 * Split the `# comment` at the end of a code line from the code, so the
 * line can be matched as a block opener / closer (`もし ... ならば`,
 * `を実行する`, `if ...`, `end`) and the comment put back at the end of the
 * converted line (Issue #1696).
 *
 * `comment` keeps the whitespace before the `#`, so `code + comment` is the
 * line again. A line that is only a comment is all code (`comment` is ''):
 * the converters already keep such lines as they are.
 * @param {string} line - A DNCL or Ruby line.
 * @returns {{code: string, comment: string}} The code and the comment.
 */
const splitTrailingComment = (line) => {
    const idx = commentIndex(line);
    if (idx === -1 || line.substring(0, idx).trim() === '') return { code: line, comment: '' };
    const code = line.substring(0, idx).replace(/\s+$/, '');
    return { code, comment: line.substring(code.length) };
};

/**
 * The code of a line without its `# comment` (a `#` in a string is not a
 * comment). Unlike {@link splitTrailingComment}, a line that is only a
 * comment has no code (''), so a keyword in it is not matched.
 * @param {string} line - A DNCL or Ruby line.
 * @returns {string} The code before the comment, with no trailing space.
 */
const codeOfLine = (line) => {
    const idx = commentIndex(line);
    return (idx === -1 ? line : line.substring(0, idx)).replace(/\s+$/, '');
};

export { codeOfLine, commentIndex, splitTrailingComment, stringEndAt };
