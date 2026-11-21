/* eslint-env jest */
import '@testing-library/jest-dom';
import { render } from '@testing-library/react';
import React from 'react';
import { IntlProvider } from 'react-intl';
import StudentAssignmentGoal from '../../../src/components/classroom-modal/student-assignment-goal.jsx';
import ja from '../../../src/locales/ja.js';

const LESSON = {
    courseId: 'kyou-kara-programmer',
    challengeIds: ['blocks-l1-key-sound', 'blocks-l1-arrow-move', 'blocks-l1-click-say'],
    requiredChallengeIds: ['blocks-l1-click-say'],
    completion: { type: 'count', count: 2 },
    submitWork: false,
};

const renderGoal = (lesson, locale = 'en', messages = {}) =>
    render(
        <IntlProvider locale={locale} messages={messages}>
            <StudentAssignmentGoal dataTestId="g" lesson={lesson} />
        </IntlProvider>,
    );

describe('StudentAssignmentGoal', () => {
    test('compact: the count and the next step only (no lessons line)', () => {
        const { getByTestId, queryByTestId } = render(
            <IntlProvider locale="en" messages={{}}>
                <StudentAssignmentGoal compact dataTestId="g" lesson={LESSON} />
            </IntlProvider>,
        );
        expect(getByTestId('g-count')).toHaveTextContent('Clear 2 challenges');
        expect(getByTestId('g-next')).toHaveTextContent('Then the assignment is cleared!');
        expect(queryByTestId('g-lessons')).toBeNull();
    });

    test('nothing for a non-lesson assignment', () => {
        const { queryByTestId } = renderGoal(null);
        expect(queryByTestId('g')).not.toBeInTheDocument();
    });

    test('Japanese: 「チャレンジを N つクリア（★ M つはかならず）」 and the lessons', () => {
        const { getByTestId } = renderGoal(LESSON, 'ja', ja);
        expect(getByTestId('g')).toHaveTextContent('ゴール');
        expect(getByTestId('g-count')).toHaveTextContent('チャレンジを 2 つクリア（★ 1 つはかならず）');
        expect(getByTestId('g-lessons')).toHaveTextContent('レッスン: レッスン 1「');
        expect(getByTestId('g-next')).toHaveTextContent('クリアしたら課題クリア！');
    });

    test('no ★ part when nothing is required; the submit line when work is submitted', () => {
        const { getByTestId } = renderGoal({ ...LESSON, requiredChallengeIds: [], submitWork: true });
        expect(getByTestId('g-count').textContent).toBe('Clear 2 challenges');
        expect(getByTestId('g-next')).toHaveTextContent('Then make your own program and submit it');
    });

    test('a setting without challenges still tells what to do', () => {
        const { getByTestId, queryByTestId } = renderGoal({ submitWork: true });
        expect(getByTestId('g-count')).toHaveTextContent('Go through the lessons and meet the goal');
        expect(queryByTestId('g-lessons')).not.toBeInTheDocument();
    });
});
