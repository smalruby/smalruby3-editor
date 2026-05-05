import { render, fireEvent, act } from '@testing-library/react';
import React from 'react';
import { IntlProvider } from 'react-intl';
import { Provider } from 'react-redux';
import configureStore from 'redux-mock-store';
import Cards from '../../../src/containers/cards.jsx';
import { cardsInitialState } from '../../../src/reducers/cards';

// Store the props passed to the CardsComponent for inspection
let capturedProps = {};
jest.mock('../../../src/components/cards/cards.jsx', () => {
    // eslint-disable-next-line no-undef
    const MockCards = jest.fn((props) => {
        capturedProps = props;
        return null;
    });
    return { __esModule: true, default: MockCards };
});

// Need to mock the translate-image module
jest.mock('../../../src/lib/libraries/decks/translate-image.js', () => ({
    loadImageData: jest.fn(),
    translateImage: jest.fn((key) => key),
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
                            animationTarget: 'startTutorialButton',
                        },
                        {
                            title: 'Step 2',
                            image: 'step2.png',
                            code: 'puts "hello"',
                            animationTarget: 'insertCodeButton',
                        },
                    ],
                },
            },
            ...overrides,
        },
        platform: { platform: 'WEB' },
        projectChanged: false,
    },
    locales: {
        isRtl: false,
        locale: 'en',
    },
});

const renderCards = (storeState = createStoreState()) => {
    const store = mockStore(storeState);
    return {
        store,
        ...render(
            <IntlProvider locale="en" messages={{ 'gui.howtos.test.name': 'Test Tutorial' }}>
                <Provider store={store}>
                    <Cards />
                </Provider>
            </IntlProvider>,
        ),
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

        const { store } = renderCards();
        act(() => {
            capturedProps.onStartTutorial();
        });

        const actions = store.getActions();

        // Should dispatch SET_PENDING_PROJECT_TITLE with the deck name
        const setPendingTitleAction = actions.find((a) => a.type === 'scratch-gui/cards/SET_PENDING_PROJECT_TITLE');
        expect(setPendingTitleAction).toBeTruthy();
        expect(setPendingTitleAction.title).toBe('Test Tutorial');

        // Should dispatch START_FETCHING_NEW (from requestNewProject(false))
        expect(actions.some((a) => a.type === 'scratch-gui/project-state/START_FETCHING_NEW')).toBe(true);

        confirmSpy.mockRestore();
    });

    test('shows confirm dialog when project has been changed', () => {
        const confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(false);

        const storeState = createStoreState();
        storeState.scratchGui.projectChanged = true;
        const { store } = renderCards(storeState);

        act(() => {
            capturedProps.onStartTutorial();
        });

        // Should have shown confirm dialog
        expect(confirmSpy).toHaveBeenCalled();

        // Should NOT dispatch any project actions since user cancelled
        const actions = store.getActions();
        expect(actions.some((a) => a.type === 'scratch-gui/project-state/START_FETCHING_NEW')).toBe(false);

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

// === Smalruby: Start of next-button lock ===
describe('Cards container - next button lock', () => {
    beforeEach(() => {
        capturedProps = {};
        jest.useFakeTimers();
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    test('blocks onNextStep when step has an action button (startTutorial)', () => {
        const { store } = renderCards();

        // Next should be locked on mount (step 0 has startTutorial)
        act(() => {
            capturedProps.onNextStep();
        });

        // Should NOT dispatch NEXT_STEP
        const actions = store.getActions();
        expect(actions.some((a) => a.type === 'scratch-gui/cards/NEXT_STEP')).toBe(false);
    });

    test('unlocks onNextStep after 5 seconds', () => {
        const { store } = renderCards();

        // Advance past lock timeout
        act(() => {
            jest.advanceTimersByTime(5100);
        });

        act(() => {
            capturedProps.onNextStep();
        });

        const actions = store.getActions();
        expect(actions.some((a) => a.type === 'scratch-gui/cards/NEXT_STEP')).toBe(true);
    });

    test('unlocks onNextStep when startTutorial button is clicked', () => {
        const { store } = renderCards();

        // Click start tutorial to unlock
        act(() => {
            capturedProps.onStartTutorial();
        });

        act(() => {
            capturedProps.onNextStep();
        });

        const actions = store.getActions();
        expect(actions.some((a) => a.type === 'scratch-gui/cards/NEXT_STEP')).toBe(true);
    });

    test('unlocks onNextStep when insertCode button is clicked', () => {
        // Use step 1 which has code
        const storeState = createStoreState({ step: 1 });
        const { store } = renderCards(storeState);

        // Click insert code to unlock
        act(() => {
            capturedProps.onInsertCodeFactory('puts "hello"')();
        });

        act(() => {
            capturedProps.onNextStep();
        });

        const actions = store.getActions();
        expect(actions.some((a) => a.type === 'scratch-gui/cards/NEXT_STEP')).toBe(true);
    });

    test('does not lock onNextStep when step has no action button', () => {
        // Create a step without startTutorial or code
        const storeState = createStoreState({
            content: {
                [TEST_DECK_ID]: {
                    name: 'Test Tutorial',
                    nameMessageId: 'gui.howtos.test.name',
                    img: 'test.jpg',
                    steps: [
                        {
                            title: 'Plain Step',
                            image: 'plain.png',
                            animationTarget: 'nextButton',
                        },
                    ],
                },
            },
        });
        const { store } = renderCards(storeState);

        // Should be able to click next immediately
        act(() => {
            capturedProps.onNextStep();
        });

        const actions = store.getActions();
        expect(actions.some((a) => a.type === 'scratch-gui/cards/NEXT_STEP')).toBe(true);
    });
});
// === Smalruby: End of next-button lock ===
