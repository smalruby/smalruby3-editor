import _ from 'lodash';
import {RubyToBlocksConverterError} from './errors';

 
const createBlockWithMessage = function (converter, opcode, message, defaultMessage) {
    const block = converter._createBlock(opcode, 'statement');
    converter._addTextInput(
        block, 'MESSAGE', converter._isNumber(message) ? message.toString() : message, defaultMessage
    );
    return block;
};

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

 
const validateCostume = function (converter, costumeName, args) {
    // Skip validation if no target context (e.g., in tests)
    if (!converter._context.target || !converter._context.target.getCostumes) {
        return;
    }

    const costumes = converter._context.target.getCostumes();
    const costumeExists = costumes.some(costume => costume.name === costumeName);
    if (!costumeExists) {
        throw new RubyToBlocksConverterError(
            args[0].node,
            `costume "${costumeName}" does not exist`
        );
    }
};

const validateBackdrop = function (converter, backdropName, args) {
    // Skip validation if no stage target (e.g., in tests)
    const stage = converter.vm.runtime.getTargetForStage();
    if (!stage || !stage.getCostumes) {
        return;
    }

    const backdrops = stage.getCostumes();
    const backdropExists = backdrops.some(backdrop => backdrop.name === backdropName);
    if (!backdropExists) {
        throw new RubyToBlocksConverterError(
            args[0].node,
            `backdrop "${backdropName}" does not exist`
        );
    }
};

/**
 * Looks converter
 */
const LooksConverter = {
    register: function (converter) {
        // say(message, secs: duration)
        converter.registerOnSend('self', 'say', [1, 2], params => {
            const {receiver, args} = params;
            if (!converter._isSelf(receiver) && receiver !== null) return null;

            if (args.length === 1) {
                return createBlockWithMessage(converter, 'looks_say', args[0], 'Hello!');
            }

            if (args.length === 2 && converter._isHash(args[1]) && args[1].size === 1) {
                const secs = args[1].get('sym:secs');
                if (converter._isNumberOrBlock(secs)) {
                    const block = createBlockWithMessage(converter, 'looks_sayforsecs', args[0], 'Hello!');
                    converter._addNumberInput(block, 'SECS', 'math_number', secs, 2);
                    return block;
                }
            }
            return null;
        });

        // think(message, secs: duration)
        converter.registerOnSend('self', 'think', [1, 2], params => {
            const {receiver, args} = params;
            if (!converter._isSelf(receiver) && receiver !== null) return null;

            if (args.length === 1) {
                return createBlockWithMessage(converter, 'looks_think', args[0], 'Hmm...');
            }

            if (args.length === 2 && converter._isHash(args[1]) && args[1].size === 1) {
                const secs = args[1].get('sym:secs');
                if (converter._isNumberOrBlock(secs)) {
                    const block = createBlockWithMessage(converter, 'looks_thinkforsecs', args[0], 'Hmm...');
                    converter._addNumberInput(block, 'SECS', 'math_number', secs, 2);
                    return block;
                }
            }
            return null;
        });

        // costume = name
        converter.registerOnSend('self', 'costume=', 1, params => {
            const {receiver, args} = params;
            if (!converter._isSelf(receiver) && receiver !== null) return null;
            if (!converter._isString(args[0])) return null;

            const costumeName = args[0].toString();
            validateCostume(converter, costumeName, args);

            const block = converter._createBlock('looks_switchcostumeto', 'statement');
            converter._addInput(block, 'COSTUME', converter._createFieldBlock('looks_costume', 'COSTUME', costumeName));
            return block;
        });

        // next_costume
        converter.registerOnSend('self', 'next_costume', 0, params => {
            const {receiver} = params;
            if (!converter._isSelf(receiver) && receiver !== null) return null;

            return converter._createBlock('looks_nextcostume', 'statement');
        });

        // backdrop = name
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

        // switch_backdrop_to_and_wait(name)
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

        // size = value
        converter.registerOnSend('self', 'size=', 1, params => {
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
            converter._addNumberInput(block, 'VALUE', 'math_number', args[1], 0);
            return block;
        });

        // clear_graphic_effects
        converter.registerOnSend('self', 'clear_graphic_effects', 0, params => {
            const {receiver} = params;
            if (!converter._isSelf(receiver) && receiver !== null) return null;

            return converter._createBlock('looks_cleargraphiceffects', 'statement');
        });

        // show
        converter.registerOnSend('self', 'show', 0, params => {
            const {receiver} = params;
            if (!converter._isSelf(receiver) && receiver !== null) return null;

            return converter._createBlock('looks_show', 'statement');
        });

        // hide
        converter.registerOnSend('self', 'hide', 0, params => {
            const {receiver} = params;
            if (!converter._isSelf(receiver) && receiver !== null) return null;

            return converter._createBlock('looks_hide', 'statement');
        });

        // go_to_front and go_to_back
        ['front', 'back'].forEach(option => {
            converter.registerOnSend('self', `go_to_${option}`, 0, params => {
                const {receiver} = params;
                if (!converter._isSelf(receiver) && receiver !== null) return null;

                const block = converter._createBlock('looks_gotofrontback', 'statement');
                converter._addField(block, 'FRONT_BACK', option);
                return block;
            });
        });

        // go_forward(layers) and go_backward(layers)
        ['forward', 'backward'].forEach(option => {
            converter.registerOnSend('self', `go_${option}`, 1, params => {
                const {receiver, args} = params;
                if (!converter._isSelf(receiver) && receiver !== null) return null;
                if (!converter._isNumberOrBlock(args[0])) return null;

                const block = converter._createBlock('looks_goforwardbackwardlayers', 'statement');
                converter._addField(block, 'FORWARD_BACKWARD', option);
                converter._addNumberInput(block, 'NUM', 'math_integer', args[0], 1);
                return block;
            });
        });

        // backward compatibility
        converter.registerOnSend('self', 'go_layers', 2, params => {
            const {receiver, args} = params;
            if (!converter._isSelf(receiver) && receiver !== null) return null;
            if (!converter._isString(args[0]) || ForwardBackward.indexOf(args[0].toString()) < 0) return null;
            if (!converter._isNumberOrBlock(args[1])) return null;

            const block = converter._createBlock('looks_goforwardbackwardlayers', 'statement');
            converter._addField(block, 'FORWARD_BACKWARD', args[0].toString());
            converter._addNumberInput(block, 'NUM', 'math_integer', args[1], 1);
            return block;
        });

        // Getters
        const getters = [
            {method: 'costume_number', opcode: 'looks_costumenumbername', field: 'NUMBER_NAME', value: 'number'},
            {method: 'costume_name', opcode: 'looks_costumenumbername', field: 'NUMBER_NAME', value: 'name'},
            {method: 'backdrop_number', opcode: 'looks_backdropnumbername', field: 'NUMBER_NAME', value: 'number'},
            {method: 'backdrop_name', opcode: 'looks_backdropnumbername', field: 'NUMBER_NAME', value: 'name'},
            {method: 'size', opcode: 'looks_size'}
        ];

        getters.forEach(({method, opcode, field, value}) => {
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
            if (converter._isBlock(lh) && operator === '+' && converter._isNumberOrBlock(rh)) {
                if (lh.opcode === 'looks_size') {
                    // Looks blocks are common to sprite and stage
                    block = converter._changeBlock(lh, 'looks_changesizeby', 'statement');
                    converter._addNumberInput(block, 'CHANGE', 'math_number', rh, 10);
                }
            }
            return block;
        });
    }
};

export default LooksConverter;
