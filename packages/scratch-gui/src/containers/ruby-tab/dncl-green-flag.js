// The green flag runs the Japanese program while the Japanese tab is open (Issue #2552).
// The Japanese program is made of scripts without a hat, so the green flag alone would not run it.
import { JAPANESE_TAB_INDEX } from '../../reducers/editor-tab';

// Thread.STATUS_DONE of scratch-vm.
const THREAD_STATUS_DONE = 4;

/**
 * Whether the green flag should run the Japanese program, as the run button of the toolbar does.
 * The Japanese mode is kept while another tab is open, so the tab is checked too.
 * @param {object} state - The editor state.
 * @param {boolean} state.dnclMode - Whether the editor shows the program in Japanese.
 * @param {number} state.activeTabIndex - The index of the open tab.
 * @returns {boolean} True to run the Japanese program.
 */
const shouldRunJapaneseOnGreenFlag = ({ dnclMode, activeTabIndex }) =>
    !!dnclMode && activeTabIndex === JAPANESE_TAB_INDEX;

/**
 * The top-level scripts the green flag starts for the Japanese program.
 * Hat scripts are started by the green flag itself, and a running script is not toggled off.
 * @param {object} blocks - The blocks container of the editing target.
 * @param {object} runtime - The VM runtime.
 * @returns {Array<string>} The ids of the top blocks to start, in the written order.
 */
const japaneseScriptsToStart = (blocks, runtime) =>
    blocks.getScripts().filter((topBlockId) => {
        const opcode = blocks.getOpcode(blocks.getBlock(topBlockId));
        if (runtime.getIsHat(opcode)) return false;
        return !runtime.threads.some(
            (thread) => thread.topBlock === topBlockId && thread.status !== THREAD_STATUS_DONE,
        );
    });

export { japaneseScriptsToStart, shouldRunJapaneseOnGreenFlag };
