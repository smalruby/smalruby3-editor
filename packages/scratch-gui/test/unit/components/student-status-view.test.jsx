/* eslint-env jest */
/**
 * 「おかえりなさい」の画面 (#1794)。主ボタンは「つづける」1 つで、ほかは小さなリンク。
 * 提出のボタンはこの画面に置かない（メニューバーの「提出する」から）。
 */
import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { IntlProvider } from 'react-intl';
import { Provider } from 'react-redux';
import { combineReducers, createStore } from 'redux';
import StudentStatusView from '../../../src/components/classroom-modal/student-status-view.jsx';
import classroomReducer, { openClassroomModal, setStudentPeerView } from '../../../src/reducers/classroom.js';

const baseState = (extra = {}) => ({
    className: '1年1組',
    classYear: null,
    seatNumber: 3,
    assignmentName: 'チャットアプリを作ろう',
    submissionStatus: null,
    lastSubmittedAt: null,
    ...extra,
});

const renderView = (props = {}, { peerView = 'always' } = {}) => {
    const store = createStore(combineReducers({ scratchGui: combineReducers({ classroom: classroomReducer }) }));
    store.dispatch(openClassroomModal());
    if (peerView) store.dispatch(setStudentPeerView(peerView));
    const handlers = {
        onContinue: jest.fn(),
        onLeaveClassroom: jest.fn(),
        onLoadStarter: jest.fn(),
        onLoadSubmission: jest.fn(),
        onOpenAssignment: jest.fn(),
        onRefreshStudentStatus: jest.fn(),
        onStartLesson: jest.fn(),
        onWrongSeat: jest.fn(),
    };
    render(
        <Provider store={store}>
            <IntlProvider locale="en">
                <StudentStatusView classroomState={baseState()} hasAssignment {...handlers} {...props} />
            </IntlProvider>
        </Provider>,
    );
    return handlers;
};

const LESSON_STATUS = {
    challenges: [
        { id: 'a', completed: true, required: false },
        { id: 'b', completed: false, required: true },
    ],
    completedCount: 1,
    cappedCount: 1,
    conditionCount: 2,
    requiredCount: 1,
    requiredRemaining: 1,
    remaining: 1,
    started: true,
    cleared: false,
    unknownCount: 0,
};

