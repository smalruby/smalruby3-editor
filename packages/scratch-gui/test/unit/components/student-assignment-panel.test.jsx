/* eslint-env jest */
import '@testing-library/jest-dom';
import { act, fireEvent, render } from '@testing-library/react';
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

// Right after joining the start buttons wait a few seconds (readWaitSeconds); let them pass.
const passReadWait = (seconds = 5) =>
    act(() => {
        jest.advanceTimersByTime(seconds * 1000);
    });

const LESSON = {
    courseId: 'kyou-kara-programmer',
    challengeIds: ['blocks-l1-key-sound', 'blocks-l1-arrow-move', 'blocks-l1-click-say'],
    requiredChallengeIds: ['blocks-l1-click-say'],
    completion: { type: 'count', count: 2 },
    submitWork: true,
    scoring: null,
};

describe('StudentAssignmentPanel', () => {
    beforeEach(() => jest.useFakeTimers());
    afterEach(() => jest.useRealTimers());

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
            startMethod: { main: 'starter', others: ['keep'] },
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
            startMethod: { main: 'starter', others: ['keep'] },
            onChooseStarter,
            onClose,
        });
        expect(queryByTestId('classroom-assignment-main-next')).not.toBeInTheDocument();
        expect(queryByTestId('classroom-assignment-close')).not.toBeInTheDocument();
        passReadWait();
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
            startMethod: { main: 'previous', others: ['keep'] },
            onLoadSubmission,
        });
        passReadWait();
        fireEvent.click(getByTestId('classroom-start-main'));
        expect(onLoadSubmission).toHaveBeenCalledWith('previous');
    });

    test('「課題を見る」から開き直したときは、最後のページの主ボタンを「とじる」にする（参加の情報が残っていても始め方は出さない）', () => {
        const onClose = jest.fn();
        const { getByTestId, queryByTestId } = renderPanel({
            assignmentReopened: true,
            joinedInfo: { seatNumber: 2 },
            pageIndex: 1,
            startMethod: { main: 'starter', others: ['keep'] },
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
            startMethod: { main: 'lesson', others: [] },
            onStartLesson,
        });
        expect(queryByTestId('classroom-assignment-lesson-notice')).not.toBeInTheDocument();
        rerender(
            <IntlProvider locale="en">
                <StudentAssignmentPanel
                    {...defaultProps()}
                    joinedInfo={{ seatNumber: 2 }}
                    pageIndex={1}
                    startMethod={{ main: 'lesson', others: [] }}
                    studentLesson={{ submitWork: true }}
                    onStartLesson={onStartLesson}
                />
            </IntlProvider>,
        );
        expect(getByTestId('classroom-assignment-lesson-notice')).toBeInTheDocument();
        passReadWait();
        fireEvent.click(getByTestId('classroom-start-main'));
        expect(onStartLesson).toHaveBeenCalledTimes(1);
    });

    test('先生の文は見出し・マーカー・箇条書き・ラベルで出す（HTML にはしない）', () => {
        const props = defaultProps();
        props.assignment = {
            pages: [{ text: 'ねこを歩かせよう\n【ポイント】*旗*を押す\n・<b>右</b>へ\n・左へ' }],
        };
        const { getByTestId, container } = renderPanel(props);
        expect(getByTestId('classroom-assignment-text-heading')).toHaveTextContent('ねこを歩かせよう');
        expect(container.querySelector('mark')).toHaveTextContent('旗');
        expect(container.querySelectorAll('li')).toHaveLength(2);
        expect(container.querySelector('b')).toBeNull();
        expect(getByTestId('classroom-assignment-view-text')).toHaveTextContent('<b>右</b>へ');
    });

    test('レッスンの課題は最後のページにゴールのカード（N つ・★ M つ・レッスン・提出）', () => {
        const { getByTestId, queryByTestId } = renderPanel({
            pageIndex: 1,
            joinedInfo: { seatNumber: 2 },
            startMethod: { main: 'lesson', others: [] },
            studentLesson: LESSON,
        });
        expect(getByTestId('classroom-assignment-goal-count')).toHaveTextContent(
            'Clear 2 challenges (be sure to do the 1 marked ★)',
        );
        expect(getByTestId('classroom-assignment-goal-lessons')).toHaveTextContent('Lesson 1');
        expect(getByTestId('classroom-assignment-goal-next')).toHaveTextContent(
            'Then make your own program and submit it',
        );
        expect(queryByTestId('classroom-assignment-goal')).toBeInTheDocument();
    });

    test('参加した直後は「よく読もう… n」の間、始めるボタンを押せない', () => {
        const props = defaultProps();
        props.assignment = { pages: [{ text: 'only' }], starterUrl: null };
        const onClose = jest.fn();
        const { getByTestId, queryByTestId } = renderPanel({
            ...props,
            joinedInfo: { seatNumber: 2 },
            startMethod: { main: 'keep', others: [] },
            onClose,
        });
        // a short single page waits 2 s
        expect(getByTestId('classroom-start-main')).toBeDisabled();
        expect(getByTestId('classroom-start-wait')).toHaveTextContent('2');
        fireEvent.click(getByTestId('classroom-start-main'));
        expect(onClose).not.toHaveBeenCalled();
        passReadWait(1);
        expect(getByTestId('classroom-start-wait')).toHaveTextContent('1');
        passReadWait(1);
        expect(queryByTestId('classroom-start-wait')).not.toBeInTheDocument();
        fireEvent.click(getByTestId('classroom-start-main'));
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    test('前のページを読んできたら、最後のページの待ちは短い（1 秒）', () => {
        const { getByTestId, queryByTestId } = renderPanel({
            pageIndex: 1,
            joinedInfo: { seatNumber: 2 },
            startMethod: { main: 'starter', others: [] },
        });
        expect(getByTestId('classroom-start-wait')).toHaveTextContent('1');
        passReadWait(1);
        expect(queryByTestId('classroom-start-wait')).not.toBeInTheDocument();
    });

    test('待ち終わったあとは、ページを戻って来ても待たない', () => {
        const base = { joinedInfo: { seatNumber: 2 }, startMethod: { main: 'starter', others: [] } };
        const { getByTestId, queryByTestId, rerender } = renderPanel({ ...base, pageIndex: 1 });
        passReadWait();
        const renderAt = (pageIndex) =>
            rerender(
                <IntlProvider locale="en">
                    <StudentAssignmentPanel {...defaultProps()} {...base} pageIndex={pageIndex} />
                </IntlProvider>,
            );
        renderAt(0);
        renderAt(1);
        expect(queryByTestId('classroom-start-wait')).not.toBeInTheDocument();
        expect(getByTestId('classroom-start-main')).not.toBeDisabled();
    });

    test('「課題を見る」から開き直したときは待たない', () => {
        const { getByTestId } = renderPanel({
            assignmentReopened: true,
            joinedInfo: { seatNumber: 2 },
            pageIndex: 1,
            startMethod: { main: 'starter', others: [] },
        });
        expect(getByTestId('classroom-assignment-close')).not.toBeDisabled();
    });

    test('とじたら（unmount）タイマーは残らない', () => {
        const { unmount } = renderPanel({
            pageIndex: 1,
            joinedInfo: { seatNumber: 2 },
            startMethod: { main: 'starter', others: [] },
        });
        expect(jest.getTimerCount()).toBeGreaterThan(0);
        unmount();
        expect(jest.getTimerCount()).toBe(0);
    });
});
