// An element of an array literal (`@b = [(@a = 1)]`) or a value of a hash literal (`@h = {a: (@a = 1)}`)
// that is not a value used to be put in the list without an error: the list got `0`, and the blocks of
// the element were left behind, reached from no script. It is now the error of a wrong instruction on the
// line, as `say(@a = 1)` is (issue #1865).
import RubyToBlocksConverter from '../../../../src/lib/ruby-to-blocks-converter';
import { readBlocks } from '../../helpers/block-notation';
import {
    makeConverter,
    makeSpriteTarget,
    rubyToBlocksToRuby,
    setupRubyGenerator,
} from '../../helpers/ruby-roundtrip-helper';

const FOO = 'def foo(n)\n  return n + 1\nend\n';
const FOO_ROWS = 3;

const convert = async (code) => {
    const converter = new RubyToBlocksConverter(null, { version: '2' });
    const ok = await converter.targetCodeToBlocks(null, code);
    return { ok, errors: converter.errors };
};

const wrongInstruction = (source) => `"${source}" is the wrong instruction.`;

describe('RubyToBlocksConverter/an element of a literal that is not a value', () => {
    test.each([
        ['@b = [(@a = 1)]'],
        ['$b = [1, (@a = 1)]'],
        ['b = [(c = 1)]'],
        ['@b = [(@a += 1)]'],
        ['@b = [:a]'],
        ['@b = [nil]'],
        ['@b = [[1]]'],
        ['@b = [{a: 1}]'],
        ['@b = [self]'],
        ['@h = {a: (@a = 1)}'],
        ['@h = {a: 1, b: (c = 1)}'],
        // A line of an array alone (P18) put such an item in the list as its text.
        ['[(@a = 1)]'],
        ['[:a]'],
        ['[nil]'],
    ])('%s is the wrong instruction', async (code) => {
        const { ok, errors } = await convert(code);
        expect(ok).toBe(false);
        expect(errors).toHaveLength(1);
        expect([errors[0].row, errors[0].column]).toEqual([0, 0]);
        expect(errors[0].text).toContain(wrongInstruction(code));
    });

    // A call of a method that returns a value needs the call before the list; that is not made, so it is
    // the error too, not a list of `0` with the call left behind.
    test.each([['@b = [foo(1)]'], ['@h = {a: foo(1)}']])('%s is the wrong instruction', async (code) => {
        const { ok, errors } = await convert(FOO + code);
        expect(ok).toBe(false);
        expect(errors).toHaveLength(1);
        expect(errors[0].row).toBe(FOO_ROWS);
        expect(errors[0].text).toContain(wrongInstruction(code));
    });

    // A key that is not a symbol or a string is told first, even when a value is not a value either.
    test('@h = {1 => (@a = 1)} is the error of the key', async () => {
        const { ok, errors } = await convert('@h = {1 => (@a = 1)}');
        expect(ok).toBe(false);
        expect(errors).toHaveLength(1);
        expect(errors[0].text).toContain('"1" cannot be a key of a hash.');
    });

    // The values a list can hold are kept, and no block is left behind.
    test.each([
        ['@b = [1, "x", 2.5, -1]'],
        ['@b = [@x, 1 + 2, "a" + "b", @x.to_s]'],
        ['@b = [true, false, 1 < 2]'],
        ['@h = {a: 1.5, b: "s", c: @x, d: false, e: :f}'],
        ['[1, "x", -2.5]'],
        ['[@x, 1 + 2]'],
        ['[true]'],
        ['[false]'],
    ])('%s comes back the same', async (code) => {
        const { target, stage, runtime } = makeSpriteTarget();
        setupRubyGenerator();
        const converter = makeConverter(target, runtime, { version: '2' });
        expect(await rubyToBlocksToRuby(converter, target, code)).toBe(code);
        expect(() => readBlocks(target, stage)).not.toThrow();
    });
});
