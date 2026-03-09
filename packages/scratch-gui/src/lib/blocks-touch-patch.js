// === Smalruby: This file is Smalruby-specific (patch Touch module for pointer event compatibility) ===

/**
 * Patch ScratchBlocks.Touch to recognize pointer events (pointerdown, pointermove, etc.).
 *
 * On touch-capable devices, Google Closure Library's PointerFallbackEventType remaps
 * TOUCH_MAP entries from touchstart/touchmove/touchend to pointerdown/pointermove/pointerup.
 * However, the original checkTouchIdentifier only recognizes mousedown and touchstart as
 * gesture starts, and isMouseOrTouchEvent only checks for mouse/touch prefixes.
 * This causes all pointer-based drags to silently fail on touch devices.
 *
 * See: https://github.com/smalruby/smalruby3-editor/issues/251
 * @param {object} ScratchBlocks - The ScratchBlocks instance to patch.
 */
const patchTouchForPointerEvents = function (ScratchBlocks) {
    const Touch = ScratchBlocks.Touch;
    const originalCheckTouchIdentifier = Touch.checkTouchIdentifier;

    /**
     * Patched checkTouchIdentifier that also recognizes pointerdown as a gesture start.
     * @param {Event} e - Mouse, touch, or pointer event.
     * @returns {boolean} Whether the identifier matches or a new gesture was started.
     */
    Touch.checkTouchIdentifier = function (e) {
        // If the original handler can handle it (mousedown, touchstart, or tracking), use it
        const result = originalCheckTouchIdentifier.call(this, e);
        if (result) {
            return true;
        }

        // The original returned false. Check if this is a pointerdown that should start a gesture.
        if (Touch.touchIdentifier_ === null &&
            e.type === 'pointerdown') {
            Touch.touchIdentifier_ = Touch.getTouchIdentifierFromEvent(e);
            return true;
        }

        return false;
    };

    const originalIsMouseOrTouchEvent = Touch.isMouseOrTouchEvent;

    /**
     * Patched isMouseOrTouchEvent that also recognizes pointer events.
     * @param {Event} e - An event.
     * @returns {boolean} True if it is a mouse, touch, or pointer event.
     */
    Touch.isMouseOrTouchEvent = function (e) {
        return originalIsMouseOrTouchEvent.call(this, e) ||
            e.type.startsWith('pointer');
    };
};

export {patchTouchForPointerEvents};
