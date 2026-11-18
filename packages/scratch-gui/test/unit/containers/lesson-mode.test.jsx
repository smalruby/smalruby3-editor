/* eslint-env jest */
import '@testing-library/jest-dom';
import { act, fireEvent, render, waitFor } from '@testing-library/react';
import React from 'react';
import { IntlProvider } from 'react-intl';
import { LessonMode } from '../../../src/containers/lesson-mode.jsx';
import analytics from '../../../src/lib/analytics';
import { applySetup } from '../../../src/lib/lessons/apply-setup';
import { applyChallengeStart } from '../../../src/lib/lessons/challenge-start';
import * as courses from '../../../src/lib/lessons/courses';
import { findChallenge } from '../../../src/lib/lessons/courses';
import { targetCodeToBlocks } from '../../../src/lib/ruby-to-blocks-converter';

jest.mock('../../../src/lib/analytics', () => ({ event: jest.fn() }));
jest.mock('../../../src/lib/lessons/apply-setup', () => ({
    ...jest.requireActual('../../../src/lib/lessons/apply-setup'),
    applySetup: jest.fn(() => Promise.resolve()),
}));
jest.mock('../../../src/lib/ruby-to-blocks-converter', () => ({
    __esModule: true,
    ...jest.requireActual('../../../src/lib/ruby-to-blocks-converter'),
    targetCodeToBlocks: jest.fn(() => Promise.resolve({ result: true })),
}));
jest.mock('../../../src/lib/lessons/challenge-start', () => ({
    applyChallengeStart: jest.fn(() => Promise.resolve()),
}));
// 吹き出しのコンテナは Redux の store が要るので、ここでは出さない（containers/lesson-hint.test.jsx で確かめる）
jest.mock('../../../src/containers/lesson-hint.jsx', () => () => null);
jest.mock('../../../src/containers/lesson-practice-partner.jsx', () => () => null);

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
    onSetRole: jest.fn(),
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
        applySetup.mockClear();
        applyChallengeStart.mockClear();
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

    // 画面の部分の名前の札（#2133）
    test('the "Guide" button shows the part names for a few seconds, and hides them when pressed again', () => {
        jest.useFakeTimers();
        try {
            const props = {
                ...baseProps(),
                current: findChallenge(CHALLENGE_ID),
                hint: { visible: false, index: 0, count: 2, step: {} },
            };
            const { getByTestId, queryByTestId } = renderLessonMode(props);
            expect(queryByTestId('lesson-part-names')).not.toBeInTheDocument();
            fireEvent.click(getByTestId('lesson-task-bar-part-names'));
            expect(getByTestId('lesson-part-names')).toBeInTheDocument();
            expect(getByTestId('lesson-task-bar-part-names')).toHaveAttribute('aria-pressed', 'true');
            fireEvent.click(getByTestId('lesson-task-bar-part-names'));
            expect(queryByTestId('lesson-part-names')).not.toBeInTheDocument();
            fireEvent.click(getByTestId('lesson-task-bar-part-names'));
            act(() => {
                jest.advanceTimersByTime(6000);
            });
            expect(queryByTestId('lesson-part-names')).not.toBeInTheDocument();
        } finally {
            jest.useRealTimers();
        }
    });

    test('a lesson with showPartNames shows the part names from the start and keeps them', () => {
        jest.useFakeTimers();
        try {
            const found = findChallenge(CHALLENGE_ID);
            const props = {
                ...baseProps(),
                current: { ...found, lesson: { ...found.lesson, showPartNames: true } },
                hint: { visible: false, index: 0, count: 2, step: {} },
            };
            const { getByTestId, queryByTestId } = renderLessonMode(props);
            expect(getByTestId('lesson-part-names')).toBeInTheDocument();
            act(() => {
                jest.advanceTimersByTime(10000);
            });
            fireEvent.pointerDown(document.body);
            expect(getByTestId('lesson-part-names')).toBeInTheDocument();
            fireEvent.click(getByTestId('lesson-task-bar-part-names'));
            expect(queryByTestId('lesson-part-names')).not.toBeInTheDocument();
            fireEvent.click(getByTestId('lesson-task-bar-part-names'));
            act(() => {
                jest.advanceTimersByTime(10000);
            });
            expect(getByTestId('lesson-part-names')).toBeInTheDocument();
        } finally {
            jest.useRealTimers();
        }
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
        expect(props.onOpenChallenge).toHaveBeenCalledWith('blocks-l1-quiz', null);
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
        expect(applySetup).not.toHaveBeenCalled();
        rerender({ ...props, isAnyCreatingNewState: false, isShowingProject: true, isShowingWithoutId: true });
        expect(applySetup).toHaveBeenCalledWith({ tab: 'code' }, props.dispatch, props.vm);
        await flush();
        // apply-setup（拡張機能）のあとで、スプライトの置きかえと前の段の答え（lib/lessons/challenge-start.js）
        expect(applyChallengeStart).toHaveBeenCalledWith(
            props.vm,
            { tab: 'code' },
            expect.objectContaining({ locale: 'en', toBlocks: expect.any(Function) }),
        );
        await flush();
        expect(props.onOpenChallenge).toHaveBeenCalledWith(CHALLENGE_ID, null);
    });

    const startedProps = (overrides = {}) => ({
        ...baseProps(),
        pendingChallengeId: CHALLENGE_ID,
        isAnyCreatingNewState: true,
        isShowingProject: false,
        isShowingWithoutId: false,
        ...overrides,
    });
    const finishCreating = (rerender, props) =>
        rerender({ ...props, isAnyCreatingNewState: false, isShowingProject: true, isShowingWithoutId: true });

    test('after the start changed the project, redraws the Ruby code and marks the project unchanged', async () => {
        applyChallengeStart.mockImplementationOnce(() => Promise.resolve(true));
        const shimaraby = { id: 'r' };
        const props = startedProps({ vm: { id: 'vm', editingTarget: shimaraby }, rubyVersion: '2' });
        const { rerender } = renderLessonMode(props);
        finishCreating(rerender, props);
        await flush();
        await flush();
        expect(props.dispatch).toHaveBeenCalledWith(
            expect.objectContaining({ type: expect.stringContaining('RUBYCODE_TARGET'), target: shimaraby }),
        );
        // 準備で変えた分は生徒の変更ではない（選び直しで「置きかえますか」を出さない）
        expect(props.dispatch).toHaveBeenCalledWith({
            type: 'scratch-gui/project-changed/SET_PROJECT_CHANGED',
            changed: false,
        });
        expect(props.onOpenChallenge).toHaveBeenCalledWith(CHALLENGE_ID, null);
    });

    test('does not mark the project unchanged when the start changed nothing', async () => {
        const props = startedProps();
        const { rerender } = renderLessonMode(props);
        finishCreating(rerender, props);
        await flush();
        await flush();
        expect(props.dispatch).not.toHaveBeenCalledWith(expect.objectContaining({ changed: false }));
        expect(props.onOpenChallenge).toHaveBeenCalledWith(CHALLENGE_ID, null);
    });

    test('opens the challenge even when the start fails', async () => {
        jest.spyOn(console, 'warn').mockImplementation(() => {});
        applyChallengeStart.mockImplementationOnce(() => Promise.reject(new Error('boom')));
        const props = startedProps();
        const { rerender } = renderLessonMode(props);
        finishCreating(rerender, props);
        await flush();
        await flush();
        expect(props.onOpenChallenge).toHaveBeenCalledWith(CHALLENGE_ID, null);
    });

    test('converts the starting answer in the Ruby version of the setup, or the current one', async () => {
        const props = startedProps({ rubyVersion: '1' });
        const { rerender } = renderLessonMode(props);
        finishCreating(rerender, props);
        await flush();
        await applyChallengeStart.mock.calls[0][2].toBlocks({ id: 't' }, 'x');
        expect(targetCodeToBlocks.mock.calls[0][4]).toEqual({ version: '1' });

        applyChallengeStart.mockClear();
        targetCodeToBlocks.mockClear();
        const found = findChallenge(CHALLENGE_ID);
        const spy = jest.spyOn(courses, 'findChallenge').mockReturnValue({
            ...found,
            challenge: { ...found.challenge, setup: { rubyVersion: 2 } },
        });
        const next = startedProps({ rubyVersion: '1' });
        const second = renderLessonMode(next);
        finishCreating(second.rerender, next);
        await flush();
        await applyChallengeStart.mock.calls[0][2].toBlocks({ id: 't' }, 'x');
        expect(targetCodeToBlocks.mock.calls[0][4]).toEqual({ version: '2' });
        spy.mockRestore();
    });

    test('the start stops once another challenge or another project takes over', async () => {
        const stageA = { id: 'a' };
        const vm = { id: 'vm', runtime: { getTargetForStage: jest.fn(() => stageA) } };
        const props = startedProps({ vm });
        const { rerender } = renderLessonMode(props);
        finishCreating(rerender, props);
        await flush();
        const { isCurrent } = applyChallengeStart.mock.calls[0][2];
        expect(isCurrent()).toBe(true);
        // 作品が差しかわるとステージも変わる
        vm.runtime.getTargetForStage.mockReturnValue({ id: 'b' });
        expect(isCurrent()).toBe(false);
    });

    test('does not open the challenge when it was cancelled during the setup', async () => {
        let resolveSetup;
        applySetup.mockImplementationOnce(() => new Promise((resolve) => (resolveSetup = resolve)));
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
        applySetup.mockImplementationOnce(() => Promise.reject(new Error('boom')));
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
        expect(props.onOpenChallenge).toHaveBeenCalledWith(CHALLENGE_ID, null);
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

describe('LessonMode container: the role of a pair challenge (#2062)', () => {
    beforeEach(() => {
        window.localStorage.clear();
        applySetup.mockClear();
        applyChallengeStart.mockClear();
    });

    const startRole = (id, overrides = {}) => ({
        ...baseProps(),
        pendingChallengeId: id,
        isAnyCreatingNewState: true,
        isShowingProject: false,
        isShowingWithoutId: false,
        ...overrides,
    });
    const finish = (rerender, props) =>
        rerender({ ...props, isAnyCreatingNewState: false, isShowingProject: true, isShowingWithoutId: true });
    const seatGroupVm = (groupName) => {
        const listeners = {};
        return {
            id: 'vm',
            runtime: {
                peripheralExtensions: { meshV2: { connectionState: 'connected', meshService: { groupName } } },
                on: (name, fn) => {
                    listeners[name] = fn;
                },
                removeListener: () => {},
                getTargetForStage: () => null,
            },
            emit: (name) => listeners[name] && listeners[name](),
        };
    };

    test('a challenge without roles opens without a role', async () => {
        const props = startRole('chat-l3-mesh-signal');
        const { rerender } = renderLessonMode(props);
        finish(rerender, props);
        await flush();
        await flush();
        expect(props.onOpenChallenge).toHaveBeenCalledWith('chat-l3-mesh-signal', null);
    });

    test('the remembered Shimacat role starts the challenge with the swapped programs', async () => {
        window.localStorage.setItem('smalruby:lessonRole', JSON.stringify({ role: 'shimacat', pair: null }));
        const props = startRole('chat-l4-send-repeat');
        const { rerender } = renderLessonMode(props);
        finish(rerender, props);
        await flush();
        await flush();
        const setup = applyChallengeStart.mock.calls[0][1];
        expect(setup.sprites).toEqual(['Shimacat', 'Shimaraby']);
        expect(setup.code.ja).toContain('$シマネコのメッセージ');
        expect(props.onOpenChallenge).toHaveBeenCalledWith('chat-l4-send-repeat', {
            role: 'shimacat',
            source: 'remembered',
            pair: null,
        });
    });

    test('in a seat pair, the larger seat plays Shimacat', async () => {
        const { buildGroupName, withSeatSuffix } = jest.requireActual(
            '@smalruby/scratch-vm/src/extensions/scratch3_mesh_v2/seat-naming',
        );
        const vm = seatGroupVm(buildGroupName(withSeatSuffix('abcdef12', 3), { seats: [7], host: 3 }));
        const props = startRole('chat-l3-mesh-variable', { vm, mySeat: 7 });
        const { rerender } = renderLessonMode(props);
        finish(rerender, props);
        await flush();
        await flush();
        expect(props.onOpenChallenge).toHaveBeenCalledWith('chat-l3-mesh-variable', {
            role: 'shimacat',
            source: 'seat',
            pair: '3-7',
        });
    });

    test('starting again in the chosen role uses that role', async () => {
        const props = startRole('chat-l4-both-ways', { pendingRole: 'shimacat', pendingRoleSource: 'chosen' });
        const { rerender } = renderLessonMode(props);
        finish(rerender, props);
        await flush();
        await flush();
        expect(props.onOpenChallenge).toHaveBeenCalledWith(
            'chat-l4-both-ways',
            expect.objectContaining({ role: 'shimacat', source: 'chosen' }),
        );
    });

    const openRole = (id, overrides = {}) => {
        const found = findChallenge(id);
        return {
            ...baseProps(),
            current: { course: found.course, lesson: found.lesson, challenge: found.challenge },
            role: { role: 'shimaraby', source: 'default' },
            ...overrides,
        };
    };

    test('the role buttons are shown, and choosing starts again in that role and remembers it', () => {
        const props = openRole('chat-l3-mesh-variable');
        const { getByTestId } = renderLessonMode(props);
        expect(getByTestId('lesson-task-bar-role-shimaraby')).toHaveAttribute('aria-pressed', 'true');
        fireEvent.click(getByTestId('lesson-task-bar-role-shimacat'));
        // 3-3 も始めなおす（先に作った変数と、入れかわった練習相手の変数の名前がぶつからないように）
        expect(props.onStartChallenge).toHaveBeenCalledWith('chat-l3-mesh-variable', {
            fromAssignment: false,
            role: 'shimacat',
            roleSource: 'chosen',
        });
        expect(props.onSetRole).not.toHaveBeenCalled();
        // 生徒が選んだ役だけを覚える
        expect(JSON.parse(window.localStorage.getItem('smalruby:lessonRole'))).toEqual({
            role: 'shimacat',
            pair: null,
        });
    });

    test('the default role is not remembered (no "Last time" for a student who never chose)', async () => {
        const props = startRole('chat-l4-send-once');
        const { rerender } = renderLessonMode(props);
        finish(rerender, props);
        await flush();
        await flush();
        expect(props.onOpenChallenge).toHaveBeenCalledWith('chat-l4-send-once', {
            role: 'shimaraby',
            source: 'default',
            pair: null,
        });
        expect(window.localStorage.getItem('smalruby:lessonRole')).toBeNull();
    });

    test('shows how the role was decided ("Last time" / "Decided by seat number")', () => {
        const props = openRole('chat-l3-mesh-variable', { role: { role: 'shimacat', source: 'remembered' } });
        const { getByTestId, rerender } = renderLessonMode(props);
        expect(getByTestId('lesson-task-bar-role-note')).toHaveTextContent('Last time: Shimacat');
        rerender({ ...props, role: { role: 'shimacat', source: 'seat' } });
        expect(getByTestId('lesson-task-bar-role-note')).toHaveTextContent('Decided by seat number');
    });

    test('connecting to a seat pair decides the role unless the student chose one', () => {
        const { buildGroupName, withSeatSuffix } = jest.requireActual(
            '@smalruby/scratch-vm/src/extensions/scratch3_mesh_v2/seat-naming',
        );
        const vm = seatGroupVm(buildGroupName(withSeatSuffix('abcdef12', 3), { seats: [7], host: 3 }));
        // 出席番号の大きい人: シマネコの役で始めなおす（作品はまだ変えていない）
        const props = openRole('chat-l3-mesh-variable', { vm, mySeat: 7 });
        renderLessonMode(props);
        act(() => vm.emit('PERIPHERAL_CONNECTED'));
        expect(props.onStartChallenge).toHaveBeenCalledWith('chat-l3-mesh-variable', {
            fromAssignment: false,
            role: 'shimacat',
            roleSource: 'seat',
        });

        // このチャレンジで自分で選んだときは、何もしない
        const chosen = openRole('chat-l3-mesh-variable', {
            vm,
            mySeat: 7,
            role: { role: 'shimaraby', source: 'chosen' },
        });
        renderLessonMode(chosen);
        act(() => vm.emit('PERIPHERAL_CONNECTED'));
        expect(chosen.onSetRole).not.toHaveBeenCalled();
        expect(chosen.onStartChallenge).not.toHaveBeenCalled();
    });

    test('the seat role that is the same as now only changes how it was decided', () => {
        const { buildGroupName, withSeatSuffix } = jest.requireActual(
            '@smalruby/scratch-vm/src/extensions/scratch3_mesh_v2/seat-naming',
        );
        const vm = seatGroupVm(buildGroupName(withSeatSuffix('abcdef12', 3), { seats: [7], host: 3 }));
        const props = openRole('chat-l3-mesh-variable', { vm, mySeat: 3 });
        renderLessonMode(props);
        act(() => vm.emit('PERIPHERAL_CONNECTED'));
        expect(props.onSetRole).toHaveBeenCalledWith('shimaraby', { roleSource: 'seat', rolePair: '3-7' });
        expect(props.onStartChallenge).not.toHaveBeenCalled();
    });

    test('a role chosen before with the same pair is not overwritten by the seat role', () => {
        // 読み直しで再現した入力: 同じペア（3-7）で前にシマネコの役を選んだ 3 番が、あとから 7 番のグループにつながる
        window.localStorage.setItem('smalruby:lessonRole', JSON.stringify({ role: 'shimacat', pair: '3-7' }));
        const { buildGroupName, withSeatSuffix } = jest.requireActual(
            '@smalruby/scratch-vm/src/extensions/scratch3_mesh_v2/seat-naming',
        );
        const vm = seatGroupVm(buildGroupName(withSeatSuffix('abcdef12', 3), { seats: [7], host: 3 }));
        const props = openRole('chat-l3-mesh-variable', {
            vm,
            mySeat: 3,
            role: { role: 'shimacat', source: 'remembered' },
        });
        renderLessonMode(props);
        act(() => vm.emit('PERIPHERAL_CONNECTED'));
        expect(props.onSetRole).not.toHaveBeenCalled();
        expect(props.onStartChallenge).not.toHaveBeenCalled();
    });

    test('a seat pair after the student changed the project does not start again', () => {
        const { buildGroupName, withSeatSuffix } = jest.requireActual(
            '@smalruby/scratch-vm/src/extensions/scratch3_mesh_v2/seat-naming',
        );
        const vm = seatGroupVm(buildGroupName(withSeatSuffix('abcdef12', 3), { seats: [7], host: 3 }));
        const props = openRole('chat-l5-stamp', { vm, mySeat: 7, projectChanged: true });
        renderLessonMode(props);
        act(() => vm.emit('PERIPHERAL_CONNECTED'));
        expect(props.onStartChallenge).not.toHaveBeenCalled();
        expect(props.onSetRole).not.toHaveBeenCalled();
    });
});
