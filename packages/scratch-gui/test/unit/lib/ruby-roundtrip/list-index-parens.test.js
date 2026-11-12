// === Smalruby: This file is Smalruby-specific (list index round trip without extra parentheses) ===
/**
 * `@a.index("x")` becomes "(item # of x in a) - 1" with the `@ruby:array:index` marker. Coming
 * back to Ruby it must be `@a.index("x")` again, not `(@a.index("x"))` (issue #1660). Each case
 * also converts the generated Ruby once more and checks that the blocks are the same as the
 * blocks of the original code, so dropping the parentheses does not change the meaning.
 */
import {
    makeSpriteTarget,
    makeConverter,
    setupRubyGenerator,
    rubyToBlocksToRuby,
} from '../../helpers/ruby-roundtrip-helper';

/**
 * The blocks of the target as trees without ids, so two conversions can be compared.
 * @param {object} target - The target the converter wrote to.
 * @returns {Array<object>} One tree per script, in order.
 */
const blockTrees = (target) => {
    const blocks = target.blocks._blocks;
    const tree = (id) => {
        const block = blocks[id];
        if (!block) return null;
        const inputs = {};
        Object.keys(block.inputs || {})
            .sort()
            .forEach((name) => {
                inputs[name] = tree(block.inputs[name].block);
            });
        const fields = {};
        Object.keys(block.fields || {})
            .sort()
            .forEach((name) => {
                fields[name] = block.fields[name].value;
            });
        const comment = block.comment ? target.comments[block.comment]?.text : undefined;
        return { opcode: block.opcode, fields, inputs, comment, next: tree(block.next) };
    };
    return Object.keys(blocks)
        .filter((id) => blocks[id].topLevel)
        .map(tree);
};

const convert = async (code) => {
    const { target, runtime } = makeSpriteTarget();
    setupRubyGenerator();
    const converter = makeConverter(target, runtime, { version: '2' });
    const ruby = await rubyToBlocksToRuby(converter, target, code);
    return { ruby, trees: blockTrees(target) };
};

describe('Ruby Roundtrip: list index without extra parentheses (issue #1660)', () => {
    test.each([
        ['say', '@a = ["x"]\nsay(@a.index("x"))'],
        ['global list', '$a = ["x"]\nsay($a.index("x"))'],
        ['bare expression', '@a = ["x"]\n\n@a.index("x")'],
        ['assignment', '@a = ["x"]\n@b = @a.index("x")'],
        ['left of +', '@a = ["x"]\nsay(@a.index("x") + 1)'],
        ['right of -', '@a = ["x"]\nsay(10 - @a.index("x"))'],
        ['left of *', '@a = ["x"]\nsay(@a.index("x") * 2)'],
        ['element reference', '@a = ["x"]\nsay(@a[@a.index("x")])'],
        ['comparison', '@a = ["x"]\nif @a.index("x") == 0\n  say("ok")\nend'],
        ['length', '@a = ["x"]\nsay(@a.length)'],
        ['include?', '@a = ["x"]\nsay(@a.include?("x"))'],
        ['element', '@a = ["x"]\nsay(@a[0])'],
    ])('%s', async (_name, code) => {
        const first = await convert(code);
        expect(first.ruby).toBe(code);

        // The Ruby without parentheses converts to the same blocks.
        const second = await convert(first.ruby);
        expect(second.trees).toEqual(first.trees);
    });

    test('parentheses that change the meaning stay', async () => {
        const code = '@a = ["x"]\nsay((@a.index("x") + 1) * 2)';
        const first = await convert(code);
        expect(first.ruby).toBe(code);
    });
});
