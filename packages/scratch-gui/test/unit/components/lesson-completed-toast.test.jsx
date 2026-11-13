/* eslint-env jest */
import '@testing-library/jest-dom';
import { fireEvent, render } from '@testing-library/react';
import React from 'react';
import { IntlProvider } from 'react-intl';
import LessonCompletedToast from '../../../src/components/lesson-completed-toast/lesson-completed-toast.jsx';
import { en, ja, jaHira } from '../../../src/lib/lessons/lessons.locale.js';

const lessonName = { id: 'gui.lessons.lesson.blocks-l1.name', defaultMessage: 'Let it move' };
const courseName = { id: 'gui.lessons.course.kyou-kara-programmer.name', defaultMessage: 'Programmer from today' };

// レッスン 1 の 4 つ。1・2 ができていて、いま 2 ができた
const midLesson = [
    { id: 'a', completed: true },
    { id: 'b', completed: true },
    { id: 'c', completed: false },
    { id: 'd', completed: false },
];
const allDone = midLesson.map((c) => ({ ...c, completed: true }));

const renderToast = (props = {}, { locale = 'en', messages = en } = {}) =>
    render(
        <IntlProvider locale={locale} messages={messages}>
            <LessonCompletedToast
                challengeId="b"
                challenges={midLesson}
                courseName={courseName}
                lessonName={lessonName}
                lessonNumber={1}
                onClose={jest.fn()}
                onNextChallenge={jest.fn()}
                {...props}
            />
        </IntlProvider>,
    );

const dotStates = (getByTestId) =>
    Array.from(getByTestId('lesson-completed-toast-dots').children).map((d) => [
        d.dataset.completed,
        d.dataset.current,
    ]);

describe('LessonCompletedToast', () => {
    describe('a challenge is done (the lesson goes on)', () => {
        test('shows "You did it!", the dots and how many are left, without the challenge name', () => {
            const { getByTestId, queryByTestId } = renderToast();
            const toast = getByTestId('lesson-completed-toast');
            expect(toast).toHaveAttribute('data-action', 'next');
            expect(toast).toHaveAttribute('data-challenge-id', 'b');
            expect(getByTestId('lesson-completed-toast-title')).toHaveTextContent('You did it!');
            expect(getByTestId('lesson-completed-toast-remaining')).toHaveTextContent('2 more in this lesson');
            expect(queryByTestId('lesson-completed-toast-detail')).not.toBeInTheDocument();
            expect(queryByTestId('lesson-completed-toast-challenge')).not.toBeInTheDocument();
            expect(dotStates(getByTestId)).toEqual([
                ['true', 'false'],
                ['true', 'true'],
                ['false', 'false'],
                ['false', 'false'],
            ]);
        });

        test('"Next challenge" calls onNextChallenge and "Keep looking" calls onClose', () => {
            const onNextChallenge = jest.fn();
            const onClose = jest.fn();
            const { getByTestId } = renderToast({ onNextChallenge, onClose });
            const next = getByTestId('lesson-completed-toast-next');
            expect(next).toHaveTextContent('Next challenge');
            expect(next).toHaveAttribute('data-action', 'next');
            fireEvent.click(next);
            expect(onNextChallenge).toHaveBeenCalledTimes(1);
            const close = getByTestId('lesson-completed-toast-close');
            expect(close).toHaveTextContent('Keep looking');
            fireEvent.click(close);
            expect(onClose).toHaveBeenCalledTimes(1);
        });

        test('uses the Japanese strings', () => {
            const { getByTestId } = renderToast({}, { locale: 'ja', messages: ja });
            expect(getByTestId('lesson-completed-toast-title')).toHaveTextContent('できた！');
            expect(getByTestId('lesson-completed-toast-remaining')).toHaveTextContent('このレッスンは、あと 2 つ');
            expect(getByTestId('lesson-completed-toast-next')).toHaveTextContent('次のチャレンジへ');
            expect(getByTestId('lesson-completed-toast-close')).toHaveTextContent('もう少し見る');
        });

        test('uses the hiragana strings', () => {
            const { getByTestId } = renderToast({}, { locale: 'ja-Hira', messages: jaHira });
            expect(getByTestId('lesson-completed-toast-next')).toHaveTextContent('つぎのチャレンジへ');
            expect(getByTestId('lesson-completed-toast-close')).toHaveTextContent('もうすこしみる');
        });
    });

    describe('every challenge of the lesson is done and another lesson is left', () => {
        const props = { action: 'otherLessons', challenges: allDone, challengeId: 'd', lessonNumber: 2 };

        test('shows the lesson title, all dots filled and the lesson line', () => {
            const { getByTestId, queryByTestId } = renderToast(props);
            expect(getByTestId('lesson-completed-toast')).toHaveAttribute('data-action', 'otherLessons');
            expect(getByTestId('lesson-completed-toast-title')).toHaveTextContent('Lesson 2 complete!');
            expect(getByTestId('lesson-completed-toast-detail')).toHaveTextContent(
                `You finished all 4 challenges of "Let's Move".`,
            );
            expect(queryByTestId('lesson-completed-toast-remaining')).not.toBeInTheDocument();
            expect(dotStates(getByTestId).every(([completed]) => completed === 'true')).toBe(true);
            const next = getByTestId('lesson-completed-toast-next');
            expect(next).toHaveTextContent('Next lesson');
            expect(next).toHaveAttribute('data-action', 'otherLessons');
        });

        test('uses the Japanese strings', () => {
            const { getByTestId } = renderToast(props, { locale: 'ja', messages: ja });
            expect(getByTestId('lesson-completed-toast-title')).toHaveTextContent('レッスン 2 ぜんぶできた！');
            expect(getByTestId('lesson-completed-toast-detail')).toHaveTextContent(
                '「うごかしてみよう」の 4 つ、全部できました',
            );
            expect(getByTestId('lesson-completed-toast-next')).toHaveTextContent('次のレッスンへ');
        });

        test('uses the hiragana strings', () => {
            const { getByTestId } = renderToast(props, { locale: 'ja-Hira', messages: jaHira });
            expect(getByTestId('lesson-completed-toast-detail')).toHaveTextContent('の 4 つ、ぜんぶできました');
            expect(getByTestId('lesson-completed-toast-next')).toHaveTextContent('つぎのレッスンへ');
        });
    });

    describe('every challenge of the lesson is done and no lesson is left', () => {
        const props = {
            action: 'library',
            challenges: allDone,
            challengeId: 'd',
            courseCompleted: true,
            lessonNumber: 3,
        };

        test('shows the course line and "Go to the lessons"', () => {
            const { getByTestId } = renderToast(props);
            expect(getByTestId('lesson-completed-toast-title')).toHaveTextContent('Lesson 3 complete!');
            expect(getByTestId('lesson-completed-toast-detail')).toHaveTextContent(
                'That was every lesson in "Programmer from Today".',
            );
            const next = getByTestId('lesson-completed-toast-next');
            expect(next).toHaveTextContent('Go to the lessons');
            expect(next).toHaveAttribute('data-action', 'library');
        });

        test('uses the Japanese strings', () => {
            const { getByTestId } = renderToast(props, { locale: 'ja', messages: ja });
            expect(getByTestId('lesson-completed-toast-detail')).toHaveTextContent(
                '「きょうからプログラマー」のレッスンは、これで全部です',
            );
            expect(getByTestId('lesson-completed-toast-next')).toHaveTextContent('レッスン表へ');
        });

        test('uses the hiragana strings', () => {
            const { getByTestId } = renderToast(props, { locale: 'ja-Hira', messages: jaHira });
            expect(getByTestId('lesson-completed-toast-detail')).toHaveTextContent('のレッスンは、これでぜんぶです');
            expect(getByTestId('lesson-completed-toast-next')).toHaveTextContent('レッスンひょうへ');
        });
    });

    test('a skipped earlier lesson: "no lesson left after this" does not say the course is all done', () => {
        const { getByTestId } = renderToast({
            action: 'library',
            challenges: allDone,
            challengeId: 'd',
            courseCompleted: false,
            lessonNumber: 3,
        });
        expect(getByTestId('lesson-completed-toast-title')).toHaveTextContent('Lesson 3 complete!');
        expect(getByTestId('lesson-completed-toast-detail')).toHaveTextContent(
            'You finished all 4 challenges of "Let\'s Move".',
        );
        expect(getByTestId('lesson-completed-toast-next')).toHaveTextContent('Go to the lessons');
    });

    test('omits the next button without onNextChallenge but keeps "Keep looking"', () => {
        const { getByTestId, queryByTestId } = renderToast({ onNextChallenge: undefined });
        expect(queryByTestId('lesson-completed-toast-next')).not.toBeInTheDocument();
        expect(getByTestId('lesson-completed-toast-close')).toBeInTheDocument();
    });
});

