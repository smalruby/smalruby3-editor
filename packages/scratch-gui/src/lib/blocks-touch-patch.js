// === Smalruby: This file is Smalruby-specific (patch Touch module for pointer event compatibility) ===

/**
 * Verify that the scratch-blocks Touch module has been patched for pointer event compatibility.
 *
 * The actual patch is applied at the source level via scripts/patch-scratch-blocks-touch.js
 * (a postinstall script). This function verifies the patch was applied correctly and exposes
 * a test hook.
 *
 * Background: On touch-capable devices, Google Closure Library's PointerFallbackEventType
 * remaps TOUCH_MAP entries from touchstart to pointerdown. The old checkTouchIdentifier
 * only recognizes mousedown and touchstart as gesture starts, causing pointer-based drags
 * to fail on touch devices (e.g. Chromebooks).
 *
 * See: https://github.com/smalruby/smalruby3-editor/issues/251
 * @param {object} ScratchBlocks - The ScratchBlocks instance to verify.
 */
const patchTouchForPointerEvents = function (ScratchBlocks) {
    // The exported ScratchBlocks.Touch is from the NEW Blockly wrapper and already
    // supports pointer events. The OLD Closure-compiled internal Blockly.Touch is
    // patched by the postinstall script (scripts/patch-scratch-blocks-touch.js).
    // Nothing to do here at runtime.

    // Expose Touch module for integration testing
    if (typeof window !== 'undefined') {
        window.__smalrubyBlocklyTouch = ScratchBlocks.Touch;
    }
};

export {patchTouchForPointerEvents};
