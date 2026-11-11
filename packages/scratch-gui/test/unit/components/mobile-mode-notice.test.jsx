/* eslint-env jest */
import '@testing-library/jest-dom';
import { fireEvent, render } from '@testing-library/react';
import React from 'react';
import { IntlProvider } from 'react-intl';
import MobileModeNotice, {
    DISMISS_STORAGE_KEY,
} from '../../../src/components/mobile-mode-notice/mobile-mode-notice.jsx';

const renderWithIntl = (ui) =>
    render(
        <IntlProvider locale="en" messages={{}}>
            {ui}
        </IntlProvider>,
    );

describe('MobileModeNotice (Issue #865)', () => {
    beforeEach(() => {
        window.localStorage.clear();
    });

    test('renders the notice with switch and dismiss actions by default', () => {
        const { getByTestId } = renderWithIntl(<MobileModeNotice />);
        expect(getByTestId('mobile-mode-notice')).toBeInTheDocument();
        expect(getByTestId('mobile-mode-notice-switch')).toBeInTheDocument();
        expect(getByTestId('mobile-mode-notice-dismiss')).toBeInTheDocument();
        expect(getByTestId('mobile-mode-notice-close')).toBeInTheDocument();
    });

    test('does not render when previously dismissed (persisted per machine)', () => {
        window.localStorage.setItem(DISMISS_STORAGE_KEY, 'true');
        const { queryByTestId } = renderWithIntl(<MobileModeNotice />);
        expect(queryByTestId('mobile-mode-notice')).not.toBeInTheDocument();
    });

    test('clicking dismiss hides the notice and records the dismissal', () => {
        const { getByTestId, queryByTestId } = renderWithIntl(<MobileModeNotice />);
        fireEvent.click(getByTestId('mobile-mode-notice-dismiss'));
        expect(queryByTestId('mobile-mode-notice')).not.toBeInTheDocument();
        expect(window.localStorage.getItem(DISMISS_STORAGE_KEY)).toBe('true');
    });

    test('clicking the close (x) button hides the notice and records the dismissal', () => {
        const { getByTestId, queryByTestId } = renderWithIntl(<MobileModeNotice />);
        fireEvent.click(getByTestId('mobile-mode-notice-close'));
        expect(queryByTestId('mobile-mode-notice')).not.toBeInTheDocument();
        expect(window.localStorage.getItem(DISMISS_STORAGE_KEY)).toBe('true');
    });

    test('clicking "switch to PC mode" persists desktop mode and dismisses the notice', () => {
        const { getByTestId, queryByTestId } = renderWithIntl(<MobileModeNotice />);
        fireEvent.click(getByTestId('mobile-mode-notice-switch'));
        expect(window.localStorage.getItem('smalruby:displayMode')).toBe('desktop');
        expect(window.localStorage.getItem(DISMISS_STORAGE_KEY)).toBe('true');
        expect(queryByTestId('mobile-mode-notice')).not.toBeInTheDocument();
    });

    // Issue #1498: レッスンモードでは課題バー・全文パネルに重なるので、入ったら閉じる
    test('closes and records the dismissal when lesson mode is active', () => {
        const { queryByTestId } = renderWithIntl(<MobileModeNotice lessonModeActive />);
        expect(queryByTestId('mobile-mode-notice')).not.toBeInTheDocument();
        expect(window.localStorage.getItem(DISMISS_STORAGE_KEY)).toBe('true');
    });

    test('closes when lesson mode starts while the notice is shown', () => {
        const { getByTestId, queryByTestId, rerender } = renderWithIntl(
            <MobileModeNotice lessonModeActive={false} />,
        );
        expect(getByTestId('mobile-mode-notice')).toBeInTheDocument();
        rerender(
            <IntlProvider locale="en" messages={{}}>
                <MobileModeNotice lessonModeActive />
            </IntlProvider>,
        );
        expect(queryByTestId('mobile-mode-notice')).not.toBeInTheDocument();
        expect(window.localStorage.getItem(DISMISS_STORAGE_KEY)).toBe('true');
    });
});
