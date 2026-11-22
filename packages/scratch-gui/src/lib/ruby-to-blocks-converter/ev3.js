import { menuArg, noteArg, numberArg, registerSendTable } from './send-table';

const Ev3 = 'ev3';
const Ev3MotorMenu = ['A', 'B', 'C', 'D'];
const Ev3SensorMenu = ['1', '2', '3', '4'];

// The menu of a port keeps the index of the port (`"A"` → `"0"`; a port not in the menu → `"-1"`).
const portArg = (menuOpcode, field, ports) =>
    menuArg('PORT', menuOpcode, field, { normalize: (value) => ports.indexOf(value).toString() });
const motorArg = () => portArg('ev3_menu_motorPorts', 'motorPorts', Ev3MotorMenu);
const sensorArg = () => portArg('ev3_menu_sensorPorts', 'sensorPorts', Ev3SensorMenu);

// The calls of `ev3.xxx` that map one to one onto a block (send-table.js).
const EV3_CALLS = [
    {
        name: 'motor_turn_this_way_for',
        opcode: 'ev3_motorTurnClockwise',
        args: [motorArg(), numberArg('TIME', 1)],
    },
    {
        name: 'motor_turn_that_way_for',
        opcode: 'ev3_motorTurnCounterClockwise',
        args: [motorArg(), numberArg('TIME', 1)],
    },
    { name: 'motor_set_power', opcode: 'ev3_motorSetPower', args: [motorArg(), numberArg('POWER', 100)] },
    { name: 'motor_position', opcode: 'ev3_getMotorPosition', type: 'value', args: [motorArg()] },
    { name: 'button_pressed?', opcode: 'ev3_buttonPressed', type: 'value_boolean', args: [sensorArg()] },
    { name: 'distance', opcode: 'ev3_getDistance', type: 'value' },
    { name: 'brightness', opcode: 'ev3_getBrightness', type: 'value' },
    { name: 'beep_note', opcode: 'ev3_beep', args: [noteArg('NOTE', 60), numberArg('TIME', 0.5)] },
];

const EV3_SENDS = [
    ...EV3_CALLS,
    // The port is a string only (a block is an error): the generator never writes a block there.
    { name: 'when_button_pressed', opcode: 'ev3_whenButtonPressed', hat: true, args: [sensorArg()] },
    { name: 'when_distance_lt', opcode: 'ev3_whenDistanceLessThan', hat: true, args: [numberArg('DISTANCE', 5)] },
    {
        name: 'when_brightness_lt',
        opcode: 'ev3_whenBrightnessLessThan',
        hat: true,
        args: [numberArg('DISTANCE', 50)],
    },
]
    .map((row) => ({ receiver: Ev3, changesReceiver: true, ...row }))
    // backward compatibility: the same calls named `ev3_xxx`, without the receiver.
    .concat(EV3_CALLS.map((row) => ({ ...row, receiver: 'self', name: `ev3_${row.name}` })));

/**
 * EV3 converter
 */
const EV3Converter = {
    sends: EV3_SENDS,

    register: function (converter) {
        converter.registerOnSend('self', Ev3, 0, (params) => {
            const { node } = params;

            return converter.createRubyExpressionBlock(Ev3, node);
        });

        registerSendTable(converter, EV3_SENDS);

        // backward compatibility
        converter.registerOnSendWithBlock('self', 'when', 2, 0, (params) => {
            const { args, rubyBlock } = params;

            if (!converter._isSymbol(args[0])) return null;

            let block;
            switch (converter._getSymbolValue(args[0])) {
                case 'ev3_button_pressed': {
                    // A string only, as `ev3.when_button_pressed` (a block was left connected to nothing).
                    if (!converter.isString(args[1])) return null;

                    block = converter.createBlock('ev3_whenButtonPressed', 'hat');
                    const sensor = Ev3SensorMenu.indexOf(args[1].toString());
                    converter.addInput(
                        block,
                        'PORT',
                        converter.createFieldBlock('ev3_menu_sensorPorts', 'sensorPorts', sensor.toString()),
                    );
                    converter.setParent(rubyBlock, block);
                    break;
                }

                case 'ev3_distance_gt':
                    if (!converter.isNumberOrBlock(args[1])) return null;

                    block = converter.createBlock('ev3_whenDistanceLessThan', 'hat');
                    converter.addNumberInput(block, 'DISTANCE', 'math_number', args[1], 5);
                    converter.setParent(rubyBlock, block);
                    break;

                case 'ev3_brightness_gt':
                    if (!converter.isNumberOrBlock(args[1])) return null;

                    block = converter.createBlock('ev3_whenBrightnessLessThan', 'hat');
                    converter.addNumberInput(block, 'DISTANCE', 'math_number', args[1], 50);
                    converter.setParent(rubyBlock, block);
                    break;
            }

            return block;
        });
    },
};

export default EV3Converter;
