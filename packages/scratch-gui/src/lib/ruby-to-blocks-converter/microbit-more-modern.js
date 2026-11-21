// === Smalruby: This file is Smalruby-specific (modern micro:bit More API handlers) ===
import {
    MicrobitMore,
    MicrobitMoreData,
    ButtonIDMenu,
    ButtonIDMenuLower,
    ButtonEventMenu,
    TouchIDMenu,
    TouchIDMenuLower,
    TouchEventMenu,
    GestureMenuLower,
    GestureMenuValue,
    AnalogIn,
    AnalogInPin,
    Gpio,
    GpioPin,
    AccelerationMenu,
    PinModeMenu,
    PinModeMenuLower,
    DigitalValueMenuLower,
    DigitalValueMenuValue,
    PinEventTypeMenuLower,
    PinEventTypeMenuValue,
    PinEventMenuLower,
    PinEventMenuValue,
    ConnectionStateMenu,
    TouchPinIDMenuLower,
    TouchPinIDMenuValue,
    TiltDirectionMenuLower,
    TiltDirectionMenuValue,
    TiltAngleDirectionMenuLower,
    TiltAngleDirectionMenuValue,
} from './microbit-more-menus';
import Primitive from './primitive';
import { fieldArg, menuInputArg, numberArg, registerSendTable, textArg } from './send-table';

/**
 * A string looked up without regard to case in `lower`, made into the value of the same index in
 * `values` (`"p8"` → `"8"`); a string not in `lower` is not taken.
 * @param {Array<string>} lower - The strings that a call takes, in lower case.
 * @param {Array<string|number>} values - The values of the menu, in the same order.
 * @returns {object} The choices and the `normalize` of an argument of a row.
 */
const lookUp = (lower, values) => {
    const choices = values.map(String);
    return {
        choices,
        normalize: (value) => {
            const index = lower.indexOf(value.toLowerCase());
            return index < 0 ? '' : choices[index];
        },
    };
};

// A field of the block from a string of the call (see `lookUp`).
const menuField = (field, lower, values) => {
    const { choices, normalize } = lookUp(lower, values);
    return fieldArg(field, choices, { normalize });
};
const pinField = () => menuField('PIN', GpioPin, Gpio);
const tiltField = () => menuField('DIRECTION', TiltDirectionMenuLower, TiltDirectionMenuValue);
const axisField = () => menuField('AXIS', AccelerationMenu, AccelerationMenu);

// The reporters without an argument: [Ruby name, opcode].
const REPORTERS = [
    ['light_intensity', 'microbitMore_getLightLevel'],
    ['temperature', 'microbitMore_getTemperature'],
    ['angle_with_north', 'microbitMore_getCompassHeading'],
    ['pitch', 'microbitMore_getPitch'],
    ['roll', 'microbitMore_getRoll'],
    ['sound_level', 'microbitMore_getSoundLevel'],
].map(([name, opcode]) => ({ name, opcode, type: 'value' }));

