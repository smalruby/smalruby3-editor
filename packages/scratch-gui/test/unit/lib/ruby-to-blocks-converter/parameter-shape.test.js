// A My Block has only required arguments, and a block of `3.times do |i|` / `@a.each do |x|` has only
// required parameters. Other shapes of an argument (a default value `a = 1`, `*a`, `a:`, `**h`, `&blk`,
// `...`, a block-local `; j`) were dropped without an error: `def foo(a = 1)` lost `1` (issue #1906).
// They are now the error of a wrong instruction on the line of the argument (P17).
import RubyToBlocksConverter from '../../../../src/lib/ruby-to-blocks-converter';

const convert = async (code) => {
    const converter = new RubyToBlocksConverter(null, { version: '2' });
    const ok = await converter.targetCodeToBlocks(null, code);
    return { ok, errors: converter.errors };
};

const wrongInstruction = (source) => `"${source}" is the wrong instruction.`;

describe('RubyToBlocksConverter/the shape of an argument', () => {
    test.each([
        ['def foo(a = 1)'],
        ['def foo(a, b = 1)'],
        ['def self.foo(a = 1)'],
        ['def foo(*a)'],
        ['def foo(a, *b)'],
        ['def foo(*)'],
        ['def foo(*a, b)'],
        ['def foo(a:)'],
        ['def foo(a: 1)'],
        ['def foo(**h)'],
        ['def foo(**nil)'],
        ['def foo(&blk)'],
        ['def foo(...)'],
        ['def foo((a, b))'],
    ])('%s is the wrong instruction', async (line) => {
        const { ok, errors } = await convert(`${line}\n  say(1)\nend`);
        expect(ok).toBe(false);
        expect(errors).toHaveLength(1);
        expect(errors[0].row).toBe(0);
        expect(errors[0].text).toContain(wrongInstruction(line));
    });

    test('the argument on a later line is told on its line', async () => {
        const { ok, errors } = await convert('def foo(a,\n        b = 1)\n  say(a)\nend');
        expect(ok).toBe(false);
        expect(errors).toHaveLength(1);
        expect(errors[0].row).toBe(1);
        expect(errors[0].text).toContain(wrongInstruction('b = 1)'));
    });

    test.each([
        ['3.times do |i = 1|'],
        ['3.times do |*i|'],
        ['3.times do |i, *j|'],
        ['3.times do |i,|'],
        ['3.times do |i; j|'],
        ['3.times do |i:|'],
        ['3.times do |**h|'],
        ['3.times do |&b|'],
        ['3.times do |(a, b)|'],
        ['@a.each do |x = 1|'],
        ['@h.each do |k, v = 1|'],
    ])('%s is the wrong instruction', async (line) => {
        const { ok, errors } = await convert(`@a = [1]\n@h = {a: 1}\n${line}\n  say(1)\nend`);
        expect(ok).toBe(false);
        expect(errors).toHaveLength(1);
        expect(errors[0].row).toBe(2);
        expect(errors[0].text).toContain(wrongInstruction(line));
    });

    // Required arguments stay as they are.
    test.each([
        ['def foo\n  say(1)\nend'],
        ['def foo()\n  say(1)\nend'],
        ['def foo(a)\n  say(a)\nend'],
        ['def foo(a, b)\n  say(a)\nend'],
        ['def self.foo(a)\n  say(a)\nend'],
        ['3.times do |i|\n  say(i)\nend'],
        ['@a = [1]\n@a.each do |x|\n  say(x)\nend'],
        ['@h = {a: 1}\n@h.each do |k, v|\n  say(k)\nend'],
        // The arguments of initialize are kept as they are written (P6).
        ['class Foo\n  def initialize(a = 1)\n  end\nend'],
    ])('%s is converted', async (code) => {
        const { ok, errors } = await convert(code);
        expect(errors).toEqual([]);
        expect(ok).toBe(true);
    });
});
