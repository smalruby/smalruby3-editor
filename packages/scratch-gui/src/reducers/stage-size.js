import {STAGE_DISPLAY_SIZES} from '../lib/layout-constants.js';

const SET_STAGE_SIZE = 'scratch-gui/StageSize/SET_STAGE_SIZE';

const initialState = {
    // === Smalruby: Start of middle stage size ===
    // Smalruby starts with the middle stage (upstream: large)
    stageSize: STAGE_DISPLAY_SIZES.middle
    // === Smalruby: End of middle stage size ===
};

const reducer = function (state, action) {
    if (typeof state === 'undefined') state = initialState;
    switch (action.type) {
    case SET_STAGE_SIZE:
        return {
            stageSize: action.stageSize
        };
    default:
        return state;
    }
};

const setStageSize = function (stageSize) {
    return {
        type: SET_STAGE_SIZE,
        stageSize: stageSize
    };
};

export {
    reducer as default,
    initialState as stageSizeInitialState,
    setStageSize
};
