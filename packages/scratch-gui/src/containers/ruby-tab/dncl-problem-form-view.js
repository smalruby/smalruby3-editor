// === Smalruby: This file is Smalruby-specific (draws the DNCL problem form in Monaco) ===
import { END, layoutProblemForm, problemFormLabel } from '../../lib/dncl/dncl-problem-form';

/** The class of the character a vertical rule is drawn over (see ruby-tab.css). */
const BAR_CLASS = 'dncl-rule-bar';
/** The class of the character an L is drawn over (see ruby-tab.css). */
const END_CLASS = 'dncl-rule-end';

/**
 * The 0-based offset in a line of the character at the given indent width:
 * where the rule of a block at that column is drawn. Null when the indent of
 * the line does not reach it (a blank line), so the rule is not drawn there.
 * @param {string} line - The line.
 * @param {number} column - The indent width of the header of the block.
 * @returns {?number} The offset.
 */
const offsetOfColumn = (line, column) => {
    let width = 0;
    for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch !== ' ' && ch !== '\t' && ch !== '\u3000') return null;
        if (width >= column) return i;
        width += ch === '\t' ? 4 : ch === '\u3000' ? 2 : 1;
    }
    return null;
};

/**
 * The decorations that draw the rules of the problem form over the indent.
 * The text is not changed: each rule is a class on one space of the indent,
 * so the columns of the code stay where they are.
 * @param {string} code - The DNCL text.
 * @param {Function} Range - monaco.Range.
 * @returns {Array<object>} The decorations.
 */
const problemFormDecorations = (code, Range) => {
    const lines = code.split('\n');
    const decorations = [];
    for (const { lineNumber, rules } of layoutProblemForm(code)) {
        const line = lines[lineNumber - 1];
        for (const rule of rules) {
            const offset = offsetOfColumn(line, rule.column);
            if (offset === null) continue;
            decorations.push({
                range: new Range(lineNumber, offset + 1, lineNumber, offset + 2),
                options: { inlineClassName: rule.kind === END ? END_CLASS : BAR_CLASS },
            });
        }
    }
    return decorations;
};

/**
 * The line numbers of the Japanese mode: `(01)` as in the questions, so that
 * error marks and the lines the questions name have the same number.
 * @param {object} editor - The Monaco editor.
 * @returns {function(number): string} The `lineNumbers` option of Monaco.
 */
const problemFormLineNumbers = (editor) => (lineNumber) => {
    const model = editor && editor.getModel();
    return problemFormLabel(lineNumber, model ? model.getLineCount() : lineNumber);
};

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

export { BAR_CLASS, END_CLASS, createProblemFormView, problemFormDecorations, problemFormLineNumbers };
