// An expression that is not converted inside another expression (`say(wait(1).to_s)`) used to give an
// error that named the inner expression ("wait(1)"), as the outer call took it as its receiver. The error
// now names the statement that holds it, as it does when the outer call does not take it
// (`say(foo.bar)` / `say(a = 2)`) (issue #1704).
import RubyToBlocksConverter from '../../../../src/lib/ruby-to-blocks-converter';

const convert = async (code) => {
    const converter = new RubyToBlocksConverter(null, { version: '2' });
    const ok = await converter.targetCodeToBlocks(null, code);
    return { ok, errors: converter.errors };
};

const wrongInstruction = (source) => `"${source}" is the wrong instruction.`;

describe('RubyToBlocksConverter/an error inside an expression names the statement', () => {
    // The table of issue #1704 and the cases without parentheses it is compared with.
    test.each([
        ['say(((a = 2) + 1).to_s)'],
        ['say((a = 2).to_s.length)'],
        ['say(wait(1).to_s)'],
        ['say((a = 2).to_s)'],
        ['say(a = 2)'],
        ['say(foo.bar)'],
    ])('%s', async (code) => {
        const { ok, errors } = await convert(`a = 1\n${code}`);
        expect(ok).toBe(false);
        expect(errors).toHaveLength(1);
        expect(errors[0].row).toBe(1);
        expect(errors[0].column).toBe(0);
        expect(errors[0].text).toContain(wrongInstruction(code));
    });

    test.each([
        ['an assignment', 'b = wait(1).to_s', 'b = wait(1).to_s'],
        ['a statement alone', 'wait(1).to_s', 'wait(1).to_s'],
        ['an argument of an argument', 'move(wait(1).to_s.length)', 'move(wait(1).to_s.length)'],
        ['an operand', 'say(1 + wait(1).to_s.length)', 'say(1 + wait(1).to_s.length)'],
        ['an element of an array', 'x = [wait(1).to_s]', 'x = [wait(1).to_s]'],
        ['a statement in parentheses', 'say((move(10); wait(1).to_s).to_s)', 'say((move(10); wait(1).to_s).to_s)'],
        ['the condition of if', 'if foo.bar == 1\n  move(10)\nend', 'if foo.bar == 1...'],
        ['the count of times', 'wait(1).to_s.length.times do\n  move(10)\nend', 'wait(1).to_s.length.times do...'],
    ])('%s', async (_name, code, source) => {
        const { ok, errors } = await convert(code);
        expect(ok).toBe(false);
        expect(errors).toHaveLength(1);
        expect(errors[0].row).toBe(0);
        expect(errors[0].column).toBe(0);
        expect(errors[0].text).toContain(wrongInstruction(source));
    });

    // A statement inside a body is the statement named, not the statement that holds the body.
    test.each([
        ['the body of if', 'if a == 1\n  say(wait(1).to_s)\nend'],
        ['the body of a method', 'def foo\n  say(wait(1).to_s)\nend'],
        ['the body of an event', 'self.when_flag_clicked do\n  say(wait(1).to_s)\nend'],
    ])('%s', async (_name, code) => {
        const { ok, errors } = await convert(`a = 1\n${code}`);
        expect(ok).toBe(false);
        expect(errors).toHaveLength(1);
        expect(errors[0].row).toBe(2);
        expect(errors[0].column).toBe(2);
        expect(errors[0].text).toContain(wrongInstruction('say(wait(1).to_s)'));
    });
});
