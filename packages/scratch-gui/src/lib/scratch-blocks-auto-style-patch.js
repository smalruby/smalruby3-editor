/**
 * Why this patch exists:
 *
 * Blockly v12's dropdown / matrix / colour fields call
 * `block.setStyle(`${originalStyle}_selected`)` when the user opens the
 * editor on a shadow block, to highlight the shadow while editing. The
 * `*_selected` style variant is registered for every named theme style by
 * `Theme.setBlockStyle`, but **not** for "auto" styles created on the fly
 * by `ConstantProvider.getBlockStyleForColour` (style name = `auto_<hex>`).
 *
 * When such a shadow lives on an extension block whose colour did not
 * resolve to a named theme style — e.g. the Smalruby Mesh extension's
 * `[NAME] sensor value` reporter, which uses the default extension
 * colour `#0FBD8C` — `originalStyle` is `auto_#0fbd8c`, and the field
 * asks the renderer for `auto_#0fbd8c_selected`. The renderer's
 * `getBlockStyle` falls through its `auto_` branch and forwards the
 * full remainder to `getBlockStyleForColour`, which calls
 * `validatedBlockStyle_({colourPrimary: "#0fbd8c_selected"})` and throws
 * `Invalid colour: "#0fbd8c_selected"`. The thrown error breaks the
 * field click and freezes the workspace.
 *
 * Fix: register an `auto_<hex>_selected` style on first access by
 * wrapping `getBlockStyle`. The selected variant we register matches
 * how Blockly v12's `Theme.setBlockStyle` builds them — same primary
 * colour, secondary becomes the original tertiary, hat cleared — so the
 * highlight looks identical to a themed shadow's selected state.
 * @param {object} ScratchBlocks - the scratch-blocks module
 */
export const installAutoStyleSelectedPatch = function (ScratchBlocks) {
    const ConstantProvider = ScratchBlocks?.blockRendering?.ConstantProvider;
    if (!ConstantProvider || !ConstantProvider.prototype) return;
    if (ConstantProvider.prototype.__smalrubyAutoStyleSelectedPatched) return;

    const origGetBlockStyle = ConstantProvider.prototype.getBlockStyle;
    if (typeof origGetBlockStyle !== 'function') return;

    ConstantProvider.prototype.getBlockStyle = function (name) {
        if (
            name &&
            this.blockStyles &&
            !this.blockStyles[name] &&
            name.startsWith('auto_') &&
            name.endsWith('_selected')
        ) {
            const baseName = name.slice(0, -'_selected'.length);
            const baseStyle = origGetBlockStyle.call(this, baseName);
            if (baseStyle) {
                this.blockStyles[name] = {
                    colourPrimary: baseStyle.colourPrimary,
                    colourSecondary: baseStyle.colourTertiary,
                    colourTertiary: baseStyle.colourTertiary,
                    colourQuaternary: baseStyle.colourQuaternary,
                    hat: '',
                };
                return this.blockStyles[name];
            }
        }
        return origGetBlockStyle.call(this, name);
    };

    ConstantProvider.prototype.__smalrubyAutoStyleSelectedPatched = true;
};
