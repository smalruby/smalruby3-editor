/**
 * Unit test replacing test/integration/ruby-tab/extension_wedo2.test.js
 */
import dedent from 'dedent';
import {
    makeSpriteTarget,
    makeConverter,
    setupRubyGenerator,
    expectRoundTrip
} from '../../helpers/ruby-roundtrip-helper';

describe('Ruby Roundtrip: LEGO Education WeDo 2.0 extension blocks', () => {
    let target, runtime, converter;

    beforeEach(() => {
        ({target, runtime} = makeSpriteTarget());
        setupRubyGenerator();
        converter = makeConverter(target, runtime);
    });

    test('Ruby -> Code -> Ruby', async () => {
        await expectRoundTrip(converter, target, dedent`
            wedo2.turn_on_for("motor", 1)
            wedo2.turn_on_for("motor A", 1)
            wedo2.turn_on_for("motor B", 1)
            wedo2.turn_on_for("all motors", 1)
            wedo2.turn_on("motor")
            wedo2.turn_off("motor")
            wedo2.set_power("motor", 100)
            wedo2.set_direction("motor", "this way")
            wedo2.set_direction("motor", "that way")
            wedo2.set_direction("motor", "reverse")
            wedo2.light_color = 50

            wedo2.when_distance("<", 50) do
            end

            wedo2.when_distance(">", 50) do
            end

            wedo2.when_tilted("any") do
            end

            wedo2.when_tilted("up") do
            end

            wedo2.when_tilted("down") do
            end

            wedo2.when_tilted("left") do
            end

            wedo2.when_tilted("right") do
            end

            wedo2.distance

            wedo2.tilted?("any")

            wedo2.tilt_angle("up")
        `);
    });

    test('Ruby -> Code -> Ruby (case normalization)', async () => {
        const beforeRuby = dedent`
            wedo2.turn_on_for("MOTOR", 1)
            wedo2.turn_on_for("motor a", 1)
            wedo2.turn_on("motor a")
            wedo2.turn_off("motor a")
            wedo2.set_power("motor a", 100)
            wedo2.set_direction("motor a", "THIS WAY")

            wedo2.when_tilted("ANY") do
            end

            wedo2.tilted?("ANY")

            wedo2.tilt_angle("UP")
        `;
        const afterRuby = dedent`
            wedo2.turn_on_for("motor", 1)
            wedo2.turn_on_for("motor A", 1)
            wedo2.turn_on("motor A")
            wedo2.turn_off("motor A")
            wedo2.set_power("motor A", 100)
            wedo2.set_direction("motor A", "this way")

            wedo2.when_tilted("any") do
            end

            wedo2.tilted?("any")

            wedo2.tilt_angle("up")
        `;
        await expectRoundTrip(converter, target, beforeRuby, afterRuby);
    });
});
