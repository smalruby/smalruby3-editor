// The entry the other parts of the GUI (the Japanese tab) use to show the
// console of the console extension (docs/extension-smalruby-console/README.md).
import { resetSmalrubyConsole, showSmalrubyConsoleByDefault } from '../reducers/smalruby-console.js';
import { getStageDimensions } from './screen-utils.js';

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

/**
 * The size to give the canvas of the stage. While the console fills the right column of
 * the Japanese tab, the stage is hidden and measures 0×0: the canvas keeps the size of the
 * stage then, since a 0×0 canvas gives an empty thumbnail to a submission or a save.
 * @param {{width: number, height: number}} rect - The measured rectangle of the canvas.
 * @param {string} stageSize - The size of the stage (STAGE_DISPLAY_SIZES).
 * @returns {{width: number, height: number}} The size of the canvas.
 */
const stageCanvasSize = (rect, stageSize) => {
    if (rect.width > 0 && rect.height > 0) return { width: rect.width, height: rect.height };
    const { width, height } = getStageDimensions(stageSize, false);
    return { width, height };
};

export { SMALRUBY_CONSOLE_EXTENSION_ID, hideSmalrubyConsole, showSmalrubyConsole, stageCanvasSize };
