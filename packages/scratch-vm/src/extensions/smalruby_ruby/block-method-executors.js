/**
 * Executors for block-accepting methods (C-shape blocks).
 * Each class (Array, Number, etc.) has its own executor function.
 */

/**
 * Set block params on the current thread for blockParam REPORTER.
 * @param {object} util - Block utility.
 * @param {string} key - Parameter key (e.g., '_1').
 * @param {*} value - The value to set.
 */
const setBlockParam = (util, key, value) => {
    if (!util.thread._smalrubyBlockParams) {
        util.thread._smalrubyBlockParams = {};
    }
    util.thread._smalrubyBlockParams[key] = value;
};

/**
 * Look up a list variable by id+name (defensive — id is authoritative,
 * name is used as a fallback).
 * @param {object} target - VM target.
 * @param {string} id - List id.
 * @param {string} name - List name.
 * @returns {?object} List variable or null.
 */
const lookupList = (target, id, name) => {
    if (!target || !target.lookupOrCreateList) return null;
    return target.lookupOrCreateList(id, name);
};

/**
 * Read the source RECEIVER input block of the currently executing block.
 * Returns null if the call site is not the standard primitive flow (e.g.
 * unit tests that invoke the executor directly without a thread).
 * @param {object} util - Block utility.
 * @returns {?object} Receiver block or null.
 */
const peekReceiverBlock = (util) => {
    const target = util.target;
    if (!util.thread || typeof util.thread.peekStack !== 'function') return null;
    if (!target || !target.blocks || typeof target.blocks.getBlock !== 'function') return null;
    const blockId = util.thread.peekStack();
    if (!blockId) return null;
    const block = target.blocks.getBlock(blockId);
    if (!block || !block.inputs || !block.inputs.RECEIVER) return null;
    return target.blocks.getBlock(block.inputs.RECEIVER.block) || null;
};

/**
 * Read the comment text attached to the currently executing block.
 * Returns '' if absent.
 * @param {object} util - Block utility.
 * @returns {string} Comment text.
 */
const peekBlockCommentText = (util) => {
    const target = util.target;
    if (!util.thread || typeof util.thread.peekStack !== 'function') return '';
    if (!target || !target.blocks || typeof target.blocks.getBlock !== 'function') return '';
    const blockId = util.thread.peekStack();
    if (!blockId) return '';
    const block = target.blocks.getBlock(blockId);
    if (!block || !block.comment || !target.comments) return '';
    const comment = target.comments[block.comment];
    return (comment && comment.text) || '';
};

/**
 * Resolve the items to iterate for Array#each.
 *
 * Strategy (in order):
 * 1. Read the source RECEIVER block (data_listcontents) and use its LIST
 *    field. Survives Blockly XML round-trip because LIST is a standard
 *    Scratch field on data_listcontents.
 * 2. Fall back to args.LIST_ID/LIST_NAME (used by unit tests that bypass
 *    the block container).
 * 3. Final fallback: space-split args.RECEIVER. Lossy but preserves
 *    behavior for receivers that aren't lists.
 * @param {object} args - Block arguments.
 * @param {object} util - Block utility.
 * @returns {Array} Snapshot of items to iterate.
 */
const resolveArrayItems = (args, util) => {
    const target = util.target;

    const receiverBlock = peekReceiverBlock(util);
    if (
        receiverBlock &&
        receiverBlock.opcode === 'data_listcontents' &&
        receiverBlock.fields &&
        receiverBlock.fields.LIST
    ) {
        const listField = receiverBlock.fields.LIST;
        const list = lookupList(target, listField.id, listField.value);
        if (list && list.value) return list.value.slice();
    }

    if (args.LIST_ID) {
        const list = lookupList(target, args.LIST_ID, args.LIST_NAME);
        if (list && list.value) return list.value.slice();
    }

    const recv = String(args.RECEIVER || '');
    return recv === '' ? [] : recv.split(' ');
};

/**
 * Execute an array method with block (C-shape).
 * @param {object} args - Block arguments (RECEIVER, METHOD, optional LIST_ID/LIST_NAME).
 * @param {object} util - Block utility.
 * @param {Function} setReturnValue - Callback to store the return value.
 */
const executeArrayMethodWithBlock = (args, util, setReturnValue) => {
    const method = args.METHOD;

    switch (method) {
        case 'each': {
            // Snapshot items on the first invocation so mutation during the
            // loop body (e.g. push from inside the block) doesn't extend it,
            // matching Ruby Array#each semantics.
            if (typeof util.stackFrame.items === 'undefined') {
                util.stackFrame.items = resolveArrayItems(args, util);
                util.stackFrame.index = 0;
            }
            const items = util.stackFrame.items;
            if (util.stackFrame.index < items.length) {
                const value = items[util.stackFrame.index];
                setReturnValue(util, value);
                setBlockParam(util, '_1', value);
                util.stackFrame.index++;
                util.startBranch(1, true);
            }
            break;
        }
        default:
            break;
    }
};

