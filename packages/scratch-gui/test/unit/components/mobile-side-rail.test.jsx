/* eslint-env jest */
import '@testing-library/jest-dom';
import { fireEvent, render } from '@testing-library/react';
import React from 'react';
import { IntlProvider } from 'react-intl';
import { MobileSideRailComponent } from '../../../src/components/mobile-side-rail/mobile-side-rail.jsx';
import {
    BLOCKS_TAB_INDEX,
    COSTUMES_TAB_INDEX,
    JAPANESE_TAB_INDEX,
    RUBY_TAB_INDEX,
    SOUNDS_TAB_INDEX,
} from '../../../src/reducers/editor-tab.js';

const makeFakeVm = () => ({
    start: jest.fn(),
    greenFlag: jest.fn(),
    stopAll: jest.fn(),
});

const baseProps = (override) => ({
    vm: makeFakeVm(),
    isFullScreen: false,
    isStarted: false,
    activeTabIndex: BLOCKS_TAB_INDEX,
    spriteTabActive: false,
    onSetFullScreen: jest.fn(),
    onActivateTab: jest.fn(),
    onOpenDrawer: jest.fn(),
    onSpriteTabActiveChange: jest.fn(),
    backpackOpen: false,
    onToggleBackpack: jest.fn(),
    ...override,
});

const renderWithIntl = (props) => {
    const merged = baseProps(props);
    return {
        ...render(
            <IntlProvider locale="en" messages={{}}>
                <MobileSideRailComponent {...merged} />
            </IntlProvider>,
        ),
        props: merged,
    };
};

describe('MobileSideRail', () => {
    test('renders rail + 5 tabs + menu + play buttons', () => {
        const { getByTestId } = renderWithIntl();
        expect(getByTestId('mobile-side-rail')).toBeInTheDocument();
        expect(getByTestId('mobile-side-rail-menu')).toBeInTheDocument();
        expect(getByTestId('mobile-side-rail-play')).toBeInTheDocument();
        expect(getByTestId('mobile-side-rail-sprite')).toBeInTheDocument();
        expect(getByTestId('mobile-side-rail-code')).toBeInTheDocument();
        expect(getByTestId('mobile-side-rail-costume')).toBeInTheDocument();
        expect(getByTestId('mobile-side-rail-sound')).toBeInTheDocument();
        expect(getByTestId('mobile-side-rail-ruby')).toBeInTheDocument();
    });

    test('clicking ☰ calls onOpenDrawer', () => {
        const { getByTestId, props } = renderWithIntl();
        fireEvent.click(getByTestId('mobile-side-rail-menu'));
        expect(props.onOpenDrawer).toHaveBeenCalledTimes(1);
    });

    test('clicking ▶ when not fullscreen activates fullscreen + vm.start + greenFlag', () => {
        const { getByTestId, props } = renderWithIntl();
        fireEvent.click(getByTestId('mobile-side-rail-play'));
        expect(props.onSetFullScreen).toHaveBeenCalledWith(true);
        expect(props.vm.start).toHaveBeenCalledTimes(1);
        expect(props.vm.greenFlag).toHaveBeenCalledTimes(1);
        expect(props.vm.stopAll).not.toHaveBeenCalled();
    });

    test('clicking ⏹ when fullscreen exits and stops vm', () => {
        const { getByTestId, props } = renderWithIntl({ isFullScreen: true, isStarted: true });
        expect(getByTestId('mobile-side-rail-play')).toHaveAttribute('aria-label', 'stop');
        fireEvent.click(getByTestId('mobile-side-rail-play'));
        expect(props.vm.stopAll).toHaveBeenCalledTimes(1);
        expect(props.onSetFullScreen).toHaveBeenCalledWith(false);
        expect(props.vm.greenFlag).not.toHaveBeenCalled();
    });

    test.each([
        ['code', BLOCKS_TAB_INDEX],
        ['costume', COSTUMES_TAB_INDEX],
        ['sound', SOUNDS_TAB_INDEX],
        ['ruby', RUBY_TAB_INDEX],
    ])('clicking %s tab calls activateTab with the matching index', (key, expectedIndex) => {
        const { getByTestId, props } = renderWithIntl({ activeTabIndex: BLOCKS_TAB_INDEX });
        fireEvent.click(getByTestId(`mobile-side-rail-${key}`));
        expect(props.onActivateTab).toHaveBeenCalledWith(expectedIndex);
        expect(props.onSpriteTabActiveChange).toHaveBeenCalledWith(false);
    });

    test('clicking sprite tab triggers onSpriteTabActiveChange(true) without dispatching activateTab', () => {
        const { getByTestId, props } = renderWithIntl();
        fireEvent.click(getByTestId('mobile-side-rail-sprite'));
        expect(props.onSpriteTabActiveChange).toHaveBeenCalledWith(true);
        expect(props.onActivateTab).not.toHaveBeenCalled();
    });

    test('marks the sprite tab data-active=true when spriteTabActive prop is true', () => {
        const { getByTestId } = renderWithIntl({ spriteTabActive: true });
        expect(getByTestId('mobile-side-rail-sprite')).toHaveAttribute('data-active', 'true');
        expect(getByTestId('mobile-side-rail-code')).toHaveAttribute('data-active', 'false');
    });

    test('marks the editor tab as active per activeTabIndex', () => {
        const { getByTestId } = renderWithIntl({ activeTabIndex: RUBY_TAB_INDEX });
        expect(getByTestId('mobile-side-rail-ruby')).toHaveAttribute('data-active', 'true');
        expect(getByTestId('mobile-side-rail-code')).toHaveAttribute('data-active', 'false');
    });

    test('renders backpack toggle button', () => {
        const { getByTestId } = renderWithIntl();
        expect(getByTestId('mobile-side-rail-backpack')).toBeInTheDocument();
        expect(getByTestId('mobile-side-rail-backpack')).toHaveAttribute('data-active', 'false');
        expect(getByTestId('mobile-side-rail-backpack')).toHaveAttribute('aria-pressed', 'false');
    });

    test('clicking backpack toggle calls onToggleBackpack', () => {
        const { getByTestId, props } = renderWithIntl();
        fireEvent.click(getByTestId('mobile-side-rail-backpack'));
        expect(props.onToggleBackpack).toHaveBeenCalledTimes(1);
    });

    test('marks backpack toggle data-active=true when backpackOpen prop is true', () => {
        const { getByTestId } = renderWithIntl({ backpackOpen: true });
        expect(getByTestId('mobile-side-rail-backpack')).toHaveAttribute('data-active', 'true');
        expect(getByTestId('mobile-side-rail-backpack')).toHaveAttribute('aria-pressed', 'true');
    });
});

