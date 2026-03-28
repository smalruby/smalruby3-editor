/* eslint-env jest */
import paletteVisibilityReducer, {
  initialState,
  showPalette,
  hidePalette,
  togglePalette,
} from '../../../src/reducers/palette-visibility'

test('initialState', () => {
  let defaultState
  expect(paletteVisibilityReducer(defaultState, { type: 'anything' })).toBeDefined()
})

test('initial state has paletteVisible true', () => {
  let defaultState
  expect(paletteVisibilityReducer(defaultState, { type: 'anything' }).paletteVisible).toBe(true)
})

test('showPalette sets paletteVisible to true', () => {
  const state = { paletteVisible: false }
  const newState = paletteVisibilityReducer(state, showPalette())
  expect(newState.paletteVisible).toBe(true)
})

test('hidePalette sets paletteVisible to false', () => {
  const state = { paletteVisible: true }
  const newState = paletteVisibilityReducer(state, hidePalette())
  expect(newState.paletteVisible).toBe(false)
})

test('togglePalette toggles paletteVisible from true to false', () => {
  const state = { paletteVisible: true }
  const newState = paletteVisibilityReducer(state, togglePalette())
  expect(newState.paletteVisible).toBe(false)
})

test('togglePalette toggles paletteVisible from false to true', () => {
  const state = { paletteVisible: false }
  const newState = paletteVisibilityReducer(state, togglePalette())
  expect(newState.paletteVisible).toBe(true)
})

test('unknown action returns same state', () => {
  const state = { paletteVisible: true }
  expect(paletteVisibilityReducer(state, { type: 'unknown' })).toEqual(state)
})

test('initialState export is defined', () => {
  expect(initialState).toBeDefined()
  expect(initialState.paletteVisible).toBe(true)
})
