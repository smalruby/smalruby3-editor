// === Smalruby: This file is Smalruby-specific (modern micro:bit More API handlers) ===

import Primitive from './primitive';
import {
    MicrobitMore, MicrobitMoreData,
    ButtonIDMenu, ButtonIDMenuLower, ButtonEventMenu,
    TouchIDMenu, TouchIDMenuLower, TouchEventMenu,
    GestureMenuLower, GestureMenuValue,
    AnalogIn, AnalogInPin, Gpio, GpioPin,
    AccelerationMenu,
    PinModeMenu, PinModeMenuLower,
    DigitalValueMenuLower, DigitalValueMenuValue,
    PinEventTypeMenuLower, PinEventTypeMenuValue,
    PinEventMenuLower, PinEventMenuValue,
    ConnectionStateMenu,
    TouchPinIDMenuLower, TouchPinIDMenuValue,
    TiltDirectionMenuLower, TiltDirectionMenuValue,
    TiltAngleDirectionMenuLower, TiltAngleDirectionMenuValue
} from './microbit-more-menus';

/**
 * Register modern micro:bit More API handlers (receiver: 'microbit').
 * @param {object} converter - The RubyToBlocksConverter instance
 */
const registerModernHandlers = function (converter) {
    converter.registerOnSend('self', MicrobitMore, 0, params => {
        const {node} = params;
        return converter.createRubyExpressionBlock(MicrobitMore, node);
    });

    converter.registerOnSendWithBlock(MicrobitMore, 'when_microbit', 1, 0, params => {
        const {receiver, args, rubyBlock} = params;

        if (!converter.isString(args[0])) return null;
        const index = ConnectionStateMenu.indexOf(args[0].toString().toLowerCase());
        if (index < 0) return null;
        args[0] = new Primitive('str', ConnectionStateMenu[index], args[0].node);

        const block = converter.changeRubyExpressionBlock(receiver, 'microbitMore_whenConnectionChanged', 'hat');
        converter.addField(block, 'STATE', args[0]);
        converter.setParent(rubyBlock, block);
        return block;
    });

    converter.registerOnSendWithBlock(MicrobitMore, 'when_button_is', 2, 0, params => {
        const {receiver, args, rubyBlock} = params;

        if (converter.isString(args[0])) {
            const index = ButtonIDMenuLower.indexOf(args[0].toString().toLowerCase());
            if (index < 0) return null;
            args[0] = new Primitive('str', ButtonIDMenu[index], args[0].node);
        } else {
            return null;
        }
        if (converter.isString(args[1])) {
            const index = ButtonEventMenu.indexOf(args[1].toString().toLowerCase());
            if (index < 0) return null;
            args[1] = new Primitive('str', ButtonEventMenu[index], args[1].node);
        } else {
            return null;
        }

        const block = converter.changeRubyExpressionBlock(receiver, 'microbitMore_whenButtonEvent', 'hat');
        converter.addField(block, 'NAME', args[0]);
        converter.addField(block, 'EVENT', args[1]);
        converter.setParent(rubyBlock, block);
        return block;
    });

    converter.registerOnSend(MicrobitMore, 'button_pressed?', 1, params => {
        const {receiver, args} = params;

        if (converter.isString(args[0])) {
            const index = ButtonIDMenuLower.indexOf(args[0].toString().toLowerCase());
            if (index < 0) return null;
            args[0] = new Primitive('str', ButtonIDMenu[index], args[0].node);
        } else {
            return null;
        }

        const block =
            converter.changeRubyExpressionBlock(receiver, 'microbitMore_isButtonPressed', 'value_boolean');
        converter.addField(block, 'NAME', args[0]);
        return block;
    });

    converter.registerOnSendWithBlock(MicrobitMore, 'when_pin_is', 2, 0, params => {
        const {receiver, args, rubyBlock} = params;

        if (converter.isString(args[0])) {
            const index = TouchIDMenuLower.indexOf(args[0].toString().toLowerCase());
            if (index < 0) return null;
            args[0] = new Primitive('str', TouchIDMenu[index], args[0].node);
        } else {
            return null;
        }

        if (converter.isString(args[1])) {
            const event = TouchEventMenu[args[1].toString().toLowerCase()];
            if (!event) return null;
            args[1] = new Primitive('str', event, args[1].node);
        } else {
            return null;
        }

        const block = converter.changeRubyExpressionBlock(receiver, 'microbitMore_whenTouchEvent', 'hat');
        converter.addField(block, 'NAME', args[0]);
        converter.addField(block, 'EVENT', args[1]);
        converter.setParent(rubyBlock, block);
        return block;
    });

    converter.registerOnSend(MicrobitMore, 'pin_is_touched?', 1, params => {
        const {receiver, args} = params;

        if (converter.isString(args[0])) {
            const index = TouchIDMenuLower.indexOf(args[0].toString().toLowerCase());
            if (index < 0) return null;
            args[0] = new Primitive('str', TouchIDMenu[index], args[0].node);
        } else {
            return null;
        }

        const block =
            converter.changeRubyExpressionBlock(receiver, 'microbitMore_isPinTouched', 'value_boolean');
        converter.addField(block, 'NAME', args[0]);
        return block;
    });

    converter.registerOnSendWithBlock(MicrobitMore, 'when', 1, 0, params => {
        const {receiver, args, rubyBlock} = params;

        if (converter.isString(args[0])) {
            const index = GestureMenuLower.indexOf(args[0].toString().toLowerCase());
            if (index < 0) return null;
            args[0] = new Primitive('str', GestureMenuValue[index], args[0].node);
        } else {
            return null;
        }

        const block = converter.changeRubyExpressionBlock(receiver, 'microbitMore_whenGesture', 'hat');
        converter.addField(block, 'GESTURE', args[0]);
        converter.setParent(rubyBlock, block);
        return block;
    });

    converter.registerOnSendWithBlock(MicrobitMore, 'when_tilted', 1, 0, params => {
        const {receiver, args, rubyBlock} = params;

        if (converter.isString(args[0])) {
            const index = TiltDirectionMenuLower.indexOf(args[0].toString().toLowerCase());
            if (index < 0) return null;
            args[0] = new Primitive('str', TiltDirectionMenuValue[index], args[0].node);
        } else {
            return null;
        }

        const block = converter.changeRubyExpressionBlock(receiver, 'microbitMore_whenTilted', 'hat');
        converter.addField(block, 'DIRECTION', args[0]);
        converter.setParent(rubyBlock, block);
        return block;
    });

    converter.registerOnSendWithBlock(MicrobitMore, 'when_pin_connected', 1, 0, params => {
        const {receiver, args, rubyBlock} = params;

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

    converter.registerOnSend(MicrobitMore, 'tilted?', 1, params => {
        const {receiver, args} = params;

        if (converter.isString(args[0])) {
            const index = TiltDirectionMenuLower.indexOf(args[0].toString().toLowerCase());
            if (index < 0) return null;
            args[0] = new Primitive('str', TiltDirectionMenuValue[index], args[0].node);
        } else {
            return null;
        }

        const block =
            converter.changeRubyExpressionBlock(receiver, 'microbitMore_isTilted', 'value_boolean');
        converter.addField(block, 'DIRECTION', args[0]);
        return block;
    });

    converter.registerOnSend(MicrobitMore, 'tilt_angle', 1, params => {
        const {receiver, args} = params;

        if (converter.isString(args[0])) {
            const index = TiltAngleDirectionMenuLower.indexOf(args[0].toString().toLowerCase());
            if (index < 0) return null;
            args[0] = new Primitive('str', TiltAngleDirectionMenuValue[index], args[0].node);
        } else {
            return null;
        }

        const block = converter.changeRubyExpressionBlock(receiver, 'microbitMore_getTiltAngle', 'value');
        converter.addField(block, 'DIRECTION', args[0]);
        return block;
    });

    const displayPatternHandler5 = params => {
        const {receiver, args} = params;

        if (!args.every(x => converter.isString(x))) return null;

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

    converter.registerOnSend(MicrobitMore, 'display_pattern', 1, params => {
        const {receiver, args} = params;

        if (!converter.isBlock(args[0])) return null;

        const block = converter.changeRubyExpressionBlock(receiver, 'microbitMore_displayMatrix', 'statement');
        converter.addFieldInput(block, 'MATRIX', 'matrix', 'MATRIX', args[0], '0101010101100010101000100');
        return block;
    });

    converter.registerOnSend(MicrobitMore, 'display_text', 1, params => {
        const {receiver, args} = params;

        if (!converter.isStringOrBlock(args[0])) return null;

        const block = converter.changeRubyExpressionBlock(receiver, 'microbitMore_display', 'statement');
        converter.addTextInput(block, 'TEXT', args[0], 'Hello!');
        return block;
    });

    converter.registerOnSend(MicrobitMore, 'display_text_delay', 2, params => {
        const {receiver, args} = params;

        if (!converter.isStringOrBlock(args[0])) return null;
        if (!converter.isNumberOrBlock(args[1])) return null;

        const block = converter.changeRubyExpressionBlock(receiver, 'microbitMore_displayText', 'statement');
        converter.addTextInput(block, 'TEXT', args[0], 'Hello!');
        converter.addNumberInput(block, 'DELAY', 'math_number', args[1], 120);
        return block;
    });

    converter.registerOnSend(MicrobitMore, 'clear_display', 0, params => {
        const {receiver} = params;
        return converter.changeRubyExpressionBlock(receiver, 'microbitMore_displayClear', 'statement');
    });

    converter.registerOnSend(MicrobitMore, 'light_intensity', 0, params => {
        const {receiver} = params;
        return converter.changeRubyExpressionBlock(receiver, 'microbitMore_getLightLevel', 'value');
    });

    converter.registerOnSend(MicrobitMore, 'temperature', 0, params => {
        const {receiver} = params;
        return converter.changeRubyExpressionBlock(receiver, 'microbitMore_getTemperature', 'value');
    });

    converter.registerOnSend(MicrobitMore, 'angle_with_north', 0, params => {
        const {receiver} = params;
        return converter.changeRubyExpressionBlock(receiver, 'microbitMore_getCompassHeading', 'value');
    });

    converter.registerOnSend(MicrobitMore, 'pitch', 0, params => {
        const {receiver} = params;
        return converter.changeRubyExpressionBlock(receiver, 'microbitMore_getPitch', 'value');
    });

    converter.registerOnSend(MicrobitMore, 'roll', 0, params => {
        const {receiver} = params;
        return converter.changeRubyExpressionBlock(receiver, 'microbitMore_getRoll', 'value');
    });

    converter.registerOnSend(MicrobitMore, 'sound_level', 0, params => {
        const {receiver} = params;
        return converter.changeRubyExpressionBlock(receiver, 'microbitMore_getSoundLevel', 'value');
    });

    converter.registerOnSend(MicrobitMore, 'magnetic_force', 1, params => {
        const {receiver, args} = params;

        if (converter.isString(args[0])) {
            const index = AccelerationMenu.indexOf(args[0].toString().toLowerCase());
            if (index < 0) return null;
            args[0] = new Primitive('str', AccelerationMenu[index], args[0].node);
        } else {
            return null;
        }

        const block = converter.changeRubyExpressionBlock(receiver, 'microbitMore_getMagneticForce', 'value');
        converter.addField(block, 'AXIS', args[0]);
        return block;
    });

    converter.registerOnSend(MicrobitMore, 'acceleration', 1, params => {
        const {receiver, args} = params;

        if (converter.isString(args[0])) {
            const index = AccelerationMenu.indexOf(args[0].toString().toLowerCase());
            if (index < 0) return null;
            args[0] = new Primitive('str', AccelerationMenu[index], args[0].node);
        } else {
            return null;
        }

        const block = converter.changeRubyExpressionBlock(receiver, 'microbitMore_getAcceleration', 'value');
        converter.addField(block, 'AXIS', args[0]);
        return block;
    });

    converter.registerOnSend(MicrobitMore, 'analog_value', 1, params => {
        const {receiver, args} = params;

        if (converter.isString(args[0])) {
            const index = AnalogInPin.indexOf(args[0].toString().toLowerCase());
            if (index < 0) return null;
            args[0] = new Primitive('int', AnalogIn[index], args[0].node);
        } else {
            return null;
        }

        const block = converter.changeRubyExpressionBlock(receiver, 'microbitMore_getAnalogValue', 'value');
        converter.addField(block, 'PIN', args[0]);
        return block;
    });

    converter.registerOnSend(MicrobitMore, 'set_pin_to_input_pull', 2, params => {
        const {receiver, args} = params;

        if (converter.isString(args[0])) {
            const index = GpioPin.indexOf(args[0].toString().toLowerCase());
            if (index < 0) return null;
            args[0] = new Primitive('int', Gpio[index], args[0].node);
        } else {
            return null;
        }
        if (converter.isString(args[1])) {
            const index = PinModeMenuLower.indexOf(args[1].toString().toLowerCase());
            if (index < 0) return null;
            args[1] = new Primitive('str', PinModeMenu[index], args[1].node);
        } else {
            return null;
        }

        const block = converter.changeRubyExpressionBlock(receiver, 'microbitMore_setPullMode', 'statement');
        converter.addField(block, 'PIN', args[0]);
        converter.addField(block, 'MODE', args[1]);
        return block;
    });

    converter.registerOnSend(MicrobitMore, 'is_pin_high?', 1, params => {
        const {receiver, args} = params;

        if (converter.isString(args[0])) {
            const index = GpioPin.indexOf(args[0].toString().toLowerCase());
            if (index < 0) return null;
            args[0] = new Primitive('int', Gpio[index], args[0].node);
        } else {
            return null;
        }

        const block = converter.changeRubyExpressionBlock(receiver, 'microbitMore_isPinHigh', 'value_boolean');
        converter.addField(block, 'PIN', args[0]);
        return block;
    });

    converter.registerOnSend(MicrobitMore, 'set_digital', 2, params => {
        const {receiver, args} = params;

        if (converter.isString(args[0])) {
            const index = GpioPin.indexOf(args[0].toString().toLowerCase());
            if (index < 0) return null;
            args[0] = new Primitive('int', Gpio[index], args[0].node);
        } else {
            return null;
        }
        if (converter.isString(args[1])) {
            const index = DigitalValueMenuLower.indexOf(args[1].toString().toLowerCase());
            if (index < 0) return null;
            args[1] = new Primitive('str', DigitalValueMenuValue[index], args[0].node);
        } else {
            return null;
        }

        const block = converter.changeRubyExpressionBlock(receiver, 'microbitMore_setDigitalOut', 'statement');
        converter.addField(block, 'PIN', args[0]);
        converter.addFieldInput(block, 'LEVEL', 'microbitMore_menu_digitalValueMenu', 'digitalValueMenu',
            args[1], 'false');
        return block;
    });

    converter.registerOnSend(MicrobitMore, 'set_analog', 2, params => {
        const {receiver, args} = params;

        if (converter.isString(args[0])) {
            const index = GpioPin.indexOf(args[0].toString().toLowerCase());
            if (index < 0) return null;
            args[0] = new Primitive('int', Gpio[index], args[0].node);
        } else {
            return null;
        }
        if (!converter.isNumberOrBlock(args[1])) return null;

        const block = converter.changeRubyExpressionBlock(receiver, 'microbitMore_setAnalogOut', 'statement');
        converter.addField(block, 'PIN', args[0]);
        converter.addNumberInput(block, 'LEVEL', 'math_number', args[1], 0);
        return block;
    });

    converter.registerOnSend(MicrobitMore, 'set_servo', 2, params => {
        const {receiver, args} = params;

        if (converter.isString(args[0])) {
            const index = GpioPin.indexOf(args[0].toString().toLowerCase());
            if (index < 0) return null;
            args[0] = new Primitive('int', Gpio[index], args[0].node);
        } else {
            return null;
        }

        if (!converter.isNumberOrBlock(args[1])) return null;

        const block = converter.changeRubyExpressionBlock(receiver, 'microbitMore_setServo', 'statement');
        converter.addField(block, 'PIN', args[0]);
        converter.addNumberInput(block, 'ANGLE', 'math_number', args[1], 0);
        return block;
    });

    converter.registerOnSend(MicrobitMore, 'play_tone', 2, params => {
        const {receiver, args} = params;

        if (!converter.isNumberOrBlock(args[0])) return null;
        if (!converter.isNumberOrBlock(args[1])) return null;

        const block = converter.changeRubyExpressionBlock(receiver, 'microbitMore_playTone', 'statement');
        converter.addNumberInput(block, 'FREQ', 'math_number', args[0], 440);
        converter.addNumberInput(block, 'VOL', 'math_number', args[1], 100);
        return block;
    });

    converter.registerOnSend(MicrobitMore, 'stop_tone', 0, params => {
        const {receiver} = params;
        return converter.changeRubyExpressionBlock(receiver, 'microbitMore_stopTone', 'statement');
    });

    converter.registerOnSend(MicrobitMore, 'listen_event_on', 2, params => {
        const {receiver, args} = params;

        if (converter.isString(args[0])) {
            const index = PinEventTypeMenuLower.indexOf(args[0].toString().toLowerCase());
            if (index < 0) return null;
            args[0] = new Primitive('str', PinEventTypeMenuValue[index], args[0].node);
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

        const block = converter.changeRubyExpressionBlock(
            receiver, 'microbitMore_listenPinEventType', 'statement'
        );
        converter.addField(block, 'EVENT_TYPE', args[0]);
        converter.addField(block, 'PIN', args[1]);
        return block;
    });

    converter.registerOnSendWithBlock(MicrobitMore, 'when_catch_at_pin', 2, 0, params => {
        const {receiver, args, rubyBlock} = params;

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

    converter.registerOnSend(MicrobitMore, 'value_of', 2, params => {
        const {receiver, args} = params;

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

    converter.registerOnSendWithBlock(MicrobitMore, 'when_data_received_from_microbit', 1, 0, params => {
        const {receiver, args, rubyBlock} = params;

        if (!converter.isStringOrBlock(args[0])) return null;

        const block = converter.changeRubyExpressionBlock(receiver, 'microbitMore_whenDataReceived', 'hat');
        converter.addTextInput(block, 'LABEL', args[0], 'label-01');
        converter.setParent(rubyBlock, block);
        return block;
    });

    converter.registerOnSend(MicrobitMore, 'data', 0, params => {
        const {receiver, node} = params;

        const block = converter.changeRubyExpressionBlock(receiver, 'ruby_expression', 'value_boolean');
        block.node = node;
        converter.addInput(block, 'EXPRESSION', converter.createTextBlock(MicrobitMoreData));
        return block;
    });

    converter.registerOnSend(MicrobitMoreData, '[]', 1, params => {
        const {receiver, args} = params;

        if (!converter.isStringOrBlock(args[0])) return null;

        const block = converter.changeRubyExpressionBlock(receiver, 'microbitMore_getDataLabeled', 'value');
        converter.addTextInput(block, 'LABEL', args[0], 'label-01');
        return block;
    });

    converter.registerOnSend(MicrobitMore, 'send_data_to_microbit', 2, params => {
        const {receiver, args} = params;

        if (!converter.isStringOrBlock(args[0])) return null;
        if (!converter.isStringOrBlock(args[1])) return null;

        const block = converter.changeRubyExpressionBlock(receiver, 'microbitMore_sendData', 'statement');
        converter.addTextInput(block, 'LABEL', args[1], 'label-01');
        converter.addTextInput(block, 'DATA', args[0], 'data');
        return block;
    });
};

export default registerModernHandlers;
