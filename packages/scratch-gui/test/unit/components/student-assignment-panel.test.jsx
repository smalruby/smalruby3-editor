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

    // 主ボタンは 1 つ (#1793): 最後のページまでは「つぎのページ」、最後のページで決めた始め方。
    test('最後のページより前の主ボタンは「つぎのページ」', () => {
        const onNextPage = jest.fn();
        const { getByTestId, queryByTestId } = renderPanel({
            joinedInfo: { seatNumber: 2 },
            startMethod: { main: 'starter', others: ['keep'], notice: null },
            onNextPage,
        });
        expect(queryByTestId('classroom-start-method')).not.toBeInTheDocument();
        fireEvent.click(getByTestId('classroom-assignment-main-next'));
        expect(onNextPage).toHaveBeenCalledTimes(1);
    });

    test('参加した直後は、最後のページで決めた始め方を主ボタンにする', () => {
        const onChooseStarter = jest.fn();
        const onClose = jest.fn();
        const { getByTestId, queryByTestId } = renderPanel({
            pageIndex: 1,
            joinedInfo: { seatNumber: 2 },
            startMethod: { main: 'starter', others: ['keep'], notice: null },
            onChooseStarter,
            onClose,
        });
        expect(queryByTestId('classroom-assignment-main-next')).not.toBeInTheDocument();
        expect(queryByTestId('classroom-assignment-close')).not.toBeInTheDocument();
        fireEvent.click(getByTestId('classroom-start-main'));
        expect(onChooseStarter).toHaveBeenCalledTimes(1);
        fireEvent.click(getByTestId('classroom-start-others-toggle'));
        fireEvent.click(getByTestId('classroom-start-other-keep'));
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    test('ページが 1 つだけなら、はじめから決めた始め方を出す', () => {
        const props = defaultProps();
        props.assignment = { pages: [{ text: 'only' }], starterUrl: null };
        const onLoadSubmission = jest.fn();
        const { getByTestId } = renderPanel({
            ...props,
            joinedInfo: { seatNumber: 2 },
            continueOptions: { previous: { assignmentName: '第1回', submittedAt: null }, current: null },
            startMethod: { main: 'previous', others: ['keep'], notice: null },
            onLoadSubmission,
        });
        fireEvent.click(getByTestId('classroom-start-main'));
        expect(onLoadSubmission).toHaveBeenCalledWith('previous');
    });

    test('「課題を見る」から開き直したときは、最後のページの主ボタンを「とじる」にする（参加の情報が残っていても始め方は出さない）', () => {
        const onClose = jest.fn();
        const { getByTestId, queryByTestId } = renderPanel({
            assignmentReopened: true,
            joinedInfo: { seatNumber: 2 },
            pageIndex: 1,
            startMethod: { main: 'starter', others: ['keep'], notice: null },
            onClose,
        });
        expect(queryByTestId('classroom-start-method')).not.toBeInTheDocument();
        expect(queryByTestId('classroom-assignment-joined-notice')).not.toBeInTheDocument();
        fireEvent.click(getByTestId('classroom-assignment-close'));
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    test('開き直したパネルにはスターターのリンクを出さない（おかえりなさいの「作品を読み込み直す」から開く）', () => {
        const { queryByTestId } = renderPanel({ assignmentReopened: true, pageIndex: 1 });
        expect(queryByTestId('classroom-assignment-close')).toBeInTheDocument();
        expect(queryByTestId('classroom-assignment-reload-starter')).not.toBeInTheDocument();
    });

    test('レッスンの課題は、最後のページにお知らせと「はじめる」（レッスン表）を出す', () => {
        const onStartLesson = jest.fn();
        const { getByTestId, queryByTestId, rerender } = renderPanel({
            joinedInfo: { seatNumber: 2 },
            studentLesson: { submitWork: true },
            startMethod: { main: 'lesson', others: [], notice: null },
            onStartLesson,
        });
        expect(queryByTestId('classroom-assignment-lesson-notice')).not.toBeInTheDocument();
        rerender(
            <IntlProvider locale="en">
                <StudentAssignmentPanel
                    {...defaultProps()}
                    joinedInfo={{ seatNumber: 2 }}
                    pageIndex={1}
                    startMethod={{ main: 'lesson', others: [], notice: null }}
                    studentLesson={{ submitWork: true }}
                    onStartLesson={onStartLesson}
                />
            </IntlProvider>,
        );
        expect(getByTestId('classroom-assignment-lesson-notice')).toBeInTheDocument();
        fireEvent.click(getByTestId('classroom-start-main'));
        expect(onStartLesson).toHaveBeenCalledTimes(1);
    });
});
