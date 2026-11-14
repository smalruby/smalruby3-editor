/* eslint-env jest */
import '@testing-library/jest-dom';
import { fireEvent, render } from '@testing-library/react';
import React from 'react';
import { IntlProvider } from 'react-intl';
import { Provider } from 'react-redux';
import configureStore from 'redux-mock-store';
import ConnectedLessonsLibrary, { LessonsLibrary } from '../../../src/containers/lessons-library.jsx';
import { normalizeAssignmentLesson } from '../../../src/lib/lessons/assignment-progress';
import { emptyProgress } from '../../../src/lib/lessons/lesson-progress';
import { clearLessonsLibraryFocus, reloadProgress, startChallenge } from '../../../src/reducers/lesson-mode';
import { closeLessonsLibrary } from '../../../src/reducers/modals';

const CHALLENGE_ID = 'blocks-l1-click-say';

const buildStore = ({ visible, focus = null, startFocus = false }) =>
    configureStore()({
        locales: { isRtl: false },
        scratchGui: {
            lessonMode: {
                progress: emptyProgress(),
                libraryFocusChallengeId: focus,
                libraryStartFocus: startFocus,
            },
            modals: { lessonsLibrary: visible },
            settings: { colorMode: 'default' },
        },
    });

const renderUnconnected = (props = {}) => {
    const store = buildStore({ visible: true });
    const all = {
        colorMode: 'default',
        onReloadProgress: jest.fn(),
        onRequestClose: jest.fn(),
        onStartChallenge: jest.fn(),
        onSubmitAssignment: jest.fn(),
        progress: emptyProgress(),
        visible: true,
        ...props,
    };
    const utils = render(
        <Provider store={store}>
            <IntlProvider locale="en">
                <LessonsLibrary {...all} />
            </IntlProvider>
        </Provider>,
    );
    const rerender = (next) =>
        utils.rerender(
            <Provider store={store}>
                <IntlProvider locale="en">
                    <LessonsLibrary {...all} {...next} />
                </IntlProvider>
            </Provider>,
        );
    return { ...utils, ...all, rerender };
};

describe('LessonsLibrary container', () => {
    test('renders nothing while the modal is closed', () => {
        const { queryByTestId, onReloadProgress } = renderUnconnected({ visible: false });
        expect(queryByTestId('lessons-library')).not.toBeInTheDocument();
        expect(onReloadProgress).not.toHaveBeenCalled();
    });

    test('reloads the progress each time the library opens', () => {
        const { getByTestId, onReloadProgress, rerender } = renderUnconnected({ visible: true });
        expect(getByTestId('lessons-library')).toBeInTheDocument();
        expect(onReloadProgress).toHaveBeenCalledTimes(1);
        rerender({ visible: false });
        rerender({ visible: true });
        expect(onReloadProgress).toHaveBeenCalledTimes(2);
    });

    test('selecting a challenge starts it and closes the library', () => {
        const { getByTestId, onStartChallenge, onRequestClose } = renderUnconnected();
        fireEvent.click(getByTestId(`lessons-library-challenge-${CHALLENGE_ID}`));
        expect(onStartChallenge).toHaveBeenCalledWith(CHALLENGE_ID, { fromAssignment: false });
        expect(onRequestClose).toHaveBeenCalledTimes(1);
    });

    test('connected: dispatches reloadProgress on open, startChallenge + close on select', () => {
        const store = buildStore({ visible: true });
        const { getByTestId } = render(
            <Provider store={store}>
                <IntlProvider locale="en">
                    <ConnectedLessonsLibrary />
                </IntlProvider>
            </Provider>,
        );
        expect(store.getActions()).toContainEqual(reloadProgress());
        fireEvent.click(getByTestId(`lessons-library-challenge-${CHALLENGE_ID}`));
        expect(store.getActions()).toContainEqual(startChallenge(CHALLENGE_ID));
        expect(store.getActions()).toContainEqual(closeLessonsLibrary());
    });

    test('with a focus, shows the lesson of that challenge and marks the next one', () => {
        const { getByTestId } = renderUnconnected({ focusChallengeId: CHALLENGE_ID });
        const lesson = getByTestId('lessons-library-lesson-blocks-l1');
        expect(lesson).toHaveAttribute('data-focused', 'true');
        const next = lesson.querySelector('[data-next="true"]');
        expect(next).not.toBeNull();
        expect(next.getAttribute('data-testid')).not.toBe(`lessons-library-challenge-${CHALLENGE_ID}`);
    });

    test('opened from the welcome 「レッスンを始める」, marks the first challenge to do (#1888)', () => {
        const { getByTestId } = renderUnconnected({ startFocus: true });
        const lesson = getByTestId('lessons-library-lesson-blocks-l1');
        expect(lesson).toHaveAttribute('data-focused', 'true');
        const first = lesson.querySelector('[data-next="true"]');
        expect(first.getAttribute('data-testid')).toBe('lessons-library-challenge-blocks-l1-key-sound');
        expect(first).toContainElement(getByTestId('lessons-library-challenge-next'));
    });

    test('opened from the welcome after some are done, marks the next one (#1888)', () => {
        const progress = {
            ...emptyProgress(),
            challenges: {
                'blocks-l1-key-sound': {
                    completedAt: '2026-11-10T00:00:00.000Z',
                    courseId: 'kyou-kara-programmer',
                    lessonId: 'blocks-l1',
                },
            },
        };
        const { getByTestId } = renderUnconnected({ startFocus: true, progress });
        const next = getByTestId('lessons-library-lesson-blocks-l1').querySelector('[data-next="true"]');
        expect(next.getAttribute('data-testid')).toBe('lessons-library-challenge-blocks-l1-arrow-move');
    });

    test('connected: reads the welcome start focus from the state (#1888)', () => {
        const store = buildStore({ visible: true, startFocus: true });
        const { getByTestId } = render(
            <Provider store={store}>
                <IntlProvider locale="en">
                    <ConnectedLessonsLibrary />
                </IntlProvider>
            </Provider>,
        );
        expect(getByTestId('lessons-library-challenge-blocks-l1-key-sound')).toHaveAttribute('data-next', 'true');
    });

    test('connected: closing the library also clears the focus', () => {
        const store = buildStore({ visible: true, focus: CHALLENGE_ID });
        const { getByTestId } = render(
            <Provider store={store}>
                <IntlProvider locale="en">
                    <ConnectedLessonsLibrary />
                </IntlProvider>
            </Provider>,
        );
        expect(getByTestId('lessons-library-lesson-blocks-l1')).toHaveAttribute('data-focused', 'true');
        fireEvent.click(getByTestId(`lessons-library-challenge-${CHALLENGE_ID}`));
        expect(store.getActions()).toContainEqual(closeLessonsLibrary());
        expect(store.getActions()).toContainEqual(clearLessonsLibraryFocus());
    });
});

