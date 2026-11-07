import { offerDnclIndexShift } from '../../../../src/containers/ruby-tab/dncl-index-shift';

class Range {
    constructor(startLineNumber, startColumn, endLineNumber, endColumn) {
        Object.assign(this, { startLineNumber, startColumn, endLineNumber, endColumn });
    }
}

const PASTED = [
    '# 配列の添字は1から始まる',
    'Akibi = [1, 1, 1]',
    'tantou = 1',
    '表示する(Akibi[tantou])',
].join('\n');

const formatMessage = (descriptor, values = {}) =>
    `${descriptor.id}${Object.keys(values).length > 0 ? JSON.stringify(values) : ''}`;

const setup = (pasted, answer) => {
    const editor = {
        getModel: () => ({ getValueInRange: () => pasted }),
        pushUndoStop: jest.fn(),
        executeEdits: jest.fn(),
        createDecorationsCollection: jest.fn((decorations) => ({ decorations, clear: jest.fn() })),
    };
    // Pasted at line 3, column 5 of the editor.
    const range = { startLineNumber: 3, startColumn: 5, isEmpty: () => false };
    const confirm = jest.fn(() => answer);
    const alert = jest.fn();
    const result = offerDnclIndexShift({ editor, monaco: { Range }, range, formatMessage, confirm, alert });
    return { editor, range, confirm, alert, result };
};

describe('offerDnclIndexShift', () => {
    test('does not ask without a 1-based note', () => {
        const { confirm, editor, result } = setup('表示する(Akibi[1])', true);
        expect(confirm).not.toHaveBeenCalled();
        expect(editor.executeEdits).not.toHaveBeenCalled();
        expect(result).toBeNull();
    });

    test('does not ask when there is no array access', () => {
        const { confirm } = setup('# 添字は1から始まる\ni = 1', true);
        expect(confirm).not.toHaveBeenCalled();
    });

    test('changes nothing when the user declines', () => {
        const { confirm, editor, alert, result } = setup(PASTED, false);
        expect(confirm).toHaveBeenCalledWith('gui.rubyTab.dnclIndexShiftConfirm');
        expect(editor.executeEdits).not.toHaveBeenCalled();
        expect(editor.createDecorationsCollection).not.toHaveBeenCalled();
        expect(alert).not.toHaveBeenCalled();
        expect(result).toBeNull();
    });

    test('rewrites the pasted range in one undo step when the user agrees', () => {
        const { editor, range } = setup(PASTED, true);
        expect(editor.executeEdits).toHaveBeenCalledWith('smalruby.dnclIndexShift', [
            { range, text: PASTED.replace('Akibi[tantou]', 'Akibi[tantou - 1]'), forceMoveMarkers: true },
        ]);
        expect(editor.pushUndoStop).toHaveBeenCalledTimes(2);
    });

    test('marks the rewritten access and the suspicious line', () => {
        const { result } = setup(PASTED, true);
        const [shifted, suspect] = result.decorations;
        // Line 4 of the pasted text is line 6 of the editor.
        expect(shifted.range).toEqual(new Range(6, 6, 6, 23));
        expect(shifted.options.inlineClassName).toBe('dncl-index-shifted');
        expect(suspect.range).toEqual(new Range(5, 1, 5, 11));
        expect(suspect.options.inlineClassName).toBe('dncl-index-suspect');
        expect(suspect.options.hoverMessage).toEqual([{ value: 'gui.rubyTab.dnclIndexShiftReasonAssignOne' }]);
    });

    test('summarizes what changed, that loops were not changed, and what to check', () => {
        const { alert } = setup(PASTED, true);
        const summary = alert.mock.calls[0][0];
        expect(summary).toContain('gui.rubyTab.dnclIndexShiftDone{"count":1}');
        expect(summary).toContain('"line":6');
        expect(summary).toContain('"before":"Akibi[tantou]","after":"Akibi[tantou - 1]"');
        expect(summary).toContain('gui.rubyTab.dnclIndexShiftSuspectsHeading');
        expect(summary).toContain('"line":5,"text":"tantou = 1"');
    });
});
