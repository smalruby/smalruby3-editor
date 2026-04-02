const AKADAKO = 'akadako';

const G2SConverter = {
    register: function (converter) {
        // Register receiver: akadako
        converter.registerOnSend('self', AKADAKO, 0, (params) => {
            const { node } = params;
            return converter.createRubyExpressionBlock(AKADAKO, node);
        });

        // --- Board connection ---

        // akadako.connect_board
        converter.registerOnSend(AKADAKO, 'connect_board', 0, (params) => {
            const { receiver } = params;
            return converter.changeRubyExpressionBlock(
                receiver,
                'g2s_connectBoard',
                'statement',
            );
        });

        // akadako.disconnect_board
        converter.registerOnSend(
            AKADAKO,
            'disconnect_board',
            0,
            (params) => {
                const { receiver } = params;
                return converter.changeRubyExpressionBlock(
                    receiver,
                    'g2s_disconnectBoard',
                    'statement',
                );
            },
        );

        // akadako.connected?
        converter.registerOnSend(AKADAKO, 'connected?', 0, (params) => {
            const { receiver } = params;
            return converter.changeRubyExpressionBlock(
                receiver,
                'g2s_isConnected',
                'value_boolean',
            );
        });

        // akadako.when_board_state_changed("connected") do ... end
        converter.registerOnSendWithBlock(
            AKADAKO,
            'when_board_state_changed',
            1,
            0,
            (params) => {
                const { receiver, args, rubyBlock } = params;
                if (!converter.isString(args[0])) return null;
                const block = converter.changeRubyExpressionBlock(
                    receiver,
                    'g2s_boardStateChanged',
                    'hat',
                );
                converter.addFieldInput(
                    block,
                    'STATE',
                    'g2s_menu_boardStateMenu',
                    'boardStateMenu',
                    args[0],
                    'connected',
                );
                converter.setParent(rubyBlock, block);
                return block;
            },
        );

        // akadako.board_version
        converter.registerOnSend(AKADAKO, 'board_version', 0, (params) => {
            const { receiver } = params;
            return converter.changeRubyExpressionBlock(
                receiver,
                'g2s_boardVersion',
                'value',
            );
        });

        // --- Analog I/O ---

        // akadako.analog_level_a1
        converter.registerOnSend(
            AKADAKO,
            'analog_level_a1',
            0,
            (params) => {
                const { receiver } = params;
                return converter.changeRubyExpressionBlock(
                    receiver,
                    'g2s_analogLevelA1',
                    'value',
                );
            },
        );

        // akadako.analog_level_a2
        converter.registerOnSend(
            AKADAKO,
            'analog_level_a2',
            0,
            (params) => {
                const { receiver } = params;
                return converter.changeRubyExpressionBlock(
                    receiver,
                    'g2s_analogLevelA2',
                    'value',
                );
            },
        );

        // akadako.analog_level_b1
        converter.registerOnSend(
            AKADAKO,
            'analog_level_b1',
            0,
            (params) => {
                const { receiver } = params;
                return converter.changeRubyExpressionBlock(
                    receiver,
                    'g2s_analogLevelB1',
                    'value',
                );
            },
        );

        // akadako.analog_level_b2
        converter.registerOnSend(
            AKADAKO,
            'analog_level_b2',
            0,
            (params) => {
                const { receiver } = params;
                return converter.changeRubyExpressionBlock(
                    receiver,
                    'g2s_analogLevelB2',
                    'value',
                );
            },
        );

        // --- Digital I/O ---

        // akadako.digital_level_a1
        converter.registerOnSend(
            AKADAKO,
            'digital_level_a1',
            0,
            (params) => {
                const { receiver } = params;
                return converter.changeRubyExpressionBlock(
                    receiver,
                    'g2s_digitalLevelA1',
                    'value',
                );
            },
        );

        // akadako.digital_level_a2
        converter.registerOnSend(
            AKADAKO,
            'digital_level_a2',
            0,
            (params) => {
                const { receiver } = params;
                return converter.changeRubyExpressionBlock(
                    receiver,
                    'g2s_digitalLevelA2',
                    'value',
                );
            },
        );

        // akadako.digital_level_b1
        converter.registerOnSend(
            AKADAKO,
            'digital_level_b1',
            0,
            (params) => {
                const { receiver } = params;
                return converter.changeRubyExpressionBlock(
                    receiver,
                    'g2s_digitalLevelB1',
                    'value',
                );
            },
        );

        // akadako.digital_level_b2
        converter.registerOnSend(
            AKADAKO,
            'digital_level_b2',
            0,
            (params) => {
                const { receiver } = params;
                return converter.changeRubyExpressionBlock(
                    receiver,
                    'g2s_digitalLevelB2',
                    'value',
                );
            },
        );

        // akadako.set_digital_level("10", "true")
        converter.registerOnSend(
            AKADAKO,
            'set_digital_level',
            2,
            (params) => {
                const { receiver, args } = params;
                if (!converter.isString(args[0]) || !converter.isString(args[1]))
                    return null;
                const block = converter.changeRubyExpressionBlock(
                    receiver,
                    'g2s_digitalLevelSet',
                    'statement',
                );
                converter.addFieldInput(
                    block,
                    'CONNECTOR',
                    'g2s_menu_digitalLevelSetConnectorMenu',
                    'digitalLevelSetConnectorMenu',
                    args[0],
                    '10',
                );
                converter.addFieldInput(
                    block,
                    'LEVEL',
                    'g2s_menu_digitalLevelMenu',
                    'digitalLevelMenu',
                    args[1],
                    'true',
                );
                return block;
            },
        );

        // akadako.digital_high?("10")
        converter.registerOnSend(
            AKADAKO,
            'digital_high?',
            1,
            (params) => {
                const { receiver, args } = params;
                if (!converter.isString(args[0])) return null;
                const block = converter.changeRubyExpressionBlock(
                    receiver,
                    'g2s_digitalIsHigh',
                    'value_boolean',
                );
                converter.addFieldInput(
                    block,
                    'CONNECTOR',
                    'g2s_menu_digitalConnectorMenu',
                    'digitalConnectorMenu',
                    args[0],
                    '10',
                );
                return block;
            },
        );

        // akadako.when_digital_level_changed("10", "true") do ... end
        converter.registerOnSendWithBlock(
            AKADAKO,
            'when_digital_level_changed',
            2,
            0,
            (params) => {
                const { receiver, args, rubyBlock } = params;
                if (!converter.isString(args[0]) || !converter.isString(args[1]))
                    return null;
                const block = converter.changeRubyExpressionBlock(
                    receiver,
                    'g2s_digitalLevelChanged',
                    'hat',
                );
                converter.addFieldInput(
                    block,
                    'CONNECTOR',
                    'g2s_menu_digitalConnectorMenu',
                    'digitalConnectorMenu',
                    args[0],
                    '10',
                );
                converter.addFieldInput(
                    block,
                    'LEVEL',
                    'g2s_menu_digitalLevelMenu',
                    'digitalLevelMenu',
                    args[1],
                    'true',
                );
                converter.setParent(rubyBlock, block);
                return block;
            },
        );

        // akadako.set_input_bias("10", "none")
        converter.registerOnSend(
            AKADAKO,
            'set_input_bias',
            2,
            (params) => {
                const { receiver, args } = params;
                if (!converter.isString(args[0]) || !converter.isString(args[1]))
                    return null;
                const block = converter.changeRubyExpressionBlock(
                    receiver,
                    'g2s_inputBiasSet',
                    'statement',
                );
                converter.addFieldInput(
                    block,
                    'PIN',
                    'g2s_menu_inputPinsMenu',
                    'inputPinsMenu',
                    args[0],
                    '10',
                );
                converter.addFieldInput(
                    block,
                    'BIAS',
                    'g2s_menu_inputBiasMenu',
                    'inputBiasMenu',
                    args[1],
                    'none',
                );
                return block;
            },
        );

        // akadako.set_pwm_duty("10", 50)
        converter.registerOnSend(
            AKADAKO,
            'set_pwm_duty',
            2,
            (params) => {
                const { receiver, args } = params;
                if (!converter.isString(args[0])) return null;
                const block = converter.changeRubyExpressionBlock(
                    receiver,
                    'g2s_analogLevelSet',
                    'statement',
                );
                converter.addFieldInput(
                    block,
                    'CONNECTOR',
                    'g2s_menu_pwmConnectorMenu',
                    'pwmConnectorMenu',
                    args[0],
                    '10',
                );
                converter.addNumberInput(
                    block,
                    'LEVEL',
                    'math_number',
                    args[1],
                    0,
                );
                return block;
            },
        );

        // --- Servo + IR ---

        // akadako.servo_turn("10", 90, 100)
        converter.registerOnSend(
            AKADAKO,
            'servo_turn',
            3,
            (params) => {
                const { receiver, args } = params;
                if (!converter.isString(args[0])) return null;
                const block = converter.changeRubyExpressionBlock(
                    receiver,
                    'g2s_servoTurn',
                    'statement',
                );
                converter.addFieldInput(
                    block,
                    'CONNECTOR',
                    'g2s_menu_servoConnectorMenu',
                    'servoConnectorMenu',
                    args[0],
                    '10',
                );
                converter.addNumberInput(
                    block,
                    'ANGLE',
                    'math_number',
                    args[1],
                    90,
                );
                converter.addNumberInput(
                    block,
                    'SPEED',
                    'math_number',
                    args[2],
                    100,
                );
                return block;
            },
        );

        // akadako.send_ir_remote("10", "1")
        converter.registerOnSend(
            AKADAKO,
            'send_ir_remote',
            2,
            (params) => {
                const { receiver, args } = params;
                if (!converter.isString(args[0]) || !converter.isString(args[1]))
                    return null;
                const block = converter.changeRubyExpressionBlock(
                    receiver,
                    'g2s_sendIrRemote',
                    'statement',
                );
                converter.addFieldInput(
                    block,
                    'CONNECTOR',
                    'g2s_menu_irRemoteMenuConnector',
                    'irRemoteMenuConnector',
                    args[0],
                    '10',
                );
                converter.addFieldInput(
                    block,
                    'N',
                    'g2s_menu_irRemoteMenuN',
                    'irRemoteMenuN',
                    args[1],
                    '1',
                );
                return block;
            },
        );

        // --- Sensors (no-arg reporters) ---

        // akadako.ultrasonic_distance_a
        converter.registerOnSend(
            AKADAKO,
            'ultrasonic_distance_a',
            0,
            (params) => {
                const { receiver } = params;
                return converter.changeRubyExpressionBlock(
                    receiver,
                    'g2s_measureDistanceWithUltrasonicA',
                    'value',
                );
            },
        );

        // akadako.ultrasonic_distance_b
        converter.registerOnSend(
            AKADAKO,
            'ultrasonic_distance_b',
            0,
            (params) => {
                const { receiver } = params;
                return converter.changeRubyExpressionBlock(
                    receiver,
                    'g2s_measureDistanceWithUltrasonicB',
                    'value',
                );
            },
        );

        // akadako.laser_distance
        converter.registerOnSend(
            AKADAKO,
            'laser_distance',
            0,
            (params) => {
                const { receiver } = params;
                return converter.changeRubyExpressionBlock(
                    receiver,
                    'g2s_measureDistanceWithLight',
                    'value',
                );
            },
        );

        // akadako.motion_sensor_value
        converter.registerOnSend(
            AKADAKO,
            'motion_sensor_value',
            0,
            (params) => {
                const { receiver } = params;
                return converter.changeRubyExpressionBlock(
                    receiver,
                    'g2s_motionSensorValue',
                    'value',
                );
            },
        );

        // akadako.pitch
        converter.registerOnSend(AKADAKO, 'pitch', 0, (params) => {
            const { receiver } = params;
            return converter.changeRubyExpressionBlock(
                receiver,
                'g2s_getPitch',
                'value',
            );
        });

        // akadako.roll
        converter.registerOnSend(AKADAKO, 'roll', 0, (params) => {
            const { receiver } = params;
            return converter.changeRubyExpressionBlock(
                receiver,
                'g2s_getRoll',
                'value',
            );
        });

        // akadako.acceleration_x
        converter.registerOnSend(
            AKADAKO,
            'acceleration_x',
            0,
            (params) => {
                const { receiver } = params;
                return converter.changeRubyExpressionBlock(
                    receiver,
                    'g2s_getAccelerationX',
                    'value',
                );
            },
        );

        // akadako.acceleration_y
        converter.registerOnSend(
            AKADAKO,
            'acceleration_y',
            0,
            (params) => {
                const { receiver } = params;
                return converter.changeRubyExpressionBlock(
                    receiver,
                    'g2s_getAccelerationY',
                    'value',
                );
            },
        );

        // akadako.acceleration_z
        converter.registerOnSend(
            AKADAKO,
            'acceleration_z',
            0,
            (params) => {
                const { receiver } = params;
                return converter.changeRubyExpressionBlock(
                    receiver,
                    'g2s_getAccelerationZ',
                    'value',
                );
            },
        );

        // akadako.acceleration_absolute
        converter.registerOnSend(
            AKADAKO,
            'acceleration_absolute',
            0,
            (params) => {
                const { receiver } = params;
                return converter.changeRubyExpressionBlock(
                    receiver,
                    'g2s_getAccelerationAbsolute',
                    'value',
                );
            },
        );

        // akadako.brightness
        converter.registerOnSend(AKADAKO, 'brightness', 0, (params) => {
            const { receiver } = params;
            return converter.changeRubyExpressionBlock(
                receiver,
                'g2s_getBrightness',
                'value',
            );
        });

        // akadako.analog_brightness
        converter.registerOnSend(
            AKADAKO,
            'analog_brightness',
            0,
            (params) => {
                const { receiver } = params;
                return converter.changeRubyExpressionBlock(
                    receiver,
                    'g2s_getAnalogBrightness',
                    'value',
                );
            },
        );

        // akadako.temperature
        converter.registerOnSend(AKADAKO, 'temperature', 0, (params) => {
            const { receiver } = params;
            return converter.changeRubyExpressionBlock(
                receiver,
                'g2s_getTemperature',
                'value',
            );
        });

        // akadako.pressure
        converter.registerOnSend(AKADAKO, 'pressure', 0, (params) => {
            const { receiver } = params;
            return converter.changeRubyExpressionBlock(
                receiver,
                'g2s_getPressure',
                'value',
            );
        });

        // akadako.humidity
        converter.registerOnSend(AKADAKO, 'humidity', 0, (params) => {
            const { receiver } = params;
            return converter.changeRubyExpressionBlock(
                receiver,
                'g2s_getHumidity',
                'value',
            );
        });

        // akadako.water_temperature_a
        converter.registerOnSend(
            AKADAKO,
            'water_temperature_a',
            0,
            (params) => {
                const { receiver } = params;
                return converter.changeRubyExpressionBlock(
                    receiver,
                    'g2s_getWaterTemperatureA',
                    'value',
                );
            },
        );

        // akadako.water_temperature_b
        converter.registerOnSend(
            AKADAKO,
            'water_temperature_b',
            0,
            (params) => {
                const { receiver } = params;
                return converter.changeRubyExpressionBlock(
                    receiver,
                    'g2s_getWaterTemperatureB',
                    'value',
                );
            },
        );

        // --- HAT (no-arg) ---

        // akadako.when_shaken do ... end
        converter.registerOnSendWithBlock(
            AKADAKO,
            'when_shaken',
            0,
            0,
            (params) => {
                const { receiver, rubyBlock } = params;
                const block = converter.changeRubyExpressionBlock(
                    receiver,
                    'g2s_whenShaken',
                    'hat',
                );
                converter.setParent(rubyBlock, block);
                return block;
            },
        );

        // --- NeoPixel LED ---

        // akadako.neopixel_config("10", 3)
        converter.registerOnSend(
            AKADAKO,
            'neopixel_config',
            2,
            (params) => {
                const { receiver, args } = params;
                if (!converter.isString(args[0])) return null;
                const block = converter.changeRubyExpressionBlock(
                    receiver,
                    'g2s_neoPixelConfigStrip',
                    'statement',
                );
                converter.addFieldInput(
                    block,
                    'CONNECTOR',
                    'g2s_menu_neoPixelConnectorMenu',
                    'neoPixelConnectorMenu',
                    args[0],
                    '10',
                );
                converter.addNumberInput(
                    block,
                    'LENGTH',
                    'math_number',
                    args[1],
                    3,
                );
                return block;
            },
        );

        // akadako.neopixel_set_color("10", 1, "0xff, 0, 0", 50)
        converter.registerOnSend(
            AKADAKO,
            'neopixel_set_color',
            4,
            (params) => {
                const { receiver, args } = params;
                if (!converter.isString(args[0])) return null;
                const block = converter.changeRubyExpressionBlock(
                    receiver,
                    'g2s_neoPixelSetColor',
                    'statement',
                );
                converter.addFieldInput(
                    block,
                    'CONNECTOR',
                    'g2s_menu_neoPixelConnectorMenu',
                    'neoPixelConnectorMenu',
                    args[0],
                    '10',
                );
                converter.addNumberInput(
                    block,
                    'POSITION',
                    'math_number',
                    args[1],
                    1,
                );
                converter.addFieldInput(
                    block,
                    'COLOR',
                    'g2s_menu_neoPixelColorMenuSimple',
                    'neoPixelColorMenuSimple',
                    args[2],
                    '0xff, 0, 0',
                );
                converter.addNumberInput(
                    block,
                    'BRIGHTNESS',
                    'math_number',
                    args[3],
                    50,
                );
                return block;
            },
        );

        // akadako.neopixel_fill_color("10", "0xff, 0, 0", 50)
        converter.registerOnSend(
            AKADAKO,
            'neopixel_fill_color',
            3,
            (params) => {
                const { receiver, args } = params;
                if (!converter.isString(args[0])) return null;
                const block = converter.changeRubyExpressionBlock(
                    receiver,
                    'g2s_neoPixelFillColor',
                    'statement',
                );
                converter.addFieldInput(
                    block,
                    'CONNECTOR',
                    'g2s_menu_neoPixelConnectorMenu',
                    'neoPixelConnectorMenu',
                    args[0],
                    '10',
                );
                converter.addFieldInput(
                    block,
                    'COLOR',
                    'g2s_menu_neoPixelColorMenu',
                    'neoPixelColorMenu',
                    args[1],
                    '0xff, 0, 0',
                );
                converter.addNumberInput(
                    block,
                    'BRIGHTNESS',
                    'math_number',
                    args[2],
                    50,
                );
                return block;
            },
        );

        // akadako.neopixel_shift_color("10", 1, "true")
        converter.registerOnSend(
            AKADAKO,
            'neopixel_shift_color',
            3,
            (params) => {
                const { receiver, args } = params;
                if (!converter.isString(args[0]) || !converter.isString(args[2]))
                    return null;
                const block = converter.changeRubyExpressionBlock(
                    receiver,
                    'g2s_neoPixelShiftColor',
                    'statement',
                );
                converter.addFieldInput(
                    block,
                    'CONNECTOR',
                    'g2s_menu_neoPixelConnectorMenu',
                    'neoPixelConnectorMenu',
                    args[0],
                    '10',
                );
                converter.addNumberInput(
                    block,
                    'N',
                    'math_number',
                    args[1],
                    1,
                );
                converter.addFieldInput(
                    block,
                    'LOOP_MODE',
                    'g2s_menu_neoPixelShiftColorLoopModeMenu',
                    'neoPixelShiftColorLoopModeMenu',
                    args[2],
                    'true',
                );
                return block;
            },
        );

        // akadako.neopixel_color("255", "255", "255")
        converter.registerOnSend(
            AKADAKO,
            'neopixel_color',
            3,
            (params) => {
                const { receiver, args } = params;
                if (
                    !converter.isStringOrBlock(args[0]) ||
                    !converter.isStringOrBlock(args[1]) ||
                    !converter.isStringOrBlock(args[2])
                )
                    return null;
                const block = converter.changeRubyExpressionBlock(
                    receiver,
                    'g2s_neoPixelColor',
                    'value',
                );
                converter.addTextInput(block, 'RED', args[0], '255');
                converter.addTextInput(block, 'GREEN', args[1], '255');
                converter.addTextInput(block, 'BLUE', args[2], '255');
                return block;
            },
        );

        // akadako.neopixel_color_mode("rainbow")
        converter.registerOnSend(
            AKADAKO,
            'neopixel_color_mode',
            1,
            (params) => {
                const { receiver, args } = params;
                if (!converter.isString(args[0])) return null;
                const block = converter.changeRubyExpressionBlock(
                    receiver,
                    'g2s_neoPixelColorMode',
                    'value',
                );
                converter.addFieldInput(
                    block,
                    'MODE',
                    'g2s_menu_neoPixelColorModeMenu',
                    'neoPixelColorModeMenu',
                    args[0],
                    'rainbow',
                );
                return block;
            },
        );

        // akadako.neopixel_show
        converter.registerOnSend(
            AKADAKO,
            'neopixel_show',
            0,
            (params) => {
                const { receiver } = params;
                return converter.changeRubyExpressionBlock(
                    receiver,
                    'g2s_neoPixelShow',
                    'statement',
                );
            },
        );

        // akadako.neopixel_clear("10")
        converter.registerOnSend(
            AKADAKO,
            'neopixel_clear',
            1,
            (params) => {
                const { receiver, args } = params;
                if (!converter.isString(args[0])) return null;
                const block = converter.changeRubyExpressionBlock(
                    receiver,
                    'g2s_neoPixelClear',
                    'statement',
                );
                converter.addFieldInput(
                    block,
                    'CONNECTOR',
                    'g2s_menu_neoPixelConnectorMenu',
                    'neoPixelConnectorMenu',
                    args[0],
                    '10',
                );
                return block;
            },
        );

        // --- I2C ---

        // akadako.i2c_write("0x00", "0x00", "0x00, 0x00")
        converter.registerOnSend(AKADAKO, 'i2c_write', 3, (params) => {
            const { receiver, args } = params;
            if (
                !converter.isStringOrBlock(args[0]) ||
                !converter.isStringOrBlock(args[1]) ||
                !converter.isStringOrBlock(args[2])
            )
                return null;
            const block = converter.changeRubyExpressionBlock(
                receiver,
                'g2s_i2cWrite',
                'statement',
            );
            converter.addTextInput(block, 'ADDRESS', args[0], '0x00');
            converter.addTextInput(block, 'REGISTER', args[1], '0x00');
            converter.addTextInput(block, 'DATA', args[2], '0x00, 0x00');
            return block;
        });

        // akadako.i2c_read("0x00", "0x00", 1)
        converter.registerOnSend(AKADAKO, 'i2c_read', 3, (params) => {
            const { receiver, args } = params;
            if (
                !converter.isStringOrBlock(args[0]) ||
                !converter.isStringOrBlock(args[1])
            )
                return null;
            const block = converter.changeRubyExpressionBlock(
                receiver,
                'g2s_i2cReadOnce',
                'value',
            );
            converter.addTextInput(block, 'ADDRESS', args[0], '0x00');
            converter.addTextInput(block, 'REGISTER', args[1], '0x00');
            converter.addNumberInput(
                block,
                'LENGTH',
                'math_number',
                args[2],
                1,
            );
            return block;
        });

        // --- Array/Data ---

        // akadako.number_at("1.0, 1E1, 0xFF", 1)
        converter.registerOnSend(AKADAKO, 'number_at', 2, (params) => {
            const { receiver, args } = params;
            if (!converter.isStringOrBlock(args[0])) return null;
            const block = converter.changeRubyExpressionBlock(
                receiver,
                'g2s_numberAtIndex',
                'value',
            );
            converter.addTextInput(
                block,
                'ARRAY',
                args[0],
                '1.0, 1E1, 0xFF',
            );
            converter.addNumberInput(
                block,
                'INDEX',
                'math_number',
                args[1],
                1,
            );
            return block;
        });

        // akadako.splice_numbers("1.0, 1E1, 0xFF", 1, 1, "-1, 0")
        converter.registerOnSend(
            AKADAKO,
            'splice_numbers',
            4,
            (params) => {
                const { receiver, args } = params;
                if (
                    !converter.isStringOrBlock(args[0]) ||
                    !converter.isStringOrBlock(args[3])
                )
                    return null;
                const block = converter.changeRubyExpressionBlock(
                    receiver,
                    'g2s_spliceNumbers',
                    'value',
                );
                converter.addTextInput(
                    block,
                    'ARRAY',
                    args[0],
                    '1.0, 1E1, 0xFF',
                );
                converter.addNumberInput(
                    block,
                    'INDEX',
                    'math_number',
                    args[1],
                    1,
                );
                converter.addNumberInput(
                    block,
                    'DELETE',
                    'math_number',
                    args[2],
                    1,
                );
                converter.addTextInput(block, 'INSERT', args[3], '-1, 0');
                return block;
            },
        );

        // akadako.numbers_length("1.0, 1E1, 0xFF")
        converter.registerOnSend(
            AKADAKO,
            'numbers_length',
            1,
            (params) => {
                const { receiver, args } = params;
                if (!converter.isStringOrBlock(args[0])) return null;
                const block = converter.changeRubyExpressionBlock(
                    receiver,
                    'g2s_lengthOfNumbers',
                    'value',
                );
                converter.addTextInput(
                    block,
                    'ARRAY',
                    args[0],
                    '1.0, 1E1, 0xFF',
                );
                return block;
            },
        );

        // akadako.read_bytes_as("0x00, 0xFF, 0xFF, 0x00", "Int16", "little")
        converter.registerOnSend(
            AKADAKO,
            'read_bytes_as',
            3,
            (params) => {
                const { receiver, args } = params;
                if (
                    !converter.isStringOrBlock(args[0]) ||
                    !converter.isString(args[1]) ||
                    !converter.isString(args[2])
                )
                    return null;
                const block = converter.changeRubyExpressionBlock(
                    receiver,
                    'g2s_readBytesAs',
                    'value',
                );
                converter.addTextInput(
                    block,
                    'ARRAY',
                    args[0],
                    '0x00, 0xFF, 0xFF, 0x00',
                );
                converter.addFieldInput(
                    block,
                    'TYPE',
                    'g2s_menu_bytesTypeMenu',
                    'bytesTypeMenu',
                    args[1],
                    'Int16',
                );
                converter.addFieldInput(
                    block,
                    'ENDIAN',
                    'g2s_menu_endianMenu',
                    'endianMenu',
                    args[2],
                    'little',
                );
                return block;
            },
        );

        // --- Bitwise ---

        // akadako.int64_op("0x01", "+", "0x02")
        converter.registerOnSend(AKADAKO, 'int64_op', 3, (params) => {
            const { receiver, args } = params;
            if (
                !converter.isStringOrBlock(args[0]) ||
                !converter.isString(args[1]) ||
                !converter.isStringOrBlock(args[2])
            )
                return null;
            const block = converter.changeRubyExpressionBlock(
                receiver,
                'g2s_int64Operation',
                'value',
            );
            converter.addTextInput(block, 'LEFT', args[0], '0x01');
            converter.addFieldInput(
                block,
                'OP',
                'g2s_menu_int64OperationMenu',
                'int64OperationMenu',
                args[1],
                '\uff0b',
            );
            converter.addTextInput(block, 'RIGHT', args[2], '0x02');
            return block;
        });

        // akadako.bit_op("0x03", "&", "0x01")
        converter.registerOnSend(AKADAKO, 'bit_op', 3, (params) => {
            const { receiver, args } = params;
            if (
                !converter.isStringOrBlock(args[0]) ||
                !converter.isString(args[1]) ||
                !converter.isStringOrBlock(args[2])
            )
                return null;
            const block = converter.changeRubyExpressionBlock(
                receiver,
                'g2s_bitOperation',
                'value',
            );
            converter.addTextInput(block, 'LEFT', args[0], '0x03');
            converter.addFieldInput(
                block,
                'OP',
                'g2s_menu_bitOperationMenu',
                'bitOperationMenu',
                args[1],
                '&',
            );
            converter.addTextInput(block, 'RIGHT', args[2], '0x01');
            return block;
        });

        // akadako.bit_not("0x01")
        converter.registerOnSend(AKADAKO, 'bit_not', 1, (params) => {
            const { receiver, args } = params;
            if (!converter.isStringOrBlock(args[0])) return null;
            const block = converter.changeRubyExpressionBlock(
                receiver,
                'g2s_bitNot',
                'value',
            );
            converter.addTextInput(block, 'VALUE', args[0], '0x01');
            return block;
        });
    },
};

export default G2SConverter;
