/* eslint-env jest */
// The auto-corrected text is put after the change has reached every listener
// of the model, not from inside one (Issue #2557, B16).
import { applyAutoCorrection } from '../../../../src/containers/ruby-tab/auto-correct-apply';

const makeEditor = (text, cursorOffset) => {
    let value = text;
    let cursor = cursorOffset;
    const model = {
        getValue: () => value,
        setValue: jest.fn((v) => {
            value = v;
        }),
        getOffsetAt: (position) => position.offset,
        getPositionAt: (offset) => ({ offset }),
    };
    return {
        model,
        type: (v) => {
            value = v;
        },
        getModel: () => model,
        getPosition: () => ({ offset: cursor }),
        setPosition: jest.fn((position) => {
            cursor = position.offset;
        }),
    };
};

const correct = (text) => text.replace(/｜/g, '|');

describe('applyAutoCorrection', () => {
    test('puts the corrected text after the change, with the cursor where it was', async () => {
        const editor = makeEditor('a ｜', 3);
        const beforeApply = jest.fn();
        applyAutoCorrection(editor, 'a ｜', 'a |', correct, beforeApply);
        expect(editor.model.setValue).not.toHaveBeenCalled();
        await Promise.resolve();
        expect(beforeApply).toHaveBeenCalledTimes(1);
        expect(editor.model.setValue).toHaveBeenCalledWith('a |');
        expect(editor.setPosition).toHaveBeenCalledWith({ offset: 3 });
    });

    test('puts nothing when the text has changed again in the meantime', async () => {
        const editor = makeEditor('a ｜', 3);
        const beforeApply = jest.fn();
        applyAutoCorrection(editor, 'a ｜', 'a |', correct, beforeApply);
        editor.type('a ｜b');
        await Promise.resolve();
        expect(beforeApply).not.toHaveBeenCalled();
        expect(editor.model.setValue).not.toHaveBeenCalled();
    });
});
