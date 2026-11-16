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
 * @param {number|string} defaultValue - The value of the shadow when the argument is a block.
 * @param {string} [shadow] - The opcode of the shadow (`math_number`, `math_angle`, ...).
 * @returns {object} The argument of a row.
 */
const numberArg = (input, defaultValue, shadow = 'math_number') => ({ kind: 'number', input, defaultValue, shadow });

/**
 * A string (or a value block) put into an input with a text shadow (`ask("name?")`).
 * @param {string} input - The name of the input (`QUESTION`).
 * @param {string} defaultValue - The value of the shadow when the argument is a block.
 * @returns {object} The argument of a row.
 */
const textArg = (input, defaultValue) => ({ kind: 'text', input, defaultValue });

/**
 * A string put into a menu block of an input (`go_to("Abby")` → `motion_goto_menu`).
 * @param {string} input - The name of the input (`TOWARDS`).
 * @param {string} menuOpcode - The opcode of the menu block.
 * @param {string} [field] - The field of the menu block (the name of the input by default).
 * @param {object} [options] - Options.
 * @param {?Function} [options.validate] - `(converter, arg, params)`, called before the block is
 *     made; it throws an error of conversion for a value that is not right (a costume that the
 *     sprite does not have, ...).
 * @returns {object} The argument of a row.
 */
const menuArg = (input, menuOpcode, field = input, { validate = null } = {}) => ({
    kind: 'menu',
    input,
    menuOpcode,
    field,
    validate,
});

/**
 * A string (optionally one of some choices) or a value block put into an input whose shadow is a
 * menu block (`touching?("_edge_")`, `play(sound_name)`).
 * @param {string} input - The name of the input (`TOUCHINGOBJECTMENU`).
 * @param {string} menuOpcode - The opcode of the menu block.
 * @param {string} field - The field of the menu block.
 * @param {string} defaultValue - The value of the menu shadow when the argument is a block.
 * @param {object} [options] - Options.
 * @param {?Array<string>} [options.choices] - The strings that the menu takes, or null for any.
 * @param {?Function} [options.validate] - As of `menuArg`.
 * @param {boolean} [options.anyBlock] - Takes any block, not only a value block.
 * @returns {object} The argument of a row.
 */
const menuInputArg = (
    input,
    menuOpcode,
    field,
    defaultValue,
    { choices = null, validate = null, anyBlock = false } = {},
) => ({
    kind: 'menuInput',
    input,
    menuOpcode,
    field,
    defaultValue,
    choices,
    validate,
    anyBlock,
});

/**
 * A color string (or a value block) put into a color input (`touching_color?("#ff0000")`).
 * @param {string} input - The name of the input (`COLOR`).
 * @param {string} defaultValue - The color of the shadow when the argument is a block.
 * @returns {object} The argument of a row.
 */
const colorArg = (input, defaultValue) => ({ kind: 'color', input, defaultValue });

/**
 * A string put into a field of the block, optionally one of some choices.
 * @param {string} field - The name of the field (`STYLE`).
 * @param {?Array<string>} [choices] - The strings that the field takes, or null for any string.
 * @param {object} [options] - Options.
 * @param {?Function} [options.normalize] - Makes the value of the field from the string
 *     (`'color'` → `'COLOR'`); the choices are of the made values.
 * @returns {object} The argument of a row.
 */
const fieldArg = (field, choices = null, { normalize = null } = {}) => ({ kind: 'field', field, choices, normalize });

/**
 * The value of a field argument: the string, normalized if the row says so.
 * @param {object} spec - The argument of the row.
 * @param {*} arg - The argument of the call.
 * @returns {string} The value.
 */
