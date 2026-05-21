/* eslint-env jest */
import '@testing-library/jest-dom';
import { act, fireEvent, render } from '@testing-library/react';
import React from 'react';
import { IntlProvider } from 'react-intl';
import MobileOrientationGate, {
    DISMISS_STORAGE_KEY,
} from '../../../src/components/mobile-orientation-gate/mobile-orientation-gate.jsx';

/**
 * `(orientation: portrait)` の `matchMedia` をテスト用に差し替えるヘルパ。
 * 戻り値の `setMatches(bool)` で動的に切り替え可能。
 * @returns {{setMatches: Function, restore: Function}} 切替/復元 API
 */
const installMatchMedia = () => {
    const original = window.matchMedia;
    let listeners = [];
    let matches = false;
    window.matchMedia = jest.fn().mockImplementation((query) => {
        if (query !== '(orientation: portrait)') {
            // 他のクエリは default false を返す
            return { matches: false, addEventListener: () => {}, removeEventListener: () => {} };
        }
        return {
            matches,
            addEventListener: (_event, handler) => listeners.push(handler),
            removeEventListener: (_event, handler) => {
                listeners = listeners.filter((h) => h !== handler);
            },
        };
    });
    return {
        setMatches: (next) => {
            matches = next;
            listeners.forEach((h) => h({ matches: next }));
        },
        restore: () => {
            window.matchMedia = original;
        },
    };
};

const renderWithIntl = (ui) =>
    render(
        <IntlProvider locale="en" messages={{}}>
            {ui}
        </IntlProvider>,
    );

describe('MobileOrientationGate', () => {
    afterEach(() => {
        window.sessionStorage.clear();
    });

    test('does not render the overlay when in landscape', () => {
        const mm = installMatchMedia();
        try {
            const { queryByTestId } = renderWithIntl(<MobileOrientationGate />);
            expect(queryByTestId('mobile-orientation-gate')).not.toBeInTheDocument();
        } finally {
            mm.restore();
        }
    });

    test('renders the overlay when in portrait', () => {
        const mm = installMatchMedia();
        mm.setMatches(true);
        try {
            const { getByTestId } = renderWithIntl(<MobileOrientationGate />);
            expect(getByTestId('mobile-orientation-gate')).toBeInTheDocument();
        } finally {
            mm.restore();
        }
    });

    test('shows / hides the overlay when orientation changes', () => {
        const mm = installMatchMedia();
        try {
            const { queryByTestId } = renderWithIntl(<MobileOrientationGate />);
            expect(queryByTestId('mobile-orientation-gate')).not.toBeInTheDocument();
            // rotate to portrait
            act(() => mm.setMatches(true));
            expect(queryByTestId('mobile-orientation-gate')).toBeInTheDocument();
            // rotate back to landscape
            act(() => mm.setMatches(false));
            expect(queryByTestId('mobile-orientation-gate')).not.toBeInTheDocument();
        } finally {
            mm.restore();
        }
    });

    test('shows a dismiss button when in portrait', () => {
        const mm = installMatchMedia();
        mm.setMatches(true);
        try {
            const { getByTestId } = renderWithIntl(<MobileOrientationGate />);
            expect(getByTestId('mobile-orientation-gate-dismiss')).toBeInTheDocument();
        } finally {
            mm.restore();
        }
    });

    test('hides the overlay when the dismiss button is clicked', () => {
        const mm = installMatchMedia();
        mm.setMatches(true);
        try {
            const { getByTestId, queryByTestId } = renderWithIntl(<MobileOrientationGate />);
            fireEvent.click(getByTestId('mobile-orientation-gate-dismiss'));
            expect(queryByTestId('mobile-orientation-gate')).not.toBeInTheDocument();
        } finally {
            mm.restore();
        }
    });

    test('persists the dismiss in sessionStorage', () => {
        const mm = installMatchMedia();
        mm.setMatches(true);
        try {
            const { getByTestId } = renderWithIntl(<MobileOrientationGate />);
            fireEvent.click(getByTestId('mobile-orientation-gate-dismiss'));
            expect(window.sessionStorage.getItem(DISMISS_STORAGE_KEY)).toBe('true');
        } finally {
            mm.restore();
        }
    });

    test('does not render the overlay when sessionStorage has the dismiss flag', () => {
        window.sessionStorage.setItem(DISMISS_STORAGE_KEY, 'true');
        const mm = installMatchMedia();
        mm.setMatches(true);
        try {
            const { queryByTestId } = renderWithIntl(<MobileOrientationGate />);
            expect(queryByTestId('mobile-orientation-gate')).not.toBeInTheDocument();
        } finally {
            mm.restore();
        }
    });

    test('stays dismissed when orientation toggles after a dismiss click', () => {
        const mm = installMatchMedia();
        mm.setMatches(true);
        try {
            const { getByTestId, queryByTestId } = renderWithIntl(<MobileOrientationGate />);
            fireEvent.click(getByTestId('mobile-orientation-gate-dismiss'));
            // rotate to landscape, then back to portrait
            act(() => mm.setMatches(false));
            act(() => mm.setMatches(true));
            expect(queryByTestId('mobile-orientation-gate')).not.toBeInTheDocument();
        } finally {
            mm.restore();
        }
    });

    test('dispatches a window resize event when the dismiss button is clicked', () => {
        const mm = installMatchMedia();
        mm.setMatches(true);
        const resizeSpy = jest.fn();
        window.addEventListener('resize', resizeSpy);
        try {
            const { getByTestId } = renderWithIntl(<MobileOrientationGate />);
            fireEvent.click(getByTestId('mobile-orientation-gate-dismiss'));
            expect(resizeSpy).toHaveBeenCalledTimes(1);
        } finally {
            window.removeEventListener('resize', resizeSpy);
            mm.restore();
        }
    });
});
