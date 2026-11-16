/**
 * Method calls that map one to one onto a block, written as data (a "send table").
 *
 * Most `registerOnSend` handlers do the same four steps: check the kind of each argument, make
 * the block, put each argument into an input or a field, return the block. A row of the table
 * says only what differs (the method, the opcode, the arguments), and `registerSendTable` makes
 * the handler. A call that the table cannot say (an array of `[x, y]`, a keyword argument, a
 * choice of opcode by the argument) stays a handler of its own, beside the table.
 *
 * The rows are plain data, so a test can read them: for example, that every opcode of the table
 * has a generator (`docs/ruby-editor/converter-stages.md`).
 *
 * ```js
 * registerSendTable(converter, [
 *     { receiver: 'sprite', name: 'move', opcode: 'motion_movesteps', args: [numberArg('STEPS', 10)] },
 *     { receiver: 'sprite', name: 'x', opcode: 'motion_xposition', type: 'value' },
 * ]);
 * ```
 */

/**
 * A number (or a value block) put into an input with a number shadow.
 * @param {string} input - The name of the input (`STEPS`).
 * @param {number} defaultValue - The value of the shadow when the argument is a block.
 * @param {string} [shadow] - The opcode of the shadow (`math_number`, `math_angle`, ...).
 * @returns {object} The argument of a row.
 */
const numberArg = (input, defaultValue, shadow = 'math_number') => ({ kind: 'number', input, defaultValue, shadow });

/**
 * A string put into a menu block of an input (`go_to("Abby")` → `motion_goto_menu`).
 * @param {string} input - The name of the input (`TOWARDS`).
 * @param {string} menuOpcode - The opcode of the menu block.
 * @param {string} [field] - The field of the menu block (the name of the input by default).
 * @returns {object} The argument of a row.
 */
const menuArg = (input, menuOpcode, field = input) => ({ kind: 'menu', input, menuOpcode, field });

/**
 * A string put into a field of the block, optionally one of some choices.
 * @param {string} field - The name of the field (`STYLE`).
 * @param {?Array<string>} [choices] - The strings that the field takes, or null for any string.
 * @returns {object} The argument of a row.
 */
const fieldArg = (field, choices = null) => ({ kind: 'field', field, choices });

/**
 * Whether an argument of a call is of the kind that a row expects.
 * @param {object} converter - The converter.
 * @param {object} spec - The argument of the row.
 * @param {*} arg - The argument of the call.
 * @returns {boolean} true if it is.
 */
const acceptsArg = (converter, spec, arg) => {
    switch (spec.kind) {
        case 'number':
            return converter._isNumberOrBlock(arg);
        case 'menu':
            return converter._isString(arg);
        case 'field':
            return converter._isString(arg) && (!spec.choices || spec.choices.indexOf(arg.toString()) >= 0);
        default:
            throw new Error(`unknown kind of argument: ${spec.kind}`);
    }
};

/**
 * Put an argument of a call into the block, as the row says.
 * @param {object} converter - The converter.
 * @param {object} block - The block of the row.
 * @param {object} spec - The argument of the row.
 * @param {*} arg - The argument of the call.
 */
const putArg = (converter, block, spec, arg) => {
    switch (spec.kind) {
        case 'number':
            converter._addNumberInput(block, spec.input, spec.shadow, arg, spec.defaultValue);
            break;
        case 'menu':
            converter._addInput(block, spec.input, converter._createFieldBlock(spec.menuOpcode, spec.field, arg));
            break;
        case 'field':
            converter._addField(block, spec.field, arg);
            break;
    }
};

/**
 * The handler of one row: null when an argument is not of the kind of the row, so that the next
 * handler of the same method can try (the same contract as a handler of `registerOnSend`).
 * @param {object} converter - The converter.
 * @param {object} row - The row.
 * @returns {Function} The handler.
 */
const handlerOfRow = (converter, row) => {
    const specs = row.args || [];
    const type = row.type || 'statement';
    return ({ args }) => {
        if (!specs.every((spec, i) => acceptsArg(converter, spec, args[i]))) return null;
        const block = converter._createBlock(row.opcode, type);
        specs.forEach((spec, i) => putArg(converter, block, spec, args[i]));
        return block;
    };
};

/**
 * Register the rows of a send table on the converter.
 * @param {object} converter - The converter.
 * @param {Array<object>} rows - The rows: `{receiver, name, opcode, type?, args?}`.
 */
const registerSendTable = (converter, rows) => {
    rows.forEach((row) => {
        converter.registerOnSend(row.receiver, row.name, (row.args || []).length, handlerOfRow(converter, row));
    });
};

export { fieldArg, menuArg, numberArg, registerSendTable };
