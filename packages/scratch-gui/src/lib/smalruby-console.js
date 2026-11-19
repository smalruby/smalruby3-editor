// The entry the other parts of the GUI (the Japanese tab) use to show the
// console of the console extension (docs/extension-smalruby-console/README.md).
import { setSmalrubyConsoleVisible } from '../reducers/smalruby-console.js';

/** The id of the console extension (scratch-vm `smalrubyConsole`). */
const SMALRUBY_CONSOLE_EXTENSION_ID = 'smalrubyConsole';

/**
 * Show the console in place of the stage, adding the console extension to the
 * project first when it has not got it (so its blocks are in the palette).
 * The Japanese tab calls this: the console is the stage of a Japanese program.
 * @param {?object} vm - The VM.
 * @param {Function} dispatch - The Redux dispatch.
 * @returns {Promise<void>} Resolves when the console is shown.
 */
const showSmalrubyConsole = async (vm, dispatch) => {
    const manager = vm && vm.extensionManager;
    if (manager && !manager.isExtensionLoaded(SMALRUBY_CONSOLE_EXTENSION_ID)) {
        try {
            await manager.loadExtensionURL(SMALRUBY_CONSOLE_EXTENSION_ID);
        } catch (e) {
            // The console still shows (and takes the answers of 聞いて待つ) without its blocks.
            console.error('Failed to load the console extension:', e); // eslint-disable-line no-console
        }
    }
    dispatch(setSmalrubyConsoleVisible(true));
};

/**
 * Show the stage again in place of the console.
 * @param {Function} dispatch - The Redux dispatch.
 */
const hideSmalrubyConsole = (dispatch) => {
    dispatch(setSmalrubyConsoleVisible(false));
};

export { SMALRUBY_CONSOLE_EXTENSION_ID, hideSmalrubyConsole, showSmalrubyConsole };
