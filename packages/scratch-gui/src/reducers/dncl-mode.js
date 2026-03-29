// === Smalruby: This file is Smalruby-specific (DNCL mode reducer) ===

const SET_DNCL_MODE = 'scratch-gui/dncl-mode/SET_DNCL_MODE'

const DNCL_MODE_KEY = 'smalruby:dnclMode'

/**
 * Read initial DNCL mode state from localStorage and URL params.
 * URL param `dncl=1` overrides localStorage.
 * @returns {boolean} Whether DNCL mode is enabled.
 */
const getInitialDnclMode = () => {
  // Check URL param first
  if (typeof window !== 'undefined' && window.location) {
    const params = new URLSearchParams(window.location.search)
    const dnclParam = params.get('dncl')
    if (dnclParam === '1' || dnclParam === 'true') {
      return true
    }
    if (dnclParam === '0' || dnclParam === 'false') {
      return false
    }
  }
  // Fall back to localStorage
  if (typeof window !== 'undefined' && window.localStorage) {
    return window.localStorage.getItem(DNCL_MODE_KEY) === 'true'
  }
  return false
}

const initialState = {
  dnclMode: getInitialDnclMode(),
}

const reducer = function (state, action) {
  if (typeof state === 'undefined') state = initialState
  switch (action.type) {
    case SET_DNCL_MODE:
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(DNCL_MODE_KEY, action.dnclMode)
      }
      return Object.assign({}, state, {
        dnclMode: action.dnclMode,
      })
    default:
      return state
  }
}

const setDnclMode = function (dnclMode) {
  return {
    type: SET_DNCL_MODE,
    dnclMode,
  }
}

export {
  reducer as default,
  initialState as dnclModeInitialState,
  setDnclMode,
  SET_DNCL_MODE,
}
