/* eslint-env jest */
import '@testing-library/jest-dom';
import { fireEvent, render } from '@testing-library/react';
import React from 'react';
import { IntlProvider } from 'react-intl';
import BugReportConsent from '../../../src/components/bug-report-consent/bug-report-consent.jsx';

const renderConsent = (props) =>
    render(
        <IntlProvider locale="en">
            <BugReportConsent {...props} />
        </IntlProvider>,
    );

describe('BugReportConsent', () => {
    test('renders the consent dialog', () => {
        const { queryByTestId } = renderConsent({ onAccept: jest.fn(), onCancel: jest.fn() });
        expect(queryByTestId('bug-report-consent')).toBeInTheDocument();
    });

    test('accept is disabled until the checkbox is checked', () => {
        const onAccept = jest.fn();
        const { getByTestId } = renderConsent({ onAccept, onCancel: jest.fn() });

        const acceptButton = getByTestId('bug-report-consent-accept');
        expect(acceptButton).toBeDisabled();

        // Clicking while disabled does nothing.
        fireEvent.click(acceptButton);
        expect(onAccept).not.toHaveBeenCalled();

        fireEvent.click(getByTestId('bug-report-consent-checkbox'));
        expect(acceptButton).not.toBeDisabled();

        fireEvent.click(acceptButton);
        expect(onAccept).toHaveBeenCalledTimes(1);
    });

    test('cancel calls onCancel', () => {
        const onCancel = jest.fn();
        const { getByTestId } = renderConsent({ onAccept: jest.fn(), onCancel });
        fireEvent.click(getByTestId('bug-report-consent-cancel'));
        expect(onCancel).toHaveBeenCalledTimes(1);
    });
});
