// A command (e.g. `a = 2`, `a > 1 ? 1 : 2`) or more than one statement in parentheses is not a value.
// As the receiver or an argument of a method it was put in an input and lost without an error
// (`say((a = 2).to_s)` became `say(a.to_s)`). It is the same error as without the parentheses,
// `say(a = 2)` (issue #1691).
import RubyToBlocksConverter from '../../../../src/lib/ruby-to-blocks-converter';

const PRELUDE = 'a = 1\nb = 1\nn = 0\n';
const PRELUDE_ROWS = 3;

const convert = async (code) => {
    const converter = new RubyToBlocksConverter(null, { version: '2' });
    const ok = await converter.targetCodeToBlocks(null, PRELUDE + code);
    return { ok, errors: converter.errors };
};

const wrongInstruction = (source) => `"${source}" is the wrong instruction.`;

describe('RubyToBlocksConverter/command in parentheses', () => {
    test.each([
        ['say((a > 1 ? 1 : 2).to_s)'],
        ['say((a = 2).to_s)'],
        ['say((n += 1).to_s)'],
        ['say((a; b).to_s)'],
        ['say((1; a).to_s)'],
        ['say((move(10); a; b).to_s)'],
        ['say(1 + (a = 2))'],
        ['say(!(a = 2))'],
        ['say(-(a = 2))'],
        ['say((move(10)).to_s)'],
        ['move((a; 1))'],
        ['b = (a = 2)'],
    ])('%s is the wrong instruction', async (code) => {
        const { ok, errors } = await convert(code);
        expect(ok).toBe(false);
        expect(errors).toHaveLength(1);
        expect(errors[0].row).toBe(PRELUDE_ROWS);
        expect(errors[0].text).toContain(wrongInstruction(code));
    });

    test('the same error as without the parentheses', async () => {
        const withParens = await convert('say((a > 1 ? 1 : 2).to_s)');
        const without = await convert('say(a > 1 ? 1 : 2)');
        expect(without.errors[0].text).toContain(wrongInstruction('say(a > 1 ? 1 : 2)'));
        expect(withParens.errors[0].text.replace(/"[^"]*"/, '')).toBe(without.errors[0].text.replace(/"[^"]*"/, ''));
    });

    test('an argument of a list method', async () => {
        const { ok, errors } = await convert('l = [1]\nl.push((a = 2))');
        expect(ok).toBe(false);
        expect(errors).toHaveLength(1);
        expect(errors[0].row).toBe(PRELUDE_ROWS + 1);
        expect(errors[0].text).toContain(wrongInstruction('l.push((a = 2))'));
    });

    test.each([
        ['say(((a > 1 ? 1 : 2)).to_s)', 'say(((a > 1 ? 1 : 2)).to_s)'],
        ['say(((a; b)).to_s)', 'say(((a; b)).to_s)'],
        ['say(((a = 2) + 1).to_s)', '(a = 2) + 1'],
        ['say((a = 2).to_s.length)', '(a = 2).to_s'],
    ])('nested: %s is an error on its line', async (code, source) => {
        const { ok, errors } = await convert(code);
        expect(ok).toBe(false);
        expect(errors).toHaveLength(1);
        expect(errors[0].row).toBe(PRELUDE_ROWS);
        expect(errors[0].text).toContain(wrongInstruction(source));
    });

    test.each([
        ['say((a + 1).to_s)'],
        ['say((a).to_s)'],
        ['say(((a)).to_s)'],
        ['say(((a + 1) * 2).to_s)'],
        // A command before the value is run before the call (as before issue #1691).
        ['say((move(10); a).to_s)'],
        ['say((a = 2; a + 1).to_s)'],
        ['say(1 + (move(10); move(20); a))'],
    ])('%s is converted', async (code) => {
        const { ok, errors } = await convert(code);
        expect(errors).toEqual([]);
        expect(ok).toBe(true);
    });

    test('a command before the value in parentheses is run before the call', async () => {
        const converter = new RubyToBlocksConverter(null, { version: '2' });
        const ok = await converter.targetCodeToBlocks(null, 'a = 1\nsay((move(10); a).to_s)');
        expect(converter.errors).toEqual([]);
        expect(ok).toBe(true);
        const blocks = converter._context.blocks;
        const move = Object.values(blocks).find((b) => b.opcode === 'motion_movesteps');
        expect(blocks[move.next].opcode).toBe('looks_say');
    });
});
