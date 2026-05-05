/* eslint-env jest */
import '@testing-library/jest-dom';
import { fireEvent, render } from '@testing-library/react';
import React, { useState } from 'react';
import { IntlProvider } from 'react-intl';
import { MobileBottomTabsComponent } from '../../../src/components/mobile-bottom-tabs/mobile-bottom-tabs.jsx';
import {
    BLOCKS_TAB_INDEX,
    COSTUMES_TAB_INDEX,
    RUBY_TAB_INDEX,
    SOUNDS_TAB_INDEX,
} from '../../../src/reducers/editor-tab.js';

const renderWithIntl = (ui) =>
    render(
        <IntlProvider locale="en" messages={{}}>
            {ui}
        </IntlProvider>,
    );

const baseProps = (override) => ({
    isFullScreen: false,
    activeTabIndex: BLOCKS_TAB_INDEX,
    spriteTabActive: false,
    onSpriteTabActiveChange: () => {},
    onActivateTab: () => {},
    ...override,
});

/**
 * 親コンポーネントが持つ spriteTabActive を useState で再現する controlled
 * wrapper。Phase 2-F でこの状態が MobileGui に持ち上がったため、テストでも
 * 親側で保持して挙動を検証する。
 * @param {object} props - test props
 * @returns {JSX.Element} controlled wrapper
 */
const ControlledTabs = (props) => {
    const [spriteTabActive, setSpriteTabActive] = useState(false);
    return (
        <MobileBottomTabsComponent
            {...props}
            spriteTabActive={spriteTabActive}
            onSpriteTabActiveChange={setSpriteTabActive}
        />
    );
};

describe('MobileBottomTabs', () => {
    test('renders 5 tabs', () => {
        const { getByTestId } = renderWithIntl(<MobileBottomTabsComponent {...baseProps()} />);
        expect(getByTestId('mobile-bottom-tabs-code')).toBeInTheDocument();
        expect(getByTestId('mobile-bottom-tabs-ruby')).toBeInTheDocument();
        expect(getByTestId('mobile-bottom-tabs-sprite')).toBeInTheDocument();
        expect(getByTestId('mobile-bottom-tabs-costume')).toBeInTheDocument();
        expect(getByTestId('mobile-bottom-tabs-sound')).toBeInTheDocument();
    });

    test('marks the block tab active when activeTabIndex is BLOCKS', () => {
        const { getByTestId } = renderWithIntl(<MobileBottomTabsComponent {...baseProps()} />);
        expect(getByTestId('mobile-bottom-tabs-code')).toHaveAttribute('data-active', 'true');
        expect(getByTestId('mobile-bottom-tabs-ruby')).toHaveAttribute('data-active', 'false');
    });

    test.each([
        ['ruby', RUBY_TAB_INDEX],
        ['costume', COSTUMES_TAB_INDEX],
        ['sound', SOUNDS_TAB_INDEX],
    ])('dispatches activateTab(%s) for the matching tab', (key, expectedIndex) => {
        const onActivate = jest.fn();
        const { getByTestId } = renderWithIntl(
            <MobileBottomTabsComponent {...baseProps({ onActivateTab: onActivate })} />,
        );
        fireEvent.click(getByTestId(`mobile-bottom-tabs-${key}`));
        expect(onActivate).toHaveBeenCalledWith(expectedIndex);
    });

    test('block tab dispatches activateTab(BLOCKS_TAB_INDEX)', () => {
        const onActivate = jest.fn();
        const { getByTestId } = renderWithIntl(
            <MobileBottomTabsComponent
                {...baseProps({ onActivateTab: onActivate, activeTabIndex: RUBY_TAB_INDEX })}
            />,
        );
        fireEvent.click(getByTestId('mobile-bottom-tabs-code'));
        expect(onActivate).toHaveBeenCalledWith(BLOCKS_TAB_INDEX);
    });

    test('clicking sprite tab calls onSpriteTabActiveChange(true) and does NOT dispatch activateTab', () => {
        const onActivate = jest.fn();
        const onSpriteTabActiveChange = jest.fn();
        const { getByTestId } = renderWithIntl(
            <MobileBottomTabsComponent {...baseProps({ onActivateTab: onActivate, onSpriteTabActiveChange })} />,
        );
        fireEvent.click(getByTestId('mobile-bottom-tabs-sprite'));
        expect(onSpriteTabActiveChange).toHaveBeenCalledWith(true);
        expect(onActivate).not.toHaveBeenCalled();
    });

    test('clicking another tab calls onSpriteTabActiveChange(false)', () => {
        const onActivate = jest.fn();
        const onSpriteTabActiveChange = jest.fn();
        const { getByTestId } = renderWithIntl(
            <MobileBottomTabsComponent
                {...baseProps({
                    onActivateTab: onActivate,
                    onSpriteTabActiveChange,
                    spriteTabActive: true,
                })}
            />,
        );
        fireEvent.click(getByTestId('mobile-bottom-tabs-ruby'));
        expect(onSpriteTabActiveChange).toHaveBeenCalledWith(false);
        expect(onActivate).toHaveBeenCalledWith(RUBY_TAB_INDEX);
    });

    test('sprite tab is data-active=true when spriteTabActive prop is true', () => {
        const { getByTestId } = renderWithIntl(
            <MobileBottomTabsComponent {...baseProps({ spriteTabActive: true })} />,
        );
        expect(getByTestId('mobile-bottom-tabs-sprite')).toHaveAttribute('data-active', 'true');
        // editorTab-driven tabs are visually inactive while sprite is the focus
        expect(getByTestId('mobile-bottom-tabs-code')).toHaveAttribute('data-active', 'false');
    });

    test('controlled wrapper toggles sprite tab on click and clears on other tab click', () => {
        const { getByTestId } = renderWithIntl(<ControlledTabs {...baseProps()} />);
        fireEvent.click(getByTestId('mobile-bottom-tabs-sprite'));
        expect(getByTestId('mobile-bottom-tabs-sprite')).toHaveAttribute('data-active', 'true');
        fireEvent.click(getByTestId('mobile-bottom-tabs-ruby'));
        expect(getByTestId('mobile-bottom-tabs-sprite')).toHaveAttribute('data-active', 'false');
    });
});
