/* eslint-env jest */
import '@testing-library/jest-dom';
import { fireEvent, render } from '@testing-library/react';
import React from 'react';
import { IntlProvider } from 'react-intl';
import { Provider } from 'react-redux';
import configureStore from 'redux-mock-store';
import LessonsLibrary from '../../../src/components/lessons-library/lessons-library.jsx';
import { COURSES, defineCourse, defineLesson, LANGUAGES } from '../../../src/lib/lessons/courses';
import { emptyProgress, markChallengeCompleted } from '../../../src/lib/lessons/lesson-progress';
import en from '../../../src/locales/en';
import ja from '../../../src/locales/ja';

// Modal コンテナ（containers/modal.jsx）が isRtl を store から読む
const store = configureStore()({ locales: { isRtl: false } });

const LESSON = COURSES[0].lessons[0];
// コースの 11 のチャレンジ（レッスン 1: 4・レッスン 2: 3・レッスン 3: 4）
const ALL_IDS = COURSES[0].lessons.flatMap((lesson) => lesson.challenges.map((c) => c.id));
const LESSON_IDS = ['blocks-l1', 'blocks-l2', 'blocks-l3'];

// コースの見出しの「n / m」
const courseProgressText = (getByTestId, courseId = COURSE_ID) =>
    getByTestId(`lessons-library-course-${courseId}`).querySelector(
        '[data-testid="lessons-library-course-progress-text"]',
    ).textContent;

const COURSE_ID = 'kyou-kara-programmer';

