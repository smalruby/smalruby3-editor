/* eslint-env jest */
import reducer, {
    closeKoshienMockPanel,
    koshienMockPanelInitialState,
    openKoshienMockPanel,
} from '../../../src/reducers/koshien-mock-panel';

describe('koshien-mock-panel reducer', () => {
    test('starts hidden', () => {
        expect(reducer(undefined, { type: 'noop' })).toEqual(koshienMockPanelInitialState);
        expect(koshienMockPanelInitialState.visible).toBe(false);
    });

    test('open / close toggle visibility', () => {
        const opened = reducer(koshienMockPanelInitialState, openKoshienMockPanel());
        expect(opened.visible).toBe(true);
        const closed = reducer(opened, closeKoshienMockPanel());
        expect(closed.visible).toBe(false);
    });
});
