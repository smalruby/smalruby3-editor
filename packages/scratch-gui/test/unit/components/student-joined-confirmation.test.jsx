/* eslint-env jest */
/**
 * 参加完了の画面 (#1793): 主ボタンは決めた始め方 1 つ。選択肢を横に並べない。
 */
import '@testing-library/jest-dom';
import { fireEvent, render } from '@testing-library/react';
import React from 'react';
import { IntlProvider } from 'react-intl';
import StudentJoinedConfirmation from '../../../src/components/classroom-modal/student-joined-confirmation.jsx';

const JOINED = { className: '1組', classYear: 8, seatNumber: 3, assignmentName: 'ねこの迷路' };

const renderJoined = (props) =>
    render(
        <IntlProvider locale="en">
            <StudentJoinedConfirmation
                joinedInfo={JOINED}
                startMethod={{ main: 'keep', others: [] }}
                onClose={jest.fn()}
                {...props}
            />
        </IntlProvider>,
    );

describe('StudentJoinedConfirmation', () => {
    test('主ボタンは 1 つだけで、ほかの始め方はしまってある', () => {
        const onLoadSubmission = jest.fn();
        const { getAllByRole, getByTestId, queryByTestId } = renderJoined({
            continueOptions: { previous: { assignmentName: '第1回', submittedAt: null }, current: null },
            startMethod: { main: 'previous', others: ['starter', 'keep'] },
            onLoadSubmission,
            onLoadStarter: jest.fn(),
        });
        expect(getAllByRole('button')).toHaveLength(2);
        expect(queryByTestId('classroom-continue-choice')).not.toBeInTheDocument();
        expect(queryByTestId('classroom-start-notice')).not.toBeInTheDocument();
        fireEvent.click(getByTestId('classroom-start-main'));
        expect(onLoadSubmission).toHaveBeenCalledWith('previous');
    });

    test('使えるものが無ければ「はじめる」だけで、押すとモーダルを閉じる', () => {
        const onClose = jest.fn();
        const { getAllByRole, getByTestId } = renderJoined({ onClose });
        expect(getAllByRole('button')).toHaveLength(1);
        fireEvent.click(getByTestId('classroom-start-main'));
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    test('レッスンの課題はお知らせと「はじめる」（レッスン表を開く）', () => {
        const onStartLesson = jest.fn();
        const onClose = jest.fn();
        const { getByTestId } = renderJoined({
            studentLesson: { submitWork: false },
            startMethod: { main: 'lesson', others: [] },
            onClose,
            onStartLesson,
        });
        expect(getByTestId('classroom-joined-lesson-notice')).toBeInTheDocument();
        fireEvent.click(getByTestId('classroom-start-main'));
        expect(onStartLesson).toHaveBeenCalledTimes(1);
        expect(onClose).not.toHaveBeenCalled();
    });
});
