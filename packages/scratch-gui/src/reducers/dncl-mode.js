// === Smalruby: This file is Smalruby-specific (DNCL mode reducer) ===
import { getUrlParams } from '../lib/url-params';

const SET_DNCL_MODE = 'scratch-gui/dncl-mode/SET_DNCL_MODE';

const DNCL_MODE_KEY = 'smalruby:dnclMode';

/**
 * Read initial DNCL mode state from URL params and localStorage.
 * URL param `rubyMode=dncl` (case-insensitive) overrides localStorage.
 * @returns {boolean} Whether DNCL mode is enabled.
 */
const getInitialDnclMode = () => {
    const urlRubyMode = getUrlParams().rubyMode;
    if (urlRubyMode === 'dncl') return true;
    if (urlRubyMode === 'furigana') return false;
    if (typeof window !== 'undefined' && window.localStorage) {
        return window.localStorage.getItem(DNCL_MODE_KEY) === 'true';
    }
    return false;
};

const initialState = {
    dnclMode: getInitialDnclMode(),
};

const reducer = function (state, action) {
    if (typeof state === 'undefined') state = initialState;
    switch (action.type) {
        case SET_DNCL_MODE:
            if (typeof window !== 'undefined' && window.localStorage) {
                window.localStorage.setItem(DNCL_MODE_KEY, action.dnclMode);
            }
            return Object.assign({}, state, {
                dnclMode: action.dnclMode,
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

export { reducer as default, initialState as dnclModeInitialState, setDnclMode, SET_DNCL_MODE };
