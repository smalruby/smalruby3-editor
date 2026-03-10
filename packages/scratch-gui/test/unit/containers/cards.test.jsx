import React from 'react';
import configureStore from 'redux-mock-store';
import {Provider} from 'react-redux';
import {IntlProvider} from 'react-intl';
import {render, fireEvent, act} from '@testing-library/react';

import Cards from '../../../src/containers/cards.jsx';
import {cardsInitialState} from '../../../src/reducers/cards';

// Store the props passed to the CardsComponent for inspection
let capturedProps = {};
jest.mock('../../../src/components/cards/cards.jsx', () => {
    // eslint-disable-next-line no-undef
    const MockCards = jest.fn(props => {
        capturedProps = props;
        return null;
    });
    return {__esModule: true, default: MockCards};
});

// Need to mock the translate-image module
jest.mock('../../../src/lib/libraries/decks/translate-image.js', () => ({
    loadImageData: jest.fn(),
    translateImage: jest.fn(key => key)
}));

const mockStore = configureStore();

const TEST_DECK_ID = 'test-deck';

const createStoreState = (overrides = {}) => ({
    scratchGui: {
        cards: {
            ...cardsInitialState,
            visible: true,
            activeDeckId: TEST_DECK_ID,
            step: 0,
            expanded: true,
            content: {
                [TEST_DECK_ID]: {
                    name: 'Test Tutorial',
                    nameMessageId: 'gui.howtos.test.name',
                    img: 'test.jpg',
                    steps: [
                        {
                            title: 'Step 1',
                            image: 'step1.png',
                            startTutorial: true,
                            animationTarget: 'startTutorialButton'
                        },
                        {
                            title: 'Step 2',
                            image: 'step2.png',
                            code: 'puts "hello"',
                            animationTarget: 'insertCodeButton'
                        }
                    ]
                }
            },
            ...overrides
        },
        platform: {platform: 'WEB'},
        projectChanged: false
    },
    locales: {
        isRtl: false,
        locale: 'en'
    }
});

const renderCards = (storeState = createStoreState()) => {
    const store = mockStore(storeState);
    return {
        store,
        ...render(
            <IntlProvider locale="en" messages={{'gui.howtos.test.name': 'Test Tutorial'}}>
                <Provider store={store}>
                    <Cards />
                </Provider>
            </IntlProvider>
        )
    };
};

describe('Cards container - start tutorial', () => {
    beforeEach(() => {
        capturedProps = {};
        jest.useFakeTimers();
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    test('passes onStartTutorial to the cards component', () => {
        renderCards();
        expect(typeof capturedProps.onStartTutorial).toBe('function');
    });

    test('dispatches requestNewProject and setProjectTitle when start tutorial is clicked', () => {
        const confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(true);

        const {store} = renderCards();
        act(() => {
            capturedProps.onStartTutorial();
        });

        const actions = store.getActions();

        // Should dispatch START_FETCHING_NEW (from requestNewProject(false))
        expect(actions.some(a => a.type === 'scratch-gui/project-state/START_FETCHING_NEW')).toBe(true);

        // Should dispatch projectTitle/SET_PROJECT_TITLE with the deck name
        const setTitleAction = actions.find(a => a.type === 'projectTitle/SET_PROJECT_TITLE');
        expect(setTitleAction).toBeTruthy();
        expect(setTitleAction.title).toBe('Test Tutorial');

        confirmSpy.mockRestore();
    });

    test('shows confirm dialog when project has been changed', () => {
        const confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(false);

        const storeState = createStoreState();
        storeState.scratchGui.projectChanged = true;
        const {store} = renderCards(storeState);

        act(() => {
            capturedProps.onStartTutorial();
        });

        // Should have shown confirm dialog
        expect(confirmSpy).toHaveBeenCalled();

        // Should NOT dispatch any project actions since user cancelled
        const actions = store.getActions();
        expect(actions.some(a => a.type === 'scratch-gui/project-state/START_FETCHING_NEW')).toBe(false);

        confirmSpy.mockRestore();
    });

    test('does not show confirm dialog when project has not been changed', () => {
        const confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(true);

        renderCards();
        act(() => {
            capturedProps.onStartTutorial();
        });

        // Should NOT have shown confirm dialog since project is not changed
        expect(confirmSpy).not.toHaveBeenCalled();

        confirmSpy.mockRestore();
    });

    test('schedules startTutorialButton animation after mount', () => {
        renderCards();

        // Before timer: no animation
        expect(capturedProps.animateStartTutorial).toBe(false);

        // Advance timers past the animation delay
        act(() => {
            jest.advanceTimersByTime(400);
        });

        expect(capturedProps.animateStartTutorial).toBe(true);
    });
});
