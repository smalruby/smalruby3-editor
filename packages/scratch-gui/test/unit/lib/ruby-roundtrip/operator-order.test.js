// === Smalruby: This file is Smalruby-specific (order of operations of generated Ruby) ===
/**
 * Blocks whose generated Ruby told the outer block a wrong order of operations, so the outer
 * block left out parentheses that change the meaning (or added ones that are not needed):
 * - a range `1..3` said it was a call, so as a receiver it came back as `1..3.abs`, which is
 *   `1..(3.abs)` (issue #1689);
 * - the return value of a method block (`_rv_`) said it was a call, so `"ab" * 3` went into a
 *   unary minus, `!` or the left of `**` without parentheses (issue #1690);
 * - `.include?` took its receiver with no order (`"a" + "b".include?("c")`), arguments and the
 *   right of `*` were asked with the order of a call (`@a.include?((1 + 2))`), and `%` put
 *   parentheses around its left side (`(a * b) % 3`).
 * Each round trip also converts the generated Ruby once more and checks that the blocks are the
 * same, so the parentheses (or the lack of them) keep the meaning.
 */
import { loadPrism } from '../../../../src/lib/prism-parser';
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
 * The generated Ruby is the source itself, and converting it again gives the same blocks.
 * @param {string} code - The Ruby source.
 */
const expectStableRoundTrip = async (code) => {
    const first = await convert(code);
    expect(first.ruby).toBe(code);
    const second = await convert(first.ruby);
    expect(second.trees).toEqual(first.trees);
};

/**
 * Turn the first block of `opcode` into another block, keeping one of its inputs, as a user
 * would by putting the inner block into another one. Used for shapes the converter does not make
 * (yet), so only the generator can be checked.
 * @param {object} target - The target the converter wrote to.
 * @param {string} opcode - The opcode of the block to change.
 * @param {string} fromInput - The input of that block to keep.
 * @param {string} newOpcode - The opcode of the new block.
 * @param {string} toInput - The name of the kept input in the new block.
 * @returns {string} The Ruby generated after the change.
 */
const replaceBlock = (target, opcode, fromInput, newOpcode, toInput) => {
    const blocks = target.blocks._blocks;
    const block = Object.values(blocks).find((b) => b.opcode === opcode);
    const kept = block.inputs[fromInput];
    block.opcode = newOpcode;
    block.comment = null;
    block.inputs = { [toInput]: { name: toInput, block: kept.block, shadow: null } };
    // The inputs of a block are cached.
    target.blocks.resetCache();
    RubyGenerator.currentTarget = target;
    return RubyGenerator.targetToCode(target, { version: '2' }).trim();
};

/**
 * The prism node type of a node, which survives minification (`constructor.name` does not).
 * @param {object} node - A prism node.
 * @returns {string} The node type, e.g. `CallNode`.
 */
const nodeType = (node) => node.toJSON().type;

describe('Ruby Roundtrip: range (issue #1689)', () => {
    let prism;

    beforeAll(async () => {
        prism = await loadPrism();
    });

    // The converter does not make range blocks except inside `rand(...)`, so the range block is
    // put in by hand: the `rand(1..3)` block becomes the `1..3` block.
    test('a range as a receiver', async () => {
        const { target } = await convert('say(rand(1..3).abs)');
        const random = Object.values(target.blocks._blocks).find((b) => b.opcode === 'operator_random');
        random.opcode = 'ruby_range';
        RubyGenerator.currentTarget = target;
        const ruby = RubyGenerator.targetToCode(target, { version: '2' }).trim();
        expect(ruby).toBe('say((1..3).abs)');

        // `1..3.abs` would be a range from 1 to `3.abs`.
        const arg = prism.parse(ruby).value.statements.body[0].arguments_.arguments_[0];
        expect(nodeType(arg)).toBe('CallNode');
        expect(nodeType(arg.receiver)).toBe('ParenthesesNode');
    });

    test('a range as the receiver of times', async () => {
        const { target } = await convert('rand(1..3).times do\n  move(10)\nend');
        const random = Object.values(target.blocks._blocks).find((b) => b.opcode === 'operator_random');
        random.opcode = 'ruby_exclude_range';
        RubyGenerator.currentTarget = target;
        const ruby = RubyGenerator.targetToCode(target, { version: '2' }).trim();
        expect(ruby).toBe('(1...3).times do\n  move(10)\nend');
    });

    test('a range as an argument has no parentheses', async () => {
        const { target } = await convert('say(rand(1..3))');
        const random = Object.values(target.blocks._blocks).find((b) => b.opcode === 'operator_random');
        random.opcode = 'ruby_range';
        RubyGenerator.currentTarget = target;
        expect(RubyGenerator.targetToCode(target, { version: '2' }).trim()).toBe('say(1..3)');
    });

    test.each([
        ['rand(1..3)', 'say(rand(1..3))'],
        ['rand with sums', '@a = 1\nsay(rand(@a + 1..@a * 2))'],
        ['rand with a minus', '@a = 1\nsay(rand(-@a..@a))'],
        ['rand as a receiver', 'say(rand(1..3).abs)'],
    ])('%s', async (_name, code) => {
        await expectStableRoundTrip(code);
    });
});

