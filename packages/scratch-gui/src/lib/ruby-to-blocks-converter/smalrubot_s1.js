import _ from 'lodash';
import { registerStuduinoParts } from './studuino-mode';

// Ruby is written with `studuino.` (#2190). `smalrubot_s1.` is still read so that older programs
// and teaching materials open as blocks. Both receivers share the same table below.
const RECEIVERS = ['studuino', 'smalrubot_s1'];

const ACTIONS = ['forward', 'backward', 'left', 'right', 'stop'];

const POSITIONS = ['left', 'right'];

const MOTORS = ['M1', 'M2'];

const MOTOR_DIRECTIONS = ['normal', 'reverse', 'stop'];

// `ir_a4` / `ir_a5` are the textbook names of `left` / `right` (#2189). Only add values, never remove them.
const SENSOR_POSITIONS = ['left', 'right', 'touch', 'light', 'sound', 'ir_a4', 'ir_a5'];

/**
 * Register the conversions for one receiver name.
 * @param {object} converter - The Ruby to blocks converter.
 * @param {string} receiverName - The receiver name (`studuino` or `smalrubot_s1`).
 */
const registerForReceiver = (converter, receiverName) => {
    // Create the initial Ruby expression block
    converter.registerOnSend('self', receiverName, 0, (params) => {
        const { node } = params;

        return converter.createRubyExpressionBlock(receiverName, node);
    });

    // The methods below are the blocks of normal mode (running while connected). A program of
    // Studuino mode cannot use them (docs/studuino-mode/README.md, #2218).
    const registerOnSend = (name, numArgs, createBlockFunc) =>
        converter.registerOnSend(receiverName, name, numArgs, (params) => {
            if (converter._isStuduinoModeCode()) {
                throw converter._studuinoError(params.node, 'studuinoNormalModeCall', {
                    SOURCE: converter._truncateSource(converter._getSource(params.node)),
                });
            }
            return createBlockFunc(params);
        });

    // Method calls on the receiver
    registerOnSend('action', 1, (params) => {
        const { receiver, args } = params;

        if (!converter.isString(args[0]) || !ACTIONS.includes(args[0].toString())) return null;

        const block = converter.changeRubyExpressionBlock(receiver, 'smalrubotS1_action', 'statement');
        converter.addField(block, 'ACTION', args[0]);
        return block;
    });

    registerOnSend('action', 2, (params) => {
        const { receiver, args } = params;

        if (
            !converter.isString(args[0]) ||
            !ACTIONS.includes(args[0].toString()) ||
            !converter.isNumberOrBlock(args[1])
        )
            return null;

        const block = converter.changeRubyExpressionBlock(receiver, 'smalrubotS1_actionAndStopAfter', 'statement');
        converter.addField(block, 'ACTION', args[0]);
        converter.addNumberInput(block, 'SECS', 'math_number', args[1], 0.5);
        return block;
    });

    registerOnSend('bend_arm', 2, (params) => {
        const { receiver, args } = params;

        if (!converter.isNumberOrBlock(args[0]) || !converter.isNumberOrBlock(args[1])) return null;

        const block = converter.changeRubyExpressionBlock(receiver, 'smalrubotS1_bendArm', 'statement');
        converter.addNumberInput(block, 'DEGREE', 'math_number', args[0], 90);
        converter.addNumberInput(block, 'SECS', 'math_number', args[1], 1);
        return block;
    });

    registerOnSend('sensor_value', 1, (params) => {
        const { receiver, args } = params;

        if (!converter.isString(args[0]) || !SENSOR_POSITIONS.includes(args[0].toString())) return null;

        const block = converter.changeRubyExpressionBlock(receiver, 'smalrubotS1_getSensorValue', 'value');
        converter.addField(block, 'POSITION', args[0]);
        return block;
    });

    registerOnSend('led', 2, (params) => {
        const { receiver, args } = params;

        if (
            !converter.isString(args[0]) ||
            !POSITIONS.includes(args[0].toString()) ||
            (!converter.isTrue(args[1]) && !converter.isFalse(args[1]))
        )
            return null;

        let opcode = 'smalrubotS1_turnLedOn';
        if (converter.isFalse(args[1])) {
            opcode = 'smalrubotS1_turnLedOff';
        }
        const block = converter.changeRubyExpressionBlock(receiver, opcode, 'statement');
        converter.addField(block, 'POSITION', args[0]);
        // Only the literal's value picks the opcode: drop its `1 = 1` / `0 < 0` block.
        converter.discardValue(args[1]);
        return block;
    });

    registerOnSend('get_motor_speed', 1, (params) => {
        const { receiver, args } = params;

        if (!converter.isString(args[0]) || !POSITIONS.includes(args[0].toString())) return null;

        const block = converter.changeRubyExpressionBlock(receiver, 'smalrubotS1_getMotorSpeed', 'value');
        converter.addField(block, 'POSITION', args[0]);
        return block;
    });

    registerOnSend('set_motor_speed', 2, (params) => {
        const { receiver, args } = params;

        if (
            !converter.isString(args[0]) ||
            !POSITIONS.includes(args[0].toString()) ||
            !converter.isNumberOrBlock(args[1])
        )
            return null;

        const block = converter.changeRubyExpressionBlock(receiver, 'smalrubotS1_setMotorSpeed', 'statement');
        converter.addField(block, 'POSITION', args[0]);
        converter.addNumberInput(block, 'SPEED', 'math_number', args[1], 100);
        return block;
    });

    const isMotorAndDirection = (args) =>
        converter.isString(args[0]) &&
        MOTORS.includes(args[0].toString()) &&
        converter.isString(args[1]) &&
        MOTOR_DIRECTIONS.includes(args[1].toString());

    registerOnSend('dc_motor', 2, (params) => {
        const { receiver, args } = params;

        if (!isMotorAndDirection(args)) return null;

        const block = converter.changeRubyExpressionBlock(receiver, 'smalrubotS1_controlMotor', 'statement');
        converter.addField(block, 'MOTOR', args[0]);
        converter.addField(block, 'DIRECTION', args[1]);
        return block;
    });

    registerOnSend('dc_motor', 3, (params) => {
        const { receiver, args } = params;

        if (!isMotorAndDirection(args) || !converter.isNumberOrBlock(args[2])) return null;

        const block = converter.changeRubyExpressionBlock(
            receiver,
            'smalrubotS1_controlMotorAndStopAfter',
            'statement',
        );
        converter.addField(block, 'MOTOR', args[0]);
        converter.addField(block, 'DIRECTION', args[1]);
        converter.addNumberInput(block, 'SECS', 'math_number', args[2], 0.5);
        return block;
    });

    registerOnSend('arm_calibration=', 1, (params) => {
        const { receiver, args } = params;

        if (!converter.isNumberOrBlock(args[0])) return null;

        const block = converter.changeRubyExpressionBlock(receiver, 'smalrubotS1_setArmCalibration', 'statement');
        converter.addNumberInput(block, 'DEGREE', 'math_number', args[0], 0);
        return block;
    });
};

/**
 * Studuino (Smalrubot S1) extension converter
 */
const SmalrubotS1Converter = {
    register: function (converter) {
        RECEIVERS.forEach((receiver) => registerForReceiver(converter, receiver));
        // Studuino mode: `studuino.<part>_<port>` (#2218)
        registerStuduinoParts(converter);
    },
};

export default SmalrubotS1Converter;
