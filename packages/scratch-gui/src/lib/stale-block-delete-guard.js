/**
 * Guard against stale `delete` events reaching the VM (issue #710).
 *
 * Blockly v12 (scratch-blocks v2) delivers workspace events to listeners
 * asynchronously, about one animation frame after they are created
 * (FIRE_QUEUE). When the workspace is reloaded from VM XML
 * (`clearWorkspaceAndLoadFromXml` in blocks.jsx `onWorkspaceUpdate`) while a
 * `delete` event is still queued, the event is delivered AFTER the reload and
 * applied to the VM against the freshly re-rendered state. Because
 * `Blocks.deleteBlock` recursively deletes the `next` chain and inputs,
 * a single stale delete of a top block silently wipes the whole script from
 * the VM while the workspace still shows it — the blocks then vanish on the
 * next tab switch.
 *
 * Invariant used here: a genuine deletion always disposes the block from the
 * workspace BEFORE the event is delivered, so `getBlockById` returns null by
 * the time the listener runs. If the block still exists in the workspace,
 * the only way that can happen is that the workspace was reloaded in between
 * — i.e. the event is stale. Dropping it keeps the VM consistent with what
 * the user sees (the block stays), which is the data-preserving outcome.
 *
 * Note this divergence from upstream exists because upstream's historic
 * listener detach/re-attach pattern only worked with scratch-blocks v1's
 * synchronous event dispatch; with v2 both we and upstream share this race.
 * @param {object} workspace - Blockly workspace to check rendered blocks on.
 * @param {Function} blockListener - The VM's blockListener to wrap.
 * @returns {Function} A listener that forwards everything except stale
 *     `delete` events.
 */
export const createStaleBlockDeleteGuard = (workspace, blockListener) => (e) => {
    if (e && e.type === 'delete' && typeof e.blockId === 'string' && workspace.getBlockById(e.blockId)) {
        // Stale delete: the block was re-rendered by a workspace reload
        // after this event was queued. Applying it to the VM would lose
        // the script while it is still visible.
        // eslint-disable-next-line no-console
        console.warn(
            `Dropping stale block delete event for "${e.blockId}" — ` +
                'the block was re-rendered by a workspace reload (issue #710)',
        );
        return;
    }
    blockListener(e);
};
