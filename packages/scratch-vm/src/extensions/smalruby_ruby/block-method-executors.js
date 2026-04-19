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
 * Execute an array method with block (C-shape).
 * @param {object} args - Block arguments (RECEIVER, METHOD).
 * @param {object} util - Block utility.
 * @param {Function} setReturnValue - Callback to store the return value.
 */
const executeArrayMethodWithBlock = (args, util, setReturnValue) => {
    const method = args.METHOD;
    const toItems = (s) => (s === '' ? [] : String(s).split(' '));

    switch (method) {
        case 'each': {
            const items = toItems(String(args.RECEIVER || ''));
            if (typeof util.stackFrame.index === 'undefined') {
                util.stackFrame.index = 0;
            }
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
    executeNumberMethodWithBlock,
};
