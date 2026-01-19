const SET_DOMAIN = 'scratch-gui/mesh-v2/SET_DOMAIN';

const initialState = {
    domain: null
};

const reducer = function (state, action) {
    if (typeof state === 'undefined') state = initialState;
    switch (action.type) {
    case SET_DOMAIN:
        return Object.assign({}, state, {
            domain: action.domain
        });
    default:
        return state;
    }
};

const setDomain = function (domain) {
    return {
        type: SET_DOMAIN,
        domain: domain
    };
};

export {
    reducer as default,
    initialState as meshV2InitialState,
    setDomain
};
