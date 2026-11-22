// === Smalruby: This file is Smalruby-specific (legacy micro:bit More API handlers for backward compatibility) ===
import {
    MicrobitMoreLegacy,
    MicrobitMoreDataLegacy,
    Gpio,
    GpioPin,
    PinEventMenuLower,
    PinEventMenuValue,
    TouchPinIDMenuLower,
    TouchPinIDMenuValue,
} from './microbit-more-menus';
import { MICROBIT_MORE_SENDS } from './microbit-more-modern';
import Primitive from './primitive';
import { registerSendTable } from './send-table';

// The old calls `microbit_more.xxx`: the same rows as `microbit.xxx` (microbit-more-modern.js).
const MICROBIT_MORE_LEGACY_SENDS = MICROBIT_MORE_SENDS.map((row) => ({ ...row, receiver: MicrobitMoreLegacy }));

/**
 * Register legacy micro:bit More API handlers (receiver: 'microbit_more') for backward compatibility.
 * @param {object} converter - The RubyToBlocksConverter instance
 */
const registerLegacyHandlers = function (converter) {
    // backward compatibility: register 'microbit_more' as an alias for 'microbit'
    converter.registerOnSend('self', MicrobitMoreLegacy, 0, (params) => {
        const { node } = params;
        return converter.createRubyExpressionBlock(MicrobitMoreLegacy, node);
    });

    // Helper function to register backward compatibility handlers
    const registerLegacyHandler = (method, numArgs, handler) => {
        converter.registerOnSend(MicrobitMoreLegacy, method, numArgs, handler);
    };
    const registerLegacyHandlerWithBlock = (method, numArgs, numBlockArgs, handler) => {
        converter.registerOnSendWithBlock(MicrobitMoreLegacy, method, numArgs, numBlockArgs, handler);
    };

    registerSendTable(converter, MICROBIT_MORE_LEGACY_SENDS);

    // backward compatibility: when_pin_connected
    registerLegacyHandlerWithBlock('when_pin_connected', 1, 0, (params) => {
        const { receiver, args, rubyBlock } = params;

        if (converter.isNumber(args[0])) {
            const index = TouchPinIDMenuLower.indexOf(args[0].toString());
            if (index < 0) return null;
            args[0] = new Primitive('str', TouchPinIDMenuValue[index], args[0].node);
        } else {
            return null;
        }

        const block = converter.changeRubyExpressionBlock(receiver, 'microbitMore_whenPinConnected', 'hat');
        converter.addField(block, 'PIN', args[0]);
        converter.setParent(rubyBlock, block);
        return block;
    });

    // backward compatibility: display_pattern (5 args)
    registerLegacyHandler('display_pattern', 5, (params) => {
        const { receiver, args } = params;

        if (!args.every((x) => converter.isString(x))) return null;

        const block = converter.changeRubyExpressionBlock(receiver, 'microbitMore_displayMatrix', 'statement');

        let matrix = '';
        for (const arg of args) {
            matrix += arg;
        }
        matrix = matrix.replace(/[1-9]/g, '1').replace(/[^1-9]/g, '0');
        converter.addFieldInput(block, 'MATRIX', 'matrix', 'MATRIX', matrix, null);
        return block;
    });

    // backward compatibility: display_pattern (1 arg)
    registerLegacyHandler('display_pattern', 1, (params) => {
        const { receiver, args } = params;

        if (!converter.isBlock(args[0])) return null;

        const block = converter.changeRubyExpressionBlock(receiver, 'microbitMore_displayMatrix', 'statement');
        converter.addFieldInput(block, 'MATRIX', 'matrix', 'MATRIX', args[0], '0101010101100010101000100');
        return block;
    });

    // backward compatibility: when_catch_at_pin
    registerLegacyHandlerWithBlock('when_catch_at_pin', 2, 0, (params) => {
        const { receiver, args, rubyBlock } = params;

        if (converter.isString(args[0])) {
            const index = PinEventMenuLower.indexOf(args[0].toString().toLowerCase());
            if (index < 0) return null;
            args[0] = new Primitive('str', PinEventMenuValue[index], args[0].node);
        } else {
            return null;
        }

        if (converter.isString(args[1])) {
            const index = GpioPin.indexOf(args[1].toString().toLowerCase());
            if (index < 0) return null;
            args[1] = new Primitive('int', Gpio[index], args[1].node);
        } else {
            return null;
        }

        const block = converter.changeRubyExpressionBlock(receiver, 'microbitMore_whenPinEvent', 'hat');
        converter.addField(block, 'EVENT', args[0]);
        converter.addField(block, 'PIN', args[1], '0');
        converter.setParent(rubyBlock, block);
        return block;
    });

    // backward compatibility: value_of
    registerLegacyHandler('value_of', 2, (params) => {
        const { receiver, args } = params;

        if (converter.isString(args[0])) {
            const index = PinEventMenuLower.indexOf(args[0].toString().toLowerCase());
            if (index < 0) return null;
            args[0] = new Primitive('str', PinEventMenuValue[index], args[0].node);
        } else {
            return null;
        }

        if (converter.isString(args[1])) {
            const index = GpioPin.indexOf(args[1].toString().toLowerCase());
            if (index < 0) return null;
            args[1] = new Primitive('int', Gpio[index], args[1].node);
        } else {
            return null;
        }

        const block = converter.changeRubyExpressionBlock(receiver, 'microbitMore_getPinEventValue', 'value');
        converter.addField(block, 'EVENT', args[0]);
        converter.addField(block, 'PIN', args[1], '0');
        return block;
    });

    // backward compatibility: data
    registerLegacyHandler('data', 0, (params) => {
        const { receiver, node } = params;

        const block = converter.changeRubyExpressionBlock(receiver, 'ruby_expression', 'value_boolean');
        block.node = node;
        converter.addInput(block, 'EXPRESSION', converter.createTextBlock(MicrobitMoreDataLegacy));
        return block;
    });

    // backward compatibility: microbit_more.data[]
    converter.registerOnSend(MicrobitMoreDataLegacy, '[]', 1, (params) => {
        const { receiver, args } = params;

        if (!converter.isStringOrBlock(args[0])) return null;

        const block = converter.changeRubyExpressionBlock(receiver, 'microbitMore_getDataLabeled', 'value');
        converter.addTextInput(block, 'LABEL', args[0], 'label-01');
        return block;
    });

    // backward compatibility: send_data_to_microbit
    registerLegacyHandler('send_data_to_microbit', 2, (params) => {
        const { receiver, args } = params;

        if (!converter.isStringOrBlock(args[0])) return null;
        if (!converter.isStringOrBlock(args[1])) return null;

        const block = converter.changeRubyExpressionBlock(receiver, 'microbitMore_sendData', 'statement');
        converter.addTextInput(block, 'LABEL', args[1], 'label-01');
        converter.addTextInput(block, 'DATA', args[0], 'data');
        return block;
    });
};

export { MICROBIT_MORE_LEGACY_SENDS };
export default registerLegacyHandlers;
