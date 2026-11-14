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
        goal: [{ type: 'uses', trigger: { hat: 'event_whenflagclicked' }, blocks: ['looks_say'] }],
    });
    const lesson = {
        id: 'l',
        name: { id: 'gui.lessons.lesson.l.name', defaultMessage: 'Move it' },
        challenges: [makeChallenge('test-challenge', 'Test challenge'), makeChallenge('last-challenge', 'Last')],
    };
    // ふりかえりのクイズ（#1639）を持つチャレンジ
    lesson.challenges[1].quiz = {
        question: { id: 'test.quiz.question', defaultMessage: 'Which one?' },
        choices: ['A', 'B', 'C'].map((c) => ({ id: `test.quiz.${c}`, defaultMessage: c })),
        answer: 2,
        explanation: { id: 'test.quiz.explanation', defaultMessage: 'Because C.' },
    };
    const course = {
        id: 'c',
        language: 'blocks',
        name: { id: 'gui.lessons.course.c.name', defaultMessage: 'Starter course' },
        lessons: [lesson],
    };
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
                onSubmitAssignment={jest.fn()}
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
        const toast = getByTestId('lesson-completed-toast');
        expect(toast).toHaveAttribute('data-challenge-id', 'test-challenge');
        // チャレンジの名前は出さない（課題バーに出ている）
        expect(toast).not.toHaveTextContent('Test challenge');
        expect(getByTestId('lesson-completed-toast-title')).toHaveTextContent('You did it!');
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
        expect(onNextChallenge).toHaveBeenCalledWith('test-challenge', false);
    });

    test('the last challenge keeps "Next challenge" while the lesson has challenges not done', () => {
        const { getByTestId, queryByTestId } = renderWatcher({
            vm: makeVm(),
            challengeId: 'last-challenge',
            justCompletedId: 'last-challenge',
            progress: { version: 1, challenges: { 'last-challenge': doneRecord } },
        });
        expect(queryByTestId('lesson-completed-toast-detail')).not.toBeInTheDocument();
        expect(getByTestId('lesson-completed-toast-next')).toHaveAttribute('data-action', 'next');
        expect(getByTestId('lesson-completed-toast-remaining')).toHaveTextContent('1 more in this lesson');
        const dots = getByTestId('lesson-completed-toast-dots').children;
        expect(Array.from(dots).map((d) => [d.dataset.completed, d.dataset.current])).toEqual([
            ['false', 'false'],
            ['true', 'true'],
        ]);
    });

    test('when every challenge of the lesson is done (no next lesson), points to the lessons library', () => {
        const { getByTestId } = renderWatcher({
            vm: makeVm(),
            challengeId: 'test-challenge',
            justCompletedId: 'test-challenge',
            progress: { version: 1, challenges: { 'test-challenge': doneRecord, 'last-challenge': doneRecord } },
        });
        expect(getByTestId('lesson-completed-toast-title')).toHaveTextContent('Lesson 1 complete!');
        expect(getByTestId('lesson-completed-toast-detail')).toHaveTextContent(
            'That was every lesson in "Starter course".',
        );
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

    // 全文を開いているあいだは隠すだけで、クイズで選んだものは消さない（#1639 Q1）
    test('a hidden toast keeps the choice of the quiz and shows it again', () => {
        const props = { vm: makeVm(), challengeId: 'last-challenge', justCompletedId: 'last-challenge' };
        const { getAllByTestId, getByTestId, rerender } = renderWatcher(props);
        fireEvent.click(getAllByTestId('lesson-quiz-choice')[2]);
        const again = (completedHidden) =>
            rerender(
                <IntlProvider locale="en">
                    <LessonGoalWatcher
                        {...props}
                        completedHidden={completedHidden}
                        onCompleted={jest.fn()}
                        onDismiss={jest.fn()}
                        onNextChallenge={jest.fn()}
                        onSubmitAssignment={jest.fn()}
                        progress={noProgress}
                    />
                </IntlProvider>,
            );
        again(true);
        expect(getByTestId('lesson-completed-toast')).not.toBeVisible();
        again(false);
        expect(getByTestId('lesson-completed-toast')).toBeVisible();
        expect(getByTestId('lesson-quiz-result')).toHaveAttribute('data-correct', 'true');
    });

    test('passes the quiz of the challenge to the toast (#1639)', () => {
        const withQuiz = renderWatcher({
            vm: makeVm(),
            challengeId: 'last-challenge',
            justCompletedId: 'last-challenge',
        });
        expect(withQuiz.getByTestId('lesson-quiz-question')).toHaveTextContent('Which one?');
        withQuiz.unmount();
        const without = renderWatcher({
            vm: makeVm(),
            challengeId: 'test-challenge',
            justCompletedId: 'test-challenge',
        });
        expect(without.queryByTestId('lesson-quiz')).toBeNull();
    });
});
