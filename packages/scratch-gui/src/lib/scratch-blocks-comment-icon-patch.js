// === Smalruby: This file is Smalruby-specific (work around two Blockly v12 quirks: (1) block_comment_create payload omits text/collapsed, (2) deferred setBubbleLocation snaps bubbles to stale saved x/y) ===

/**
 * Why this patch exists:
 *
 * 1. `fireCreateEvent` re-fire (text + collapsed):
 *    Blockly v12's `block_comment_create` event payload carries only
 *    commentId/blockId/x/y/width/height — it does NOT carry text or
 *    collapsed state. ScratchBlockPaster.paste() restores the bubble's
 *    text via `setText` and collapsed state via `setCollapsed`, both
 *    of which fire `block_comment_change` / `block_comment_collapse`
 *    BEFORE the create event. At that moment the comment doesn't
 *    exist in target.comments yet, so the VM discards them. The
 *    subsequent create event registers the comment with empty text
 *    and minimized=false. We re-fire both events with the current
 *    bubble state immediately after the create event so the VM sees
 *    the actual values AFTER it has registered the comment.
 *
 * 2. `setBubbleLocation` post-load suppression:
 *    Blockly v12's applyCommentTagNodes (`ji` in scratch-blocks v2.1.19)
 *    schedules a `setTimeout(..., 1)` that calls
 *    `setBubbleLocation(parsedX, parsedY)` from the XML attributes.
 *    Block widths can change between save and reload (default JSON
 *    width vs post-render SVG width), so the saved x/y from the VM
 *    is often "stale" relative to the current natural anchor position.
 *    The deferred call visibly snaps the bubble away from where the
 *    user just saw it on tab switch. We suppress that one call in a
 *    short post-load window so the bubble stays at its natural anchor
 *    position, which matches "where it was right after the tab toggle".
 *
 * Earlier revisions of this file also patched the constructor (sync
 * setCollapsed) and `setBubbleVisible`. Those are no longer needed
 * because we updated `packages/scratch-vm/src/engine/comment.js` to
 * emit `pinned="${!minimized}"`, which makes Blockly's deserializer
 * correctly initialize collapsed state without our help. See the
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

    // Blockly v12's applyCommentTagNodes (function `ji` in scratch-blocks
    // v2.1.19) schedules a `setTimeout(..., 1)` that calls
    // `setBubbleLocation(parsedX, parsedY)` using the XML's x/y attributes.
    // For `@ruby:*` block-attached comments, the saved x/y in VM is the
    // bubble's anchor position at *save* time, but block width can change
    // between saves and reloads (e.g. before/after full SVG render — block
    // width starts at the JSON-default and grows to its rendered width
    // after layout). The post-reload natural anchor therefore lands at a
    // different spot than the saved x/y, and the deferred setBubbleLocation
    // visibly snaps the bubble away from where the user just saw it.
    //
    // POST_LOAD_SUPPRESS_MS opens a window after each icon construction
    // during which we drop programmatic setBubbleLocation calls. After
    // that window the icon behaves normally so user-initiated drags and
    // legitimate programmatic moves still work.
    const POST_LOAD_SUPPRESS_MS = 500;

    class PatchedCommentIcon extends Existing {
        constructor(sourceBlock) {
            super(sourceBlock);
            // Track the construction time so setBubbleLocation can ignore
            // the deferred call from XML deserialization.
            this.__smalrubyPostLoadUntil = Date.now() + POST_LOAD_SUPPRESS_MS;
        }

        setBubbleLocation(coord) {
            if (this.__smalrubyPostLoadUntil && Date.now() < this.__smalrubyPostLoadUntil) {
                return;
            }
            return super.setBubbleLocation(coord);
        }

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
