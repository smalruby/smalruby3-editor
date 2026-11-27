import { menuInputArg, numberArg, registerSendTable, textArg, unchecked } from './send-table';

const AKADAKO = 'akadako';

// A menu of AkaDako: a string as it is (not a block).
const g2sMenu = (input, menu, defaultValue) =>
    menuInputArg(input, `g2s_menu_${menu}`, menu, defaultValue, { stringOnly: true });
const neoPixelConnectorArg = () => g2sMenu('CONNECTOR', 'neoPixelConnectorMenu', '10');
// A color of NeoPixel: anything, as it is (a string or a block).
const anyColorArg = (menu) => unchecked(menuInputArg('COLOR', `g2s_menu_${menu}`, menu, '0xff, 0, 0'));

// The reporters without an argument: [Ruby name, opcode].
const REPORTERS = [
    ['board_version', 'g2s_boardVersion'],
    ['analog_level_a1', 'g2s_analogLevelA1'],
    ['analog_level_a2', 'g2s_analogLevelA2'],
    ['analog_level_b1', 'g2s_analogLevelB1'],
    ['analog_level_b2', 'g2s_analogLevelB2'],
    ['digital_level_a1', 'g2s_digitalLevelA1'],
    ['digital_level_a2', 'g2s_digitalLevelA2'],
    ['digital_level_b1', 'g2s_digitalLevelB1'],
    ['digital_level_b2', 'g2s_digitalLevelB2'],
    ['ultrasonic_distance_a', 'g2s_measureDistanceWithUltrasonicA'],
    ['ultrasonic_distance_b', 'g2s_measureDistanceWithUltrasonicB'],
    ['laser_distance', 'g2s_measureDistanceWithLight'],
    ['motion_sensor_value', 'g2s_motionSensorValue'],
    ['pitch', 'g2s_getPitch'],
    ['roll', 'g2s_getRoll'],
    ['acceleration_x', 'g2s_getAccelerationX'],
    ['acceleration_y', 'g2s_getAccelerationY'],
    ['acceleration_z', 'g2s_getAccelerationZ'],
    ['acceleration_absolute', 'g2s_getAccelerationAbsolute'],
    ['brightness', 'g2s_getBrightness'],
    ['analog_brightness', 'g2s_getAnalogBrightness'],
    ['temperature', 'g2s_getTemperature'],
    ['pressure', 'g2s_getPressure'],
    ['humidity', 'g2s_getHumidity'],
    ['water_temperature_a', 'g2s_getWaterTemperatureA'],
    ['water_temperature_b', 'g2s_getWaterTemperatureB'],
].map(([name, opcode]) => ({ name, opcode, type: 'value' }));

