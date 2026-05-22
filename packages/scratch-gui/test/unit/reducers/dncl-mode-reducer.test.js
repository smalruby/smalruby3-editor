import reducer, {
    dnclModeInitialState,
    setDnclMode,
    requestExternalExitDnclMode,
    clearExternalExitDnclModeRequest,
} from '../../../src/reducers/dncl-mode';

describe('dncl-mode reducer', () => {
    describe('initial state', () => {
        test('should have dnclMode as false by default', () => {
            expect(dnclModeInitialState.dnclMode).toBe(false);
        });

        test('should have exitDnclModeExternallyRequested as false', () => {
            expect(dnclModeInitialState.exitDnclModeExternallyRequested).toBe(false);
        });
    });

    describe('setDnclMode', () => {
        test('should set dnclMode to true', () => {
            const state = reducer(dnclModeInitialState, setDnclMode(true));
            expect(state.dnclMode).toBe(true);
        });

        test('should set dnclMode to false', () => {
            const state = reducer({ ...dnclModeInitialState, dnclMode: true }, setDnclMode(false));
            expect(state.dnclMode).toBe(false);
        });

        test('should not affect exitDnclModeExternallyRequested', () => {
            const state = reducer(dnclModeInitialState, setDnclMode(true));
            expect(state.exitDnclModeExternallyRequested).toBe(false);
        });
    });

    describe('requestExternalExitDnclMode', () => {
        test('should set exitDnclModeExternallyRequested to true', () => {
            const state = reducer(dnclModeInitialState, requestExternalExitDnclMode());
            expect(state.exitDnclModeExternallyRequested).toBe(true);
        });

        test('should not affect dnclMode', () => {
            const state = reducer({ ...dnclModeInitialState, dnclMode: true }, requestExternalExitDnclMode());
            expect(state.dnclMode).toBe(true);
        });
    });

    describe('clearExternalExitDnclModeRequest', () => {
        test('should reset exitDnclModeExternallyRequested to false', () => {
            const active = reducer(dnclModeInitialState, requestExternalExitDnclMode());
            expect(active.exitDnclModeExternallyRequested).toBe(true);

            const cleared = reducer(active, clearExternalExitDnclModeRequest());
            expect(cleared.exitDnclModeExternallyRequested).toBe(false);
        });

        test('should not affect dnclMode', () => {
            const active = { ...dnclModeInitialState, dnclMode: true, exitDnclModeExternallyRequested: true };
            const state = reducer(active, clearExternalExitDnclModeRequest());
            expect(state.dnclMode).toBe(true);
        });
    });

    describe('unknown action', () => {
        test('should return state unchanged', () => {
            const state = reducer(dnclModeInitialState, { type: 'UNKNOWN' });
            expect(state).toEqual(dnclModeInitialState);
        });
    });
});