// #1835: スマホでは「提出する」が ☰ のドロワーの中なので、吹き出しを出す時は ☰ に点を出す。
describe('MobileSideRail — 「提出しよう」の点', () => {
    test('出す時は ☰ に点を出す', () => {
        const { getByTestId } = renderWithIntl({ submitReminderDue: true });
        expect(getByTestId('mobile-side-rail-menu')).toContainElement(getByTestId('mobile-side-rail-menu-dot'));
    });

    test('出す時でなければ点を出さない', () => {
        const { queryByTestId } = renderWithIntl();
        expect(queryByTestId('mobile-side-rail-menu-dot')).toBeNull();
    });
});

// 日本語タブ（docs/dncl/design.md 1 章）: 日本語の表示のときだけ、ルビーの次に出す
describe('MobileSideRail — 日本語タブ', () => {
    test('日本語の表示でなければ出さない', () => {
        const { queryByTestId } = renderWithIntl();
        expect(queryByTestId('mobile-side-rail-japanese')).toBeNull();
    });

    test('日本語の表示ならルビーの次に出し、押すと日本語タブにする', () => {
        const { getByTestId, props } = renderWithIntl({ japaneseTabAvailable: true });
        const japanese = getByTestId('mobile-side-rail-japanese');
        expect(getByTestId('mobile-side-rail-ruby').nextElementSibling).toBe(japanese);
        fireEvent.click(japanese);
        expect(props.onActivateTab).toHaveBeenCalledWith(JAPANESE_TAB_INDEX);
    });

    test('日本語を使わないレッスンでは押せない', () => {
        const { getByTestId, props } = renderWithIntl({ japaneseTabAvailable: true, japaneseTabLocked: true });
        const japanese = getByTestId('mobile-side-rail-japanese');
        expect(japanese).toBeDisabled();
        fireEvent.click(japanese);
        expect(props.onActivateTab).not.toHaveBeenCalled();
    });

    test('日本語タブのあいだは日本語が選ばれて見える', () => {
        const { getByTestId } = renderWithIntl({ japaneseTabAvailable: true, activeTabIndex: JAPANESE_TAB_INDEX });
        expect(getByTestId('mobile-side-rail-japanese')).toHaveAttribute('data-active', 'true');
        expect(getByTestId('mobile-side-rail-ruby')).toHaveAttribute('data-active', 'false');
    });
});
