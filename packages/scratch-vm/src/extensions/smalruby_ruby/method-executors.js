const Variable = require('../../engine/variable');

/**
 * Execute a string method block.
 * @param {object} args - Block arguments.
 * @param {object} util - Block utility (has util.target, util.thread).
 * @param {Function} setReturnValue - Callback to store the return value.
 */
const executeStringMethod = (args, util, setReturnValue) => {
    const method = args.METHOD;
    const arg1 = args.ARG1;
    const arg2 = args.ARG2;
    let result;

    if (method.endsWith('!')) {
        // Bang method: receiver is variable name
        const variableName = args.RECEIVER;
        const target = util.target;
        const variable = target.lookupVariableByNameAndType(
            variableName,
            Variable.SCALAR_TYPE,
        );
        if (!variable) {
            setReturnValue(util, '');
            return;
        }
        const string = String(variable.value || '');
        switch (method) {
            case 'reverse!':
                result = string.split('').reverse().join('');
                break;
            case 'delete!':
                result = string
                    .split('')
                    .filter((c) => !String(arg1 || '').includes(c))
                    .join('');
                break;
            case 'gsub!':
                result =
                    arg2 === undefined
                        ? string
                        : string.replaceAll(String(arg1 || ''), String(arg2));
                break;
            default:
                result = string;
        }
        variable.value = result;
    } else {
        // Non-bang method: receiver is value
        const string = String(args.RECEIVER || '');
        switch (method) {
            case 'reverse':
                result = string.split('').reverse().join('');
                break;
            case 'upcase':
                result = string.toUpperCase();
                break;
            case 'downcase':
                result = string.toLowerCase();
                break;
            case 'empty?':
                result = string === '';
                break;
            case 'lines':
                result = string
                    .split('\n')
                    .filter((_, i, a) => i < a.length - 1 || _ !== '')
                    .map((l) => `${l}\n`)
                    .join(' ');
                break;
            case 'delete':
                result = string
                    .split('')
                    .filter((c) => !String(arg1 || '').includes(c))
                    .join('');
                break;
            case 'gsub':
                result =
                    arg2 === undefined
                        ? string
                        : string.replaceAll(String(arg1 || ''), String(arg2));
                break;
            case '*':
                result = string.repeat(Math.max(0, Math.floor(Number(arg1) || 0)));
                break;
            default:
                result = string;
        }
    }
    setReturnValue(util, result);
};

/**
 * Execute an array method block.
 * @param {object} args - Block arguments.
 * @param {object} util - Block utility.
 * @param {Function} setReturnValue - Callback to store the return value.
 */
const executeArrayMethod = (args, util, setReturnValue) => {
    const method = args.METHOD;
    const arg1 = args.ARG1;

    // Parse list contents (space-separated from data_listcontents)
    const toItems = (s) => (s === '' ? [] : String(s).split(' '));

    if (method.endsWith('!')) {
        // Bang method: receiver is variable name, modify list in place
        const variableName = args.RECEIVER;
        const target = util.target;
        const listVar = target.lookupVariableByNameAndType(
            variableName,
            Variable.LIST_TYPE,
        );
        if (!listVar) {
            setReturnValue(util, '');
            return;
        }
        const items = listVar.value;
        let result;
        switch (method) {
            case 'sort!': {
                const nums = items.map(Number);
                if (nums.every((n) => !isNaN(n))) {
                    items.sort((a, b) => Number(a) - Number(b));
                } else {
                    items.sort();
                }
                result = items.join(' ');
                break;
            }
            case 'reverse!':
                items.reverse();
                result = items.join(' ');
                break;
            default:
                result = items.join(' ');
        }
        setReturnValue(util, result);
    } else {
        // Non-bang method: receiver is list contents string
        const string = String(args.RECEIVER || '');
        const items = toItems(string);
        let result;
        switch (method) {
            case 'max': {
                if (items.length === 0) {
                    result = '';
                    break;
                }
                const nums = items.map(Number);
                result = nums.every((n) => !isNaN(n))
                    ? String(Math.max(...nums))
                    : items.reduce((a, b) => (a > b ? a : b));
                break;
            }
            case 'min': {
                if (items.length === 0) {
                    result = '';
                    break;
                }
                const nums = items.map(Number);
                result = nums.every((n) => !isNaN(n))
                    ? String(Math.min(...nums))
                    : items.reduce((a, b) => (a < b ? a : b));
                break;
            }
            case 'sort': {
                const nums = items.map(Number);
                result = nums.every((n) => !isNaN(n))
                    ? nums.sort((a, b) => a - b).join(' ')
                    : items.sort().join(' ');
                break;
            }
            case 'reverse':
                result = items.slice().reverse().join(' ');
                break;
            case 'first':
                result = items.length > 0 ? items[0] : '';
                break;
            case 'last':
                result = items.length > 0 ? items[items.length - 1] : '';
                break;
            case 'empty?':
                result = items.length === 0;
                break;
            case 'join':
                result = items.join(
                    arg1 === undefined ? '' : String(arg1),
                );
                break;
            default:
                result = string;
        }
        setReturnValue(util, result);
    }
};

/**
 * Execute a hash method block.
 * @param {object} args - Block arguments.
 * @param {object} util - Block utility.
 * @param {Function} setReturnValue - Callback to store the return value.
 */
const executeHashMethod = (args, util, setReturnValue) => {
    const method = args.METHOD;
    const string = String(args.RECEIVER || '');
    let result;
    switch (method) {
        case 'keys':
        case 'values':
            // Receiver is list contents from the keys/values sub-list
            result = string;
            break;
        case 'empty?':
            result = string === '';
            break;
        default:
            result = string;
    }
    setReturnValue(util, result);
};

module.exports = {
    executeStringMethod,
    executeArrayMethod,
    executeHashMethod,
};
