import { offerDnclIndexSetting, replaceEditorText } from '../../../../src/containers/ruby-tab/dncl-index-setting';

const SENTENCE = '# すべての配列の添字は 1 から始まる。';

/**
 * A Monaco editor with only what the functions use; `executeEdits` changes its text.
 * @param {string} text - The text of the editor.
 * @param {string} [pasted] - The text of the pasted range.
 * @returns {object} The editor.
 */
const makeEditor = (text, pasted = text) => {
    let value = text;
    const offsetOf = ({ lineNumber, column }) => {
        const lines = value.split('\n');
        return lines.slice(0, lineNumber - 1).reduce((n, line) => n + line.length + 1, 0) + column - 1;
    };
    const model = {
        getValue: () => value,
        getValueInRange: () => pasted,
        getPositionAt: (offset) => {
            const lines = value.substring(0, offset).split('\n');
            return { lineNumber: lines.length, column: lines[lines.length - 1].length + 1 };
        },
    };
    return {
        getModel: () => model,
        pushUndoStop: jest.fn(),
        executeEdits: jest.fn((_source, edits) => {
            edits.forEach(({ range, text: insert }) => {
                const start = offsetOf({ lineNumber: range.startLineNumber, column: range.startColumn });
                const end = offsetOf({ lineNumber: range.endLineNumber, column: range.endColumn });
                value = value.substring(0, start) + insert + value.substring(end);
            });
        }),
        value: () => value,
    };
};

const formatMessage = (descriptor) => descriptor.id;
const range = { isEmpty: () => false };

describe('offerDnclIndexSetting', () => {
    test('does not ask without a note on the indexes', () => {
        const editor = makeEditor('A = [1, 2]\n表示する(A[1])');
        const confirm = jest.fn(() => true);
        expect(offerDnclIndexSetting({ editor, range, formatMessage, confirm })).toBe(false);
        expect(confirm).not.toHaveBeenCalled();
    });

    test('does not ask when the program says so at its top already', () => {
        const editor = makeEditor(`${SENTENCE}\nA = [1]\n# 添字は1から始まる`, '# 添字は1から始まる');
        const confirm = jest.fn(() => true);
        expect(offerDnclIndexSetting({ editor, range, formatMessage, confirm })).toBe(false);
        expect(confirm).not.toHaveBeenCalled();
    });

    test('changes nothing when the user declines', () => {
        const text = 'a = 1\n# 添字は1から始まるものとする\nA = [1, 2]';
        const editor = makeEditor(text, '# 添字は1から始まるものとする\nA = [1, 2]');
        const confirm = jest.fn(() => false);
        expect(offerDnclIndexSetting({ editor, range, formatMessage, confirm })).toBe(false);
        expect(confirm).toHaveBeenCalledWith('gui.rubyTab.dnclIndexSettingConfirm');
        expect(editor.executeEdits).not.toHaveBeenCalled();
    });

    test('writes the sentence at the top in one undo step and keeps the indexes', () => {
        const text = 'a = 1\n# 添字は1から始まるものとする\nA = [1, 2]\n表示する(A[1])';
        const editor = makeEditor(text, '# 添字は1から始まるものとする\nA = [1, 2]\n表示する(A[1])');
        expect(offerDnclIndexSetting({ editor, range, formatMessage, confirm: () => true })).toBe(true);
        expect(editor.value()).toBe(`${SENTENCE}\n${text}`);
        expect(editor.pushUndoStop).toHaveBeenCalledTimes(2);
        expect(editor.executeEdits).toHaveBeenCalledTimes(1);
        expect(editor.executeEdits.mock.calls[0][1][0].text).toBe(`${SENTENCE}\n`);
    });
});

describe('replaceEditorText', () => {
    test('replaces only the part that differs', () => {
        const editor = makeEditor('a = 1\nb = A[0]\nc = 3');
        expect(replaceEditorText(editor, 'a = 1\nb = A[1]\nc = 3', 'test')).toBe(true);
        expect(editor.value()).toBe('a = 1\nb = A[1]\nc = 3');
        expect(editor.executeEdits.mock.calls[0][1][0]).toMatchObject({
            range: { startLineNumber: 2, startColumn: 7, endLineNumber: 2, endColumn: 8 },
            text: '1',
        });
    });

    test('does nothing when the text is the same', () => {
        const editor = makeEditor('a = 1');
        expect(replaceEditorText(editor, 'a = 1', 'test')).toBe(false);
        expect(editor.executeEdits).not.toHaveBeenCalled();
    });
});