describe('LessonsLibrary container: class assignment (#1599)', () => {
    const lesson = normalizeAssignmentLesson({
        courseId: 'kyou-kara-programmer',
        challengeIds: ['blocks-l1-key-sound', 'blocks-l1-if'],
        requiredChallengeIds: ['blocks-l1-if'],
    });

    test('from 「はじめる」 only the assignment challenges are shown, with the band, ★ and the next mark', () => {
        const { getByTestId, queryByTestId, onStartChallenge } = renderUnconnected({
            lesson,
            assignmentOnly: true,
            assignmentName: '第1回',
        });
        expect(getByTestId('lesson-assignment-band-name')).toHaveTextContent('第1回');
        expect(getByTestId('lessons-library-challenge-blocks-l1-key-sound')).toHaveAttribute('data-next', 'true');
        expect(getByTestId('lessons-library-challenge-blocks-l1-if')).toHaveAttribute('data-required', 'true');
        expect(queryByTestId(`lessons-library-challenge-${CHALLENGE_ID}`)).toBeNull();
        // #1771: the band does the job of the course progress, so the bar and「n / all」are hidden
        expect(getByTestId('lessons-library-course-kyou-kara-programmer')).toBeInTheDocument();
        expect(queryByTestId('lessons-library-course-progress')).toBeNull();
        fireEvent.click(getByTestId('lessons-library-challenge-blocks-l1-if'));
        expect(onStartChallenge).toHaveBeenCalledWith('blocks-l1-if', { fromAssignment: true });
    });

    test('from the menu the whole course is shown under the band', () => {
        const { getByTestId, getAllByTestId, onStartChallenge } = renderUnconnected({
            lesson,
            assignmentOnly: false,
        });
        expect(getByTestId('lesson-assignment-band')).toBeInTheDocument();
        // the whole course keeps its progress
        expect(getAllByTestId('lessons-library-course-progress').length).toBeGreaterThan(0);
        fireEvent.click(getByTestId(`lessons-library-challenge-${CHALLENGE_ID}`));
        expect(onStartChallenge).toHaveBeenCalledWith(CHALLENGE_ID, { fromAssignment: false });
    });

    test('without a lesson assignment there is no band and no ★', () => {
        const { queryByTestId } = renderUnconnected();
        expect(queryByTestId('lesson-assignment-band')).toBeNull();
        expect(queryByTestId('lessons-library-challenge-required')).toBeNull();
    });
});
