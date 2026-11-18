// SPDX-License-Identifier: MIT
// ja-notation: the settings of a program (what the problem text promises:
// where the array indexes start, the comment mark, ...). See ./LICENSE and
// docs/dncl/design.md (4 章).
//
// The settings are read from the sentences at the top of the program (its
// first comment lines, before any code), so they are kept with the program
// itself: a Ruby comment stays with the blocks. Only the sentences below are
// read as settings; any other comment is a plain comment.
//
// What a setting changes is done on the syntax tree, not on the text: the
// index of an array with indexes from 1 is shifted when the Ruby is built
// (`A[i]` → `@A[i - 1]`) and shifted back when the Ruby is read, wherever the
// index is in an expression.

/** The settings of a program with no sentence about them (the form of 例示). */
const DEFAULT_SETTINGS = Object.freeze({ indexBase: 0, commentMarker: '#', logicNote: false });

/** The comment marks the settings can choose. */
const COMMENT_MARKERS = ['#', '//'];

/** `すべての配列の添字は 1 から始まる。` (the indexes of every array start at 1). */
const INDEX_BASE_RE = /^(?:すべての)?配列の添え?字は\s*([01])\s*から始まる。?$/;

/** `「//」から行の終わりまでは，処理の対象とならない。` (the comment mark). */
const COMMENT_MARKER_RE = /^「(#|\/\/)」から行の終わりまでは[，,、]\s*処理の対象とならない。?$/;

/** The sentences that explain the logical operators, as the problem texts write them. */
const LOGIC_NOTES = [
    '「and」は「かつ」を意味する論理演算子であり，左右の式がともに真のときにだけ真となる。',
    '「or」は「または」を意味する論理演算子であり，左右の式の少なくとも一方が真のときに真となる。',
    '「not」は「でない」を意味する論理演算子であり，右の式が偽のときにだけ真となる。',
];

/** A sentence that explains a logical operator (`「and」は「かつ」を意味する論理演算子であり，...`). */
const LOGIC_NOTE_RE = /^「(?:and|or|not)」は「[^」]+」を意味する論理演算子であり/;

/**
 * The text of a comment without its mark and the spaces around it, with
 * full-width digits read as digits.
 * @param {string} comment - The comment (`# ...` or `// ...`).
 * @returns {string} The sentence.
 */
const sentenceOf = (comment) =>
    comment
        .replace(/^\s*(?:#|\/\/)/, '')
        .trim()
        .replace(/[０-９]/g, (d) => String.fromCharCode(d.charCodeAt(0) - 0xfee0));

/**
 * The settings the sentences of the comments at the top of a program say.
 * @param {Array<string>} comments - The comment lines at the top (with their marks).
 * @returns {object} `{indexBase, commentMarker, logicNote}`, the default for what they do not say.
 */
const readSettings = (comments) => {
    const settings = { ...DEFAULT_SETTINGS };
    comments.forEach((comment) => {
        const sentence = sentenceOf(comment);
        const index = sentence.match(INDEX_BASE_RE);
        if (index) settings.indexBase = Number(index[1]);
        const marker = sentence.match(COMMENT_MARKER_RE);
        if (marker) settings.commentMarker = marker[1];
        if (LOGIC_NOTE_RE.test(sentence)) settings.logicNote = true;
    });
    return settings;
};

/**
 * The settings of a program, the default for what it does not have.
 * @param {object} program - The JaAST.
 * @returns {object} `{indexBase, commentMarker, logicNote}`.
 */
const settingsOf = (program) => ({ ...DEFAULT_SETTINGS, ...((program && program.settings) || {}) });

/**
 * The comment lines (with `#`) that say the settings, in the words of the
 * problem texts, for a program to start with. The default settings say nothing.
 * @param {object} settings - The settings.
 * @returns {Array<string>} The lines.
 */
const settingsSentences = (settings) => {
    const s = { ...DEFAULT_SETTINGS, ...settings };
    const lines = [];
    if (s.indexBase !== DEFAULT_SETTINGS.indexBase) lines.push(`# すべての配列の添字は ${s.indexBase} から始まる。`);
    if (s.commentMarker !== DEFAULT_SETTINGS.commentMarker) {
        lines.push(`# 「${s.commentMarker}」から行の終わりまでは，処理の対象とならない。`);
    }
    if (s.logicNote) LOGIC_NOTES.forEach((note) => lines.push(`# ${note}`));
    return lines;
};

/**
 * Whether an expression is an integer written as a number (`3`, `-1`), and its value.
 * @param {object} e - The JaAST expression.
 * @returns {?number} The integer, or null.
 */
const integerOf = (e) => {
    if (e.type === 'Number' && /^\d+$/.test(e.value)) return Number(e.value);
    if (e.type === 'Unary' && e.operator === '-' && e.operand.type === 'Number' && /^\d+$/.test(e.operand.value)) {
        return -Number(e.operand.value);
    }
    return null;
};

/**
 * An integer as a JaAST expression (a negative one is a minus sign before the number).
 * @param {number} n - The integer.
 * @param {object} at - The node whose place it takes (`line`, `column`).
 * @returns {object} The expression.
 */
const integer = (n, at) => {
    const where = { line: at.line, column: at.column };
    const number = { type: 'Number', value: String(Math.abs(n)), ...where };
    return n < 0 ? { type: 'Unary', operator: '-', operand: number, ...where } : number;
};

/**
 * Whether an expression is `x <op> 1`, and `x` when it is.
 * @param {object} e - The JaAST expression.
 * @param {string} operator - `+` or `-`.
 * @returns {?object} The left side, or null.
 */
const leftOfOne = (e, operator) =>
    e.type === 'Binary' && e.operator === operator && integerOf(e.right) === 1 && e.right.type === 'Number'
        ? e.left
        : null;

// The two shifts are each other's inverse, so a program goes Japanese → Ruby
// → Japanese (and Ruby → Japanese → Ruby) and comes back the same:
//   to Ruby:    an integer n → n - 1;  x + 1 → x  (when `x` would come back as `x + 1`);  x → x - 1
//   to Japanese: an integer n → n + 1;  x - 1 → x  (when `x` would come back as `x - 1`);  x → x + 1
// `dropsToRuby(e)` / `dropsToJa(e)` say when the middle rule is taken.

/**
 * Whether the index shift to Ruby takes `e` (`x + 1`) to `x`.
 * @param {object} e - The JaAST expression.
 * @returns {boolean} True if it does.
 */
const dropsToRuby = (e) => {
    const x = leftOfOne(e, '+');
    return x !== null && integerOf(x) === null && !dropsToJa(x);
};

/**
 * Whether the index shift to the Japanese takes `e` (`x - 1`) to `x`.
 * @param {object} e - The JaAST expression.
 * @returns {boolean} True if it does.
 */
const dropsToJa = (e) => {
    const x = leftOfOne(e, '-');
    return x !== null && integerOf(x) === null && !dropsToRuby(x);
};

/**
 * Whether an index is a key that is not counted (a string: `X["a"]`), so it is not shifted.
 * @param {object} e - The JaAST expression.
 * @returns {boolean} True if it is.
 */
const isKey = (e) => e.type === 'String';

/**
 * Shift an index by `by` (-1: the Japanese of an array from 1 to the Ruby, +1: back).
 * @param {object} e - The JaAST index.
 * @param {number} by - -1 or +1.
 * @returns {object} The shifted index.
 */
const shiftIndex = (e, by) => {
    if (isKey(e)) return e;
    const n = integerOf(e);
    if (n !== null) return integer(n + by, e);
    if (by < 0 ? dropsToRuby(e) : dropsToJa(e)) return e.left;
    return {
        type: 'Binary',
        operator: by < 0 ? '-' : '+',
        left: e,
        right: { type: 'Number', value: '1', line: e.line, column: e.column },
        line: e.line,
        column: e.column,
    };
};

/**
 * The index of the Ruby for an index of the Japanese, by the settings.
 * @param {object} index - The JaAST index of the Japanese.
 * @param {object} settings - The settings.
 * @returns {object} The JaAST index of the Ruby (the arrays of Ruby start at 0).
 */
const indexToRuby = (index, settings) => (settings.indexBase === 1 ? shiftIndex(index, -1) : index);

/**
 * The index of the Japanese for an index of the Ruby, by the settings.
 * @param {object} index - The JaAST index read from the Ruby.
 * @param {object} settings - The settings.
 * @returns {object} The JaAST index of the Japanese.
 */
const indexToJa = (index, settings) => (settings.indexBase === 1 ? shiftIndex(index, 1) : index);

/**
 * A comment (kept in the JaAST with `#`) written with the comment mark of the settings.
 * @param {string} comment - The comment.
 * @param {object} settings - The settings.
 * @returns {string} The comment as written.
 */
const writeComment = (comment, settings) => (settings.commentMarker === '//' ? comment.replace(/^#/, '//') : comment);

export {
    COMMENT_MARKERS,
    DEFAULT_SETTINGS,
    indexToJa,
    indexToRuby,
    LOGIC_NOTES,
    readSettings,
    settingsOf,
    settingsSentences,
    writeComment,
};
