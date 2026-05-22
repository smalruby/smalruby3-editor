// === Smalruby: This file is Smalruby-specific (DNCL mode reducer) ===
import { getUrlParams } from '../lib/url-params';

const SET_DNCL_MODE = 'scratch-gui/dncl-mode/SET_DNCL_MODE';
const REQUEST_EXTERNAL_EXIT_DNCL_MODE = 'scratch-gui/dncl-mode/REQUEST_EXTERNAL_EXIT_DNCL_MODE';
const CLEAR_EXTERNAL_EXIT_DNCL_MODE_REQUEST = 'scratch-gui/dncl-mode/CLEAR_EXTERNAL_EXIT_DNCL_MODE_REQUEST';

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
    exitDnclModeExternallyRequested: false,
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
    setDnclMode,
    SET_DNCL_MODE,
    requestExternalExitDnclMode,
    clearExternalExitDnclModeRequest,
};
