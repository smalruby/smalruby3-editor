// === Smalruby: This file is Smalruby-specific (tutorial deck setup helper) ===
import { setDnclMode } from '../reducers/dncl-mode';
import {
    activateTab,
    BLOCKS_TAB_INDEX,
    COSTUMES_TAB_INDEX,
    RUBY_TAB_INDEX,
    SOUNDS_TAB_INDEX,
} from '../reducers/editor-tab';
import { setRubyVersion } from '../reducers/settings';
import { VERSION_1, VERSION_2 } from './settings/ruby-version';
import { persistRubyVersion } from './settings/ruby-version/persistence';

const FURIGANA_ENABLED_KEY = 'smalruby:furiganaEnabled';

const TAB_INDEX_MAP = {
    code: BLOCKS_TAB_INDEX,
    blocks: BLOCKS_TAB_INDEX,
    costumes: COSTUMES_TAB_INDEX,
    sounds: SOUNDS_TAB_INDEX,
    ruby: RUBY_TAB_INDEX,
};

const VALID_RUBY_MODES = new Set(['ruby', 'furigana', 'dncl']);

// setup.rubyVersion may be given as a number (1 | 2) per the design doc, or
// as the string form ('1' | '2') used internally by the settings reducer.
// Normalize to the internal string form, or null if unsupported.
const normalizeRubyVersion = (value) => {
    const asString = String(value);
    return asString === VERSION_1 || asString === VERSION_2 ? asString : null;
};

/**
 * Apply tutorial deck setup: switch editor tab, set Ruby mode, load
 * required extensions. Each operation is idempotent — calling this with the
 * environment already in the desired state is a no-op.
 *
 * The `setup` descriptor is defined per-deck in `decks/index.jsx`:
 *
 *     'deck-id': {
 *         setup: {
 *             tab: 'ruby',                       // 'code' | 'costumes' | 'sounds' | 'ruby'
 *             rubyMode: 'dncl',                  // 'ruby' | 'furigana' | 'dncl'
 *             extensions: ['pen', 'microbitMore'],
 *             rubyVersion: 2,                    // 1 | 2 (omit to keep current)
 *         },
 *         // ...
 *     }
 *
 * Extension loads are awaited so that the tutorial card opens once all
 * required extensions are usable. Failures are logged but do not abort the
 * tutorial — the deck still opens and the user can manually load the
 * extension if needed.
 * @param {object} setup - The deck.setup descriptor (may be undefined).
 * @param {Function} dispatch - Redux dispatch function.
 * @param {object} vm - VM instance (state.scratchGui.vm).
 * @returns {Promise<void>} resolves once setup is applied
 */
export const applyDeckSetup = async (setup, dispatch, vm) => {
    if (!setup || typeof setup !== 'object') return;

    // 1. Tab
    if (setup.tab && Object.prototype.hasOwnProperty.call(TAB_INDEX_MAP, setup.tab)) {
        dispatch(activateTab(TAB_INDEX_MAP[setup.tab]));
    }

    // 2. Ruby mode. The furigana flag is stored in localStorage and read by
    // ruby-tab.jsx on mount. For an already-mounted ruby-tab, the change
    // takes effect on the next remount (e.g. tab switch) — acceptable for
    // tutorial flows that start from a fresh tab activation.
    if (setup.rubyMode && VALID_RUBY_MODES.has(setup.rubyMode)) {
        const mode = setup.rubyMode;
        dispatch(setDnclMode(mode === 'dncl'));
        if (typeof window !== 'undefined' && window.localStorage) {
            window.localStorage.setItem(FURIGANA_ENABLED_KEY, mode === 'furigana' ? 'true' : 'false');
        }
    }

    // 3. Extensions (await sequentially so any UI shown afterwards sees them
    // all loaded).
    if (Array.isArray(setup.extensions) && setup.extensions.length > 0 && vm) {
        for (const extId of setup.extensions) {
            try {
                if (
                    typeof vm.extensionManager?.isExtensionLoaded === 'function' &&
                    vm.extensionManager.isExtensionLoaded(extId)
                ) {
                    continue;
                }
                if (typeof vm.extensionManager?.loadExtensionURL === 'function') {
                    await vm.extensionManager.loadExtensionURL(extId);
                }
            } catch (err) {
                // Graceful degradation — log but don't abort. The tutorial
                // opens and the user can manually load the extension.
                // eslint-disable-next-line no-console
                console.warn(`[deck-setup] Failed to load extension '${extId}':`, err);
            }
        }
    }

    // 4. Ruby version (optional). Mirrors how the settings menu / URL loader
    // switch versions: dispatch the reducer action and persist the choice so
    // it survives a remount. Unsupported values are ignored.
    const rubyVersion = normalizeRubyVersion(setup.rubyVersion);
    if (rubyVersion) {
        dispatch(setRubyVersion(rubyVersion));
        persistRubyVersion(rubyVersion);
    }
};
