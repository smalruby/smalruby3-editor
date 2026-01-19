const TOGGLE_SHOW_ALL_EXTENSIONS = 'scratch-gui/extension-filter/TOGGLE_SHOW_ALL_EXTENSIONS';

const SHOW_ALL_EXTENSIONS_KEY = 'smalruby:showAllExtensions';
const savedShowAllExtensions = typeof window !== 'undefined' && window.localStorage ?
    window.localStorage.getItem(SHOW_ALL_EXTENSIONS_KEY) === 'true' : false;

const initialState = {
    showAllExtensions: savedShowAllExtensions
};

const reducer = function (state, action) {
    if (typeof state === 'undefined') state = initialState;
    switch (action.type) {
    case TOGGLE_SHOW_ALL_EXTENSIONS:
        if (typeof window !== 'undefined' && window.localStorage) {
            window.localStorage.setItem(SHOW_ALL_EXTENSIONS_KEY, action.showAllExtensions);
        }
        return Object.assign({}, state, {
            showAllExtensions: action.showAllExtensions
        });
    default:
        return state;
    }
};

const toggleShowAllExtensions = function (showAllExtensions) {
    return {
        type: TOGGLE_SHOW_ALL_EXTENSIONS,
        showAllExtensions: showAllExtensions
    };
};

export {
    reducer as default,
    initialState as extensionFilterInitialState,
    toggleShowAllExtensions
};
