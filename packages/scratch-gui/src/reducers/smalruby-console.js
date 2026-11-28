// The console of the console extension (docs/extension-smalruby-console/README.md):
// whether the stage shows the console, and the lines it shows. The lines are
// not saved with the project. `hiddenByUser` keeps the console hidden by the user
// (the `>_` button) when the Japanese tab shows it again, after the Code tab (B08).

const SET_VISIBLE = 'scratch-gui/smalruby-console/SET_VISIBLE';
const SHOW_BY_DEFAULT = 'scratch-gui/smalruby-console/SHOW_BY_DEFAULT';
const RESET = 'scratch-gui/smalruby-console/RESET';
const TOGGLE = 'scratch-gui/smalruby-console/TOGGLE';
const ADD_LINE = 'scratch-gui/smalruby-console/ADD_LINE';
const CLEAR = 'scratch-gui/smalruby-console/CLEAR';

/** The most lines the console keeps: the oldest go first. */
const MAX_CONSOLE_LINES = 1000;

/** What a line is: printed by the program, or typed as an answer. */
const CONSOLE_LINE_KINDS = { output: 'output', input: 'input' };

const initialState = {
    visible: false,
    hiddenByUser: false,
    lines: [],
    // The lines printed while the console was hidden (the button shows how many).
    unread: 0,
};

const reducer = function (state, action) {
    if (typeof state === 'undefined') state = initialState;
    switch (action.type) {
        case SET_VISIBLE:
            if (state.visible === action.visible && state.hiddenByUser === !action.visible) return state;
            return {
                ...state,
                visible: action.visible,
                hiddenByUser: !action.visible,
                unread: action.visible ? 0 : state.unread,
            };
        case SHOW_BY_DEFAULT:
            if (state.visible || state.hiddenByUser) return state;
            return { ...state, visible: true, unread: 0 };
        case RESET:
            if (!state.visible && !state.hiddenByUser) return state;
            return { ...state, visible: false, hiddenByUser: false };
        case TOGGLE:
            return {
                ...state,
                visible: !state.visible,
                hiddenByUser: state.visible,
                unread: state.visible ? state.unread : 0,
            };
        case ADD_LINE: {
            const lines = [...state.lines, { text: action.text, kind: action.kind }];
            if (lines.length > MAX_CONSOLE_LINES) lines.splice(0, lines.length - MAX_CONSOLE_LINES);
            return { ...state, lines, unread: state.visible ? 0 : state.unread + 1 };
        }
        case CLEAR:
            if (state.lines.length === 0 && state.unread === 0) return state;
            return { ...state, lines: [], unread: 0 };
        default:
            return state;
    }
};

/**
 * Show or hide the console in place of the stage, as the user asks (the close button,
 * or the program waiting for an answer in the Japanese tab).
 * @param {boolean} visible - Whether to show it.
 * @returns {object} The action.
 */
const setSmalrubyConsoleVisible = (visible) => ({ type: SET_VISIBLE, visible: Boolean(visible) });

/**
 * Show the console unless the user hid it. The Japanese tab shows it (the console is
 * the stage of a Japanese program), each time it is opened.
 * @returns {object} The action.
 */
const showSmalrubyConsoleByDefault = () => ({ type: SHOW_BY_DEFAULT });

/**
 * Hide the console and forget that the user hid it: the Ruby tab gives the stage back,
 * and the next Japanese tab shows the console again.
 * @returns {object} The action.
 */
const resetSmalrubyConsole = () => ({ type: RESET });

/**
 * Show the console if hidden, hide it if shown (the button on the stage header).
 * @returns {object} The action.
 */
const toggleSmalrubyConsole = () => ({ type: TOGGLE });

/**
 * Add a line to the console.
 * @param {string} text - The line.
 * @param {string} [kind] - `output` (printed) or `input` (typed as an answer).
 * @returns {object} The action.
 */
const addSmalrubyConsoleLine = (text, kind = CONSOLE_LINE_KINDS.output) => ({
    type: ADD_LINE,
    text: String(text),
    kind,
});

/**
 * Clear the lines of the console.
 * @returns {object} The action.
 */
const clearSmalrubyConsole = () => ({ type: CLEAR });

export {
    reducer as default,
    initialState as smalrubyConsoleInitialState,
    CONSOLE_LINE_KINDS,
    MAX_CONSOLE_LINES,
    addSmalrubyConsoleLine,
    clearSmalrubyConsole,
    resetSmalrubyConsole,
    setSmalrubyConsoleVisible,
    showSmalrubyConsoleByDefault,
    toggleSmalrubyConsole,
};
