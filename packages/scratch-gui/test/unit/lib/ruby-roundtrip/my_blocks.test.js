/**
 * Unit test replacing test/integration/ruby-tab/my_blocks.test.js
 * (roundtrip-compatible tests only; double-conversion UI tests are omitted)
 */
import dedent from 'dedent';
import {
    makeSpriteTarget,
    makeConverter,
    setupRubyGenerator,
    expectRoundTrip
} from '../../helpers/ruby-roundtrip-helper';

describe('Ruby Roundtrip: My Blocks (procedure) category', () => {
    let target, runtime, converter;

    beforeEach(() => {
        ({target, runtime} = makeSpriteTarget());
        setupRubyGenerator();
        converter = makeConverter(target, runtime);
    });

    test('Procedure arguments should be converted to snake_case lowercase', async () => {
        const input = dedent`
            def self.procedure(aRG1)
              move(aRG1)
            end

            procedure(10)
        `;
        const expected = dedent`
            def self.procedure(a_rg1)
              move(a_rg1)
            end

            procedure(10)
        `;
        await expectRoundTrip(converter, target, input, expected);
    });

    test('Ruby -> Code -> Ruby (basic block_name)', async () => {
        await expectRoundTrip(converter, target, dedent`
            def self.block_name
            end

            block_name
        `);
    });

    test('Method with return value should be convertible', async () => {
        await expectRoundTrip(converter, target, dedent`
            def self.add(a, b)
              a + b
            end

            when_flag_clicked do
              say(add(1, 5))
            end
        `);
    });

    test('Method call with return value at top-level should be convertible', async () => {
        await expectRoundTrip(converter, target, dedent`
            def self.add(a, b)
              a + b
            end

            say(add(1, 5))
        `);
    });

    test('Method with explicit return variable assignment should be convertible', async () => {
        await expectRoundTrip(converter, target, dedent`
            def self.add(a, b)
              @_return_add = a + b
            end

            when_flag_clicked do
              add(1, 5)
              say(@_return_add)
            end
        `);
    });
});
