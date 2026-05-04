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
     * Uses Blockly v12's public `cancelCurrentGesture()` which is a no-op
     * when no gesture is active, so we don't need to inspect internal
     * state ourselves.
     */
    const cancelActiveGesture = function () {
        const workspace = ScratchBlocks.getMainWorkspace();
        if (!workspace) return;
        workspace.cancelCurrentGesture();
    };

    // Cancel gesture when page becomes hidden (tab switch, app switch)
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') {
            cancelActiveGesture();
        }
    });

    // Cancel gesture when window loses focus (another window activated)
    window.addEventListener('blur', () => {
        cancelActiveGesture();
    });

    // Recovery: if a new pointerdown arrives while a gesture is still active,
    // cancel the stale gesture first. This handles the case where pointerup
    // was lost and the user tries to interact again.
    //
    // Unlike the visibilitychange / blur handlers, here we must look at the
    // actual Gesture instance to read `isDragging()` — we don't want to cancel
    // a gesture that is still in its click-detection phase, because that would
    // also kill the user's legitimate click. There is no public equivalent of
    // `isDragging()` on the workspace itself, so we keep the private-field
    // access as a narrow exception. If a future Blockly version renames
    // `currentGesture_`, the optional chain just makes this branch a no-op,
    // not a crash.
    document.addEventListener(
        'pointerdown',
        () => {
            const workspace = ScratchBlocks.getMainWorkspace();
            const gesture = workspace?.currentGesture_;
            if (gesture && gesture.isDragging()) {
                workspace.cancelCurrentGesture();
            }
        },
        true,
    ); // capture phase: run before Blockly's own handler
};

export { installGestureRecovery };