// The calls of `microbit.xxx` that map one to one onto a block (send-table.js). These stay as
// handlers: `when_pin_connected` (a number), `display_pattern` / `display` (a matrix),
// `when_catch_at_pin` / `value_of` (their pin field has an extra attribute), `data` /
// `data[...]`, and `send_data_to_microbit` (the arguments go into the block in the other order).
const MICROBIT_MORE_SENDS = [
    {
        name: 'when_microbit',
        opcode: 'microbitMore_whenConnectionChanged',
        hat: true,
        args: [menuField('STATE', ConnectionStateMenu, ConnectionStateMenu)],
    },
    {
        name: 'when_button_is',
        opcode: 'microbitMore_whenButtonEvent',
        hat: true,
        args: [
            menuField('NAME', ButtonIDMenuLower, ButtonIDMenu),
            menuField('EVENT', ButtonEventMenu, ButtonEventMenu),
        ],
    },
    {
        name: 'button_pressed?',
        opcode: 'microbitMore_isButtonPressed',
        type: 'value_boolean',
        args: [menuField('NAME', ButtonIDMenuLower, ButtonIDMenu)],
    },
    {
        name: 'when_pin_is',
        opcode: 'microbitMore_whenTouchEvent',
        hat: true,
        args: [
            menuField('NAME', TouchIDMenuLower, TouchIDMenu),
            menuField('EVENT', Object.keys(TouchEventMenu), Object.values(TouchEventMenu)),
        ],
    },
    {
        name: 'pin_is_touched?',
        opcode: 'microbitMore_isPinTouched',
        type: 'value_boolean',
        args: [menuField('NAME', TouchIDMenuLower, TouchIDMenu)],
    },
    {
        name: 'when',
        opcode: 'microbitMore_whenGesture',
        hat: true,
        args: [menuField('GESTURE', GestureMenuLower, GestureMenuValue)],
    },
    { name: 'when_tilted', opcode: 'microbitMore_whenTilted', hat: true, args: [tiltField()] },
    { name: 'tilted?', opcode: 'microbitMore_isTilted', type: 'value_boolean', args: [tiltField()] },
    {
        name: 'tilt_angle',
        opcode: 'microbitMore_getTiltAngle',
        type: 'value',
        args: [menuField('DIRECTION', TiltAngleDirectionMenuLower, TiltAngleDirectionMenuValue)],
    },
    { name: 'display_text', opcode: 'microbitMore_display', args: [textArg('TEXT', 'Hello!')] },
    {
        name: 'display_text_delay',
        opcode: 'microbitMore_displayText',
        args: [textArg('TEXT', 'Hello!'), numberArg('DELAY', 120)],
    },
    { name: 'clear_display', opcode: 'microbitMore_displayClear' },
    ...REPORTERS,
    { name: 'magnetic_force', opcode: 'microbitMore_getMagneticForce', type: 'value', args: [axisField()] },
    { name: 'acceleration', opcode: 'microbitMore_getAcceleration', type: 'value', args: [axisField()] },
    {
        name: 'analog_value',
        opcode: 'microbitMore_getAnalogValue',
        type: 'value',
        args: [menuField('PIN', AnalogInPin, AnalogIn)],
    },
    {
        name: 'set_pin_to_input_pull',
        opcode: 'microbitMore_setPullMode',
        args: [pinField(), menuField('MODE', PinModeMenuLower, PinModeMenu)],
    },
    { name: 'is_pin_high?', opcode: 'microbitMore_isPinHigh', type: 'value_boolean', args: [pinField()] },
    {
        name: 'set_digital',
        opcode: 'microbitMore_setDigitalOut',
        args: [
            pinField(),
            menuInputArg('LEVEL', 'microbitMore_menu_digitalValueMenu', 'digitalValueMenu', 'false', {
                ...lookUp(DigitalValueMenuLower, DigitalValueMenuValue),
                stringOnly: true,
            }),
        ],
    },
    { name: 'set_analog', opcode: 'microbitMore_setAnalogOut', args: [pinField(), numberArg('LEVEL', 0)] },
    { name: 'set_servo', opcode: 'microbitMore_setServo', args: [pinField(), numberArg('ANGLE', 0)] },
    {
        name: 'play_tone',
        opcode: 'microbitMore_playTone',
        args: [numberArg('FREQ', 440), numberArg('VOL', 100)],
    },
    { name: 'stop_tone', opcode: 'microbitMore_stopTone' },
    {
        name: 'listen_event_on',
        opcode: 'microbitMore_listenPinEventType',
        args: [menuField('EVENT_TYPE', PinEventTypeMenuLower, PinEventTypeMenuValue), pinField()],
    },
    {
        name: 'when_data_received_from_microbit',
        opcode: 'microbitMore_whenDataReceived',
        hat: true,
        args: [textArg('LABEL', 'label-01')],
    },
].map((row) => ({ receiver: MicrobitMore, changesReceiver: true, ...row }));

/**
 * Register modern micro:bit More API handlers (receiver: 'microbit').
 * @param {object} converter - The RubyToBlocksConverter instance
 */
const registerModernHandlers = function (converter) {
    converter.registerOnSend('self', MicrobitMore, 0, (params) => {
        const { node } = params;
        return converter.createRubyExpressionBlock(MicrobitMore, node);
    });

    registerSendTable(converter, MICROBIT_MORE_SENDS);

    converter.registerOnSendWithBlock(MicrobitMore, 'when_pin_connected', 1, 0, (params) => {
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

    const displayPatternHandler5 = (params) => {
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
    };

    converter.registerOnSend(MicrobitMore, 'display_pattern', 5, displayPatternHandler5);

    // backward compatibility: microbit.display(...) was renamed to display_pattern
    converter.registerOnSend(MicrobitMore, 'display', 5, displayPatternHandler5);

    converter.registerOnSend(MicrobitMore, 'display_pattern', 1, (params) => {
        const { receiver, args } = params;

        if (!converter.isBlock(args[0])) return null;

        const block = converter.changeRubyExpressionBlock(receiver, 'microbitMore_displayMatrix', 'statement');
        converter.addFieldInput(block, 'MATRIX', 'matrix', 'MATRIX', args[0], '0101010101100010101000100');
        return block;
    });

    converter.registerOnSendWithBlock(MicrobitMore, 'when_catch_at_pin', 2, 0, (params) => {
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

    converter.registerOnSend(MicrobitMore, 'value_of', 2, (params) => {
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

    converter.registerOnSend(MicrobitMore, 'data', 0, (params) => {
        const { receiver, node } = params;

        const block = converter.changeRubyExpressionBlock(receiver, 'ruby_expression', 'value_boolean');
        block.node = node;
        converter.addInput(block, 'EXPRESSION', converter.createTextBlock(MicrobitMoreData));
        return block;
    });

    converter.registerOnSend(MicrobitMoreData, '[]', 1, (params) => {
        const { receiver, args } = params;

        if (!converter.isStringOrBlock(args[0])) return null;

        const block = converter.changeRubyExpressionBlock(receiver, 'microbitMore_getDataLabeled', 'value');
        converter.addTextInput(block, 'LABEL', args[0], 'label-01');
        return block;
    });

    converter.registerOnSend(MicrobitMore, 'send_data_to_microbit', 2, (params) => {
        const { receiver, args } = params;

        if (!converter.isStringOrBlock(args[0])) return null;
        if (!converter.isStringOrBlock(args[1])) return null;

        const block = converter.changeRubyExpressionBlock(receiver, 'microbitMore_sendData', 'statement');
        converter.addTextInput(block, 'LABEL', args[1], 'label-01');
        converter.addTextInput(block, 'DATA', args[0], 'data');
        return block;
    });
};

export { MICROBIT_MORE_SENDS };
export default registerModernHandlers;
