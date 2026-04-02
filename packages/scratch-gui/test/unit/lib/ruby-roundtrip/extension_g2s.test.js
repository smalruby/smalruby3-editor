/**
 * Ruby round-trip unit test for AkaDako (g2s) extension.
 */
import dedent from 'dedent';
import {
    makeSpriteTarget,
    makeConverter,
    setupRubyGenerator,
    expectRoundTrip,
} from '../../helpers/ruby-roundtrip-helper';

describe('Ruby Roundtrip: AkaDako (g2s) extension blocks', () => {
    let target, runtime, converter;

    beforeEach(() => {
        ({ target, runtime } = makeSpriteTarget());
        setupRubyGenerator();
        converter = makeConverter(target, runtime);
    });

    test('board connection blocks', async () => {
        await expectRoundTrip(
            converter,
            target,
            dedent`
            akadako.connect_board
            akadako.disconnect_board

            akadako.connected?

            akadako.board_version
        `,
        );
    });

    test('board state HAT block', async () => {
        await expectRoundTrip(
            converter,
            target,
            dedent`
            akadako.when_board_state_changed("connected") do
              akadako.connect_board
            end
        `,
        );
    });

    test('analog level reporters', async () => {
        await expectRoundTrip(
            converter,
            target,
            dedent`
            akadako.analog_level_a1

            akadako.analog_level_a2

            akadako.analog_level_b1

            akadako.analog_level_b2
        `,
        );
    });

    test('digital level reporters', async () => {
        await expectRoundTrip(
            converter,
            target,
            dedent`
            akadako.digital_level_a1

            akadako.digital_level_a2

            akadako.digital_level_b1

            akadako.digital_level_b2
        `,
        );
    });

    test('digital I/O command and boolean blocks', async () => {
        await expectRoundTrip(
            converter,
            target,
            dedent`
            akadako.set_digital_level("10", "0")

            akadako.digital_high?("10")

            akadako.set_input_bias("10", "none")
        `,
        );
    });

    test('digital level changed HAT block', async () => {
        await expectRoundTrip(
            converter,
            target,
            dedent`
            akadako.when_digital_level_changed("10", "0") do
              akadako.connect_board
            end
        `,
        );
    });

    test('PWM block', async () => {
        await expectRoundTrip(
            converter,
            target,
            dedent`
            akadako.set_pwm_duty("10", 50)
        `,
        );
    });

    test('servo and IR remote blocks', async () => {
        await expectRoundTrip(
            converter,
            target,
            dedent`
            akadako.servo_turn("10", 90, 100)
            akadako.send_ir_remote("10", "1")
        `,
        );
    });

    test('distance and motion sensor blocks', async () => {
        await expectRoundTrip(
            converter,
            target,
            dedent`
            akadako.ultrasonic_distance_a

            akadako.ultrasonic_distance_b

            akadako.laser_distance

            akadako.motion_sensor_value
        `,
        );
    });

    test('accelerometer blocks', async () => {
        await expectRoundTrip(
            converter,
            target,
            dedent`
            akadako.pitch

            akadako.roll

            akadako.acceleration_x

            akadako.acceleration_y

            akadako.acceleration_z

            akadako.acceleration_absolute
        `,
        );
    });

    test('when_shaken HAT block', async () => {
        await expectRoundTrip(
            converter,
            target,
            dedent`
            akadako.when_shaken do
              akadako.connect_board
            end
        `,
        );
    });

    test('light, environment and water temperature sensors', async () => {
        await expectRoundTrip(
            converter,
            target,
            dedent`
            akadako.brightness

            akadako.analog_brightness

            akadako.temperature

            akadako.pressure

            akadako.humidity

            akadako.water_temperature_a

            akadako.water_temperature_b
        `,
        );
    });

    test('NeoPixel LED blocks', async () => {
        await expectRoundTrip(
            converter,
            target,
            dedent`
            akadako.neopixel_config("10", 3)
            akadako.neopixel_set_color("10", 1, "red", 100)
            akadako.neopixel_fill_color("10", "red", 100)
            akadako.neopixel_shift_color("10", 1, "true")
            akadako.neopixel_show
            akadako.neopixel_clear("10")

            akadako.neopixel_color("255", "0", "0")

            akadako.neopixel_color_mode("rainbow")
        `,
        );
    });

    test('I2C blocks', async () => {
        await expectRoundTrip(
            converter,
            target,
            dedent`
            akadako.i2c_write("0x00", "0x00", "0x00")

            akadako.i2c_read("0x00", "0x00", 1)
        `,
        );
    });

    test('array and data blocks', async () => {
        await expectRoundTrip(
            converter,
            target,
            dedent`
            akadako.number_at("1, 2, 3", 1)

            akadako.splice_numbers("1, 2, 3", 1, 1, "4")

            akadako.numbers_length("1, 2, 3")

            akadako.read_bytes_as("0x00, 0xFF", "Int16", "little")
        `,
        );
    });

    test('bitwise operation blocks', async () => {
        await expectRoundTrip(
            converter,
            target,
            dedent`
            akadako.int64_op("0x01", "＋", "0x02")

            akadako.bit_op("0x03", "&", "0x01")

            akadako.bit_not("0x01")
        `,
        );
    });
});
