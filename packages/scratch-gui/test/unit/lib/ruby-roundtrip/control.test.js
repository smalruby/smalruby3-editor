/**
 * Unit test replacing test/integration/ruby-tab/control.test.js (basic control)
 *
 * Waits, loops and if/else are in control-table.test.js (both directions per row).
 */
import dedent from 'dedent';
import {
    makeSpriteTarget,
    makeConverter,
    setupRubyGenerator,
    expectRoundTrip,
} from '../../helpers/ruby-roundtrip-helper';

describe('Ruby Roundtrip: Control category blocks', () => {
    let target, runtime, converter;

    beforeEach(() => {
        ({ target, runtime } = makeSpriteTarget());
        setupRubyGenerator();
        converter = makeConverter(target, runtime);
    });

    test('Ruby -> Code -> Ruby', async () => {
        await expectRoundTrip(
            converter,
            target,
            dedent`
            stop("all")

            stop("this script")

            stop("other scripts in sprite")

            self.when(:start_as_a_clone) do
            end

            create_clone("_myself_")
            create_clone("Abby")
            delete_this_clone
        `,
        );
    });

    test('Ruby -> Code -> Ruby (v2)', async () => {
        const converter2 = makeConverter(target, runtime, { version: 2 });
        await expectRoundTrip(
            converter2,
            target,
            dedent`
            when_start_as_a_clone do
            end
        `,
            null,
            { version: 2 },
        );
    });

    test('Ruby -> Code -> Ruby (backward compatibility)', async () => {
        // In v1, self.when(:start_as_a_clone) round-trips to itself
        await expectRoundTrip(
            converter,
            target,
            dedent`
            self.when(:start_as_a_clone) do
            end
        `,
        );
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
              wait
            end
            x.times do
              move(10)
            end
            touching?("_edge_").times do
              move(10)
            end
            loop do
              move(10)
              wait
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
