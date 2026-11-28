// The entry the other parts of the GUI (the Japanese tab) use to show the
// console of the console extension (docs/extension-smalruby-console/README.md).
import { resetSmalrubyConsole, showSmalrubyConsoleByDefault } from '../reducers/smalruby-console.js';

/** The id of the console extension (scratch-vm `smalrubyConsole`). */
const SMALRUBY_CONSOLE_EXTENSION_ID = 'smalrubyConsole';

/**
 * Show the console in place of the stage, unless the user hid it with the `>_` button.
 * The Japanese tab calls this: the console is the stage of a Japanese program. Only the screen is shown: the console extension is
 * added to the project by the conversion from Japanese to Ruby, when the program has
 * `表示する` or `入力する` (its blocks), so a program that does not print or read keeps
 * the project without the extension.
 * @param {Function} dispatch - The Redux dispatch.
 */
const showSmalrubyConsole = (dispatch) => {
    dispatch(showSmalrubyConsoleByDefault());
};

/**
 * Show the stage again in place of the console (the Ruby tab). The next Japanese tab
 * shows the console again, even if the user hid it.
 * @param {Function} dispatch - The Redux dispatch.
 */
const hideSmalrubyConsole = (dispatch) => {
    dispatch(resetSmalrubyConsole());
};

export { SMALRUBY_CONSOLE_EXTENSION_ID, hideSmalrubyConsole, showSmalrubyConsole };
