import { anyCase, menuInputArg, numberArg, registerSendTable } from './send-table';

const Wedo2 = 'wedo2';

const MotorIdMenu = ['motor', 'motor A', 'motor B', 'all motors'];

const MotorDirectionMenu = ['this way', 'that way', 'reverse'];

const OpMenu = ['<', '>'];

const TiltDirectionAnyMenu = ['up', 'down', 'left', 'right', 'any'];

const TiltDirectionMenu = TiltDirectionAnyMenu.slice(0, 4);

// A menu of WeDo 2.0: a string (looked up without regard to case) or a value block.
const wedo2Menu = (name, choices, defaultValue) =>
    menuInputArg(name, `wedo2_menu_${name}`, name, defaultValue, { choices, normalize: anyCase(choices) });
const motorArg = () => wedo2Menu('MOTOR_ID', MotorIdMenu, 'motor');

// The calls that map one to one onto a block (send-table.js).
const WEDO2_SENDS = [
    {
        name: 'turn_on_for',
        opcode: 'wedo2_motorOnFor',
        args: [motorArg(), numberArg('DURATION', 1)],
    },
    { name: 'turn_on', opcode: 'wedo2_motorOn', args: [motorArg()] },
    { name: 'turn_off', opcode: 'wedo2_motorOff', args: [motorArg()] },
    {
        name: 'set_power',
        opcode: 'wedo2_startMotorPower',
        args: [motorArg(), numberArg('POWER', 100)],
    },
    {
        name: 'set_direction',
        opcode: 'wedo2_setMotorDirection',
        args: [motorArg(), wedo2Menu('MOTOR_DIRECTION', MotorDirectionMenu, 'this way')],
    },
    { name: 'light_color=', opcode: 'wedo2_setLightHue', args: [numberArg('HUE', 50)] },
    {
        name: 'when_distance',
        opcode: 'wedo2_whenDistance',
        hat: true,
        // The operator is taken as it is written (no case).
        args: [menuInputArg('OP', 'wedo2_menu_OP', 'OP', '<', { choices: OpMenu }), numberArg('REFERENCE', 50)],
    },
    {
        name: 'when_tilted',
        opcode: 'wedo2_whenTilted',
        hat: true,
        args: [wedo2Menu('TILT_DIRECTION_ANY', TiltDirectionAnyMenu, 'any')],
    },
    { name: 'distance', opcode: 'wedo2_getDistance', type: 'value' },
    {
        name: 'tilted?',
        opcode: 'wedo2_isTilted',
        type: 'value_boolean',
        args: [wedo2Menu('TILT_DIRECTION_ANY', TiltDirectionAnyMenu, 'any')],
    },
    {
        name: 'tilt_angle',
        opcode: 'wedo2_getTiltAngle',
        // A boolean type of a block that gives a number: kept as it was.
        type: 'value_boolean',
        args: [wedo2Menu('TILT_DIRECTION', TiltDirectionMenu, 'up')],
    },
].map((row) => ({ receiver: Wedo2, changesReceiver: true, ...row }));

/**
 * Wedo2 converter
 */
const Wedo2Converter = {
    sends: WEDO2_SENDS,

    register: function (converter) {
        // `wedo2` itself is a Ruby expression that the calls of the table turn into their blocks.
        converter.registerOnSend('self', Wedo2, 0, (params) => {
            const { node } = params;

            return converter.createRubyExpressionBlock(Wedo2, node);
        });

        registerSendTable(converter, WEDO2_SENDS);
    },
};

export default Wedo2Converter;
