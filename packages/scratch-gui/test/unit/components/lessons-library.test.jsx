/* eslint-env jest */
import '@testing-library/jest-dom';
import { fireEvent, render } from '@testing-library/react';
import React from 'react';
import { IntlProvider } from 'react-intl';
import { Provider } from 'react-redux';
import configureStore from 'redux-mock-store';
import LessonsLibrary from '../../../src/components/lessons-library/lessons-library.jsx';
import { COURSES, defineCourse, LANGUAGES } from '../../../src/lib/lessons/courses';
import { emptyProgress, markChallengeCompleted } from '../../../src/lib/lessons/lesson-progress';
import en from '../../../src/locales/en';
import ja from '../../../src/locales/ja';

// Modal コンテナ（containers/modal.jsx）が isRtl を store から読む
const store = configureStore()({ locales: { isRtl: false } });

const LESSON = COURSES[0].lessons[0];
// コースの 11 のチャレンジ（レッスン 1: 4・レッスン 2: 3・レッスン 3: 4）
const ALL_IDS = COURSES[0].lessons.flatMap((lesson) => lesson.challenges.map((c) => c.id));
const LESSON_IDS = ['blocks-l1', 'blocks-l2', 'blocks-l3'];

// レッスンごとの「n / m done」
const progressTexts = (getAllByTestId) => getAllByTestId('lessons-library-progress').map((el) => el.textContent);

const progressWith = (ids, courses = COURSES) =>
    ids.reduce(
        (p, id, i) => markChallengeCompleted(p, id, `2026-11-10T00:00:0${i % 10}.000Z`, courses),
        emptyProgress(),
    );

const renderLibrary = (props = {}, { locale = 'en', messages = en } = {}) => {
    const onRequestClose = jest.fn();
    const onSelectChallenge = jest.fn();
    const utils = render(
        <Provider store={store}>
            <IntlProvider locale={locale} messages={messages}>
                <LessonsLibrary
                    courses={COURSES}
                    progress={emptyProgress()}
                    onRequestClose={onRequestClose}
                    onSelectChallenge={onSelectChallenge}
                    {...props}
                />
            </IntlProvider>
        </Provider>,
    );
    return { ...utils, onRequestClose, onSelectChallenge };
};

