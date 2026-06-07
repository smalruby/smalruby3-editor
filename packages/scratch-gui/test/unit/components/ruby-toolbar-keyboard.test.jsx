/* eslint-env jest */
import '@testing-library/jest-dom';
import { render, fireEvent, createEvent, act } from '@testing-library/react';
import React from 'react';
import { IntlProvider } from 'react-intl';
import RubyToolbar from '../../../src/components/ruby-toolbar/ruby-toolbar.jsx';
import { isTouchDevice } from '../../../src/lib/touch-device';

jest.mock('../../../src/lib/touch-device', () => ({
    __esModule: true,
    isTouchDevice: jest.fn(),
}));

/**
 * Create a minimal Monaco editor mock exposing the APIs the keyboard toggle
 * button uses: focus / hasTextFocus / getDomNode / focus-blur listeners.
 * The dom node is attached to the document so that focus tracking via
 * document.activeElement works in jsdom. Monaco 0.55+ focuses a
 * div.native-edit-context (EditContext input strategy) rather than the
 * legacy textarea.inputarea, so the mock uses a tabindex'd div.
 * @returns {object} editor mock plus helpers to fire focus/blur events.
 */
const createEditorMock = () => {
    const domNode = document.createElement('div');
    const editContext = document.createElement('div');
    editContext.className = 'native-edit-context';
    editContext.tabIndex = 0;
    domNode.appendChild(editContext);
    document.body.appendChild(domNode);
    let focusHandler = null;
    let blurHandler = null;
    const editor = {
        focus: jest.fn(),
        hasTextFocus: jest.fn(() => false),
        getDomNode: jest.fn(() => domNode),
        onDidFocusEditorText: jest.fn((cb) => {
            focusHandler = cb;
            return { dispose: jest.fn() };
        }),
        onDidBlurEditorText: jest.fn((cb) => {
            blurHandler = cb;
            return { dispose: jest.fn() };
        }),
        getPosition: jest.fn(() => ({ lineNumber: 1 })),
        trigger: jest.fn(),
    };
    return {
        editor,
        editContext,
        fireFocus: () => focusHandler && focusHandler(),
        fireBlur: () => blurHandler && blurHandler(),
        cleanup: () => domNode.remove(),
    };
};

const renderToolbar = (overrides = {}) => {
    const defaultProps = {
        locale: 'ja',
        onSelectTarget: jest.fn(),
        onDismissBubble: jest.fn(),
        editorRef: null,
        ...overrides,
    };
    return render(
        <IntlProvider locale="ja" messages={{}}>
            <RubyToolbar {...defaultProps} />
        </IntlProvider>,
    );
};

const getKeyboardButton = (container) => container.querySelector('[data-testid="ruby-toolbar-keyboard"]');

describe('ruby-toolbar keyboard toggle button', () => {
    beforeEach(() => {
        isTouchDevice.mockReset();
    });

    test('is not rendered on non-touch devices', () => {
        isTouchDevice.mockReturnValue(false);
        const { container } = renderToolbar();
        expect(getKeyboardButton(container)).toBeNull();
    });

    test('is rendered on touch devices with aria-pressed=false', () => {
        isTouchDevice.mockReturnValue(true);
        const { editor } = createEditorMock();
        const { container } = renderToolbar({ editorRef: editor });
        const button = getKeyboardButton(container);
        expect(button).toBeTruthy();
        expect(button.getAttribute('aria-pressed')).toBe('false');
    });

    test('is disabled while the editor is not mounted', () => {
        isTouchDevice.mockReturnValue(true);
        const { container } = renderToolbar({ editorRef: null });
        const button = getKeyboardButton(container);
        expect(button).toBeTruthy();
        expect(button).toBeDisabled();
    });

    test('focuses the editor when clicked while the keyboard is hidden', () => {
        isTouchDevice.mockReturnValue(true);
        const { editor } = createEditorMock();
        const { container } = renderToolbar({ editorRef: editor });
        fireEvent.click(getKeyboardButton(container));
        expect(editor.focus).toHaveBeenCalled();
    });

    test('reflects editor focus/blur events in aria-pressed', () => {
        isTouchDevice.mockReturnValue(true);
        const mock = createEditorMock();
        const { container } = renderToolbar({ editorRef: mock.editor });
        const button = getKeyboardButton(container);

        act(() => {
            mock.fireFocus();
        });
        expect(button.getAttribute('aria-pressed')).toBe('true');

        act(() => {
            mock.fireBlur();
        });
        expect(button.getAttribute('aria-pressed')).toBe('false');
    });

    test('blurs the focused editor element when clicked while the keyboard is shown', () => {
        isTouchDevice.mockReturnValue(true);
        const mock = createEditorMock();
        const blurSpy = jest.spyOn(mock.editContext, 'blur');
        const { container } = renderToolbar({ editorRef: mock.editor });

        // Simulate Monaco having focus: its edit-context element is the
        // document's active element.
        mock.editContext.focus();
        expect(document.activeElement).toBe(mock.editContext);
        act(() => {
            mock.fireFocus();
        });
        fireEvent.click(getKeyboardButton(container));

        expect(blurSpy).toHaveBeenCalled();
        expect(mock.editor.focus).not.toHaveBeenCalled();
        mock.cleanup();
    });

    test('prevents mousedown default so pressing the button does not blur the editor', () => {
        // Without this, pressing the button steals focus from the editor at
        // mousedown time; the blur event flips keyboardVisible to false
        // before the click handler runs, so "hide" would re-focus instead.
        isTouchDevice.mockReturnValue(true);
        const { editor } = createEditorMock();
        const { container } = renderToolbar({ editorRef: editor });
        const button = getKeyboardButton(container);

        const mouseDownEvent = createEvent.mouseDown(button);
        fireEvent(button, mouseDownEvent);

        expect(mouseDownEvent.defaultPrevented).toBe(true);
    });

    test('starts as pressed when the editor already has text focus', () => {
        isTouchDevice.mockReturnValue(true);
        const { editor } = createEditorMock();
        editor.hasTextFocus.mockReturnValue(true);
        const { container } = renderToolbar({ editorRef: editor });
        expect(getKeyboardButton(container).getAttribute('aria-pressed')).toBe('true');
    });
});
