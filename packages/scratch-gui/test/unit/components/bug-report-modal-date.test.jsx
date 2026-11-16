/* eslint-env jest */
import '@testing-library/jest-dom';
import { render } from '@testing-library/react';
import React from 'react';
import { IntlProvider, injectIntl } from 'react-intl';
import { ReportRow } from '../../../src/components/bug-report-modal/bug-report-modal.jsx';

// The modal's own Modal container needs redux; the row is enough to check the date.
const Row = injectIntl(ReportRow);

const renderRow = (createdAt, timeZone) =>
    render(
        <IntlProvider locale="en">
            <Row report={{ reportId: 'r1', status: 'open', createdAt }} onHide={jest.fn()} timeZone={timeZone} />
        </IntlProvider>,
    );

describe('bug report row date (#1973)', () => {
    // CI runs in UTC, where the first 10 characters happen to be right. Fix the zone to Japan.
    const TZ = 'Asia/Tokyo';

    test('a report made early in the morning in Japan shows that day, not the day before', () => {
        const { getByTestId } = renderRow('2026-11-14T15:00:00.000Z', TZ);
        expect(getByTestId('bug-report-item-date')).toHaveTextContent('2026-11-15');
    });

    test('a date-only value is shown as it is', () => {
        const { getByTestId } = renderRow('2026-11-15', TZ);
        expect(getByTestId('bug-report-item-date')).toHaveTextContent('2026-11-15');
    });

    test('no date shows nothing', () => {
        const { getByTestId } = renderRow(undefined, TZ);
        expect(getByTestId('bug-report-item-date')).toHaveTextContent('');
    });
});
