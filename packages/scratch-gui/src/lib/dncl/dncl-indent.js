// === Smalruby: This file is Smalruby-specific (how the Japanese mode measures an indent) ===

/**
 * The one rule for measuring the indent of a DNCL line, shared by the reader
 * (`dncl-v2-preprocessor.js`) and the problem form (`dncl-problem-form.js`),
 * so that the blocks the reader finds and the rules the editor draws agree.
 * A tab counts as 4 columns and the full-width space (U+3000) as 2, so mixed
 * indentation still compares sensibly.
 */

/** The leading whitespace of a line. */
const LEADING_INDENT_RE = /^[ \t\u3000]*/;

/**
 * The columns one indent character takes.
 * @param {string} ch - A character of the indent.
 * @returns {number} The width.
 */
const charWidth = (ch) => {
    if (ch === '\t') return 4;
    if (ch === '\u3000') return 2;
    return 1;
};

/**
 * Visual width of a leading indent.
 * @param {string} indent - Leading whitespace.
 * @returns {number} The indent width in columns.
 */
const indentWidth = (indent) => {
    let width = 0;
    for (const ch of indent) width += charWidth(ch);
    return width;
};

/**
 * The 0-based offset in a line of the indent character that starts at the
 * given width, or null when the indent of the line does not reach it.
 * @param {string} line - The line.
 * @param {number} column - The indent width to find.
 * @returns {?number} The offset.
 */
const indentOffset = (line, column) => {
    const indent = line.match(LEADING_INDENT_RE)[0];
    let width = 0;
    for (let i = 0; i < indent.length; i++) {
        if (width >= column) return i;
        width += charWidth(indent[i]);
    }
    return null;
};

export { LEADING_INDENT_RE, indentOffset, indentWidth };
