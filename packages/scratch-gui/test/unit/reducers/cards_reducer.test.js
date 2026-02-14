import reducer from '../../../src/reducers/cards';
import {activateDeck, nextStep, prevStep} from '../../../src/reducers/cards';

describe('cards reducer', () => {
    test('should return initial state', () => {
        expect(reducer(undefined, {})).toEqual({
            visible: false,
            content: expect.any(Object),
            activeDeckId: null,
            step: 0,
            x: 0,
            y: 0,
            expanded: true,
            dragging: false
        });
    });

    test('should activate a deck', () => {
        const state = reducer(undefined, activateDeck('getting-started'));
        expect(state.activeDeckId).toBe('getting-started');
        expect(state.visible).toBe(true);
        expect(state.step).toBe(0);
    });

    test('should go to next step', () => {
        let state = reducer(undefined, activateDeck('getting-started'));
        state = reducer(state, nextStep());
        expect(state.step).toBe(1);
    });

    test('should go to prev step', () => {
        let state = reducer(undefined, activateDeck('getting-started'));
        state = reducer(state, nextStep());
        state = reducer(state, prevStep());
        expect(state.step).toBe(0);
    });

    test('should not go to prev step if at 0', () => {
        let state = reducer(undefined, activateDeck('getting-started'));
        state = reducer(state, prevStep());
        expect(state.step).toBe(0);
    });
});
