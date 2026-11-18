// === Smalruby: This file is Smalruby-specific (DNCL paren utilities) ===

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
 * Whether `ch` can be part of a DNCL name: a letter of any script (so kanji
 * and kana too), a digit or `_`. (Issue #1711)
 * @param {string} ch - The character.
 * @returns {boolean} True for a name character.
 */
const isNameChar = (ch) => typeof ch === 'string' && /[\p{L}\p{N}_]/u.test(ch);

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

export { findMatchingClose, isNameChar, isWholeWordAt, skipString };
