/* eslint-env jest */
/**
 * 参加完了の画面 (#1793): 主ボタンは決めた始め方 1 つ。選択肢を横に並べない。
 */
import '@testing-library/jest-dom';
import { act, fireEvent, render } from '@testing-library/react';
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
    beforeEach(() => jest.useFakeTimers());
    afterEach(() => jest.useRealTimers());

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
        const { getAllByRole, getByTestId, queryByTestId } = renderJoined({ onClose });
        expect(getAllByRole('button')).toHaveLength(1);
        // nothing to read on a non-lesson joined confirmation: no wait
        expect(queryByTestId('classroom-start-wait')).not.toBeInTheDocument();
        fireEvent.click(getByTestId('classroom-start-main'));
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    test('レッスンの課題はゴールのカードと「はじめる」（レッスン表を開く）', () => {
        const onStartLesson = jest.fn();
        const onClose = jest.fn();
        const { getByTestId } = renderJoined({
            studentLesson: {
                courseId: 'kyou-kara-programmer',
                challengeIds: ['blocks-l1-key-sound', 'blocks-l1-arrow-move', 'blocks-l1-click-say'],
                requiredChallengeIds: ['blocks-l1-click-say'],
                completion: { type: 'count', count: 2 },
                submitWork: false,
            },
            startMethod: { main: 'lesson', others: [] },
            onClose,
            onStartLesson,
        });
        expect(getByTestId('classroom-joined-lesson-notice')).toBeInTheDocument();
        expect(getByTestId('classroom-joined-goal-count')).toHaveTextContent(
            'Clear 2 challenges (be sure to do the 1 marked ★)',
        );
        expect(getByTestId('classroom-joined-goal-next')).toHaveTextContent('Then the assignment is cleared!');
        // the goal card is read first: 3 s (readWaitSeconds of the goal card), counted down on the button
        expect(getByTestId('classroom-start-main')).toBeDisabled();
        expect(getByTestId('classroom-start-wait')).toHaveTextContent('3');
        act(() => {
            jest.advanceTimersByTime(3000);
        });
        expect(getByTestId('classroom-start-main')).not.toBeDisabled();
        fireEvent.click(getByTestId('classroom-start-main'));
        expect(onStartLesson).toHaveBeenCalledTimes(1);
        expect(onClose).not.toHaveBeenCalled();
    });
});
