// === Smalruby: This file is Smalruby-specific (unary minus on non-literals round trip) ===
/**
 * Scratch has no block for a unary minus, so `-X` (X is not a number literal) becomes the
 * "(0) - (X)" block with the `@ruby:unary_minus` marker, and comes back to Ruby as `-X`
 * (issue #1676). Each case also converts the generated Ruby once more and checks that the blocks
 * are the same as the blocks of the original code, so the parentheses (or the lack of them) keep
 * the meaning: `-a ** 2` is `-(a ** 2)` in Ruby, and `-a * b` is `(-a) * b`.
 */
import RubyGenerator from '../../../../src/lib/ruby-generator';
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
    return { ruby, trees: blockTrees(target), target };
};

/**
 * Put a number into an input of the first "(0) - (X)" block, as a user would by typing in it.
 * @param {object} target - The target the converter wrote to.
 * @param {string} input - `NUM1` or `NUM2`.
 * @param {string} value - The number to type.
 * @returns {string} The Ruby generated after the change.
 */
const editSubtractInput = (target, input, value) => {
    const blocks = target.blocks._blocks;
    const subtract = Object.values(blocks).find((b) => b.opcode === 'operator_subtract');
    const inputBlock = blocks[subtract.inputs[input].block];
    inputBlock.opcode = 'math_number';
    inputBlock.fields = { NUM: { name: 'NUM', value } };
    RubyGenerator.currentTarget = target;
    return RubyGenerator.targetToCode(target, { version: '2' }).trim();
};

/**
 * The first block of the first script whose opcode is `opcode`, searched depth first.
 * @param {Array<object>} trees - The block trees.
 * @param {string} opcode - The opcode to look for.
 * @returns {?object} The block tree, or null.
 */
const findBlock = (trees, opcode) => {
    const walk = (node) => {
        if (!node) return null;
        if (node.opcode === opcode) return node;
        for (const name of Object.keys(node.inputs)) {
            const found = walk(node.inputs[name]);
            if (found) return found;
        }
        return walk(node.next);
    };
    for (const tree of trees) {
        const found = walk(tree);
        if (found) return found;
    }
    return null;
};

describe('Ruby Roundtrip: unary minus on non-literals (issue #1676)', () => {
    test.each([
        ['instance variable', '@x = 1\nsay(-@x)'],
        ['move', '@x = 1\nmove(-@x)'],
        ['parenthesized sum', 'say(-(1 + 2))'],
        ['parenthesized difference', '@x = 1\nsay(-(@x - 1))'],
        ['method call', '@a = ["x"]\nsay(-@a.length)'],
        ['reporter', 'move(-x)'],
        ['answer', 'say(-answer)'],
        ['left of *', '@x = 1\nsay(-@x * 2)'],
        ['right of *', '@x = 1\nsay(2 * -@x)'],
        ['right of -', '@p = 1\n@q = 2\nsay(@p - -@q)'],
        ['right of +', '@p = 1\n@q = 2\nsay(@p + -@q)'],
        ['exponent binds tighter', '@x = 1\nsay(-10 ** @x)'],
        ['double minus', '@x = 1\nsay(- -@x)'],
        ['assignment', '@a = 1\n@a = -@a'],
        ['comparison', '@x = 1\nif -@x < 0\n  say("ok")\nend'],
        ['minus of a negative number', 'say(- -1)'],
    ])('%s', async (_name, code) => {
        const first = await convert(code);
        expect(first.ruby).toBe(code);

        const second = await convert(first.ruby);
        expect(second.trees).toEqual(first.trees);
    });

    test('-X becomes "(0) - (X)" with the marker', async () => {
        const { trees } = await convert('@x = 1\nsay(-@x)');
        const block = findBlock(trees, 'operator_subtract');
        expect(block.comment).toBe('@ruby:unary_minus');
        expect(block.inputs.NUM1).toEqual(expect.objectContaining({ opcode: 'math_number', fields: { NUM: '0' } }));
        expect(block.inputs.NUM2.opcode).toBe('data_variable');
    });

    test('-a ** 2 is the minus of a ** 2', async () => {
        const { trees } = await convert('@x = 1\nsay(-10 ** @x)');
        const block = findBlock(trees, 'operator_subtract');
        expect(block.inputs.NUM2.opcode).toBe('operator_mathop');
    });

    test('a plain 0 - x stays 0 - x', async () => {
        const code = '@x = 1\nsay(0 - @x)';
        const { ruby, trees } = await convert(code);
        expect(ruby).toBe(code);
        expect(findBlock(trees, 'operator_subtract').comment).toBeUndefined();
    });

    test('a number literal stays a number', async () => {
        const code = 'move(-1)';
        const { ruby, trees } = await convert(code);
        expect(ruby).toBe(code);
        expect(findBlock(trees, 'operator_subtract')).toBeNull();
    });

    test('writes a plain subtraction once the left side is no longer 0', async () => {
        const { target } = await convert('@x = 1\nsay(-@x)');
        expect(editSubtractInput(target, 'NUM1', '5')).toBe('@x = 1\nsay(5 - @x)');
    });

    test('a negative number on the right comes back as a block too', async () => {
        const { target } = await convert('@x = 1\nsay(-@x)');
        const ruby = editSubtractInput(target, 'NUM2', '-1');
        expect(ruby).toBe('@x = 1\nsay(- -1)');
        const again = await convert(ruby);
        expect(findBlock(again.trees, 'operator_subtract').comment).toBe('@ruby:unary_minus');
    });
});
