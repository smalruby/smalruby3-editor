const OPEN_KOSHIEN_MOCK_PANEL = 'scratch-gui/koshien-mock-panel/OPEN';
const CLOSE_KOSHIEN_MOCK_PANEL = 'scratch-gui/koshien-mock-panel/CLOSE';

const initialState = {
    visible: false,
};

const reducer = function (state, action) {
    if (typeof state === 'undefined') state = initialState;
    switch (action.type) {
        case OPEN_KOSHIEN_MOCK_PANEL:
            return Object.assign({}, state, { visible: true });
        case CLOSE_KOSHIEN_MOCK_PANEL:
            return Object.assign({}, state, { visible: false });
        default:
            return state;
    }
};

const openKoshienMockPanel = function () {
    return { type: OPEN_KOSHIEN_MOCK_PANEL };
};

const closeKoshienMockPanel = function () {
    return { type: CLOSE_KOSHIEN_MOCK_PANEL };
};

export {
    reducer as default,
    initialState as koshienMockPanelInitialState,
    openKoshienMockPanel,
    closeKoshienMockPanel,
};
