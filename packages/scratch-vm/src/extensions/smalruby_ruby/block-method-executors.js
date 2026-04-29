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
 * Resolve the items to iterate for Array#each. Prefer the LIST referenced by
 * LIST_ID/LIST_NAME when available, since data_listcontents joins items with
 * "" (all-single-char) or " " (otherwise) — both lossy for arbitrary values.
 * Fall back to space-splitting RECEIVER for receivers that aren't lists.
 * @param {object} args - Block arguments.
 * @param {object} util - Block utility.
 * @returns {Array} Snapshot of items to iterate.
 */
const resolveArrayItems = (args, util) => {
    if (args.LIST_ID && util.target && util.target.lookupOrCreateList) {
        const list = util.target.lookupOrCreateList(args.LIST_ID, args.LIST_NAME);
        return list && list.value ? list.value.slice() : [];
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
 * Look up the keys/values lists referenced by a hash each block.
 * Hashes are stored as two parallel lists in Scratch (`<name>_keys` and
 * `<name>_values`). Both list references must be present in args.
 * @param {object} args - Block arguments.
 * @param {object} util - Block utility.
 * @returns {{keys: Array, values: Array}} Snapshot of both list contents.
 */
const resolveHashEntries = (args, util) => {
    if (
        !args.KEYS_LIST_ID ||
        !args.VALUES_LIST_ID ||
        !util.target ||
        !util.target.lookupOrCreateList
    ) {
        return { keys: [], values: [] };
    }
    const keysList = util.target.lookupOrCreateList(
        args.KEYS_LIST_ID,
        args.KEYS_LIST_NAME,
    );
    const valuesList = util.target.lookupOrCreateList(
        args.VALUES_LIST_ID,
        args.VALUES_LIST_NAME,
    );
    return {
        keys: keysList && keysList.value ? keysList.value.slice() : [],
        values: valuesList && valuesList.value ? valuesList.value.slice() : [],
    };
};

/**
 * Execute a hash method with block (C-shape). Currently supports `each` only,
 * iterating key/value pairs in parallel from the hash's keys and values lists.
 * Block params are set as `_1` = key, `_2` = value.
 * @param {object} args - Block arguments (METHOD, KEYS_LIST_ID/NAME, VALUES_LIST_ID/NAME).
 * @param {object} util - Block utility.
 * @param {Function} setReturnValue - Callback to store the return value.
 */
const executeHashMethodWithBlock = (args, util, setReturnValue) => {
    const method = args.METHOD;

    switch (method) {
        case 'each': {
            if (typeof util.stackFrame.entries === 'undefined') {
                const entries = resolveHashEntries(args, util);
                // Iterate up to the shorter list to avoid undefined values
                // when the two lists are inconsistent.
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
