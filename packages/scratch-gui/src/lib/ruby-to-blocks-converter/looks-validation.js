// === Smalruby: This file is Smalruby-specific (costume/backdrop validation helpers for looks converter) ===
import {defineMessages} from 'react-intl';
import {RubyToBlocksConverterError} from './errors';

const messages = defineMessages({
    costumeDoesNotExist: {
        defaultMessage: 'costume "{NAME}" does not exist.' +
            '\nCheck the name or add the costume first.',
        description: 'Error message when switching to a costume that does not exist',
        id: 'gui.smalruby3.rubyToBlocksConverter.costumeDoesNotExist'
    },
    backdropDoesNotExist: {
        defaultMessage: 'backdrop "{NAME}" does not exist.' +
            '\nCheck the name or add the backdrop first.',
        description: 'Error message when switching to a backdrop that does not exist',
        id: 'gui.smalruby3.rubyToBlocksConverter.backdropDoesNotExist'
    }
});

const validateCostume = function (converter, costumeName, args) {
    // Skip validation if no target context (e.g., in tests)
    if (!converter._context.target || !converter._context.target.getCostumes) {
        return;
    }

    const specialCostumes = ['next costume', 'previous costume', 'random costume'];
    if (specialCostumes.indexOf(costumeName) >= 0) {
        return;
    }

    const costumes = converter._context.target.getCostumes();
    const costumeExists = costumes.some(costume => costume.name === costumeName);
    if (!costumeExists) {
        throw new RubyToBlocksConverterError(
            args[0].node,
            converter._translator(messages.costumeDoesNotExist, {NAME: costumeName})
        );
    }
};

const validateBackdrop = function (converter, backdropName, args) {
    // Skip validation if no vm/stage target (e.g., in tests)
    if (!converter.vm || !converter.vm.runtime) {
        return;
    }

    const specialBackdrops = ['next backdrop', 'previous backdrop', 'random backdrop'];
    if (specialBackdrops.indexOf(backdropName) >= 0) {
        return;
    }

    const stage = converter.vm.runtime.getTargetForStage();
    if (!stage || !stage.getCostumes) {
        return;
    }

    const backdrops = stage.getCostumes();
    const backdropExists = backdrops.some(backdrop => backdrop.name === backdropName);
    if (!backdropExists) {
        throw new RubyToBlocksConverterError(
            args[0].node,
            converter._translator(messages.backdropDoesNotExist, {NAME: backdropName})
        );
    }
};

/**
 * Convert a symbol Primitive to its string name and collect it.
 * Returns the symbol name (without colon) or null if not a symbol.
 * @param {object} converter - The Ruby-to-blocks converter instance.
 * @param {object} arg - The argument to check for symbol type.
 */
const resolveSymbolArg = function (converter, arg) {
    if (converter._isPrimitive(arg) && arg.type === 'sym') {
        converter._collectSymbol(arg.value);
        return arg.value;
    }
    return null;
};

/**
 * Create a block with a MESSAGE text input.
 * @param {object} converter - The Ruby-to-blocks converter instance.
 * @param {string} opcode - The block opcode.
 * @param {*} message - The message value.
 * @param {string} defaultMessage - The default message shadow value.
 * @returns {object} The created block.
 */
const createBlockWithMessage = function (converter, opcode, message, defaultMessage) {
    const block = converter._createBlock(opcode, 'statement');
    converter._addTextInput(
        block, 'MESSAGE', converter._isNumber(message) ? message.toString() : message, defaultMessage
    );
    return block;
};

const LooksValidation = {
    validateCostume,
    validateBackdrop,
    resolveSymbolArg,
    createBlockWithMessage
};

export default LooksValidation;
