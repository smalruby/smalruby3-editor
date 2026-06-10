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

    test('OK is enabled immediately (no consent checkbox) and calls onAccept', () => {
        const onAccept = jest.fn();
        const { getByTestId, queryByTestId } = renderConsent({ onAccept, onCancel: jest.fn() });

        // The lighter notice has no 18+/guardian-consent checkbox.
        expect(queryByTestId('bug-report-consent-checkbox')).not.toBeInTheDocument();

        const acceptButton = getByTestId('bug-report-consent-accept');
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
