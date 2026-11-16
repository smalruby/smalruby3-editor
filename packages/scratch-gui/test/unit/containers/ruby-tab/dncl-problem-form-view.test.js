import {
    BAR_CLASS,
    END_CLASS,
    createProblemFormView,
    problemFormDecorations,
    problemFormLineNumbers,
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
            getModel: () => ({ getLineCount: () => code.split('\n').length }),
            createDecorationsCollection: jest.fn(() => collection),
        },
    };
};

describe('problemFormDecorations', () => {
    test('puts a class on the space of the indent under each rule', () => {
        const decorations = problemFormDecorations(CODE, Range);
        expect(decorations.map((d) => [d.range, d.options.inlineClassName])).toEqual([
            [new Range(2, 1, 2, 2), BAR_CLASS],
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

describe('problemFormLineNumbers', () => {
    test('labels the lines as in the questions', () => {
        const { editor } = fakeEditor(CODE, { value: false });
        expect(problemFormLineNumbers(editor)(3)).toBe('(03)');
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
