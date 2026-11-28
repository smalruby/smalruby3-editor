// === Smalruby: This file is Smalruby-specific (the Japanese mode takes an else or a closing line back to its block) ===
import { LEADING_INDENT_RE, indentWidth } from '../../lib/dncl/dncl-indent';
import { dnclLanguageConfiguration } from './dncl-mode';

/**
 * Typing `そうでなければ` / `そうでなくもし` / `を実行する` / `を繰り返す` /
 * `と定義する` in the body of a block takes the line back to the depth of the
 * block, like the else of other editors (Issue #2554). Monaco does it only for
 * a word typed key by key (its `decreaseIndentPattern`), and a Japanese word
 * comes in at once from the IME, so the Japanese mode does it here.
 */

const { increaseIndentPattern } = dnclLanguageConfiguration.indentationRules;

/** The word at the start of a line that goes back to the depth of its block. */
const OUTDENT_WORD_RE = /^([ \t\u3000]*)(そうでなければ|そうでなくもし|を実行する|を繰り返す|と定義する)/;

/** An else (`そうでなければ` / `そうでなくもし`) goes to the depth of an if or another else-if. */
const IF_RE = /^[ \t\u3000]*(?:もし|そうでなくもし)[ \t\u3000]/;

/**
 * Whether a line neither opens nor closes a block (the reader skips it too).
 * A comment starts with `#`, `\uff03` or `//` (the comment mark of the settings).
 * @param {string} line - The line.
 * @returns {boolean} Whether it is blank or a comment.
 */
const isSkipped = (line) => /^[ \t\u3000]*(?:(?:#|\uff03|\/\/).*)?$/.test(line);

/**
 * The word at the start of a line that goes back to the depth of its block.
 * @param {string} line - The line.
 * @returns {?{end: number, isElse: boolean}} The 0-based offset of the end of
 *   the word and whether it is an else, or null.
 */
const outdentWord = (line) => {
    const match = line.match(OUTDENT_WORD_RE);
    if (!match) return null;
    return { end: match[0].length, isElse: match[2].startsWith('そうで') };
};

/**
 * The indent for a line that starts with an else or a closing word: the
 * indent of the nearest line above that opens a block still open there (an
 * if or else-if for an else, any opener for a closing word), so the line
 * closes the innermost block. A block is still open when every line between
 * is deeper than it.
 * @param {string[]} lines - The lines of the program.
 * @param {number} index - The 0-based index of the line.
 * @returns {?string} The new indent, or null to leave the line as it is.
 */
const outdentIndent = (lines, index) => {
    const line = lines[index];
    const word = outdentWord(line);
    if (!word) return null;
    const indent = line.match(LEADING_INDENT_RE)[0];
    const width = indentWidth(indent);
    let innerWidth = Infinity;
    for (let i = index - 1; i >= 0 && innerWidth > 0; i--) {
        if (isSkipped(lines[i])) continue;
        const openerIndent = lines[i].match(LEADING_INDENT_RE)[0];
        const openerWidth = indentWidth(openerIndent);
        if (openerWidth <= width && openerWidth < innerWidth) {
            const opens = word.isElse ? IF_RE.test(lines[i]) : increaseIndentPattern.test(lines[i]);
            if (opens) return openerIndent === indent ? null : openerIndent;
        }
        innerWidth = Math.min(innerWidth, openerWidth);
    }
    return null;
};

/**
 * Whether an edit put in the last character of the word that takes its line
 * back, that is, it has just typed the word. Typing after the word (the `:`
 * of `そうでなければ:`) or a change of the indent leaves the line as the
 * person wants it.
 * @param {string} line - The line after the edit.
 * @param {number} startColumn - The 1-based column where the text went in.
 * @param {string} text - The text that went in.
 * @returns {boolean} Whether to take the line back.
 */
const completesOutdentWord = (line, startColumn, text) => {
    if (!text || text.includes('\n')) return false;
    const word = outdentWord(line);
    if (!word) return false;
    // The 1-based column of the last character of the word.
    const lastColumn = word.end;
    return startColumn <= lastColumn && startColumn + text.length > lastColumn;
};

/**
 * Take an else or a closing line back to its block as it is typed in the
 * Japanese mode. While the IME composes a word the line waits for the end of
 * the composition, so the IME is not disturbed.
 * @param {object} editor - The Monaco editor.
 * @param {function(): boolean} isDnclMode - Whether the Japanese mode is on.
 * @returns {{dispose: Function}} The listeners.
 */
const createDnclAutoOutdent = (editor, isDnclMode) => {
    let composing = false;
    const pending = new Set();

    const outdent = (lineNumber) => {
        const model = editor.getModel();
        if (!model || lineNumber > model.getLineCount()) return;
        const newIndent = outdentIndent(model.getLinesContent(), lineNumber - 1);
        if (newIndent === null) return;
        const oldIndent = model.getLineContent(lineNumber).match(LEADING_INDENT_RE)[0];
        editor.executeEdits('dncl-auto-outdent', [
            {
                range: {
                    startLineNumber: lineNumber,
                    startColumn: 1,
                    endLineNumber: lineNumber,
                    endColumn: oldIndent.length + 1,
                },
                text: newIndent,
            },
        ]);
    };

    const flush = () => {
        const lineNumbers = [...pending];
        pending.clear();
        lineNumbers.forEach(outdent);
    };

    const listeners = [
        editor.onDidChangeModelContent((event) => {
            if (!isDnclMode() || event.isFlush || event.isUndoing || event.isRedoing) return;
            if (event.changes.length !== 1) return;
            const { range, text } = event.changes[0];
            const model = editor.getModel();
            if (!model || range.startLineNumber > model.getLineCount()) return;
            if (!completesOutdentWord(model.getLineContent(range.startLineNumber), range.startColumn, text)) return;
            pending.add(range.startLineNumber);
            // The edit goes after Monaco has finished telling of this change.
            if (!composing) queueMicrotask(flush);
        }),
        editor.onDidCompositionStart(() => {
            composing = true;
        }),
        editor.onDidCompositionEnd(() => {
            composing = false;
            queueMicrotask(flush);
        }),
    ];

    return {
        dispose: () => {
            pending.clear();
            listeners.forEach((listener) => listener.dispose());
        },
    };
};

export { completesOutdentWord, createDnclAutoOutdent, outdentIndent };