/**
 * Parse `@ruby:list_ref:<key>:<id>:<name>` directives from a comment text
 * into a map keyed by the directive name.
 * @param {string} commentText - Block's comment text.
 * @returns {Object<string, {id: string, name: string}>} Parsed list refs.
 */
const parseListRefsFromComment = (commentText) => {
    const refs = {};
    if (!commentText) return refs;
    // Format: @ruby:list_ref:<KEY>:<id>:<name>
    // <id> contains arbitrary chars including colons; we split on the last
    // colon by anchoring the prefix and capturing the remainder.
    const re = /@ruby:list_ref:([A-Z_]+):([^\n]+)/g;
    let m;
    while ((m = re.exec(commentText)) !== null) {
        const key = m[1];
        const rest = m[2];
        // rest is "<id>:<name>". Names cannot contain newlines but may contain
        // colons in theory; ids are random short strings without ":\n". We split
        // on the LAST ":" to allow colons in name (defensive).
        const idx = rest.indexOf(':');
        if (idx < 0) continue;
        const id = rest.slice(0, idx);
        const name = rest.slice(idx + 1);
        refs[key] = { id, name };
    }
    return refs;
};

/**
 * Resolve key/value lists for Hash#each.
 *
 * Strategy (in order):
 * 1. Read `@ruby:list_ref:KEYS:<id>:<name>` and `:VALUES:` directives from
 *    the executing block's comment. Comments are preserved through Blockly
 *    XML round-trip.
 * 2. Fall back to args.KEYS_LIST_ID etc. (used by unit tests).
 * @param {object} args - Block arguments.
 * @param {object} util - Block utility.
 * @returns {{keys: Array, values: Array}} Snapshot of key/value lists.
 */
const resolveHashEntries = (args, util) => {
    const target = util.target;

    const refs = parseListRefsFromComment(peekBlockCommentText(util));
    if (refs.KEYS && refs.VALUES) {
        const keysList = lookupList(target, refs.KEYS.id, refs.KEYS.name);
        const valuesList = lookupList(target, refs.VALUES.id, refs.VALUES.name);
        return {
            keys: keysList && keysList.value ? keysList.value.slice() : [],
            values: valuesList && valuesList.value ? valuesList.value.slice() : [],
        };
    }

    if (args.KEYS_LIST_ID && args.VALUES_LIST_ID) {
        const keysList = lookupList(target, args.KEYS_LIST_ID, args.KEYS_LIST_NAME);
        const valuesList = lookupList(target, args.VALUES_LIST_ID, args.VALUES_LIST_NAME);
        return {
            keys: keysList && keysList.value ? keysList.value.slice() : [],
            values: valuesList && valuesList.value ? valuesList.value.slice() : [],
        };
    }

    return { keys: [], values: [] };
};

/**
 * Execute a hash method with block (C-shape). Currently supports `each` only,
 * iterating key/value pairs in parallel from the hash's keys and values lists.
 * Block params are set as `_1` = key, `_2` = value.
 * @param {object} args - Block arguments (METHOD, optional KEYS_LIST_* / VALUES_LIST_*).
 * @param {object} util - Block utility.
 * @param {Function} setReturnValue - Callback to store the return value.
 */
const executeHashMethodWithBlock = (args, util, setReturnValue) => {
    const method = args.METHOD;

    switch (method) {
        case 'each': {
            if (typeof util.stackFrame.entries === 'undefined') {
                const entries = resolveHashEntries(args, util);
                util.stackFrame.entries = {
                    keys: entries.keys,
                    values: entries.values,
                    length: Math.min(entries.keys.length, entries.values.length),
                };
                util.stackFrame.index = 0;
            }
            const { keys, values, length } = util.stackFrame.entries;
            if (util.stackFrame.index < length) {
                const k = keys[util.stackFrame.index];
                const v = values[util.stackFrame.index];
                setReturnValue(util, v);
                setBlockParam(util, '_1', k);
                setBlockParam(util, '_2', v);
                util.stackFrame.index++;
                util.startBranch(1, true);
            }
            break;
        }
        default:
            break;
    }
};

/**
 * Execute a number method with block (C-shape).
 * @param {object} args - Block arguments (RECEIVER, METHOD).
 * @param {object} util - Block utility.
 * @param {Function} setReturnValue - Callback to store the return value.
 */
const executeNumberMethodWithBlock = (args, util, setReturnValue) => {
    const method = args.METHOD;

    switch (method) {
        case 'times': {
            const times = Math.round(Number(args.RECEIVER) || 0);
            if (typeof util.stackFrame.index === 'undefined') {
                util.stackFrame.index = 0;
            }
            if (util.stackFrame.index < times) {
                const value = util.stackFrame.index;
                setReturnValue(util, value);
                setBlockParam(util, '_1', value);
                util.stackFrame.index++;
                util.startBranch(1, true);
            }
            break;
        }
        default:
            break;
    }
};

module.exports = {
    executeArrayMethodWithBlock,
    executeHashMethodWithBlock,
    executeNumberMethodWithBlock,
};
