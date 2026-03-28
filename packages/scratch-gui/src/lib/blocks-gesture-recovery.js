// === Smalruby: This file is Smalruby-specific (gesture recovery for stuck block drags) ===

/**
 * Install gesture recovery handlers to prevent blocks from getting stuck
 * in a dragging state.
 *
 * On some devices (particularly touch-enabled Chromebooks), pointer events
 * can be lost when the user switches tabs, the window loses focus, or the
 * browser triggers a system gesture. When a pointerup event is lost during
 * a block drag, the block remains attached to the pointer indefinitely.
 *
 * This module installs event listeners that cancel any active gesture when:
 * - The page becomes hidden (visibilitychange)
 * - The window loses focus (blur)
 * - A pointerdown occurs while a gesture is already active (stuck recovery)
 *
 * See: https://github.com/smalruby/smalruby3-editor/issues/251
 * @param {object} ScratchBlocks - The ScratchBlocks instance.
 */
const installGestureRecovery = function (ScratchBlocks) {
  /**
   * Cancel the active gesture on the main workspace, if any.
   * @returns {boolean} Whether a gesture was cancelled.
   */
  const cancelActiveGesture = function () {
    const workspace = ScratchBlocks.getMainWorkspace()
    if (!workspace) return false

    const gesture = workspace.currentGesture_
    if (gesture) {
      gesture.cancel()
      return true
    }
    return false
  }

  // Cancel gesture when page becomes hidden (tab switch, app switch)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      cancelActiveGesture()
    }
  })

  // Cancel gesture when window loses focus (another window activated)
  window.addEventListener('blur', () => {
    cancelActiveGesture()
  })

  // Recovery: if a new pointerdown arrives while a gesture is still active,
  // cancel the stale gesture first. This handles the case where pointerup
  // was lost and the user tries to interact again.
  document.addEventListener(
    'pointerdown',
    () => {
      const workspace = ScratchBlocks.getMainWorkspace()
      if (!workspace || !workspace.currentGesture_) return

      const gesture = workspace.currentGesture_
      // Only recover if the gesture has been dragging (not just a click)
      if (gesture.isDragging()) {
        gesture.cancel()
      }
    },
    true,
  ) // capture phase: run before Blockly's own handler
}

export { installGestureRecovery }
