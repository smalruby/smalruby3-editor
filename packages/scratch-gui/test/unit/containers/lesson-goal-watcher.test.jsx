/* eslint-env jest */
import '@testing-library/jest-dom';
import { fireEvent, render } from '@testing-library/react';
import EventEmitter from 'events';
import React from 'react';
import { IntlProvider } from 'react-intl';
import { LessonGoalWatcher } from '../../../src/containers/lesson-goal-watcher.jsx';

jest.mock('../../../src/lib/lessons/courses.js', () => {
    const makeChallenge = (id, name) => ({
        id,
        name: { id: `gui.lessons.challenge.${id}.name`, defaultMessage: name },
        skills: [{ id: 's', name: { id: 'gui.lessons.skill.s.name', defaultMessage: 'Say things' } }],
        goal: [{ type: 'uses', trigger: { hat: 'event_whenflagclicked' }, blocks: ['looks_say'] }],
    });
    const lesson = {
        id: 'l',
        challenges: [makeChallenge('test-challenge', 'Test challenge'), makeChallenge('last-challenge', 'Last')],
    };
    const course = { id: 'c', language: 'blocks', lessons: [lesson] };
    return {
        COURSES: [course],
        findChallenge: (id) => {
            const challenge = lesson.challenges.find((c) => c.id === id);
            return challenge ? { course, lesson, challenge } : null;
        },
    };
});

const makeVm = () => {
    const runtime = new EventEmitter();
    const sprite = {
        id: 'cat',
        isStage: false,
        isOriginal: true,
        variables: {},
        blocks: { resetCache: () => {}, getBlock: () => ({ opcode: 'event_whenflagclicked', fields: {} }) },
        getCostumes: () => [{}],
    };
    runtime.targets = [sprite];
    runtime.getTargetForStage = () => null;
    runtime._primitives = { looks_say: () => {} };
    runtime.getOpcodeFunction = function (opcode) {
        return this._primitives[opcode];
    };
    return { runtime, sprite, extensionManager: { isExtensionLoaded: () => false } };
};

const noProgress = { version: 1, challenges: {} };
const doneRecord = { completedAt: '2026-11-10T00:00:00.000Z', courseId: 'c', lessonId: 'l' };

const renderWatcher = (props) =>
    render(
        <IntlProvider locale="en">
            <LessonGoalWatcher
                onCompleted={jest.fn()}
                onDismiss={jest.fn()}
                onNextChallenge={jest.fn()}
                progress={noProgress}
                {...props}
            />
        </IntlProvider>,
    );

const runFlagScript = (vm) => {
    const thread = { topBlock: 'hat', target: vm.sprite, blockContainer: vm.sprite.blocks };
    vm.runtime.getOpcodeFunction('looks_say')({ MESSAGE: 'hi' }, { thread, target: vm.sprite });
    vm.runtime.emit('BEFORE_STEP');
};

