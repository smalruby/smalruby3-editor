/* eslint-env jest */
import '@testing-library/jest-dom';
import { act, fireEvent, render } from '@testing-library/react';
import React from 'react';
import { IntlProvider } from 'react-intl';
import LessonPartQuiz from '../../../src/components/lesson-part-quiz/lesson-part-quiz.jsx';
import { PART_QUIZ_REVEAL_MS } from '../../../src/lib/lessons/part-quiz';
import ja from '../../../src/locales/ja';

// jsdom は layout をしないので getBoundingClientRect を差し替える
const addPart = (testId, r) => {
    const el = document.createElement('div');
    el.setAttribute('data-testid', testId);
    el.getBoundingClientRect = () => ({ ...r, width: r.right - r.left, height: r.bottom - r.top });
    document.body.appendChild(el);
    return el;
};

const renderQuiz = (props = {}) =>
    render(
        <IntlProvider locale="ja" messages={ja}>
            <LessonPartQuiz questions={['taskBar', 'hint']} solved={0} onSolve={jest.fn()} {...props} />
        </IntlProvider>,
    );

const q = (testId) => document.querySelector(`[data-testid="${testId}"]`);

describe('LessonPartQuiz (#2134)', () => {
    // jsdom には PointerEvent が無い（clientX が渡らない）ので MouseEvent で代える
    const hadPointerEvent = 'PointerEvent' in window;
    beforeAll(() => {
        if (!hadPointerEvent) window.PointerEvent = window.MouseEvent;
    });
    afterAll(() => {
        if (!hadPointerEvent) delete window.PointerEvent;
    });
    beforeEach(() => {
        document.body.innerHTML = '';
        jest.useFakeTimers();
        addPart('lesson-task-bar', { left: 0, top: 0, right: 1300, bottom: 40 });
        addPart('lesson-task-bar-hint', { left: 1100, top: 50, right: 1180, bottom: 80 });
    });
    afterEach(() => {
        jest.useRealTimers();
    });

    test('asks for the part by its name and counts the questions', () => {
        renderQuiz();
        expect(q('lesson-part-quiz-title')).toHaveTextContent('どこでしょう？ 1 / 2');
        expect(q('lesson-part-quiz-question')).toHaveTextContent('「課題バー」はどこ？ クリックしよう');
    });

    test('a click on the right part answers the question', () => {
        const onSolve = jest.fn();
        renderQuiz({ onSolve });
        fireEvent.pointerDown(q('lesson-part-quiz-catcher'), { clientX: 200, clientY: 20 });
        expect(onSolve).toHaveBeenCalledWith(0);
        expect(q('lesson-part-quiz-feedback')).toHaveAttribute('data-result', 'correct');
    });

    test('a wrong click says so and lights the right part for a while', () => {
        const onSolve = jest.fn();
        renderQuiz({ onSolve, solved: 1 });
        fireEvent.pointerDown(q('lesson-part-quiz-catcher'), { clientX: 200, clientY: 20 });
        expect(onSolve).not.toHaveBeenCalled();
        expect(q('lesson-part-quiz-feedback')).toHaveTextContent('ちがうよ');
        expect(q('lesson-part-quiz-reveal')).toHaveStyle({ left: '1100px', top: '50px', width: '80px' });
        act(() => {
            jest.advanceTimersByTime(PART_QUIZ_REVEAL_MS);
        });
        expect(q('lesson-part-quiz-reveal')).toBeNull();
    });

    test('the catcher keeps the clicks from the parts under it', () => {
        const under = jest.fn();
        document.addEventListener('mousedown', under);
        document.addEventListener('click', under);
        renderQuiz();
        fireEvent.mouseDown(q('lesson-part-quiz-catcher'));
        fireEvent.click(q('lesson-part-quiz-catcher'));
        expect(under).not.toHaveBeenCalled();
        document.removeEventListener('mousedown', under);
        document.removeEventListener('click', under);
    });

    test('when all are answered, it says so and stops catching the clicks', () => {
        renderQuiz({ solved: 2 });
        expect(q('lesson-part-quiz-done')).toHaveTextContent('2 問ぜんぶ せいかい！');
        expect(q('lesson-part-quiz-catcher')).toBeNull();
    });
});
