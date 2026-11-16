import {
    BAR_CLASS,
    BAR_GAP_CLASS,
    END_CLASS,
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
    return {
        collection,
        editor: {
            getValue: () => code,
            hasTextFocus: () => focused.value,
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

describe('createProblemFormView', () => {
    test('draws the rules while the editor has no focus in the Japanese mode', () => {
        const focused = { value: false };
        const { editor, collection } = fakeEditor(CODE, focused);
        const onChange = jest.fn();
        const view = createProblemFormView(editor, { Range }, () => true, onChange);
        view.sync();
        expect(collection.set).toHaveBeenCalledWith(problemFormDecorations(CODE, Range));
        expect(view.isShown()).toBe(true);
        expect(onChange).toHaveBeenCalledWith(true);
    });

    test('shows the text while the editor has the focus', () => {
        const focused = { value: false };
        const { editor, collection } = fakeEditor(CODE, focused);
        const onChange = jest.fn();
        const view = createProblemFormView(editor, { Range }, () => true, onChange);
        view.sync();
        focused.value = true;
        view.sync();
        expect(collection.clear).toHaveBeenCalled();
        expect(view.isShown()).toBe(false);
        expect(onChange.mock.calls).toEqual([[true], [false]]);
    });

    test('draws nothing out of the Japanese mode', () => {
        const { editor, collection } = fakeEditor(CODE, { value: false });
        const onChange = jest.fn();
        const view = createProblemFormView(editor, { Range }, () => false, onChange);
        view.sync();
        expect(collection.set).not.toHaveBeenCalled();
        expect(onChange).not.toHaveBeenCalled();
    });
});
