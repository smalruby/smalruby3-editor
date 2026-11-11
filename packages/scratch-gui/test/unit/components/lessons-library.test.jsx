/* eslint-env jest */
import '@testing-library/jest-dom';
import { fireEvent, render } from '@testing-library/react';
import React from 'react';
import { IntlProvider } from 'react-intl';
import { Provider } from 'react-redux';
import configureStore from 'redux-mock-store';
import LessonsLibrary, { courseSkills } from '../../../src/components/lessons-library/lessons-library.jsx';
import { COURSES, defineCourse, defineLesson, LANGUAGES } from '../../../src/lib/lessons/courses';
import { emptyProgress, markChallengeCompleted } from '../../../src/lib/lessons/lesson-progress';
import en from '../../../src/locales/en';
import ja from '../../../src/locales/ja';

// Modal コンテナ（containers/modal.jsx）が isRtl を store から読む
const store = configureStore()({ locales: { isRtl: false } });

const LESSON = COURSES[0].lessons[0];
const ALL_IDS = LESSON.challenges.map((c) => c.id);
const REQUIRED_IDS = LESSON.clear.required;

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
    test('shows the blocks course with lesson 1 and all 11 challenges in order', () => {
        const { getByTestId, getAllByTestId, queryByTestId } = renderLibrary();
        expect(getByTestId('lessons-library')).toBeInTheDocument();
        expect(getByTestId('lessons-library-course-kyou-kara-programmer')).toHaveTextContent('Programmer from Today');
        expect(getByTestId('lessons-library-lesson-blocks-l1')).toHaveTextContent('Lesson 1');
        expect(getByTestId('lessons-library-lesson-blocks-l1')).toHaveTextContent('Block Families');
        const buttons = ALL_IDS.map((id) => getByTestId(`lessons-library-challenge-${id}`));
        expect(buttons[2]).toHaveTextContent('3');
        expect(buttons[2]).toHaveTextContent('Talk when clicked');
        // 必須の印は 5 つ、できたの印は無し
        expect(getAllByTestId('lessons-library-challenge-required')).toHaveLength(REQUIRED_IDS.length);
        expect(queryByTestId('lessons-library-challenge-done')).not.toBeInTheDocument();
        expect(queryByTestId('lessons-library-badge')).not.toBeInTheDocument();
        expect(queryByTestId('lessons-library-lesson-cleared')).not.toBeInTheDocument();
    });

    test('shows the category color dot with the category name', () => {
        const { getByTestId } = renderLibrary();
        const looks = getByTestId('lessons-library-challenge-blocks-l1-click-say').querySelector('[role="img"]');
        expect(looks).toHaveAttribute('aria-label', 'Looks');
        const sound = getByTestId('lessons-library-challenge-blocks-l1-key-sound').querySelector('[role="img"]');
        expect(sound).toHaveAttribute('aria-label', 'Sound');
    });

    test('shows "0 / 11 done" and the required count before anything is done', () => {
        const { getByTestId } = renderLibrary();
        expect(getByTestId('lessons-library-progress')).toHaveTextContent('0 / 11 done (required 0 / 5)');
    });

    test('marks completed challenges and counts them in the progress', () => {
        const progress = progressWith(['blocks-l1-click-say', 'blocks-l1-repeat']);
        const { getByTestId, getAllByTestId } = renderLibrary({ progress });
        expect(getAllByTestId('lessons-library-challenge-done')).toHaveLength(2);
        expect(getByTestId('lessons-library-challenge-blocks-l1-click-say')).toHaveAttribute(
            'data-completed',
            'true',
        );
        expect(getByTestId('lessons-library-challenge-blocks-l1-repeat')).toHaveAttribute('data-completed', 'true');
        expect(getByTestId('lessons-library-challenge-blocks-l1-if')).toHaveAttribute('data-completed', 'false');
        expect(getByTestId('lessons-library-progress')).toHaveTextContent('2 / 11 done (required 1 / 5)');
    });

    test('does not show the badge when 7 are done but a required one is missing', () => {
        // 必須 5 つのうち 4 つ + 必須でない 3 つ = 7 個
        const ids = [...REQUIRED_IDS.slice(0, 4), 'blocks-l1-key-sound', 'blocks-l1-arrow-move', 'blocks-l1-repeat'];
        const { getByTestId, queryByTestId } = renderLibrary({ progress: progressWith(ids) });
        expect(getByTestId('lessons-library-progress')).toHaveTextContent('7 / 11 done (required 4 / 5)');
        expect(queryByTestId('lessons-library-lesson-cleared')).not.toBeInTheDocument();
        expect(queryByTestId('lessons-library-badge')).not.toBeInTheDocument();
    });

    test('shows "Cleared!" and the course badge when the lesson is cleared', () => {
        const ids = [...REQUIRED_IDS, 'blocks-l1-key-sound', 'blocks-l1-arrow-move'];
        const { getByTestId } = renderLibrary({ progress: progressWith(ids) });
        expect(getByTestId('lessons-library-progress')).toHaveTextContent('7 / 11 done (required 5 / 5)');
        expect(getByTestId('lessons-library-lesson-cleared')).toHaveTextContent('Cleared!');
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
        const { getByTestId } = renderLibrary({}, { locale: 'ja', messages: ja });
        expect(getByTestId('lessons-library-tab-blocks')).toHaveTextContent('ブロック');
        expect(getByTestId('lessons-library-tab-dncl')).toHaveTextContent('日本語');
        expect(getByTestId('lessons-library-progress')).toHaveTextContent('0 / 11 できた（必須 0 / 5）');
        expect(getByTestId('lessons-library-lesson-blocks-l1')).toHaveTextContent('レッスン 1');
        expect(getByTestId('lessons-library-challenge-blocks-l1-click-say')).toHaveTextContent('必須');
    });

    describe('skills (できること)', () => {
        const skill = (id) => ({ id, name: { id: `test.skill.${id}`, defaultMessage: `skill ${id}` } });
        const course = defineCourse({
            id: 'test-course',
            language: LANGUAGES.BLOCKS,
            lessons: [
                defineLesson({
                    id: 'test-l1',
                    count: 1,
                    challenges: [
                        { id: 'test-a', skills: [skill('move'), skill('say')] },
                        { id: 'test-b', skills: [skill('say'), skill('repeat')] },
                    ],
                }),
            ],
        });

        test('courseSkills lists each skill once, in course order, with the challenges that teach it', () => {
            expect(courseSkills(course).map((s) => [s.id, s.challengeIds])).toEqual([
                ['move', ['test-a']],
                ['say', ['test-a', 'test-b']],
                ['repeat', ['test-b']],
            ]);
        });

        test('hides the skills section when no challenge has skills yet', () => {
            const noSkills = defineCourse({
                id: 'test-course',
                language: LANGUAGES.BLOCKS,
                lessons: [defineLesson({ id: 'test-l1', count: 1, challenges: [{ id: 'test-a' }] })],
            });
            const { queryByTestId } = renderLibrary({ courses: [noSkills], progress: emptyProgress() });
            expect(queryByTestId('lessons-library-skills')).not.toBeInTheDocument();
        });

        test('colors the skills of completed challenges and leaves the rest dotted', () => {
            const progress = progressWith(['test-a'], [course]);
            const { getByTestId } = renderLibrary({ courses: [course], progress });
            expect(getByTestId('lessons-library-skills')).toHaveTextContent('What you can do');
            expect(getByTestId('lessons-library-skill-move')).toHaveAttribute('data-done', 'true');
            expect(getByTestId('lessons-library-skill-say')).toHaveAttribute('data-done', 'true');
            expect(getByTestId('lessons-library-skill-repeat')).toHaveAttribute('data-done', 'false');
        });
    });
});