describe('StudentStatusView: おかえりなさい (#1794)', () => {
    test('shows the heading and the one-line info (class, seat, assignment, status)', () => {
        renderView();
        expect(screen.getByTestId('classroom-status-title')).toHaveTextContent('Welcome back');
        expect(screen.getByTestId('classroom-status-class-name')).toHaveTextContent('1年1組');
        expect(screen.getByTestId('classroom-status-seat-number')).toHaveTextContent('Seat 03');
        expect(screen.getByTestId('classroom-status-assignment')).toHaveTextContent('チャットアプリを作ろう');
        expect(screen.getByTestId('classroom-submit-status')).toHaveTextContent('Not submitted');
        expect(screen.getByTestId('classroom-student-refresh')).toBeInTheDocument();
    });

    test('the one main button is 「つづける」 and closes without loading anything', () => {
        const h = renderView();
        fireEvent.click(screen.getByTestId('classroom-status-continue'));
        expect(h.onContinue).toHaveBeenCalledTimes(1);
        expect(h.onLoadSubmission).not.toHaveBeenCalled();
        expect(h.onLoadStarter).not.toHaveBeenCalled();
        expect(screen.getByTestId('classroom-status-continue-note')).toBeInTheDocument();
    });

    test('there is no submit button on this screen', () => {
        renderView({ classroomState: baseState({ submissionStatus: 'submitted' }) });
        expect(screen.queryByTestId('classroom-submit-button')).toBeNull();
    });

    test('small links: view the assignment, classmates, wrong seat, reload, leave', () => {
        const h = renderView({ continueOptions: { previous: { assignmentName: '第1回' } }, hasStarter: true });
        fireEvent.click(screen.getByTestId('classroom-view-assignment-button'));
        expect(h.onOpenAssignment).toHaveBeenCalledTimes(1);
        expect(screen.getByTestId('classroom-peer-view-button')).toBeInTheDocument();
        fireEvent.click(screen.getByTestId('classroom-status-wrong-seat'));
        expect(h.onWrongSeat).toHaveBeenCalledTimes(1);
        expect(screen.getByTestId('classroom-status-reload-toggle')).toBeInTheDocument();
        expect(screen.getByTestId('classroom-leave')).toBeInTheDocument();
    });

    test('「課題を見る」 only when the class has assignment content', () => {
        renderView({ hasAssignment: false });
        expect(screen.queryByTestId('classroom-view-assignment-button')).toBeNull();
    });

    test('「作品を読み込み直す」 lists what can be opened, in order: this assignment, last time, starter', () => {
        const h = renderView({
            continueOptions: { previous: { assignmentName: '第1回' }, current: { submittedAt: null } },
            hasStarter: true,
        });
        expect(screen.queryByTestId('classroom-status-reload-options')).toBeNull();
        fireEvent.click(screen.getByTestId('classroom-status-reload-toggle'));
        const options = screen.getByTestId('classroom-status-reload-options');
        const ids = Array.from(options.querySelectorAll('[data-testid]')).map((el) => el.dataset.testid);
        expect(ids).toEqual([
            'classroom-status-reload-current',
            'classroom-status-reload-previous',
            'classroom-status-reload-starter',
        ]);
        fireEvent.click(screen.getByTestId('classroom-status-reload-previous'));
        expect(h.onLoadSubmission).toHaveBeenCalledWith('previous');
        fireEvent.click(screen.getByTestId('classroom-status-reload-starter'));
        expect(h.onLoadStarter).toHaveBeenCalledTimes(1);
    });

    test('「作品を読み込み直す」 is hidden when nothing can be opened', () => {
        renderView({ continueOptions: null, hasStarter: false });
        expect(screen.queryByTestId('classroom-status-reload-toggle')).toBeNull();
    });

    test('「作品を読み込み直す」 with only the starter', () => {
        renderView({ continueOptions: null, hasStarter: true });
        fireEvent.click(screen.getByTestId('classroom-status-reload-toggle'));
        expect(screen.getByTestId('classroom-status-reload-starter')).toBeInTheDocument();
        expect(screen.queryByTestId('classroom-status-reload-previous')).toBeNull();
    });

    test('「クラスから出る」 asks first; 「やめる」 goes back without leaving', () => {
        const h = renderView();
        fireEvent.click(screen.getByTestId('classroom-leave'));
        expect(h.onLeaveClassroom).not.toHaveBeenCalled();
        expect(screen.getByTestId('classroom-leave-dialog')).toHaveTextContent('Leave the class?');
        // While asking, the confirm button is the only main button.
        expect(screen.queryByTestId('classroom-status-continue')).toBeNull();
        fireEvent.click(screen.getByTestId('classroom-leave-cancel'));
        expect(screen.queryByTestId('classroom-leave-dialog')).toBeNull();
        expect(screen.getByTestId('classroom-status-continue')).toBeInTheDocument();
        expect(h.onLeaveClassroom).not.toHaveBeenCalled();
    });

    test('the confirm is named by its question, takes the focus, and gives it back on cancel', () => {
        renderView();
        fireEvent.click(screen.getByTestId('classroom-leave'));
        const dialog = screen.getByTestId('classroom-leave-dialog');
        expect(dialog).toHaveAccessibleName('Leave the class? The projects you submitted stay.');
        expect(screen.getByTestId('classroom-leave-confirm')).toHaveFocus();
        fireEvent.click(screen.getByTestId('classroom-leave-cancel'));
        expect(screen.getByTestId('classroom-leave')).toHaveFocus();
    });

    test('Esc in the confirm cancels only the confirm (does not reach the modal)', () => {
        const h = renderView();
        const outer = jest.fn();
        document.addEventListener('keydown', outer);
        fireEvent.click(screen.getByTestId('classroom-leave'));
        fireEvent.keyDown(screen.getByTestId('classroom-leave-confirm'), { key: 'Escape' });
        document.removeEventListener('keydown', outer);
        expect(screen.queryByTestId('classroom-leave-dialog')).toBeNull();
        expect(outer).not.toHaveBeenCalled();
        expect(h.onLeaveClassroom).not.toHaveBeenCalled();
    });

    test('「出る」 in the confirm leaves the class', () => {
        const h = renderView();
        fireEvent.click(screen.getByTestId('classroom-leave'));
        fireEvent.click(screen.getByTestId('classroom-leave-confirm'));
        expect(h.onLeaveClassroom).toHaveBeenCalledTimes(1);
    });

    test('a returned submission shows the teacher comment', () => {
        renderView({
            classroomState: baseState({ submissionStatus: 'returned' }),
            teacherComment: 'よくできました',
        });
        expect(screen.getByTestId('classroom-submit-status')).toHaveTextContent('Returned');
        expect(screen.getByTestId('classroom-status-teacher-comment')).toHaveTextContent('よくできました');
    });

    test('a lesson assignment: the main button is 「レッスンを続ける」 until the goal is met', () => {
        const h = renderView({ lessonStatus: LESSON_STATUS, studentLesson: { submitWork: true } });
        expect(screen.getByTestId('classroom-status-lesson-progress')).toBeInTheDocument();
        expect(screen.queryByTestId('classroom-status-continue')).toBeNull();
        fireEvent.click(screen.getByTestId('classroom-continue-lesson-button'));
        expect(h.onStartLesson).toHaveBeenCalledTimes(1);
    });

    test('a cleared lesson that asks for a work: 「つづける」 is the main button, the lesson a small link', () => {
        renderView({
            lessonStatus: { ...LESSON_STATUS, requiredRemaining: 0, remaining: 0, cleared: true },
            studentLesson: { submitWork: true },
        });
        expect(screen.getByTestId('classroom-status-continue')).toBeInTheDocument();
        expect(screen.getByTestId('classroom-continue-lesson-button')).toBeInTheDocument();
        expect(screen.getByTestId('classroom-status-lesson-submit-guide')).toBeInTheDocument();
    });

    test('a lesson that does not ask for a work has no submission status in the info line', () => {
        renderView({ lessonStatus: LESSON_STATUS, studentLesson: { submitWork: false } });
        expect(screen.queryByTestId('classroom-submit-status')).toBeNull();
        expect(screen.getByTestId('classroom-student-refresh')).toBeInTheDocument();
    });
});

