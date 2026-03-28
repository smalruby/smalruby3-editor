import reducer, { settingsInitialState, dismissV1Prompt } from '../../../src/reducers/settings'

describe('settings reducer', () => {
  describe('v1PromptDismissed', () => {
    test('should have v1PromptDismissed as false in initial state', () => {
      expect(settingsInitialState.v1PromptDismissed).toBe(false)
    })

    test('should set v1PromptDismissed to true on DISMISS_V1_PROMPT', () => {
      const state = reducer(settingsInitialState, dismissV1Prompt())
      expect(state.v1PromptDismissed).toBe(true)
    })

    test('should not affect other state properties', () => {
      const state = reducer(settingsInitialState, dismissV1Prompt())
      expect(state.colorMode).toBe(settingsInitialState.colorMode)
      expect(state.theme).toBe(settingsInitialState.theme)
      expect(state.rubyVersion).toBe(settingsInitialState.rubyVersion)
    })

    test('should handle unknown action', () => {
      const state = reducer(settingsInitialState, { type: 'UNKNOWN' })
      expect(state.v1PromptDismissed).toBe(false)
    })
  })
})
