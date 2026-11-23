import {
    BAR_CLASS,
    BAR_GAP_CLASS,
    END_CLASS,
    READ_MODE_IDLE_MS,
    createProblemFormView,
    problemFormDecorations,
    problemFormLineNumbers,
    problemFormLineNumbersMinChars,
} from '../../../../src/containers/ruby-tab/dncl-problem-form-view';

class Range {
    constructor(startLineNumber, startColumn, endLineNumber, endColumn) {
        Object.assign(this, { startLineNumber, startColumn, endLineNumber, endColumn });
    }
}

// A program written for these tests; no question of the test is used.
const CODE = ['もし a > 0 ならば:', '    b = 1', '', '    もし c ならば:', '        d = 2', 'e = 3'].join('\n');

const fakeEditor = (code, focused) => {
    const collection = { set: jest.fn(), clear: jest.fn() };
    // The listeners the view puts on the editor, by the name of the event.
    const listeners = {};
    const listen = (name) =>
        jest.fn((listener) => {
            listeners[name] = listener;
            return { dispose: () => delete listeners[name] };
        });
    return {
        collection,
        listeners,
        editor: {
            getValue: () => code,
            hasTextFocus: () => focused.value,
            onDidFocusEditorText: listen('focus'),
            onDidBlurEditorText: listen('blur'),
            onMouseDown: listen('mouseDown'),
            onKeyDown: listen('keyDown'),
            onDidPaste: listen('paste'),
            getModel: () => ({
                getLineCount: () => code.split('\n').length,
                getLineContent: (n) => code.split('\n')[n - 1],
            }),
            createDecorationsCollection: jest.fn(() => collection),
        },
    };
};

describe('problemFormDecorations', () => {
    test('puts a class on the space of the indent under each rule', () => {
        const decorations = problemFormDecorations(CODE, Range);
        const classOf = (d) => d.options.inlineClassName || d.options.before.inlineClassName;
        expect(decorations.map((d) => [d.range, classOf(d)])).toEqual([
            [new Range(2, 1, 2, 2), BAR_CLASS],
            [new Range(3, 1, 3, 1), BAR_GAP_CLASS],
            [new Range(4, 1, 4, 2), BAR_CLASS],
            [new Range(5, 1, 5, 2), END_CLASS],
            [new Range(5, 5, 5, 6), END_CLASS],
        ]);
    });

    test('takes a tab of the indent as one character', () => {
        const decorations = problemFormDecorations('もし a ならば:\n\t\tもし b ならば:\n\t\t\tc = 1', Range);
        expect(decorations.map((d) => d.range.startColumn)).toEqual([1, 1, 3]);
    });
});

describe('problemFormDecorations on lines without the indent', () => {
    test('a blank line in two blocks shows both bars with spaces in front', () => {
        const code = ['もし a ならば:', '    もし b ならば:', '        x = 1', '', '        y = 1'].join('\n');
        const blank = problemFormDecorations(code, Range).filter((d) => d.range.startLineNumber === 4);
        expect(blank.map((d) => [d.range, d.options.before])).toEqual([
            [new Range(4, 1, 4, 1), { content: ' ', inlineClassName: BAR_GAP_CLASS }],
            [new Range(4, 1, 4, 1), { content: '    ', inlineClassName: BAR_GAP_CLASS }],
        ]);
    });

    test('a comment left of the block keeps its place without the bar', () => {
        const code = ['もし a ならば:', '    x = 1', '# 外のコメント', '    y = 1'].join('\n');
        expect(problemFormDecorations(code, Range).filter((d) => d.range.startLineNumber === 3)).toEqual([]);
    });

    test('a bar the indent reaches is drawn over the indent', () => {
        const code = ['もし a ならば:', '    x = 1', '  ', '    y = 1'].join('\n');
        const blank = problemFormDecorations(code, Range).filter((d) => d.range.startLineNumber === 3);
        expect(blank.map((d) => [d.range, d.options.inlineClassName])).toEqual([[new Range(3, 1, 3, 2), BAR_CLASS]]);
    });
});

describe('problemFormLineNumbers', () => {
    test('labels the lines as in the questions', () => {
        const { editor } = fakeEditor(CODE, { value: false });
        expect(problemFormLineNumbers(editor)(3)).toBe('(03)');
    });

    test('does not count the empty last line, as the copy does', () => {
        const { editor } = fakeEditor(`${'a = 1\n'.repeat(99)}`, { value: false });
        expect(problemFormLineNumbers(editor)(100)).toBe('(100)');
        expect(problemFormLineNumbers(editor)(1)).toBe('(01)');
    });
});

describe('problemFormLineNumbersMinChars', () => {
    test('makes room for the digits of the labels', () => {
        expect(problemFormLineNumbersMinChars('a = 1')).toBe(5);
        expect(problemFormLineNumbersMinChars('a = 1\n'.repeat(1200))).toBe(7);
    });
});

