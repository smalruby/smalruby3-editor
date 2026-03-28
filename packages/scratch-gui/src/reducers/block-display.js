import queryString from 'query-string'
import { initializeBlockSelectionFromOnlyBlocks } from '../lib/block-utils'

const SET_SELECTED_BLOCKS = 'scratch-gui/block-display/SET_SELECTED_BLOCKS'
const SET_MODAL_VISIBLE = 'scratch-gui/block-display/SET_MODAL_VISIBLE'
const SET_SCRATCH_BLOCKS = 'scratch-gui/block-display/SET_SCRATCH_BLOCKS'

// Initialize selectedBlocks based on only_blocks parameter if present
const getInitialSelectedBlocks = () => {
  // Parse URL parameters
  const urlParams = typeof window === 'undefined' ? {} : queryString.parse(window.location.search)

  const onlyBlocks = urlParams.only_blocks

  // Initialize from only_blocks parameter (null if not present, which will select all blocks)
  return initializeBlockSelectionFromOnlyBlocks(onlyBlocks)
}

const initialState = {
  selectedBlocks: getInitialSelectedBlocks(),
  modalVisible: false,
  scratchBlocks: null,
}

const reducer = function (state, action) {
  if (typeof state === 'undefined') state = initialState

  // Migrate old 'events' key to 'event' for backward compatibility when loading state
  if (state && state.selectedBlocks && state.selectedBlocks.events && !state.selectedBlocks.event) {
    state = {
      ...state,
      selectedBlocks: {
        ...state.selectedBlocks,
        event: state.selectedBlocks.events,
      },
    }
    delete state.selectedBlocks.events
  }

  switch (action.type) {
    case SET_SELECTED_BLOCKS:
      return Object.assign({}, state, {
        selectedBlocks: action.blocks,
      })
    case SET_MODAL_VISIBLE:
      return Object.assign({}, state, {
        modalVisible: action.visible,
      })
    case SET_SCRATCH_BLOCKS:
      return Object.assign({}, state, {
        scratchBlocks: action.scratchBlocks,
      })
    default:
      return state
  }
}

const setSelectedBlocks = function (blocks) {
  // Migrate old 'events' key to 'event' for backward compatibility
  let migratedBlocks = blocks
  if (blocks && blocks.events && !blocks.event) {
    migratedBlocks = { ...blocks }
    migratedBlocks.event = blocks.events
    delete migratedBlocks.events
  }

  return {
    type: SET_SELECTED_BLOCKS,
    blocks: migratedBlocks,
  }
}

const setModalVisible = function (visible) {
  return {
    type: SET_MODAL_VISIBLE,
    visible: visible,
  }
}

const openBlockDisplayModal = function () {
  return setModalVisible(true)
}

const closeBlockDisplayModal = function () {
  return setModalVisible(false)
}

const setScratchBlocks = function (scratchBlocks) {
  return {
    type: SET_SCRATCH_BLOCKS,
    scratchBlocks: scratchBlocks,
  }
}

export {
  reducer as default,
  initialState,
  initialState as blockDisplayInitialState,
  setSelectedBlocks,
  openBlockDisplayModal,
  closeBlockDisplayModal,
  setScratchBlocks,
}
