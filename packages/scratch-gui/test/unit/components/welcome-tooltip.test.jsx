/* eslint-env jest */
import '@testing-library/jest-dom';
import { fireEvent, render } from '@testing-library/react';
import React from 'react';
import { IntlProvider } from 'react-intl';
import WelcomeTooltip, {
    FIVE_DAYS_MS,
    STORAGE_KEY_DISMISSED,
    STORAGE_KEY_FIRST_SHOWN_AT,
    computeInitialVisibility,
} from '../../../src/components/welcome-tooltip/welcome-tooltip.jsx';

const renderTooltip = (props) =>
    render(
        <IntlProvider locale="en">
            <WelcomeTooltip {...props} />
        </IntlProvider>,
    );

describe('WelcomeTooltip', () => {
    beforeEach(() => {
        localStorage.clear();
    });

    test('renders on first visit and records firstShownAt', () => {
        const { queryByTestId } = renderTooltip({ onClick: jest.fn() });
        expect(queryByTestId('welcome-tooltip')).toBeInTheDocument();
        expect(localStorage.getItem(STORAGE_KEY_FIRST_SHOWN_AT)).toBeTruthy();
    });

    test('does not render after dismissed', () => {
        localStorage.setItem(STORAGE_KEY_DISMISSED, 'true');
        const { queryByTestId } = renderTooltip({ onClick: jest.fn() });
        expect(queryByTestId('welcome-tooltip')).not.toBeInTheDocument();
    });

    test('does not render after 5 days from first show', () => {
        const sixDaysAgo = Date.now() - 6 * 24 * 60 * 60 * 1000;
        localStorage.setItem(STORAGE_KEY_FIRST_SHOWN_AT, String(sixDaysAgo));
        const { queryByTestId } = renderTooltip({ onClick: jest.fn() });
        expect(queryByTestId('welcome-tooltip')).not.toBeInTheDocument();
        expect(localStorage.getItem(STORAGE_KEY_DISMISSED)).toBe('true');
    });

    test('still renders within 5 days from first show', () => {
        const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
        localStorage.setItem(STORAGE_KEY_FIRST_SHOWN_AT, String(oneDayAgo));
        const { queryByTestId } = renderTooltip({ onClick: jest.fn() });
        expect(queryByTestId('welcome-tooltip')).toBeInTheDocument();
    });

    test('clicking the balloon dispatches onClick and dismisses', () => {
        const onClick = jest.fn();
        const { getByTestId, queryByTestId } = renderTooltip({ onClick });
        fireEvent.click(getByTestId('welcome-tooltip').querySelector('[role="button"]'));
        expect(onClick).toHaveBeenCalledTimes(1);
        expect(localStorage.getItem(STORAGE_KEY_DISMISSED)).toBe('true');
        expect(queryByTestId('welcome-tooltip')).not.toBeInTheDocument();
    });

    test('clicking close button dismisses without firing onClick', () => {
        const onClick = jest.fn();
        const { getByTestId, queryByTestId } = renderTooltip({ onClick });
        fireEvent.click(getByTestId('welcome-tooltip-close'));
        expect(onClick).not.toHaveBeenCalled();
        expect(localStorage.getItem(STORAGE_KEY_DISMISSED)).toBe('true');
        expect(queryByTestId('welcome-tooltip')).not.toBeInTheDocument();
    });

    describe('computeInitialVisibility', () => {
        test('returns true and records timestamp on first call', () => {
            const now = 1700000000000;
            expect(computeInitialVisibility(now)).toBe(true);
            expect(localStorage.getItem(STORAGE_KEY_FIRST_SHOWN_AT)).toBe(String(now));
        });

        test('returns false if dismissed flag is set', () => {
            localStorage.setItem(STORAGE_KEY_DISMISSED, 'true');
            expect(computeInitialVisibility()).toBe(false);
        });

        test('returns false and sets dismissed when over 5 days', () => {
            const now = Date.now();
            localStorage.setItem(STORAGE_KEY_FIRST_SHOWN_AT, String(now - FIVE_DAYS_MS - 1));
            expect(computeInitialVisibility(now)).toBe(false);
            expect(localStorage.getItem(STORAGE_KEY_DISMISSED)).toBe('true');
        });
    });
});