describe('LessonsLibrary', () => {
    test('shows the blocks course with the 3 lessons and their challenges in order', () => {
        const { getByTestId, queryByTestId } = renderLibrary();
        expect(getByTestId('lessons-library')).toBeInTheDocument();
        expect(getByTestId('lessons-library-course-kyou-kara-programmer')).toHaveTextContent('Programmer from Today');
        expect(getByTestId('lessons-library-lesson-blocks-l1')).toHaveTextContent('Lesson 1');
        expect(getByTestId('lessons-library-lesson-blocks-l1')).toHaveTextContent("Let's Move");
        expect(getByTestId('lessons-library-lesson-blocks-l2')).toHaveTextContent('Lesson 2');
        expect(getByTestId('lessons-library-lesson-blocks-l2')).toHaveTextContent('Choose and Ask');
        expect(getByTestId('lessons-library-lesson-blocks-l3')).toHaveTextContent('Lesson 3');
        expect(getByTestId('lessons-library-lesson-blocks-l3')).toHaveTextContent('Remember and Tell');
        LESSON_IDS.forEach((lessonId) => {
            const section = getByTestId(`lessons-library-lesson-${lessonId}`);
            const ids = COURSES[0].lessons.find((l) => l.id === lessonId).challenges.map((c) => c.id);
            ids.forEach((id) => expect(section.contains(getByTestId(`lessons-library-challenge-${id}`))).toBe(true));
        });
        // 番号はレッスンの中の番号
        const quiz = getByTestId('lessons-library-challenge-blocks-l1-quiz');
        expect(quiz).toHaveTextContent('3');
        // 必須・クリア・できることの表示は無い（#1529）。できたの印も無し
        expect(queryByTestId('lessons-library-challenge-required')).not.toBeInTheDocument();
        expect(queryByTestId('lessons-library-lesson-cleared')).not.toBeInTheDocument();
        expect(queryByTestId('lessons-library-skills')).not.toBeInTheDocument();
        expect(queryByTestId('lessons-library-challenge-done')).not.toBeInTheDocument();
        expect(queryByTestId('lessons-library-badge')).not.toBeInTheDocument();
    });

    test('shows the category color dot with the category name', () => {
        const { getByTestId } = renderLibrary();
        const looks = getByTestId('lessons-library-challenge-blocks-l1-click-say').querySelector('[role="img"]');
        expect(looks).toHaveAttribute('aria-label', 'Looks');
        const sound = getByTestId('lessons-library-challenge-blocks-l1-key-sound').querySelector('[role="img"]');
        expect(sound).toHaveAttribute('aria-label', 'Sound');
    });

    test('shows "0 / n done" for each lesson before anything is done', () => {
        const { getAllByTestId } = renderLibrary();
        expect(progressTexts(getAllByTestId)).toEqual(['0 / 4 done', '0 / 3 done', '0 / 4 done']);
    });

    test('marks completed challenges and counts them in the progress of their lesson', () => {
        const progress = progressWith(['blocks-l1-click-say', 'blocks-l1-repeat', 'blocks-l1-quiz']);
        const { getByTestId, getAllByTestId } = renderLibrary({ progress });
        expect(getAllByTestId('lessons-library-challenge-done')).toHaveLength(3);
        expect(getByTestId('lessons-library-challenge-blocks-l1-click-say')).toHaveAttribute(
            'data-completed',
            'true',
        );
        expect(getByTestId('lessons-library-challenge-blocks-l1-repeat')).toHaveAttribute('data-completed', 'true');
        expect(getByTestId('lessons-library-challenge-blocks-l1-if')).toHaveAttribute('data-completed', 'false');
        expect(progressTexts(getAllByTestId)).toEqual(['2 / 4 done', '1 / 3 done', '0 / 4 done']);
    });

    test('does not show the course badge until every challenge of the course is done', () => {
        const { queryByTestId } = renderLibrary({ progress: progressWith(ALL_IDS.slice(0, 10)) });
        expect(queryByTestId('lessons-library-badge')).not.toBeInTheDocument();
    });

    test('shows the course badge when every challenge of the course is done', () => {
        const { getByTestId, getAllByTestId } = renderLibrary({ progress: progressWith(ALL_IDS) });
        expect(progressTexts(getAllByTestId)).toEqual(['4 / 4 done', '3 / 3 done', '4 / 4 done']);
        expect(getByTestId('lessons-library-badge')).toHaveTextContent('Programmer Debut!');
    });

    test('does not show the course badge for a course that has no lessons yet', () => {
        const course = defineCourse({ id: 'empty-course', language: LANGUAGES.BLOCKS, lessons: [] });
        const { queryByTestId, getByTestId } = renderLibrary({ courses: [course] });
        expect(getByTestId('lessons-library-course-empty-course')).toBeInTheDocument();
        expect(queryByTestId('lessons-library-badge')).not.toBeInTheDocument();
    });

    test('calls onSelectChallenge with the challenge id', () => {
        const { getByTestId, onSelectChallenge } = renderLibrary();
        fireEvent.click(getByTestId('lessons-library-challenge-blocks-l1-click-say'));
        expect(onSelectChallenge).toHaveBeenCalledWith('blocks-l1-click-say');
    });

    test('the Ruby and DNCL tabs say "Coming soon" and the blocks tab brings the course back', () => {
        const { getByTestId, queryByTestId } = renderLibrary();
        fireEvent.click(getByTestId('lessons-library-tab-ruby'));
        expect(getByTestId('lessons-library-coming-soon')).toHaveTextContent('Coming soon');
        expect(queryByTestId('lessons-library-course-kyou-kara-programmer')).not.toBeInTheDocument();
        expect(getByTestId('lessons-library-tab-ruby')).toHaveAttribute('aria-selected', 'true');
        fireEvent.click(getByTestId('lessons-library-tab-dncl'));
        expect(getByTestId('lessons-library-coming-soon')).toBeInTheDocument();
        fireEvent.click(getByTestId('lessons-library-tab-blocks'));
        expect(getByTestId('lessons-library-course-kyou-kara-programmer')).toBeInTheDocument();
    });

    test('uses the Japanese strings', () => {
        const utils = renderLibrary({}, { locale: 'ja', messages: ja });
        const { getByTestId } = utils;
        expect(getByTestId('lessons-library-tab-blocks')).toHaveTextContent('ブロック');
        expect(getByTestId('lessons-library-tab-dncl')).toHaveTextContent('日本語');
        const { getAllByTestId } = utils;
        expect(progressTexts(getAllByTestId)).toEqual(['0 / 4 できた', '0 / 3 できた', '0 / 4 できた']);
        expect(getByTestId('lessons-library-lesson-blocks-l1')).toHaveTextContent('レッスン 1');
        expect(getByTestId('lessons-library-lesson-blocks-l1')).toHaveTextContent('うごかしてみよう');
        expect(getByTestId('lessons-library-lesson-blocks-l3')).toHaveTextContent('おぼえて つたえよう');
    });

    test('without a focus, no lesson is focused and no challenge is marked as next', () => {
        const { getByTestId, queryByTestId } = renderLibrary();
        expect(getByTestId(`lessons-library-lesson-${LESSON.id}`)).toHaveAttribute('data-focused', 'false');
        expect(queryByTestId('lessons-library-challenge-next')).not.toBeInTheDocument();
    });

    test('focuses the lesson, scrolls to it and marks the next challenge', () => {
        const scrollIntoView = jest.fn();
        window.HTMLElement.prototype.scrollIntoView = scrollIntoView;
        try {
            const { getByTestId, getAllByTestId } = renderLibrary({
                focusLessonId: LESSON.id,
                nextChallengeId: ALL_IDS[3],
            });
            const section = getByTestId(`lessons-library-lesson-${LESSON.id}`);
            expect(section).toHaveAttribute('data-focused', 'true');
            expect(scrollIntoView).toHaveBeenCalledTimes(1);
            expect(scrollIntoView.mock.instances[0]).toBe(section);
            const next = getByTestId(`lessons-library-challenge-${ALL_IDS[3]}`);
            expect(next).toHaveAttribute('data-next', 'true');
            expect(getAllByTestId('lessons-library-challenge-next')).toHaveLength(1);
            expect(next).toHaveTextContent('Next!');
            expect(getByTestId(`lessons-library-challenge-${ALL_IDS[4]}`)).toHaveAttribute('data-next', 'false');
        } finally {
            delete window.HTMLElement.prototype.scrollIntoView;
        }
    });
});
