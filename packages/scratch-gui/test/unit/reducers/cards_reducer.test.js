import reducer from '../../../src/reducers/cards'
import { activateDeck, nextStep, prevStep, closeCards } from '../../../src/reducers/cards'

describe('cards reducer', () => {
  test('should return initial state', () => {
    expect(reducer(undefined, {})).toEqual({
      visible: false,
      content: expect.any(Object),
      activeDeckId: null,
      step: 0,
      x: 0,
      y: 0,
      expanded: true,
      dragging: false,
      tutorialAllowedBlocks: null,
      // === Smalruby: Start of start-tutorial button ===
      pendingProjectTitle: null,
      // === Smalruby: End of start-tutorial button ===
    })
  })

  test('should activate a deck', () => {
    const state = reducer(undefined, activateDeck('getting-started'))
    expect(state.activeDeckId).toBe('getting-started')
    expect(state.visible).toBe(true)
    expect(state.step).toBe(0)
  })

  test('should go to next step', () => {
    let state = reducer(undefined, activateDeck('getting-started'))
    state = reducer(state, nextStep())
    expect(state.step).toBe(1)
  })

  test('should go to prev step', () => {
    let state = reducer(undefined, activateDeck('getting-started'))
    state = reducer(state, nextStep())
    state = reducer(state, prevStep())
    expect(state.step).toBe(0)
  })

  test('should not go to prev step if at 0', () => {
    let state = reducer(undefined, activateDeck('getting-started'))
    state = reducer(state, prevStep())
    expect(state.step).toBe(0)
  })

  test('should close cards', () => {
    let state = reducer(undefined, activateDeck('getting-started'))
    expect(state.visible).toBe(true)
    state = reducer(state, closeCards())
    expect(state.visible).toBe(false)
  })

  describe('tutorialAllowedBlocks', () => {
    test('should set tutorialAllowedBlocks when activating a deck with allowedBlocks', () => {
      const state = reducer(undefined, activateDeck('chat-1-basic-1'))
      expect(state.tutorialAllowedBlocks).not.toBeNull()
      expect(state.tutorialAllowedBlocks.event).toContain('event_whenflagclicked')
      expect(state.tutorialAllowedBlocks.event).toContain('event_whenbroadcastreceived')
      expect(state.tutorialAllowedBlocks.event).toContain('event_broadcast')
      expect(state.tutorialAllowedBlocks.looks).toContain('looks_sayforsecs')
      expect(state.tutorialAllowedBlocks.looks).toContain('looks_say')
      expect(state.tutorialAllowedBlocks.motion).toEqual([])
    })

    test('should set tutorialAllowedBlocks when activating chat-2-sprites-1', () => {
      const state = reducer(undefined, activateDeck('chat-2-sprites-1'))
      expect(state.tutorialAllowedBlocks).not.toBeNull()
      expect(state.tutorialAllowedBlocks.event).toContain('event_whenthisspriteclicked')
      expect(state.tutorialAllowedBlocks.looks).toContain('looks_sayforsecs')
      expect(state.tutorialAllowedBlocks.looks).not.toContain('looks_say')
    })

    test('should set tutorialAllowedBlocks when activating chat-3-mesh-1', () => {
      const state = reducer(undefined, activateDeck('chat-3-mesh-1'))
      expect(state.tutorialAllowedBlocks).not.toBeNull()
      expect(state.tutorialAllowedBlocks.event).toContain('event_whenthisspriteclicked')
    })

    test('should clear tutorialAllowedBlocks when activating a deck without allowedBlocks', () => {
      let state = reducer(undefined, activateDeck('chat-1-basic-1'))
      expect(state.tutorialAllowedBlocks).not.toBeNull()
      state = reducer(state, activateDeck('intro-getting-started'))
      expect(state.tutorialAllowedBlocks).toBeNull()
    })

    test('should clear tutorialAllowedBlocks when closing cards', () => {
      let state = reducer(undefined, activateDeck('chat-1-basic-1'))
      expect(state.tutorialAllowedBlocks).not.toBeNull()
      state = reducer(state, closeCards())
      expect(state.tutorialAllowedBlocks).toBeNull()
    })
  })
})
