/* eslint-env jest */
import '@testing-library/jest-dom';
import { fireEvent, render } from '@testing-library/react';
import React from 'react';
import { IntlProvider } from 'react-intl';
import { Provider } from 'react-redux';
import configureStore from 'redux-mock-store';
import WelcomeModalHOC from '../../../src/containers/welcome-modal-hoc.jsx';
import { focusLessonsLibraryStart } from '../../../src/reducers/lesson-mode';
import { closeWelcomeModal, openLessonsLibrary, openTipsLibrary } from '../../../src/reducers/modals';

const renderHoc = (isOpen = true) => {
    const store = configureStore()({ scratchGui: { modals: { welcomeModal: isOpen } } });
    const utils = render(
        <Provider store={store}>
            <IntlProvider locale="en">
                <WelcomeModalHOC />
            </IntlProvider>
        </Provider>,
    );
    return { ...utils, store };
};

describe('WelcomeModal container (#1888)', () => {
    beforeEach(() => {
        window.dataLayer = [];
    });

    test('renders nothing while closed', () => {
        const { queryByTestId } = renderHoc(false);
        expect(queryByTestId('welcome-modal')).not.toBeInTheDocument();
    });

    test('「レッスンを始める」 closes the welcome and opens the lessons library at the next challenge', () => {
        const { getByTestId, store } = renderHoc();
        fireEvent.click(getByTestId('welcome-modal-start-lessons'));
        expect(store.getActions()).toEqual([closeWelcomeModal(), focusLessonsLibraryStart(), openLessonsLibrary()]);
        expect(store.getActions()).not.toContainEqual(openTipsLibrary());
    });

    test('sends modal_action with the label start_lessons', () => {
        const { getByTestId } = renderHoc();
        fireEvent.click(getByTestId('welcome-modal-start-lessons'));
        expect(window.dataLayer).toContainEqual(
            expect.objectContaining({ event: 'welcome', action: 'modal_action', label: 'start_lessons' }),
        );
    });

    test('the course guide counts come from the first course', () => {
        const { getByTestId } = renderHoc();
        const guide = getByTestId('welcome-modal-course-guide');
        expect(guide).toHaveTextContent('3 lessons');
        expect(guide).toHaveTextContent('11 challenges');
    });
});
