/**
 * Unit test replacing test/integration/ruby-tab/my_blocks.test.js
 */
import dedent from 'dedent';
import {
    makeSpriteTarget,
    makeConverter,
    setupRubyGenerator,
    expectRoundTrip,
    rubyToBlocksToRuby
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

            self.when(:flag_clicked) do
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

            self.when(:flag_clicked) do
              add(1, 5)
              say(@_return_add)
            end
        `);
    });

    test('Double conversion should not lose method body: minimal', async () => {
        const code = dedent`
            def self.add
              move(10)
            end
        `;
        // First conversion: Ruby -> Blocks -> Ruby
        const firstResult = await rubyToBlocksToRuby(converter, target, code);
        expect(firstResult).toContain('def self.add');
        expect(firstResult).toContain('move(10)');
        expect(firstResult).not.toMatch(/def self\.add\s*end/);

        // Second conversion: Ruby -> Blocks -> Ruby again (THIS IS WHERE THE BUG OCCURS)
        const secondResult = await rubyToBlocksToRuby(converter, target, firstResult);
        expect(secondResult).toContain('def self.add');
        expect(secondResult).toContain('move(10)');
        expect(secondResult).not.toMatch(/def self\.add\s*end/);
    });

    test('Double conversion should not lose method body: return value', async () => {
        const code = dedent`
            def self.add(a, b)
              a + b
            end
        `;
        // First conversion: Ruby -> Blocks -> Ruby
        const firstResult = await rubyToBlocksToRuby(converter, target, code);
        expect(firstResult).toContain('def self.add');
        expect(firstResult).toContain('a + b');
        expect(firstResult).not.toMatch(/def self\.add\([^)]*\)\s*end/);

        // Second conversion: Ruby -> Blocks -> Ruby again (THIS IS WHERE THE BUG OCCURS)
        const secondResult = await rubyToBlocksToRuby(converter, target, firstResult);
        expect(secondResult).toContain('def self.add');
        expect(secondResult).toContain('a + b');
        expect(secondResult).not.toMatch(/def self\.add\([^)]*\)\s*end/);
    });
});
