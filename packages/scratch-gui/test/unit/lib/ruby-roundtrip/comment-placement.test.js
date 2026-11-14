/**
 * A comment on a line comes back on that line, even when the first block that starts on the line is not
 * written in Ruby (the block that adds an element of an array literal, the block that stops a method for
 * `return`) or is a value (the block that adds for `a += 1`). The comment goes to the first block of the
 * line that is written in Ruby (issue #1864).
 */
import dedent from 'dedent';
import {
    makeConverter,
    makeSpriteTarget,
    rubyToBlocksToRuby,
    setupRubyGenerator,
} from '../../helpers/ruby-roundtrip-helper';

const roundTrip = async (code) => {
    const { target, runtime } = makeSpriteTarget();
    setupRubyGenerator();
    const converter = makeConverter(target, runtime, { version: '2' });
    return { ruby: await rubyToBlocksToRuby(converter, target, code), target };
};

describe('Ruby Roundtrip: a comment stays on its line (issue #1864)', () => {
    test.each([
        ['the trailing comment of an array literal', '@a = [1, 2] # c'],
        ['the comment before an array literal', '# c\n@a = [1, 2]'],
        ['the trailing comment of an array literal of strings', '@a = ["x", "y"] # c'],
        ['the trailing comment of an empty array literal', '@a = [] # c'],
        ['the trailing comment of a hash literal', '@h = {a: 1} # c'],
        ['the comment before a hash literal', '# c\n@h = {a: 1}'],
        ['the trailing comment of a hash literal of 2 pairs', '@h = {a: 1, b: 2} # c'],
        ['the trailing comment of an operator assignment', 'a = 1\na += 1 # c'],
        ['the comment before an operator assignment', 'a = 1\n# c\na += 1'],
        ['the trailing comment of an assignment of an expression', '@a = @b + 1 # c'],
        ['the trailing comment of a value-only line', '"Jimmy" # c'],
        ['the comment before a value-only line', '# c\n"Jimmy"'],
        ['the trailing comment of an explicit return', 'def foo\n  return 1 # c\nend'],
        ['the comment before an explicit return', 'def foo\n  # c\n  return 1\nend'],
        ['the comment before a case', '# c\ncase @a\nwhen 1\n  move(10)\nend'],
        ['the comment before a when', 'case @a\n# c\nwhen 1\n  move(10)\nend'],
        [
            'the comment before a multi-line array literal',
            dedent`
                # c
                @a = [
                  1,
                  2
                ]
            `,
            '# c\n@a = [1, 2]',
        ],
        ['the comment before a def with return', 'def foo\n  return 1\nend\n\n# c\ndef bar\n  return 2\nend'],
        ['the trailing comment of a hash set', '@h = {}\n@h[:a] = 1 # c'],
        ['the trailing comment of a list item set', '@a = [1]\n@a[0] = 2 # c'],
        ['the trailing comment of a push', '@a = []\n@a.push(1) # c'],
        ['the trailing comment of a value of a method', 'def foo\n  1\nend\n\n@a = foo + 1 # c'],
        ['the comment before a value of a method', 'def foo\n  1\nend\n\n# c\n@a = foo + 1'],
        ['the trailing comment of an implicit return', 'def foo\n  1 # c\nend'],
        ['the trailing comment of a return of an expression', 'def foo\n  return @a + 1 # c\nend'],
        ['the trailing comment of a bare return', 'def foo\n  return # c\nend'],
        ['the trailing comment of a when', 'case @a\nwhen 1 # c\n  move(10)\nend'],
        ['the comment before the second when', 'case @a\nwhen 1\n  move(10)\n# c\nwhen 2\n  move(20)\nend'],
        ['the trailing comment of a case', 'case @a # c\nwhen 1\n  move(10)\nend'],
        ['the trailing comment of an assignment of a string', '@a = "x" # c'],
        ['the trailing comment of a value-only number', '1 # c'],
        ['the trailing comment of a value-only variable', '@a = 1\n\n@a # c'],
        ['the comment before a value-only number', 'move(10)\n# c\n1'],
        ['the comment before an implicit return', 'def foo\n  # c\n  1\nend'],
        ['the comment before a value-only variable', '@a = 1\n\n# c\n@a'],
        [
            'the trailing comment of an element of an array literal over more lines',
            '@a = [\n  1, # c\n  2\n]',
            '@a = [1, 2] # c',
        ],
        ['the trailing comment of a loop', 'loop do # c\n  move(10)\nend'],
        ['the trailing comment of the end of a loop', 'loop do\n  move(10)\nend # c'],
        ['the trailing comment of the end of an if', 'if @a > 1\n  move(10)\nend # c'],
        ['the trailing comment of the end of a case', 'case @a\nwhen 1\n  move(1)\nend # c'],
        ['the trailing comment of an if', 'if @a > 1 # c\n  move(10)\nend'],
        ['the trailing comment of a def', 'def foo # c\n  move(10)\nend'],
        ['the trailing comment of a def with return', 'def foo # c\n  return 1\nend'],
        ['the comment before a def with return value', '# c\ndef foo\n  1\nend'],
        ['the trailing comment of a value-only array', '[1, 2] # c'],
        ['the comment before a value-only array', '# c\n[1, 2]'],
        ['the trailing comment of a value-only float', '1.5 # c'],
        ['the trailing comment of a value-only expression', '@a = 1\n\n@a + 1 # c'],
        ['the trailing comment of a call over more lines', 'move(\n  10\n) # c', 'move(10) # c'],
        ['the trailing comment of an array literal in a script', 'when_flag_clicked do\n  @a = [1, 2] # c\nend'],
        ['the comment before an array literal in a script', 'when_flag_clicked do\n  # c\n  @a = [1, 2]\nend'],
        ['the trailing comment of a return in an if', 'def foo\n  if @a > 1\n    return 1 # c\n  end\n  2\nend'],
        ['the comment before a return in an if', 'def foo\n  if @a > 1\n    # c\n    return 1\n  end\n  2\nend'],
        ['the trailing comment of a local array literal', 'a = [1, 2] # c'],
        ['the trailing comment of a global hash literal', '$h = {a: 1} # c'],
        ['the trailing comment of an elsif', 'if @a > 1\n  move(1)\nelsif @a > 2 # c\n  move(2)\nend'],
        ['the comment before an elsif', 'if @a > 1\n  move(1)\n# c\nelsif @a > 2\n  move(2)\nelse\n  move(3)\nend'],
        [
            'the comment before the third when',
            'case @a\nwhen 1\n  move(1)\nwhen 2\n  move(2)\n# c\nwhen 3 # d\n  move(3)\nend',
        ],
    ])('%s', async (_name, code, expected = code) => {
        expect((await roundTrip(code)).ruby).toBe(expected);
    });
});

