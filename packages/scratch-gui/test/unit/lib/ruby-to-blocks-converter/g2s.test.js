import RubyToBlocksConverter from '../../../../src/lib/ruby-to-blocks-converter';
import {
    convertAndExpectToEqualBlocks,
    expectedInfo,
} from '../../../helpers/expect-to-equal-blocks';

const makeMenuInput = (inputName, menuOpcode, fieldName, value) => ({
    name: inputName,
    block: {
        opcode: menuOpcode,
        fields: [{ name: fieldName, value }],
        shadow: true,
    },
});

describe('RubyToBlocksConverter/G2S', () => {
    let converter;
    let target;

    beforeEach(() => {
        converter = new RubyToBlocksConverter(null, { version: '2' });
        target = null;
    });

    // --- Board connection ---

    test('akadako.connect_board', async () => {
        await convertAndExpectToEqualBlocks(converter, target, 'akadako.connect_board', [
            { opcode: 'g2s_connectBoard' },
        ]);
    });

    test('akadako.disconnect_board', async () => {
        await convertAndExpectToEqualBlocks(converter, target, 'akadako.disconnect_board', [
            { opcode: 'g2s_disconnectBoard' },
        ]);
    });

    test('akadako.connected?', async () => {
        await convertAndExpectToEqualBlocks(converter, target, 'akadako.connected?', [
            { opcode: 'g2s_isConnected' },
        ]);
    });

    test('akadako.when_board_state_changed("connected") do; end', async () => {
        await convertAndExpectToEqualBlocks(
            converter,
            target,
            'akadako.when_board_state_changed("connected") do; end',
            [
                {
                    opcode: 'g2s_boardStateChanged',
                    inputs: [
                        makeMenuInput(
                            'STATE',
                            'g2s_menu_boardStateMenu',
                            'boardStateMenu',
                            'connected',
                        ),
                    ],
                },
            ],
        );
    });

    test('akadako.when_board_state_changed("disconnected") do; end', async () => {
        await convertAndExpectToEqualBlocks(
            converter,
            target,
            'akadako.when_board_state_changed("disconnected") do; end',
            [
                {
                    opcode: 'g2s_boardStateChanged',
                    inputs: [
                        makeMenuInput(
                            'STATE',
                            'g2s_menu_boardStateMenu',
                            'boardStateMenu',
                            'disconnected',
                        ),
                    ],
                },
            ],
        );
    });

    test('akadako.board_version', async () => {
        await convertAndExpectToEqualBlocks(converter, target, 'akadako.board_version', [
            { opcode: 'g2s_boardVersion' },
        ]);
    });

    // --- Analog I/O ---

    test('akadako.analog_level_a1', async () => {
        await convertAndExpectToEqualBlocks(converter, target, 'akadako.analog_level_a1', [
            { opcode: 'g2s_analogLevelA1' },
        ]);
    });

    test('akadako.analog_level_a2', async () => {
        await convertAndExpectToEqualBlocks(converter, target, 'akadako.analog_level_a2', [
            { opcode: 'g2s_analogLevelA2' },
        ]);
    });

    test('akadako.analog_level_b1', async () => {
        await convertAndExpectToEqualBlocks(converter, target, 'akadako.analog_level_b1', [
            { opcode: 'g2s_analogLevelB1' },
        ]);
    });

    test('akadako.analog_level_b2', async () => {
        await convertAndExpectToEqualBlocks(converter, target, 'akadako.analog_level_b2', [
            { opcode: 'g2s_analogLevelB2' },
        ]);
    });

    // --- Digital I/O ---

    test('akadako.digital_level_a1', async () => {
        await convertAndExpectToEqualBlocks(converter, target, 'akadako.digital_level_a1', [
            { opcode: 'g2s_digitalLevelA1' },
        ]);
    });

    test('akadako.digital_level_a2', async () => {
        await convertAndExpectToEqualBlocks(converter, target, 'akadako.digital_level_a2', [
            { opcode: 'g2s_digitalLevelA2' },
        ]);
    });

    test('akadako.digital_level_b1', async () => {
        await convertAndExpectToEqualBlocks(converter, target, 'akadako.digital_level_b1', [
            { opcode: 'g2s_digitalLevelB1' },
        ]);
    });

    test('akadako.digital_level_b2', async () => {
        await convertAndExpectToEqualBlocks(converter, target, 'akadako.digital_level_b2', [
            { opcode: 'g2s_digitalLevelB2' },
        ]);
    });

    test('akadako.set_digital_level("10", "true")', async () => {
        await convertAndExpectToEqualBlocks(
            converter,
            target,
            'akadako.set_digital_level("10", "true")',
            [
                {
                    opcode: 'g2s_digitalLevelSet',
                    inputs: [
                        makeMenuInput(
                            'CONNECTOR',
                            'g2s_menu_digitalLevelSetConnectorMenu',
                            'digitalLevelSetConnectorMenu',
                            '10',
                        ),
                        makeMenuInput(
                            'LEVEL',
                            'g2s_menu_digitalLevelMenu',
                            'digitalLevelMenu',
                            'true',
                        ),
                    ],
                },
            ],
        );
    });

    test('akadako.digital_high?("10")', async () => {
        await convertAndExpectToEqualBlocks(
            converter,
            target,
            'akadako.digital_high?("10")',
            [
                {
                    opcode: 'g2s_digitalIsHigh',
                    inputs: [
                        makeMenuInput(
                            'CONNECTOR',
                            'g2s_menu_digitalConnectorMenu',
                            'digitalConnectorMenu',
                            '10',
                        ),
                    ],
                },
            ],
        );
    });

    test('akadako.when_digital_level_changed("10", "true") do; end', async () => {
        await convertAndExpectToEqualBlocks(
            converter,
            target,
            'akadako.when_digital_level_changed("10", "true") do; end',
            [
                {
                    opcode: 'g2s_digitalLevelChanged',
                    inputs: [
                        makeMenuInput(
                            'CONNECTOR',
                            'g2s_menu_digitalConnectorMenu',
                            'digitalConnectorMenu',
                            '10',
                        ),
                        makeMenuInput(
                            'LEVEL',
                            'g2s_menu_digitalLevelMenu',
                            'digitalLevelMenu',
                            'true',
                        ),
                    ],
                },
            ],
        );
    });

    test('akadako.set_input_bias("10", "pullUp")', async () => {
        await convertAndExpectToEqualBlocks(
            converter,
            target,
            'akadako.set_input_bias("10", "pullUp")',
            [
                {
                    opcode: 'g2s_inputBiasSet',
                    inputs: [
                        makeMenuInput(
                            'PIN',
                            'g2s_menu_inputPinsMenu',
                            'inputPinsMenu',
                            '10',
                        ),
                        makeMenuInput(
                            'BIAS',
                            'g2s_menu_inputBiasMenu',
                            'inputBiasMenu',
                            'pullUp',
                        ),
                    ],
                },
            ],
        );
    });

    test('akadako.set_pwm_duty("10", 50)', async () => {
        await convertAndExpectToEqualBlocks(
            converter,
            target,
            'akadako.set_pwm_duty("10", 50)',
            [
                {
                    opcode: 'g2s_analogLevelSet',
                    inputs: [
                        makeMenuInput(
                            'CONNECTOR',
                            'g2s_menu_pwmConnectorMenu',
                            'pwmConnectorMenu',
                            '10',
                        ),
                        {
                            name: 'LEVEL',
                            block: expectedInfo.makeNumber(50),
                        },
                    ],
                },
            ],
        );
    });

    // --- Servo + IR ---

    test('akadako.servo_turn("10", 90, 100)', async () => {
        await convertAndExpectToEqualBlocks(
            converter,
            target,
            'akadako.servo_turn("10", 90, 100)',
            [
                {
                    opcode: 'g2s_servoTurn',
                    inputs: [
                        makeMenuInput(
                            'CONNECTOR',
                            'g2s_menu_servoConnectorMenu',
                            'servoConnectorMenu',
                            '10',
                        ),
                        {
                            name: 'ANGLE',
                            block: expectedInfo.makeNumber(90),
                        },
                        {
                            name: 'SPEED',
                            block: expectedInfo.makeNumber(100),
                        },
                    ],
                },
            ],
        );
    });

    test('akadako.send_ir_remote("10", "1")', async () => {
        await convertAndExpectToEqualBlocks(
            converter,
            target,
            'akadako.send_ir_remote("10", "1")',
            [
                {
                    opcode: 'g2s_sendIrRemote',
                    inputs: [
                        makeMenuInput(
                            'CONNECTOR',
                            'g2s_menu_irRemoteMenuConnector',
                            'irRemoteMenuConnector',
                            '10',
                        ),
                        makeMenuInput(
                            'N',
                            'g2s_menu_irRemoteMenuN',
                            'irRemoteMenuN',
                            '1',
                        ),
                    ],
                },
            ],
        );
    });

    // --- Sensors (no-arg reporters) ---

    test('akadako.ultrasonic_distance_a', async () => {
        await convertAndExpectToEqualBlocks(
            converter,
            target,
            'akadako.ultrasonic_distance_a',
            [{ opcode: 'g2s_measureDistanceWithUltrasonicA' }],
        );
    });

    test('akadako.ultrasonic_distance_b', async () => {
        await convertAndExpectToEqualBlocks(
            converter,
            target,
            'akadako.ultrasonic_distance_b',
            [{ opcode: 'g2s_measureDistanceWithUltrasonicB' }],
        );
    });

    test('akadako.laser_distance', async () => {
        await convertAndExpectToEqualBlocks(converter, target, 'akadako.laser_distance', [
            { opcode: 'g2s_measureDistanceWithLight' },
        ]);
    });

    test('akadako.motion_sensor_value', async () => {
        await convertAndExpectToEqualBlocks(
            converter,
            target,
            'akadako.motion_sensor_value',
            [{ opcode: 'g2s_motionSensorValue' }],
        );
    });

    test('akadako.pitch', async () => {
        await convertAndExpectToEqualBlocks(converter, target, 'akadako.pitch', [
            { opcode: 'g2s_getPitch' },
        ]);
    });

    test('akadako.roll', async () => {
        await convertAndExpectToEqualBlocks(converter, target, 'akadako.roll', [
            { opcode: 'g2s_getRoll' },
        ]);
    });

    test('akadako.acceleration_x', async () => {
        await convertAndExpectToEqualBlocks(converter, target, 'akadako.acceleration_x', [
            { opcode: 'g2s_getAccelerationX' },
        ]);
    });

    test('akadako.acceleration_y', async () => {
        await convertAndExpectToEqualBlocks(converter, target, 'akadako.acceleration_y', [
            { opcode: 'g2s_getAccelerationY' },
        ]);
    });

    test('akadako.acceleration_z', async () => {
        await convertAndExpectToEqualBlocks(converter, target, 'akadako.acceleration_z', [
            { opcode: 'g2s_getAccelerationZ' },
        ]);
    });

    test('akadako.acceleration_absolute', async () => {
        await convertAndExpectToEqualBlocks(
            converter,
            target,
            'akadako.acceleration_absolute',
            [{ opcode: 'g2s_getAccelerationAbsolute' }],
        );
    });

    test('akadako.brightness', async () => {
        await convertAndExpectToEqualBlocks(converter, target, 'akadako.brightness', [
            { opcode: 'g2s_getBrightness' },
        ]);
    });

    test('akadako.analog_brightness', async () => {
        await convertAndExpectToEqualBlocks(converter, target, 'akadako.analog_brightness', [
            { opcode: 'g2s_getAnalogBrightness' },
        ]);
    });

    test('akadako.temperature', async () => {
        await convertAndExpectToEqualBlocks(converter, target, 'akadako.temperature', [
            { opcode: 'g2s_getTemperature' },
        ]);
    });

    test('akadako.pressure', async () => {
        await convertAndExpectToEqualBlocks(converter, target, 'akadako.pressure', [
            { opcode: 'g2s_getPressure' },
        ]);
    });

    test('akadako.humidity', async () => {
        await convertAndExpectToEqualBlocks(converter, target, 'akadako.humidity', [
            { opcode: 'g2s_getHumidity' },
        ]);
    });

    test('akadako.water_temperature_a', async () => {
        await convertAndExpectToEqualBlocks(
            converter,
            target,
            'akadako.water_temperature_a',
            [{ opcode: 'g2s_getWaterTemperatureA' }],
        );
    });

    test('akadako.water_temperature_b', async () => {
        await convertAndExpectToEqualBlocks(
            converter,
            target,
            'akadako.water_temperature_b',
            [{ opcode: 'g2s_getWaterTemperatureB' }],
        );
    });

    // --- HAT (no-arg) ---

    test('akadako.when_shaken do; end', async () => {
        await convertAndExpectToEqualBlocks(
            converter,
            target,
            'akadako.when_shaken do; end',
            [{ opcode: 'g2s_whenShaken' }],
        );
    });

    // --- NeoPixel LED ---

    test('akadako.neopixel_config("10", 3)', async () => {
        await convertAndExpectToEqualBlocks(
            converter,
            target,
            'akadako.neopixel_config("10", 3)',
            [
                {
                    opcode: 'g2s_neoPixelConfigStrip',
                    inputs: [
                        makeMenuInput(
                            'CONNECTOR',
                            'g2s_menu_neoPixelConnectorMenu',
                            'neoPixelConnectorMenu',
                            '10',
                        ),
                        {
                            name: 'LENGTH',
                            block: expectedInfo.makeNumber(3),
                        },
                    ],
                },
            ],
        );
    });

    test('akadako.neopixel_set_color("10", 1, "0xff, 0, 0", 50)', async () => {
        await convertAndExpectToEqualBlocks(
            converter,
            target,
            'akadako.neopixel_set_color("10", 1, "0xff, 0, 0", 50)',
            [
                {
                    opcode: 'g2s_neoPixelSetColor',
                    inputs: [
                        makeMenuInput(
                            'CONNECTOR',
                            'g2s_menu_neoPixelConnectorMenu',
                            'neoPixelConnectorMenu',
                            '10',
                        ),
                        {
                            name: 'POSITION',
                            block: expectedInfo.makeNumber(1),
                        },
                        makeMenuInput(
                            'COLOR',
                            'g2s_menu_neoPixelColorMenuSimple',
                            'neoPixelColorMenuSimple',
                            '0xff, 0, 0',
                        ),
                        {
                            name: 'BRIGHTNESS',
                            block: expectedInfo.makeNumber(50),
                        },
                    ],
                },
            ],
        );
    });

    test('akadako.neopixel_fill_color("10", "0xff, 0, 0", 50)', async () => {
        await convertAndExpectToEqualBlocks(
            converter,
            target,
            'akadako.neopixel_fill_color("10", "0xff, 0, 0", 50)',
            [
                {
                    opcode: 'g2s_neoPixelFillColor',
                    inputs: [
                        makeMenuInput(
                            'CONNECTOR',
                            'g2s_menu_neoPixelConnectorMenu',
                            'neoPixelConnectorMenu',
                            '10',
                        ),
                        makeMenuInput(
                            'COLOR',
                            'g2s_menu_neoPixelColorMenu',
                            'neoPixelColorMenu',
                            '0xff, 0, 0',
                        ),
                        {
                            name: 'BRIGHTNESS',
                            block: expectedInfo.makeNumber(50),
                        },
                    ],
                },
            ],
        );
    });

    test('akadako.neopixel_shift_color("10", 1, "true")', async () => {
        await convertAndExpectToEqualBlocks(
            converter,
            target,
            'akadako.neopixel_shift_color("10", 1, "true")',
            [
                {
                    opcode: 'g2s_neoPixelShiftColor',
                    inputs: [
                        makeMenuInput(
                            'CONNECTOR',
                            'g2s_menu_neoPixelConnectorMenu',
                            'neoPixelConnectorMenu',
                            '10',
                        ),
                        {
                            name: 'N',
                            block: expectedInfo.makeNumber(1),
                        },
                        makeMenuInput(
                            'LOOP_MODE',
                            'g2s_menu_neoPixelShiftColorLoopModeMenu',
                            'neoPixelShiftColorLoopModeMenu',
                            'true',
                        ),
                    ],
                },
            ],
        );
    });

    test('akadako.neopixel_color("255", "128", "0")', async () => {
        await convertAndExpectToEqualBlocks(
            converter,
            target,
            'akadako.neopixel_color("255", "128", "0")',
            [
                {
                    opcode: 'g2s_neoPixelColor',
                    inputs: [
                        {
                            name: 'RED',
                            block: expectedInfo.makeText('255'),
                        },
                        {
                            name: 'GREEN',
                            block: expectedInfo.makeText('128'),
                        },
                        {
                            name: 'BLUE',
                            block: expectedInfo.makeText('0'),
                        },
                    ],
                },
            ],
        );
    });

    test('akadako.neopixel_color_mode("rainbow")', async () => {
        await convertAndExpectToEqualBlocks(
            converter,
            target,
            'akadako.neopixel_color_mode("rainbow")',
            [
                {
                    opcode: 'g2s_neoPixelColorMode',
                    inputs: [
                        makeMenuInput(
                            'MODE',
                            'g2s_menu_neoPixelColorModeMenu',
                            'neoPixelColorModeMenu',
                            'rainbow',
                        ),
                    ],
                },
            ],
        );
    });

    test('akadako.neopixel_show', async () => {
        await convertAndExpectToEqualBlocks(converter, target, 'akadako.neopixel_show', [
            { opcode: 'g2s_neoPixelShow' },
        ]);
    });

    test('akadako.neopixel_clear("10")', async () => {
        await convertAndExpectToEqualBlocks(
            converter,
            target,
            'akadako.neopixel_clear("10")',
            [
                {
                    opcode: 'g2s_neoPixelClear',
                    inputs: [
                        makeMenuInput(
                            'CONNECTOR',
                            'g2s_menu_neoPixelConnectorMenu',
                            'neoPixelConnectorMenu',
                            '10',
                        ),
                    ],
                },
            ],
        );
    });

    // --- I2C ---

    test('akadako.i2c_write("0x10", "0x01", "0xAB, 0xCD")', async () => {
        await convertAndExpectToEqualBlocks(
            converter,
            target,
            'akadako.i2c_write("0x10", "0x01", "0xAB, 0xCD")',
            [
                {
                    opcode: 'g2s_i2cWrite',
                    inputs: [
                        {
                            name: 'ADDRESS',
                            block: expectedInfo.makeText('0x10'),
                        },
                        {
                            name: 'REGISTER',
                            block: expectedInfo.makeText('0x01'),
                        },
                        {
                            name: 'DATA',
                            block: expectedInfo.makeText('0xAB, 0xCD'),
                        },
                    ],
                },
            ],
        );
    });

    test('akadako.i2c_read("0x10", "0x01", 2)', async () => {
        await convertAndExpectToEqualBlocks(
            converter,
            target,
            'akadako.i2c_read("0x10", "0x01", 2)',
            [
                {
                    opcode: 'g2s_i2cReadOnce',
                    inputs: [
                        {
                            name: 'ADDRESS',
                            block: expectedInfo.makeText('0x10'),
                        },
                        {
                            name: 'REGISTER',
                            block: expectedInfo.makeText('0x01'),
                        },
                        {
                            name: 'LENGTH',
                            block: expectedInfo.makeNumber(2),
                        },
                    ],
                },
            ],
        );
    });

    // --- Array/Data ---

    test('akadako.number_at("1.0, 1E1, 0xFF", 1)', async () => {
        await convertAndExpectToEqualBlocks(
            converter,
            target,
            'akadako.number_at("1.0, 1E1, 0xFF", 1)',
            [
                {
                    opcode: 'g2s_numberAtIndex',
                    inputs: [
                        {
                            name: 'ARRAY',
                            block: expectedInfo.makeText('1.0, 1E1, 0xFF'),
                        },
                        {
                            name: 'INDEX',
                            block: expectedInfo.makeNumber(1),
                        },
                    ],
                },
            ],
        );
    });

    test('akadako.splice_numbers("1.0, 1E1, 0xFF", 1, 1, "-1, 0")', async () => {
        await convertAndExpectToEqualBlocks(
            converter,
            target,
            'akadako.splice_numbers("1.0, 1E1, 0xFF", 1, 1, "-1, 0")',
            [
                {
                    opcode: 'g2s_spliceNumbers',
                    inputs: [
                        {
                            name: 'ARRAY',
                            block: expectedInfo.makeText('1.0, 1E1, 0xFF'),
                        },
                        {
                            name: 'INDEX',
                            block: expectedInfo.makeNumber(1),
                        },
                        {
                            name: 'DELETE',
                            block: expectedInfo.makeNumber(1),
                        },
                        {
                            name: 'INSERT',
                            block: expectedInfo.makeText('-1, 0'),
                        },
                    ],
                },
            ],
        );
    });

    test('akadako.numbers_length("1.0, 1E1, 0xFF")', async () => {
        await convertAndExpectToEqualBlocks(
            converter,
            target,
            'akadako.numbers_length("1.0, 1E1, 0xFF")',
            [
                {
                    opcode: 'g2s_lengthOfNumbers',
                    inputs: [
                        {
                            name: 'ARRAY',
                            block: expectedInfo.makeText('1.0, 1E1, 0xFF'),
                        },
                    ],
                },
            ],
        );
    });

    test('akadako.read_bytes_as("0x00, 0xFF, 0xFF, 0x00", "Int16", "little")', async () => {
        await convertAndExpectToEqualBlocks(
            converter,
            target,
            'akadako.read_bytes_as("0x00, 0xFF, 0xFF, 0x00", "Int16", "little")',
            [
                {
                    opcode: 'g2s_readBytesAs',
                    inputs: [
                        {
                            name: 'ARRAY',
                            block: expectedInfo.makeText('0x00, 0xFF, 0xFF, 0x00'),
                        },
                        makeMenuInput(
                            'TYPE',
                            'g2s_menu_bytesTypeMenu',
                            'bytesTypeMenu',
                            'Int16',
                        ),
                        makeMenuInput(
                            'ENDIAN',
                            'g2s_menu_endianMenu',
                            'endianMenu',
                            'little',
                        ),
                    ],
                },
            ],
        );
    });

    // --- Bitwise ---

    test('akadako.int64_op("0x01", "\uff0b", "0x02")', async () => {
        await convertAndExpectToEqualBlocks(
            converter,
            target,
            'akadako.int64_op("0x01", "\uff0b", "0x02")',
            [
                {
                    opcode: 'g2s_int64Operation',
                    inputs: [
                        {
                            name: 'LEFT',
                            block: expectedInfo.makeText('0x01'),
                        },
                        makeMenuInput(
                            'OP',
                            'g2s_menu_int64OperationMenu',
                            'int64OperationMenu',
                            '\uff0b',
                        ),
                        {
                            name: 'RIGHT',
                            block: expectedInfo.makeText('0x02'),
                        },
                    ],
                },
            ],
        );
    });

    test('akadako.bit_op("0x03", "&", "0x01")', async () => {
        await convertAndExpectToEqualBlocks(
            converter,
            target,
            'akadako.bit_op("0x03", "&", "0x01")',
            [
                {
                    opcode: 'g2s_bitOperation',
                    inputs: [
                        {
                            name: 'LEFT',
                            block: expectedInfo.makeText('0x03'),
                        },
                        makeMenuInput(
                            'OP',
                            'g2s_menu_bitOperationMenu',
                            'bitOperationMenu',
                            '&',
                        ),
                        {
                            name: 'RIGHT',
                            block: expectedInfo.makeText('0x01'),
                        },
                    ],
                },
            ],
        );
    });

    test('akadako.bit_not("0x01")', async () => {
        await convertAndExpectToEqualBlocks(
            converter,
            target,
            'akadako.bit_not("0x01")',
            [
                {
                    opcode: 'g2s_bitNot',
                    inputs: [
                        {
                            name: 'VALUE',
                            block: expectedInfo.makeText('0x01'),
                        },
                    ],
                },
            ],
        );
    });
});
