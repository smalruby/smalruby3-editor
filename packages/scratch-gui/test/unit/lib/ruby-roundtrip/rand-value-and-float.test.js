// === Smalruby: This file is Smalruby-specific (rand(n) with a value and rand without args round trip) ===
/**
 * `rand(n)` with a value that is not a number literal (a variable or an expression) becomes
 * "pick random (0) to ((n) - (1))" with the `@ruby:rand:n` marker and comes back as `rand(n)`.
 * `rand` without arguments picks a float from 0 up to (not including) 1: it becomes
 * "pick random (0) to (1.0)" with the `@ruby:rand:float` marker, which the VM also answers with a
 * float from 0 up to 1 (the "1.0" has a decimal point), and comes back as `rand` (issue #2049).
 * The Japanese mode writes `乱数(n)` and `乱数()` for them.
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

const generate = (target) => {
    RubyGenerator.currentTarget = target;
    return RubyGenerator.targetToCode(target, { version: '2' }).trim();
};

/**
 * The "pick random" block, the blocks in its inputs and its marker.
 * @param {object} target - The target the converter wrote to.
 * @returns {{block: object, from: object, to: object, comment: ?string}} The block and its inputs.
 */
const randomBlock = (target) => {
    const blocks = target.blocks._blocks;
    const block = Object.values(blocks).find((b) => b.opcode === 'operator_random');
    const input = (name) => blocks[block.inputs[name].block];
    const comment = block.comment ? target.comments[block.comment].text : null;
    return { block, from: input('FROM'), to: input('TO'), comment };
};

describe('Ruby Roundtrip: rand(n) with a value (issue #2049)', () => {
    test.each([
        ['instance variable', 'say(rand(@n))'],
        ['length of a list', 'say(rand(@a.length))'],
        ['expression', '@b = rand(@n + 1)'],
        ['in an expression', 'say(rand(@n) + 1)'],
        ['as an index', 'say(@a[rand(@a.length)])'],
        ['next to the other forms', 'say(rand(@n))\nsay(rand(10))\nsay(rand(1..@n))'],
    ])('%s', async (_name, code) => {
        const first = await convert(code);
        expect(first.ruby).toBe(code);

        const second = await convert(first.ruby);
        expect(second.trees).toEqual(first.trees);
    });

    test('makes "pick random (0) to ((n) - (1))"', async () => {
        const { target } = await convert('say(rand(@n))');
        const { from, to, comment } = randomBlock(target);
        const blocks = target.blocks._blocks;
        expect(String(from.fields.NUM.value)).toBe('0');
        expect(to.opcode).toBe('operator_subtract');
        expect(blocks[to.inputs.NUM1.block].opcode).toBe('data_variable');
        expect(String(blocks[to.inputs.NUM2.block].fields.NUM.value)).toBe('1');
        expect(comment).toBe('@ruby:rand:n');
    });

    test('writes a range when the user changed the number subtracted', async () => {
        const { target } = await convert('say(rand(@n))');
        const { to } = randomBlock(target);
        target.blocks._blocks[to.inputs.NUM2.block].fields.NUM.value = '2';
        expect(generate(target)).toBe('say(rand(0..@n - 2))');
    });

    test('writes a range when the user changed "from"', async () => {
        const { target } = await convert('say(rand(@n))');
        const { from } = randomBlock(target);
        from.fields.NUM.value = '1';
        expect(generate(target)).toBe('say(rand(1..@n - 1))');
    });

    test('a range ending in n - 1 stays a range', async () => {
        const { ruby, target } = await convert('say(rand(0..@n - 1))');
        expect(ruby).toBe('say(rand(0..@n - 1))');
        expect(randomBlock(target).comment).toBeNull();
    });
});

describe('Ruby Roundtrip: rand without arguments (issue #2049)', () => {
    test.each([
        ['say', 'say(rand)'],
        ['assignment', '@a = rand'],
        ['in an expression', 'say((rand * 6).to_i + 1)'],
    ])('%s', async (_name, code) => {
        const first = await convert(code);
        expect(first.ruby).toBe(code);

        const second = await convert(first.ruby);
        expect(second.trees).toEqual(first.trees);
    });

    test('rand() is written as rand', async () => {
        const { ruby } = await convert('say(rand())');
        expect(ruby).toBe('say(rand)');
    });

    test('makes "pick random (0) to (1.0)"', async () => {
        const { target } = await convert('say(rand)');
        const { from, to, comment } = randomBlock(target);
        expect(String(from.fields.NUM.value)).toBe('0');
        // The decimal point makes the VM pick a float (Cast.isInt("1.0") is false), from 0 up to 1.
        expect(String(to.fields.NUM.value)).toBe('1.0');
        expect(comment).toBe('@ruby:rand:float');
    });

    test('writes a range when the user changed "to"', async () => {
        const { target } = await convert('say(rand)');
        randomBlock(target).to.fields.NUM.value = '2.0';
        expect(generate(target)).toBe('say(rand(0..2.0))');
    });

    test('a range from 0 to 1.0 stays a range', async () => {
        const { ruby, target } = await convert('say(rand(0..1.0))');
        expect(ruby).toBe('say(rand(0..1.0))');
        expect(randomBlock(target).comment).toBeNull();
    });
});

describe('Japanese mode: 乱数(n) with a value and 乱数() (issue #2049)', () => {
    test.each([
        ['表示する(乱数(n))'],
        ['表示する(乱数(要素数(Data)))'],
        ['表示する(乱数())'],
        ['a = 整数(乱数() * 6) + 1'],
    ])('%s becomes blocks and comes back', async (dncl) => {
        const ruby = dnclToRuby(dncl).ruby;
        const { ruby: back } = await convert(ruby);
        expect(rubyToDncl(back).dncl).toBe(dncl);
    });
});

describe('Japanese mode: only a bare rand becomes 乱数() (issue #2049)', () => {
    test.each([
        ['表示する("rand")', 'puts("rand")'],
        ['表示する(brand)', 'puts(brand)'],
        ['表示する(rand_x)', 'puts(rand_x)'],
        ['x = { rand: 1 }', 'x = { rand: 1 }'],
    ])('%s stays', (dncl, ruby) => {
        expect(rubyToDncl(ruby).dncl).toBe(dncl);
    });

    test('rand next to rand(n)', () => {
        expect(rubyToDncl('puts(rand + rand(3))').dncl).toBe('表示する(乱数() + 乱数(3))');
    });
});
