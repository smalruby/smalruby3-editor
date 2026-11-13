/* eslint-env jest */
import '@testing-library/jest-dom';
import { render } from '@testing-library/react';
import React from 'react';
import { IntlProvider } from 'react-intl';
import TeacherLessonProgress from '../../../src/components/classroom-modal/teacher-lesson-progress.jsx';
import { lessonProgressContext } from '../../../src/lib/classroom-lesson-progress.js';
import { findCourse } from '../../../src/lib/lessons/courses.js';
import { en, ja } from '../../../src/lib/lessons/lessons.locale.js';

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
