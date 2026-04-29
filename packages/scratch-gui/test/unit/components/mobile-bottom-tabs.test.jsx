/* eslint-env jest */
import React from 'react';
import { IntlProvider } from 'react-intl';
import '@testing-library/jest-dom';
import { fireEvent, render } from '@testing-library/react';
import { MobileBottomTabsComponent } from '../../../src/components/mobile-bottom-tabs/mobile-bottom-tabs.jsx';
import {
    BLOCKS_TAB_INDEX,
    COSTUMES_TAB_INDEX,
    RUBY_TAB_INDEX,
    SOUNDS_TAB_INDEX,
} from '../../../src/reducers/editor-tab.js';

const renderWithIntl = ui =>
    render(
        <IntlProvider locale="en" messages={{}}>
            {ui}
        </IntlProvider>,
    );

describe('MobileBottomTabs', () => {
    test('renders 5 tabs', () => {
        const { getByTestId } = renderWithIntl(
            <MobileBottomTabsComponent
                isFullScreen={false}
                activeTabIndex={BLOCKS_TAB_INDEX}
                onActivateTab={() => {}}
            />,
        );
        expect(getByTestId('mobile-bottom-tabs-code')).toBeInTheDocument();
        expect(getByTestId('mobile-bottom-tabs-ruby')).toBeInTheDocument();
        expect(getByTestId('mobile-bottom-tabs-sprite')).toBeInTheDocument();
        expect(getByTestId('mobile-bottom-tabs-costume')).toBeInTheDocument();
        expect(getByTestId('mobile-bottom-tabs-sound')).toBeInTheDocument();
    });

    test('marks the block tab active when activeTabIndex is BLOCKS', () => {
        const { getByTestId } = renderWithIntl(
            <MobileBottomTabsComponent
                isFullScreen={false}
                activeTabIndex={BLOCKS_TAB_INDEX}
                onActivateTab={() => {}}
            />,
        );
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
            <MobileBottomTabsComponent
                isFullScreen={false}
                activeTabIndex={BLOCKS_TAB_INDEX}
                onActivateTab={onActivate}
            />,
        );
        fireEvent.click(getByTestId(`mobile-bottom-tabs-${key}`));
        expect(onActivate).toHaveBeenCalledWith(expectedIndex);
    });

    test('block tab dispatches activateTab(BLOCKS_TAB_INDEX)', () => {
        const onActivate = jest.fn();
        const { getByTestId } = renderWithIntl(
            <MobileBottomTabsComponent
                isFullScreen={false}
                activeTabIndex={RUBY_TAB_INDEX}
                onActivateTab={onActivate}
            />,
        );
        fireEvent.click(getByTestId('mobile-bottom-tabs-code'));
        expect(onActivate).toHaveBeenCalledWith(BLOCKS_TAB_INDEX);
    });

    test('sprite tab does NOT dispatch activateTab and shows local active state', () => {
        const onActivate = jest.fn();
        const { getByTestId } = renderWithIntl(
            <MobileBottomTabsComponent
                isFullScreen={false}
                activeTabIndex={BLOCKS_TAB_INDEX}
                onActivateTab={onActivate}
            />,
        );
        // pre: block tab active
        expect(getByTestId('mobile-bottom-tabs-code')).toHaveAttribute('data-active', 'true');
        fireEvent.click(getByTestId('mobile-bottom-tabs-sprite'));
        expect(onActivate).not.toHaveBeenCalled();
        expect(getByTestId('mobile-bottom-tabs-sprite')).toHaveAttribute('data-active', 'true');
        // block is no longer "active" in the bottom-tabs UI while sprite is selected
        expect(getByTestId('mobile-bottom-tabs-code')).toHaveAttribute('data-active', 'false');
    });

    test('clicking another tab clears the sprite local active state', () => {
        const onActivate = jest.fn();
        const { getByTestId } = renderWithIntl(
            <MobileBottomTabsComponent
                isFullScreen={false}
                activeTabIndex={BLOCKS_TAB_INDEX}
                onActivateTab={onActivate}
            />,
        );
        fireEvent.click(getByTestId('mobile-bottom-tabs-sprite'));
        expect(getByTestId('mobile-bottom-tabs-sprite')).toHaveAttribute('data-active', 'true');
        fireEvent.click(getByTestId('mobile-bottom-tabs-ruby'));
        expect(getByTestId('mobile-bottom-tabs-sprite')).toHaveAttribute('data-active', 'false');
        // ruby tab is now active per the activeTabIndex prop... but our prop is still BLOCKS,
        // so visually the ruby tab is NOT active either (until parent re-renders with RUBY_TAB_INDEX).
        // Re-render with RUBY_TAB_INDEX to simulate Redux state having changed.
    });
});
