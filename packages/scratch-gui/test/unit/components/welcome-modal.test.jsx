/* eslint-env jest */
import '@testing-library/jest-dom';
import { fireEvent, render } from '@testing-library/react';
import React from 'react';
import { IntlProvider } from 'react-intl';
import WelcomeModal from '../../../src/components/welcome-modal/welcome-modal.jsx';

const COURSE = {
    name: { id: 'gui.lessons.course.test.name', defaultMessage: 'Programmer from Today' },
    lessonCount: 3,
    challengeCount: 11,
};

const renderModal = (props = {}) => {
    const all = {
        course: COURSE,
        onLater: jest.fn(),
        onLearnMore: jest.fn(),
        onStartLessons: jest.fn(),
        ...props,
    };
    return {
        ...render(
            <IntlProvider locale="en">
                <WelcomeModal {...all} />
            </IntlProvider>,
        ),
        ...all,
    };
};

describe('WelcomeModal (#1888)', () => {
    test('the primary button is 「レッスンを始める」 and calls onStartLessons', () => {
        const { getByTestId, queryByTestId, onStartLessons } = renderModal();
        expect(queryByTestId('welcome-modal-start-tutorial')).not.toBeInTheDocument();
        const start = getByTestId('welcome-modal-start-lessons');
        expect(start).toHaveTextContent('Start the lessons');
        fireEvent.click(start);
        expect(onStartLessons).toHaveBeenCalledTimes(1);
    });

    test('has a purple header with the title', () => {
        const { getByTestId } = renderModal();
        expect(getByTestId('welcome-modal-header')).toHaveTextContent('Welcome to Smalruby');
    });

    test('keeps the three cards and the 2 secondary buttons', () => {
        const { getByTestId, getAllByRole, onLearnMore, onLater } = renderModal();
        expect(getAllByRole('heading', { level: 3 })).toHaveLength(3);
        fireEvent.click(getByTestId('welcome-modal-learn-more'));
        fireEvent.click(getByTestId('welcome-modal-later'));
        expect(onLearnMore).toHaveBeenCalledTimes(1);
        expect(onLater).toHaveBeenCalledTimes(1);
    });

    test('shows the course guide with the counts from the course data', () => {
        const { getByTestId } = renderModal({ course: { ...COURSE, lessonCount: 2, challengeCount: 7 } });
        const guide = getByTestId('welcome-modal-course-guide');
        expect(guide).toHaveTextContent('Programmer from Today');
        expect(guide).toHaveTextContent('2 lessons');
        expect(guide).toHaveTextContent('7 challenges');
    });

    test('on a narrow screen the primary button is the same, and the course guide is left out', () => {
        const { getByTestId, queryByTestId } = renderModal({ isNarrow: true });
        expect(getByTestId('welcome-modal-start-lessons')).toBeInTheDocument();
        expect(getByTestId('welcome-modal-learn-more')).toBeInTheDocument();
        expect(getByTestId('welcome-modal-later')).toBeInTheDocument();
        expect(queryByTestId('welcome-modal-course-guide')).not.toBeInTheDocument();
    });
});
