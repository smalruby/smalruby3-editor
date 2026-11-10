// Assigning to an argument of a method (a function in DNCL) cannot become blocks: the
// argument reporter of a definition cannot be changed. The error says so, with the way
// out, instead of the general "wrong instruction" (the generative AI misread that as a
// matter of `=` and `←`).
import RubyToBlocksConverter from '../../../../src/lib/ruby-to-blocks-converter';

const errorsOf = async (code) => {
    const converter = new RubyToBlocksConverter(null, { version: '2' });
    const ok = await converter.targetCodeToBlocks(null, code);
    return { ok, errors: converter.errors };
};

describe('RubyToBlocksConverter/assign to an argument', () => {
    test.each([
        ['a = b', 'def gcd(a, b)\n  while b != 0\n    t = a % b\n    a = b\n    b = t\n  end\n  a\nend\n', 4],
        ['a += 1', 'def up(a)\n  a += 1\n  say(a)\nend\n', 2],
    ])('%s says the argument cannot be changed', async (_name, code, row) => {
        const { ok, errors } = await errorsOf(code);
        expect(ok).toBe(false);
        expect(errors).toHaveLength(1);
        expect(errors[0].row).toBe(row - 1);
        expect(errors[0].text).toMatch(/"a" is an argument/);
        expect(errors[0].text).toMatch(/x = a/);
    });

    test('a local variable copied from the argument can be changed', async () => {
        const { ok, errors } = await errorsOf('def up(a)\n  x = a\n  x += 1\n  say(x)\nend\n');
        expect(errors).toEqual([]);
        expect(ok).toBe(true);
    });
});
