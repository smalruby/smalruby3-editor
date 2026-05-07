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

    // After applyCommentTagNodes installs the icon, Blockly v12 schedules a
    // `setTimeout(..., 1)` that calls `setBubbleLocation(x, y)` and then
    // `setBubbleVisible(true)` using the x/y/pinned values from the XML
    // attributes. For block-attached @ruby:* comments those XML coords are
    // (0, 0) (the converter's default), so all bubbles get repositioned to
    // the same workspace point a few ms after rendering — which the user
    // saw as bubbles "stacking" on top of each other.
    //
    // POST_LOAD_SUPPRESS_MS opens a window on each new icon during which
    // programmatic setBubbleLocation calls are suppressed. After that
    // window closes the icon behaves normally (so user-initiated drags
    // through `setBubbleLocation` still work). Empirically the deferred
    // call lands ~100 ms after the constructor in dev builds, so 500 ms
    // gives comfortable buffer while still being well below any plausible
    // user-drag latency.
    const POST_LOAD_SUPPRESS_MS = 500;

    class PatchedCommentIcon extends Existing {
        constructor(sourceBlock) {
            super(sourceBlock);
            try {
                this.__smalrubyCollapseLock = false;
                this.__smalrubyPostLoadUntil = 0;
                if (!pendingApply) return;
                const apply = pendingApply.get(sourceBlock && sourceBlock.id);
                if (!apply) return;
                this.__smalrubyCollapseLock = !!apply.collapsed;
                this.__smalrubyPostLoadUntil = Date.now() + POST_LOAD_SUPPRESS_MS;
                const bubble = typeof this.getBubble === 'function' ? this.getBubble() : null;
                if (!bubble) return;
                if (apply.collapsed && typeof bubble.setCollapsed === 'function') {
                    bubble.setCollapsed(true);
                }
            } catch (e) {
                // Defensive: never let a patch error break workspace deserialization.
                // eslint-disable-next-line no-console
                console.warn('[smalruby] PatchedCommentIcon apply failed:', e);
            }
        }

        // Suppress Blockly v12's automatic setBubbleVisible(true) call that
        // fires both synchronously during XML deserialization and again from
        // a deferred render-management callback (the same setTimeout(1) path
        // mentioned above). Without this override the bubble would re-expand
        // the moment the user lands on the Code tab. The user-initiated
        // expand path goes through the bubble's chevron → `bubble.setCollapsed(false)`
        // — it does NOT route through setBubbleVisible — so users can still
        // click to expand normally.
        setBubbleVisible(visible) {
            if (visible && this.__smalrubyCollapseLock) {
                return Promise.resolve();
            }
            return super.setBubbleVisible(visible);
        }

        // See POST_LOAD_SUPPRESS_MS comment above. Block the deferred
        // setBubbleLocation that Blockly v12 fires from the XML deserializer
        // (which would re-position our @ruby:* bubbles to the converter's
        // default (0, 0) workspace coordinate, stacking them on top of each
        // other). After the suppression window closes the call is forwarded
        // normally, so user drags still work.
        setBubbleLocation(coord) {
            if (
                this.__smalrubyCollapseLock &&
                this.__smalrubyPostLoadUntil &&
                Date.now() < this.__smalrubyPostLoadUntil
            ) {
                return;
            }
            return super.setBubbleLocation(coord);
        }

        // Re-fire `block_comment_change` after `block_comment_create` so the
        // VM sees the latest text *after* it has registered the comment.
        //
        // ScratchBlockPaster.paste deserializes the block via super.paste(),
        // which restores the bubble text via loadState → setText → fires
        // `block_comment_change` (oldText='', newText=current). At that
        // moment the comment does not yet exist in `target.comments`, so
        // VM's change handler logs a warning and discards it. Then
        // fireCreateEvent fires `block_comment_create` whose payload does
        // NOT carry text (upstream limitation), so the VM creates the
        // comment with text=''.
        //
        // To bridge the gap, this override re-fires the change event with
        // the current bubble text *immediately after* the create event.
        // The VM's create handler runs first, registers the comment, and
        // the subsequent change event then sets the text correctly.
        fireCreateEvent() {
            const result = super.fireCreateEvent();
            try {
                const bubble = typeof this.getBubble === 'function' ? this.getBubble() : null;
                if (!bubble) return result;
                const text =
                    typeof this.getText === 'function'
                        ? this.getText()
                        : typeof bubble.getText === 'function'
                          ? bubble.getText()
                          : '';
                if (!text) return result;
                const Events = ScratchBlocks.Events;
                if (!Events || typeof Events.fire !== 'function' || typeof Events.get !== 'function') {
                    return result;
                }
                const ChangeEvent = Events.get('block_comment_change');
                if (!ChangeEvent) return result;
                Events.fire(new ChangeEvent(bubble, '', text));
            } catch (e) {
                // eslint-disable-next-line no-console
                console.warn('[smalruby] PatchedCommentIcon.fireCreateEvent text refire failed:', e);
            }
            return result;
        }
    }
    PatchedCommentIcon.__smalrubyCommentIconPatched = true;

    ScratchBlocks.registry.unregister(Type.ICON, commentKey);
    ScratchBlocks.registry.register(Type.ICON, commentKey, PatchedCommentIcon, true);
};
