// The ends of a range go in the number inputs of "pick random": only a number or a value block can be
// there. A range whose end is not one (`rand(self..2)`, `rand(1..:a)`) was converted, with the end put in
// the input as something else (issue #1906). It is now the error of a wrong instruction on the line (P17).
import RubyToBlocksConverter from '../../../../src/lib/ruby-to-blocks-converter';

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
    ])('%s is the wrong instruction', async (code) => {
        const { ok, errors } = await convert(code);
        expect(ok).toBe(false);
        expect(errors).toHaveLength(1);
        expect(errors[0].row).toBe(0);
        expect(errors[0].text).toContain(wrongInstruction(code));
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