describe('LessonGoalWatcher', () => {
    afterEach(() => {
        delete window.smalruby;
    });

    test('watches the VM while a challenge is open and reports completion', () => {
        const vm = makeVm();
        const onCompleted = jest.fn();
        const { queryByTestId } = renderWatcher({
            vm,
            challengeId: 'test-challenge',
            justCompletedId: null,
            onCompleted,
        });
        expect(queryByTestId('lesson-completed-toast')).not.toBeInTheDocument();
        runFlagScript(vm);
        expect(onCompleted).toHaveBeenCalledWith('test-challenge');
        expect(onCompleted).toHaveBeenCalledTimes(1);
    });

    test('does not watch outside lesson mode and stops watching when the challenge closes', () => {
        const vm = makeVm();
        const onCompleted = jest.fn();
        const { rerender } = renderWatcher({ vm, challengeId: null, justCompletedId: null, onCompleted });
        runFlagScript(vm);
        expect(onCompleted).not.toHaveBeenCalled();

        rerender(
            <IntlProvider locale="en">
                <LessonGoalWatcher
                    vm={vm}
                    challengeId="test-challenge"
                    justCompletedId={null}
                    onCompleted={onCompleted}
                    onDismiss={jest.fn()}
                    onNextChallenge={jest.fn()}
                    progress={noProgress}
                />
            </IntlProvider>,
        );
        rerender(
            <IntlProvider locale="en">
                <LessonGoalWatcher
                    vm={vm}
                    challengeId={null}
                    justCompletedId={null}
                    onCompleted={onCompleted}
                    onDismiss={jest.fn()}
                    onNextChallenge={jest.fn()}
                    progress={noProgress}
                />
            </IntlProvider>,
        );
        expect(vm.runtime.listenerCount('BEFORE_STEP')).toBe(0);
        runFlagScript(vm);
        expect(onCompleted).not.toHaveBeenCalled();
    });

    test('shows the toast for the just-completed challenge and dismisses it', () => {
        const vm = makeVm();
        const onDismiss = jest.fn();
        const { getByTestId } = renderWatcher({
            vm,
            challengeId: 'test-challenge',
            justCompletedId: 'test-challenge',
            onDismiss,
        });
        expect(getByTestId('lesson-completed-toast-challenge')).toHaveTextContent('Test challenge');
        expect(getByTestId('lesson-completed-toast-skills')).toHaveTextContent('Say things');
        fireEvent.click(getByTestId('lesson-completed-toast-close'));
        expect(onDismiss).toHaveBeenCalledTimes(1);
    });

    test('"Next challenge" dismisses the toast and opens the library at the current challenge', () => {
        const onDismiss = jest.fn();
        const onNextChallenge = jest.fn();
        const { getByTestId } = renderWatcher({
            vm: makeVm(),
            challengeId: 'test-challenge',
            justCompletedId: 'test-challenge',
            onDismiss,
            onNextChallenge,
        });
        const next = getByTestId('lesson-completed-toast-next');
        expect(next).toHaveAttribute('data-action', 'next');
        fireEvent.click(next);
        expect(onDismiss).toHaveBeenCalledTimes(1);
        expect(onNextChallenge).toHaveBeenCalledWith('test-challenge');
    });

    test('the last challenge keeps "Next challenge" while the lesson has challenges not done', () => {
        const { getByTestId, queryByTestId } = renderWatcher({
            vm: makeVm(),
            challengeId: 'last-challenge',
            justCompletedId: 'last-challenge',
            progress: { version: 1, challenges: { 'last-challenge': doneRecord } },
        });
        expect(queryByTestId('lesson-completed-toast-last')).not.toBeInTheDocument();
        expect(getByTestId('lesson-completed-toast-next')).toHaveAttribute('data-action', 'next');
    });

    test('when every challenge of the lesson is done (no next lesson), points to the lessons library', () => {
        const { getByTestId } = renderWatcher({
            vm: makeVm(),
            challengeId: 'test-challenge',
            justCompletedId: 'test-challenge',
            progress: { version: 1, challenges: { 'test-challenge': doneRecord, 'last-challenge': doneRecord } },
        });
        expect(getByTestId('lesson-completed-toast-last')).toBeInTheDocument();
        expect(getByTestId('lesson-completed-toast-next')).toHaveAttribute('data-action', 'library');
    });

    test('exposes window.smalruby.lessonGoal while mounted with a VM', () => {
        const vm = makeVm();
        const { unmount } = renderWatcher({ vm, challengeId: null, justCompletedId: null });
        expect(typeof window.smalruby.lessonGoal.attach).toBe('function');
        const onSatisfied = jest.fn();
        const detach = window.smalruby.lessonGoal.attach(
            [{ type: 'uses', trigger: { hat: 'event_whenflagclicked' }, blocks: ['looks_say'] }],
            onSatisfied,
        );
        runFlagScript(vm);
        expect(onSatisfied).toHaveBeenCalledTimes(1);
        detach();
        unmount();
        expect(window.smalruby.lessonGoal).toBeUndefined();
    });
});
