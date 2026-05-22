/* eslint-env jest */
import '@testing-library/jest-dom';
import { fireEvent, render } from '@testing-library/react';
import React from 'react';
import { IntlProvider } from 'react-intl';
import { ModalFocusContext } from '../../../src/contexts/modal-focus-context.jsx';
import ExtensionButton from '../../../src/components/extension-button/extension-button.jsx';

const mockFocusContext = { captureFocus: jest.fn(), restoreFocus: jest.fn() };

const renderButton = (props) =>
    render(
        <IntlProvider locale="en">
            <ModalFocusContext.Provider value={mockFocusContext}>
                <ExtensionButton {...props} />
            </ModalFocusContext.Provider>
        </IntlProvider>,
    );

describe('ExtensionButton in DNCL mode', () => {
    let onExtensionButtonClick;
    let onRequestExitDnclMode;

    beforeEach(() => {
        onExtensionButtonClick = jest.fn();
        onRequestExitDnclMode = jest.fn();
        jest.spyOn(window, 'confirm').mockReturnValue(false);
        jest.spyOn(window, 'alert').mockImplementation(() => {});
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    test('shows confirm dialog (not alert) when clicked in DNCL mode', () => {
        const { getByTestId } = renderButton({
            dnclMode: true,
            onExtensionButtonClick,
            onRequestExitDnclMode,
        });
        fireEvent.click(getByTestId('extension-button'));
        expect(window.confirm).toHaveBeenCalledTimes(1);
        expect(window.alert).not.toHaveBeenCalled();
    });

    test('does not open extension library when confirm is cancelled', () => {
        window.confirm.mockReturnValue(false);
        const { getByTestId } = renderButton({
            dnclMode: true,
            onExtensionButtonClick,
            onRequestExitDnclMode,
        });
        fireEvent.click(getByTestId('extension-button'));
        expect(onExtensionButtonClick).not.toHaveBeenCalled();
        expect(onRequestExitDnclMode).not.toHaveBeenCalled();
    });

    test('dispatches exit request and opens extension library when confirm is accepted', () => {
        window.confirm.mockReturnValue(true);
        const { getByTestId } = renderButton({
            dnclMode: true,
            onExtensionButtonClick,
            onRequestExitDnclMode,
        });
        fireEvent.click(getByTestId('extension-button'));
        expect(onRequestExitDnclMode).toHaveBeenCalledTimes(1);
        expect(onExtensionButtonClick).toHaveBeenCalledTimes(1);
    });

    test('opens extension library directly when not in DNCL mode', () => {
        const { getByTestId } = renderButton({
            dnclMode: false,
            onExtensionButtonClick,
            onRequestExitDnclMode,
        });
        fireEvent.click(getByTestId('extension-button'));
        expect(window.confirm).not.toHaveBeenCalled();
        expect(onExtensionButtonClick).toHaveBeenCalledTimes(1);
    });

    test('does not call confirm or open library when dnclMode is undefined', () => {
        const { getByTestId } = renderButton({
            dnclMode: undefined,
            onExtensionButtonClick,
            onRequestExitDnclMode,
        });
        fireEvent.click(getByTestId('extension-button'));
        expect(window.confirm).not.toHaveBeenCalled();
        expect(onExtensionButtonClick).toHaveBeenCalledTimes(1);
    });
});
