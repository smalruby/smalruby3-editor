import _ from 'lodash';
import LooksValidation from './looks-validation';
import { fieldArg, menuArg, numberArg, onSelf, registerSendTable } from './send-table';

const { validateCostume, validateBackdrop, resolveSymbolArg, createBlockWithMessage } = LooksValidation;

const Effects = ['COLOR', 'FISHEYE', 'WHIRL', 'PIXELATE', 'MOSAIC', 'BRIGHTNESS', 'GHOST'];

const FrontBack = ['front', 'back'];

const ForwardBackward = ['forward', 'backward'];

const upcase = (value) => value.toUpperCase();

const costumeArg = menuArg('COSTUME', 'looks_costume', 'COSTUME', {
    validate: (converter, arg) => validateCostume(converter, arg.toString(), [arg]),
});

const backdropArg = menuArg('BACKDROP', 'looks_backdrops', 'BACKDROP', {
    validate: (converter, arg) => validateBackdrop(converter, arg.toString(), [arg]),
});

/**
 * The calls of looks that map one to one onto a block (see `send-table.js`).
 * `say` / `think` (a keyword argument `secs:`, a symbol), `print` / `puts` / `p` (any number of
 * arguments) and `self.size += 1` are handlers below. All of them take only `self.xxx` or `xxx`.
 */
const LOOKS_SENDS = onSelf([
    { receiver: 'sprite', name: 'switch_costume', opcode: 'looks_switchcostumeto', args: [costumeArg] },
    { receiver: 'sprite', name: 'costume=', opcode: 'looks_switchcostumeto', args: [costumeArg] },
    { receiver: 'sprite', name: 'next_costume', opcode: 'looks_nextcostume' },
    { receiver: 'self', name: 'switch_backdrop', opcode: 'looks_switchbackdropto', args: [backdropArg] },
    { receiver: 'self', name: 'backdrop=', opcode: 'looks_switchbackdropto', args: [backdropArg] },
    { receiver: 'self', name: 'next_backdrop', opcode: 'looks_nextbackdrop' },
    {
        receiver: 'self',
        name: 'switch_backdrop_and_wait',
        opcode: 'looks_switchbackdroptoandwait',
        args: [backdropArg],
    },
    {
        receiver: 'self',
        name: 'switch_backdrop_to_and_wait',
        opcode: 'looks_switchbackdroptoandwait',
        args: [backdropArg],
    },
    { receiver: 'sprite', name: 'size=', opcode: 'looks_setsizeto', args: [numberArg('SIZE', 100)] },
    {
        receiver: 'self',
        name: 'change_effect_by',
        opcode: 'looks_changeeffectby',
        args: [fieldArg('EFFECT', Effects, { normalize: upcase }), numberArg('CHANGE', 25)],
    },
    {
        receiver: 'self',
        name: 'set_effect',
        opcode: 'looks_seteffectto',
        args: [fieldArg('EFFECT', Effects, { normalize: upcase }), numberArg('VALUE', 25)],
    },
    { receiver: 'self', name: 'clear_graphic_effects', opcode: 'looks_cleargraphiceffects' },
    { receiver: 'sprite', name: 'show', opcode: 'looks_show' },
    { receiver: 'sprite', name: 'hide', opcode: 'looks_hide' },
    {
        receiver: 'sprite',
        name: 'go_to_layer',
        opcode: 'looks_gotofrontback',
        args: [fieldArg('FRONT_BACK', FrontBack)],
    },
    ...FrontBack.map((option) => ({
        receiver: 'sprite',
        name: `go_to_${option}`,
        opcode: 'looks_gotofrontback',
        fields: { FRONT_BACK: option },
    })),
    {
        receiver: 'sprite',
        name: 'go_layers',
        opcode: 'looks_goforwardbackwardlayers',
        args: [numberArg('NUM', 1, 'math_integer'), fieldArg('FORWARD_BACKWARD', ForwardBackward)],
    },
    ...ForwardBackward.map((option) => ({
        receiver: 'sprite',
        name: `go_${option}`,
        opcode: 'looks_goforwardbackwardlayers',
        fields: { FORWARD_BACKWARD: option },
        args: [numberArg('NUM', 1, 'math_integer')],
    })),
    {
        receiver: 'sprite',
        name: 'costume_number',
        opcode: 'looks_costumenumbername',
        type: 'value',
        fields: { NUMBER_NAME: 'number' },
    },
    {
        receiver: 'sprite',
        name: 'costume_name',
        opcode: 'looks_costumenumbername',
        type: 'value',
        fields: { NUMBER_NAME: 'name' },
    },
    { receiver: 'sprite', name: 'size', opcode: 'looks_size', type: 'value' },
    {
        receiver: 'self',
        name: 'backdrop_number',
        opcode: 'looks_backdropnumbername',
        type: 'value',
        fields: { NUMBER_NAME: 'number' },
    },
    {
        receiver: 'self',
        name: 'backdrop_name',
        opcode: 'looks_backdropnumbername',
        type: 'value',
        fields: { NUMBER_NAME: 'name' },
    },
]);

