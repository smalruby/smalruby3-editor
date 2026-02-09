import {detectColorMode} from '../lib/settings/color-mode/persistence';
import {detectTheme} from '../lib/settings/theme/persistence';
import {detectRubyVersion} from '../lib/settings/ruby-version/persistence';

const SET_COLOR_MODE = 'scratch-gui/settings/SET_COLOR_MODE';
const SET_THEME = 'scratch-gui/settings/SET_THEME';
const SET_RUBY_VERSION = 'scratch-gui/settings/SET_RUBY_VERSION';

const initialState = {
    colorMode: detectColorMode(),
    theme: detectTheme(),
    rubyVersion: detectRubyVersion()
};

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
