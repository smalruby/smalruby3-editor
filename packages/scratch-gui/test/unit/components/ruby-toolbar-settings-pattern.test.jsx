/* eslint-env jest */
// 日本語モードのメニューで、よくある設定のパターンを選べること（#1757、docs/dncl/design.md 4 章）
import '@testing-library/jest-dom';
import { fireEvent, render } from '@testing-library/react';
import React from 'react';
import { IntlProvider } from 'react-intl';
import RubyToolbar from '../../../src/components/ruby-toolbar/ruby-toolbar.jsx';
import ja from '../../../src/locales/ja';

const INDEX_FROM_ONE = [
    '# すべての配列の添字は 1 から始まる。',
    '# 「and」は「かつ」を意味する論理演算子であり，左右の式がともに真のときにだけ真となる。',
    '# 「or」は「または」を意味する論理演算子であり，左右の式の少なくとも一方が真のときに真となる。',
    '# 「not」は「でない」を意味する論理演算子であり，右の式が偽のときにだけ真となる。',
    'A = [1]',
].join('\n');

const renderToolbar = (overrides = {}) => {
    const props = {
        locale: 'ja',
        onSelectTarget: jest.fn(),
        onDismissBubble: jest.fn(),
        onSelectSettingsPattern: jest.fn(),
        dnclMode: true,
        editorRef: { getValue: () => 'A = [1]' },
        ...overrides,
    };
    const utils = render(
        <IntlProvider locale="ja" messages={ja}>
            <RubyToolbar {...props} />
        </IntlProvider>,
    );
    fireEvent.click(utils.container.querySelector('[data-testid="ruby-toolbar-more-menu"]'));
    return { ...utils, props };
};

const item = (container, id) => container.querySelector(`[data-testid="ruby-toolbar-menu-settings-pattern-${id}"]`);

describe('ruby-toolbar settings patterns of the Japanese mode', () => {
    test('the menu has the two patterns in the Japanese mode', () => {
        const { container } = renderToolbar();
        expect(item(container, 'example')).toHaveTextContent(ja['gui.rubyToolbar.settingsPatternExample']);
        expect(item(container, 'index-from-one')).toHaveTextContent(
            ja['gui.rubyToolbar.settingsPatternIndexFromOne'],
        );
    });

    test('the menu has no pattern out of the Japanese mode', () => {
        const { container } = renderToolbar({ dnclMode: false });
        expect(item(container, 'example')).toBeNull();
        expect(item(container, 'index-from-one')).toBeNull();
    });

    test('the pattern the program is written by is checked', () => {
        const { container } = renderToolbar({ editorRef: { getValue: () => INDEX_FROM_ONE } });
        expect(item(container, 'index-from-one')).toHaveAttribute('aria-checked', 'true');
        expect(item(container, 'example')).toHaveAttribute('aria-checked', 'false');
    });

    test('a program with no sentence is the form of 例示', () => {
        const { container } = renderToolbar();
        expect(item(container, 'example')).toHaveAttribute('aria-checked', 'true');
    });

    test.each([
        ['example', 'example'],
        ['index-from-one', 'indexFromOne'],
    ])('picking %s tells the pattern and closes the menu', (testId, patternId) => {
        const { container, props } = renderToolbar();
        fireEvent.click(item(container, testId));
        expect(props.onSelectSettingsPattern).toHaveBeenCalledWith(patternId);
        expect(item(container, 'example')).toBeNull();
    });
});
