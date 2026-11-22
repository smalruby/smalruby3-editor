/* eslint-env jest */
import '@testing-library/jest-dom';
import { fireEvent, render } from '@testing-library/react';
import React from 'react';
import { IntlProvider } from 'react-intl';
import LessonReadinessCheck from '../../../src/components/lesson-readiness-check/lesson-readiness-check.jsx';
import LessonReadinessOffer from '../../../src/components/lesson-readiness-check/lesson-readiness-offer.jsx';
import { splitScripts } from '../../../src/containers/lesson-readiness-check.jsx';
import { courseReadinessCheck, findCourse } from '../../../src/lib/lessons/courses';
import en from '../../../src/locales/en';

// じゅんびチェックの問いのパネルと「先にじゅんびチェックをする？」（#2299）
const questions = courseReadinessCheck(findCourse('chat-wo-tsukurou')).readinessCheck.questions;

const renderCheck = (props = {}) => {
    const onChoose = jest.fn();
    const onNext = jest.fn();
    const utils = render(
        <IntlProvider locale="en" messages={en}>
            <LessonReadinessCheck
                colorMode="default"
                index={0}
                mediaPath="./static/blocks-media/"
                onChoose={onChoose}
                onNext={onNext}
                questions={questions}
                {...props}
            />
        </IntlProvider>,
    );
    return { ...utils, onChoose, onNext };
};

describe('LessonReadinessCheck', () => {
    test('shows the current question with its number, and no next button before choosing', () => {
        const { getByTestId, queryByTestId } = renderCheck({ index: 1 });
        expect(getByTestId('lesson-readiness-check')).toHaveAttribute(
            'data-base-challenge-id',
            'blocks-l1-ask-answer',
        );
        expect(getByTestId('lesson-quiz-label')).toHaveTextContent('Readiness check 2 / 4');
        expect(getByTestId('lesson-quiz-question')).toHaveTextContent('type "Taro"');
        expect(queryByTestId('lesson-readiness-check-next')).not.toBeInTheDocument();
    });

    test('choosing calls onChoose; after choosing, the next button goes on', () => {
        const { getAllByTestId, onChoose } = renderCheck();
        fireEvent.click(getAllByTestId('lesson-quiz-choice')[2]);
        expect(onChoose).toHaveBeenCalledWith(2);
        const chosen = renderCheck({ choice: 2 });
        expect(chosen.getAllByTestId('lesson-quiz-result')[0]).toHaveTextContent('The right answer is 1.');
        const next = chosen.getAllByTestId('lesson-readiness-check-next')[0];
        expect(next).toHaveTextContent('Next question');
        fireEvent.click(next);
        expect(chosen.onNext).toHaveBeenCalled();
    });

    test('the last question says "See the result"; past the last it shows nothing', () => {
        const { getByTestId } = renderCheck({ index: 3, choice: 0 });
        expect(getByTestId('lesson-readiness-check-next')).toHaveTextContent('See the result');
        expect(getByTestId('lesson-readiness-check-next')).toHaveAttribute('data-last', 'true');
        const done = renderCheck({ index: 4 });
        expect(done.container.ownerDocument.querySelectorAll('[data-testid="lesson-readiness-check"]')).toHaveLength(
            1,
        );
    });
});

describe('LessonReadinessOffer', () => {
    test('asks and calls yes / skip', () => {
        const onYes = jest.fn();
        const onSkip = jest.fn();
        const { getByTestId } = render(
            <IntlProvider locale="en" messages={en}>
                <LessonReadinessOffer count={4} onSkip={onSkip} onYes={onYes} />
            </IntlProvider>,
        );
        expect(getByTestId('lesson-readiness-offer')).toHaveTextContent('Take the readiness check first?');
        expect(getByTestId('lesson-readiness-offer')).toHaveTextContent('4 questions');
        fireEvent.click(getByTestId('lesson-readiness-offer-yes'));
        expect(onYes).toHaveBeenCalled();
        fireEvent.click(getByTestId('lesson-readiness-offer-skip'));
        expect(onSkip).toHaveBeenCalled();
    });
});

describe('splitScripts (the question blocks are drawn script by script)', () => {
    test('splits the Ruby at blank lines', () => {
        expect(splitScripts('when_flag_clicked do\n  $n = 0\nend\n\nwhen_clicked do\n  say($n)\nend\n')).toEqual([
            'when_flag_clicked do\n  $n = 0\nend\n',
            'when_clicked do\n  say($n)\nend\n',
        ]);
        expect(splitScripts('move(10)\n')).toEqual(['move(10)\n']);
    });
});
