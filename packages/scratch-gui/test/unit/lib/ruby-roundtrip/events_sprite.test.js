/**
 * Unit test replacing test/integration/ruby-tab/events.test.js (sprite)
 */
import dedent from 'dedent';
import {
    makeSpriteTarget,
    makeConverter,
    setupRubyGenerator,
    expectRoundTrip
} from '../../helpers/ruby-roundtrip-helper';

describe('Ruby Roundtrip: Events category blocks (sprite)', () => {
    let target, runtime, converter;

    beforeEach(() => {
        ({target, runtime} = makeSpriteTarget());
        setupRubyGenerator();
        converter = makeConverter(target, runtime);
    });

    test('Ruby -> Code -> Ruby', async () => {
        await expectRoundTrip(converter, target, dedent`
            self.when(:flag_clicked) do
              bounce_if_on_edge
            end

            self.when(:key_pressed, "space") do
              bounce_if_on_edge
            end

            self.when(:key_pressed, "any") do
              bounce_if_on_edge
              move(10)
            end

            self.when(:key_pressed, "a") do
            end

            self.when(:clicked) do
              bounce_if_on_edge
            end

            self.when(:clicked) do
              bounce_if_on_edge
              move(10)
            end

            self.when(:backdrop_switches, "backdrop1") do
              bounce_if_on_edge
            end

            self.when(:backdrop_switches, "backdrop1") do
              bounce_if_on_edge
              move(10)
            end

            self.when(:greater_than, "loudness", 10) do
            end

            self.when(:greater_than, "loudness", 10) do
              bounce_if_on_edge
            end

            self.when(:greater_than, "timer", x) do
              bounce_if_on_edge
              move(10)
            end

            self.when(:receive, "message1") do
            end

            self.when(:receive, "message1") do
              bounce_if_on_edge
            end

            self.when(:receive, "message1") do
              bounce_if_on_edge
              move(10)
            end

            broadcast("message1")
            broadcast(x)
            broadcast_and_wait("message1")
            broadcast_and_wait(x)
        `);
    });

    test('Ruby -> Code -> Ruby (backward compatibility)', async () => {
        const oldRuby = dedent`
            when_flag_clicked do
              bounce_if_on_edge
            end

            when_key_pressed("space") do
              bounce_if_on_edge
            end

            when_key_pressed("any") do
              bounce_if_on_edge
              move(10)
            end

            when_key_pressed("a") do
            end

            when_clicked do
              bounce_if_on_edge
            end

            when_clicked do
              bounce_if_on_edge
              move(10)
            end

            when_backdrop_switches("backdrop1") do
              bounce_if_on_edge
            end

            when_backdrop_switches("backdrop1") do
              bounce_if_on_edge
              move(10)
            end

            when_greater_than("loudness", 10) do
            end

            when_greater_than("loudness", 10) do
              bounce_if_on_edge
            end

            when_greater_than("timer", x) do
              bounce_if_on_edge
              move(10)
            end

            when_receive("message1") do
            end

            when_receive("message1") do
              bounce_if_on_edge
            end

            when_receive("message1") do
              bounce_if_on_edge
              move(10)
            end

            broadcast("message1")
            broadcast(x)
            broadcast_and_wait("message1")
            broadcast_and_wait(x)
        `;

        const newRuby = dedent`
            self.when(:flag_clicked) do
              bounce_if_on_edge
            end

            self.when(:key_pressed, "space") do
              bounce_if_on_edge
            end

            self.when(:key_pressed, "any") do
              bounce_if_on_edge
              move(10)
            end

            self.when(:key_pressed, "a") do
            end

            self.when(:clicked) do
              bounce_if_on_edge
            end

            self.when(:clicked) do
              bounce_if_on_edge
              move(10)
            end

            self.when(:backdrop_switches, "backdrop1") do
              bounce_if_on_edge
            end

            self.when(:backdrop_switches, "backdrop1") do
              bounce_if_on_edge
              move(10)
            end

            self.when(:greater_than, "loudness", 10) do
            end

            self.when(:greater_than, "loudness", 10) do
              bounce_if_on_edge
            end

            self.when(:greater_than, "timer", x) do
              bounce_if_on_edge
              move(10)
            end

            self.when(:receive, "message1") do
            end

            self.when(:receive, "message1") do
              bounce_if_on_edge
            end

            self.when(:receive, "message1") do
              bounce_if_on_edge
              move(10)
            end

            broadcast("message1")
            broadcast(x)
            broadcast_and_wait("message1")
            broadcast_and_wait(x)
        `;

        await expectRoundTrip(converter, target, oldRuby, newRuby);
    });
});