describe('createProblemFormView: the read mode and the write mode', () => {
    beforeEach(() => jest.useFakeTimers());
    afterEach(() => jest.useRealTimers());

    const setup = ({ focused = false, dncl = true } = {}) => {
        const focus = { value: focused };
        const mode = { dncl };
        const fake = fakeEditor(CODE, focus);
        const onChange = jest.fn();
        const view = createProblemFormView(fake.editor, { Range }, () => mode.dncl, onChange);
        return { ...fake, focus, mode, onChange, view };
    };

    test('starts in the read mode while the editor has no focus', () => {
        const { view, collection, onChange } = setup();
        view.sync();
        expect(collection.set).toHaveBeenCalledWith(problemFormDecorations(CODE, Range));
        expect(view.isShown()).toBe(true);
        expect(onChange).toHaveBeenCalledWith(true);
    });

    test('starts in the write mode while the editor has the focus', () => {
        const { view, collection } = setup({ focused: true });
        view.sync();
        expect(collection.set).not.toHaveBeenCalled();
        expect(view.isShown()).toBe(false);
    });

    test('draws nothing out of the Japanese mode, whatever is asked', () => {
        const { view, collection, onChange } = setup({ dncl: false });
        view.sync();
        view.showReadMode();
        expect(collection.set).not.toHaveBeenCalled();
        expect(onChange).not.toHaveBeenCalled();
        expect(view.isShown()).toBe(false);
    });

    test('the focus brings the write mode back and the blur the read mode', () => {
        const { view, listeners, focus } = setup();
        view.sync();
        focus.value = true;
        listeners.focus();
        expect(view.isShown()).toBe(false);
        focus.value = false;
        listeners.blur();
        expect(view.isShown()).toBe(true);
    });

    test('a press of the mouse in the editor brings the write mode back', () => {
        const { view, listeners } = setup({ focused: true });
        view.sync();
        view.showReadMode();
        expect(view.isShown()).toBe(true);
        listeners.mouseDown();
        expect(view.isShown()).toBe(false);
    });

    test('switches to the read mode after a while without input', () => {
        const { view, listeners } = setup({ focused: true });
        view.sync();
        jest.advanceTimersByTime(READ_MODE_IDLE_MS - 1000);
        listeners.keyDown();
        jest.advanceTimersByTime(READ_MODE_IDLE_MS - 1);
        expect(view.isShown()).toBe(false);
        jest.advanceTimersByTime(1);
        expect(view.isShown()).toBe(true);
    });

    test('an edit while the editor has the focus brings the write mode back and waits again', () => {
        const { view, focus } = setup({ focused: true });
        view.sync();
        view.showReadMode();
        view.textChanged();
        expect(view.isShown()).toBe(false);
        jest.advanceTimersByTime(READ_MODE_IDLE_MS);
        expect(view.isShown()).toBe(true);
        // The text changed from outside (another sprite): the rules are drawn again.
        focus.value = false;
        view.textChanged();
        expect(view.isShown()).toBe(true);
    });

    test('a change of the text from outside keeps the read mode and draws the rules again', () => {
        const { view, collection } = setup();
        view.sync();
        collection.set.mockClear();
        view.textChanged();
        expect(view.isShown()).toBe(true);
        expect(collection.set).toHaveBeenCalledTimes(1);
    });

    test('switches to the read mode right after a paste', () => {
        const { view, listeners } = setup({ focused: true });
        view.sync();
        // The paste changes the text first.
        view.textChanged();
        listeners.paste();
        jest.advanceTimersByTime(0);
        expect(view.isShown()).toBe(true);
    });

    test('toggle switches the modes, and the write mode puts the focus in the editor', () => {
        const { view, editor } = setup();
        editor.focus = jest.fn();
        view.sync();
        view.toggle();
        expect(view.isShown()).toBe(false);
        expect(editor.focus).toHaveBeenCalled();
        view.toggle();
        expect(view.isShown()).toBe(true);
    });

    test('the read mode asked for while the editor has the focus stays without the idle timer', () => {
        const { view } = setup({ focused: true });
        view.sync();
        view.showReadMode();
        jest.advanceTimersByTime(READ_MODE_IDLE_MS * 2);
        expect(view.isShown()).toBe(true);
    });

    test('leaving the Japanese mode clears the rules; coming back follows the focus', () => {
        const { view, mode, collection } = setup();
        view.sync();
        mode.dncl = false;
        view.sync();
        expect(collection.clear).toHaveBeenCalled();
        expect(view.isShown()).toBe(false);
        mode.dncl = true;
        view.sync();
        expect(view.isShown()).toBe(true);
    });

    test('dispose removes the listeners and the timer', () => {
        const { view, listeners } = setup({ focused: true });
        view.sync();
        view.dispose();
        expect(Object.keys(listeners)).toEqual([]);
        jest.advanceTimersByTime(READ_MODE_IDLE_MS);
        expect(view.isShown()).toBe(false);
    });
});