describe('Ruby Roundtrip: comments on the first and the last line of a block (issue #1864)', () => {
    test.each([
        ['the end of an if in a loop', 'loop do\n  if @a > 1\n    move(10)\n  end # c\nend'],
        ['the end of a loop in an if', 'if @a > 1\n  loop do\n    move(10)\n  end # c\n  move(1)\nend'],
        ['the end of times in a loop', 'loop do\n  3.times do\n    move(1)\n  end # c\nend'],
        ['the end of begin ... end while', 'begin\n  move(10)\nend while @a < 1 # c'],
        ['a modifier while', 'move(10) while @a < 1 # c', 'while @a < 1 # c\n  move(10)\nend'],
        ['the head of a while', 'while @a < 1 # c\n  move(1)\nend'],
        ['the head of times', '3.times do # c\n  move(1)\nend'],
        ['the end of a while', 'while @a < 1\n  move(1)\nend # c'],
        ['both lines of an if', 'if @a > 1 # a\n  move(1)\nend # b', '# a\nif @a > 1\n  move(1)\nend # b'],
        [
            'before, the head and the end of a case',
            '# a\ncase @a # b\nwhen 1\n  move(1)\nend # h',
            '# a\n# b\ncase @a\nwhen 1\n  move(1)\nend # h',
        ],
        ['the comment before a case of 2 whens', '# c\ncase @a\nwhen 1\n  move(1)\nwhen 2\n  move(2)\nend'],
        ['the head of a case of 2 whens', 'case @a # c\nwhen 1\n  move(1)\nwhen 2\n  move(2)\nend'],
        [
            'the comments of a case of 3 whens',
            '# a\ncase @a # b\nwhen 1\n  move(1)\n# c\nwhen 2 # d\n  move(2)\nwhen 3\n  move(3)\nend # e',
            '# a\n# b\ncase @a\nwhen 1\n  move(1)\n# c\nwhen 2 # d\n  move(2)\nwhen 3\n  move(3)\nend # e',
        ],
    ])('%s', async (_name, code, expected = code) => {
        const first = (await roundTrip(code)).ruby;
        expect(first).toBe(expected);
        expect((await roundTrip(first)).ruby).toBe(first);
    });
});

describe('Ruby to blocks: the block a comment goes to (issue #1864)', () => {
    /**
     * The opcode of the block whose comment has the text `c`.
     * @param {object} target - The target the converter wrote to.
     * @returns {Array<string>} The opcodes.
     */
    const commentedOpcodes = (target) =>
        Object.values(target.comments)
            .filter((comment) => comment.text.split('\n')[0] === 'c')
            .map((comment) => (comment.blockId ? target.blocks.getBlock(comment.blockId).opcode : null));

    test.each([
        ['an array literal', '@a = [1, 2] # c', 'data_deletealloflist'],
        ['a hash literal', '# c\n@h = {a: 1}', 'data_deletealloflist'],
        ['an operator assignment', 'a = 1\na += 1 # c', 'data_setvariableto'],
        ['a value-only line', '"Jimmy" # c', 'data_setvariableto'],
        ['an explicit return', 'def foo\n  return 1 # c\nend', 'data_setvariableto'],
        ['a def with return', '# c\ndef foo\n  return 1\nend', 'procedures_definition'],
        ['a case', '# c\ncase @a\nwhen 1\n  move(10)\nend', 'control_if'],
        ['a when', 'case @a\n# c\nwhen 1\n  move(10)\nend', 'operator_equals'],
        ['an elsif', 'if @a > 1\n  move(1)\nelsif @a > 2 # c\n  move(2)\nend', 'control_if'],
    ])('%s', async (_name, code, opcode) => {
        const { target } = await roundTrip(code);
        expect(commentedOpcodes(target)).toEqual([opcode]);
    });
});
