// === Smalruby: This file is Smalruby-specific (DNCL paren utilities) ===
import { isNameChar as isJaNameChar, NAME_HEAD_RE, NAME_TAIL_RE } from '@smalruby/ja-notation';

/**
 * Find the end of a string literal starting at position `start`.
 * Handles escape sequences (`\\X`) by skipping the escaped character.
 * Returns the position immediately after the closing quote, or the end of
 * the line if the string is unterminated.
 * @param {string} line - The source line.
 * @param {number} start - Starting position (at the opening quote).
 * @param {string} quote - The quote character (`"` or `'`).
 * @returns {number} The position after the closing quote.
 */
const skipString = (line, start, quote) => {
    let i = start + 1;
    while (i < line.length) {
        if (line[i] === '\\') {
            i += 2;
            continue;
        }
        if (line[i] === quote) {
            return i + 1;
        }
        i++;
    }
    return i;
};

/**
 * Find the matching close paren for an open paren at `openParenPos`.
 * Skips parens inside string literals (single or double quoted).
 * @param {string} text - The text to scan.
 * @param {number} openParenPos - Position of the open paren `(`.
 * @returns {number} Position of the matching close paren, or -1 if unmatched.
 */
const findMatchingClose = (text, openParenPos) => {
    let depth = 1;
    let i = openParenPos + 1;
    while (i < text.length) {
        const ch = text[i];
        if (ch === '"' || ch === "'") {
            i = skipString(text, i, ch);
            continue;
        }
        if (ch === '(') {
            depth++;
        } else if (ch === ')') {
            depth--;
            if (depth === 0) return i;
        }
        i++;
    }
    return -1;
};

/**
 * A name of the Japanese mode, as a pattern for `new RegExp(..., 'u')` (the
 * `u` flag is needed): the characters ja-notation reads as a name
 * (`NAME_HEAD_RE` / `NAME_TAIL_RE` of packages/ja-notation/src/lexer.js), so
 * every check of the editor agrees with the conversion on what a name is
 * (`佐々木` is one name; Issue #1714).
 */
const NAME_PATTERN = `${NAME_HEAD_RE.source}${NAME_TAIL_RE.source}*`;

/** One character of a name, as a pattern (with the `u` flag). */
const NAME_CHAR_PATTERN = NAME_TAIL_RE.source;

/**
 * Whether `ch` can be part of a DNCL name, as ja-notation reads names: a
 * letter of any script (kanji, kana, `々`), a digit or `_` (Issue #1711,
 * Issue #1714). Half of a character out of the BMP (`𠮷`, as `line[i]` gives
 * it) counts as one, so a check of the boundary of a word does not cut such a name.
 * @param {string} ch - The character.
 * @returns {boolean} True for a name character.
 */
const isNameChar = (ch) => typeof ch === 'string' && (isJaNameChar(ch) || /^[\uD800-\uDFFF]$/.test(ch));

/**
 * Whether `word` stands on its own at `line[i]`: no name character
 * (`isNameChar`) right before or after it, so it is not part of a name
 * (`bandwidth`, `フラグor`, `かつお`, `たかつき`), so the conversions agree
 * on what a name is (Issue #1697).
 * @param {string} line - The line.
 * @param {number} i - Index to test.
 * @param {string} word - The keyword.
 * @returns {boolean} True when `word` is a whole word at `i`.
 */
const isWholeWordAt = (line, i, word) =>
    line.startsWith(word, i) && !isNameChar(line[i - 1]) && !isNameChar(line[i + word.length]);

export { findMatchingClose, isNameChar, isWholeWordAt, NAME_CHAR_PATTERN, NAME_PATTERN, skipString };
