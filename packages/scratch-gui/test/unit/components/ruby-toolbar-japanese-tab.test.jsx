/* eslint-env jest */
// 日本語はルビータブのモードではなく日本語タブ（docs/dncl/design.md 1 章）。ツールバーには
// 「日本語」ボタンが無く、ふりがな・Ruby の 2 つはルビータブだけに出る。
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
        onToggleFurigana: jest.fn(),
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

const byTestId = (container, id) => container.querySelector(`[data-testid="${id}"]`);

describe('ruby-toolbar: Japanese is the Japanese tab', () => {
    test('the Ruby tab has the furigana and Ruby buttons and no Japanese button', () => {
        const { container } = renderToolbar();
        expect(byTestId(container, 'ruby-toolbar-mode-furigana')).toBeInTheDocument();
        expect(byTestId(container, 'ruby-toolbar-mode-ruby')).toBeInTheDocument();
        expect(byTestId(container, 'ruby-toolbar-mode-dncl')).toBeNull();
    });

    test('the Japanese tab shows neither furigana nor Ruby', () => {
        const { container } = renderToolbar({ dnclMode: true });
        expect(byTestId(container, 'ruby-toolbar-mode-furigana')).toBeNull();
        expect(byTestId(container, 'ruby-toolbar-mode-ruby')).toBeNull();
    });

    test('the furigana button only turns furigana on', () => {
        const { container, props } = renderToolbar({ furiganaEnabled: false });
        fireEvent.click(byTestId(container, 'ruby-toolbar-mode-furigana'));
        expect(props.onToggleFurigana).toHaveBeenCalledTimes(1);
    });

    test('the buttons wait while the program is being checked for the Japanese tab', () => {
        const { container } = renderToolbar({ dnclValidating: true });
        expect(byTestId(container, 'ruby-toolbar-mode-furigana')).toBeDisabled();
        expect(byTestId(container, 'ruby-toolbar-mode-ruby')).toBeDisabled();
    });
});
