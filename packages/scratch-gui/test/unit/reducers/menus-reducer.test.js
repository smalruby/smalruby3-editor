/* eslint-env jest */
import menusReducer, {
  openFileMenu,
  closeFileMenu,
  toggleFileMenu,
  openEditMenu,
  closeEditMenu,
  toggleEditMenu,
  openSettingsMenu,
  closeSettingsMenu,
  toggleSettingsMenu,
  menuInitialState,
} from '../../../src/reducers/menus'

test('initialState', () => {
  let defaultState
  expect(menusReducer(defaultState, { type: 'anything' })).toEqual(menuInitialState)
})

describe('toggleFileMenu', () => {
  test('opens when closed', () => {
    const state = { ...menuInitialState, fileMenu: false }
    const newState = menusReducer(state, toggleFileMenu())
    expect(newState.fileMenu).toBe(true)
  })

  test('closes when open', () => {
    const state = { ...menuInitialState, fileMenu: true }
    const newState = menusReducer(state, toggleFileMenu())
    expect(newState.fileMenu).toBe(false)
  })
})

describe('toggleEditMenu', () => {
  test('opens when closed', () => {
    const state = { ...menuInitialState, editMenu: false }
    const newState = menusReducer(state, toggleEditMenu())
    expect(newState.editMenu).toBe(true)
  })

  test('closes when open', () => {
    const state = { ...menuInitialState, editMenu: true }
    const newState = menusReducer(state, toggleEditMenu())
    expect(newState.editMenu).toBe(false)
  })
})

describe('toggleSettingsMenu', () => {
  test('opens when closed', () => {
    const state = { ...menuInitialState, settingsMenu: false }
    const newState = menusReducer(state, toggleSettingsMenu())
    expect(newState.settingsMenu).toBe(true)
  })

  test('closes when open', () => {
    const state = { ...menuInitialState, settingsMenu: true }
    const newState = menusReducer(state, toggleSettingsMenu())
    expect(newState.settingsMenu).toBe(false)
  })
})

describe('toggle closes sibling menus', () => {
  test('toggleFileMenu closes editMenu if open', () => {
    const state = { ...menuInitialState, editMenu: true }
    const newState = menusReducer(state, toggleFileMenu())
    expect(newState.fileMenu).toBe(true)
    expect(newState.editMenu).toBe(false)
  })

  test('toggleEditMenu closes fileMenu if open', () => {
    const state = { ...menuInitialState, fileMenu: true }
    const newState = menusReducer(state, toggleEditMenu())
    expect(newState.editMenu).toBe(true)
    expect(newState.fileMenu).toBe(false)
  })
})

describe('existing open/close actions still work', () => {
  test('openFileMenu opens fileMenu', () => {
    const state = { ...menuInitialState, fileMenu: false }
    const newState = menusReducer(state, openFileMenu())
    expect(newState.fileMenu).toBe(true)
  })

  test('closeFileMenu closes fileMenu', () => {
    const state = { ...menuInitialState, fileMenu: true }
    const newState = menusReducer(state, closeFileMenu())
    expect(newState.fileMenu).toBe(false)
  })

  test('openEditMenu opens editMenu', () => {
    const state = { ...menuInitialState, editMenu: false }
    const newState = menusReducer(state, openEditMenu())
    expect(newState.editMenu).toBe(true)
  })

  test('closeEditMenu closes editMenu', () => {
    const state = { ...menuInitialState, editMenu: true }
    const newState = menusReducer(state, closeEditMenu())
    expect(newState.editMenu).toBe(false)
  })

  test('openSettingsMenu opens settingsMenu', () => {
    const state = { ...menuInitialState, settingsMenu: false }
    const newState = menusReducer(state, openSettingsMenu())
    expect(newState.settingsMenu).toBe(true)
  })

  test('closeSettingsMenu closes settingsMenu', () => {
    const state = { ...menuInitialState, settingsMenu: true }
    const newState = menusReducer(state, closeSettingsMenu())
    expect(newState.settingsMenu).toBe(false)
  })
})
