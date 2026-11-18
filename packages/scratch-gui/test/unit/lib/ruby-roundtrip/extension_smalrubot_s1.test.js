/**
 * Unit test replacing test/integration/ruby-tab/extension_smalrubot_s1.test.js
 */
import dedent from 'dedent';
import {
    makeSpriteTarget,
    makeConverter,
    setupRubyGenerator,
    expectRoundTrip,
} from '../../helpers/ruby-roundtrip-helper';

// One line per block (and per choice of a menu). The blocks write `studuino.` (#2190).
const STUDUINO_RUBY = dedent`
        studuino.action("forward")
        studuino.action("backward")
        studuino.action("left")
        studuino.action("right")
        studuino.action("stop")
        studuino.action("forward", 0.5)
        studuino.bend_arm(90, 1)

        studuino.sensor_value("left")

        studuino.sensor_value("right")

        studuino.sensor_value("touch")

        studuino.sensor_value("light")

        studuino.sensor_value("sound")

        studuino.sensor_value("ir_a4")

        studuino.sensor_value("ir_a5")

        studuino.led("left", true)
        studuino.led("right", true)
        studuino.led("left", false)

        studuino.get_motor_speed("left")

        studuino.get_motor_speed("right")

        studuino.set_motor_speed("left", 50)
        studuino.arm_calibration = 0
`;

describe('Ruby Roundtrip: Studuino (Smalrubot S1) extension blocks', () => {
    let target, runtime, converter;

    beforeEach(() => {
        ({ target, runtime } = makeSpriteTarget());
        setupRubyGenerator();
        converter = makeConverter(target, runtime);
    });

    test('Ruby -> Code -> Ruby writes studuino.', async () => {
        await expectRoundTrip(converter, target, STUDUINO_RUBY);
    });

    test('older Ruby with smalrubot_s1. opens and is written back with studuino.', async () => {
        const older = STUDUINO_RUBY.replace(/studuino\./g, 'smalrubot_s1.');
        expect(older).not.toContain('studuino.');
        await expectRoundTrip(converter, target, older, STUDUINO_RUBY);
    });
});
