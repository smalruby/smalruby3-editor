import _ from 'lodash';
import LooksValidation from './looks-validation';

const {validateCostume, validateBackdrop, resolveSymbolArg, createBlockWithMessage} = LooksValidation;

const Effects = [
    'COLOR',
    'FISHEYE',
    'WHIRL',
    'PIXELATE',
    'MOSAIC',
    'BRIGHTNESS',
    'GHOST'
];

const FrontBack = [
    'front',
    'back'
];

const ForwardBackward = [
    'forward',
    'backward'
];

/**
 * Looks converter
 */
const LooksConverter = {
    register: function (converter) {
        // say/think with symbol argument - sprite-only
        ['say', 'think'].forEach(methodName => {
            const opcodes1 = {say: 'looks_say', think: 'looks_think'};
            const opcodes2 = {say: 'looks_sayforsecs', think: 'looks_thinkforsecs'};
            const defaults = {say: 'Hello!', think: 'Hmm...'};

            converter.registerOnSend('sprite', methodName, [1, 2], params => {
                const {receiver, args} = params;
                if (!converter._isSelf(receiver) && receiver !== null) return null;
                const symbolName = resolveSymbolArg(converter, args[0]);
                const symbolVarBlock = symbolName ? null : converter._resolveSymbolVariable(args[0]);
                if (!symbolName && !symbolVarBlock) return null;

                const message = symbolName || symbolVarBlock;

                if (args.length === 1) {
                    const block = converter._createBlock(opcodes1[methodName], 'statement');
                    converter._addTextInput(block, 'MESSAGE', message, defaults[methodName]);
                    if (symbolName) {
                        block.comment = converter._createComment(
                            `@ruby:symbol:${symbolName}`, block.id
                        );
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
                            block.comment = converter._createComment(
                                `@ruby:symbol:${symbolName}`, block.id
                            );
                        }
                        return block;
                    }
                }
                return null;
            });
        });

        // print/puts/p with symbol arguments - sprite-only
        ['print', 'puts', 'p'].forEach(methodName => {
            converter.registerOnSend('sprite', methodName, -1, params => {
                const {args} = params;
                if (args.length === 0) return null;

                const isSymbolArg = arg =>
                    (converter._isPrimitive(arg) && arg.type === 'sym');
                const isSymbolVar = arg => {
                    if (!converter._isBlock(arg)) return false;
                    const v = converter.lookupVariableFromVariableBlock(arg);
                    return v && v.dataType === 'symbol';
                };

                if (!args.every(arg =>
                    converter._isNumberOrStringOrBlock(arg) || isSymbolArg(arg)
                )) return null;
                // Only handle if at least one symbol arg or symbol variable
                if (!args.some(arg => isSymbolArg(arg) || isSymbolVar(arg))) return null;

                let firstBlock = null;
                let lastBlock = null;

                args.forEach(arg => {
                    const block = converter._createBlock('looks_sayforsecs', 'statement');
                    const symbolName2 = resolveSymbolArg(converter, arg);
                    const symbolVar = symbolName2 ? null : converter._resolveSymbolVariable(arg);
                    if (symbolName2) {
                        converter._addTextInput(block, 'MESSAGE', symbolName2, 'Hello!');
                        block.comment = converter._createComment(
                            `@ruby:symbol:${symbolName2},@ruby:method:${methodName}`, block.id
                        );
                    } else if (symbolVar) {
                        converter._addTextInput(block, 'MESSAGE', symbolVar, 'Hello!');
                        block.comment = converter.createComment(
                            `@ruby:method:${methodName}`, block.id
                        );
                    } else {
                        converter._addTextInput(
                            block, 'MESSAGE',
                            converter._isNumber(arg) ? arg.toString() : arg, 'Hello!'
                        );
                        block.comment = converter.createComment(
                            `@ruby:method:${methodName}`, block.id
                        );
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
        ['print', 'puts', 'p'].forEach(methodName => {
            converter.registerOnSend('sprite', methodName, -1, params => {
                const {args} = params;
                if (args.length === 0) return null;
                if (!args.every(arg => converter._isNumberOrStringOrBlock(arg))) return null;

                let firstBlock = null;
                let lastBlock = null;

                args.forEach(arg => {
                    const block = converter._createBlock('looks_sayforsecs', 'statement');
                    converter._addTextInput(
                        block, 'MESSAGE', converter._isNumber(arg) ? arg.toString() : arg, 'Hello!'
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
        converter.registerOnSend('sprite', 'say', [1, 2], params => {
            const {receiver, args} = params;
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
        converter.registerOnSend('sprite', 'think', [1, 2], params => {
            const {receiver, args} = params;
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

        // switch_costume(name) - sprite-only
        converter.registerOnSend('sprite', 'switch_costume', 1, params => {
            const {receiver, args} = params;
            if (!converter._isSelf(receiver) && receiver !== null) return null;
            if (!converter._isString(args[0])) return null;

            const costumeName = args[0].toString();
            validateCostume(converter, costumeName, args);

            const block = converter._createBlock('looks_switchcostumeto', 'statement');
            converter._addInput(block, 'COSTUME', converter._createFieldBlock('looks_costume', 'COSTUME', costumeName));
            return block;
        });

        // costume = name (self.costume = "name" form) - sprite-only
        converter.registerOnSend('sprite', 'costume=', 1, params => {
            const {receiver, args} = params;
            if (!converter._isSelf(receiver) && receiver !== null) return null;
            if (!converter._isString(args[0])) return null;

            const costumeName = args[0].toString();
            validateCostume(converter, costumeName, args);

            const block = converter._createBlock('looks_switchcostumeto', 'statement');
            converter._addInput(block, 'COSTUME', converter._createFieldBlock('looks_costume', 'COSTUME', costumeName));
            return block;
        });

        // next_costume - sprite-only
        converter.registerOnSend('sprite', 'next_costume', 0, params => {
            const {receiver} = params;
            if (!converter._isSelf(receiver) && receiver !== null) return null;

            return converter._createBlock('looks_nextcostume', 'statement');
        });

        // switch_backdrop(name)
        converter.registerOnSend('self', 'switch_backdrop', 1, params => {
            const {receiver, args} = params;
            if (!converter._isSelf(receiver) && receiver !== null) return null;
            if (!converter._isString(args[0])) return null;

            const backdropName = args[0].toString();
            validateBackdrop(converter, backdropName, args);

            const block = converter._createBlock('looks_switchbackdropto', 'statement');
            converter._addInput(
                block, 'BACKDROP', converter._createFieldBlock('looks_backdrops', 'BACKDROP', backdropName)
            );
            return block;
        });

        // backdrop = name (self.backdrop = "name" form)
        converter.registerOnSend('self', 'backdrop=', 1, params => {
            const {receiver, args} = params;
            if (!converter._isSelf(receiver) && receiver !== null) return null;
            if (!converter._isString(args[0])) return null;

            const backdropName = args[0].toString();
            validateBackdrop(converter, backdropName, args);

            const block = converter._createBlock('looks_switchbackdropto', 'statement');
            converter._addInput(
                block, 'BACKDROP', converter._createFieldBlock('looks_backdrops', 'BACKDROP', backdropName)
            );
            return block;
        });

        // next_backdrop
        converter.registerOnSend('self', 'next_backdrop', 0, params => {
            const {receiver} = params;
            if (!converter._isSelf(receiver) && receiver !== null) return null;

            return converter._createBlock('looks_nextbackdrop', 'statement');
        });

        // switch_backdrop_and_wait(name)
        converter.registerOnSend('self', 'switch_backdrop_and_wait', 1, params => {
            const {receiver, args} = params;
            if (!converter._isSelf(receiver) && receiver !== null) return null;
            if (!converter._isString(args[0])) return null;

            const backdropName = args[0].toString();
            validateBackdrop(converter, backdropName, args);

            const block = converter._createBlock('looks_switchbackdroptoandwait', 'statement');
            converter._addInput(
                block, 'BACKDROP', converter._createFieldBlock('looks_backdrops', 'BACKDROP', backdropName)
            );
            return block;
        });

        // switch_backdrop_to_and_wait(name) (alternate form)
        converter.registerOnSend('self', 'switch_backdrop_to_and_wait', 1, params => {
            const {receiver, args} = params;
            if (!converter._isSelf(receiver) && receiver !== null) return null;
            if (!converter._isString(args[0])) return null;

            const backdropName = args[0].toString();
            validateBackdrop(converter, backdropName, args);

            const block = converter._createBlock('looks_switchbackdroptoandwait', 'statement');
            converter._addInput(
                block, 'BACKDROP', converter._createFieldBlock('looks_backdrops', 'BACKDROP', backdropName)
            );
            return block;
        });

        // size = value - sprite-only
        converter.registerOnSend('sprite', 'size=', 1, params => {
            const {receiver, args} = params;
            if (!converter._isSelf(receiver) && receiver !== null) return null;
            if (!converter._isNumberOrBlock(args[0])) return null;

            const block = converter._createBlock('looks_setsizeto', 'statement');
            converter._addNumberInput(block, 'SIZE', 'math_number', args[0], 100);
            return block;
        });

        // change_effect_by(effect, value)
        converter.registerOnSend('self', 'change_effect_by', 2, params => {
            const {receiver, args} = params;
            if (!converter._isSelf(receiver) && receiver !== null) return null;
            if (!converter._isString(args[0]) || Effects.indexOf(args[0].toString().toUpperCase()) < 0) return null;
            if (!converter._isNumberOrBlock(args[1])) return null;

            const block = converter._createBlock('looks_changeeffectby', 'statement');
            converter._addField(block, 'EFFECT', args[0].toString().toUpperCase());
            converter._addNumberInput(block, 'CHANGE', 'math_number', args[1], 25);
            return block;
        });

        // set_effect(effect, value)
        converter.registerOnSend('self', 'set_effect', 2, params => {
            const {receiver, args} = params;
            if (!converter._isSelf(receiver) && receiver !== null) return null;
            if (!converter._isString(args[0]) || Effects.indexOf(args[0].toString().toUpperCase()) < 0) return null;
            if (!converter._isNumberOrBlock(args[1])) return null;

            const block = converter._createBlock('looks_seteffectto', 'statement');
            converter._addField(block, 'EFFECT', args[0].toString().toUpperCase());
            converter._addNumberInput(block, 'VALUE', 'math_number', args[1], 25);
            return block;
        });

        // clear_graphic_effects
        converter.registerOnSend('self', 'clear_graphic_effects', 0, params => {
            const {receiver} = params;
            if (!converter._isSelf(receiver) && receiver !== null) return null;

            return converter._createBlock('looks_cleargraphiceffects', 'statement');
        });

        // show - sprite-only
        converter.registerOnSend('sprite', 'show', 0, params => {
            const {receiver} = params;
            if (!converter._isSelf(receiver) && receiver !== null) return null;

            return converter._createBlock('looks_show', 'statement');
        });

        // hide - sprite-only
        converter.registerOnSend('sprite', 'hide', 0, params => {
            const {receiver} = params;
            if (!converter._isSelf(receiver) && receiver !== null) return null;

            return converter._createBlock('looks_hide', 'statement');
        });

        // go_to_layer("front") and go_to_layer("back") - sprite-only
        converter.registerOnSend('sprite', 'go_to_layer', 1, params => {
            const {receiver, args} = params;
            if (!converter._isSelf(receiver) && receiver !== null) return null;
            if (!converter._isString(args[0]) || FrontBack.indexOf(args[0].toString()) < 0) return null;

            const block = converter._createBlock('looks_gotofrontback', 'statement');
            converter._addField(block, 'FRONT_BACK', args[0].toString());
            return block;
        });

        // go_to_front and go_to_back (alternate form) - sprite-only
        ['front', 'back'].forEach(option => {
            converter.registerOnSend('sprite', `go_to_${option}`, 0, params => {
                const {receiver} = params;
                if (!converter._isSelf(receiver) && receiver !== null) return null;

                const block = converter._createBlock('looks_gotofrontback', 'statement');
                converter._addField(block, 'FRONT_BACK', option);
                return block;
            });
        });

        // go_layers(layers, direction) - go_layers(1, "forward") - sprite-only
        converter.registerOnSend('sprite', 'go_layers', 2, params => {
            const {receiver, args} = params;
            if (!converter._isSelf(receiver) && receiver !== null) return null;
            if (!converter._isNumberOrBlock(args[0])) return null;
            if (!converter._isString(args[1]) || ForwardBackward.indexOf(args[1].toString()) < 0) return null;

            const block = converter._createBlock('looks_goforwardbackwardlayers', 'statement');
            converter._addField(block, 'FORWARD_BACKWARD', args[1].toString());
            converter._addNumberInput(block, 'NUM', 'math_integer', args[0], 1);
            return block;
        });

        // go_forward(layers) and go_backward(layers) - sprite-only
        ['forward', 'backward'].forEach(option => {
            converter.registerOnSend('sprite', `go_${option}`, 1, params => {
                const {receiver, args} = params;
                if (!converter._isSelf(receiver) && receiver !== null) return null;
                if (!converter._isNumberOrBlock(args[0])) return null;

                const block = converter._createBlock('looks_goforwardbackwardlayers', 'statement');
                converter._addField(block, 'FORWARD_BACKWARD', option);
                converter._addNumberInput(block, 'NUM', 'math_integer', args[0], 1);
                return block;
            });
        });

        // Sprite-only getters
        const spriteGetters = [
            {method: 'costume_number', opcode: 'looks_costumenumbername', field: 'NUMBER_NAME', value: 'number'},
            {method: 'costume_name', opcode: 'looks_costumenumbername', field: 'NUMBER_NAME', value: 'name'},
            {method: 'size', opcode: 'looks_size'}
        ];

        spriteGetters.forEach(({method, opcode, field, value}) => {
            converter.registerOnSend('sprite', method, 0, params => {
                const {receiver} = params;
                if (!converter._isSelf(receiver) && receiver !== null) return null;

                const block = converter._createBlock(opcode, 'value');
                if (field) {
                    converter._addField(block, field, value);
                }
                return block;
            });
        });

        // Stage-compatible getters
        const stageGetters = [
            {method: 'backdrop_number', opcode: 'looks_backdropnumbername', field: 'NUMBER_NAME', value: 'number'},
            {method: 'backdrop_name', opcode: 'looks_backdropnumbername', field: 'NUMBER_NAME', value: 'name'}
        ];

        stageGetters.forEach(({method, opcode, field, value}) => {
            converter.registerOnSend('self', method, 0, params => {
                const {receiver} = params;
                if (!converter._isSelf(receiver) && receiver !== null) return null;

                const block = converter._createBlock(opcode, 'value');
                if (field) {
                    converter._addField(block, field, value);
                }
                return block;
            });
        });

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
    }
};

export default LooksConverter;
