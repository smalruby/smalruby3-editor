import reducer, {
    addSmalrubyConsoleLine,
    clearSmalrubyConsole,
    MAX_CONSOLE_LINES,
    setSmalrubyConsoleVisible,
    smalrubyConsoleInitialState,
    toggleSmalrubyConsole,
} from '../../../src/reducers/smalruby-console';

describe('smalruby-console reducer', () => {
    test('is hidden with no lines at first', () => {
        expect(reducer(undefined, { type: 'anything' })).toEqual(smalrubyConsoleInitialState);
        expect(smalrubyConsoleInitialState).toEqual({ visible: false, lines: [], unread: 0 });
    });

    test('counts the lines printed while hidden, and forgets the count when shown', () => {
        let state = reducer(undefined, addSmalrubyConsoleLine('a'));
        state = reducer(state, addSmalrubyConsoleLine(2));
        expect(state.lines).toEqual([
            { text: 'a', kind: 'output' },
            { text: '2', kind: 'output' },
        ]);
        expect(state.unread).toBe(2);
        state = reducer(state, setSmalrubyConsoleVisible(true));
        expect(state).toMatchObject({ visible: true, unread: 0 });
        state = reducer(state, addSmalrubyConsoleLine('b', 'input'));
        expect(state.unread).toBe(0);
        expect(state.lines[2]).toEqual({ text: 'b', kind: 'input' });
    });

    test('toggles', () => {
        let state = reducer(undefined, toggleSmalrubyConsole());
        expect(state.visible).toBe(true);
        state = reducer(state, toggleSmalrubyConsole());
        expect(state.visible).toBe(false);
    });

    test('keeps the newest lines only', () => {
        let state = smalrubyConsoleInitialState;
        for (let i = 0; i < MAX_CONSOLE_LINES + 5; i++) state = reducer(state, addSmalrubyConsoleLine(i));
        expect(state.lines).toHaveLength(MAX_CONSOLE_LINES);
        expect(state.lines[0].text).toBe('5');
    });

    test('clears', () => {
        let state = reducer(undefined, addSmalrubyConsoleLine('a'));
        state = reducer(state, clearSmalrubyConsole());
        expect(state).toMatchObject({ lines: [], unread: 0 });
        expect(reducer(state, clearSmalrubyConsole())).toBe(state);
    });
});
