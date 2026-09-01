// === Smalruby: This file is Smalruby-specific (IME composition guard for Blockly field editors, #1167) ===

/**
 * Why this patch exists:
 *
 * Blockly 12.4.1 (bundled in scratch-blocks 2.1.19) closes a field editor on
 * Enter in `FieldInput.prototype.onHtmlInputKeyDown_`:
 *
 *     // Trap Enter without IME and Esc to hide.
 *     if (e.key === 'Enter') { WidgetDiv.hideIfOwner(this); ... }
 *
 * The comment promises "without IME" but the code never checks for it. In
 * Chrome / Safari the Enter that *commits* an IME conversion also arrives as a
 * `keydown` with `key === 'Enter'`, so committing Japanese text closes the
 * editor and drops focus — typing a Japanese sentence into a block field
 * becomes impractical. (Firefox does not fire `keydown` for the commit key,
 * which is why the bug is Chrome / Safari only.) Escape is affected the same
 * way: during composition it cancels the conversion and must not close the
 * editor either.
 *
 * `node_modules` is not editable, so we wrap the prototype method at runtime,
 * following the existing precedents in `src/lib/blocks.js`
 * (`installGestureRecovery`, `installCommentIconPatch`).
 *
 * Upstream fix: reported to google/blockly — remove this patch once a release
 * containing the IME guard reaches scratch-blocks.
 */

/**
 * Whether a keyboard event was produced while an IME composition was active.
 *
 * `keyCode === 229` is the historical "IME is handling this key" sentinel and
 * is kept as a fallback for browsers (notably some Safari versions) that do
 * not set `isComposing` reliably.
 * @param {KeyboardEvent} e - The native keydown event.
 * @returns {boolean} True when the key belongs to an in-flight conversion.
 */
const isImeComposing = function (e) {
    if (!e) return false;
    return e.isComposing === true || e.keyCode === 229;
};

/**
 * Install the IME composition guard on Blockly's field editor key handler.
 * Idempotent — installing twice keeps the first wrapper.
 *
 * The patch targets `FieldInput.prototype` (the prototype of
 * `FieldTextInput.prototype`) rather than `FieldTextInput.prototype`, because
 * number / angle / other input fields inherit the same handler and are equally
 * affected. `onHtmlInputKeyDown_` survives minification: scratch-blocks
 * subclasses override it by name, so terser keeps the property key.
 * @param {object} ScratchBlocks - the scratch-blocks module (Blockly v12 + scratch additions)
 */
export const installImeCompositionPatch = function (ScratchBlocks) {
    const FieldTextInput = ScratchBlocks && ScratchBlocks.FieldTextInput;
    if (!FieldTextInput || !FieldTextInput.prototype) return;

    // `FieldInput` itself is not exported by scratch-blocks, so reach it
    // through the prototype chain. Fall back to FieldTextInput's own prototype
    // if a future version flattens the hierarchy.
    let proto = Object.getPrototypeOf(FieldTextInput.prototype);
    if (!proto || typeof proto.onHtmlInputKeyDown_ !== 'function') {
        proto = FieldTextInput.prototype;
    }
    const original = proto.onHtmlInputKeyDown_;
    if (typeof original !== 'function') return;
    if (original.__smalrubyImePatched) return;

    // Declared as a shorthand method so `this` stays the field instance.
    const wrapper = {
        onHtmlInputKeyDown_(e) {
            // Enter commits and Escape cancels the conversion. Neither should
            // reach Blockly's "close the editor" handling while composing.
            if (isImeComposing(e)) return;
            return original.call(this, e);
        },
    };
    wrapper.onHtmlInputKeyDown_.__smalrubyImePatched = true;
    proto.onHtmlInputKeyDown_ = wrapper.onHtmlInputKeyDown_;
};
