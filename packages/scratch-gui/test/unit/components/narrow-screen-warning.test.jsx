/* eslint-env jest */
import React from 'react';
import { IntlProvider } from 'react-intl';
import '@testing-library/jest-dom';
import { act, fireEvent, render } from '@testing-library/react';
import NarrowScreenWarning from '../../../src/components/narrow-screen-warning/narrow-screen-warning.jsx';

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
    test('renders banner when viewport is narrow', () => {
        setMatchMedia(true);
        const { queryByTestId } = renderWithIntl(<NarrowScreenWarning />);
        expect(queryByTestId('narrow-screen-warning')).toBeInTheDocument();
    });

    test('renders nothing when viewport is wide', () => {
        setMatchMedia(false);
        const { queryByTestId } = renderWithIntl(<NarrowScreenWarning />);
        expect(queryByTestId('narrow-screen-warning')).not.toBeInTheDocument();
    });

    test('hides banner for the current render after close is clicked', () => {
        setMatchMedia(true);
        const { queryByTestId, getByTestId } = renderWithIntl(<NarrowScreenWarning />);
        fireEvent.click(getByTestId('narrow-screen-warning-close'));
        expect(queryByTestId('narrow-screen-warning')).not.toBeInTheDocument();
    });

    test('shows banner again on a fresh render even after a previous close', () => {
        setMatchMedia(true);
        // 1st render: close it
        const first = renderWithIntl(<NarrowScreenWarning />);
        fireEvent.click(first.getByTestId('narrow-screen-warning-close'));
        first.unmount();
        // 2nd render (e.g. reload simulation): banner reappears
        const second = renderWithIntl(<NarrowScreenWarning />);
        expect(second.queryByTestId('narrow-screen-warning')).toBeInTheDocument();
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
