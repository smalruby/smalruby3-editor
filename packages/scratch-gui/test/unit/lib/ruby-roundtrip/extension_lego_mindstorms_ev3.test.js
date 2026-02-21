/**
 * Unit test replacing
 * test/integration/ruby-tab/extension_lego_mindstorms_ev3.test.js
 */
import dedent from 'dedent';
import {
    makeSpriteTarget,
    makeConverter,
    setupRubyGenerator,
    expectRoundTrip
} from '../../helpers/ruby-roundtrip-helper';

describe('Ruby Roundtrip: LEGO MINDSTORMS EV3 extension blocks', () => {
    let target, runtime, converter;

    beforeEach(() => {
        ({target, runtime} = makeSpriteTarget());
        setupRubyGenerator();
        converter = makeConverter(target, runtime);
    });

    const code = dedent`
        ev3.motor_turn_this_way_for("A", 1)
        ev3.motor_turn_this_way_for("B", 1)
        ev3.motor_turn_this_way_for("C", 1)
        ev3.motor_turn_this_way_for("D", 1)
        ev3.motor_turn_that_way_for("A", 1)
        ev3.motor_set_power("A", 100)

        ev3.motor_position("A")

        ev3.when_button_pressed("1") do
        end

        ev3.when_button_pressed("2") do
        end

        ev3.when_button_pressed("3") do
        end

        ev3.when_button_pressed("4") do
        end

        ev3.when_distance_lt(5) do
        end

        ev3.when_brightness_lt(50) do
        end

        ev3.button_pressed?("1")

        ev3.distance

        ev3.brightness

        ev3.beep_note(60, 0.5)
    `;

    test('Ruby -> Code -> Ruby', async () => {
        await expectRoundTrip(converter, target, code);
    });

    test('Ruby -> Code -> Ruby (backward compatibility)', async () => {
        const oldCode = dedent`
            ev3_motor_turn_this_way_for("A", 1)
            ev3_motor_turn_this_way_for("B", 1)
            ev3_motor_turn_this_way_for("C", 1)
            ev3_motor_turn_this_way_for("D", 1)
            ev3_motor_turn_that_way_for("A", 1)
            ev3_motor_set_power("A", 100)

            ev3_motor_position("A")

            self.when(:ev3_button_pressed, "1") do
            end

            self.when(:ev3_button_pressed, "2") do
            end

            self.when(:ev3_button_pressed, "3") do
            end

            self.when(:ev3_button_pressed, "4") do
            end

            self.when(:ev3_distance_gt, 5) do
            end

            self.when(:ev3_brightness_gt, 50) do
            end

            ev3_button_pressed?("1")

            ev3_distance

            ev3_brightness

            ev3_beep_note(60, 0.5)
        `;
        await expectRoundTrip(converter, target, oldCode, code);
    });
});