const fieldValueOf = (spec, arg) => (spec.normalize ? spec.normalize(arg.toString()) : arg.toString());

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
        case 'text':
            return converter._isStringOrBlock(arg);
        case 'menu':
            return converter._isString(arg);
        case 'menuInput':
            if (spec.anyBlock ? converter._isBlock(arg) : converter._isValueBlock(arg)) return true;
            return converter._isString(arg) && (!spec.choices || spec.choices.indexOf(arg.toString()) >= 0);
        case 'color':
            return converter._isColorOrBlock(arg);
        case 'field':
            return converter._isString(arg) && (!spec.choices || spec.choices.indexOf(fieldValueOf(spec, arg)) >= 0);
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
        case 'text':
            converter._addTextInput(block, spec.input, arg, spec.defaultValue);
            break;
        case 'menu':
            converter._addInput(block, spec.input, converter._createFieldBlock(spec.menuOpcode, spec.field, arg));
            break;
        case 'menuInput':
            converter._addFieldInput(block, spec.input, spec.menuOpcode, spec.field, arg, spec.defaultValue);
            break;
        case 'color':
            converter._addColorFieldInput(block, spec.input, arg, spec.defaultValue);
            break;
        case 'field':
            converter._addField(block, spec.field, fieldValueOf(spec, arg));
            break;
        default:
            throw new Error(`unknown kind of argument: ${spec.kind}`);
    }
};

/**
 * The handler of one row: null when an argument is not of the kind of the row, so that the next
 * handler of the same method can try (the same contract as a handler of `registerOnSend`).
 *
 * A row with `selfReceiver: true` takes only `self.xxx` or `xxx`, not a receiver that is
 * resolved to the same name (`stage.backdrop_name` is of sensing, not of looks).
 * The receiver (`"abc".length`) is put first without a check (the receiver of the row, such
 * as `['string', 'block', 'variable']`, already says what it takes), then the constant fields
 * (`fields: {NAME: value}`) and menus (`menus: {INPUT: [menuOpcode, field, value]}`), then the
 * arguments in order. A row with `changesReceiver: true` turns its receiver, a Ruby expression
 * (`pen` of `pen.down`), into the block instead of making a new one. A hat (`hat: true`) puts the body of `do ... end` under the block.
 * @param {object} converter - The converter.
 * @param {object} row - The row.
 * @returns {Function} The handler.
 */
const handlerOfRow = (converter, row) => {
    const specs = row.args || [];
    const type = row.hat ? 'hat' : row.type || 'statement';
    const fields = row.fields ? Object.entries(row.fields) : [];
    const menus = row.menus ? Object.entries(row.menus) : [];
    return (params) => {
        const { receiver, args } = params;
        if (row.selfReceiver && !converter._isSelf(receiver) && receiver !== null) return null;
        if (!specs.every((spec, i) => acceptsArg(converter, spec, args[i]))) return null;
        specs.forEach((spec, i) => {
            if (spec.validate) spec.validate(converter, args[i], params);
        });
        const block = row.changesReceiver
            ? converter._changeRubyExpressionBlock(receiver, row.opcode, type)
            : converter._createBlock(row.opcode, type);
        if (row.receiverArg) putArg(converter, block, row.receiverArg, receiver);
        fields.forEach(([name, value]) => converter._addField(block, name, value));
        menus.forEach(([name, [menuOpcode, field, value]]) =>
            converter._addFieldInput(block, name, menuOpcode, field, value, value),
        );
        specs.forEach((spec, i) => putArg(converter, block, spec, args[i]));
        if (row.hat) converter._setParent(params.rubyBlock, block);
        return block;
    };
};

/**
 * Register the rows of a send table on the converter, in the order of the rows.
 * @param {object} converter - The converter.
 * @param {Array<object>} rows - The rows: `{receiver, name, opcode, type?, args?, fields?,
 *     menus?, receiverArg?, changesReceiver?, hat?, selfReceiver?}`. A hat takes `do ... end` (with no block parameters).
 */
/**
 * The rows, each taking only `self.xxx` or `xxx` (`selfReceiver: true`).
 * @param {Array<object>} rows - The rows.
 * @returns {Array<object>} The rows with `selfReceiver: true`.
 */
const onSelf = (rows) => rows.map((row) => ({ ...row, selfReceiver: true }));

const registerSendTable = (converter, rows) => {
    rows.forEach((row) => {
        const numArgs = (row.args || []).length;
        const handler = handlerOfRow(converter, row);
        if (row.hat) {
            converter.registerOnSendWithBlock(row.receiver, row.name, numArgs, 0, handler);
        } else {
            converter.registerOnSend(row.receiver, row.name, numArgs, handler);
        }
    });
};

export { colorArg, fieldArg, menuArg, menuInputArg, numberArg, onSelf, registerSendTable, textArg };
