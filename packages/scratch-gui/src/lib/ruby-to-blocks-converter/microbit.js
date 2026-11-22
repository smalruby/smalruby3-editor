import { anyCase, menuInputArg, registerSendTable, textArg } from './send-table';

const MicroBit = 'microbit_v1';

const ButtonsMenu = ['A', 'B', 'any'];

const GesturesMenu = ['moved', 'shaken', 'jumped'];

const TiltDirectionAnyMenu = ['front', 'back', 'left', 'right', 'any'];

const TiltDirectionMenu = TiltDirectionAnyMenu.slice(0, 4);

// A menu of micro:bit: a string (looked up without regard to case) or any block.
const microbitMenu = (input, menu, choices, defaultValue) =>
    menuInputArg(input, `microbit_menu_${menu}`, menu, defaultValue, {
        choices,
        normalize: anyCase(choices),
        anyBlock: true,
    });
const buttonsArg = () => microbitMenu('BTN', 'buttons', ButtonsMenu, 'A');
const tiltDirectionAnyArg = () => microbitMenu('DIRECTION', 'tiltDirectionAny', TiltDirectionAnyMenu, 'any');

// The calls that map one to one onto a block (send-table.js). `display` (a matrix) and
// `when_pin_connected` (a number from 0 to 2) stay as handlers.
const MICROBIT_SENDS = [
    { name: 'when_button_pressed', opcode: 'microbit_whenButtonPressed', hat: true, args: [buttonsArg()] },
    { name: 'button_pressed?', opcode: 'microbit_isButtonPressed', type: 'value_boolean', args: [buttonsArg()] },
    {
        name: 'when',
        opcode: 'microbit_whenGesture',
        hat: true,
        args: [microbitMenu('GESTURE', 'gestures', GesturesMenu, 'moved')],
    },
    { name: 'display_text', opcode: 'microbit_displayText', args: [textArg('TEXT', 'Hello!')] },
    { name: 'clear_display', opcode: 'microbit_displayClear' },
    { name: 'when_tilted', opcode: 'microbit_whenTilted', hat: true, args: [tiltDirectionAnyArg()] },
    { name: 'tilted?', opcode: 'microbit_isTilted', type: 'value_boolean', args: [tiltDirectionAnyArg()] },
    {
        name: 'tilt_angle',
        opcode: 'microbit_getTiltAngle',
        type: 'value',
        args: [microbitMenu('DIRECTION', 'tiltDirection', TiltDirectionMenu, 'front')],
    },
].map((row) => ({ receiver: MicroBit, changesReceiver: true, ...row }));

/**
 * MicroBit converter
 */
const MicroBitConverter = {
    sends: MICROBIT_SENDS,

    register: function (converter) {
        const createMicrobitBlock = (node) => converter.createRubyExpressionBlock(MicroBit, node);

        converter.registerOnSend('self', MicroBit, 0, (params) => {
            const { node } = params;

            return createMicrobitBlock(node);
        });

        registerSendTable(converter, MICROBIT_SENDS);

        converter.registerOnSend(MicroBit, 'display', 5, (params) => {
            const { receiver, args } = params;

            if (!args.every((x) => converter.isString(x))) return null;

            const block = converter.changeRubyExpressionBlock(receiver, 'microbit_displaySymbol', 'statement');

            let matrix = '';
            for (const arg of args) {
                matrix += arg;
            }
            matrix = matrix.replace(/[1-9]/g, '1').replace(/[^1-9]/g, '0');
            converter.addFieldInput(block, 'MATRIX', 'matrix', 'MATRIX', matrix, null);
            return block;
        });

        converter.registerOnSend(MicroBit, 'display', 1, (params) => {
            const { receiver, args } = params;

            if (!converter.isBlock(args[0])) return null;

            const block = converter.changeRubyExpressionBlock(receiver, 'microbit_displaySymbol', 'statement');
            converter.addFieldInput(block, 'MATRIX', 'matrix', 'MATRIX', args[0], '0101010101100010101000100');
            return block;
        });

        converter.registerOnSendWithBlock(MicroBit, 'when_pin_connected', 1, 0, (params) => {
            const { receiver, args, rubyBlock } = params;

            if (!converter.isNumberOrBlock(args[0])) return null;
            if (converter.isNumber(args[0]) && (args[0].value < 0 || args[0].value > 2)) return null;

            const block = converter.changeRubyExpressionBlock(receiver, 'microbit_whenPinConnected', 'hat');
            converter.addFieldInput(block, 'PIN', 'microbit_menu_touchPins', 'touchPins', args[0], '0');
            converter.setParent(rubyBlock, block);
            return block;
        });

        // backward compatibility
        converter.registerOnSendWithBlock('self', 'when', 2, 0, (params) => {
            const { args } = params;

            if (!converter._isSymbol(args[0])) return null;

            switch (converter._getSymbolValue(args[0])) {
                case 'microbit_button_pressed':
                    return converter.callMethod(
                        createMicrobitBlock(params.node),
                        'when_button_pressed',
                        params.args.slice(1),
                        params.rubyBlockArgs,
                        params.rubyBlock,
                        params.node,
                    );
                case 'microbit_gesture':
                    return converter.callMethod(
                        createMicrobitBlock(params.node),
                        'when',
                        params.args.slice(1),
                        params.rubyBlockArgs,
                        params.rubyBlock,
                        params.node,
                    );
                case 'microbit_tilted':
                    return converter.callMethod(
                        createMicrobitBlock(params.node),
                        'when_tilted',
                        params.args.slice(1),
                        params.rubyBlockArgs,
                        params.rubyBlock,
                        params.node,
                    );
                case 'microbit_pin_connected':
                    return converter.callMethod(
                        createMicrobitBlock(params.node),
                        'when_pin_connected',
                        params.args.slice(1),
                        params.rubyBlockArgs,
                        params.rubyBlock,
                        params.node,
                    );
            }

            return null;
        });
    },
};

export default MicroBitConverter;
