// === Smalruby: This file is Smalruby-specific (draws the DNCL problem form in Monaco) ===
import { LEADING_INDENT_RE, indentOffset, indentWidth } from '../../lib/dncl/dncl-indent';
import { END, layoutProblemForm, numberedLineCount, problemFormLabel } from '../../lib/dncl/dncl-problem-form';

/** The class of the character a vertical rule is drawn over (see ruby-tab.css). */
const BAR_CLASS = 'dncl-rule-bar';
/** The class of the character an L is drawn over (see ruby-tab.css). */
const END_CLASS = 'dncl-rule-end';
/** The class of the spaces put in front of a line whose indent does not reach a bar. */
const BAR_GAP_CLASS = 'dncl-rule-bar-gap';

/**
 * The decorations that draw the rules of the problem form over the indent.
 * The text is not changed: each rule is a class on one character of the
 * indent, so the columns of the code stay where they are. A blank line, or a
 * comment written left of the block, has no indent under some bars; spaces
 * that are not in the text are shown in front of it to carry those bars, so
 * the bars of the block do not break there.
 * @param {string} code - The DNCL text.
 * @param {Function} Range - monaco.Range.
 * @returns {Array<object>} The decorations.
 */
const problemFormDecorations = (code, Range) => {
    const lines = code.split(/\r?\n/);
    const decorations = [];
    for (const { lineNumber, rules } of layoutProblemForm(code)) {
        const line = lines[lineNumber - 1];
        const indent = line.match(LEADING_INDENT_RE)[0];
        const missing = [];
        for (const rule of rules) {
            const offset = indentOffset(line, rule.column);
            if (offset === null) {
                missing.push(rule);
                continue;
            }
            decorations.push({
                range: new Range(lineNumber, offset + 1, lineNumber, offset + 2),
                options: { inlineClassName: rule.kind === END ? END_CLASS : BAR_CLASS },
            });
        }
        // Only a line that takes no part in the blocks (blank, comment) misses
        // a rule, and such a line gets bars only. A blank line shows spaces
        // that carry the bars; a comment written left of the block keeps
        // its place, and its bars are left out (Monaco does not show the
        // spaces in front of a line that has text).
        if (indent.length < line.length) continue;
        let width = indentWidth(indent);
        for (const rule of missing) {
            const content = `${' '.repeat(Math.max(0, rule.column - width))} `;
            width = rule.column + 1;
            decorations.push({
                range: new Range(lineNumber, indent.length + 1, lineNumber, indent.length + 1),
                options: { before: { content, inlineClassName: BAR_GAP_CLASS } },
            });
        }
    }
    return decorations;
};

/**
 * The line numbers of the Japanese mode: `(01)` as in the questions, so that
 * error marks and the lines the questions name have the same number. The
 * width of the numbers is that of the copy (the empty last line is not
 * counted).
 * @param {object} editor - The Monaco editor.
 * @returns {function(number): string} The `lineNumbers` option of Monaco.
 */
const problemFormLineNumbers = (editor) => (lineNumber) => {
    const model = editor && editor.getModel();
    if (!model) return problemFormLabel(lineNumber, lineNumber);
    // numberedLineCount without reading the whole text for every label.
    const count = model.getLineCount();
    const numbered = count > 1 && model.getLineContent(count) === '' ? count - 1 : count;
    return problemFormLabel(lineNumber, numbered);
};

/**
 * The `lineNumbersMinChars` of Monaco for the labels of a program: the
 * label `(01)` is the digits and 2 parentheses, with room for the margin.
 * @param {string} code - The DNCL text.
 * @returns {number} The option.
 */
const problemFormLineNumbersMinChars = (code) => Math.max(2, String(numberedLineCount(code)).length) + 3;

/**
 * The problem form of the Japanese mode in the editor (Issue #1755): while
 * the editor has the focus it shows the text as typed; otherwise it shows
 * the rules. `sync` picks one from the mode and the focus, so it is called
 * whenever one of them or the text changes. The options that go with the
 * problem form (no dots for the spaces, no indent guides) are left to the
 * caller through `onChange`, as the React wrapper of Monaco sets the options
 * again on every render.
 * @param {object} editor - The Monaco editor.
 * @param {object} monaco - The Monaco namespace (for `Range`).
 * @param {function(): boolean} isDnclMode - Whether the Japanese mode is on.
 * @param {function(boolean): void} onChange - Called when the problem form
 *   is shown or hidden.
 * @returns {{sync: Function, isShown: function(): boolean, dispose: Function}} The view.
 */
const createProblemFormView = (editor, monaco, isDnclMode, onChange) => {
    const collection = editor.createDecorationsCollection([]);
    let shown = false;

    const setShown = (value) => {
        if (shown === value) return;
        shown = value;
        onChange(value);
    };

    const sync = () => {
        if (isDnclMode() && !editor.hasTextFocus()) {
            collection.set(problemFormDecorations(editor.getValue(), monaco.Range));
            setShown(true);
        } else {
            collection.clear();
            setShown(false);
        }
    };

    return {
        sync,
        isShown: () => shown,
        dispose: () => collection.clear(),
    };
};

export {
    BAR_CLASS,
    BAR_GAP_CLASS,
    END_CLASS,
    createProblemFormView,
    problemFormDecorations,
    problemFormLineNumbers,
    problemFormLineNumbersMinChars,
};
