/* eslint-env jest */
import '@testing-library/jest-dom';
import { fireEvent, render } from '@testing-library/react';
import React from 'react';
import { IntlProvider } from 'react-intl';
import StudentAssignmentPanel from '../../../src/components/classroom-modal/student-assignment-panel.jsx';

const defaultProps = () => ({
    assignment: {
        pages: [
            { text: 'ページ1のせつめい', imageUrl: null },
            { text: 'ページ2のせつめい', imageUrl: 'https://example.com/page2.png' },
        ],
        starterUrl: 'https://example.com/starter.sb3',
    },
    pageIndex: 0,
    onClose: jest.fn(),
    onNextPage: jest.fn(),
    onPrevPage: jest.fn(),
    onReloadStarter: jest.fn(),
});

const renderPanel = (props) =>
    render(
        <IntlProvider locale="en">
            <StudentAssignmentPanel {...defaultProps()} {...props} />
        </IntlProvider>,
    );

describe('StudentAssignmentPanel', () => {
    test('renders the current page text', () => {
        const { getByTestId } = renderPanel();
        expect(getByTestId('classroom-assignment-view-text')).toHaveTextContent('ページ1のせつめい');
    });

    test('shows the image only when the page has one', () => {
        const { queryByTestId, rerender } = renderPanel();
        expect(queryByTestId('classroom-assignment-view-image')).not.toBeInTheDocument();
        rerender(
            <IntlProvider locale="en">
                <StudentAssignmentPanel {...defaultProps()} pageIndex={1} />
            </IntlProvider>,
        );
        expect(queryByTestId('classroom-assignment-view-image')).toHaveAttribute(
            'src',
            'https://example.com/page2.png',
        );
    });

    test('pager shows position and disables prev on the first page', () => {
        const { getByTestId } = renderPanel();
        expect(getByTestId('classroom-assignment-page-indicator')).toHaveTextContent('1 / 2');
        expect(getByTestId('classroom-assignment-prev-page')).toBeDisabled();
        expect(getByTestId('classroom-assignment-next-page')).not.toBeDisabled();
    });

    test('pager disables next on the last page', () => {
        const { getByTestId } = renderPanel({ pageIndex: 1 });
        expect(getByTestId('classroom-assignment-next-page')).toBeDisabled();
        expect(getByTestId('classroom-assignment-prev-page')).not.toBeDisabled();
    });

    test('hides the pager for a single page', () => {
        const props = defaultProps();
        props.assignment = { pages: [{ text: 'only' }], starterUrl: null };
        const { queryByTestId } = renderPanel(props);
        expect(queryByTestId('classroom-assignment-page-indicator')).not.toBeInTheDocument();
    });

    test('next/prev call the handlers', () => {
        const onNextPage = jest.fn();
        const onPrevPage = jest.fn();
        const { getByTestId } = renderPanel({ pageIndex: 1, onNextPage, onPrevPage });
        fireEvent.click(getByTestId('classroom-assignment-prev-page'));
        expect(onPrevPage).toHaveBeenCalledTimes(1);
    });

    test('starter button calls the handler', () => {
        const onReloadStarter = jest.fn();
        const { getByTestId } = renderPanel({ onReloadStarter });
        fireEvent.click(getByTestId('classroom-assignment-reload-starter'));
        expect(onReloadStarter).toHaveBeenCalledTimes(1);
    });

    test('starter button is hidden when there is no starter', () => {
        const props = defaultProps();
        props.assignment = { pages: [{ text: 'p' }], starterUrl: null };
        const { queryByTestId } = renderPanel(props);
        expect(queryByTestId('classroom-assignment-reload-starter')).not.toBeInTheDocument();
    });

    test('joined notice appears when joinedInfo is given (zero-padded seat)', () => {
        const { getByTestId, queryByTestId, rerender } = renderPanel({ joinedInfo: { seatNumber: 3 } });
        expect(getByTestId('classroom-assignment-joined-notice')).toHaveTextContent('03');
        rerender(
            <IntlProvider locale="en">
                <StudentAssignmentPanel {...defaultProps()} />
            </IntlProvider>,
        );
        expect(queryByTestId('classroom-assignment-joined-notice')).not.toBeInTheDocument();
    });

    test('close button calls onClose', () => {
        const onClose = jest.fn();
        const { getByTestId } = renderPanel({ onClose });
        fireEvent.click(getByTestId('classroom-assignment-close'));
        expect(onClose).toHaveBeenCalledTimes(1);
    });
});