/**
 * Looks converter
 */
const LooksConverter = {
    sends: LOOKS_SENDS,

    register: function (converter) {
        // say/think with symbol argument - sprite-only
        ['say', 'think'].forEach((methodName) => {
            const opcodes1 = { say: 'looks_say', think: 'looks_think' };
            const opcodes2 = { say: 'looks_sayforsecs', think: 'looks_thinkforsecs' };
            const defaults = { say: 'Hello!', think: 'Hmm...' };

            converter.registerOnSend('sprite', methodName, [1, 2], (params) => {
                const { receiver, args } = params;
                if (!converter._isSelf(receiver) && receiver !== null) return null;
                const symbolName = resolveSymbolArg(converter, args[0]);
                const symbolVarBlock = symbolName ? null : converter._resolveSymbolVariable(args[0]);
                if (!symbolName && !symbolVarBlock) return null;

                const message = symbolName || symbolVarBlock;

                if (args.length === 1) {
                    const block = converter._createBlock(opcodes1[methodName], 'statement');
                    converter._addTextInput(block, 'MESSAGE', message, defaults[methodName]);
                    if (symbolName) {
                        block.comment = converter._createComment(`@ruby:symbol:${symbolName}`, block.id);
                    }
                    return block;
                }

                if (args.length === 2) {
                    let secs = args[1];
                    if (converter._isHash(secs) && secs.size === 1) {
                        secs = secs.get('sym:secs');
                    }
                    if (converter._isNumberOrBlock(secs)) {
                        const block = converter._createBlock(opcodes2[methodName], 'statement');
                        converter._addTextInput(block, 'MESSAGE', message, defaults[methodName]);
                        converter._addNumberInput(block, 'SECS', 'math_number', secs, 2);
                        if (symbolName) {
                            block.comment = converter._createComment(`@ruby:symbol:${symbolName}`, block.id);
                        }
                        return block;
                    }
                }
                return null;
            });
        });

        // print/puts/p with symbol arguments - sprite-only
        ['print', 'puts', 'p'].forEach((methodName) => {
            converter.registerOnSend('sprite', methodName, -1, (params) => {
                const { args } = params;
                if (args.length === 0) return null;

                const isSymbolArg = (arg) => converter._isPrimitive(arg) && arg.type === 'sym';
                const isSymbolVar = (arg) => {
                    if (!converter._isBlock(arg)) return false;
                    const v = converter.lookupVariableFromVariableBlock(arg);
                    return v && v.dataType === 'symbol';
                };

                if (!args.every((arg) => converter._isNumberOrStringOrBlock(arg) || isSymbolArg(arg))) return null;
                // Only handle if at least one symbol arg or symbol variable
                if (!args.some((arg) => isSymbolArg(arg) || isSymbolVar(arg))) return null;

                let firstBlock = null;
                let lastBlock = null;

                args.forEach((arg) => {
                    const block = converter._createBlock('looks_sayforsecs', 'statement');
                    const symbolName2 = resolveSymbolArg(converter, arg);
                    const symbolVar = symbolName2 ? null : converter._resolveSymbolVariable(arg);
                    if (symbolName2) {
                        converter._addTextInput(block, 'MESSAGE', symbolName2, 'Hello!');
                        block.comment = converter._createComment(
                            `@ruby:symbol:${symbolName2},@ruby:method:${methodName}`,
                            block.id,
                        );
                    } else if (symbolVar) {
                        converter._addTextInput(block, 'MESSAGE', symbolVar, 'Hello!');
                        block.comment = converter.createComment(`@ruby:method:${methodName}`, block.id);
                    } else {
                        converter._addTextInput(
                            block,
                            'MESSAGE',
                            converter._isNumber(arg) ? arg.toString() : arg,
                            'Hello!',
                        );
                        block.comment = converter.createComment(`@ruby:method:${methodName}`, block.id);
                    }
                    converter._addNumberInput(block, 'SECS', 'math_number', 1, 1);

                    if (!firstBlock) {
                        firstBlock = block;
                    }
                    if (lastBlock) {
                        lastBlock.next = block.id;
                        block.parent = lastBlock.id;
                    }
                    lastBlock = block;
                });

                return firstBlock;
            });
        });

        // print/puts/p - sprite-only, mapped to looks_sayforsecs
        ['print', 'puts', 'p'].forEach((methodName) => {
            converter.registerOnSend('sprite', methodName, -1, (params) => {
                const { args } = params;
                if (args.length === 0) return null;
                if (!args.every((arg) => converter._isNumberOrStringOrBlock(arg))) return null;

                let firstBlock = null;
                let lastBlock = null;

                args.forEach((arg) => {
                    const block = converter._createBlock('looks_sayforsecs', 'statement');
                    converter._addTextInput(
                        block,
                        'MESSAGE',
                        converter._isNumber(arg) ? arg.toString() : arg,
                        'Hello!',
                    );
                    converter._addNumberInput(block, 'SECS', 'math_number', 1, 1);

                    let commentText = `@ruby:method:${methodName}`;
                    if (converter._isNumber(arg)) {
                        let typeName;
                        if (arg.type === 'int') {
                            typeName = 'Integer';
                        } else if (arg.type === 'float') {
                            typeName = 'Float';
                        } else if (_.isNumber(arg)) {
                            typeName = Number.isInteger(arg) ? 'Integer' : 'Float';
                        }
                        if (typeName) {
                            commentText += `,@ruby:argument:1:type:${typeName}`;
                        }
                    }

                    block.comment = converter.createComment(commentText, block.id);

                    if (!firstBlock) {
                        firstBlock = block;
                    }
                    if (lastBlock) {
                        lastBlock.next = block.id;
                        block.parent = lastBlock.id;
                    }
                    lastBlock = block;
                });

                return firstBlock;
            });
        });

        // say(message, secs) - sprite-only
        converter.registerOnSend('sprite', 'say', [1, 2], (params) => {
            const { receiver, args } = params;
            if (!converter._isSelf(receiver) && receiver !== null) return null;
            if (!converter._isNumberOrStringOrBlock(args[0])) return null;

            if (args.length === 1) {
                return createBlockWithMessage(converter, 'looks_say', args[0], 'Hello!');
            }

            if (args.length === 2) {
                let secs = args[1];
                // Support both say(message, secs) and say(message, secs: value) forms
                if (converter._isHash(secs) && secs.size === 1) {
                    secs = secs.get('sym:secs');
                }
                if (converter._isNumberOrBlock(secs)) {
                    const block = createBlockWithMessage(converter, 'looks_sayforsecs', args[0], 'Hello!');
                    converter._addNumberInput(block, 'SECS', 'math_number', secs, 2);
                    return block;
                }
            }
            return null;
        });

        // think(message, secs) - sprite-only
        converter.registerOnSend('sprite', 'think', [1, 2], (params) => {
            const { receiver, args } = params;
            if (!converter._isSelf(receiver) && receiver !== null) return null;
            if (!converter._isNumberOrStringOrBlock(args[0])) return null;

            if (args.length === 1) {
                return createBlockWithMessage(converter, 'looks_think', args[0], 'Hmm...');
            }

            if (args.length === 2) {
                let secs = args[1];
                // Support both think(message, secs) and think(message, secs: value) forms
                if (converter._isHash(secs) && secs.size === 1) {
                    secs = secs.get('sym:secs');
                }
                if (converter._isNumberOrBlock(secs)) {
                    const block = createBlockWithMessage(converter, 'looks_thinkforsecs', args[0], 'Hmm...');
                    converter._addNumberInput(block, 'SECS', 'math_number', secs, 2);
                    return block;
                }
            }
            return null;
        });

        registerSendTable(converter, LOOKS_SENDS);

        // Register onXxx handlers
        converter.registerOnOpAsgn((lh, operator, rh) => {
            let block;
            if (converter._isBlock(lh) && (operator === '+' || operator === '-') && converter._isNumberOrBlock(rh)) {
                if (lh.opcode === 'looks_size') {
                    // Looks blocks are common to sprite and stage
                    block = converter._changeBlock(lh, 'looks_changesizeby', 'statement');
                    if (operator === '-') {
                        let negatedRh;
                        if (converter._isNumber(rh)) {
                            negatedRh = -Number(rh.toString());
                        } else {
                            const subtractBlock = converter._createBlock('operator_subtract', 'value');
                            converter._addNumberInput(subtractBlock, 'NUM1', 'math_number', 0, '');
                            converter._addNumberInput(subtractBlock, 'NUM2', 'math_number', rh, '');
                            negatedRh = subtractBlock;
                        }
                        converter._addNumberInput(block, 'CHANGE', 'math_number', negatedRh, 10);
                    } else {
                        converter._addNumberInput(block, 'CHANGE', 'math_number', rh, 10);
                    }
                }
            }
            return block;
        });
    },
};

export default LooksConverter;
