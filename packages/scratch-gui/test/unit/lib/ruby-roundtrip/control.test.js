/**
 * Unit test replacing test/integration/ruby-tab/control.test.js (basic control)
 */
import dedent from 'dedent';
import {
    makeSpriteTarget,
    makeConverter,
    setupRubyGenerator,
    expectRoundTrip
} from '../../helpers/ruby-roundtrip-helper';

describe('Ruby Roundtrip: Control category blocks', () => {
    let target, runtime, converter;

    beforeEach(() => {
        ({target, runtime} = makeSpriteTarget());
        setupRubyGenerator();
        converter = makeConverter(target, runtime);
    });

    test('Ruby -> Code -> Ruby', async () => {
        await expectRoundTrip(converter, target, dedent`
            sleep(1)
            sleep(x)
            sleep(touching?("_edge_"))
            10.times do
              move(10)
            end
            x.times do
              move(10)
            end
            (touching?("_edge_")).times do
              move(10)
            end
            loop do
              move(10)
            end

            if false
            end
            if touching?("_edge_")
              turn_right(180)
            end
            if false
            else
            end
            if touching?("_edge_")
              turn_right(180)
            else
              move(10)
            end
            if touching?("_edge_")
            else
              move(10)
            end
            if touching?("_edge_")
              turn_right(180)
            else
            end
            wait until false
            wait until touching?("_edge_")
            until false
              move(10)
            end
            until touching?("_edge_")
              move(10)
            end
            stop("all")

            stop("this script")

            stop("other scripts in sprite")

            when_start_as_a_clone do
            end

            create_clone("_myself_")
            create_clone("Abby")
            delete_this_clone
        `);
    });

    test('Ruby -> Code -> Ruby (backward compatibility)', async () => {
        const oldRuby = dedent`
            self.when(:start_as_a_clone) do
            end
        `;
        const newRuby = dedent`
            when_start_as_a_clone do
            end
        `;
        await expectRoundTrip(converter, target, oldRuby, newRuby);
    });

    test('Ruby -> Code -> Ruby (alias)', async () => {
        const beforeRuby = dedent`
            repeat(10) { move(10); wait }
            repeat(x) { move(10) }
            repeat(touching?("_edge_")) { move(10) }
            forever { move(10); wait }
        `;
        const afterRuby = dedent`
            10.times do
              move(10)
            end
            x.times do
              move(10)
            end
            (touching?("_edge_")).times do
              move(10)
            end
            loop do
              move(10)
            end
        `;
        await expectRoundTrip(converter, target, beforeRuby, afterRuby);
    });

    test('Ruby -> Code -> Ruby (etc)', async () => {
        const beforeRuby = dedent`
            if (touching?("_edge_"))
              turn_right(180)
            end
            unless touching?("_edge_")
              turn_right(180)
            else
              move(10)
            end
            unless touching?("_edge_")
            else
              move(10)
            end
            unless touching?("_edge_")
              turn_right(180)
            else
            end
            unless touching?("_edge_")
            else
            end
            wait until (touching?("_edge_"))
        `;
        const afterRuby = dedent`
            if touching?("_edge_")
              turn_right(180)
            end
            unless touching?("_edge_")
              turn_right(180)
            else
              move(10)
            end
            unless touching?("_edge_")
            else
              move(10)
            end
            unless touching?("_edge_")
              turn_right(180)
            else
            end
            unless touching?("_edge_")
            else
            end
            wait until touching?("_edge_")
        `;
        await expectRoundTrip(converter, target, beforeRuby, afterRuby);
    });
});