describe('StudentStatusView: リロードしたあとに「この課題で出した作品から続ける」 (#1825)', () => {
    const CURRENT = {
        classroomId: 'c1',
        submittedAt: '2026-11-10T01:00:00.000Z',
        projectUrl: 'https://signed.example/cur.sb3',
    };

    test('出すときは主ボタンが「この課題で出した作品から続ける」で、「このまま つづける」は小さなリンク', () => {
        const h = renderView({ continueOptions: { current: CURRENT, previous: null }, offerCurrentSubmission: true });
        const main = screen.getByTestId('classroom-status-continue-current');
        expect(main).toHaveTextContent('Continue from what you submitted for this assignment');
        expect(screen.queryByTestId('classroom-status-continue')).not.toBeInTheDocument();
        const keep = screen.getByTestId('classroom-status-continue-as-is');
        expect(keep).toHaveTextContent('Continue as it is');
        fireEvent.click(main);
        expect(h.onLoadSubmission).toHaveBeenCalledWith('current');
        fireEvent.click(keep);
        expect(h.onContinue).toHaveBeenCalledTimes(1);
    });

    test('出すときは「作品を読み込み直す」に同じ提出物を重ねて出さない', () => {
        renderView({
            continueOptions: { current: CURRENT, previous: CURRENT },
            hasStarter: true,
            offerCurrentSubmission: true,
        });
        fireEvent.click(screen.getByTestId('classroom-status-reload-toggle'));
        expect(screen.queryByTestId('classroom-status-reload-current')).not.toBeInTheDocument();
        expect(screen.getByTestId('classroom-status-reload-previous')).toBeInTheDocument();
        expect(screen.getByTestId('classroom-status-reload-starter')).toBeInTheDocument();
    });

    test('出さないときはいつもの「つづける」', () => {
        renderView({ continueOptions: { current: CURRENT, previous: null } });
        expect(screen.getByTestId('classroom-status-continue')).toBeInTheDocument();
        expect(screen.queryByTestId('classroom-status-continue-current')).not.toBeInTheDocument();
        expect(screen.queryByTestId('classroom-status-continue-as-is')).not.toBeInTheDocument();
    });

    test('レッスンの課題では、いまの主ボタン（レッスンを続ける）を優先する', () => {
        renderView({
            continueOptions: { current: CURRENT, previous: null },
            offerCurrentSubmission: true,
            lessonStatus: LESSON_STATUS,
            studentLesson: { submitWork: true, challengeIds: ['a', 'b'] },
        });
        expect(screen.queryByTestId('classroom-status-continue-current')).not.toBeInTheDocument();
    });
});
