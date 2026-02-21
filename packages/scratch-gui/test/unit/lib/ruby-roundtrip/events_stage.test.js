/**
 * Unit test replacing test/integration/ruby-tab/events.test.js (stage)
 */
import dedent from 'dedent';
import {
    makeStageTarget,
    makeConverter,
    setupRubyGenerator,
    expectRoundTrip
} from '../../helpers/ruby-roundtrip-helper';

describe('Ruby Roundtrip: Events category blocks (stage)', () => {
    let target, runtime, converter;

    beforeEach(() => {
        ({target, runtime} = makeStageTarget());
        setupRubyGenerator();
        converter = makeConverter(target, runtime);
    });

    test('Ruby -> Code -> Ruby', async () => {
        await expectRoundTrip(converter, target, dedent`
            when_flag_clicked do
              switch_backdrop("backdrop1")
            end

            when_key_pressed("space") do
              switch_backdrop("backdrop1")
            end

            when_clicked do
              switch_backdrop("backdrop1")
            end

            when_backdrop_switches("backdrop1") do
              switch_backdrop("backdrop1")
            end

            when_greater_than("loudness", 10) do
              switch_backdrop("backdrop1")
            end

            when_receive("message1") do
              switch_backdrop("backdrop1")
            end

            broadcast("message1")
            broadcast_and_wait("message1")
        `);
    });

    test('Ruby -> Code -> Ruby (backward compatibility)', async () => {
        const oldRuby = dedent`
            self.when(:flag_clicked) do
              switch_backdrop("backdrop1")
            end

            self.when(:key_pressed, "space") do
              switch_backdrop("backdrop1")
            end

            self.when(:clicked) do
              switch_backdrop("backdrop1")
            end

            self.when(:backdrop_switches, "backdrop1") do
              switch_backdrop("backdrop1")
            end

            self.when(:greater_than, "loudness", 10) do
              switch_backdrop("backdrop1")
            end

            self.when(:receive, "message1") do
              switch_backdrop("backdrop1")
            end

            broadcast("message1")
            broadcast_and_wait("message1")
        `;

        const newRuby = dedent`
            when_flag_clicked do
              switch_backdrop("backdrop1")
            end

            when_key_pressed("space") do
              switch_backdrop("backdrop1")
            end

            when_clicked do
              switch_backdrop("backdrop1")
            end

            when_backdrop_switches("backdrop1") do
              switch_backdrop("backdrop1")
            end

            when_greater_than("loudness", 10) do
              switch_backdrop("backdrop1")
            end

            when_receive("message1") do
              switch_backdrop("backdrop1")
            end

            broadcast("message1")
            broadcast_and_wait("message1")
        `;

        await expectRoundTrip(converter, target, oldRuby, newRuby);
    });
});
