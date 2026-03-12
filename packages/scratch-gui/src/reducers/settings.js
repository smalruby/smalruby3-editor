import {detectColorMode} from '../lib/settings/color-mode/persistence';
import {detectTheme} from '../lib/settings/theme/persistence';
import {detectRubyVersion} from '../lib/settings/ruby-version/persistence';
// === Smalruby: Start of URL params for Playwright ===
import {getUrlParams} from '../lib/url-params';
// === Smalruby: End of URL params for Playwright ===

const SET_COLOR_MODE = 'scratch-gui/settings/SET_COLOR_MODE';
const SET_THEME = 'scratch-gui/settings/SET_THEME';
const SET_RUBY_VERSION = 'scratch-gui/settings/SET_RUBY_VERSION';

// === Smalruby: Start of ruby_version URL param ===
const detectInitialRubyVersion = () => {
    const {rubyVersion} = getUrlParams();
    if (rubyVersion === null) return detectRubyVersion();
    return rubyVersion;
};

const initialState = {
    colorMode: detectColorMode(),
    theme: detectTheme(),
    rubyVersion: detectInitialRubyVersion()
};
// === Smalruby: End of ruby_version URL param ===

const reducer = (state = initialState, action) => {
    switch (action.type) {
    case SET_COLOR_MODE:
        return {...state, colorMode: action.colorMode};
    case SET_THEME:
        return {...state, theme: action.theme};
    case SET_RUBY_VERSION:
        return {...state, rubyVersion: action.rubyVersion};
    default:
        return state;
    }
};

const setColorMode = colorMode => ({
    type: SET_COLOR_MODE,
    colorMode
});

const setTheme = theme => ({
    type: SET_THEME,
    theme
});

const setRubyVersion = rubyVersion => ({
    type: SET_RUBY_VERSION,
    rubyVersion
});

export {
    reducer as default,
    initialState as settingsInitialState,
    setColorMode,
    setTheme,
    setRubyVersion
};
