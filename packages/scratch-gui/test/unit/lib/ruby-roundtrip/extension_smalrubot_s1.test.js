/**
 * Unit test replacing test/integration/ruby-tab/extension_smalrubot_s1.test.js
 */
import dedent from 'dedent';
import {
    makeSpriteTarget,
    makeConverter,
    setupRubyGenerator,
    expectRoundTrip
} from '../../helpers/ruby-roundtrip-helper';

describe('Ruby Roundtrip: Smalrubot S1 extension blocks', () => {
    let target, runtime, converter;

    beforeEach(() => {
        ({target, runtime} = makeSpriteTarget());
        setupRubyGenerator();
        converter = makeConverter(target, runtime);
    });

    test('Ruby -> Code -> Ruby', async () => {
        await expectRoundTrip(converter, target, dedent`
            smalrubot_s1.action("forward")
            smalrubot_s1.action("backward")
            smalrubot_s1.action("left")
            smalrubot_s1.action("right")
            smalrubot_s1.action("stop")
            smalrubot_s1.action("forward", 0.5)
            smalrubot_s1.bend_arm(90, 1)

            smalrubot_s1.sensor_value("left")

            smalrubot_s1.sensor_value("right")

            smalrubot_s1.sensor_value("touch")

            smalrubot_s1.sensor_value("light")

            smalrubot_s1.sensor_value("sound")

            smalrubot_s1.led("left", true)
            smalrubot_s1.led("right", true)
            smalrubot_s1.led("left", false)

            smalrubot_s1.get_motor_speed("left")

            smalrubot_s1.get_motor_speed("right")

            smalrubot_s1.set_motor_speed("left", 50)
            smalrubot_s1.arm_calibration = 0
        `);
    });
});
