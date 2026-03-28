import stageSizeReducer, {
    stageSizeInitialState as initialState,
    setStageSize,
} from '../../../src/reducers/stage-size';

describe('stageSizeReducer', () => {
    // This test checks for the new default state (Phase 3)
    test('initial state is middle', () => {
        expect(initialState.stageSize).toBe('middle');
    });

    test('handles setStageSize action for middle', () => {
        const action = setStageSize('middle');
        const state = stageSizeReducer(initialState, action);
        expect(state.stageSize).toBe('middle');
    });
});
