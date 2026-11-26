/* eslint-env jest */
// 日本語タブのツールバーとその他メニュー（Issue #2453）: スプライトを選ぶ部品を出さず、
// 「行番号と罫線」のスイッチで読むモードを切りかえ、メニューは日本語タブに合った項目だけにする。
import '@testing-library/jest-dom';
import { fireEvent, render } from '@testing-library/react';
import React from 'react';
import { IntlProvider } from 'react-intl';
import RubyToolbar from '../../../src/components/ruby-toolbar/ruby-toolbar.jsx';
import ja from '../../../src/locales/ja';

jest.mock('../../../src/components/ruby-toolbar/target-selector.jsx', () => {
    const TargetSelector = () => <div data-testid="target-selector" />;
    return TargetSelector;
});

const renderToolbar = (overrides = {}) => {
    const props = {
        locale: 'ja',
        onSelectTarget: jest.fn(),
        onDismissBubble: jest.fn(),
        onToggleReadMode: jest.fn(),
        onDownload: jest.fn(),
        onDownloadJapanese: jest.fn(),
        onPreviewRubyScript: jest.fn(),
        onInsertClass: jest.fn(),
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
const rulesSwitch = (container) => byTestId(container, 'ruby-toolbar-rules');
const openMenu = (container) => fireEvent.click(byTestId(container, 'ruby-toolbar-more-menu'));
const menuTestIds = (container) =>
    Array.from(container.querySelectorAll('[data-testid^="ruby-toolbar-menu-"]')).map((el) =>
        el.getAttribute('data-testid'),
    );

describe('ruby-toolbar: the sprite selector', () => {
    test('is shown in the Ruby tab', () => {
        expect(byTestId(renderToolbar().container, 'target-selector')).not.toBeNull();
    });

    test('is not shown in the Japanese tab', () => {
        expect(byTestId(renderToolbar({ dnclMode: true }).container, 'target-selector')).toBeNull();
    });
});

describe('ruby-toolbar: the switch of the line numbers and the rules', () => {
    test('is shown only in the Japanese tab', () => {
        expect(rulesSwitch(renderToolbar().container)).toBeNull();
        expect(rulesSwitch(renderToolbar({ dnclMode: true }).container)).not.toBeNull();
    });

    test('is a switch named by what it shows', () => {
        const { container } = renderToolbar({ dnclMode: true, readMode: false });
        const sw = rulesSwitch(container);
        expect(sw).toHaveAttribute('role', 'switch');
        expect(sw).toHaveAttribute('aria-checked', 'false');
        expect(sw).toHaveTextContent('行番号と罫線');
        expect(sw).toHaveAttribute('title', ja['gui.rubyToolbar.rulesSwitchTitle']);
    });

    test('is on in the read mode', () => {
        const sw = rulesSwitch(renderToolbar({ dnclMode: true, readMode: true }).container);
        expect(sw).toHaveAttribute('aria-checked', 'true');
    });

    test('toggles the mode without taking the focus from the editor', () => {
        const { container, props } = renderToolbar({ dnclMode: true });
        const sw = rulesSwitch(container);
        // A press of the mouse would move the focus to the switch and blur the editor.
        expect(fireEvent.mouseDown(sw)).toBe(false);
        fireEvent.click(sw);
        expect(props.onToggleReadMode).toHaveBeenCalledTimes(1);
    });

    test('the old read button is gone', () => {
        expect(byTestId(renderToolbar({ dnclMode: true }).container, 'ruby-toolbar-read-mode')).toBeNull();
    });
});

describe('ruby-toolbar: the more menu', () => {
    test('the Ruby tab keeps its items', () => {
        const { container } = renderToolbar();
        openMenu(container);
        expect(menuTestIds(container)).toEqual([
            'ruby-toolbar-menu-download',
            'ruby-toolbar-menu-insert-class',
            'ruby-toolbar-menu-preview',
            'ruby-toolbar-menu-auto-correct-settings',
        ]);
        expect(byTestId(container, 'ruby-toolbar-menu-preview')).toHaveTextContent('ルビースクリプトを確認');
    });

    test('the Japanese tab has the items for the Japanese program only', () => {
        const { container } = renderToolbar({ dnclMode: true });
        openMenu(container);
        expect(menuTestIds(container)).toEqual([
            'ruby-toolbar-menu-copy-problem-form',
            'ruby-toolbar-menu-preview',
            'ruby-toolbar-menu-download-japanese',
            'ruby-toolbar-menu-settings-heading',
            'ruby-toolbar-menu-settings-pattern-example',
            'ruby-toolbar-menu-settings-pattern-index-from-one',
            'ruby-toolbar-menu-auto-correct-settings',
        ]);
    });

    test('the Japanese tab names its items for the Japanese program', () => {
        const { container } = renderToolbar({ dnclMode: true });
        openMenu(container);
        expect(byTestId(container, 'ruby-toolbar-menu-copy-problem-form')).toHaveTextContent(
            '行番号と罫線つきでコピー',
        );
        expect(byTestId(container, 'ruby-toolbar-menu-preview')).toHaveTextContent('ルビーに直したものを確認');
        expect(byTestId(container, 'ruby-toolbar-menu-download-japanese')).toHaveTextContent(
            '日本語のプログラムを保存（.txt）',
        );
        expect(byTestId(container, 'ruby-toolbar-menu-settings-heading')).toHaveTextContent('問題の約束');
        expect(byTestId(container, 'ruby-toolbar-menu-settings-pattern-example')).not.toHaveTextContent('設定');
    });

    test('saving the Japanese program calls its handler and closes the menu', () => {
        const { container, props } = renderToolbar({ dnclMode: true });
        openMenu(container);
        fireEvent.click(byTestId(container, 'ruby-toolbar-menu-download-japanese'));
        expect(props.onDownloadJapanese).toHaveBeenCalledTimes(1);
        expect(props.onDownload).not.toHaveBeenCalled();
        expect(byTestId(container, 'ruby-toolbar-menu-download-japanese')).toBeNull();
    });
});