// The calls of `akadako.xxx`, each of which maps one to one onto a block (send-table.js).
const G2S_SENDS = [
    // Board connection
    { name: 'connect_board', opcode: 'g2s_connectBoard' },
    { name: 'disconnect_board', opcode: 'g2s_disconnectBoard' },
    { name: 'connected?', opcode: 'g2s_isConnected', type: 'value_boolean' },
    {
        name: 'when_board_state_changed',
        opcode: 'g2s_boardStateChanged',
        hat: true,
        args: [g2sMenu('STATE', 'boardStateMenu', 'connected')],
    },
    ...REPORTERS,
    // Digital and analog I/O
    {
        name: 'set_digital_level',
        opcode: 'g2s_digitalLevelSet',
        args: [
            g2sMenu('CONNECTOR', 'digitalLevelSetConnectorMenu', '10'),
            g2sMenu('LEVEL', 'digitalLevelMenu', 'true'),
        ],
    },
    {
        name: 'digital_high?',
        opcode: 'g2s_digitalIsHigh',
        type: 'value_boolean',
        args: [g2sMenu('CONNECTOR', 'digitalConnectorMenu', '10')],
    },
    {
        name: 'when_digital_level_changed',
        opcode: 'g2s_digitalLevelChanged',
        hat: true,
        args: [g2sMenu('CONNECTOR', 'digitalConnectorMenu', '10'), g2sMenu('LEVEL', 'digitalLevelMenu', 'true')],
    },
    {
        name: 'set_input_bias',
        opcode: 'g2s_inputBiasSet',
        args: [g2sMenu('PIN', 'inputPinsMenu', '10'), g2sMenu('BIAS', 'inputBiasMenu', 'none')],
    },
    {
        name: 'set_pwm_duty',
        opcode: 'g2s_analogLevelSet',
        args: [g2sMenu('CONNECTOR', 'pwmConnectorMenu', '10'), numberArg('LEVEL', 0)],
    },
    // Servo and IR
    {
        name: 'servo_turn',
        opcode: 'g2s_servoTurn',
        args: [g2sMenu('CONNECTOR', 'servoConnectorMenu', '10'), numberArg('ANGLE', 90), numberArg('SPEED', 100)],
    },
    {
        name: 'send_ir_remote',
        opcode: 'g2s_sendIrRemote',
        args: [g2sMenu('CONNECTOR', 'irRemoteMenuConnector', '10'), g2sMenu('N', 'irRemoteMenuN', '1')],
    },
    { name: 'when_shaken', opcode: 'g2s_whenShaken', hat: true },
    // NeoPixel LED
    {
        name: 'neopixel_config',
        opcode: 'g2s_neoPixelConfigStrip',
        args: [neoPixelConnectorArg(), numberArg('LENGTH', 3)],
    },
    {
        name: 'neopixel_set_color',
        opcode: 'g2s_neoPixelSetColor',
        args: [
            neoPixelConnectorArg(),
            numberArg('POSITION', 1),
            anyColorArg('neoPixelColorMenuSimple'),
            numberArg('BRIGHTNESS', 50),
        ],
    },
    {
        name: 'neopixel_fill_color',
        opcode: 'g2s_neoPixelFillColor',
        args: [neoPixelConnectorArg(), anyColorArg('neoPixelColorMenu'), numberArg('BRIGHTNESS', 50)],
    },
    {
        name: 'neopixel_shift_color',
        opcode: 'g2s_neoPixelShiftColor',
        args: [
            neoPixelConnectorArg(),
            numberArg('N', 1),
            g2sMenu('LOOP_MODE', 'neoPixelShiftColorLoopModeMenu', 'true'),
        ],
    },
    {
        name: 'neopixel_color',
        opcode: 'g2s_neoPixelColor',
        type: 'value',
        args: [textArg('RED', '255'), textArg('GREEN', '255'), textArg('BLUE', '255')],
    },
    {
        name: 'neopixel_color_mode',
        opcode: 'g2s_neoPixelColorMode',
        type: 'value',
        args: [g2sMenu('MODE', 'neoPixelColorModeMenu', 'rainbow')],
    },
    { name: 'neopixel_show', opcode: 'g2s_neoPixelShow' },
    { name: 'neopixel_clear', opcode: 'g2s_neoPixelClear', args: [neoPixelConnectorArg()] },
    // I2C
    {
        name: 'i2c_write',
        opcode: 'g2s_i2cWrite',
        args: [textArg('ADDRESS', '0x00'), textArg('REGISTER', '0x00'), textArg('DATA', '0x00, 0x00')],
    },
    {
        name: 'i2c_read',
        opcode: 'g2s_i2cReadOnce',
        type: 'value',
        args: [textArg('ADDRESS', '0x00'), textArg('REGISTER', '0x00'), numberArg('LENGTH', 1)],
    },
    // Arrays and data
    {
        name: 'number_at',
        opcode: 'g2s_numberAtIndex',
        type: 'value',
        args: [textArg('ARRAY', '1.0, 1E1, 0xFF'), numberArg('INDEX', 1)],
    },
    {
        name: 'splice_numbers',
        opcode: 'g2s_spliceNumbers',
        type: 'value',
        args: [
            textArg('ARRAY', '1.0, 1E1, 0xFF'),
            numberArg('INDEX', 1),
            numberArg('DELETE', 1),
            textArg('INSERT', '-1, 0'),
        ],
    },
    {
        name: 'numbers_length',
        opcode: 'g2s_lengthOfNumbers',
        type: 'value',
        args: [textArg('ARRAY', '1.0, 1E1, 0xFF')],
    },
    {
        name: 'read_bytes_as',
        opcode: 'g2s_readBytesAs',
        type: 'value',
        args: [
            textArg('ARRAY', '0x00, 0xFF, 0xFF, 0x00'),
            g2sMenu('TYPE', 'bytesTypeMenu', 'Int16'),
            g2sMenu('ENDIAN', 'endianMenu', 'little'),
        ],
    },
    // Bitwise
    {
        name: 'int64_op',
        opcode: 'g2s_int64Operation',
        type: 'value',
        args: [textArg('LEFT', '0x01'), g2sMenu('OP', 'int64OperationMenu', '＋'), textArg('RIGHT', '0x02')],
    },
    {
        name: 'bit_op',
        opcode: 'g2s_bitOperation',
        type: 'value',
        args: [textArg('LEFT', '0x03'), g2sMenu('OP', 'bitOperationMenu', '&'), textArg('RIGHT', '0x01')],
    },
    { name: 'bit_not', opcode: 'g2s_bitNot', type: 'value', args: [textArg('VALUE', '0x01')] },
].map((row) => ({ receiver: AKADAKO, changesReceiver: true, ...row }));

const G2SConverter = {
    sends: G2S_SENDS,

    register: function (converter) {
        // Register receiver: akadako
        converter.registerOnSend('self', AKADAKO, 0, (params) => {
            const { node } = params;
            return converter.createRubyExpressionBlock(AKADAKO, node);
        });

        registerSendTable(converter, G2S_SENDS);
    },
};

export default G2SConverter;
