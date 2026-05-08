// === Smalruby: This file is Smalruby-specific (re-fire block_comment_change/collapse after create so VM picks up the bubble's current text and collapsed state) ===

/**
 * Why this patch still exists after upstream's spork@29bdbd1fe fix:
 *
 * Blockly v12's `block_comment_create` event payload carries only
 * commentId/blockId/x/y/width/height — it does NOT carry text or
 * collapsed state. When ScratchBlockPaster.paste() deserializes a
 * duplicated block, super.paste() restores the bubble's text and
 * collapsed state via `loadState → setText / setCollapsed` — both
 * of which fire their own events (`block_comment_change` and
 * `block_comment_collapse`) BEFORE the create event. At that moment
 * the comment doesn't yet exist in `target.comments`, so the VM
 * listener silently discards them. The subsequent create event then
 * registers the comment with text='' and minimized=false (defaults).
 *
 * To bridge the gap, we override `fireCreateEvent` on the registered
 * comment icon class to re-fire `block_comment_change` AND
 * `block_comment_collapse` with the bubble's current state
 * immediately after the create event. The VM processes create first
 * (registering the comment), then the re-fired events correctly
 * apply the text and collapsed state.
 *
 * Earlier revisions of this file also patched constructor (sync
 * setCollapsed), `setBubbleVisible`, and `setBubbleLocation` to work
 * around scratch-blocks v2's XML deserializer. Those are no longer
 * needed because we updated `packages/scratch-vm/src/engine/comment.js`
 * to emit `pinned="${!minimized}"` and omit x/y for (0, 0) — which
 * makes Blockly's deserializer correctly initialize collapsed state
 * and skip its programmatic reposition. See the
 * `Smalruby: toXML modernization` block in comment.js for details.
 */

/**
 * Install the ScratchCommentIcon patch. Idempotent.
 * Survives minification because:
 * - `Blockly.registry`, `Blockly.icons.IconType.COMMENT` are public APIs
 *   (preserved by terser as string keys / external references).
 * - `getBubble`, `getText`, `fireCreateEvent`, and the
 *   `block_comment_change` event registry key are public method names
 *   used by scratch-blocks itself, so terser preserves them.
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
        // Re-fire `block_comment_change` (text) and `block_comment_collapse`
        // (collapsed state) after `block_comment_create` so the VM sees the
        // bubble's actual state *after* it has registered the comment.
        // See the file header for the full rationale.
        fireCreateEvent() {
            const result = super.fireCreateEvent();
            try {
                const bubble = typeof this.getBubble === 'function' ? this.getBubble() : null;
                if (!bubble) return result;
                const Events = ScratchBlocks.Events;
                if (!Events || typeof Events.fire !== 'function' || typeof Events.get !== 'function') {
                    return result;
                }
                const text =
                    typeof this.getText === 'function'
                        ? this.getText()
                        : typeof bubble.getText === 'function'
                          ? bubble.getText()
                          : '';
                if (text) {
                    const ChangeEvent = Events.get('block_comment_change');
                    if (ChangeEvent) Events.fire(new ChangeEvent(bubble, '', text));
                }
                if (typeof bubble.isCollapsed === 'function' && bubble.isCollapsed()) {
                    const CollapseEvent = Events.get('block_comment_collapse');
                    if (CollapseEvent) Events.fire(new CollapseEvent(bubble, true));
                }
            } catch (e) {
                // eslint-disable-next-line no-console
                console.warn('[smalruby] PatchedCommentIcon.fireCreateEvent state refire failed:', e);
            }
            return result;
        }
    }
    PatchedCommentIcon.__smalrubyCommentIconPatched = true;

    ScratchBlocks.registry.unregister(Type.ICON, commentKey);
    ScratchBlocks.registry.register(Type.ICON, commentKey, PatchedCommentIcon, true);
};
