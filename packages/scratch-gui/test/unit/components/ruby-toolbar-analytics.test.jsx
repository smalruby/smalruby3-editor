/* eslint-env jest */
import '@testing-library/jest-dom';
import { render, fireEvent } from '@testing-library/react';
import React from 'react';
import { IntlProvider } from 'react-intl';
import RubyToolbar from '../../../src/components/ruby-toolbar/ruby-toolbar.jsx';
import analytics from '../../../src/lib/analytics';

jest.mock('../../../src/lib/analytics', () => ({
    __esModule: true,
    default: {
        event: jest.fn(),
    },
}));

const renderToolbar = (overrides = {}) => {
    const defaultProps = {
        locale: 'ja',
        rubyVersion: 2,
        onChangeRubyVersion: jest.fn(),
        executing: false,
        canExecute: true,
        onToggleExecute: jest.fn(),
        canUndo: false,
        canRedo: false,
        onUndo: jest.fn(),
        onRedo: jest.fn(),
        editorRef: null,
        autoCorrectEnabled: false,
        onToggleAutoCorrect: jest.fn(),
        onOpenAutoCorrectSettings: jest.fn(),
        autoCorrectShowEffects: false,
        onDownload: jest.fn(),
        onInsertClass: jest.fn(),
        onPreviewRubyScript: jest.fn(),
        onDismissBubble: jest.fn(),
        onOpenRubyteeModal: jest.fn(),
        rubyteeBusy: false,
        // Mode-related props - the fields actually exercised by analytics
        furiganaEnabled: false,
        dnclMode: false,
        onToggleFurigana: jest.fn(),
        onToggleDnclMode: jest.fn(),
        // Sprite selector props
        targets: [],
        editingTargetId: null,
        onSelectTarget: jest.fn(),
        onSelectSprite: jest.fn(),
        ...overrides,
    };
    return render(
        <IntlProvider locale="ja" messages={{}}>
            <RubyToolbar {...defaultProps} />
        </IntlProvider>,
    );
};

describe('ruby-toolbar analytics events', () => {
    beforeEach(() => {
        analytics.event.mockClear();
    });

    test('mode_switch fires with label "furigana" when ふりがなモードボタンをクリック', () => {
        const { container } = renderToolbar({ furiganaEnabled: false, dnclMode: false });
        const button = container.querySelector('[data-testid="ruby-toolbar-mode-furigana"]');
        expect(button).toBeTruthy();
        fireEvent.click(button);
        expect(analytics.event).toHaveBeenCalledWith({
            category: 'mode_switch',
            action: 'change',
            label: 'furigana',
        });
    });

    test('mode_switch fires with label "ruby" when Ruby モードボタンをクリック', () => {
        const { container } = renderToolbar({ furiganaEnabled: true, dnclMode: false });
        const button = container.querySelector('[data-testid="ruby-toolbar-mode-ruby"]');
        expect(button).toBeTruthy();
        fireEvent.click(button);
        expect(analytics.event).toHaveBeenCalledWith({
            category: 'mode_switch',
            action: 'change',
            label: 'ruby',
        });
    });

    test('mode_switch fires with label "dncl" when DNCL モードボタンをクリック', () => {
        const { container } = renderToolbar({ furiganaEnabled: false, dnclMode: false });
        const button = container.querySelector('[data-testid="ruby-toolbar-mode-dncl"]');
        expect(button).toBeTruthy();
        fireEvent.click(button);
        expect(analytics.event).toHaveBeenCalledWith({
            category: 'mode_switch',
            action: 'change',
            label: 'dncl',
        });
    });

    test('furigana_toggle fires "on" when ふりがなモード切替で OFF→ON 遷移', () => {
        const { container } = renderToolbar({ furiganaEnabled: false, dnclMode: false });
        fireEvent.click(container.querySelector('[data-testid="ruby-toolbar-mode-furigana"]'));
        expect(analytics.event).toHaveBeenCalledWith({
            category: 'furigana_toggle',
            action: 'toggle',
            label: 'on',
        });
    });

    test('furigana_toggle fires "off" when Ruby モード切替で ON→OFF 遷移', () => {
        const { container } = renderToolbar({ furiganaEnabled: true, dnclMode: false });
        fireEvent.click(container.querySelector('[data-testid="ruby-toolbar-mode-ruby"]'));
        expect(analytics.event).toHaveBeenCalledWith({
            category: 'furigana_toggle',
            action: 'toggle',
            label: 'off',
        });
    });

    test('furigana_toggle does NOT fire when ふりがなが既に ON で同じモードに切替', () => {
        const { container } = renderToolbar({ furiganaEnabled: true, dnclMode: false });
        fireEvent.click(container.querySelector('[data-testid="ruby-toolbar-mode-furigana"]'));
        const furiganaToggleCalls = analytics.event.mock.calls.filter(
            (c) => c[0] && c[0].category === 'furigana_toggle',
        );
        expect(furiganaToggleCalls).toHaveLength(0);
    });

    test('analytics failure is swallowed and does not break click handler', () => {
        analytics.event.mockImplementationOnce(() => {
            throw new Error('GA failed');
        });
        const onToggleFurigana = jest.fn();
        const { container } = renderToolbar({
            furiganaEnabled: false,
            dnclMode: false,
            onToggleFurigana,
        });
        // Should not throw
        expect(() => {
            fireEvent.click(container.querySelector('[data-testid="ruby-toolbar-mode-furigana"]'));
        }).not.toThrow();
        // The actual mode switch should still happen
        expect(onToggleFurigana).toHaveBeenCalled();
    });
});
