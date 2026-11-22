import { menuArg, numberArg, registerSendTable } from './send-table';

// A menu of a motor, a color, ...: a string or a value block (a string goes into the menu block).
const boostMenu = (name) => menuArg(name, `boost_menu_${name}`, name, { orBlock: true });

// The calls that map one to one onto a block (send-table.js).
const BOOST_SENDS = [
    {
        receiver: 'self',
        name: 'boost_motor_turn_on_for',
        opcode: 'boost_motorOnFor',
        args: [boostMenu('MOTOR_ID'), numberArg('DURATION', 1)],
    },
    { receiver: 'self', name: 'boost_motor_turn_on_for', opcode: 'boost_motorOn', args: [boostMenu('MOTOR_ID')] },
    {
        receiver: 'self',
        name: 'boost_motor_turn_this_way_for',
        opcode: 'boost_motorOnForRotation',
        args: [boostMenu('MOTOR_ID'), numberArg('ROTATION', 1)],
    },
    { receiver: 'self', name: 'boost_motor_turn_off_for', opcode: 'boost_motorOff', args: [boostMenu('MOTOR_ID')] },
    {
        receiver: 'self',
        name: 'boost_motor_set_power_for',
        opcode: 'boost_setMotorPower',
        args: [boostMenu('MOTOR_ID'), numberArg('POWER', 100)],
    },
    {
        receiver: 'self',
        name: 'boost_motor_set_direction_for',
        opcode: 'boost_setMotorDirection',
        args: [boostMenu('MOTOR_ID'), boostMenu('MOTOR_DIRECTION')],
    },
    {
        receiver: 'self',
        name: 'boost_motor_get_position',
        opcode: 'boost_getMotorPosition',
        type: 'value',
        args: [boostMenu('MOTOR_REPORTER_ID')],
    },
    {
        receiver: 'self',
        name: 'boost_seeing_color?',
        opcode: 'boost_seeingColor',
        type: 'value_boolean',
        args: [boostMenu('COLOR')],
    },
    {
        receiver: 'self',
        name: 'boost_get_tilt_angle',
        opcode: 'boost_getTiltAngle',
        type: 'value',
        args: [boostMenu('TILT_DIRECTION')],
    },
    { receiver: 'self', name: 'boost_set_light_color', opcode: 'boost_setLightHue', args: [numberArg('HUE', 100)] },
];

/**
 * Boost converter
 */
const BoostConverter = {
    sends: BOOST_SENDS,

    register: function (converter) {
        registerSendTable(converter, BOOST_SENDS);

        // `self.when(:boost_color, ...)` / `self.when(:boost_tilted, ...)`: the symbol chooses the hat.
        converter.registerOnSendWithBlock('self', 'when', 2, 0, (params) => {
            const { args, rubyBlock } = params;

            if (!converter._isSymbol(args[0]) || !converter.isStringOrBlock(args[1])) return null;

            let block;
            switch (converter._getSymbolValue(args[0])) {
                case 'boost_color':
                    block = converter.createBlock('boost_whenColor', 'hat');
                    converter.addInput(
                        block,
                        'COLOR',
                        converter._createFieldBlock('boost_menu_COLOR', 'COLOR', args[1]),
                    );
                    converter.setParent(rubyBlock, block);
                    break;
                case 'boost_tilted':
                    block = converter.createBlock('boost_whenTilted', 'hat');
                    converter.addInput(
                        block,
                        'TILT_DIRECTION_ANY',
                        converter._createFieldBlock('boost_menu_TILT_DIRECTION_ANY', 'TILT_DIRECTION_ANY', args[1]),
                    );
                    converter.setParent(rubyBlock, block);
                    break;
            }
            return block;
        });
    },
};

export default BoostConverter;