const typeSearch = (getByTestId, text) =>
    fireEvent.change(getByTestId('lessons-library-search').querySelector('input'), { target: { value: text } });

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
    test('shows the title, the search box and only the languages that have a course', () => {
        const { getByTestId, queryByTestId, getByText } = renderLibrary();
        expect(getByTestId('lessons-library')).toBeInTheDocument();
        expect(getByText('Choose a Lesson')).toBeInTheDocument();
        expect(getByTestId('lessons-library-search').querySelector('input')).toHaveAttribute('placeholder', 'Search');
        expect(getByTestId('lessons-library-tab-blocks')).toHaveTextContent('Blocks');
        expect(getByTestId('lessons-library-tab-blocks')).toHaveAttribute('aria-pressed', 'true');
        // Ruby・日本語のボタンは、コースができたら出す
        expect(queryByTestId('lessons-library-tab-ruby')).not.toBeInTheDocument();
        expect(queryByTestId('lessons-library-tab-dncl')).not.toBeInTheDocument();
        // コースが 4 つまではコースのボタンを出さない
        expect(queryByTestId('lessons-library-course-nav')).not.toBeInTheDocument();
    });

    test('shows the blocks course with the 3 lessons and their challenge cards in order', () => {
        const { getByTestId, queryByTestId } = renderLibrary();
        expect(getByTestId(`lessons-library-course-${COURSE_ID}`)).toHaveTextContent('Programmer from Today');
        expect(getByTestId('lessons-library-lesson-blocks-l1')).toHaveTextContent('Lesson 1');
        expect(getByTestId('lessons-library-lesson-blocks-l1')).toHaveTextContent("Let's Move");
        expect(getByTestId('lessons-library-lesson-blocks-l2')).toHaveTextContent('Lesson 2');
        expect(getByTestId('lessons-library-lesson-blocks-l2')).toHaveTextContent('Choose and Ask');
        expect(getByTestId('lessons-library-lesson-blocks-l3')).toHaveTextContent('Lesson 3');
        expect(getByTestId('lessons-library-lesson-blocks-l3')).toHaveTextContent('Remember and Tell');
        LESSON_IDS.forEach((lessonId) => {
            const section = getByTestId(`lessons-library-lesson-${lessonId}`);
            const ids = COURSES[0].lessons.find((l) => l.id === lessonId).challenges.map((c) => c.id);
            const cards = Array.from(section.querySelectorAll('[data-testid^="lessons-library-challenge-blocks"]'));
            expect(cards.map((el) => el.getAttribute('data-testid'))).toEqual(
                ids.map((id) => `lessons-library-challenge-${id}`),
            );
        });
        // 必須・クリア・できること・コースの印は出さない（#1529・#1530）
        expect(queryByTestId('lessons-library-challenge-required')).not.toBeInTheDocument();
        expect(queryByTestId('lessons-library-lesson-cleared')).not.toBeInTheDocument();
        expect(queryByTestId('lessons-library-skills')).not.toBeInTheDocument();
        expect(queryByTestId('lessons-library-badge')).not.toBeInTheDocument();
        expect(queryByTestId('lessons-library-challenge-done')).not.toBeInTheDocument();
        expect(queryByTestId('lessons-library-course-done')).not.toBeInTheDocument();
    });

    test('each card has a picture with the category color and the challenge symbol', () => {
        const { getByTestId } = renderLibrary();
        const art = getByTestId('lessons-library-challenge-blocks-l1-click-say').querySelector(
            '[data-testid="lessons-library-card-art"]',
        );
        expect(art).toHaveAttribute('aria-label', 'Looks');
        expect(art).toHaveTextContent('💬');
        const sound = getByTestId('lessons-library-challenge-blocks-l1-key-sound').querySelector(
            '[data-testid="lessons-library-card-art"]',
        );
        expect(sound).toHaveAttribute('aria-label', 'Sound');
    });

    test('a card shows the image of the challenge when it has one', () => {
        const course = defineCourse({
            id: 'pic',
            language: LANGUAGES.BLOCKS,
            lessons: [defineLesson({ id: 'pic-l1', challenges: [{ id: 'pic-a', card: { image: 'cat.svg' } }] })],
        });
        const { getByTestId } = renderLibrary({ courses: [course] });
        const img = getByTestId('lessons-library-challenge-pic-a').querySelector('img');
        expect(img).toHaveAttribute('src', 'cat.svg');
    });

    test('shows the progress of the whole course as a bar and "0 / 11" before anything is done', () => {
        const { getByTestId } = renderLibrary();
        expect(courseProgressText(getByTestId)).toBe('0 / 11');
        const bar = getByTestId(`lessons-library-course-${COURSE_ID}`).querySelector('[role="progressbar"]');
        expect(bar).toHaveAttribute('aria-valuenow', '0');
        expect(bar).toHaveAttribute('aria-valuemax', '11');
    });

    test('marks completed challenges with a check and counts them in the course progress', () => {
        const progress = progressWith(['blocks-l1-click-say', 'blocks-l1-repeat', 'blocks-l1-quiz']);
        const { getByTestId, getAllByTestId } = renderLibrary({ progress });
        expect(getAllByTestId('lessons-library-challenge-done')).toHaveLength(3);
        expect(getByTestId('lessons-library-challenge-blocks-l1-click-say')).toHaveAttribute(
            'data-completed',
            'true',
        );
        expect(getByTestId('lessons-library-challenge-blocks-l1-repeat')).toHaveAttribute('data-completed', 'true');
        expect(getByTestId('lessons-library-challenge-blocks-l1-if')).toHaveAttribute('data-completed', 'false');
        expect(courseProgressText(getByTestId)).toBe('3 / 11');
        const bar = getByTestId(`lessons-library-course-${COURSE_ID}`).querySelector('[role="progressbar"]');
        expect(bar).toHaveAttribute('aria-valuenow', '3');
    });

    test('does not put a check before the course name until every challenge of the course is done', () => {
        const { queryByTestId } = renderLibrary({ progress: progressWith(ALL_IDS.slice(0, 10)) });
        expect(queryByTestId('lessons-library-course-done')).not.toBeInTheDocument();
    });

    test('puts a check before the course name when every challenge of the course is done', () => {
        const { getByTestId } = renderLibrary({ progress: progressWith(ALL_IDS) });
        expect(courseProgressText(getByTestId)).toBe('11 / 11');
        const title = getByTestId(`lessons-library-course-${COURSE_ID}`).querySelector('h2');
        expect(title.firstChild).toBe(getByTestId('lessons-library-course-done'));
        expect(getByTestId('lessons-library-course-done')).toHaveAttribute('aria-label', 'Done');
    });

    test('does not put the check on a course that has no lessons yet', () => {
        const course = defineCourse({ id: 'empty-course', language: LANGUAGES.BLOCKS, lessons: [] });
        const { queryByTestId, getByTestId } = renderLibrary({ courses: [course] });
        expect(getByTestId('lessons-library-course-empty-course')).toBeInTheDocument();
        expect(queryByTestId('lessons-library-course-done')).not.toBeInTheDocument();
    });

    test('calls onSelectChallenge with the challenge id', () => {
        const { getByTestId, onSelectChallenge } = renderLibrary();
        fireEvent.click(getByTestId('lessons-library-challenge-blocks-l1-click-say'));
        expect(onSelectChallenge).toHaveBeenCalledWith('blocks-l1-click-say');
    });

    test('search keeps only the matching challenges and hides lessons without any', () => {
        const { getByTestId, queryByTestId } = renderLibrary({}, { locale: 'ja', messages: ja });
        typeSearch(getByTestId, 'キー');
        expect(getByTestId('lessons-library-challenge-blocks-l1-key-sound')).toBeInTheDocument();
        expect(getByTestId('lessons-library-challenge-blocks-l1-arrow-move')).toBeInTheDocument();
        expect(queryByTestId('lessons-library-challenge-blocks-l1-click-say')).not.toBeInTheDocument();
        expect(queryByTestId('lessons-library-lesson-blocks-l2')).not.toBeInTheDocument();
        expect(queryByTestId('lessons-library-lesson-blocks-l3')).not.toBeInTheDocument();
        // コースのバーは検索で変えない
        expect(courseProgressText(getByTestId)).toBe('0 / 11');
        expect(queryByTestId('lessons-library-no-match')).not.toBeInTheDocument();
    });

    test('search ignores case and full-width letters', () => {
        const { getByTestId, queryByTestId } = renderLibrary();
        typeSearch(getByTestId, 'ＱＵＩＺ');
        expect(getByTestId('lessons-library-challenge-blocks-l1-quiz')).toBeInTheDocument();
        expect(queryByTestId('lessons-library-lesson-blocks-l1')).not.toBeInTheDocument();
    });

    test('search says so when nothing matches, and clearing it brings everything back', () => {
        const { getByTestId, queryByTestId } = renderLibrary({}, { locale: 'ja', messages: ja });
        typeSearch(getByTestId, 'ぞう');
        expect(getByTestId('lessons-library-no-match')).toHaveTextContent('「ぞう」に合うチャレンジはありません');
        expect(queryByTestId(`lessons-library-course-${COURSE_ID}`)).not.toBeInTheDocument();
        typeSearch(getByTestId, '');
        expect(queryByTestId('lessons-library-no-match')).not.toBeInTheDocument();
        expect(getByTestId('lessons-library-lesson-blocks-l3')).toBeInTheDocument();
    });

    test('shows course buttons when there are more than 4 courses, and they scroll to the course', () => {
        const scrollIntoView = jest.fn();
        window.HTMLElement.prototype.scrollIntoView = scrollIntoView;
        try {
            const courses = Array.from({ length: 5 }, (_, i) =>
                defineCourse({
                    id: `c${i}`,
                    language: LANGUAGES.BLOCKS,
                    lessons: [defineLesson({ id: `c${i}-l1`, challenges: [{ id: `c${i}-a` }] })],
                }),
            );
            const { getByTestId } = renderLibrary({ courses });
            expect(getByTestId('lessons-library-course-nav')).toBeInTheDocument();
            fireEvent.click(getByTestId('lessons-library-course-nav-c3'));
            expect(scrollIntoView).toHaveBeenCalledTimes(1);
            expect(scrollIntoView.mock.instances[0]).toBe(getByTestId('lessons-library-course-c3'));
        } finally {
            delete window.HTMLElement.prototype.scrollIntoView;
        }
    });

    test('the language buttons switch the courses', () => {
        const ruby = defineCourse({
            id: 'ruby-course',
            language: LANGUAGES.RUBY,
            lessons: [defineLesson({ id: 'ruby-l1', challenges: [{ id: 'ruby-a' }] })],
        });
        const { getByTestId, queryByTestId } = renderLibrary({ courses: [...COURSES, ruby] });
        expect(queryByTestId('lessons-library-course-ruby-course')).not.toBeInTheDocument();
        fireEvent.click(getByTestId('lessons-library-tab-ruby'));
        expect(getByTestId('lessons-library-course-ruby-course')).toBeInTheDocument();
        expect(queryByTestId(`lessons-library-course-${COURSE_ID}`)).not.toBeInTheDocument();
        expect(getByTestId('lessons-library-tab-ruby')).toHaveAttribute('aria-pressed', 'true');
        expect(getByTestId('lessons-library-tab-blocks')).toHaveAttribute('aria-pressed', 'false');
        fireEvent.click(getByTestId('lessons-library-tab-blocks'));
        expect(getByTestId(`lessons-library-course-${COURSE_ID}`)).toBeInTheDocument();
    });

    test('uses the Japanese strings', () => {
        const { getByTestId, getByText } = renderLibrary({}, { locale: 'ja', messages: ja });
        expect(getByText('レッスンを選ぶ')).toBeInTheDocument();
        expect(getByTestId('lessons-library-search').querySelector('input')).toHaveAttribute('placeholder', '検索');
        expect(getByTestId('lessons-library-tab-blocks')).toHaveTextContent('ブロック');
        expect(getByTestId('lessons-library-lesson-blocks-l1')).toHaveTextContent('レッスン 1');
        expect(getByTestId('lessons-library-lesson-blocks-l1')).toHaveTextContent('うごかしてみよう');
        expect(getByTestId('lessons-library-lesson-blocks-l3')).toHaveTextContent('おぼえて つたえよう');
        expect(courseProgressText(getByTestId)).toBe('0 / 11');
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
            const { getByTestId, getAllByTestId } = renderLibrary(
                { focusLessonId: LESSON.id, nextChallengeId: ALL_IDS[3] },
                { locale: 'ja', messages: ja },
            );
            const section = getByTestId(`lessons-library-lesson-${LESSON.id}`);
            expect(section).toHaveAttribute('data-focused', 'true');
            expect(scrollIntoView).toHaveBeenCalledTimes(1);
            expect(scrollIntoView.mock.instances[0]).toBe(section);
            const next = getByTestId(`lessons-library-challenge-${ALL_IDS[3]}`);
            expect(next).toHaveAttribute('data-next', 'true');
            expect(getAllByTestId('lessons-library-challenge-next')).toHaveLength(1);
            expect(next).toHaveTextContent('次はこれ！');
            expect(getByTestId(`lessons-library-challenge-${ALL_IDS[4]}`)).toHaveAttribute('data-next', 'false');
        } finally {
            delete window.HTMLElement.prototype.scrollIntoView;
        }
    });
});
