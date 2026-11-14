/* eslint-env jest */
import '@testing-library/jest-dom';
import { act, fireEvent, render, waitFor } from '@testing-library/react';
import React from 'react';
import { IntlProvider } from 'react-intl';
import { LessonMode } from '../../../src/containers/lesson-mode.jsx';
import analytics from '../../../src/lib/analytics';
import { applyDeckSetup } from '../../../src/lib/deck-setup';
import { findChallenge } from '../../../src/lib/lessons/courses';

jest.mock('../../../src/lib/analytics', () => ({ event: jest.fn() }));
jest.mock('../../../src/lib/deck-setup', () => ({
    applyDeckSetup: jest.fn(() => Promise.resolve()),
}));
// 吹き出しのコンテナは Redux の store が要るので、ここでは出さない（containers/lesson-hint.test.jsx で確かめる）
jest.mock('../../../src/containers/lesson-hint.jsx', () => () => null);

const CHALLENGE_ID = 'blocks-l1-click-say';

const baseProps = () => ({
    current: null,
    dispatch: jest.fn(),
    dnclMode: false,
    hint: null,
    isAnyCreatingNewState: false,
    isShowingProject: true,
    isShowingWithoutId: true,
    onCancelStart: jest.fn(),
    onCloseLesson: jest.fn(),
    onDismissCompleted: jest.fn(),
    onEndLesson: jest.fn(),
    onExitDnclMode: jest.fn(),
    onHideCompleted: jest.fn(),
    onHideHint: jest.fn(),
    onShowCompleted: jest.fn(),
    onOpenChallenge: jest.fn(),
    onRequestNewProject: jest.fn(),
    onShowHint: jest.fn(),
    onStartChallenge: jest.fn(),
    pendingChallengeId: null,
    projectChanged: false,
    vm: { id: 'vm' },
});

const renderLessonMode = (props) => {
    const utils = render(
        <IntlProvider locale="en">
            <LessonMode {...props} />
        </IntlProvider>,
    );
    const rerender = (next) =>
        utils.rerender(
            <IntlProvider locale="en">
                <LessonMode {...next} />
            </IntlProvider>,
        );
    return { ...utils, rerender };
};

const flush = () => act(() => Promise.resolve());

