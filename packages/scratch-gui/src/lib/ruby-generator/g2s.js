/**
 * Define Ruby code generator for AkaDako (g2s) Blocks.
 * @param {object} Generator - The Ruby code generator instance.
 * @returns {object} same as param.
 */
export default function (Generator) {
    // --- Board connection ---

    Generator.g2s_connectBoard = function () {
        return 'akadako.connect_board\n';
    };

    Generator.g2s_disconnectBoard = function () {
        return 'akadako.disconnect_board\n';
    };

    Generator.g2s_isConnected = function () {
        return ['akadako.connected?', Generator.ORDER_FUNCTION_CALL];
    };

    Generator.g2s_boardStateChanged = function (block) {
        block.isStatement = true;
        const state =
            Generator.valueToCode(block, 'STATE', Generator.ORDER_NONE) ||
            Generator.quote_('connected');
        return `akadako.when_board_state_changed(${state}) do\n`;
    };

    Generator.g2s_boardVersion = function () {
        return ['akadako.board_version', Generator.ORDER_FUNCTION_CALL];
    };

    // --- Analog I/O ---

    Generator.g2s_analogLevelA1 = function () {
        return ['akadako.analog_level_a1', Generator.ORDER_FUNCTION_CALL];
    };

    Generator.g2s_analogLevelA2 = function () {
        return ['akadako.analog_level_a2', Generator.ORDER_FUNCTION_CALL];
    };

    Generator.g2s_analogLevelB1 = function () {
        return ['akadako.analog_level_b1', Generator.ORDER_FUNCTION_CALL];
    };

    Generator.g2s_analogLevelB2 = function () {
        return ['akadako.analog_level_b2', Generator.ORDER_FUNCTION_CALL];
    };

    // --- Digital I/O ---

    Generator.g2s_digitalLevelA1 = function () {
        return ['akadako.digital_level_a1', Generator.ORDER_FUNCTION_CALL];
    };

    Generator.g2s_digitalLevelA2 = function () {
        return ['akadako.digital_level_a2', Generator.ORDER_FUNCTION_CALL];
    };

    Generator.g2s_digitalLevelB1 = function () {
        return ['akadako.digital_level_b1', Generator.ORDER_FUNCTION_CALL];
    };

    Generator.g2s_digitalLevelB2 = function () {
        return ['akadako.digital_level_b2', Generator.ORDER_FUNCTION_CALL];
    };

    Generator.g2s_digitalLevelSet = function (block) {
        const connector =
            Generator.valueToCode(
                block,
                'CONNECTOR',
                Generator.ORDER_NONE,
            ) || Generator.quote_('10');
        const level =
            Generator.valueToCode(block, 'LEVEL', Generator.ORDER_NONE) ||
            Generator.quote_('true');
        return `akadako.set_digital_level(${connector}, ${level})\n`;
    };

    Generator.g2s_digitalIsHigh = function (block) {
        const connector =
            Generator.valueToCode(
                block,
                'CONNECTOR',
                Generator.ORDER_NONE,
            ) || Generator.quote_('10');
        return [
            `akadako.digital_high?(${connector})`,
            Generator.ORDER_FUNCTION_CALL,
        ];
    };

    Generator.g2s_digitalLevelChanged = function (block) {
        block.isStatement = true;
        const connector =
            Generator.valueToCode(
                block,
                'CONNECTOR',
                Generator.ORDER_NONE,
            ) || Generator.quote_('10');
        const level =
            Generator.valueToCode(block, 'LEVEL', Generator.ORDER_NONE) ||
            Generator.quote_('true');
        return `akadako.when_digital_level_changed(${connector}, ${level}) do\n`;
    };

    Generator.g2s_inputBiasSet = function (block) {
        const pin =
            Generator.valueToCode(block, 'PIN', Generator.ORDER_NONE) ||
            Generator.quote_('10');
        const bias =
            Generator.valueToCode(block, 'BIAS', Generator.ORDER_NONE) ||
            Generator.quote_('none');
        return `akadako.set_input_bias(${pin}, ${bias})\n`;
    };

    Generator.g2s_analogLevelSet = function (block) {
        const connector =
            Generator.valueToCode(
                block,
                'CONNECTOR',
                Generator.ORDER_NONE,
            ) || Generator.quote_('10');
        const level =
            Generator.valueToCode(block, 'LEVEL', Generator.ORDER_NONE) ||
            '0';
        return `akadako.set_pwm_duty(${connector}, ${level})\n`;
    };

    // --- Servo + IR ---

    Generator.g2s_servoTurn = function (block) {
        const connector =
            Generator.valueToCode(
                block,
                'CONNECTOR',
                Generator.ORDER_NONE,
            ) || Generator.quote_('10');
        const angle =
            Generator.valueToCode(block, 'ANGLE', Generator.ORDER_NONE) ||
            '90';
        const speed =
            Generator.valueToCode(block, 'SPEED', Generator.ORDER_NONE) ||
            '100';
        return `akadako.servo_turn(${connector}, ${angle}, ${speed})\n`;
    };

    Generator.g2s_sendIrRemote = function (block) {
        const connector =
            Generator.valueToCode(
                block,
                'CONNECTOR',
                Generator.ORDER_NONE,
            ) || Generator.quote_('10');
        const n =
            Generator.valueToCode(block, 'N', Generator.ORDER_NONE) ||
            Generator.quote_('1');
        return `akadako.send_ir_remote(${connector}, ${n})\n`;
    };

    // --- Distance/Motion sensors ---

    Generator.g2s_measureDistanceWithUltrasonicA = function () {
        return [
            'akadako.ultrasonic_distance_a',
            Generator.ORDER_FUNCTION_CALL,
        ];
    };

    Generator.g2s_measureDistanceWithUltrasonicB = function () {
        return [
            'akadako.ultrasonic_distance_b',
            Generator.ORDER_FUNCTION_CALL,
        ];
    };

    Generator.g2s_measureDistanceWithLight = function () {
        return ['akadako.laser_distance', Generator.ORDER_FUNCTION_CALL];
    };

    Generator.g2s_motionSensorValue = function () {
        return [
            'akadako.motion_sensor_value',
            Generator.ORDER_FUNCTION_CALL,
        ];
    };

    // --- Accelerometer ---

    Generator.g2s_whenShaken = function (block) {
        block.isStatement = true;
        return 'akadako.when_shaken do\n';
    };

    Generator.g2s_getPitch = function () {
        return ['akadako.pitch', Generator.ORDER_FUNCTION_CALL];
    };

    Generator.g2s_getRoll = function () {
        return ['akadako.roll', Generator.ORDER_FUNCTION_CALL];
    };

    Generator.g2s_getAccelerationX = function () {
        return ['akadako.acceleration_x', Generator.ORDER_FUNCTION_CALL];
    };

    Generator.g2s_getAccelerationY = function () {
        return ['akadako.acceleration_y', Generator.ORDER_FUNCTION_CALL];
    };

    Generator.g2s_getAccelerationZ = function () {
        return ['akadako.acceleration_z', Generator.ORDER_FUNCTION_CALL];
    };

    Generator.g2s_getAccelerationAbsolute = function () {
        return [
            'akadako.acceleration_absolute',
            Generator.ORDER_FUNCTION_CALL,
        ];
    };

    // --- Light/Environment/Water temperature ---

    Generator.g2s_getBrightness = function () {
        return ['akadako.brightness', Generator.ORDER_FUNCTION_CALL];
    };

    Generator.g2s_getAnalogBrightness = function () {
        return ['akadako.analog_brightness', Generator.ORDER_FUNCTION_CALL];
    };

    Generator.g2s_getTemperature = function () {
        return ['akadako.temperature', Generator.ORDER_FUNCTION_CALL];
    };

    Generator.g2s_getPressure = function () {
        return ['akadako.pressure', Generator.ORDER_FUNCTION_CALL];
    };

    Generator.g2s_getHumidity = function () {
        return ['akadako.humidity', Generator.ORDER_FUNCTION_CALL];
    };

    Generator.g2s_getWaterTemperatureA = function () {
        return [
            'akadako.water_temperature_a',
            Generator.ORDER_FUNCTION_CALL,
        ];
    };

    Generator.g2s_getWaterTemperatureB = function () {
        return [
            'akadako.water_temperature_b',
            Generator.ORDER_FUNCTION_CALL,
        ];
    };

    // --- NeoPixel LED ---

    Generator.g2s_neoPixelConfigStrip = function (block) {
        const connector =
            Generator.valueToCode(
                block,
                'CONNECTOR',
                Generator.ORDER_NONE,
            ) || Generator.quote_('10');
        const length =
            Generator.valueToCode(block, 'LENGTH', Generator.ORDER_NONE) ||
            '3';
        return `akadako.neopixel_config(${connector}, ${length})\n`;
    };

    Generator.g2s_neoPixelSetColor = function (block) {
        const connector =
            Generator.valueToCode(
                block,
                'CONNECTOR',
                Generator.ORDER_NONE,
            ) || Generator.quote_('10');
        const position =
            Generator.valueToCode(
                block,
                'POSITION',
                Generator.ORDER_NONE,
            ) || '1';
        const color =
            Generator.valueToCode(block, 'COLOR', Generator.ORDER_NONE) ||
            Generator.quote_('0xff, 0, 0');
        const brightness =
            Generator.valueToCode(
                block,
                'BRIGHTNESS',
                Generator.ORDER_NONE,
            ) || '50';
        return `akadako.neopixel_set_color(${connector}, ${position}, ${color}, ${brightness})\n`;
    };

    Generator.g2s_neoPixelFillColor = function (block) {
        const connector =
            Generator.valueToCode(
                block,
                'CONNECTOR',
                Generator.ORDER_NONE,
            ) || Generator.quote_('10');
        const color =
            Generator.valueToCode(block, 'COLOR', Generator.ORDER_NONE) ||
            Generator.quote_('0xff, 0, 0');
        const brightness =
            Generator.valueToCode(
                block,
                'BRIGHTNESS',
                Generator.ORDER_NONE,
            ) || '50';
        return `akadako.neopixel_fill_color(${connector}, ${color}, ${brightness})\n`;
    };

    Generator.g2s_neoPixelShiftColor = function (block) {
        const connector =
            Generator.valueToCode(
                block,
                'CONNECTOR',
                Generator.ORDER_NONE,
            ) || Generator.quote_('10');
        const n =
            Generator.valueToCode(block, 'N', Generator.ORDER_NONE) || '1';
        const loopMode =
            Generator.valueToCode(
                block,
                'LOOP_MODE',
                Generator.ORDER_NONE,
            ) || Generator.quote_('true');
        return `akadako.neopixel_shift_color(${connector}, ${n}, ${loopMode})\n`;
    };

    Generator.g2s_neoPixelColor = function (block) {
        const red =
            Generator.valueToCode(block, 'RED', Generator.ORDER_NONE) ||
            '255';
        const green =
            Generator.valueToCode(block, 'GREEN', Generator.ORDER_NONE) ||
            '255';
        const blue =
            Generator.valueToCode(block, 'BLUE', Generator.ORDER_NONE) ||
            '255';
        return [
            `akadako.neopixel_color(${red}, ${green}, ${blue})`,
            Generator.ORDER_FUNCTION_CALL,
        ];
    };

    Generator.g2s_neoPixelColorMode = function (block) {
        const mode =
            Generator.valueToCode(block, 'MODE', Generator.ORDER_NONE) ||
            Generator.quote_('rainbow');
        return [
            `akadako.neopixel_color_mode(${mode})`,
            Generator.ORDER_FUNCTION_CALL,
        ];
    };

    Generator.g2s_neoPixelShow = function () {
        return 'akadako.neopixel_show\n';
    };

    Generator.g2s_neoPixelClear = function (block) {
        const connector =
            Generator.valueToCode(
                block,
                'CONNECTOR',
                Generator.ORDER_NONE,
            ) || Generator.quote_('10');
        return `akadako.neopixel_clear(${connector})\n`;
    };

    // --- I2C ---

    Generator.g2s_i2cWrite = function (block) {
        const address =
            Generator.valueToCode(block, 'ADDRESS', Generator.ORDER_NONE) ||
            Generator.quote_('0x00');
        const register =
            Generator.valueToCode(
                block,
                'REGISTER',
                Generator.ORDER_NONE,
            ) || Generator.quote_('0x00');
        const data =
            Generator.valueToCode(block, 'DATA', Generator.ORDER_NONE) ||
            Generator.quote_('0x00');
        return `akadako.i2c_write(${address}, ${register}, ${data})\n`;
    };

    Generator.g2s_i2cReadOnce = function (block) {
        const address =
            Generator.valueToCode(block, 'ADDRESS', Generator.ORDER_NONE) ||
            Generator.quote_('0x00');
        const register =
            Generator.valueToCode(
                block,
                'REGISTER',
                Generator.ORDER_NONE,
            ) || Generator.quote_('0x00');
        const length =
            Generator.valueToCode(block, 'LENGTH', Generator.ORDER_NONE) ||
            '1';
        return [
            `akadako.i2c_read(${address}, ${register}, ${length})`,
            Generator.ORDER_FUNCTION_CALL,
        ];
    };

    // --- Array/Data ---

    Generator.g2s_numberAtIndex = function (block) {
        const array =
            Generator.valueToCode(block, 'ARRAY', Generator.ORDER_NONE) ||
            Generator.quote_('1, 2, 3');
        const index =
            Generator.valueToCode(block, 'INDEX', Generator.ORDER_NONE) ||
            '1';
        return [
            `akadako.number_at(${array}, ${index})`,
            Generator.ORDER_FUNCTION_CALL,
        ];
    };

    Generator.g2s_spliceNumbers = function (block) {
        const array =
            Generator.valueToCode(block, 'ARRAY', Generator.ORDER_NONE) ||
            Generator.quote_('1.0, 1E1, 0xFF');
        const index =
            Generator.valueToCode(block, 'INDEX', Generator.ORDER_NONE) ||
            '1';
        const del =
            Generator.valueToCode(block, 'DELETE', Generator.ORDER_NONE) ||
            '1';
        const insert =
            Generator.valueToCode(block, 'INSERT', Generator.ORDER_NONE) ||
            Generator.quote_('-1, 0');
        return [
            `akadako.splice_numbers(${array}, ${index}, ${del}, ${insert})`,
            Generator.ORDER_FUNCTION_CALL,
        ];
    };

    Generator.g2s_lengthOfNumbers = function (block) {
        const array =
            Generator.valueToCode(block, 'ARRAY', Generator.ORDER_NONE) ||
            Generator.quote_('1.0, 1E1, 0xFF');
        return [
            `akadako.numbers_length(${array})`,
            Generator.ORDER_FUNCTION_CALL,
        ];
    };

    Generator.g2s_readBytesAs = function (block) {
        const array =
            Generator.valueToCode(block, 'ARRAY', Generator.ORDER_NONE) ||
            Generator.quote_('0x00, 0xFF, 0xFF, 0x00');
        const type =
            Generator.valueToCode(block, 'TYPE', Generator.ORDER_NONE) ||
            Generator.quote_('Int16');
        const endian =
            Generator.valueToCode(block, 'ENDIAN', Generator.ORDER_NONE) ||
            Generator.quote_('little');
        return [
            `akadako.read_bytes_as(${array}, ${type}, ${endian})`,
            Generator.ORDER_FUNCTION_CALL,
        ];
    };

    // --- Bitwise ---

    Generator.g2s_int64Operation = function (block) {
        const left =
            Generator.valueToCode(block, 'LEFT', Generator.ORDER_NONE) ||
            Generator.quote_('0x01');
        const op =
            Generator.valueToCode(block, 'OP', Generator.ORDER_NONE) ||
            Generator.quote_('+');
        const right =
            Generator.valueToCode(block, 'RIGHT', Generator.ORDER_NONE) ||
            Generator.quote_('0x02');
        return [
            `akadako.int64_op(${left}, ${op}, ${right})`,
            Generator.ORDER_FUNCTION_CALL,
        ];
    };

    Generator.g2s_bitOperation = function (block) {
        const left =
            Generator.valueToCode(block, 'LEFT', Generator.ORDER_NONE) ||
            Generator.quote_('0x03');
        const op =
            Generator.valueToCode(block, 'OP', Generator.ORDER_NONE) ||
            Generator.quote_('&');
        const right =
            Generator.valueToCode(block, 'RIGHT', Generator.ORDER_NONE) ||
            Generator.quote_('0x01');
        return [
            `akadako.bit_op(${left}, ${op}, ${right})`,
            Generator.ORDER_FUNCTION_CALL,
        ];
    };

    Generator.g2s_bitNot = function (block) {
        const value =
            Generator.valueToCode(block, 'VALUE', Generator.ORDER_NONE) ||
            Generator.quote_('0x01');
        return [
            `akadako.bit_not(${value})`,
            Generator.ORDER_FUNCTION_CALL,
        ];
    };

    // --- Menus ---

    Generator.g2s_menu_boardStateMenu = function (block) {
        const value = Generator.quote_(
            Generator.getFieldValue(block, 'boardStateMenu', 'connected'),
        );
        return [value, Generator.ORDER_ATOMIC];
    };

    Generator.g2s_menu_digitalConnectorMenu = function (block) {
        const value = Generator.quote_(
            Generator.getFieldValue(block, 'digitalConnectorMenu', '10'),
        );
        return [value, Generator.ORDER_ATOMIC];
    };

    Generator.g2s_menu_digitalLevelSetConnectorMenu = function (block) {
        const value = Generator.quote_(
            Generator.getFieldValue(
                block,
                'digitalLevelSetConnectorMenu',
                '10',
            ),
        );
        return [value, Generator.ORDER_ATOMIC];
    };

    Generator.g2s_menu_digitalLevelMenu = function (block) {
        const value = Generator.quote_(
            Generator.getFieldValue(block, 'digitalLevelMenu', 'true'),
        );
        return [value, Generator.ORDER_ATOMIC];
    };

    Generator.g2s_menu_inputPinsMenu = function (block) {
        const value = Generator.quote_(
            Generator.getFieldValue(block, 'inputPinsMenu', '10'),
        );
        return [value, Generator.ORDER_ATOMIC];
    };

    Generator.g2s_menu_inputBiasMenu = function (block) {
        const value = Generator.quote_(
            Generator.getFieldValue(block, 'inputBiasMenu', 'none'),
        );
        return [value, Generator.ORDER_ATOMIC];
    };

    Generator.g2s_menu_pwmConnectorMenu = function (block) {
        const value = Generator.quote_(
            Generator.getFieldValue(block, 'pwmConnectorMenu', '10'),
        );
        return [value, Generator.ORDER_ATOMIC];
    };

    Generator.g2s_menu_servoConnectorMenu = function (block) {
        const value = Generator.quote_(
            Generator.getFieldValue(block, 'servoConnectorMenu', '10'),
        );
        return [value, Generator.ORDER_ATOMIC];
    };

    Generator.g2s_menu_neoPixelConnectorMenu = function (block) {
        const value = Generator.quote_(
            Generator.getFieldValue(block, 'neoPixelConnectorMenu', '10'),
        );
        return [value, Generator.ORDER_ATOMIC];
    };

    Generator.g2s_menu_neoPixelShiftColorLoopModeMenu = function (block) {
        const value = Generator.quote_(
            Generator.getFieldValue(
                block,
                'neoPixelShiftColorLoopModeMenu',
                'true',
            ),
        );
        return [value, Generator.ORDER_ATOMIC];
    };

    Generator.g2s_menu_neoPixelColorMenuSimple = function (block) {
        const value = Generator.quote_(
            Generator.getFieldValue(
                block,
                'neoPixelColorMenuSimple',
                '0xff, 0, 0',
            ),
        );
        return [value, Generator.ORDER_ATOMIC];
    };

    Generator.g2s_menu_neoPixelColorMenu = function (block) {
        const value = Generator.quote_(
            Generator.getFieldValue(
                block,
                'neoPixelColorMenu',
                '0xff, 0, 0',
            ),
        );
        return [value, Generator.ORDER_ATOMIC];
    };

    Generator.g2s_menu_neoPixelColorModeMenu = function (block) {
        const value = Generator.quote_(
            Generator.getFieldValue(
                block,
                'neoPixelColorModeMenu',
                'rainbow',
            ),
        );
        return [value, Generator.ORDER_ATOMIC];
    };

    Generator.g2s_menu_bytesTypeMenu = function (block) {
        const value = Generator.quote_(
            Generator.getFieldValue(block, 'bytesTypeMenu', 'Int16'),
        );
        return [value, Generator.ORDER_ATOMIC];
    };

    Generator.g2s_menu_endianMenu = function (block) {
        const value = Generator.quote_(
            Generator.getFieldValue(block, 'endianMenu', 'little'),
        );
        return [value, Generator.ORDER_ATOMIC];
    };

    Generator.g2s_menu_int64OperationMenu = function (block) {
        const value = Generator.quote_(
            Generator.getFieldValue(
                block,
                'int64OperationMenu',
                '\uFF0B',
            ),
        );
        return [value, Generator.ORDER_ATOMIC];
    };

    Generator.g2s_menu_bitOperationMenu = function (block) {
        const value = Generator.quote_(
            Generator.getFieldValue(block, 'bitOperationMenu', '&'),
        );
        return [value, Generator.ORDER_ATOMIC];
    };

    Generator.g2s_menu_irRemoteMenuConnector = function (block) {
        const value = Generator.quote_(
            Generator.getFieldValue(block, 'irRemoteMenuConnector', '10'),
        );
        return [value, Generator.ORDER_ATOMIC];
    };

    Generator.g2s_menu_irRemoteMenuN = function (block) {
        const value = Generator.quote_(
            Generator.getFieldValue(block, 'irRemoteMenuN', '1'),
        );
        return [value, Generator.ORDER_ATOMIC];
    };

    return Generator;
}
