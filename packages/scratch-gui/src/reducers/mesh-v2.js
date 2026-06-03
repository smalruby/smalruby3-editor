const SET_DOMAIN = 'scratch-gui/mesh-v2/SET_DOMAIN';
const OPEN_UPGRADE_MODAL = 'scratch-gui/mesh-v2/OPEN_UPGRADE_MODAL';
const CLOSE_UPGRADE_MODAL = 'scratch-gui/mesh-v2/CLOSE_UPGRADE_MODAL';

const initialState = {
    domain: null,
    // Issue #707: shown when the Mesh v2 extension is enabled while the project
    // has not opted into the self-inclusive sensor value behavior.
    upgradeModalVisible: false,
};

const reducer = function (state, action) {
    if (typeof state === 'undefined') state = initialState;
    switch (action.type) {
        case SET_DOMAIN:
            return Object.assign({}, state, {
                domain: action.domain,
            });
        case OPEN_UPGRADE_MODAL:
            return Object.assign({}, state, {
                upgradeModalVisible: true,
            });
        case CLOSE_UPGRADE_MODAL:
            return Object.assign({}, state, {
                upgradeModalVisible: false,
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

const openMeshV2UpgradeModal = function () {
    return { type: OPEN_UPGRADE_MODAL };
};

const closeMeshV2UpgradeModal = function () {
    return { type: CLOSE_UPGRADE_MODAL };
};

export {
    reducer as default,
    initialState as meshV2InitialState,
    setDomain,
    openMeshV2UpgradeModal,
    closeMeshV2UpgradeModal,
};
