// === Smalruby: This file is Smalruby-specific (translate Blockly v12 block_comment_* events to v1 comment_* events for VM compatibility) ===

/**
 * Blockly v12 renamed and reshaped the comment events. The Scratch VM's
 * `Blocks.blocklyListen` switch still expects the v1 names and payloads:
 *   comment_create / comment_change / comment_move / comment_delete
 * Without this translator the VM never registers a comment for blocks that
 * gain a comment via copy/paste (right-click → 複製) or any other path that
 * doesn't go through our Ruby converter — so `target.comments` lacks the
 * entry, the block looks fine in the Code tab but the Ruby generator falls
 * back to the default opcode mapping (e.g. `say(...)` instead of `puts(...)`).
 *
 * Install once at workspace creation time. This wraps `vm.blockListener`,
 * `vm.flyoutBlockListener`, etc. to intercept the v12 events and re-fire
 * v1-shaped equivalents that the VM understands.
 *
 * Survives minification because:
 * - All v12 event type strings (`block_comment_*`) are stable string keys.
 * - All bubble/icon methods called here (`getBubble`, `getText`,
 *   `isCollapsed`, `getRelativeToSurfaceXY`, `getIcon`) are public APIs
 *   that scratch-blocks already preserves under terser.
 */

/**
 * Look up the live ScratchCommentBubble for an event so we can fetch text
 * and collapsed state that v12's create event doesn't carry.
 * @param {object} ScratchBlocks - the scratch-blocks module
 * @param {object} e - a v12 block_comment_* event
 * @returns {?object} {text, collapsed, x, y, width, height} or null when missing
 */
const lookupBubbleState = function (ScratchBlocks, e) {
    if (!e || !e.workspaceId || !e.blockId) return null;
    let workspace;
    try {
        workspace = ScratchBlocks.Workspace.getById(e.workspaceId);
    } catch (_err) {
        return null;
    }
    if (!workspace) return null;
    const block = typeof workspace.getBlockById === 'function' ? workspace.getBlockById(e.blockId) : null;
    if (!block || typeof block.getIcon !== 'function') return null;
    const IconType = ScratchBlocks.icons && ScratchBlocks.icons.IconType;
    if (!IconType || !IconType.COMMENT) return null;
    const icon = block.getIcon(IconType.COMMENT);
    if (!icon || typeof icon.getBubble !== 'function') return null;
    const bubble = icon.getBubble();
    if (!bubble) return null;
    const text =
        typeof icon.getText === 'function'
            ? icon.getText()
            : typeof bubble.getText === 'function'
              ? bubble.getText()
              : '';
    const collapsed = typeof bubble.isCollapsed === 'function' ? bubble.isCollapsed() : false;
    const xy = typeof bubble.getRelativeToSurfaceXY === 'function' ? bubble.getRelativeToSurfaceXY() : { x: 0, y: 0 };
    const size = typeof bubble.getSize === 'function' ? bubble.getSize() : { width: 200, height: 200 };
    return { text, collapsed, x: xy.x, y: xy.y, width: size.width, height: size.height };
};

/**
 * Translate a single v12 `block_comment_*` event into a v1-shaped event the
 * VM understands. Returns the translated event or null if no translation
 * is needed (the original event is passed through).
 * @param {object} ScratchBlocks - the scratch-blocks module
 * @param {object} e - any Blockly event
 * @returns {?object} translated event or null
 */
const translateCommentEvent = function (ScratchBlocks, e) {
    if (!e || typeof e.type !== 'string') return null;
    switch (e.type) {
        case 'block_comment_create': {
            const state = lookupBubbleState(ScratchBlocks, e) || {};
            const x = e.json && Number.isFinite(e.json.x) ? e.json.x : state.x;
            const y = e.json && Number.isFinite(e.json.y) ? e.json.y : state.y;
            const width = e.json && Number.isFinite(e.json.width) ? e.json.width : state.width;
            const height = e.json && Number.isFinite(e.json.height) ? e.json.height : state.height;
            return {
                type: 'comment_create',
                commentId: e.commentId,
                blockId: e.blockId,
                text: state.text || '',
                xy: { x: x || 0, y: y || 0 },
                width: width || 200,
                height: height || 200,
                minimized: !!state.collapsed,
            };
        }
        case 'block_comment_change': {
            return {
                type: 'comment_change',
                commentId: e.commentId,
                blockId: e.blockId,
                newContents_: { text: e.newContents_ },
            };
        }
        case 'block_comment_collapse': {
            return {
                type: 'comment_change',
                commentId: e.commentId,
                blockId: e.blockId,
                newContents_: { minimized: !!e.newCollapsed },
            };
        }
        case 'block_comment_resize': {
            const newSize = e.newSize || {};
            return {
                type: 'comment_change',
                commentId: e.commentId,
                blockId: e.blockId,
                newContents_: { width: newSize.width, height: newSize.height },
            };
        }
        case 'block_comment_move': {
            return {
                type: 'comment_move',
                commentId: e.commentId,
                blockId: e.blockId,
                oldCoordinate_: e.oldCoordinate_,
                newCoordinate_: e.newCoordinate_,
            };
        }
        case 'block_comment_delete': {
            return {
                type: 'comment_delete',
                commentId: e.commentId,
                blockId: e.blockId,
            };
        }
        default:
            return null;
    }
};

/**
 * Wrap a single VM listener function (e.g. vm.blockListener) so that any
 * v12 block_comment_* event is translated into the v1 comment_* shape
 * before the VM listener sees it. The original (untranslated) event is
 * passed through too — Blockly's own undo/redo machinery may rely on
 * seeing the raw event in subsequent listeners, but since the VM
 * listener's switch silently ignores unknown types, this is harmless.
 * @param {Function} originalListener - the listener to wrap
 * @param {object} ScratchBlocks - the scratch-blocks module
 * @returns {Function} a wrapped listener function
 */
const wrapListener = function (originalListener, ScratchBlocks) {
    if (!originalListener || originalListener.__smalrubyCommentEventTranslated) {
        return originalListener;
    }
    const wrapped = (e) => {
        const translated = translateCommentEvent(ScratchBlocks, e);
        if (translated) {
            originalListener(translated);
            return;
        }
        return originalListener(e);
    };
    wrapped.__smalrubyCommentEventTranslated = true;
    return wrapped;
};

/**
 * Install the comment event translator on a VM instance. Idempotent.
 * Wraps the VM's three workspace change listener methods.
 * @param {object} vm - the VM instance
 * @param {object} ScratchBlocks - the scratch-blocks module
 */
export const installCommentEventTranslator = function (vm, ScratchBlocks) {
    if (!vm || !ScratchBlocks) return;
    if (vm.__smalrubyCommentEventTranslatorInstalled) return;
    vm.blockListener = wrapListener(vm.blockListener.bind(vm), ScratchBlocks);
    if (typeof vm.flyoutBlockListener === 'function') {
        vm.flyoutBlockListener = wrapListener(vm.flyoutBlockListener.bind(vm), ScratchBlocks);
    }
    if (typeof vm.monitorBlockListener === 'function') {
        vm.monitorBlockListener = wrapListener(vm.monitorBlockListener.bind(vm), ScratchBlocks);
    }
    vm.__smalrubyCommentEventTranslatorInstalled = true;
};
