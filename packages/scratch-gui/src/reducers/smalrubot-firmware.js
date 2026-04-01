const OPEN_MODAL = 'scratch-gui/smalrubot-firmware/OPEN_MODAL';
const CLOSE_MODAL = 'scratch-gui/smalrubot-firmware/CLOSE_MODAL';

const initialState = {
    modalVisible: false,
};

const reducer = (state, action) => {
    if (typeof state === 'undefined') state = initialState;
    switch (action.type) {
        case OPEN_MODAL:
            return { ...state, modalVisible: true };
        case CLOSE_MODAL:
            return { ...state, modalVisible: false };
        default:
            return state;
    }
};

const openSmalrubotFirmwareModal = () => ({ type: OPEN_MODAL });
const closeSmalrubotFirmwareModal = () => ({ type: CLOSE_MODAL });

export default reducer;
export { initialState as smalrubotFirmwareInitialState, openSmalrubotFirmwareModal, closeSmalrubotFirmwareModal };
