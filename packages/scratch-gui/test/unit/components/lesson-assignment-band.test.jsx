/* eslint-env jest */
import '@testing-library/jest-dom';
import { fireEvent, render } from '@testing-library/react';
import React from 'react';
import { IntlProvider } from 'react-intl';
import LessonAssignmentBand from '../../../src/components/lesson-assignment-band/lesson-assignment-band.jsx';
import { assignmentProgress, normalizeAssignmentLesson } from '../../../src/lib/lessons/assignment-progress.js';
import { en, ja } from '../../../src/lib/lessons/lessons.locale.js';

const record = { completedAt: '2026-11-15T01:00:00.000Z', courseId: 'blocks-l1-click-say', lessonId: 'l' };
const progressOf = (...ids) => ({ version: 1, challenges: Object.fromEntries(ids.map((id) => [id, record])) });
const lesson = (overrides = {}) =>
    normalizeAssignmentLesson({
        courseId: 'kyou-kara-programmer',
        challengeIds: ['blocks-l1-key-sound', 'blocks-l1-arrow-move', 'blocks-l1-click-say', 'blocks-l1-repeat'],
        requiredChallengeIds: ['blocks-l1-arrow-move'],
        ...overrides,
    });

const renderBand = (props, { locale = 'en', messages = en } = {}) =>
    render(
        <IntlProvider locale={locale} messages={messages}>
            <LessonAssignmentBand {...props} />
        </IntlProvider>,
    );

describe('LessonAssignmentBand', () => {
    test('one sentence: name, condition and「あと N つ（★ R つ）で課題クリア」, no circles (#1771)', () => {
        const l = lesson({ completion: { type: 'count', count: 3 } });
        const { getByTestId, queryAllByTestId } = renderBand(
            {
                assignmentName: '第1回',
                completionAll: false,
                status: assignmentProgress(l, progressOf('blocks-l1-key-sound')),
            },
            { locale: 'ja', messages: ja },
        );
        expect(getByTestId('lesson-assignment-band-name')).toHaveTextContent('第1回');
        expect(getByTestId('lesson-assignment-band-condition')).toHaveTextContent('条件: 3 つ（★ をふくむ）');
        expect(queryAllByTestId('lesson-assignment-dot')).toHaveLength(0);
        expect(getByTestId('lesson-assignment-remaining')).toHaveTextContent('あと 2 つ（★ 1 つ）で課題クリア');
        expect(getByTestId('lesson-assignment-band')).toHaveTextContent(
            '課題第1回条件: 3 つ（★ をふくむ）あと 2 つ（★ 1 つ）で課題クリア',
        );
    });

    test('the ★ part is left out once no required challenge is left', () => {
        const l = lesson({ completion: { type: 'count', count: 3 } });
        const { getByTestId } = renderBand(
            { status: assignmentProgress(l, progressOf('blocks-l1-arrow-move')) },
            { locale: 'ja', messages: ja },
        );
        expect(getByTestId('lesson-assignment-remaining')).toHaveTextContent(/^あと 2 つで課題クリア$/);
    });

    test('English wording', () => {
        const { getByTestId } = renderBand({ status: assignmentProgress(lesson(), progressOf()) });
        expect(getByTestId('lesson-assignment-remaining')).toHaveTextContent('4 more (★ 1) to clear the assignment');
    });

    test('cleared: ✓ and, for a work-submit assignment, the guidance and the submit button', () => {
        const onSubmit = jest.fn();
        const l = lesson({ submitWork: true });
        const { getByTestId } = renderBand({
            status: assignmentProgress(
                l,
                progressOf('blocks-l1-key-sound', 'blocks-l1-arrow-move', 'blocks-l1-click-say', 'blocks-l1-repeat'),
            ),
            canSubmit: true,
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
            status: assignmentProgress(l, progressOf('blocks-l1-key-sound')),
            canSubmit: false,
            onSubmit: jest.fn(),
        });
        expect(queryByTestId('lesson-assignment-band-submit')).toBeNull();
        rerender(
            <IntlProvider locale="en" messages={en}>
                <LessonAssignmentBand
                    status={assignmentProgress(
                        l,
                        progressOf(
                            'blocks-l1-key-sound',
                            'blocks-l1-arrow-move',
                            'blocks-l1-click-say',
                            'blocks-l1-repeat',
                        ),
                    )}
                />
            </IntlProvider>,
        );
        expect(queryByTestId('lesson-assignment-band-submit')).toBeNull();
    });

    test('compact: only「あと N つ（★ R つ）」, no circles, in one line', () => {
        const { getByTestId, queryByTestId, queryAllByTestId, rerender } = renderBand(
            { status: assignmentProgress(lesson(), progressOf('blocks-l1-key-sound')), variant: 'compact' },
            { locale: 'ja', messages: ja },
        );
        expect(getByTestId('lesson-task-bar-assignment')).toBeInTheDocument();
        expect(getByTestId('lesson-assignment-remaining')).toHaveTextContent(/^あと 3 つ（★ 1 つ）$/);
        expect(queryAllByTestId('lesson-assignment-dot')).toHaveLength(0);
        expect(queryByTestId('lesson-assignment-band-condition')).toBeNull();
        rerender(
            <IntlProvider locale="ja" messages={ja}>
                <LessonAssignmentBand
                    status={assignmentProgress(lesson(), progressOf('blocks-l1-key-sound', 'blocks-l1-arrow-move'))}
                    variant="compact"
                />
            </IntlProvider>,
        );
        expect(getByTestId('lesson-assignment-remaining')).toHaveTextContent(/^あと 2 つ$/);
    });

    test('after the first submission the guidance and the button are hidden (like the class screen)', () => {
        const l = lesson({ submitWork: true });
        const { queryByTestId } = renderBand({
            status: assignmentProgress(l, progressOf(...l.challengeIds)),
            canSubmit: true,
            submitted: true,
            onSubmit: jest.fn(),
        });
        expect(queryByTestId('lesson-assignment-band-submit')).toBeNull();
        expect(queryByTestId('lesson-assignment-band-submit-guide')).toBeNull();
    });

    test('challenges unknown to this build: a reload note, not counted', () => {
        const l = lesson({ challengeIds: ['blocks-l1-key-sound', 'not-in-this-build'], requiredChallengeIds: [] });
        const { getByTestId } = renderBand(
            { status: assignmentProgress(l, progressOf()) },
            { locale: 'ja', messages: ja },
        );
        expect(getByTestId('lesson-assignment-remaining')).toHaveTextContent('あと 1 つで課題クリア');
        expect(getByTestId('lesson-assignment-band-unknown')).toHaveTextContent('ページを読み込み直してね');
    });
});
