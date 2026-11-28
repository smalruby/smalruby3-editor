import reducer, {
    addSmalrubyConsoleLine,
    clearSmalrubyConsole,
    MAX_CONSOLE_LINES,
    resetSmalrubyConsole,
    setSmalrubyConsoleVisible,
    showSmalrubyConsoleByDefault,
    smalrubyConsoleInitialState,
    toggleSmalrubyConsole,
} from '../../../src/reducers/smalruby-console';

describe('smalruby-console reducer', () => {
    test('is hidden with no lines at first', () => {
        expect(reducer(undefined, { type: 'anything' })).toEqual(smalrubyConsoleInitialState);
        expect(smalrubyConsoleInitialState).toEqual({ visible: false, hiddenByUser: false, lines: [], unread: 0 });
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

    test('keeps the console hidden by the user when the Japanese tab shows it again (B08)', () => {
        let state = reducer(undefined, showSmalrubyConsoleByDefault());
        expect(state.visible).toBe(true);
        state = reducer(state, toggleSmalrubyConsole());
        expect(state).toMatchObject({ visible: false, hiddenByUser: true });
        state = reducer(state, showSmalrubyConsoleByDefault());
        expect(state.visible).toBe(false);
        state = reducer(state, toggleSmalrubyConsole());
        expect(state).toMatchObject({ visible: true, hiddenByUser: false });
    });

    test('takes hiding with the close button as the user hiding it', () => {
        let state = reducer(undefined, setSmalrubyConsoleVisible(true));
        state = reducer(state, setSmalrubyConsoleVisible(false));
        expect(state.hiddenByUser).toBe(true);
        expect(reducer(state, showSmalrubyConsoleByDefault()).visible).toBe(false);
    });

    test('forgets the hiding by the user when the Ruby tab gives the stage back', () => {
        let state = reducer(undefined, toggleSmalrubyConsole());
        state = reducer(state, toggleSmalrubyConsole());
        state = reducer(state, resetSmalrubyConsole());
        expect(state).toMatchObject({ visible: false, hiddenByUser: false });
        expect(reducer(state, showSmalrubyConsoleByDefault()).visible).toBe(true);
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
