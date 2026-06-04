import { createStaleBlockDeleteGuard } from '../../../src/lib/stale-block-delete-guard';

// Issue #710: Blockly v12 (scratch-blocks v2) delivers workspace events to
// vm.blockListener asynchronously (~1 frame later via FIRE_QUEUE). When the
// workspace is reloaded from VM XML (clearWorkspaceAndLoadFromXml) before a
// queued `delete` event is delivered, the stale delete is applied to the VM
// even though the block was just re-rendered — deleting a top block this way
// wipes the whole script from the VM while the workspace still shows it.
//
// The guard drops `delete` events whose block still exists in the rendered
// workspace: a genuine delete always disposes the block from the workspace
// BEFORE the event is delivered, so "block still rendered" can only mean the
// workspace was reloaded in between (= the event is stale).
describe('createStaleBlockDeleteGuard', () => {
    let workspaceBlocks;
    let workspace;
    let received;
    let listener;
    let guarded;

    beforeEach(() => {
        workspaceBlocks = {};
        workspace = {
            getBlockById: (id) => workspaceBlocks[id] || null,
        };
        received = [];
        listener = (e) => {
            received.push(e);
        };
        guarded = createStaleBlockDeleteGuard(workspace, listener);
    });

    test('should pass through non-delete block events', () => {
        const events = [
            { type: 'create', blockId: 'a' },
            { type: 'move', blockId: 'a' },
            { type: 'change', blockId: 'a' },
        ];
        workspaceBlocks.a = {}; // block exists — must not matter for these
        events.forEach(guarded);
        expect(received).toEqual(events);
    });

    test('should pass through events without blockId (e.g. var/comment events)', () => {
        const events = [
            { type: 'var_create', varId: 'v1' },
            { type: 'delete', varId: 'v1' },
        ];
        events.forEach(guarded);
        expect(received).toEqual(events);
    });

    test('should pass through delete events when the block is gone from the workspace', () => {
        // Genuine deletion: Blockly disposed the block before delivering
        // the event, so getBlockById returns null.
        const e = { type: 'delete', blockId: 'top1' };
        guarded(e);
        expect(received).toEqual([e]);
    });

    test('should drop delete events when the block still exists in the workspace', () => {
        // Stale deletion: the workspace was reloaded from the VM after the
        // delete was queued, so the block is rendered again. Applying the
        // delete to the VM would desync it from the view and lose data.
        workspaceBlocks.top1 = { id: 'top1' };
        guarded({ type: 'delete', blockId: 'top1' });
        expect(received).toEqual([]);
    });

    test('should keep passing subsequent events after dropping a stale delete', () => {
        workspaceBlocks.top1 = { id: 'top1' };
        guarded({ type: 'delete', blockId: 'top1' });
        const create = { type: 'create', blockId: 'b' };
        guarded(create);
        expect(received).toEqual([create]);
    });
});
