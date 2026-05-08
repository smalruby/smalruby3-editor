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
 * Inject a global CSS rule that hides Blockly comment SVG nodes carrying
 * the Smalruby metadata marker (`data-smalruby-meta="true"`). The rule is
 * appended once to <head> so it covers comments created later (the patched
 * icon below stamps the marker after fireCreateEvent / setText).
 *
 * Smalruby's converter attaches comments such as `@ruby:method:to_s` to
 * blocks so the generator can round-trip them back to Ruby. In Blockly
 * v11 these were tiny icons — invisible noise. Blockly v12 renders the
 * collapsed state as a horizontal bar with the comment text, which clutters
 * the workspace (e.g. an array literal of 10 elements produces 11 stacked
 * bars). The comment data must remain on the block for round-tripping;
 * only the visual is suppressed.
 */
const ensureMetaCommentHideStyle = function () {
    if (typeof document === 'undefined') return;
    if (document.getElementById('smalruby-hide-meta-comments')) return;
    const style = document.createElement('style');
    style.id = 'smalruby-hide-meta-comments';
    style.textContent = 'g.blocklyComment[data-smalruby-meta="true"]{display:none!important;}';
    document.head.appendChild(style);
};

/**
 * Stamp `data-smalruby-meta="true"` onto the bubble's SVG group when the
 * comment text is Smalruby internal metadata (`@ruby:` prefix). The CSS
 * rule installed by `ensureMetaCommentHideStyle` does the actual hiding.
 * Safe to call multiple times — sets / clears the attribute based on
 * the current text.
 * @param {object} bubble - The Blockly comment bubble
 * @param {string} text - The current comment text
 */
const isMetadataOnly = function (text) {
    if (typeof text !== 'string' || text.length === 0) return false;
    // A comment is metadata-only when every non-empty line starts with `@ruby:`.
    // User comments may be merged with an inline marker (e.g.
    // `@ruby:comment_position:inline\n<user text>`) — those lines after the
    // marker do NOT start with `@ruby:`, so the comment stays visible.
    const lines = text
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => l.length > 0);
    if (lines.length === 0) return false;
    return lines.every((l) => l.startsWith('@ruby:'));
};

const applyMetaMarkerToBubble = function (bubble, text) {
    if (!bubble) return;
    const isMeta = isMetadataOnly(text);
    const candidates = [];
    if (typeof bubble.getSvgRoot === 'function') candidates.push(bubble.getSvgRoot());
    if (bubble.svgRoot_) candidates.push(bubble.svgRoot_);
    if (bubble.svgRoot) candidates.push(bubble.svgRoot);
    for (const el of candidates) {
        if (!el || !el.setAttribute) continue;
        if (isMeta) {
            el.setAttribute('data-smalruby-meta', 'true');
        } else {
            el.removeAttribute('data-smalruby-meta');
        }
    }
};

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
    ensureMetaCommentHideStyle();
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
    //
    // We need to handle two opposite cases on workspace re-load:
    //
    // (a) Block was previously moved → bubble's saved x/y was captured by
    //     anchor-follow at save-time, but block width may have changed
    //     between saves and reloads (the JSON-default width applies until
    //     the SVG is fully laid out). The post-reload natural anchor lands
    //     at a different spot than the saved x/y, so the deferred
    //     setBubbleLocation visibly snaps the bubble away from where the
    //     user just saw it. We want to SUPPRESS that snap.
    //
    // (b) User explicitly dragged the bubble away from its anchor → the
    //     saved x/y is the user's chosen position (typically far from the
    //     natural anchor). We want to APPLY the saved x/y so the manual
    //     drag persists across tab toggles.
    //
    // We can't distinguish the two from the deferred call alone (Blockly
    // fires the same `block_comment_move` event from both onLocationChange
    // (anchor-follow) and bubble.endDrag (user drag)). Instead we use a
    // distance heuristic: at construction time the bubble is placed at its
    // default anchor offset, so we compare the requested setBubbleLocation
    // coord to the bubble's current position.
    //
    // - Distance ≤ SNAP_THRESHOLD_PX → assume case (a), suppress
    // - Distance > SNAP_THRESHOLD_PX → assume case (b), apply
    //
    // The threshold covers typical block-width variations (~80–100 px
    // between default JSON width and rendered SVG width) while still
    // detecting deliberate user drags.
    const POST_LOAD_SUPPRESS_MS = 500;
    const SNAP_THRESHOLD_PX = 100;

    class PatchedCommentIcon extends Existing {
        constructor(sourceBlock) {
            super(sourceBlock);
            // Track the construction time so setBubbleLocation can detect
            // the deferred call from XML deserialization vs later calls.
            this.__smalrubyPostLoadUntil = Date.now() + POST_LOAD_SUPPRESS_MS;
        }

        setBubbleLocation(coord) {
            if (this.__smalrubyPostLoadUntil && Date.now() < this.__smalrubyPostLoadUntil) {
                try {
                    const bubble = typeof this.getBubble === 'function' ? this.getBubble() : null;
                    if (bubble && typeof bubble.getRelativeToSurfaceXY === 'function' && coord) {
                        const cur = bubble.getRelativeToSurfaceXY();
                        const dx = (coord.x || 0) - (cur.x || 0);
                        const dy = (coord.y || 0) - (cur.y || 0);
                        const distSq = dx * dx + dy * dy;
                        if (distSq <= SNAP_THRESHOLD_PX * SNAP_THRESHOLD_PX) {
                            // Saved x/y is close to natural anchor — assume
                            // stale anchor-follow data and skip the snap.
                            return;
                        }
                    }
                } catch (_e) {
                    // fall through to super
                }
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
                applyMetaMarkerToBubble(bubble, text);
            } catch (e) {
                // eslint-disable-next-line no-console
                console.warn('[smalruby] PatchedCommentIcon.fireCreateEvent state refire failed:', e);
            }
            return result;
        }

        // Re-apply the meta marker on text change so a comment that is
        // edited away from `@ruby:...` becomes visible (and vice versa).
        setText(text) {
            const result = super.setText(text);
            try {
                const bubble = typeof this.getBubble === 'function' ? this.getBubble() : null;
                applyMetaMarkerToBubble(bubble, text);
            } catch (_e) {
                // non-fatal
            }
            return result;
        }
    }
    PatchedCommentIcon.__smalrubyCommentIconPatched = true;

    ScratchBlocks.registry.unregister(Type.ICON, commentKey);
    ScratchBlocks.registry.register(Type.ICON, commentKey, PatchedCommentIcon, true);
};
