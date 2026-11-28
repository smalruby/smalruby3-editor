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
 * How long the editor waits without input before it shows the read mode
 * (Issue #2380). Long enough not to come in while a learner stops to think
 * in the middle of a line, short enough to show the rules soon after the
 * hands leave the keys.
 */
const READ_MODE_IDLE_MS = 5000;

/**
 * The two ways the Japanese mode shows the program in the editor
 * (Issue #1755, #2380): the read mode draws the line numbers and the rules
 * as in the questions, the write mode shows the text as typed with the dots
 * of the spaces and the indent guides. The text and its columns are the same
 * in both; the rules are decorations over the indent.
 *
 * The read mode comes on when the editor loses the focus, after
 * `READ_MODE_IDLE_MS` without input, right after a paste, and when it is
 * asked for (`showReadMode`: the run button, the toggle of the toolbar). The
 * write mode comes back when the editor gets the focus, a press of the mouse
 * in it, or an edit while it has the focus. Which mode is shown is kept
 * here, not taken from the focus, so the read mode can be shown while the
 * cursor stays in the editor.
 *
 * The options that go with the read mode (no dots for the spaces, no indent
 * guides) are left to the caller through `onChange`, as the React wrapper of
 * Monaco sets the options again on every render.
 * @param {object} editor - The Monaco editor.
 * @param {object} monaco - The Monaco namespace (for `Range`).
 * @param {function(): boolean} isDnclMode - Whether the Japanese mode is on.
 * @param {function(boolean): void} onChange - Called when the read mode is
 *   shown or hidden.
 * @returns {{sync: Function, textChanged: Function, showReadMode: Function, showWriteMode: Function,
 *   toggle: Function, isShown: function(): boolean, dispose: Function}} The view.
 */
const createProblemFormView = (editor, monaco, isDnclMode, onChange) => {
    const collection = editor.createDecorationsCollection([]);
    let shown = false;
    // The mode asked for; it is shown only in the Japanese mode.
    let readMode = !editor.hasTextFocus();
    let wasDnclMode = false;
    let idleTimer = null;

    const setShown = (value) => {
        if (shown === value) return;
        shown = value;
        onChange(value);
    };

    const stopIdleTimer = () => {
        if (idleTimer === null) return;
        clearTimeout(idleTimer);
        idleTimer = null;
    };

    const sync = () => {
        const dncl = isDnclMode();
        // Coming into the Japanese mode the mode follows the focus.
        if (dncl && !wasDnclMode) readMode = !editor.hasTextFocus();
        wasDnclMode = dncl;
        if (dncl && readMode) {
            collection.set(problemFormDecorations(editor.getValue(), monaco.Range));
            setShown(true);
        } else {
            collection.clear();
            setShown(false);
        }
    };

    const setReadMode = (value) => {
        readMode = value;
        sync();
    };

    const showReadMode = () => {
        stopIdleTimer();
        setReadMode(true);
    };

    // The write mode waits for the next pause of the input.
    const waitForIdle = () => {
        stopIdleTimer();
        if (!isDnclMode() || !editor.hasTextFocus()) return;
        idleTimer = setTimeout(() => {
            idleTimer = null;
            if (isDnclMode() && editor.hasTextFocus()) setReadMode(true);
        }, READ_MODE_IDLE_MS);
    };

    const showWriteMode = () => {
        setReadMode(false);
        waitForIdle();
    };

    // Typing goes on in the write mode; a change from outside (another
    // sprite, the blocks) keeps the mode and draws the rules for the new text.
    const textChanged = () => {
        if (editor.hasTextFocus()) showWriteMode();
        else sync();
    };

    const toggle = () => {
        if (shown) {
            showWriteMode();
            if (editor.focus) editor.focus();
        } else {
            showReadMode();
        }
    };

    const listeners = [
        editor.onDidFocusEditorText(showWriteMode),
        editor.onDidBlurEditorText(showReadMode),
        editor.onMouseDown(showWriteMode),
        editor.onKeyDown(() => {
            if (!shown) waitForIdle();
        }),
        // After Monaco has finished handling the paste (its edit comes first).
        editor.onDidPaste(() => setTimeout(() => isDnclMode() && editor.hasTextFocus() && showReadMode(), 0)),
    ];

    return {
        sync,
        textChanged,
        showReadMode,
        showWriteMode,
        toggle,
        isShown: () => shown,
        dispose: () => {
            stopIdleTimer();
            listeners.forEach((listener) => listener.dispose());
            collection.clear();
        },
    };
};

export {
    BAR_CLASS,
    BAR_GAP_CLASS,
    END_CLASS,
    READ_MODE_IDLE_MS,
    createProblemFormView,
    problemFormDecorations,
    problemFormLineNumbers,
    problemFormLineNumbersMinChars,
};
