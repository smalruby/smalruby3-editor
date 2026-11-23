/* eslint-env jest */
// 日本語タブの読むモード・書くモードの切りかえボタン（Issue #2380）。
import '@testing-library/jest-dom';
import { fireEvent, render } from '@testing-library/react';
import React from 'react';
import { IntlProvider } from 'react-intl';
import RubyToolbar from '../../../src/components/ruby-toolbar/ruby-toolbar.jsx';
import ja from '../../../src/locales/ja';

const renderToolbar = (overrides = {}) => {
    const props = {
        locale: 'ja',
        onSelectTarget: jest.fn(),
        onDismissBubble: jest.fn(),
        onToggleReadMode: jest.fn(),
        editorRef: null,
        ...overrides,
    };
    const utils = render(
        <IntlProvider locale="ja" messages={ja}>
            <RubyToolbar {...props} />
        </IntlProvider>,
    );
    return { ...utils, props };
};

const readModeButton = (container) => container.querySelector('[data-testid="ruby-toolbar-read-mode"]');

describe('ruby-toolbar: the read mode toggle', () => {
    test('is shown only in the Japanese tab', () => {
        expect(readModeButton(renderToolbar().container)).toBeNull();
        expect(readModeButton(renderToolbar({ dnclMode: true }).container)).not.toBeNull();
    });

    test('names the read mode in the write mode', () => {
        const button = readModeButton(renderToolbar({ dnclMode: true, readMode: false }).container);
        expect(button).toHaveAttribute('aria-pressed', 'false');
        expect(button).toHaveAttribute('title', '読むモード（行番号と罫線で、問題と同じ形に見せる）');
    });

    test('names the way back to the write mode in the read mode', () => {
        const button = readModeButton(renderToolbar({ dnclMode: true, readMode: true }).container);
        expect(button).toHaveAttribute('aria-pressed', 'true');
        expect(button).toHaveAttribute('title', '書くモードにもどす');
    });

    test('toggles the mode without taking the focus from the editor', () => {
        const { container, props } = renderToolbar({ dnclMode: true });
        const button = readModeButton(container);
        // A press of the mouse would move the focus to the button and blur the editor.
        expect(fireEvent.mouseDown(button)).toBe(false);
        fireEvent.click(button);
        expect(props.onToggleReadMode).toHaveBeenCalledTimes(1);
    });

    test('the copy of the menu is named by the line numbers and the rules', () => {
        const { container } = renderToolbar({ dnclMode: true });
        fireEvent.click(container.querySelector('[data-testid="ruby-toolbar-more-menu"]'));
        expect(container.querySelector('[data-testid="ruby-toolbar-menu-copy-problem-form"]')).toHaveTextContent(
            '行番号と罫線つきでコピー',
        );
    });
});
