// A string with `#{...}` cannot be a block (P17). As an operand of a comparison (`@b == "a#{@x}"`),
// it was put in an input as nothing and the conversion stopped with a JavaScript error
// (`Cannot set properties of undefined (setting 'parent')`) instead of telling the line (issue #1885).
// It is now the error of a wrong instruction on the line, as `say("a#{@x}")` and `@b = "a#{@x}"` are.
import RubyToBlocksConverter from '../../../../src/lib/ruby-to-blocks-converter';

const convert = async (code) => {
    const converter = new RubyToBlocksConverter(null, { version: '2' });
    const ok = await converter.targetCodeToBlocks(null, code);
    return { ok, errors: converter.errors };
};

const wrongInstruction = (source) => `"${source}" is the wrong instruction.`;

const S = '"a#{@x}"';

describe('RubyToBlocksConverter/a string with #{} as an operand', () => {
    // The statement is on one line: the error quotes the line.
    test.each([
        [`say(@b == ${S})`],
        [`say(@b != ${S})`],
        [`say(@b < ${S})`],
        [`say(@b > ${S})`],
        [`say(@b <= ${S})`],
        [`say(@b >= ${S})`],
        [`say(@b =~ ${S})`],
        [`say(@b.to_s == ${S})`],
        [`say(@b == ${S} ? 1 : 2)`],
        [`@b = (@c == ${S})`],
        [`@b = @c < ${S}`],
        [`think(@b == ${S}, 1)`],
        [`say(@b == :"a#{@x}")`],
        [`say(@b == /a#{@x}/)`],
        [`say(@b == \`a#{@x}\`)`],
        [`say(@b =~ /a#{@x}/)`],
        // The other operations were the error already; they stay so.
        [`say(@b + ${S})`],
        [`say(${S} + @b)`],
        [`say(1 - ${S})`],
        [`say(${S}.length)`],
        [`say(${S} == @b)`],
        // A range: `rand("a#{@x}"..2)` stopped with the error too, and so did a range without an end.
        [`say(rand(${S}..2))`],
        [`say(rand(1..${S}))`],
        ['say(rand(1..))'],
        ['say(rand(..2))'],
    ])('%s is the wrong instruction', async (code) => {
        const { ok, errors } = await convert(code);
        expect(ok).toBe(false);
        expect(errors).toHaveLength(1);
        expect(errors[0].row).toBe(0);
        expect(errors[0].text).toContain(wrongInstruction(code));
    });

    // The statement goes on over more lines: the error quotes the expression, on its line.
    test.each([
        [`if @b == ${S}\n  say(1)\nend`, `@b == ${S}`],
        [`if @b != ${S}\n  say(1)\nend`, `@b != ${S}`],
        [`if @b < ${S}\n  say(1)\nend`, `@b < ${S}`],
        [`if @b >= ${S}\n  say(1)\nend`, `@b >= ${S}`],
        [`if !(@b == ${S})\n  say(1)\nend`, `@b == ${S}`],
        [`if ${S} == @b\n  say(1)\nend`, `${S} == @b`],
        [`until @b == ${S}\n  say(1)\nend`, `@b == ${S}`],
        [`while @b == ${S}\n  say(1)\nend`, `@b == ${S}`],
    ])('%s is the wrong instruction', async (code, source) => {
        const { ok, errors } = await convert(code);
        expect(ok).toBe(false);
        expect(errors).toHaveLength(1);
        expect(errors[0].row).toBe(0);
        expect(errors[0].text).toContain(wrongInstruction(source));
    });

    // A string without `#{}` and the values a comparison can hold are kept.
    test.each([
        ['say(@b == "a")'],
        ['say(@b < "a" + @x.to_s)'],
        ['say(rand(1..6))'],
        ['say(rand(@a..@b))'],
        [`if @b == "a"\n  say(1)\nend`],
    ])('%s is converted', async (code) => {
        const { ok, errors } = await convert(code);
        expect(errors).toEqual([]);
        expect(ok).toBe(true);
    });
});
