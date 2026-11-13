/* eslint-env jest */
import '@testing-library/jest-dom';
import { fireEvent, render } from '@testing-library/react';
import React from 'react';
import { IntlProvider } from 'react-intl';
import LessonAssignmentBand from '../../../src/components/lesson-assignment-band/lesson-assignment-band.jsx';
import { assignmentProgress, normalizeAssignmentLesson } from '../../../src/lib/lessons/assignment-progress.js';
import { en, ja } from '../../../src/lib/lessons/lessons.locale.js';

const record = { completedAt: '2026-11-15T01:00:00.000Z', courseId: 'c', lessonId: 'l' };
const progressOf = (...ids) => ({ version: 1, challenges: Object.fromEntries(ids.map((id) => [id, record])) });
const lesson = (overrides = {}) =>
    normalizeAssignmentLesson({
        courseId: 'kyou-kara-programmer',
        challengeIds: ['a', 'b', 'c', 'd'],
        requiredChallengeIds: ['b'],
        ...overrides,
    });

const renderBand = (props, { locale = 'en', messages = en } = {}) =>
    render(
        <IntlProvider locale={locale} messages={messages}>
            <LessonAssignmentBand {...props} />
        </IntlProvider>,
    );

describe('LessonAssignmentBand', () => {
    test('shows the name, the condition, the dots (★ for required) and how many are left', () => {
        const l = lesson({ completion: { type: 'count', count: 3 } });
        const { getByTestId, getAllByTestId } = renderBand(
            { assignmentName: '第1回', completionAll: false, status: assignmentProgress(l, progressOf('a')) },
            { locale: 'ja', messages: ja },
        );
        expect(getByTestId('lesson-assignment-band-name')).toHaveTextContent('第1回');
        expect(getByTestId('lesson-assignment-band-condition')).toHaveTextContent('条件: 3 つ（★ をふくむ）');
        const dots = getAllByTestId('lesson-assignment-dot');
        expect(dots.map((d) => [d.dataset.completed, d.dataset.required])).toEqual([
            ['true', 'false'],
            ['false', 'true'],
            ['false', 'false'],
            ['false', 'false'],
        ]);
        expect(getByTestId('lesson-assignment-remaining')).toHaveTextContent('あと 2 つで課題クリア');
        expect(getByTestId('lesson-assignment-required-remaining')).toHaveTextContent('★ あと 1');
    });

    test('cleared: ✓ and, for a work-submit assignment, the guidance and the submit button', () => {
        const onSubmit = jest.fn();
        const l = lesson({ submitWork: true });
        const { getByTestId } = renderBand({
            status: assignmentProgress(l, progressOf('a', 'b', 'c', 'd')),
            submitWork: true,
            onSubmit,
        });
        expect(getByTestId('lesson-assignment-band')).toHaveAttribute('data-cleared', 'true');
        expect(getByTestId('lesson-assignment-cleared')).toHaveTextContent('Assignment cleared');
        expect(getByTestId('lesson-assignment-band-condition')).toHaveTextContent('Goal: all 4');
        fireEvent.click(getByTestId('lesson-assignment-band-submit'));
        expect(onSubmit).toHaveBeenCalled();
    });

    test('no submit button before the goal is met or without work submission', () => {
        const l = lesson({ submitWork: true });
        const { queryByTestId, rerender } = renderBand({
            status: assignmentProgress(l, progressOf('a')),
            submitWork: true,
            onSubmit: jest.fn(),
        });
        expect(queryByTestId('lesson-assignment-band-submit')).toBeNull();
        rerender(
            <IntlProvider locale="en" messages={en}>
                <LessonAssignmentBand status={assignmentProgress(l, progressOf('a', 'b', 'c', 'd'))} />
            </IntlProvider>,
        );
        expect(queryByTestId('lesson-assignment-band-submit')).toBeNull();
    });

    test('compact: only the dots and what is left, in one line', () => {
        const { getByTestId, queryByTestId } = renderBand({
            status: assignmentProgress(lesson(), progressOf('a')),
            variant: 'compact',
        });
        expect(getByTestId('lesson-task-bar-assignment')).toBeInTheDocument();
        expect(getByTestId('lesson-assignment-remaining')).toHaveTextContent('3 more to clear the assignment');
        expect(queryByTestId('lesson-assignment-band-condition')).toBeNull();
    });
});
