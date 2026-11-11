/* eslint-env jest */
import '@testing-library/jest-dom';
import { fireEvent, render } from '@testing-library/react';
import React from 'react';
import { IntlProvider } from 'react-intl';
import { Provider } from 'react-redux';
import configureStore from 'redux-mock-store';
import ConnectedLessonsLibrary, { LessonsLibrary } from '../../../src/containers/lessons-library.jsx';
import { emptyProgress } from '../../../src/lib/lessons/lesson-progress';
import { reloadProgress, startChallenge } from '../../../src/reducers/lesson-mode';
import { closeLessonsLibrary } from '../../../src/reducers/modals';

const CHALLENGE_ID = 'blocks-l1-click-say';

const buildStore = ({ visible }) =>
    configureStore()({
        locales: { isRtl: false },
        scratchGui: {
            lessonMode: { progress: emptyProgress() },
            modals: { lessonsLibrary: visible },
        },
    });

const renderUnconnected = (props = {}) => {
    const store = buildStore({ visible: true });
    const all = {
        onReloadProgress: jest.fn(),
        onRequestClose: jest.fn(),
        onStartChallenge: jest.fn(),
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
        expect(onStartChallenge).toHaveBeenCalledWith(CHALLENGE_ID);
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
});
