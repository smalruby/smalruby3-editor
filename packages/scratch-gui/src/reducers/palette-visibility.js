const SHOW_PALETTE = 'scratch-gui/palette-visibility/SHOW_PALETTE'
const HIDE_PALETTE = 'scratch-gui/palette-visibility/HIDE_PALETTE'
const TOGGLE_PALETTE = 'scratch-gui/palette-visibility/TOGGLE_PALETTE'

const initialState = {
  paletteVisible: true,
}

const reducer = function (state, action) {
  if (typeof state === 'undefined') state = initialState
  switch (action.type) {
    case SHOW_PALETTE:
      return Object.assign({}, state, { paletteVisible: true })
    case HIDE_PALETTE:
      return Object.assign({}, state, { paletteVisible: false })
    case TOGGLE_PALETTE:
      return Object.assign({}, state, { paletteVisible: !state.paletteVisible })
    default:
      return state
  }
}

const showPalette = () => ({ type: SHOW_PALETTE })
const hidePalette = () => ({ type: HIDE_PALETTE })
const togglePalette = () => ({ type: TOGGLE_PALETTE })

export { reducer as default, initialState, showPalette, hidePalette, togglePalette }
