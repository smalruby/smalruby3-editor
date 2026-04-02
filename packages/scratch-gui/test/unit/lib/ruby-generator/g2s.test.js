import RubyGenerator from '../../../../src/lib/ruby-generator';
import G2SBlocks from '../../../../src/lib/ruby-generator/g2s';

describe('RubyGenerator/G2S', () => {
    const makeBlock = (id) => ({
        id,
        opcode: 'dummy',
        inputs: {},
        fields: {},
    });

    beforeEach(() => {
        RubyGenerator.cache_ = {};
        RubyGenerator.definitions_ = {};
        RubyGenerator.functionNames_ = {};
        RubyGenerator.currentTarget = null;
        G2SBlocks(RubyGenerator);
    });

    // --- Board connection ---

    test('connectBoard', () => {
        expect(RubyGenerator.g2s_connectBoard(makeBlock('b1'))).toEqual(
            'akadako.connect_board\n',
        );
    });

    test('disconnectBoard', () => {
        expect(RubyGenerator.g2s_disconnectBoard(makeBlock('b1'))).toEqual(
            'akadako.disconnect_board\n',
        );
    });

    test('isConnected', () => {
        const [code, order] = RubyGenerator.g2s_isConnected(makeBlock('b1'));
        expect(code).toEqual('akadako.connected?');
        expect(order).toEqual(RubyGenerator.ORDER_FUNCTION_CALL);
    });

    test('boardStateChanged', () => {
        RubyGenerator.valueToCode = jest
            .fn()
            .mockReturnValue('"connected"');
        const block = makeBlock('b1');
        const result = RubyGenerator.g2s_boardStateChanged(block);
        expect(result).toEqual(
            'akadako.when_board_state_changed("connected") do\n',
        );
        expect(block.isStatement).toBe(true);
    });

    test('boardVersion', () => {
        const [code, order] = RubyGenerator.g2s_boardVersion(makeBlock('b1'));
        expect(code).toEqual('akadako.board_version');
        expect(order).toEqual(RubyGenerator.ORDER_FUNCTION_CALL);
    });

    // --- Analog I/O ---

    test('analogLevelA1', () => {
        const [code] = RubyGenerator.g2s_analogLevelA1(makeBlock('b1'));
        expect(code).toEqual('akadako.analog_level_a1');
    });

    test('analogLevelA2', () => {
        const [code] = RubyGenerator.g2s_analogLevelA2(makeBlock('b1'));
        expect(code).toEqual('akadako.analog_level_a2');
    });

    test('analogLevelB1', () => {
        const [code] = RubyGenerator.g2s_analogLevelB1(makeBlock('b1'));
        expect(code).toEqual('akadako.analog_level_b1');
    });

    test('analogLevelB2', () => {
        const [code] = RubyGenerator.g2s_analogLevelB2(makeBlock('b1'));
        expect(code).toEqual('akadako.analog_level_b2');
    });

    // --- Digital I/O ---

    test('digitalLevelA1', () => {
        const [code] = RubyGenerator.g2s_digitalLevelA1(makeBlock('b1'));
        expect(code).toEqual('akadako.digital_level_a1');
    });

    test('digitalLevelA2', () => {
        const [code] = RubyGenerator.g2s_digitalLevelA2(makeBlock('b1'));
        expect(code).toEqual('akadako.digital_level_a2');
    });

    test('digitalLevelB1', () => {
        const [code] = RubyGenerator.g2s_digitalLevelB1(makeBlock('b1'));
        expect(code).toEqual('akadako.digital_level_b1');
    });

    test('digitalLevelB2', () => {
        const [code] = RubyGenerator.g2s_digitalLevelB2(makeBlock('b1'));
        expect(code).toEqual('akadako.digital_level_b2');
    });

    test('digitalLevelSet', () => {
        RubyGenerator.valueToCode = jest
            .fn()
            .mockReturnValueOnce('"10"')
            .mockReturnValueOnce('"true"');
        expect(
            RubyGenerator.g2s_digitalLevelSet(makeBlock('b1')),
        ).toEqual('akadako.set_digital_level("10", "true")\n');
    });

    test('digitalIsHigh', () => {
        RubyGenerator.valueToCode = jest.fn().mockReturnValue('"6"');
        const [code, order] = RubyGenerator.g2s_digitalIsHigh(
            makeBlock('b1'),
        );
        expect(code).toEqual('akadako.digital_high?("6")');
        expect(order).toEqual(RubyGenerator.ORDER_FUNCTION_CALL);
    });

    test('digitalLevelChanged', () => {
        RubyGenerator.valueToCode = jest
            .fn()
            .mockReturnValueOnce('"10"')
            .mockReturnValueOnce('"true"');
        const block = makeBlock('b1');
        const result = RubyGenerator.g2s_digitalLevelChanged(block);
        expect(result).toEqual(
            'akadako.when_digital_level_changed("10", "true") do\n',
        );
        expect(block.isStatement).toBe(true);
    });

    test('inputBiasSet', () => {
        RubyGenerator.valueToCode = jest
            .fn()
            .mockReturnValueOnce('"10"')
            .mockReturnValueOnce('"pullUp"');
        expect(RubyGenerator.g2s_inputBiasSet(makeBlock('b1'))).toEqual(
            'akadako.set_input_bias("10", "pullUp")\n',
        );
    });

    test('analogLevelSet', () => {
        RubyGenerator.valueToCode = jest
            .fn()
            .mockReturnValueOnce('"10"')
            .mockReturnValueOnce('50');
        expect(RubyGenerator.g2s_analogLevelSet(makeBlock('b1'))).toEqual(
            'akadako.set_pwm_duty("10", 50)\n',
        );
    });

    // --- Servo + IR ---

    test('servoTurn', () => {
        RubyGenerator.valueToCode = jest
            .fn()
            .mockReturnValueOnce('"10"')
            .mockReturnValueOnce('90')
            .mockReturnValueOnce('100');
        expect(RubyGenerator.g2s_servoTurn(makeBlock('b1'))).toEqual(
            'akadako.servo_turn("10", 90, 100)\n',
        );
    });

    test('sendIrRemote', () => {
        RubyGenerator.valueToCode = jest
            .fn()
            .mockReturnValueOnce('"999"')
            .mockReturnValueOnce('"3"');
        expect(RubyGenerator.g2s_sendIrRemote(makeBlock('b1'))).toEqual(
            'akadako.send_ir_remote("999", "3")\n',
        );
    });

    // --- Distance/Motion sensors ---

    test('measureDistanceWithUltrasonicA', () => {
        const [code] =
            RubyGenerator.g2s_measureDistanceWithUltrasonicA(
                makeBlock('b1'),
            );
        expect(code).toEqual('akadako.ultrasonic_distance_a');
    });

    test('measureDistanceWithUltrasonicB', () => {
        const [code] =
            RubyGenerator.g2s_measureDistanceWithUltrasonicB(
                makeBlock('b1'),
            );
        expect(code).toEqual('akadako.ultrasonic_distance_b');
    });

    test('measureDistanceWithLight', () => {
        const [code] = RubyGenerator.g2s_measureDistanceWithLight(
            makeBlock('b1'),
        );
        expect(code).toEqual('akadako.laser_distance');
    });

    test('motionSensorValue', () => {
        const [code] = RubyGenerator.g2s_motionSensorValue(makeBlock('b1'));
        expect(code).toEqual('akadako.motion_sensor_value');
    });

    // --- Accelerometer ---

    test('whenShaken', () => {
        const block = makeBlock('b1');
        const result = RubyGenerator.g2s_whenShaken(block);
        expect(result).toEqual('akadako.when_shaken do\n');
        expect(block.isStatement).toBe(true);
    });

    test('getPitch', () => {
        const [code] = RubyGenerator.g2s_getPitch(makeBlock('b1'));
        expect(code).toEqual('akadako.pitch');
    });

    test('getRoll', () => {
        const [code] = RubyGenerator.g2s_getRoll(makeBlock('b1'));
        expect(code).toEqual('akadako.roll');
    });

    test('getAccelerationX', () => {
        const [code] = RubyGenerator.g2s_getAccelerationX(makeBlock('b1'));
        expect(code).toEqual('akadako.acceleration_x');
    });

    test('getAccelerationY', () => {
        const [code] = RubyGenerator.g2s_getAccelerationY(makeBlock('b1'));
        expect(code).toEqual('akadako.acceleration_y');
    });

    test('getAccelerationZ', () => {
        const [code] = RubyGenerator.g2s_getAccelerationZ(makeBlock('b1'));
        expect(code).toEqual('akadako.acceleration_z');
    });

    test('getAccelerationAbsolute', () => {
        const [code] = RubyGenerator.g2s_getAccelerationAbsolute(
            makeBlock('b1'),
        );
        expect(code).toEqual('akadako.acceleration_absolute');
    });

    // --- Light/Environment/Water temperature ---

    test('getBrightness', () => {
        const [code] = RubyGenerator.g2s_getBrightness(makeBlock('b1'));
        expect(code).toEqual('akadako.brightness');
    });

    test('getAnalogBrightness', () => {
        const [code] = RubyGenerator.g2s_getAnalogBrightness(
            makeBlock('b1'),
        );
        expect(code).toEqual('akadako.analog_brightness');
    });

    test('getTemperature', () => {
        const [code] = RubyGenerator.g2s_getTemperature(makeBlock('b1'));
        expect(code).toEqual('akadako.temperature');
    });

    test('getPressure', () => {
        const [code] = RubyGenerator.g2s_getPressure(makeBlock('b1'));
        expect(code).toEqual('akadako.pressure');
    });

    test('getHumidity', () => {
        const [code] = RubyGenerator.g2s_getHumidity(makeBlock('b1'));
        expect(code).toEqual('akadako.humidity');
    });

    test('getWaterTemperatureA', () => {
        const [code] = RubyGenerator.g2s_getWaterTemperatureA(
            makeBlock('b1'),
        );
        expect(code).toEqual('akadako.water_temperature_a');
    });

    test('getWaterTemperatureB', () => {
        const [code] = RubyGenerator.g2s_getWaterTemperatureB(
            makeBlock('b1'),
        );
        expect(code).toEqual('akadako.water_temperature_b');
    });

    // --- NeoPixel LED ---

    test('neoPixelConfigStrip', () => {
        RubyGenerator.valueToCode = jest
            .fn()
            .mockReturnValueOnce('"10"')
            .mockReturnValueOnce('3');
        expect(
            RubyGenerator.g2s_neoPixelConfigStrip(makeBlock('b1')),
        ).toEqual('akadako.neopixel_config("10", 3)\n');
    });

    test('neoPixelSetColor', () => {
        RubyGenerator.valueToCode = jest
            .fn()
            .mockReturnValueOnce('"7"')
            .mockReturnValueOnce('1')
            .mockReturnValueOnce('"0xff, 0, 0"')
            .mockReturnValueOnce('50');
        expect(
            RubyGenerator.g2s_neoPixelSetColor(makeBlock('b1')),
        ).toEqual(
            'akadako.neopixel_set_color("7", 1, "0xff, 0, 0", 50)\n',
        );
    });

    test('neoPixelFillColor', () => {
        RubyGenerator.valueToCode = jest
            .fn()
            .mockReturnValueOnce('"7"')
            .mockReturnValueOnce('"0, 0xff, 0"')
            .mockReturnValueOnce('100');
        expect(
            RubyGenerator.g2s_neoPixelFillColor(makeBlock('b1')),
        ).toEqual(
            'akadako.neopixel_fill_color("7", "0, 0xff, 0", 100)\n',
        );
    });

    test('neoPixelShiftColor', () => {
        RubyGenerator.valueToCode = jest
            .fn()
            .mockReturnValueOnce('"10"')
            .mockReturnValueOnce('2')
            .mockReturnValueOnce('"true"');
        expect(
            RubyGenerator.g2s_neoPixelShiftColor(makeBlock('b1')),
        ).toEqual(
            'akadako.neopixel_shift_color("10", 2, "true")\n',
        );
    });

    test('neoPixelColor', () => {
        RubyGenerator.valueToCode = jest
            .fn()
            .mockReturnValueOnce('255')
            .mockReturnValueOnce('0')
            .mockReturnValueOnce('0');
        const [code, order] = RubyGenerator.g2s_neoPixelColor(
            makeBlock('b1'),
        );
        expect(code).toEqual('akadako.neopixel_color(255, 0, 0)');
        expect(order).toEqual(RubyGenerator.ORDER_FUNCTION_CALL);
    });

    test('neoPixelColorMode', () => {
        RubyGenerator.valueToCode = jest
            .fn()
            .mockReturnValue('"rainbow"');
        const [code] = RubyGenerator.g2s_neoPixelColorMode(makeBlock('b1'));
        expect(code).toEqual('akadako.neopixel_color_mode("rainbow")');
    });

    test('neoPixelShow', () => {
        expect(RubyGenerator.g2s_neoPixelShow(makeBlock('b1'))).toEqual(
            'akadako.neopixel_show\n',
        );
    });

    test('neoPixelClear', () => {
        RubyGenerator.valueToCode = jest.fn().mockReturnValue('"7"');
        expect(RubyGenerator.g2s_neoPixelClear(makeBlock('b1'))).toEqual(
            'akadako.neopixel_clear("7")\n',
        );
    });

    // --- I2C ---

    test('i2cWrite', () => {
        RubyGenerator.valueToCode = jest
            .fn()
            .mockReturnValueOnce('"0x10"')
            .mockReturnValueOnce('"0x20"')
            .mockReturnValueOnce('"0x30, 0x40"');
        expect(RubyGenerator.g2s_i2cWrite(makeBlock('b1'))).toEqual(
            'akadako.i2c_write("0x10", "0x20", "0x30, 0x40")\n',
        );
    });

    test('i2cReadOnce', () => {
        RubyGenerator.valueToCode = jest
            .fn()
            .mockReturnValueOnce('"0x10"')
            .mockReturnValueOnce('"0x20"')
            .mockReturnValueOnce('4');
        const [code, order] = RubyGenerator.g2s_i2cReadOnce(
            makeBlock('b1'),
        );
        expect(code).toEqual('akadako.i2c_read("0x10", "0x20", 4)');
        expect(order).toEqual(RubyGenerator.ORDER_FUNCTION_CALL);
    });

    // --- Array/Data ---

    test('numberAtIndex', () => {
        RubyGenerator.valueToCode = jest
            .fn()
            .mockReturnValueOnce('"1, 2, 3"')
            .mockReturnValueOnce('2');
        const [code] = RubyGenerator.g2s_numberAtIndex(makeBlock('b1'));
        expect(code).toEqual('akadako.number_at("1, 2, 3", 2)');
    });

    test('spliceNumbers', () => {
        RubyGenerator.valueToCode = jest
            .fn()
            .mockReturnValueOnce('"1.0, 1E1, 0xFF"')
            .mockReturnValueOnce('1')
            .mockReturnValueOnce('1')
            .mockReturnValueOnce('"-1, 0"');
        const [code] = RubyGenerator.g2s_spliceNumbers(makeBlock('b1'));
        expect(code).toEqual(
            'akadako.splice_numbers("1.0, 1E1, 0xFF", 1, 1, "-1, 0")',
        );
    });

    test('lengthOfNumbers', () => {
        RubyGenerator.valueToCode = jest
            .fn()
            .mockReturnValue('"1.0, 1E1, 0xFF"');
        const [code] = RubyGenerator.g2s_lengthOfNumbers(makeBlock('b1'));
        expect(code).toEqual('akadako.numbers_length("1.0, 1E1, 0xFF")');
    });

    test('readBytesAs', () => {
        RubyGenerator.valueToCode = jest
            .fn()
            .mockReturnValueOnce('"0x00, 0xFF"')
            .mockReturnValueOnce('"Int16"')
            .mockReturnValueOnce('"little"');
        const [code] = RubyGenerator.g2s_readBytesAs(makeBlock('b1'));
        expect(code).toEqual(
            'akadako.read_bytes_as("0x00, 0xFF", "Int16", "little")',
        );
    });

    // --- Bitwise ---

    test('int64Operation', () => {
        RubyGenerator.valueToCode = jest
            .fn()
            .mockReturnValueOnce('"0x01"')
            .mockReturnValueOnce('"\uFF0B"')
            .mockReturnValueOnce('"0x02"');
        const [code] = RubyGenerator.g2s_int64Operation(makeBlock('b1'));
        expect(code).toEqual(
            'akadako.int64_op("0x01", "\uFF0B", "0x02")',
        );
    });

    test('bitOperation', () => {
        RubyGenerator.valueToCode = jest
            .fn()
            .mockReturnValueOnce('"0x03"')
            .mockReturnValueOnce('"&"')
            .mockReturnValueOnce('"0x01"');
        const [code] = RubyGenerator.g2s_bitOperation(makeBlock('b1'));
        expect(code).toEqual(
            'akadako.bit_op("0x03", "&", "0x01")',
        );
    });

    test('bitNot', () => {
        RubyGenerator.valueToCode = jest.fn().mockReturnValue('"0x01"');
        const [code] = RubyGenerator.g2s_bitNot(makeBlock('b1'));
        expect(code).toEqual('akadako.bit_not("0x01")');
    });

    // --- Menus ---

    test('menu_boardStateMenu', () => {
        const block = {
            fields: { boardStateMenu: { value: 'connected' } },
        };
        const [code, order] =
            RubyGenerator.g2s_menu_boardStateMenu(block);
        expect(code).toEqual('"connected"');
        expect(order).toEqual(RubyGenerator.ORDER_ATOMIC);
    });

    test('menu_boardStateMenu disconnected', () => {
        const block = {
            fields: { boardStateMenu: { value: 'disconnected' } },
        };
        const [code] = RubyGenerator.g2s_menu_boardStateMenu(block);
        expect(code).toEqual('"disconnected"');
    });

    test('menu_digitalConnectorMenu', () => {
        const block = {
            fields: { digitalConnectorMenu: { value: '6' } },
        };
        const [code] =
            RubyGenerator.g2s_menu_digitalConnectorMenu(block);
        expect(code).toEqual('"6"');
    });

    test('menu_digitalLevelSetConnectorMenu', () => {
        const block = {
            fields: { digitalLevelSetConnectorMenu: { value: '4' } },
        };
        const [code] =
            RubyGenerator.g2s_menu_digitalLevelSetConnectorMenu(block);
        expect(code).toEqual('"4"');
    });

    test('menu_digitalLevelMenu', () => {
        const block = {
            fields: { digitalLevelMenu: { value: 'false' } },
        };
        const [code] = RubyGenerator.g2s_menu_digitalLevelMenu(block);
        expect(code).toEqual('"false"');
    });

    test('menu_inputPinsMenu', () => {
        const block = {
            fields: { inputPinsMenu: { value: '11' } },
        };
        const [code] = RubyGenerator.g2s_menu_inputPinsMenu(block);
        expect(code).toEqual('"11"');
    });

    test('menu_inputBiasMenu', () => {
        const block = {
            fields: { inputBiasMenu: { value: 'pullUp' } },
        };
        const [code] = RubyGenerator.g2s_menu_inputBiasMenu(block);
        expect(code).toEqual('"pullUp"');
    });

    test('menu_pwmConnectorMenu', () => {
        const block = {
            fields: { pwmConnectorMenu: { value: '3' } },
        };
        const [code] = RubyGenerator.g2s_menu_pwmConnectorMenu(block);
        expect(code).toEqual('"3"');
    });

    test('menu_servoConnectorMenu', () => {
        const block = {
            fields: { servoConnectorMenu: { value: '11' } },
        };
        const [code] = RubyGenerator.g2s_menu_servoConnectorMenu(block);
        expect(code).toEqual('"11"');
    });

    test('menu_neoPixelConnectorMenu', () => {
        const block = {
            fields: { neoPixelConnectorMenu: { value: '7' } },
        };
        const [code] =
            RubyGenerator.g2s_menu_neoPixelConnectorMenu(block);
        expect(code).toEqual('"7"');
    });

    test('menu_neoPixelShiftColorLoopModeMenu', () => {
        const block = {
            fields: { neoPixelShiftColorLoopModeMenu: { value: 'false' } },
        };
        const [code] =
            RubyGenerator.g2s_menu_neoPixelShiftColorLoopModeMenu(block);
        expect(code).toEqual('"false"');
    });

    test('menu_neoPixelColorMenuSimple', () => {
        const block = {
            fields: {
                neoPixelColorMenuSimple: { value: '0xff, 0xa5, 0' },
            },
        };
        const [code] =
            RubyGenerator.g2s_menu_neoPixelColorMenuSimple(block);
        expect(code).toEqual('"0xff, 0xa5, 0"');
    });

    test('menu_neoPixelColorMenu', () => {
        const block = {
            fields: { neoPixelColorMenu: { value: 'rainbow' } },
        };
        const [code] = RubyGenerator.g2s_menu_neoPixelColorMenu(block);
        expect(code).toEqual('"rainbow"');
    });

    test('menu_neoPixelColorModeMenu', () => {
        const block = {
            fields: { neoPixelColorModeMenu: { value: 'rainbow' } },
        };
        const [code] =
            RubyGenerator.g2s_menu_neoPixelColorModeMenu(block);
        expect(code).toEqual('"rainbow"');
    });

    test('menu_bytesTypeMenu', () => {
        const block = {
            fields: { bytesTypeMenu: { value: 'Uint16' } },
        };
        const [code] = RubyGenerator.g2s_menu_bytesTypeMenu(block);
        expect(code).toEqual('"Uint16"');
    });

    test('menu_endianMenu', () => {
        const block = {
            fields: { endianMenu: { value: 'big' } },
        };
        const [code] = RubyGenerator.g2s_menu_endianMenu(block);
        expect(code).toEqual('"big"');
    });

    test('menu_int64OperationMenu', () => {
        const block = {
            fields: { int64OperationMenu: { value: 'mod' } },
        };
        const [code] =
            RubyGenerator.g2s_menu_int64OperationMenu(block);
        expect(code).toEqual('"mod"');
    });

    test('menu_bitOperationMenu', () => {
        const block = {
            fields: { bitOperationMenu: { value: '<<' } },
        };
        const [code] = RubyGenerator.g2s_menu_bitOperationMenu(block);
        expect(code).toEqual('"<<"');
    });

    test('menu_irRemoteMenuConnector', () => {
        const block = {
            fields: { irRemoteMenuConnector: { value: '999' } },
        };
        const [code] =
            RubyGenerator.g2s_menu_irRemoteMenuConnector(block);
        expect(code).toEqual('"999"');
    });

    test('menu_irRemoteMenuN', () => {
        const block = {
            fields: { irRemoteMenuN: { value: '5' } },
        };
        const [code] = RubyGenerator.g2s_menu_irRemoteMenuN(block);
        expect(code).toEqual('"5"');
    });
});