describe('Ruby Roundtrip: return value of a method block (issue #1690)', () => {
    test.each([
        ['unary minus of *', 'say(-("ab" * 3))'],
        ['unary minus of * then length', 'say(-("ab" * 3).length)'],
        ['unary minus of a call', 'say(-"ab".reverse.length)'],
        ['* as a receiver', 'say(("ab" * 3).length)'],
        ['* then index', 'say(("ab" * 3)[0])'],
        ['* in +', 'say("ab" * 3 + "y")'],
        ['* on the right of +', 'say("y" + "ab" * 3)'],
        ['* in ==', 'say("ab" * 3 == "y")'],
        ['* as an argument', 'say("ab" * 3)'],
        ['call as an argument', 'say("ab".reverse)'],
        ['call in +', 'say("ab".reverse + "y")'],
        ['10 ** length of *', 'say(10 ** ("ab" * 3).length)'],
    ])('%s', async (_name, code) => {
        await expectStableRoundTrip(code);
    });

    // The converter does not make these yet (`!("ab" * 3)` and `x ** 2` are errors), so the
    // return value is moved into the block by hand.
    test.each([
        ['!', 'say(-("ab" * 3))', 'say(!("ab" * 3))'],
        ['! of a call', 'say(-"ab".reverse)', 'say(!"ab".reverse)'],
    ])('%s', async (_name, code, expected) => {
        const { target } = await convert(code);
        expect(replaceBlock(target, 'operator_subtract', 'NUM2', 'operator_not', 'OPERAND')).toBe(expected);
    });

    describe('left of **', () => {
        beforeEach(() => {
            // No block makes `x ** 2`; this one asks its left side with the order of `**`.
            RubyGenerator.test_square = (block) => [
                `${RubyGenerator.valueToCode(block, 'BASE', RubyGenerator.ORDER_EXPONENTIATION)} ** 2`,
                RubyGenerator.ORDER_EXPONENTIATION,
            ];
        });

        afterEach(() => {
            delete RubyGenerator.test_square;
        });

        test.each([
            ['*', 'say(-("ab" * 3))', 'say(("ab" * 3) ** 2)'],
            ['a call', 'say(-"ab".reverse)', 'say("ab".reverse ** 2)'],
            ['a call on *', 'say(-("ab" * 3).length)', 'say(("ab" * 3).length ** 2)'],
        ])('%s', async (_name, code, expected) => {
            const { target } = await convert(code);
            expect(replaceBlock(target, 'operator_subtract', 'NUM2', 'test_square', 'BASE')).toBe(expected);
        });
    });
});

describe('Ruby Roundtrip: the line of a C block is not moved into `_rv_`', () => {
    /**
     * Take the method block out of its stack, as a user would by dragging it away, so the
     * return value block is the first block inside the C block.
     * @param {object} target - The target the converter wrote to.
     * @returns {string} The Ruby generated after the change.
     */
    const removeMethodBlock = (target) => {
        const blocks = target.blocks._blocks;
        const block = Object.values(blocks).find((b) => b.opcode === 'smalrubyRuby_stringMethod');
        const parent = blocks[block.parent];
        Object.keys(parent.inputs).forEach((name) => {
            if (parent.inputs[name].block === block.id) parent.inputs[name].block = block.next;
        });
        blocks[block.next].parent = parent.id;
        delete blocks[block.id];
        target.blocks.resetCache();
        RubyGenerator.currentTarget = target;
        return RubyGenerator.targetToCode(target, { version: '2' }).trim();
    };

    test.each([
        ['if', 'a = 2\nif a * 2 > 3\n  say("ab".reverse)\nend', 'a = 2\nif a * 2 > 3\n  say(_rv_)\nend'],
        ['times', 'a = 2\n(a * 2).times do\n  say("ab".reverse)\nend', 'a = 2\n(a * 2).times do\n  say(_rv_)\nend'],
        [
            'while',
            'a = 2\nwhile a * (2 + 1) > 3\n  say("ab".reverse)\nend',
            'a = 2\nwhile a * (2 + 1) > 3\n  say(_rv_)\nend',
        ],
        [
            'if with a call',
            'a = "x"\nif a.empty?\n  say("ab".reverse)\nend',
            'a = "x"\nif a.empty?\n  say(_rv_)\nend',
        ],
    ])('%s', async (_name, code, expected) => {
        const { target } = await convert(code);
        expect(removeMethodBlock(target)).toBe(expected);
    });
});

describe('Ruby Roundtrip: other blocks with the wrong order of operations', () => {
    test.each([
        ['include? on a sum', 'say(("a" + "b").include?("c"))'],
        ['include? with a sum', 'say("ab".include?("c" + "d"))'],
        ['list include? with a sum', '@a = [1]\nsay(@a.include?(1 + 2))'],
        ['list include? with a call', '@a = [1]\nsay(@a.include?(@a.length))'],
        ['string * a call', 'a = "x"\nsay("ab" * a.length)'],
        ['string * a sum', 'a = "x"\nsay("ab" * (1 + 2))'],
        ['delete with a call', 'a = "x"\nsay("ab".delete(a.reverse))'],
        ['delete with a sum', 'a = "x"\nsay("ab".delete(a + "y"))'],
        ['% after %', 'a = 1\nb = 2\nsay(a % b % 3)'],
        ['% after *', 'a = 1\nb = 2\nsay(a * b % 3)'],
        ['% after /', 'a = 1\nb = 2\nsay(a / b % 3)'],
        ['% of a sum', 'a = 1\nb = 2\nsay((a + b) % 3)'],
        ['% on the right keeps parentheses', 'a = 1\nb = 2\nsay(a % (b % 3))'],
        ['* on the right of % keeps parentheses', 'a = 1\nb = 2\nsay(a % (b * 3))'],
    ])('%s', async (_name, code) => {
        await expectStableRoundTrip(code);
    });
});
