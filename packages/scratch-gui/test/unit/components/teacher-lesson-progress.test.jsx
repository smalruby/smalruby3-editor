/* eslint-env jest */
import '@testing-library/jest-dom';
import { render } from '@testing-library/react';
import React from 'react';
import { IntlProvider } from 'react-intl';
import TeacherLessonProgress from '../../../src/components/classroom-modal/teacher-lesson-progress.jsx';
import { lessonProgressContext } from '../../../src/lib/classroom-lesson-progress.js';
import { findCourse } from '../../../src/lib/lessons/courses.js';
import { en, ja } from '../../../src/lib/lessons/lessons.locale.js';
import jaHiraAll from '../../../src/locales/ja-Hira.js';
import jaAll from '../../../src/locales/ja.js';

const lesson = {
    courseId: 'kyou-kara-programmer',
    challengeIds: ['blocks-l1-key-sound', 'blocks-l1-arrow-move'],
    requiredChallengeIds: ['blocks-l1-arrow-move'],
    completion: { type: 'count', count: 2 },
    submitWork: false,
    scoring: null,
};
const ctx = lessonProgressContext(lesson, findCourse(lesson.courseId));

const renderTab = (locale, messages) =>
    render(
        <IntlProvider locale={locale} messages={messages}>
            <TeacherLessonProgress
                ctx={ctx}
                members={[]}
                now={Date.UTC(2026, 10, 15)}
                rowsByMember={{}}
                status="ready"
                studentCount={1}
            />
        </IntlProvider>,
    );

describe('TeacherLessonProgress challenge headers (#1779 Q8)', () => {
    test('en: the header shows the challenge number; the name is in the title', () => {
        const { getByTestId } = renderTab('en', en);
        const [first, second] = ctx.columns;
        const head = getByTestId(`classroom-lesson-progress-head-${first.id}`);
        expect(head).toHaveTextContent(`1-${first.challenge.number}`);
        const name = en[first.challenge.name.id] || first.challenge.name.defaultMessage;
        expect(head).not.toHaveTextContent(name);
        expect(head.getAttribute('title')).toContain(name);
        const requiredHead = getByTestId(`classroom-lesson-progress-head-${second.id}`);
        expect(requiredHead).toHaveTextContent(`★1-${second.challenge.number}`);
    });

    test('ja: the header keeps the challenge name', () => {
        const { getByTestId } = renderTab('ja', ja);
        const [first] = ctx.columns;
        const name = ja[first.challenge.name.id];
        expect(getByTestId(`classroom-lesson-progress-head-${first.id}`)).toHaveTextContent(name);
    });
});

describe('TeacherLessonProgress seat note (#2301)', () => {
    const NOW = Date.UTC(2026, 10, 15, 1, 0);
    const recent = new Date(NOW - 60 * 1000).toISOString();
    const chatLesson = {
        courseId: 'chat-wo-tsukurou',
        challengeIds: ['chat-l1-sequence'],
        requiredChallengeIds: [],
        completion: { type: 'all' },
        submitWork: false,
        scoring: null,
    };
    const chatCtx = lessonProgressContext(chatLesson, findCourse(chatLesson.courseId));
    const members = [1, 2, 3].map((n) => ({ memberId: `seat-0${n}`, displayName: `s${n}` }));
    const rowsByMember = {
        'seat-01': {
            memberId: 'seat-01',
            challenges: {},
            current: null,
            readiness: { checkedAt: recent, missing: [] },
            updatedAt: recent,
        },
        'seat-02': {
            memberId: 'seat-02',
            challenges: {},
            current: { challengeId: 'blocks-l1-count', openedAt: recent, review: true },
            readiness: {
                checkedAt: recent,
                missing: ['blocks-l0-where', 'blocks-l1-ask-answer', 'blocks-l1-count'],
            },
            updatedAt: recent,
        },
    };
    const renderNotes = (messages, context = chatCtx) =>
        render(
            <IntlProvider locale="ja" messages={messages}>
                <TeacherLessonProgress
                    ctx={context}
                    members={members}
                    now={NOW}
                    rowsByMember={rowsByMember}
                    status="ready"
                    studentCount={3}
                />
            </IntlProvider>,
        );

    test('ja: じゅんび ✓, the first two missing names with ほか N, and おさらい中 with the challenge', () => {
        const { getByTestId, queryByTestId } = renderNotes(jaAll);
        expect(getByTestId('classroom-lesson-progress-readiness-seat-01')).toHaveTextContent('じゅんび ✓');
        const missing = getByTestId('classroom-lesson-progress-readiness-seat-02');
        expect(missing).toHaveTextContent('じゅんび △ どこでしょう？・聞いて答えよう ほか 1');
        expect(missing.getAttribute('title')).toBe('じゅんび △ どこでしょう？・聞いて答えよう・数えよう');
        expect(getByTestId('classroom-lesson-progress-review-seat-02')).toHaveTextContent('おさらい中: 数えよう');
        expect(queryByTestId('classroom-lesson-progress-readiness-seat-03')).toBeNull();
    });

    test('ja-Hira: no kanji', () => {
        const { getByTestId } = renderNotes(jaHiraAll);
        expect(getByTestId('classroom-lesson-progress-review-seat-02')).toHaveTextContent(
            'おさらいちゅう: かぞえよう',
        );
    });

    test('no note column for a course without a readiness check and no notes', () => {
        const { container } = render(
            <IntlProvider locale="ja" messages={jaAll}>
                <TeacherLessonProgress
                    ctx={ctx}
                    members={[]}
                    now={NOW}
                    rowsByMember={{}}
                    status="ready"
                    studentCount={1}
                />
            </IntlProvider>,
        );
        expect(container).not.toHaveTextContent('じゅんび・おさらい');
    });
});
