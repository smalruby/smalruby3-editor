/**
 * AkaDako (g2s) blocks ⇔ Ruby, as a table (block notation: test/unit/helpers/block-notation.js).
 * It fixes the output of the converter before the calls of `akadako` move into a send table
 * (issue #2090); ruby-to-blocks-converter/g2s.test.js has one test for each call.
 *
 * The menus take only a string (as it is), except the color of `neopixel_set_color` (kept as it
 * was). The number arguments take a number or a value block (a string is an error: g2s.test.js).
 */
import { defineBlockRubyTable } from '../../helpers/block-ruby-table';

const menu = (name, value) => `g2s_menu_${name}(${name} = "${value}")`;

// The reporters without an argument: [Ruby name, opcode].
const reporters = [
    ['connected?', 'g2s_isConnected'],
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
].map(([name, opcode]) => ({ blocks: `looks_say(MESSAGE: ${opcode})`, ruby: `say(akadako.${name})` }));

const say = (block) => `looks_say(MESSAGE: ${block})`;

const rows = [
    { blocks: 'g2s_connectBoard', ruby: 'akadako.connect_board' },
    { blocks: 'g2s_disconnectBoard', ruby: 'akadako.disconnect_board' },
    {
        blocks: `
            g2s_boardStateChanged(STATE: ${menu('boardStateMenu', 'disconnected')})
            motion_movesteps(STEPS: 10)
        `,
        ruby: `
            akadako.when_board_state_changed("disconnected") do
              move(10)
            end
        `,
    },
    ...reporters,
    {
        blocks: `g2s_digitalLevelSet(CONNECTOR: ${menu('digitalLevelSetConnectorMenu', '6')}, LEVEL: ${menu('digitalLevelMenu', 'false')})`,
        ruby: 'akadako.set_digital_level("6", "false")',
    },
    {
        blocks: say(`g2s_digitalIsHigh(CONNECTOR: ${menu('digitalConnectorMenu', '10')})`),
        ruby: 'say(akadako.digital_high?("10"))',
    },
    {
        blocks: `g2s_digitalLevelChanged(CONNECTOR: ${menu('digitalConnectorMenu', '11')}, LEVEL: ${menu('digitalLevelMenu', 'true')})`,
        ruby: 'akadako.when_digital_level_changed("11", "true") do\nend',
    },
    {
        blocks: `g2s_inputBiasSet(PIN: ${menu('inputPinsMenu', '10')}, BIAS: ${menu('inputBiasMenu', 'pullUp')})`,
        ruby: 'akadako.set_input_bias("10", "pullUp")',
    },
    {
        blocks: `g2s_analogLevelSet(CONNECTOR: ${menu('pwmConnectorMenu', '10')}, LEVEL: 50)`,
        ruby: 'akadako.set_pwm_duty("10", 50)',
    },
    {
        blocks: `g2s_analogLevelSet(CONNECTOR: ${menu('pwmConnectorMenu', '10')}, LEVEL: $l)`,
        ruby: 'akadako.set_pwm_duty("10", $l)',
    },
    {
        blocks: `g2s_servoTurn(CONNECTOR: ${menu('servoConnectorMenu', '11')}, ANGLE: 90, SPEED: 100)`,
        ruby: 'akadako.servo_turn("11", 90, 100)',
    },
    {
        blocks: `g2s_sendIrRemote(CONNECTOR: ${menu('irRemoteMenuConnector', '10')}, N: ${menu('irRemoteMenuN', '2')})`,
        ruby: 'akadako.send_ir_remote("10", "2")',
    },
    { blocks: 'g2s_whenShaken\nmotion_movesteps(STEPS: 10)', ruby: 'akadako.when_shaken do\n  move(10)\nend' },
    {
        blocks: `g2s_neoPixelConfigStrip(CONNECTOR: ${menu('neoPixelConnectorMenu', '10')}, LENGTH: 3)`,
        ruby: 'akadako.neopixel_config("10", 3)',
    },
    {
        blocks: `g2s_neoPixelSetColor(CONNECTOR: ${menu('neoPixelConnectorMenu', '10')}, POSITION: 1, COLOR: ${menu('neoPixelColorMenuSimple', '0, 0xff, 0')}, BRIGHTNESS: 50)`,
        ruby: 'akadako.neopixel_set_color("10", 1, "0, 0xff, 0", 50)',
    },
    {
        blocks: `g2s_neoPixelSetColor(CONNECTOR: ${menu('neoPixelConnectorMenu', '10')}, POSITION: $p, COLOR: $c, BRIGHTNESS: $b)`,
        ruby: 'akadako.neopixel_set_color("10", $p, $c, $b)',
    },
    {
        blocks: `g2s_neoPixelFillColor(CONNECTOR: ${menu('neoPixelConnectorMenu', '10')}, COLOR: ${menu('neoPixelColorMenu', '0xff, 0, 0')}, BRIGHTNESS: 50)`,
        ruby: 'akadako.neopixel_fill_color("10", "0xff, 0, 0", 50)',
    },
    {
        blocks: `g2s_neoPixelShiftColor(CONNECTOR: ${menu('neoPixelConnectorMenu', '10')}, N: 1, LOOP_MODE: ${menu('neoPixelShiftColorLoopModeMenu', 'false')})`,
        ruby: 'akadako.neopixel_shift_color("10", 1, "false")',
    },
    {
        blocks: say('g2s_neoPixelColor(RED: "255", GREEN: $g, BLUE: "0")'),
        ruby: 'say(akadako.neopixel_color("255", $g, "0"))',
    },
    {
        blocks: say(`g2s_neoPixelColorMode(MODE: ${menu('neoPixelColorModeMenu', 'rainbow')})`),
        ruby: 'say(akadako.neopixel_color_mode("rainbow"))',
    },
    { blocks: 'g2s_neoPixelShow', ruby: 'akadako.neopixel_show' },
    {
        blocks: `g2s_neoPixelClear(CONNECTOR: ${menu('neoPixelConnectorMenu', '10')})`,
        ruby: 'akadako.neopixel_clear("10")',
    },
    {
        blocks: 'g2s_i2cWrite(ADDRESS: "0x10", REGISTER: $r, DATA: "0x00, 0x01")',
        ruby: 'akadako.i2c_write("0x10", $r, "0x00, 0x01")',
    },
    {
        blocks: say('g2s_i2cReadOnce(ADDRESS: "0x10", REGISTER: "0x00", LENGTH: 2)'),
        ruby: 'say(akadako.i2c_read("0x10", "0x00", 2))',
    },
    {
        blocks: say('g2s_numberAtIndex(ARRAY: "1, 2, 3", INDEX: 2)'),
        ruby: 'say(akadako.number_at("1, 2, 3", 2))',
    },
    {
        blocks: say('g2s_spliceNumbers(ARRAY: "1, 2, 3", INDEX: 1, DELETE: 1, INSERT: "-1, 0")'),
        ruby: 'say(akadako.splice_numbers("1, 2, 3", 1, 1, "-1, 0"))',
    },
    { blocks: say('g2s_lengthOfNumbers(ARRAY: $a)'), ruby: 'say(akadako.numbers_length($a))' },
    {
        blocks: say(
            `g2s_readBytesAs(ARRAY: "0x00, 0xFF", TYPE: ${menu('bytesTypeMenu', 'Uint16')}, ENDIAN: ${menu('endianMenu', 'big')})`,
        ),
        ruby: 'say(akadako.read_bytes_as("0x00, 0xFF", "Uint16", "big"))',
    },
    {
        blocks: say(`g2s_int64Operation(LEFT: "0x01", OP: ${menu('int64OperationMenu', '-')}, RIGHT: $r)`),
        ruby: 'say(akadako.int64_op("0x01", "-", $r))',
    },
    {
        blocks: say(`g2s_bitOperation(LEFT: "0x03", OP: ${menu('bitOperationMenu', '|')}, RIGHT: "0x01")`),
        ruby: 'say(akadako.bit_op("0x03", "|", "0x01"))',
    },
    { blocks: say('g2s_bitNot(VALUE: "0x01")'), ruby: 'say(akadako.bit_not("0x01"))' },
];

defineBlockRubyTable('AkaDako (g2s) blocks ⇔ Ruby', rows, { versions: ['1', '2'] });

defineBlockRubyTable(
    'AkaDako (g2s) blocks ⇔ Ruby (stage)',
    [{ blocks: 'g2s_neoPixelShow', ruby: 'akadako.neopixel_show' }],
    { stage: true },
);
