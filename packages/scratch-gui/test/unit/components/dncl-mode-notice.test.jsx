/* eslint-env jest */
import '@testing-library/jest-dom';
import { fireEvent, render } from '@testing-library/react';
import React from 'react';
import { IntlProvider } from 'react-intl';
import DnclModeNotice from '../../../src/components/dncl-mode-notice/dncl-mode-notice.jsx';

const renderNotice = (props) =>
    render(
        <IntlProvider locale="en">
            <DnclModeNotice {...props} />
        </IntlProvider>,
    );

describe('DnclModeNotice', () => {
    let onExitDnclMode;

    beforeEach(() => {
        onExitDnclMode = jest.fn();
        jest.spyOn(window, 'confirm').mockReturnValue(false);
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    test('renders when dnclMode is true', () => {
        const { getByTestId } = renderNotice({ dnclMode: true, onExitDnclMode });
        expect(getByTestId('dncl-mode-notice')).toBeInTheDocument();
    });

    test('does not render when dnclMode is false', () => {
        const { queryByTestId } = renderNotice({ dnclMode: false, onExitDnclMode });
        expect(queryByTestId('dncl-mode-notice')).not.toBeInTheDocument();
    });

    test('exit button is present', () => {
        const { getByTestId } = renderNotice({ dnclMode: true, onExitDnclMode });
        expect(getByTestId('dncl-mode-notice-exit-button')).toBeInTheDocument();
    });

    test('shows confirm dialog when exit button is clicked', () => {
        const { getByTestId } = renderNotice({ dnclMode: true, onExitDnclMode });
        fireEvent.click(getByTestId('dncl-mode-notice-exit-button'));
        expect(window.confirm).toHaveBeenCalledTimes(1);
    });

    test('does not call onExitDnclMode when confirm is cancelled', () => {
        window.confirm.mockReturnValue(false);
        const { getByTestId } = renderNotice({ dnclMode: true, onExitDnclMode });
        fireEvent.click(getByTestId('dncl-mode-notice-exit-button'));
        expect(onExitDnclMode).not.toHaveBeenCalled();
    });

    test('calls onExitDnclMode when confirm is accepted', () => {
        window.confirm.mockReturnValue(true);
        const { getByTestId } = renderNotice({ dnclMode: true, onExitDnclMode });
        fireEvent.click(getByTestId('dncl-mode-notice-exit-button'));
        expect(onExitDnclMode).toHaveBeenCalledTimes(1);
    });
});
