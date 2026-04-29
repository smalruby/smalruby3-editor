/* eslint-env jest */
import React from 'react';
import { IntlProvider } from 'react-intl';
import '@testing-library/jest-dom';
import { act, fireEvent, render } from '@testing-library/react';
import NarrowScreenWarning from '../../../src/components/narrow-screen-warning/narrow-screen-warning.jsx';

const STORAGE_KEY = 'smalruby:narrowScreenWarningDismissed';

const renderWithIntl = ui =>
    render(
        <IntlProvider locale="en" messages={{}}>
            {ui}
        </IntlProvider>,
    );

const setMatchMedia = matches => {
    const listeners = new Set();
    const mql = {
        matches,
        media: '',
        onchange: null,
        addEventListener: (_event, listener) => listeners.add(listener),
        removeEventListener: (_event, listener) => listeners.delete(listener),
        addListener: listener => listeners.add(listener),
        removeListener: listener => listeners.delete(listener),
        dispatchEvent: () => false,
    };
    window.matchMedia = jest.fn(() => mql);
    return { mql, listeners };
};

describe('NarrowScreenWarning', () => {
    beforeEach(() => {
        window.localStorage.clear();
    });

    test('renders banner when viewport is narrow and not dismissed', () => {
        setMatchMedia(true);
        const { queryByTestId } = renderWithIntl(<NarrowScreenWarning />);
        expect(queryByTestId('narrow-screen-warning')).toBeInTheDocument();
    });

    test('renders nothing when viewport is wide', () => {
        setMatchMedia(false);
        const { queryByTestId } = renderWithIntl(<NarrowScreenWarning />);
        expect(queryByTestId('narrow-screen-warning')).not.toBeInTheDocument();
    });

    test('renders nothing when previously dismissed', () => {
        window.localStorage.setItem(STORAGE_KEY, 'true');
        setMatchMedia(true);
        const { queryByTestId } = renderWithIntl(<NarrowScreenWarning />);
        expect(queryByTestId('narrow-screen-warning')).not.toBeInTheDocument();
    });

    test('hides banner and persists flag when close button is clicked', () => {
        setMatchMedia(true);
        const { queryByTestId, getByTestId } = renderWithIntl(<NarrowScreenWarning />);
        fireEvent.click(getByTestId('narrow-screen-warning-close'));
        expect(queryByTestId('narrow-screen-warning')).not.toBeInTheDocument();
        expect(window.localStorage.getItem(STORAGE_KEY)).toBe('true');
    });

    test('appears when viewport shrinks below the breakpoint', () => {
        const { listeners } = setMatchMedia(false);
        const { queryByTestId } = renderWithIntl(<NarrowScreenWarning />);
        expect(queryByTestId('narrow-screen-warning')).not.toBeInTheDocument();
        act(() => {
            listeners.forEach(listener => listener({ matches: true }));
        });
        expect(queryByTestId('narrow-screen-warning')).toBeInTheDocument();
    });
});
