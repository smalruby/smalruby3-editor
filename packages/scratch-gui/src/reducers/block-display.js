import queryString from 'query-string';
import {initializeBlockSelectionFromOnlyBlocks} from '../lib/block-utils';

const SET_SELECTED_BLOCKS = 'scratch-gui/block-display/SET_SELECTED_BLOCKS';
const SET_MODAL_VISIBLE = 'scratch-gui/block-display/SET_MODAL_VISIBLE';
const SET_SCRATCH_BLOCKS = 'scratch-gui/block-display/SET_SCRATCH_BLOCKS';

// Initialize selectedBlocks based on only_blocks parameter if present
const getInitialSelectedBlocks = () => {
    // Parse URL parameters
    const urlParams = typeof window === 'undefined' ?
        {} : queryString.parse(window.location.search);

    const onlyBlocks = urlParams.only_blocks;

    // Initialize from only_blocks parameter (null if not present, which will select all blocks)
    return initializeBlockSelectionFromOnlyBlocks(onlyBlocks);
};

const initialState = {
    selectedBlocks: getInitialSelectedBlocks(),
    modalVisible: false,
    scratchBlocks: null
};

const reducer = function (state, action) {
    if (typeof state === 'undefined') state = initialState;
    switch (action.type) {
    case SET_SELECTED_BLOCKS:
        return Object.assign({}, state, {
            selectedBlocks: action.blocks
        });
    case SET_MODAL_VISIBLE:
        return Object.assign({}, state, {
            modalVisible: action.visible
        });
    case SET_SCRATCH_BLOCKS:
        return Object.assign({}, state, {
            scratchBlocks: action.scratchBlocks
        });
    default:
        return state;
    }
};

const setSelectedBlocks = function (blocks) {
    return {
        type: SET_SELECTED_BLOCKS,
        blocks: blocks
    };
};

const setModalVisible = function (visible) {
    return {
        type: SET_MODAL_VISIBLE,
        visible: visible
    };
};

const openBlockDisplayModal = function () {
    return setModalVisible(true);
};

const closeBlockDisplayModal = function () {
    return setModalVisible(false);
};

const setScratchBlocks = function (scratchBlocks) {
    return {
        type: SET_SCRATCH_BLOCKS,
        scratchBlocks: scratchBlocks
    };
};

export {
    reducer as default,
    initialState,
    setSelectedBlocks,
    openBlockDisplayModal,
    closeBlockDisplayModal,
    setScratchBlocks
};