describe('LessonCompletedToast: assignment cleared (#1599)', () => {
    const assignmentChallenges = [
        { id: 'a', completed: true, required: true },
        { id: 'b', completed: true, required: false },
    ];

    test('shows "Assignment cleared!" before "Lesson n complete!", with the assignment dots and ★', () => {
        const { getByTestId } = renderToast(
            { action: 'otherLessons', assignmentCleared: true, assignmentChallenges, assignmentName: 'Week 1' },
            { locale: 'ja', messages: ja },
        );
        expect(getByTestId('lesson-completed-toast')).toHaveAttribute('data-assignment-cleared', 'true');
        expect(getByTestId('lesson-completed-toast-title')).toHaveTextContent('課題クリア！');
        expect(getByTestId('lesson-completed-toast-detail')).toHaveTextContent('「Week 1」の条件を満たしました');
        const dots = getByTestId('lesson-completed-toast-dots').children;
        expect(dots).toHaveLength(2);
        expect(dots[0]).toHaveTextContent('★');
        // no work to submit: the stage 1 button stays
        expect(getByTestId('lesson-completed-toast-next')).toHaveAttribute('data-action', 'otherLessons');
    });

    test('a work-submit assignment shows the guidance and "Submit assignment" as the main button', () => {
        const onSubmitAssignment = jest.fn();
        const { getByTestId, queryByTestId } = renderToast(
            { assignmentCleared: true, assignmentChallenges, onSubmitAssignment },
            { locale: 'ja-Hira', messages: jaHira },
        );
        expect(getByTestId('lesson-completed-toast-detail')).toHaveTextContent('じゆうに プログラムを つくろう');
        expect(queryByTestId('lesson-completed-toast-next')).toBeNull();
        fireEvent.click(getByTestId('lesson-completed-toast-submit'));
        expect(onSubmitAssignment).toHaveBeenCalled();
        expect(getByTestId('lesson-completed-toast-submit')).toHaveTextContent('かだいを ていしゅつする');
    });

    test('without assignmentCleared it is the usual toast', () => {
        const { getByTestId, queryByTestId } = renderToast({ assignmentChallenges, onSubmitAssignment: jest.fn() });
        expect(getByTestId('lesson-completed-toast-title')).toHaveTextContent('You did it!');
        expect(queryByTestId('lesson-completed-toast-submit')).toBeNull();
    });
});
