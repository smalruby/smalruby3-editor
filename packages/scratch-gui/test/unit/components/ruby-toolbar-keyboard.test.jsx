/* eslint-env jest */
import '@testing-library/jest-dom';
import { render, fireEvent, act } from '@testing-library/react';
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
 * @returns {object} editor mock plus helpers to fire focus/blur events.
 */
const createEditorMock = () => {
    const domNode = document.createElement('div');
    const textarea = document.createElement('textarea');
    textarea.className = 'inputarea';
    domNode.appendChild(textarea);
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
        textarea,
        fireFocus: () => focusHandler && focusHandler(),
        fireBlur: () => blurHandler && blurHandler(),
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

    test('blurs the editor textarea when clicked while the keyboard is shown', () => {
        isTouchDevice.mockReturnValue(true);
        const mock = createEditorMock();
        const blurSpy = jest.spyOn(mock.textarea, 'blur');
        const { container } = renderToolbar({ editorRef: mock.editor });

        act(() => {
            mock.fireFocus();
        });
        fireEvent.click(getKeyboardButton(container));

        expect(blurSpy).toHaveBeenCalled();
        expect(mock.editor.focus).not.toHaveBeenCalled();
    });

    test('starts as pressed when the editor already has text focus', () => {
        isTouchDevice.mockReturnValue(true);
        const { editor } = createEditorMock();
        editor.hasTextFocus.mockReturnValue(true);
        const { container } = renderToolbar({ editorRef: editor });
        expect(getKeyboardButton(container).getAttribute('aria-pressed')).toBe('true');
    });
});
