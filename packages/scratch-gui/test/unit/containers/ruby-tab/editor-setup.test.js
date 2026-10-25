import {registerCustomPasteAction, setupPasteTransform} from '../../../../src/containers/ruby-tab/editor-setup';

const makeEditor = ({readOnly = false, textFocus = true} = {}) => {
    const domNode = document.createElement('div');
    return {
        domNode,
        getDomNode: () => domNode,
        hasTextFocus: () => textFocus,
        getRawOptions: () => ({readOnly}),
        trigger: jest.fn(),
        addAction: jest.fn(),
    };
};

const firePaste = (target, text) => {
    const event = new Event('paste', {bubbles: true, cancelable: true});
    event.clipboardData = {getData: () => text};
    target.dispatchEvent(event);
    return event;
};

describe('setupPasteTransform (Issue #1192)', () => {
    test('inserts the transformed text through the paste command', () => {
        const editor = makeEditor();
        setupPasteTransform(editor, text => text.toUpperCase());
        const event = firePaste(editor.domNode, 'abc');
        expect(event.defaultPrevented).toBe(true);
        expect(editor.trigger).toHaveBeenCalledWith('keyboard', 'paste', {
            text: 'ABC',
            pasteOnNewLine: false,
            multicursorText: null,
        });
    });

    test('lets Monaco paste when the text is unchanged', () => {
        const editor = makeEditor();
        setupPasteTransform(editor, text => text);
        const event = firePaste(editor.domNode, 'abc');
        expect(event.defaultPrevented).toBe(false);
        expect(editor.trigger).not.toHaveBeenCalled();
    });

    test('does nothing in a read-only editor', () => {
        const editor = makeEditor({readOnly: true});
        setupPasteTransform(editor, text => text.toUpperCase());
        expect(firePaste(editor.domNode, 'abc').defaultPrevented).toBe(false);
    });

    test('leaves pastes into the find widget alone', () => {
        const editor = makeEditor({textFocus: false});
        setupPasteTransform(editor, text => text.toUpperCase());
        expect(firePaste(editor.domNode, 'abc').defaultPrevented).toBe(false);
        expect(editor.trigger).not.toHaveBeenCalled();
    });

    test('the returned function removes the listener', () => {
        const editor = makeEditor();
        const remove = setupPasteTransform(editor, text => text.toUpperCase());
        remove();
        expect(firePaste(editor.domNode, 'abc').defaultPrevented).toBe(false);
    });
});

describe('registerCustomPasteAction', () => {
    test('types the transformed clipboard text', async () => {
        const editor = makeEditor();
        Object.defineProperty(navigator, 'clipboard', {
            value: {readText: () => Promise.resolve('abc')},
            configurable: true,
        });
        registerCustomPasteAction(editor, 'Paste', text => text.toUpperCase());
        const action = editor.addAction.mock.calls[0][0];
        await action.run(editor);
        expect(editor.trigger).toHaveBeenCalledWith('keyboard', 'type', {text: 'ABC'});
    });
});
