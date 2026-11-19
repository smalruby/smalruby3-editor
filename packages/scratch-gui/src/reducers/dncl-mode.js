// === Smalruby: This file is Smalruby-specific (DNCL mode reducer) ===
import { getUrlParams } from '../lib/url-params';

const SET_DNCL_MODE = 'scratch-gui/dncl-mode/SET_DNCL_MODE';
const REQUEST_EXTERNAL_EXIT_DNCL_MODE = 'scratch-gui/dncl-mode/REQUEST_EXTERNAL_EXIT_DNCL_MODE';
const CLEAR_EXTERNAL_EXIT_DNCL_MODE_REQUEST = 'scratch-gui/dncl-mode/CLEAR_EXTERNAL_EXIT_DNCL_MODE_REQUEST';

const DNCL_MODE_KEY = 'smalruby:dnclMode';

// Inline tab index constants to avoid a circular dependency with the editor-tab reducer.
const RUBY_TAB_INDEX = 3;
const JAPANESE_TAB_INDEX = 4;

/**
 * Whether the program starts written in Japanese (docs/dncl/design.md 1 章).
 *
 * The flag is true while the Japanese tab is the language the program is written in:
 * it is set on entering the Japanese tab and cleared on entering the Ruby tab (or by
 * the notice of the Code tab). The Code tab shows only the blocks that can be written
 * in Japanese while it is true.
 *
 * - URL `rubyMode=dncl` (and `tab=japanese`) turn it on, `rubyMode=ruby` / `furigana`
 *   and `tab=ruby` turn it off.
 * - Otherwise localStorage `smalruby:dnclMode`, the language of the last visit
 *   (before the Japanese tab, it was the mode of the Ruby tab: the same meaning).
 * @returns {boolean} Whether the program is written in Japanese.
 */
const getInitialDnclMode = () => {
    const { rubyMode, initialTab } = getUrlParams();
    if (rubyMode === 'dncl') return true;
    if (rubyMode === 'furigana' || rubyMode === 'ruby') return false;
    if (initialTab === JAPANESE_TAB_INDEX) return true;
    if (initialTab === RUBY_TAB_INDEX) return false;
    if (typeof window !== 'undefined' && window.localStorage) {
        try {
            return window.localStorage.getItem(DNCL_MODE_KEY) === 'true';
        } catch (_e) {
            return false;
        }
    }
    return false;
};

const initialState = {
    dnclMode: getInitialDnclMode(),
    exitDnclModeExternallyRequested: false,
};

const reducer = function (state, action) {
    if (typeof state === 'undefined') state = initialState;
    switch (action.type) {
        case SET_DNCL_MODE:
            if (typeof window !== 'undefined' && window.localStorage) {
                try {
                    window.localStorage.setItem(DNCL_MODE_KEY, action.dnclMode);
                } catch (_e) {
                    // Private windows may refuse the storage: the flag lives in the state anyway.
                }
            }
            return Object.assign({}, state, {
                dnclMode: action.dnclMode,
            });
        case REQUEST_EXTERNAL_EXIT_DNCL_MODE:
            return Object.assign({}, state, {
                exitDnclModeExternallyRequested: true,
            });
        case CLEAR_EXTERNAL_EXIT_DNCL_MODE_REQUEST:
            return Object.assign({}, state, {
                exitDnclModeExternallyRequested: false,
            });
        default:
            return state;
    }
};

const setDnclMode = function (dnclMode) {
    return {
        type: SET_DNCL_MODE,
        dnclMode,
    };
};

const requestExternalExitDnclMode = function () {
    return { type: REQUEST_EXTERNAL_EXIT_DNCL_MODE };
};

const clearExternalExitDnclModeRequest = function () {
    return { type: CLEAR_EXTERNAL_EXIT_DNCL_MODE_REQUEST };
};

export {
    reducer as default,
    initialState as dnclModeInitialState,
    getInitialDnclMode,
    setDnclMode,
    SET_DNCL_MODE,
    requestExternalExitDnclMode,
    clearExternalExitDnclModeRequest,
};
