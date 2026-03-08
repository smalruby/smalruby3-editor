/**
 * Unit tests replacing integration tests from ruby-tab.test.js (tests 2-6)
 * and empty-conversion.test.js (all 3 tests).
 *
 * These round-trip conversion tests verify Ruby -> Blocks -> Ruby
 * without requiring a browser/Selenium.
 */
import dedent from 'dedent';
import {
    makeSpriteTarget,
    makeConverter,
    setupRubyGenerator,
    expectRoundTrip
} from '../../helpers/ruby-roundtrip-helper';

describe('Ruby Roundtrip: while/until/if with variables and empty?', () => {
    let target, runtime, converter;

    beforeEach(() => {
        ({target, runtime} = makeSpriteTarget());
        setupRubyGenerator();
        converter = makeConverter(target, runtime);
    });

    // From ruby-tab.test.js test 2
    test('while round-trip preserves while syntax', async () => {
        await expectRoundTrip(converter, target, dedent`
            while touching?("_edge_")
              move(10)
            end
        `);
    });

    // From ruby-tab.test.js test 3
    test('variable as while condition round-trip', async () => {
        await expectRoundTrip(converter, target, dedent`
            @game_on = true
            while @game_on
              move(10)
              @game_on = false
            end
        `);
    });

    // From ruby-tab.test.js test 4
    test('variable as until condition round-trip', async () => {
        await expectRoundTrip(converter, target, dedent`
            @done = false
            until @done
              move(10)
              @done = true
            end
        `);
    });

    // From ruby-tab.test.js test 5
    test('variable as if condition round-trip', async () => {
        await expectRoundTrip(converter, target, dedent`
            @flag = true
            if @flag
              move(10)
            end
        `);
    });

    // From ruby-tab.test.js test 6
    test('variable as unless condition round-trip', async () => {
        await expectRoundTrip(converter, target, dedent`
            @flag = false
            unless @flag
              move(10)
            end
        `);
    });

    // From empty-conversion.test.js test 1
    test('empty? round-trip conversion', async () => {
        await expectRoundTrip(converter, target, dedent`
            @text = ""
            if @text.empty?
              say("empty")
            else
              say("not empty")
            end
        `);
    });

    // From empty-conversion.test.js test 2
    test('multiple empty? round-trip conversion', async () => {
        await expectRoundTrip(converter, target, dedent`
            @text1 = ""
            @text2 = "a"
            if @text1.empty? || @text2.empty?
              say("at least one is empty")
            end
        `);
    });

    // From empty-conversion.test.js test 3
    test('list empty? round-trip conversion', async () => {
        await expectRoundTrip(converter, target, dedent`
            list("@list").clear
            if list("@list").empty?
              say("empty")
            else
              say("not empty")
            end
        `);
    });
});
