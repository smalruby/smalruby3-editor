/**
 * Whether a method has a `return` comes from the analysis before converting (`procedures.definitions`,
 * issue #2091), not from the blocks converted so far. A method with a `return` (with or without a value)
 * returns a value and starts by resetting `_return_<name>_`; a method without one does neither.
 *
 * The blocks converted so far were looked for `@ruby:return:<name>` as a part of the text, so a method
 * `foo` written after a method `foo_bar` with a `return` got the reset block and the variable
 * `_return_foo_` of a method that returns a value.
 */
import dedent from 'dedent';
import { readBlocks } from '../../helpers/block-notation';
import {
    makeConverter,
    makeSpriteTarget,
    rubyToBlocksToRuby,
    setupRubyGenerator,
} from '../../helpers/ruby-roundtrip-helper';

/**
 * The texts of the comments of the blocks that reset the return variable of a method.
 * @param {object} target - The target the converter wrote to.
 * @returns {Array<string>} The texts, sorted.
 */
const resetComments = (target) =>
    Object.values(target.comments)
        .map((c) => c.text)
        .filter((text) => /^@ruby:return:[^:,\s]+:initialize$/.test(text))
        .sort();

/**
 * The names of the variables of the sprite.
 * @param {object} target - The target.
 * @returns {Array<string>} The names, sorted.
 */
const variableNames = (target) =>
    Object.values(target.variables)
        .map((v) => v.name)
        .sort();

const convert = async (code) => {
    const { target, stage, runtime } = makeSpriteTarget();
    setupRubyGenerator();
    const converter = makeConverter(target, runtime, { version: '2' });
    const ruby = await rubyToBlocksToRuby(converter, target, code);
    expect(() => readBlocks(target, stage)).not.toThrow();
    return { ruby, target };
};

describe('Ruby Roundtrip: a return of a method, from the analysis', () => {
    test('a method whose name starts with the name of a method with a return does not return a value', async () => {
        const code = dedent`
            def foo_bar
              return 1
            end

            def foo
              move(1)
            end

            say(foo_bar)
            foo
        `;
        const { ruby, target } = await convert(code);
        expect(ruby).toBe(code);
        expect(resetComments(target)).toEqual(['@ruby:return:foo_bar:initialize']);
        expect(variableNames(target)).toEqual(['_return_foo_bar_']);
    });

    test('a bare return makes the method one that returns a value', async () => {
        const code = dedent`
            def foo
              move(1)
              return
            end

            foo
        `;
        const { ruby, target } = await convert(code);
        expect(ruby).toBe(code);
        expect(resetComments(target)).toEqual(['@ruby:return:foo:initialize']);
    });

    test('a return in a block of the method counts', async () => {
        const code = dedent`
            def foo(n)
              3.times do
                return n if n > 1
              end
              2
            end

            say(foo(1))
        `;
        const { ruby, target } = await convert(code);
        expect(ruby).toBe(code);
        expect(resetComments(target)).toEqual(['@ruby:return:foo:initialize']);
    });

    test('a method without a return has no reset block', async () => {
        const code = dedent`
            def foo(n)
              n + 1
            end

            say(foo(1))
        `;
        const { ruby, target } = await convert(code);
        expect(ruby).toBe(code);
        expect(resetComments(target)).toEqual([]);
    });
});
