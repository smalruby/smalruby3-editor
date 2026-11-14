// A call with a symbol and an argument that is not a value (`@h[:a] = (@a = 1)`) told to change the
// symbol (`symbols need .to_s ... Write @h[:a.to_s] = (@a = 1) instead`), which did not help: the
// command is what cannot be converted. It is now the error of a wrong instruction on the line, as
// `@b[0] = (@a = 1)` and `@b.push(@a = 1)` are (P17, issue #1884). So is an argument that could not be
// converted (`@h[:a] = @x.bar`).
import RubyToBlocksConverter from '../../../../src/lib/ruby-to-blocks-converter';

const convert = async (code) => {
    const converter = new RubyToBlocksConverter(null, { version: '2' });
    const ok = await converter.targetCodeToBlocks(null, code);
    return { ok, errors: converter.errors };
};

const wrongInstruction = (source) => `"${source}" is the wrong instruction.`;

describe('RubyToBlocksConverter/a symbol with an argument that is not a value', () => {
    test.each([
        ['@h = {a: 1}', '@h[:a] = (@a = 1)'],
        ['@h = {a: 1}', '@h[:a] = (b = 1)'],
        ['@h = {a: 1}', '@h[:a] = (@a += 1)'],
        ['@h = {a: 1}', '@h[:a] = (move(10))'],
        ['@h = {a: 1}', 'say(@h.key?(:a), (@a = 1))'],
        // A value that could not be converted (a method that has no block) is what is wrong too.
        ['@h = {a: 1}', '@h[:a] = @x.bar'],
        ['', 'say(:a, @x.bar)'],
        ['', 'say(foo.bar(:a))'],
        ['', 'say((1..3).include?(:a))'],
        ['', 'say(:a + foo(1))'],
        ['@b = [1]', '@b[0] = (@a = 1)'],
        ['@b = [1]', '@b.push(@a = 1)'],
        // The symbol is not what is wrong in these either.
        ['', 'say(:a + (@a = 1))'],
        ['', 'say((@a = 1) + :a)'],
        ['', 'say(:a < (@a = 1))'],
        ['', 'say(:a, (@a = 1))'],
    ])('%s / %s is the wrong instruction', async (before, code) => {
        const row = before ? 1 : 0;
        const { ok, errors } = await convert(before ? `${before}\n${code}` : code);
        expect(ok).toBe(false);
        expect(errors).toHaveLength(1);
        expect(errors[0].row).toBe(row);
        expect(errors[0].text).toContain(wrongInstruction(code));
    });

    // A symbol where a string is needed is still told to have .to_s.
    test.each([
        ['say(:a + 1)', 'symbols cannot be used in arithmetic'],
        ['say(:a < 1)', 'can only be compared with other symbols'],
        ['say("x", :a)', 'symbols need .to_s'],
        // The receiver of an extension or of another sprite is made as a `ruby_expression` on purpose:
        // it is not a value that could not be converted.
        ['text2speech.speak(:hello)', 'symbols need .to_s'],
        ['koshien.move_to(:a)', 'symbols need .to_s'],
        ['mesh.sensor_value(:a)', 'symbols need .to_s'],
        ['say(mesh.sensor_value(:a))', 'symbols need .to_s'],
        ['microbit_more.display_text(:a)', 'symbols need .to_s'],
        ['say(sprite("Cat").foo(:a))', 'symbols need .to_s'],
        ['say(stage.foo(:a))', 'symbols need .to_s'],
    ])('%s is the error of the symbol', async (code, text) => {
        const { ok, errors } = await convert(code);
        expect(ok).toBe(false);
        expect(errors).toHaveLength(1);
        expect(errors[0].text).toContain(text);
    });
});
