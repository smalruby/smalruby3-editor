// === Smalruby: This file is Smalruby-specific (rand(n) with an integer round trip) ===
/**
 * `rand(n)` with a positive integer literal picks an integer from 0 to n - 1, so it becomes the
 * "pick random (0) to (n - 1)" block with the `@ruby:rand:n` marker, and comes back to Ruby as
 * `rand(n)` (issue #2042). The Japanese mode writes `乱数(n)` for `rand(n)`, so `乱数(10)` also
 * becomes a block.
 */
import { dnclToRuby } from '../../../../src/lib/dncl/dncl-to-ruby';
import { rubyToDncl } from '../../../../src/lib/dncl/ruby-to-dncl';
import RubyGenerator from '../../../../src/lib/ruby-generator';
import {
    blockTrees,
    makeSpriteTarget,
    makeConverter,
    setupRubyGenerator,
    rubyToBlocksToRuby,
} from '../../helpers/ruby-roundtrip-helper';

const convert = async (code) => {
    const { target, runtime } = makeSpriteTarget();
    setupRubyGenerator();
    const converter = makeConverter(target, runtime, { version: '2' });
    const ruby = await rubyToBlocksToRuby(converter, target, code);
    return { ruby, trees: blockTrees(target), target };
};

/**
 * The "pick random" block and the numbers in its inputs.
 * @param {object} target - The target the converter wrote to.
 * @returns {{block: object, from: string, to: string, comment: ?string}} The block and its values.
 */
const randomBlock = (target) => {
    const blocks = target.blocks._blocks;
    const block = Object.values(blocks).find((b) => b.opcode === 'operator_random');
    const value = (name) => String(blocks[block.inputs[name].block].fields.NUM.value);
    const comment = block.comment ? target.comments[block.comment].text : null;
    return { block, from: value('FROM'), to: value('TO'), comment };
};

/**
 * Put a number into an input of the "pick random" block, as a user would by typing in it.
 * @param {object} target - The target the converter wrote to.
 * @param {string} input - `FROM` or `TO`.
 * @param {string} value - The number to type.
 * @returns {string} The Ruby generated after the change.
 */
const editRandomInput = (target, input, value) => {
    const { block } = randomBlock(target);
    target.blocks._blocks[block.inputs[input].block].fields.NUM.value = value;
    RubyGenerator.currentTarget = target;
    return RubyGenerator.targetToCode(target, { version: '2' }).trim();
};

const canConvert = async (code) => {
    const { target, runtime } = makeSpriteTarget();
    const converter = makeConverter(target, runtime, { version: '2' });
    return !!(await converter.targetCodeToBlocks(target, code));
};

describe('Ruby Roundtrip: rand(n) with an integer (issue #2042)', () => {
    test.each([
        ['say', 'say(rand(10))'],
        ['assignment', '@a = rand(6)'],
        ['one', 'say(rand(1))'],
        ['in an expression', 'say(rand(6) + 1)'],
        ['next to a range', 'say(rand(10))\nsay(rand(1..10))'],
    ])('%s', async (_name, code) => {
        const first = await convert(code);
        expect(first.ruby).toBe(code);

        const second = await convert(first.ruby);
        expect(second.trees).toEqual(first.trees);
    });

    test('makes "pick random (0) to (n - 1)"', async () => {
        const { target } = await convert('say(rand(10))');
        const { from, to, comment } = randomBlock(target);
        expect(from).toBe('0');
        expect(to).toBe('9');
        expect(comment).toBe('@ruby:rand:n');
    });

    test('a range is the same block as before, without the marker', async () => {
        const { target } = await convert('say(rand(1..10))');
        const { from, to, comment } = randomBlock(target);
        expect(from).toBe('1');
        expect(to).toBe('10');
        expect(comment).toBeNull();
    });

    test('writes a range when the user changed "from"', async () => {
        const { target } = await convert('say(rand(10))');
        expect(editRandomInput(target, 'FROM', '1')).toBe('say(rand(1..9))');
    });

    test('keeps rand(n) when the user changed "to" to another integer', async () => {
        const { target } = await convert('say(rand(10))');
        expect(editRandomInput(target, 'TO', '5')).toBe('say(rand(6))');
    });

    test('writes a range when "to" is not an integer any more', async () => {
        const { target } = await convert('say(rand(10))');
        expect(editRandomInput(target, 'TO', '2.5')).toBe('say(rand(0..2.5))');
    });

    test.each([
        // Kernel#rand gives a float for rand(0); rand(1.5) is 0 (max.to_i.abs) and "3" is an error.
        // Only an integer literal of 1 or more becomes a block, so these stay as they were.
        ['zero', 'say(rand(0))'],
        ['float', 'say(rand(1.5))'],
        ['string', 'say(rand("3"))'],
    ])('does not make a block from %s', async (_name, code) => {
        expect(await canConvert(code)).toBe(false);
    });
});

describe('Japanese mode: 乱数(n) (issue #2042)', () => {
    test.each([['表示する(乱数(10))'], ['a = 乱数(6) + 1']])('%s becomes blocks and comes back', async (dncl) => {
        const ruby = dnclToRuby(dncl).ruby;
        const { ruby: back } = await convert(ruby);
        expect(back).toBe(ruby);
        expect(rubyToDncl(back).dncl).toBe(dncl);
    });
});
