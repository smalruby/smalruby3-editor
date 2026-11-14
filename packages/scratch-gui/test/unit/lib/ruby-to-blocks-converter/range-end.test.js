// The ends of a range go in the number inputs of "pick random": only a number or a value block can be
// there. A range whose end is not one (`rand(self..2)`, `rand(1..:a)`) was converted, with the end put in
// the input as something else (issue #1906). It is now the error of a wrong instruction on the line (P17).
import RubyToBlocksConverter from '../../../../src/lib/ruby-to-blocks-converter';
import {
    expectRoundTrip,
    makeConverter,
    makeSpriteTarget,
    setupRubyGenerator,
} from '../../helpers/ruby-roundtrip-helper';

const convert = async (code) => {
    const converter = new RubyToBlocksConverter(null, { version: '2' });
    const ok = await converter.targetCodeToBlocks(null, code);
    return { ok, errors: converter.errors };
};

const wrongInstruction = (source) => `"${source}" is the wrong instruction.`;

describe('RubyToBlocksConverter/the ends of a range', () => {
    test.each([
        ['say(rand(self..2))'],
        ['say(rand(1..self))'],
        ['say(rand(:a..2))'],
        ['say(rand(1..:a))'],
        ['say(rand(nil..2))'],
        ['say(rand(1..nil))'],
        ['say(rand(true..2))'],
        ['say(rand(1..false))'],
        ['say(rand("a".."z"))'],
        ['say(rand(1.."2"))'],
        ['say(rand([1]..2))'],
        ['say(rand(1..[2]))'],
        ['say(rand(1..{}))'],
        ['say(rand(Foo..2))'],
        ['say(rand((@a = 1)..2))'],
        ['say(rand(1..(@a = 2)))'],
        ['say(rand(say(1)..2))'],
        ['@b = rand(self..2)'],
        // A value that needs a block put before it: write it in a variable first (`@n = gets.to_i`).
        ['say(rand(1..gets.to_i))'],
    ])('%s is the wrong instruction', async (code) => {
        const { ok, errors } = await convert(code);
        expect(ok).toBe(false);
        expect(errors).toHaveLength(1);
        expect(errors[0].row).toBe(0);
        expect(errors[0].text).toContain(wrongInstruction(code));
    });

    test('a My Block that returns a value is the wrong instruction as an end', async () => {
        const { ok, errors } = await convert('def foo(n)\n  n\nend\nsay(rand(1..foo(3)))');
        expect(ok).toBe(false);
        expect(errors).toHaveLength(1);
        expect(errors[0].row).toBe(3);
        expect(errors[0].text).toContain(wrongInstruction('say(rand(1..foo(3)))'));
    });

    test('a range in a statement over more lines is told with its call, on its line', async () => {
        const { ok, errors } = await convert('if rand(1..:a) == 1\n  say(1)\nend');
        expect(ok).toBe(false);
        expect(errors).toHaveLength(1);
        expect(errors[0].row).toBe(0);
        expect(errors[0].text).toContain(wrongInstruction('rand(1..:a)'));
    });

    test.each([
        ['say(rand(1..6))'],
        ['say(rand(-1..2))'],
        ['say(rand(1.5..2.5))'],
        ['say(rand(@a..@b))'],
        ['say(rand(1..(@a + 1)))'],
        ['say(rand(1..answer))'],
        ['say(rand(1..(1)))'],
    ])('%s is converted', async (code) => {
        const { ok, errors } = await convert(code);
        expect(errors).toEqual([]);
        expect(ok).toBe(true);
    });
});

// An end in parentheses goes in the input as the value in them: it was put there as the statements in
// the parentheses, and the input came back as its default value (`1..(@a + 1)` → `1..10`).
describe('RubyToBlocksConverter/an end of a range in parentheses', () => {
    let target, runtime, converter;

    beforeEach(() => {
        ({ target, runtime } = makeSpriteTarget());
        setupRubyGenerator();
        converter = makeConverter(target, runtime, { version: '2' });
    });

    test.each([
        ['say(rand(1..(@a + 1)))', 'say(rand(1..@a + 1))'],
        ['say(rand((@a + 1)..3))', 'say(rand(@a + 1..3))'],
        ['say(rand(1..(@a)))', 'say(rand(1..@a))'],
        ['say(rand(1..(1)))', 'say(rand(1..1))'],
        ['say(rand(1..((2))))', 'say(rand(1..2))'],
    ])('%s comes back as %s', async (code, expected) => {
        await expectRoundTrip(converter, target, code, expected);
        // No block is left unconnected (the `+` made for the parentheses).
        const blocks = Object.values(target.blocks._blocks);
        expect(blocks.filter((b) => !b.parent).map((b) => b.opcode)).toEqual(['looks_say']);
    });
});