describe('LessonMode container', () => {
    beforeEach(() => {
        applyDeckSetup.mockClear();
        jest.spyOn(window, 'confirm').mockReturnValue(true);
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    test('renders nothing outside lesson mode', () => {
        const { queryByTestId } = renderLessonMode(baseProps());
        expect(queryByTestId('lesson-task-bar')).not.toBeInTheDocument();
    });

    test('renders the task bar in lesson mode and leaves it with the "try another challenge" button', () => {
        const props = {
            ...baseProps(),
            current: findChallenge(CHALLENGE_ID),
            hint: { visible: false, index: 0, count: 0, step: null },
        };
        const { getByTestId } = renderLessonMode(props);
        expect(getByTestId('lesson-task-bar-position')).toHaveTextContent('3 of 4');
        fireEvent.click(getByTestId('lesson-task-bar-quit'));
        expect(props.onCloseLesson).toHaveBeenCalledTimes(1);
    });

    test('shows the activity diagram of the answer in the full text when the challenge asks for it', async () => {
        const found = findChallenge('blocks-l1-quiz');
        const props = {
            ...baseProps(),
            current: { ...found, challenge: { ...found.challenge, activityDiagram: true } },
            hint: { visible: false, index: 0, count: 0, step: null },
        };
        const { getByTestId } = renderLessonMode(props);
        const event = new MouseEvent('pointerover', { bubbles: true });
        Object.defineProperty(event, 'pointerType', { value: 'mouse' });
        act(() => {
            getByTestId('lesson-task-bar').dispatchEvent(event);
        });
        await waitFor(() => expect(getByTestId('lesson-task-bar-full-text-diagram')).toBeInTheDocument(), {
            timeout: 5000,
        });
        const svg = getByTestId('lesson-activity-diagram');
        expect(svg.querySelectorAll('[data-shape="decision"]')).toHaveLength(1);
        expect(svg.textContent).toContain('ask "4+3=?" and wait');
    });

    test('shows no activity diagram for a challenge that does not ask for it', async () => {
        const props = {
            ...baseProps(),
            current: findChallenge('blocks-l1-quiz'),
            hint: { visible: false, index: 0, count: 0, step: null },
        };
        const { getByTestId, queryByTestId } = renderLessonMode(props);
        const event = new MouseEvent('pointerover', { bubbles: true });
        Object.defineProperty(event, 'pointerType', { value: 'mouse' });
        act(() => {
            getByTestId('lesson-task-bar').dispatchEvent(event);
        });
        await waitFor(() => expect(getByTestId('lesson-task-bar-full-text')).toBeInTheDocument());
        expect(queryByTestId('lesson-task-bar-full-text-diagram')).toBeNull();
    });

    test('"End lesson" leaves the lesson without opening the lessons library', () => {
        const props = {
            ...baseProps(),
            current: findChallenge(CHALLENGE_ID),
            hint: { visible: false, index: 0, count: 0, step: null },
        };
        const { getByTestId } = renderLessonMode(props);
        fireEvent.click(getByTestId('lesson-task-bar-end'));
        expect(props.onEndLesson).toHaveBeenCalledTimes(1);
        expect(props.onCloseLesson).not.toHaveBeenCalled();
    });

    test('sends other_challenge / lesson_end to GA with the challenge (no class data)', () => {
        analytics.event.mockClear();
        const props = {
            ...baseProps(),
            current: findChallenge(CHALLENGE_ID),
            fromAssignment: true,
            hint: { visible: false, index: 0, count: 0, step: null },
        };
        const { getByTestId } = renderLessonMode(props);
        fireEvent.click(getByTestId('lesson-task-bar-quit'));
        fireEvent.click(getByTestId('lesson-task-bar-end'));
        const ids = {
            category: 'lessons',
            label: CHALLENGE_ID,
            course_id: 'kyou-kara-programmer',
            lesson_id: findChallenge(CHALLENGE_ID).lesson.id,
            challenge_id: CHALLENGE_ID,
            from_assignment: true,
        };
        expect(analytics.event.mock.calls).toEqual([
            [{ ...ids, action: 'other_challenge' }],
            [{ ...ids, action: 'lesson_end' }],
        ]);
    });

    test('does not send the task bar events to GA while a classroom teacher is logged in', () => {
        analytics.event.mockClear();
        const props = {
            ...baseProps(),
            current: findChallenge(CHALLENGE_ID),
            teacherLoggedIn: true,
            hint: { visible: false, index: 0, count: 0, step: null },
        };
        const { getByTestId } = renderLessonMode(props);
        fireEvent.click(getByTestId('lesson-task-bar-quit'));
        fireEvent.click(getByTestId('lesson-task-bar-end'));
        expect(analytics.event).not.toHaveBeenCalled();
        expect(props.onCloseLesson).toHaveBeenCalledTimes(1);
        expect(props.onEndLesson).toHaveBeenCalledTimes(1);
    });

    test('hint button shows the hint, and hides it when it is visible', () => {
        const props = {
            ...baseProps(),
            current: findChallenge(CHALLENGE_ID),
            hint: { visible: false, index: 0, count: 2, step: {} },
        };
        const { getByTestId, rerender } = renderLessonMode(props);
        fireEvent.click(getByTestId('lesson-task-bar-hint'));
        expect(props.onShowHint).toHaveBeenCalledTimes(1);
        rerender({ ...props, hint: { ...props.hint, visible: true } });
        fireEvent.click(getByTestId('lesson-task-bar-hint'));
        expect(props.onHideHint).toHaveBeenCalledTimes(1);
    });

    test('tapping the task to open the full text hides the hint balloon and dismisses the "You did it!" toast', () => {
        const props = {
            ...baseProps(),
            current: findChallenge(CHALLENGE_ID),
            hint: { visible: true, index: 0, count: 2, step: {} },
            toastVisible: true,
        };
        const { getByTestId } = renderLessonMode(props);
        // ポインタの種類が分からない click（タップ・キーボード）で開く
        fireEvent.click(getByTestId('lesson-task-bar-task'));
        expect(props.onHideHint).toHaveBeenCalledTimes(1);
        expect(props.onDismissCompleted).toHaveBeenCalledTimes(1);
    });

    // クイズのある「できた！」は、全文を開いても閉じない。全文のあいだだけ隠し、全文を閉じたら出し直す（#1639 Q1）
    test('the full text hides a toast with a quiz while it is open, and shows it again after', () => {
        const quiz = { question: {}, choices: [], answer: 0, explanation: {} };
        const found = findChallenge(CHALLENGE_ID);
        const onHideCompleted = jest.fn();
        const onShowCompleted = jest.fn();
        const onDismissCompleted = jest.fn();
        // Redux の代わり: completedHidden を持ち、toastVisible はいっとき隠しているあいだ false（mapStateToProps）
        const Harness = () => {
            const [completedHidden, setHidden] = React.useState(false);
            return (
                <IntlProvider locale="en">
                    <LessonMode
                        {...baseProps()}
                        completedHidden={completedHidden}
                        current={{ ...found, challenge: { ...found.challenge, quiz } }}
                        hint={{ visible: false, index: 0, count: 2, step: {} }}
                        onDismissCompleted={onDismissCompleted}
                        onHideCompleted={() => {
                            onHideCompleted();
                            setHidden(true);
                        }}
                        onShowCompleted={() => {
                            onShowCompleted();
                            setHidden(false);
                        }}
                        toastVisible={!completedHidden}
                    />
                </IntlProvider>
            );
        };
        const { getByTestId, queryByTestId } = render(<Harness />);
        fireEvent.click(getByTestId('lesson-task-bar-task'));
        // 「できた！」は閉じずに隠すだけ。全文は開いたまま
        expect(onDismissCompleted).not.toHaveBeenCalled();
        expect(onHideCompleted).toHaveBeenCalledTimes(1);
        expect(getByTestId('lesson-task-bar-full-text')).toBeInTheDocument();
        expect(onShowCompleted).not.toHaveBeenCalled();
        // 全文を閉じると「できた！」を出し直す
        fireEvent.keyDown(document, { key: 'Escape' });
        expect(queryByTestId('lesson-task-bar-full-text')).toBeNull();
        expect(onShowCompleted).toHaveBeenCalledTimes(1);
    });

    test('closing the full text does not show a toast that was not hidden', () => {
        const props = {
            ...baseProps(),
            current: findChallenge(CHALLENGE_ID),
            hint: { visible: false, index: 0, count: 2, step: {} },
            toastVisible: false,
        };
        const { getByTestId } = renderLessonMode(props);
        fireEvent.click(getByTestId('lesson-task-bar-task'));
        fireEvent.keyDown(document, { key: 'Escape' });
        expect(props.onShowCompleted).not.toHaveBeenCalled();
    });

    test('opening the full text leaves a hidden hint and no toast alone', () => {
        const props = {
            ...baseProps(),
            current: findChallenge(CHALLENGE_ID),
            hint: { visible: false, index: 0, count: 2, step: {} },
            toastVisible: false,
        };
        const { getByTestId } = renderLessonMode(props);
        fireEvent.click(getByTestId('lesson-task-bar-task'));
        expect(getByTestId('lesson-task-bar-full-text')).toBeInTheDocument();
        expect(props.onHideHint).not.toHaveBeenCalled();
        expect(props.onDismissCompleted).not.toHaveBeenCalled();
    });

    test('a pending challenge starts a new project once', () => {
        const props = { ...baseProps(), pendingChallengeId: CHALLENGE_ID };
        const { rerender } = renderLessonMode(props);
        expect(props.onRequestNewProject).toHaveBeenCalledTimes(1);
        expect(window.confirm).not.toHaveBeenCalled();
        rerender({ ...props });
        expect(props.onRequestNewProject).toHaveBeenCalledTimes(1);
    });

    test('does not start a second new project when the pending challenge changes during creation', async () => {
        const props = { ...baseProps(), pendingChallengeId: CHALLENGE_ID };
        const { rerender } = renderLessonMode(props);
        expect(props.onRequestNewProject).toHaveBeenCalledTimes(1);
        // 作品を作っている間に別のチャレンジに変わる
        rerender({
            ...props,
            pendingChallengeId: 'blocks-l1-quiz',
            isAnyCreatingNewState: true,
            isShowingProject: false,
        });
        rerender({
            ...props,
            pendingChallengeId: 'blocks-l1-quiz',
            isAnyCreatingNewState: false,
            isShowingProject: true,
        });
        await flush();
        expect(props.onRequestNewProject).toHaveBeenCalledTimes(1);
        expect(props.onOpenChallenge).toHaveBeenCalledWith('blocks-l1-quiz');
    });

    test('waits until a project is showing before starting a new one', () => {
        const props = { ...baseProps(), pendingChallengeId: CHALLENGE_ID, isShowingProject: false };
        const { rerender } = renderLessonMode(props);
        expect(props.onRequestNewProject).not.toHaveBeenCalled();
        rerender({ ...props, isShowingProject: true });
        expect(props.onRequestNewProject).toHaveBeenCalledTimes(1);
    });

    test('asks before replacing a changed project and cancels when declined', () => {
        window.confirm.mockReturnValue(false);
        const props = { ...baseProps(), pendingChallengeId: CHALLENGE_ID, projectChanged: true };
        renderLessonMode(props);
        expect(window.confirm).toHaveBeenCalledTimes(1);
        expect(props.onCancelStart).toHaveBeenCalledTimes(1);
        expect(props.onRequestNewProject).not.toHaveBeenCalled();
    });

    test('replaces a changed project when the user agrees', () => {
        const props = { ...baseProps(), pendingChallengeId: CHALLENGE_ID, projectChanged: true };
        renderLessonMode(props);
        expect(window.confirm).toHaveBeenCalledTimes(1);
        expect(props.onRequestNewProject).toHaveBeenCalledTimes(1);
    });

    // 日本語モードのあいだはパレットが日本語で書けるブロックに絞られ、チャレンジのブロックが出ない（#1735）
    test('leaves the Japanese mode before starting a new project for the challenge', () => {
        const props = { ...baseProps(), pendingChallengeId: CHALLENGE_ID, dnclMode: true };
        renderLessonMode(props);
        expect(props.onExitDnclMode).toHaveBeenCalledTimes(1);
        expect(props.onRequestNewProject).toHaveBeenCalledTimes(1);
    });

    test('keeps the Japanese mode when replacing the project is declined', () => {
        window.confirm.mockReturnValue(false);
        const props = {
            ...baseProps(),
            pendingChallengeId: CHALLENGE_ID,
            projectChanged: true,
            dnclMode: true,
        };
        renderLessonMode(props);
        expect(props.onCancelStart).toHaveBeenCalledTimes(1);
        expect(props.onExitDnclMode).not.toHaveBeenCalled();
    });

    test('does not touch the mode outside the Japanese mode', () => {
        const props = { ...baseProps(), pendingChallengeId: CHALLENGE_ID };
        renderLessonMode(props);
        expect(props.onExitDnclMode).not.toHaveBeenCalled();
    });

    test('applies the setup and opens the challenge once the new project is showing', async () => {
        const props = {
            ...baseProps(),
            pendingChallengeId: CHALLENGE_ID,
            isAnyCreatingNewState: true,
            isShowingProject: false,
            isShowingWithoutId: false,
        };
        const { rerender } = renderLessonMode(props);
        expect(applyDeckSetup).not.toHaveBeenCalled();
        rerender({ ...props, isAnyCreatingNewState: false, isShowingProject: true, isShowingWithoutId: true });
        expect(applyDeckSetup).toHaveBeenCalledWith({ tab: 'code' }, props.dispatch, props.vm);
        await flush();
        expect(props.onOpenChallenge).toHaveBeenCalledWith(CHALLENGE_ID);
    });

    test('does not open the challenge when it was cancelled during the setup', async () => {
        let resolveSetup;
        applyDeckSetup.mockImplementationOnce(() => new Promise((resolve) => (resolveSetup = resolve)));
        const props = {
            ...baseProps(),
            pendingChallengeId: CHALLENGE_ID,
            isAnyCreatingNewState: true,
            isShowingProject: false,
            isShowingWithoutId: false,
        };
        const { rerender } = renderLessonMode(props);
        rerender({ ...props, isAnyCreatingNewState: false, isShowingProject: true, isShowingWithoutId: true });
        rerender({ ...props, pendingChallengeId: null, isAnyCreatingNewState: false, isShowingProject: true });
        await act(async () => {
            resolveSetup();
            await Promise.resolve();
        });
        expect(props.onOpenChallenge).not.toHaveBeenCalled();
    });

    test('opens the challenge even when the setup fails', async () => {
        jest.spyOn(console, 'warn').mockImplementation(() => {});
        applyDeckSetup.mockImplementationOnce(() => Promise.reject(new Error('boom')));
        const props = {
            ...baseProps(),
            pendingChallengeId: CHALLENGE_ID,
            isAnyCreatingNewState: true,
            isShowingProject: false,
            isShowingWithoutId: false,
        };
        const { rerender } = renderLessonMode(props);
        rerender({ ...props, isAnyCreatingNewState: false, isShowingProject: true, isShowingWithoutId: true });
        await flush();
        await flush();
        expect(props.onOpenChallenge).toHaveBeenCalledWith(CHALLENGE_ID);
    });

    // 課題バーが出る・消えると、ステージの列が上下に動く（大きさは変わらない）。ステージは
    // window の resize / scroll でしか canvas の位置を測り直さないので、知らせないとマウスの
    // 位置が課題バーの高さの分ずれて、ネコにさわっても「さわった」にならない（#1581）
    test('tells the stage to measure again when the task bar appears and disappears', () => {
        const onResize = jest.fn();
        window.addEventListener('resize', onResize);
        try {
            const props = baseProps();
            const { rerender } = renderLessonMode(props);
            expect(onResize).not.toHaveBeenCalled();

            const inLesson = { ...props, current: findChallenge(CHALLENGE_ID), hint: null };
            rerender(inLesson);
            expect(onResize).toHaveBeenCalledTimes(1);

            // 同じチャレンジのまま描き直しても知らせない
            rerender({ ...inLesson, toastVisible: true });
            expect(onResize).toHaveBeenCalledTimes(1);

            rerender(props);
            expect(onResize).toHaveBeenCalledTimes(2);
        } finally {
            window.removeEventListener('resize', onResize);
        }
    });

    test('exposes window.smalruby.startChallenge while mounted', () => {
        const props = baseProps();
        const { unmount } = renderLessonMode(props);
        window.smalruby.startChallenge(CHALLENGE_ID);
        expect(props.onStartChallenge).toHaveBeenCalledWith(CHALLENGE_ID);
        unmount();
        expect(window.smalruby.startChallenge).toBeUndefined();
    });
});
