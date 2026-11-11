/* eslint-env jest */
import '@testing-library/jest-dom';
import { act, fireEvent, render } from '@testing-library/react';
import React from 'react';
import { IntlProvider } from 'react-intl';
import { LessonMode } from '../../../src/containers/lesson-mode.jsx';
import { applyDeckSetup } from '../../../src/lib/deck-setup';
import { findChallenge } from '../../../src/lib/lessons/courses';

jest.mock('../../../src/lib/deck-setup', () => ({
    applyDeckSetup: jest.fn(() => Promise.resolve()),
}));
// 吹き出しのコンテナは Redux の store が要るので、ここでは出さない（containers/lesson-hint.test.jsx で確かめる）
jest.mock('../../../src/containers/lesson-hint.jsx', () => () => null);

const CHALLENGE_ID = 'blocks-l1-click-say';

const baseProps = () => ({
    current: null,
    dispatch: jest.fn(),
    hint: null,
    isAnyCreatingNewState: false,
    isShowingProject: true,
    isShowingWithoutId: true,
    onCancelStart: jest.fn(),
    onCloseLesson: jest.fn(),
    onDismissCompleted: jest.fn(),
    onHideHint: jest.fn(),
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
        expect(getByTestId('lesson-task-bar-position')).toHaveTextContent('3 of 11');
        fireEvent.click(getByTestId('lesson-task-bar-quit'));
        expect(props.onCloseLesson).toHaveBeenCalledTimes(1);
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

    test('exposes window.smalruby.startChallenge while mounted', () => {
        const props = baseProps();
        const { unmount } = renderLessonMode(props);
        window.smalruby.startChallenge(CHALLENGE_ID);
        expect(props.onStartChallenge).toHaveBeenCalledWith(CHALLENGE_ID);
        unmount();
        expect(window.smalruby.startChallenge).toBeUndefined();
    });
});
