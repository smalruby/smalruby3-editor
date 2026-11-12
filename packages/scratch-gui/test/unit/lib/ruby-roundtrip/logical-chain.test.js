/**
 * A chain of three or more `&&` / `||` (issue #1634).
 *
 * `a && b && c` is `(a && b) && c` in Ruby, so the generator must not wrap the left `&&` in
 * parentheses: `while a > 0 && a < 3 && a > 1` used to come back as `while (a > 0 && a < 3) && a > 1`.
 * Parentheses that change the meaning (`(a || b) && c`) and parentheses on the right
 * (`a && (b && c)`, a different block tree) stay as written.
 */
import { dnclToRuby } from '../../../../src/lib/dncl/dncl-to-ruby';
import { rubyToDncl } from '../../../../src/lib/dncl/ruby-to-dncl';
import {
    makeSpriteTarget,
    makeConverter,
    setupRubyGenerator,
    expectRoundTrip,
    rubyToBlocksToRuby,
} from '../../helpers/ruby-roundtrip-helper';

/**
 * Describe the operator tree of a block as text, e.g. `and(and(gt,lt),gt)`.
 * @param {object} blocks - The converted blocks, by id.
 * @param {string} id - The block id.
 * @returns {string} The shape.
 */
const shapeOf = (blocks, id) => {
    const block = blocks[id];
    const name = block.opcode.replace(/^operator_/, '');
    if (!['and', 'or', 'not'].includes(name)) return name;
    const inputs = ['OPERAND1', 'OPERAND2', 'OPERAND']
        .filter((key) => block.inputs[key] && block.inputs[key].block)
        .map((key) => shapeOf(blocks, block.inputs[key].block));
    return `${name}(${inputs.join(',')})`;
};

describe('Ruby Roundtrip: a chain of && / || (issue #1634)', () => {
    let target, runtime, converter;

    beforeEach(() => {
        ({ target, runtime } = makeSpriteTarget());
        setupRubyGenerator();
        converter = makeConverter(target, runtime);
    });

    describe.each([
        'while a > 0 && a < 3 && a > 1\n  move(10)\nend',
        'while a > 0 && a < 3 && a > 1 && a == 2\n  move(10)\nend',
        'if a > 0 || a < 3 || a > 1\n  move(10)\nend',
        'if a > 0 || a < 3 || a > 1 || a == 2\n  move(10)\nend',
        'until a > 0 && a < 3 && a > 1\n  move(10)\nend',
        'move(10) if a > 0 && a < 3 && a > 1',
        'say(a > 0 && a < 3 && a > 1)',
        'say(a > 0 || a < 3 || a > 1)',
        // && binds tighter than ||: no parentheses are needed for these.
        'if a > 0 || a < 3 && a > 1\n  move(10)\nend',
        'if a > 0 && a < 3 || a > 1\n  move(10)\nend',
        'if a > 0 && a < 3 || a > 1 && a < 5\n  move(10)\nend',
        'if a > 0 || a < 3 && a > 1 || a == 2\n  move(10)\nend',
        // Parentheses that change the meaning stay.
        'if (a > 0 || a < 3) && a > 1\n  move(10)\nend',
        'if a > 0 && (a < 3 || a > 1)\n  move(10)\nend',
        'if (a > 0 || a < 3) && (a > 1 || a == 2) && a < 5\n  move(10)\nend',
        // A chain on the right is a different block tree, so its parentheses stay.
        'if a > 0 && (a < 3 && a > 1)\n  move(10)\nend',
        'if a > 0 || (a < 3 || a > 1)\n  move(10)\nend',
        // With `!`, comparison and arithmetic.
        'if !(a > 0 && a < 3) && a > 1 && !(a == 2)\n  move(10)\nend',
        'if !(a > 0 || a < 3 || a > 1)\n  move(10)\nend',
        'if a + 1 > 0 && a * 2 < 3 && a - 1 >= 1\n  move(10)\nend',
        'if a >= 0 && a <= 3 && a != 1\n  move(10)\nend',
        'if !(a > 0) && a < 3 && !(a > 1 || a < 0)\n  move(10)\nend',
        'say("x" + "y" + "z" == "xyz" && a > 0 && a < 3)',
        'say((a > 0 && a < 3) == (a > 1 || a < 5))',
        // A variable alone as a condition (issue #1611).
        'while @x && @y && a < 3\n  move(10)\nend',
        'while @x || @y || @z\n  move(10)\nend',
        'begin\n  move(10)\nend while a > 0 && a < 3 && a > 1',
    ])('%s', (code) => {
        test('round-trips as written', async () => {
            await expectRoundTrip(converter, target, `a = 1\n${code}`);
        });
    });

    test.each([
        ['while (a > 0 && a < 3) && a > 1', 'while a > 0 && a < 3 && a > 1'],
        ['while ((a > 0 || a < 3) || a > 1) || a == 2', 'while a > 0 || a < 3 || a > 1 || a == 2'],
        ['while (a > 0 && a < 3) || a > 1', 'while a > 0 && a < 3 || a > 1'],
        // The keywords `and` / `or` / `not` become the same blocks as `&&` / `||` / `!`.
        ['while a > 0 and a < 3 and a > 1', 'while a > 0 && a < 3 && a > 1'],
        ['while (a > 0 or a < 3) and a > 1', 'while (a > 0 || a < 3) && a > 1'],
        // `not` binds looser than `&&`: `not (x) && y` is `not ((x) && y)`.
        ['while not (a > 0 && a < 3) && a > 1', 'while !(a > 0 && a < 3 && a > 1)'],
    ])('`%s` comes back without the parentheses on the left', async (code, expected) => {
        await expectRoundTrip(
            converter,
            target,
            `a = 1\n${code}\n  move(10)\nend`,
            `a = 1\n${expected}\n  move(10)\nend`,
        );
    });

    test.each([
        ['a > 0 && a < 3 && a > 1', 'and(and(gt,lt),gt)'],
        ['a > 0 && (a < 3 && a > 1)', 'and(gt,and(lt,gt))'],
        ['a > 0 || a < 3 && a > 1', 'or(gt,and(lt,gt))'],
        ['(a > 0 || a < 3) && a > 1', 'and(or(gt,lt),gt)'],
    ])('`%s` makes the block tree %s', async (condition, shape) => {
        expect(await converter.targetCodeToBlocks(target, `a = 1\nsay(${condition})`)).toBeTruthy();
        const blocks = converter.blocks;
        const say = Object.values(blocks).find((b) => b.opcode === 'looks_say');
        expect(shapeOf(blocks, say.inputs.MESSAGE.block)).toBe(shape);
    });
});

describe('DNCL: a chain of かつ / または (issue #1634)', () => {
    let target, runtime, converter;

    beforeEach(() => {
        ({ target, runtime } = makeSpriteTarget());
        setupRubyGenerator();
        converter = makeConverter(target, runtime);
    });

    test.each([
        'a = 1\nもし a > 0 かつ a < 3 かつ a > 1 ならば\n  a = 2\nを実行する',
        'a = 1\nもし a > 0 または a < 3 または a > 1 ならば\n  a = 2\nを実行する',
        'a = 1\nもし a > 0 または a < 3 かつ a > 1 ならば\n  a = 2\nを実行する',
    ])('%s comes back as written through the blocks', async (dncl) => {
        const ruby = await rubyToBlocksToRuby(converter, target, dnclToRuby(dncl).ruby);
        expect(rubyToDncl(ruby).dncl).toBe(dncl);
    });
});
