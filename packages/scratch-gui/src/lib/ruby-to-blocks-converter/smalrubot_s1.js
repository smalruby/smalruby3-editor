import { fieldArg, numberArg, registerSendTable } from './send-table';
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

// The calls of `studuino.xxx` that map one to one onto a block (send-table.js).
const STUDUINO_CALLS = [
    { name: 'action', opcode: 'smalrubotS1_action', args: [fieldArg('ACTION', ACTIONS)] },
    {
        name: 'action',
        opcode: 'smalrubotS1_actionAndStopAfter',
        args: [fieldArg('ACTION', ACTIONS), numberArg('SECS', 0.5)],
    },
    { name: 'bend_arm', opcode: 'smalrubotS1_bendArm', args: [numberArg('DEGREE', 90), numberArg('SECS', 1)] },
    {
        name: 'sensor_value',
        opcode: 'smalrubotS1_getSensorValue',
        type: 'value',
        args: [fieldArg('POSITION', SENSOR_POSITIONS)],
    },
    {
        name: 'get_motor_speed',
        opcode: 'smalrubotS1_getMotorSpeed',
        type: 'value',
        args: [fieldArg('POSITION', POSITIONS)],
    },
    {
        name: 'set_motor_speed',
        opcode: 'smalrubotS1_setMotorSpeed',
        args: [fieldArg('POSITION', POSITIONS), numberArg('SPEED', 100)],
    },
    {
        name: 'dc_motor',
        opcode: 'smalrubotS1_controlMotor',
        args: [fieldArg('MOTOR', MOTORS), fieldArg('DIRECTION', MOTOR_DIRECTIONS)],
    },
    {
        name: 'dc_motor',
        opcode: 'smalrubotS1_controlMotorAndStopAfter',
        args: [fieldArg('MOTOR', MOTORS), fieldArg('DIRECTION', MOTOR_DIRECTIONS), numberArg('SECS', 0.5)],
    },
    { name: 'arm_calibration=', opcode: 'smalrubotS1_setArmCalibration', args: [numberArg('DEGREE', 0)] },
];

const STUDUINO_SENDS = RECEIVERS.flatMap((receiver) =>
    STUDUINO_CALLS.map((row) => ({ receiver, changesReceiver: true, ...row })),
);

/**
 * The calls of `studuino.xxx` below are the blocks of normal mode (running while connected). A
 * program of Studuino mode cannot use them (docs/studuino-mode/README.md, #2218).
 * @param {object} converter - The Ruby to blocks converter.
 * @param {object} params - The params of the call.
 * @returns {null} null (so that the next handler converts the call) when it is not a program of
 *     Studuino mode; otherwise it throws the error of conversion.
 */
const rejectInStuduinoMode = (converter, params) => {
    if (converter._isStuduinoModeCode()) {
        throw converter._studuinoError(params.node, 'studuinoNormalModeCall', {
            SOURCE: converter._truncateSource(converter._getSource(params.node)),
        });
    }
    return null;
};

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

    // `led` picks the opcode by its second argument (`true` / `false`): it stays a handler.
    converter.registerOnSend(receiverName, 'led', 2, (params) => {
        rejectInStuduinoMode(converter, params);
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
};

/**
 * Studuino (Smalrubot S1) extension converter
 */
const SmalrubotS1Converter = {
    sends: STUDUINO_SENDS,

    register: function (converter) {
        RECEIVERS.forEach((receiver) => registerForReceiver(converter, receiver));
        // Registered before the table so that it is tried first (converter-registry.js).
        STUDUINO_SENDS.forEach((row) =>
            converter.registerOnSend(row.receiver, row.name, row.args.length, (params) =>
                rejectInStuduinoMode(converter, params),
            ),
        );
        registerSendTable(converter, STUDUINO_SENDS);
        // Studuino mode: `studuino.<part>_<port>` (#2218)
        registerStuduinoParts(converter);
    },
};

export default SmalrubotS1Converter;
