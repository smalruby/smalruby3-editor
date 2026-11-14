const SET_DOMAIN = 'scratch-gui/mesh-v2/SET_DOMAIN';
const SHOW_SELF_SENSOR_NOTICE = 'scratch-gui/mesh-v2/SHOW_SELF_SENSOR_NOTICE';
const HIDE_SELF_SENSOR_NOTICE = 'scratch-gui/mesh-v2/HIDE_SELF_SENSOR_NOTICE';
const OPEN_STATUS_POPUP = 'scratch-gui/mesh-v2/OPEN_STATUS_POPUP';
const CLOSE_STATUS_POPUP = 'scratch-gui/mesh-v2/CLOSE_STATUS_POPUP';
const SET_PRACTICE_ACTIVE = 'scratch-gui/mesh-v2/SET_PRACTICE_ACTIVE';

const initialState = {
    domain: null,
    // Issue #707: one-time notice shown when a project's global variable name
    // collides with a Mesh v2 "sensor value" lookup (behavior changed).
    selfSensorNoticeVisible: false,
    // Issue #1844: the movable "mesh status and history" window (not a modal).
    statusPopupOpen: false,
    // Issue #1845: the standalone practice partner is on (shown on the stage-top mesh button).
    practiceActive: false,
};

const reducer = function (state, action) {
    if (typeof state === 'undefined') state = initialState;
    switch (action.type) {
        case SET_DOMAIN:
            return Object.assign({}, state, {
                domain: action.domain,
            });
        case SHOW_SELF_SENSOR_NOTICE:
            return Object.assign({}, state, {
                selfSensorNoticeVisible: true,
            });
        case HIDE_SELF_SENSOR_NOTICE:
            return Object.assign({}, state, {
                selfSensorNoticeVisible: false,
            });
        case OPEN_STATUS_POPUP:
            return Object.assign({}, state, {
                statusPopupOpen: true,
            });
        case CLOSE_STATUS_POPUP:
            return Object.assign({}, state, {
                statusPopupOpen: false,
            });
        case SET_PRACTICE_ACTIVE:
            if (state.practiceActive === action.active) return state;
            return Object.assign({}, state, {
                practiceActive: action.active,
            });
        default:
            return state;
    }
};

const setDomain = function (domain) {
    return {
        type: SET_DOMAIN,
        domain: domain,
    };
};

const showMeshV2SelfSensorNotice = function () {
    return { type: SHOW_SELF_SENSOR_NOTICE };
};

const hideMeshV2SelfSensorNotice = function () {
    return { type: HIDE_SELF_SENSOR_NOTICE };
};

const openMeshV2StatusPopup = function () {
    return { type: OPEN_STATUS_POPUP };
};

const closeMeshV2StatusPopup = function () {
    return { type: CLOSE_STATUS_POPUP };
};

const setMeshV2PracticeActive = function (active) {
    return { type: SET_PRACTICE_ACTIVE, active: !!active };
};

export {
    reducer as default,
    initialState as meshV2InitialState,
    setDomain,
    showMeshV2SelfSensorNotice,
    hideMeshV2SelfSensorNotice,
    openMeshV2StatusPopup,
    closeMeshV2StatusPopup,
    setMeshV2PracticeActive,
};
