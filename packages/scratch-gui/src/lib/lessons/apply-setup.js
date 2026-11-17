// === Smalruby: This file is Smalruby-specific (lesson / tutorial setup helper) ===
// レッスンのチャレンジを始めるときの準備（タブ・Ruby のモード・拡張機能・Ruby の版）。
// もとはチュートリアルの deck のために作ったが、チュートリアルを上流に戻したあともレッスンが使うので
// lib/lessons/ に置く（#1935）。チュートリアルの一覧（tips-library.jsx）は上流に戻すまでの間だけ使う。
import { setDnclMode } from '../../reducers/dncl-mode';
import {
    activateTab,
    BLOCKS_TAB_INDEX,
    COSTUMES_TAB_INDEX,
    RUBY_TAB_INDEX,
    SOUNDS_TAB_INDEX,
} from '../../reducers/editor-tab';
import { setRubyVersion } from '../../reducers/settings';
import { VERSION_1, VERSION_2 } from '../settings/ruby-version';
import { persistRubyVersion } from '../settings/ruby-version/persistence';

const FURIGANA_ENABLED_KEY = 'smalruby:furiganaEnabled';

const TAB_INDEX_MAP = {
    code: BLOCKS_TAB_INDEX,
    blocks: BLOCKS_TAB_INDEX,
    costumes: COSTUMES_TAB_INDEX,
    sounds: SOUNDS_TAB_INDEX,
    ruby: RUBY_TAB_INDEX,
};

const VALID_RUBY_MODES = new Set(['ruby', 'furigana', 'dncl']);

/**
 * setup.rubyVersion may be given as a number (1 | 2) per the design doc, or
 * as the string form ('1' | '2') used internally by the settings reducer.
 * Normalize to the internal string form, or null if unsupported.
 * @param {*} value - setup.rubyVersion.
 * @returns {?string} '1' | '2', or null.
 */
export const normalizeRubyVersion = (value) => {
    const asString = String(value);
    return asString === VERSION_1 || asString === VERSION_2 ? asString : null;
};

/**
 * setup を当てる: タブを切りかえ、Ruby のモードを決め、拡張機能を読みこみ、Ruby の版を決める。
 * どれも冪等で、もうその状態なら何もしない。
 *
 * setup の形（レッスンは `lib/lessons/challenge-setup.js` の setupForChallenge が作る）:
 *
 *     {
 *         tab: 'ruby',                       // 'code' | 'costumes' | 'sounds' | 'ruby'
 *         rubyMode: 'dncl',                  // 'ruby' | 'furigana' | 'dncl'
 *         extensions: ['pen', 'microbitMore'],
 *         rubyVersion: 2,                    // 1 | 2（省くといまのまま）
 *     }
 *
 * 拡張機能は読みこみを待つので、このあと出す画面からはどれも使える。読みこめなくても
 * 止めずに console に残す（子どもは自分で拡張機能を足せる）。
 * @param {object} setup - setup（undefined でもよい）。
 * @param {Function} dispatch - Redux の dispatch。
 * @param {object} vm - VM（state.scratchGui.vm）。
 * @returns {Promise<void>} 当て終わったら resolve する
 */
export const applySetup = async (setup, dispatch, vm) => {
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
                console.warn(`[apply-setup] Failed to load extension '${extId}':`, err);
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
