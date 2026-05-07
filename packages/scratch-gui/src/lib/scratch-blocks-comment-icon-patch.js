// === Smalruby: This file is Smalruby-specific (patch ScratchCommentIcon to support sync initial-collapse) ===

/**
 * Pending state to apply to the next batch of ScratchCommentIcon constructions.
 * Populated by `containers/blocks.jsx` immediately before
 * `clearWorkspaceAndLoadFromXml`, cleared in the finally block of the same
 * call. Map keys are sourceBlock IDs.
 *
 * Each entry is {collapsed: boolean, location: {x, y} | null}. The patched
 * constructor reads this and applies the state synchronously to the
 * comment bubble — so the bubble is *born* in the desired collapsed/located
 * state and never flashes in the default expanded-on-the-right state that
 * scratch-blocks v2 would otherwise produce. The XML attributes
 * `minimized="true"` and `pinned` are NOT honored by Blockly v12's
 * deserializer (they were honored by scratch-blocks v1), so this patch
 * fills that gap.
 */
let pendingApply = null;

/**
 * Set the pending apply state. Call with `null` to clear.
 * @param {Map<string, {collapsed: boolean, location: ?{x: number, y: number}}>|null} mapOrNull - mapping of block IDs to apply state
 */
export const setPendingCommentIconApply = function (mapOrNull) {
    pendingApply = mapOrNull && mapOrNull.size > 0 ? mapOrNull : null;
};

/**
 * Install the ScratchCommentIcon patch. Idempotent — safe to call multiple
 * times (subsequent calls no-op). The patch subclasses whatever class is
 * currently registered for `IconType.COMMENT` and re-registers the subclass.
 * It does NOT depend on ScratchCommentIcon being a named export, so it
 * survives upstream renames as long as the registry key is stable.
 * Survives minification because:
 * - `Blockly.registry`, `Blockly.icons.IconType.COMMENT` are public APIs
 *   (preserved by terser as string keys / external references).
 * - `getBubble`, `setCollapsed`, `setBubbleLocation` are public method names
 *   on the ScratchCommentIcon / ScratchCommentBubble exposed via the
 *   scratch-blocks dist bundle and called by other Smalruby code (e.g.
 *   containers/blocks.jsx), so terser already preserves them.
 * @param {object} ScratchBlocks - the scratch-blocks module (Blockly v12 + scratch additions)
 */
export const installCommentIconPatch = function (ScratchBlocks) {
    if (!ScratchBlocks || !ScratchBlocks.registry || !ScratchBlocks.icons) return;
    const Type = ScratchBlocks.registry.Type;
    const IconType = ScratchBlocks.icons.IconType;
    if (!Type || !IconType || !IconType.COMMENT) return;
    const commentKey = IconType.COMMENT.toString();

    const Existing = ScratchBlocks.registry.getClass(Type.ICON, commentKey);
    if (!Existing) return;
    if (Existing.__smalrubyCommentIconPatched) return;

    class PatchedCommentIcon extends Existing {
        constructor(sourceBlock) {
            super(sourceBlock);
            try {
                this.__smalrubyCollapseLock = false;
                if (!pendingApply) return;
                const apply = pendingApply.get(sourceBlock && sourceBlock.id);
                if (!apply) return;
                this.__smalrubyCollapseLock = !!apply.collapsed;
                const bubble = typeof this.getBubble === 'function' ? this.getBubble() : null;
                if (!bubble) return;
                if (apply.collapsed && typeof bubble.setCollapsed === 'function') {
                    bubble.setCollapsed(true);
                }
                // Position correction is intentionally NOT done here. The
                // bubble's anchor (block right edge) gets re-applied by
                // Blockly's internal render-management before the first paint,
                // so any moveTo() in the constructor is overridden anyway.
                // The "right→left" flash is hidden by the conversion overlay
                // in `containers/blocks.jsx` instead.
            } catch (e) {
                // Defensive: never let a patch error break workspace deserialization.
                // eslint-disable-next-line no-console
                console.warn('[smalruby] PatchedCommentIcon apply failed:', e);
            }
        }

        // Blockly v12's XML deserializer calls `setBubbleVisible(true)` for
        // every <comment> element — both synchronously inside domToBlock
        // and again from a deferred render-management callback that fires
        // *after* clearWorkspaceAndLoadFromXml returns. Either call re-expands
        // a bubble we just collapsed, producing the visible flash that users
        // saw on every Ruby→Code conversion and every Code↔Ruby tab toggle.
        //
        // While the icon's `__smalrubyCollapseLock` is set, suppress these
        // programmatic show requests. The user-initiated expand path goes
        // through the bubble's chevron and calls `bubble.setCollapsed(false)`
        // directly — it does NOT route through setBubbleVisible — so users
        // can still click to expand normally.
        setBubbleVisible(visible) {
            if (visible && this.__smalrubyCollapseLock) {
                return Promise.resolve();
            }
            return super.setBubbleVisible(visible);
        }
    }
    PatchedCommentIcon.__smalrubyCommentIconPatched = true;

    ScratchBlocks.registry.unregister(Type.ICON, commentKey);
    ScratchBlocks.registry.register(Type.ICON, commentKey, PatchedCommentIcon, true);
};
