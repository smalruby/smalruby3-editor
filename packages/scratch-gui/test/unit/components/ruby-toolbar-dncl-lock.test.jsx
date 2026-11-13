/* eslint-env jest */
// レッスンが日本語モードを許していないあいだ、「日本語」ボタンを押せないこと（#1741）
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
        onToggleDnclMode: jest.fn(),
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

const getDnclButton = (container) => container.querySelector('[data-testid="ruby-toolbar-mode-dncl"]');

describe('ruby-toolbar Japanese (DNCL) mode lock', () => {
    test('the Japanese mode button can be pressed when it is not locked', () => {
        const { container, props } = renderToolbar();
        const button = getDnclButton(container);
        expect(button).not.toBeDisabled();
        expect(button.getAttribute('title')).toBe(ja['gui.rubyToolbar.modeDncl']);
        fireEvent.click(button);
        expect(props.onToggleDnclMode).toHaveBeenCalledTimes(1);
    });

    test('the Japanese mode button cannot be pressed while it is locked', () => {
        const { container, props } = renderToolbar({ dnclModeLocked: true });
        const button = getDnclButton(container);
        expect(button).toBeDisabled();
        fireEvent.click(button);
        expect(props.onToggleDnclMode).not.toHaveBeenCalled();
    });

    test('the locked button tells why it cannot be pressed', () => {
        const { container } = renderToolbar({ dnclModeLocked: true });
        expect(getDnclButton(container).getAttribute('title')).toBe(ja['gui.rubyToolbar.modeDnclLockedInLesson']);
    });

    test('the lock leaves the furigana and Ruby buttons alone', () => {
        const { container } = renderToolbar({ dnclModeLocked: true });
        expect(container.querySelector('[data-testid="ruby-toolbar-mode-furigana"]')).not.toBeDisabled();
        expect(container.querySelector('[data-testid="ruby-toolbar-mode-ruby"]')).not.toBeDisabled();
    });
});
