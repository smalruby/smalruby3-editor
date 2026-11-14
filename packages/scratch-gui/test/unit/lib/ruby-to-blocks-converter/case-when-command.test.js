// A command (e.g. `@a = "abc"`, `move(1)`) as the subject of `case` or the value of `when` is not a
// value. It was put in the input of the `==` block, and came back as `when @` (issue #1818). It is
// the error of a wrong instruction on that line, as a command in an argument (`say(@a = 1)`).
import dedent from 'dedent';
import RubyToBlocksConverter from '../../../../src/lib/ruby-to-blocks-converter';

const convert = async (code) => {
    const converter = new RubyToBlocksConverter(null, { version: '2' });
    const ok = await converter.targetCodeToBlocks(null, code);
    return { ok, errors: converter.errors };
};

const wrongInstruction = (source) => `"${source}" is the wrong instruction.`;

describe('RubyToBlocksConverter/a command in case / when', () => {
    test.each([
        ['when (@a = "abc")', 1],
        ['when @a = "abc"', 1],
        ['when (a = 1)', 1],
        ['when move(1)', 1],
    ])('`%s` is the wrong instruction', async (whenLine, row) => {
        const code = dedent`
            case @b
            ${whenLine}
              say(1)
            end
        `;
        const { ok, errors } = await convert(code);
        expect(ok).toBe(false);
        expect(errors).toHaveLength(1);
        expect(errors[0].row).toBe(row);
        expect(errors[0].text).toContain(wrongInstruction(whenLine));
    });

    test('a command in a later when', async () => {
        const code = dedent`
            case @b
            when 1
              say(1)
            when (@a = 2)
              say(2)
            end
        `;
        const { ok, errors } = await convert(code);
        expect(ok).toBe(false);
        expect(errors).toHaveLength(1);
        expect(errors[0].row).toBe(3);
        expect(errors[0].text).toContain(wrongInstruction('when (@a = 2)'));
    });

    test.each([['case (@a = "abc")'], ['case move(1)']])('`%s` is the wrong instruction', async (caseLine) => {
        const code = dedent`
            ${caseLine}
            when "abc"
              say(1)
            end
        `;
        const { ok, errors } = await convert(code);
        expect(ok).toBe(false);
        expect(errors).toHaveLength(1);
        expect(errors[0].row).toBe(0);
        expect(errors[0].text).toContain(wrongInstruction(caseLine));
    });

    test.each([
        ['a value', 'case @b\nwhen 1\n  say(1)\nend'],
        ['a value in parentheses', 'case @b\nwhen (1 + 2)\n  say(1)\nend'],
        ['a variable', 'case @b\nwhen @a\n  say(1)\nend'],
    ])('%s is still converted', async (name, code) => {
        const { ok, errors } = await convert(code);
        expect(errors).toEqual([]);
        expect(ok).toBe(true);
    });
});
