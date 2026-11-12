/**
 * Ruby → Blocks must not leave a block that is attached to nothing (#1522).
 *
 * Such a block is not drawn on the workspace and is never turned back into Ruby, but it is
 * saved in the project. It used to come from:
 * - a local variable assignment (`a = false`): the value was converted twice (once while
 *   looking for a `a=` writer method), and the first result was left behind
 *   (`0 < 0` with an extra `@ruby:literal:false:N` comment);
 * - `wait` removed from a loop / `wait until`: its `text` block kept pointing at it;
 * - `case x`: the subject was converted once more than the number of `when`s.
 *
 * or from an argument that was converted but only read as a value (a field, or which opcode to
 * use), and never put into an input (#1534):
 * - `self.drag_mode = true` / `smalrubot_s1.led("left", false)`: the `1 = 1` / `0 < 0` block;
 * - `ticket.reverse!`: the receiver's `data_variable` block (and its `@ruby:lvar` comment);
 * - `"a".reverse` as a statement / `if "a".reverse`: the `returnValue` reporter;
 * - `koshien.map_from("0:0", m)`: the `data_variable` was deleted but not its comment;
 * - `microbit_v1.when_pin_connected(0)`: a second `touchPins` menu that the hat did not refer to;
 * - a method that ends with `true`: the literal was replaced by a `"true"` text;
 * - a nested call of a method with a return value: the evacuation's variable had no parent.
 *
 * or from a statement that cannot be placed in a block body (#1544), which is now an error:
 * - an event (hat) inside `do ... end` / `if` / `def`: it and its body were lost;
 * - a value written as a line by itself (`x`, `1 + 2`) after another statement in a block body;
 * - a method definition (`def`) in a block body or a method body, on any line (#1554).
 */
import dedent from 'dedent';

import {
    makeConverter,
    makeSpriteTarget,
    rubyToBlocksToRuby,
    setupRubyGenerator,
} from '../../helpers/ruby-roundtrip-helper';

/**
 * Describe the blocks and comments that are attached to nothing.
 * @param {object} blocks - Blocks by ID.
 * @param {object} comments - Comments by ID.
 * @returns {string[]} One line per problem (empty when there is none).
 */
const findOrphans = (blocks, comments) => {
    const problems = [];
    Object.values(blocks).forEach((b) => {
        if (b.parent && !blocks[b.parent]) {
            problems.push(`${b.opcode}: parent ${b.parent} does not exist`);
        } else if (!b.topLevel && !b.parent) {
            problems.push(`${b.opcode}: no parent and not top level`);
        } else if (b.parent) {
            const parent = blocks[b.parent];
            const referred =
                parent.next === b.id ||
                Object.values(parent.inputs).some((i) => i.block === b.id || i.shadow === b.id);
            if (!referred) problems.push(`${b.opcode}: ${parent.opcode} does not refer to it`);
        }
    });
    Object.values(comments).forEach((c) => {
        if (c.blockId && !blocks[c.blockId]) {
            problems.push(`comment "${c.text}": block ${c.blockId} does not exist`);
        }
    });
    return problems;
};

const convert = async (code) => {
    const { target, runtime } = makeSpriteTarget();
    const converter = makeConverter(target, runtime, { version: '2' });
    const ruby = await rubyToBlocksToRuby(converter, target, code);
    return { converter, target, ruby };
};

const commentTexts = (converter) => Object.values(converter._context.comments).map((c) => c.text);

describe('RubyToBlocksConverter: no orphan blocks', () => {
    beforeEach(() => {
        setupRubyGenerator();
    });

    test.each([
        ['local variable = false', 'a = false'],
        ['local variable = true', 'a = true'],
        ['local variable = comparison', 'a = 1 < 2'],
        ['local variable = reporter', 'a = x'],
        ['local variable = nested reporters', 'a = (x + 1) * 2'],
        ['local variable = string method', 'a = "abc".length'],
        ['local variable read after assignment', 'a = false\nb = a'],
        ['global variable = false', '$g = false'],
        ['instance variable = false', '@i = false'],
        ['local variable op-assign', 'a = 1\na += x'],
        ['wait until', 'wait until x > 10'],
        [
            'wait in loop',
            dedent`
                loop do
                  move(10)
                  wait
                end
            `,
        ],
        [
            'wait in repeat',
            dedent`
                repeat(3) do
                  move(10)
                  wait
                end
            `,
        ],
        [
            'case',
            dedent`
                case x
                when 1
                  move(10)
                when 2
                  move(20)
                else
                  move(30)
                end
            `,
        ],
        [
            'case with a local variable',
            dedent`
                a = 1
                case a
                when 1
                  move(10)
                end
            `,
        ],
    ])('%s', async (_name, code) => {
        const { converter, target } = await convert(code);
        expect(findOrphans(converter._context.blocks, converter._context.comments)).toEqual([]);
        expect(findOrphans(target.blocks._blocks, target.comments)).toEqual([]);
    });

    test.each([
        ['a = false', '@ruby:literal:false:'],
        ['a = true', '@ruby:literal:true:'],
        ['$g = false', '@ruby:literal:false:'],
    ])('%s leaves exactly one literal comment', async (code, prefix) => {
        const { converter } = await convert(code);
        const literalComments = commentTexts(converter).filter((t) => t.startsWith(prefix));
        expect(literalComments).toEqual([`${prefix}1`]);
    });

    test('a case leaves one case comment per when and on the if blocks only', async () => {
        const { converter } = await convert(dedent`
            case x
            when 1
              move(10)
            end
        `);
        const caseComments = commentTexts(converter).filter((t) => t.startsWith('@ruby:syntax:case:'));
        // one on the `if` block, one on its `=` condition
        expect(caseComments).toHaveLength(2);
    });

    test('wait until has no SUBSTACK input', async () => {
        const { converter } = await convert('wait until x > 10');
        const [block] = Object.values(converter._context.blocks).filter(
            (b) => b.opcode === 'control_wait_until',
        );
        expect(Object.keys(block.inputs)).toEqual(['CONDITION']);
    });

    test('a local variable set from an argument that is later used as a boolean', async () => {
        // The first visit of `x` (looking for an `a=` writer) registered its argument block;
        // dropping that block must also drop its ID, or making `x` boolean reads undefined.
        const code = dedent`
            def foo(x)
              a = x
              if x
                move(10)
              end
            end
        `;
        const { converter, target, ruby } = await convert(code);
        expect(ruby).toBe(code);
        expect(findOrphans(converter._context.blocks, converter._context.comments)).toEqual([]);
        expect(findOrphans(target.blocks._blocks, target.comments)).toEqual([]);
    });

    describe('an argument used only as a value', () => {
        test.each([
            ['drag mode = true', 'self.drag_mode = true', 'self.drag_mode = "draggable"'],
            ['drag mode = false', 'self.drag_mode = false', 'self.drag_mode = "not draggable"'],
            [
                'reverse! of a list',
                'ticket = [12, 47, 35]\nticket.reverse!',
                null,
            ],
            ['reverse! of a string', 's = "hello"\ns.reverse!', null],
            ['sort! of a list', 't = [3, 1, 2]\nt.sort!', null],
            [
                'string method as a statement',
                dedent`
                    when_flag_clicked do
                      "a".reverse
                      "b".upcase
                    end
                `,
                null,
            ],
            [
                'string method as a statement between other statements',
                dedent`
                    when_flag_clicked do
                      move(10)
                      "a".reverse
                      move(20)
                    end
                `,
                null,
            ],
            [
                'string method as a condition',
                dedent`
                    when_flag_clicked do
                      if "hello".reverse
                        say("truthy", 2)
                      end
                    end
                `,
                null,
            ],
            [
                'string method as an unless condition',
                dedent`
                    when_flag_clicked do
                      unless "hello".reverse
                        say("falsy", 2)
                      end
                    end
                `,
                null,
            ],
            [
                'micro:bit pin connected',
                dedent`
                    microbit_v1.when_pin_connected(0) do
                    end

                    microbit_v1.when_pin_connected(2) do
                    end
                `,
                null,
            ],
            [
                'koshien map_from with a local variable',
                'm = "x"\n$map = koshien.map_from("14:0", m)',
                null,
            ],
            ['smalrubot LED on', 'smalrubot_s1.led("left", true)', null],
            ['smalrubot LED off', 'smalrubot_s1.led("right", false)', null],
            [
                'method ending with true',
                dedent`
                    def is_true
                      true
                    end

                    say(is_true, 1)
                `,
                null,
            ],
            [
                'nested calls of a method with a return value',
                dedent`
                    def add(a, b)
                      a + b
                    end

                    when_flag_clicked do
                      say(add(add(1, 5), add(2, 3)))
                    end
                `,
                null,
            ],
        ])('%s', async (_name, code, expected) => {
            const { converter, target, ruby } = await convert(code);
            expect(findOrphans(converter._context.blocks, converter._context.comments)).toEqual([]);
            expect(findOrphans(target.blocks._blocks, target.comments)).toEqual([]);
            expect(ruby).toBe(expected === null ? code : expected);
        });

        test('self.drag_mode = true leaves no literal comment', async () => {
            const { converter } = await convert('self.drag_mode = true\na = true');
            const literalComments = commentTexts(converter).filter((t) =>
                t.startsWith('@ruby:literal:true:'),
            );
            // the dropped literal gives its number back to the next one
            expect(literalComments).toEqual(['@ruby:literal:true:1']);
        });
    });

    describe('a statement that cannot be placed in a block body is an error, not dropped', () => {
        const convertWithErrors = async (code) => {
            const { target, runtime } = makeSpriteTarget();
            const converter = makeConverter(target, runtime, { version: '2' });
            const result = await converter.targetCodeToBlocks(target, code);
            return { converter, result };
        };

        test.each([
            [
                'an event after a statement',
                dedent`
                    when_flag_clicked do
                      move(10)
                      when_clicked do
                        move(5)
                      end
                    end
                `,
                2,
                /"when_clicked do" is an event/,
            ],
            [
                'an event as the first statement',
                dedent`
                    when_flag_clicked do
                      when_clicked do
                        move(5)
                      end
                    end
                `,
                1,
                /"when_clicked do" is an event/,
            ],
            [
                'an event in an if',
                dedent`
                    when_flag_clicked do
                      if x > 0
                        when_key_pressed("space") do
                        end
                      end
                    end
                `,
                2,
                /"when_key_pressed\("space"\) do" is an event/,
            ],
            [
                'an event in a loop',
                dedent`
                    loop do
                      move(10)
                      when_clicked do
                      end
                    end
                `,
                2,
                /is an event/,
            ],
            [
                'an event in a method',
                dedent`
                    def foo
                      move(10)
                      when_clicked do
                        move(5)
                      end
                    end
                `,
                2,
                /is an event/,
            ],
            [
                'an event in a class',
                dedent`
                    class Sprite1
                      when_flag_clicked do
                        move(1)
                        when_clicked do
                        end
                      end
                    end
                `,
                3,
                /is an event/,
            ],
            [
                'a variable after a statement',
                dedent`
                    when_flag_clicked do
                      move(10)
                      x
                    end
                `,
                2,
                /"x" is a value[^]*say\(x\)/,
            ],
            [
                'a calculation after a statement',
                dedent`
                    when_flag_clicked do
                      move(10)
                      1 + 2
                    end
                `,
                2,
                /"1 \+ 2" is a value/,
            ],
            ['a variable as the first statement', 'when_flag_clicked do\n  x\nend', 1, /"x" is a value/],
            [
                'a value in an if in a method',
                dedent`
                    def f(x)
                      if x > 0
                        move(1)
                        x
                      end
                    end
                `,
                3,
                /"x" is a value/,
            ],
            // #1549: a value on a line before the last one in a method shows its source, not "undefined".
            ['a variable in a method', 'def foo\n  x\n  move(10)\nend', 1, /^"x" is a value[^]*say\(x\)/],
            [
                'a calculation in a method',
                dedent`
                    def foo
                      move(5)
                      1 + 2
                      move(10)
                    end
                `,
                2,
                /^"1 \+ 2" is a value/,
            ],
            ['a string in a method', 'def foo\n  "a"\n  move(10)\nend', 1, /^""a"" is a value/],
            [
                'a calculation over two lines in a method',
                'def foo\n  1 +\n    2\n  move(10)\nend',
                1,
                /^"1 \+ 2" is a value[^]*say\(1 \+ 2\)/,
            ],
            // #1550: a symbol is not a command, wherever it is written (it was dropped silently after a statement).
            ['a symbol in an event', 'when_flag_clicked do\n  :a\nend', 1, /^":a" is not a command[^]*move\(10\)/],
            [
                'a symbol after a statement',
                dedent`
                    when_flag_clicked do
                      move(10)
                      :a
                      move(5)
                    end
                `,
                2,
                /^":a" is not a command/,
            ],
            [
                'a symbol in the else of an if',
                dedent`
                    when_flag_clicked do
                      if x > 1
                        move(1)
                      else
                        :b
                      end
                    end
                `,
                4,
                /^":b" is not a command/,
            ],
            [
                'a symbol after a statement in an if in a method',
                dedent`
                    def foo
                      if x > 1
                        move(1)
                        :a
                      end
                    end
                `,
                3,
                /^":a" is not a command/,
            ],
            ['a symbol in a method', 'def foo\n  :a\n  move(10)\nend', 1, /^":a" is not a command/],
        ])('%s', async (_name, code, row, text) => {
            const { converter, result } = await convertWithErrors(code);
            expect(result).toBe(false);
            expect(converter.errors).toHaveLength(1);
            expect(converter.errors[0].row).toBe(row);
            expect(converter.errors[0].text).toMatch(text);
        });

        test.each([
            [
                'an event at the top level',
                dedent`
                    when_flag_clicked do
                      move(10)
                    end

                    when_clicked do
                      move(5)
                    end
                `,
            ],
            [
                'the return value of a method',
                dedent`
                    def add(a, b)
                      a + b
                    end

                    say(add(1, 2))
                `,
            ],
            ['a value at the top level', 'x'],
        ])('%s is still converted', async (_name, code) => {
            const { converter, target, ruby } = await convert(code);
            expect(ruby).toBe(code);
            expect(findOrphans(converter._context.blocks, converter._context.comments)).toEqual([]);
            expect(findOrphans(target.blocks._blocks, target.comments)).toEqual([]);
        });

        // A method definition in a block body is an error on any line (#1554): it used to be an error
        // on the first line but a script of its own on the second or a later line.
        const defInsideBlock = /^"def my_proc" defines a method, so it cannot be written inside a block/;
        test.each([
            [
                'on the first line of an event',
                'when_flag_clicked do\n  def my_proc\n    move(1)\n  end\nend',
                1,
            ],
            [
                'after a statement in an event',
                'when_flag_clicked do\n  move(10)\n  def my_proc\n    move(1)\n  end\nend',
                2,
            ],
            ['on the first line of a loop', 'loop do\n  def my_proc\n  end\n  move(10)\nend', 1],
            ['after a statement in a loop', 'loop do\n  move(10)\n  def my_proc\n  end\nend', 2],
            ['in an if', 'if x > 1\n  move(10)\n  def my_proc\n  end\nend', 2],
            ['in an else', 'if x > 1\n  move(10)\nelse\n  def my_proc\n  end\nend', 3],
            ['in a method', 'def foo\n  move(10)\n  def my_proc\n  end\nend', 2],
            ['as the last line of a method', 'def foo\n  def my_proc\n  end\nend', 1],
            [
                'in an event of a class',
                dedent`
                    class Sprite1
                      when_flag_clicked do
                        move(10)
                        def my_proc
                        end
                      end
                    end
                `,
                3,
            ],
            [
                'in a method of a class',
                dedent`
                    class Sprite1
                      def foo
                        move(10)
                        def my_proc
                        end
                      end
                    end
                `,
                3,
            ],
            [
                'in a method of a module',
                dedent`
                    module Utils
                      def foo
                        move(10)
                        def my_proc
                        end
                      end
                    end

                    class Sprite1
                      include Utils
                    end
                `,
                3,
            ],
        ])('a method definition %s is an error', async (_name, code, row) => {
            const { converter, result } = await convertWithErrors(code);
            expect(result).toBe(false);
            expect(converter.errors).toHaveLength(1);
            expect(converter.errors[0].row).toBe(row);
            expect(converter.errors[0].text).toMatch(defInsideBlock);
            expect(converter.errors[0].text).toMatch(/Move the whole method, from "def my_proc" to its "end"/);
        });

        test('methods, initialize and events directly in a class are still converted', async () => {
            const code = dedent`
                class Sprite1
                  def initialize
                    @score = 0
                  end

                  def my_proc
                    move(1)
                  end

                  when_flag_clicked do
                    my_proc
                  end
                end
            `;
            const { converter, result } = await convertWithErrors(code);
            expect(converter.errors).toEqual([]);
            expect(result).toBe(true);
        });

        test('methods directly in a module are still converted', async () => {
            const code = dedent`
                module Utils
                  def my_proc
                    move(1)
                  end
                end

                class Sprite1
                  include Utils

                  when_flag_clicked do
                    my_proc
                  end
                end
            `;
            const { converter, result } = await convertWithErrors(code);
            expect(converter.errors).toEqual([]);
            expect(result).toBe(true);
        });
    });

    describe('Ruby → Blocks → Ruby is unchanged', () => {
        test.each([
            'a = false',
            'a = true',
            'a = 1 < 2',
            'a = x',
            'a = false\nb = a',
            '$g = false',
            '@i = false',
            'wait until x > 10',
            dedent`
                loop do
                  move(10)
                  wait
                end
            `,
            dedent`
                case x
                when 1
                  move(10)
                else
                  move(30)
                end
            `,
        ])('%s', async (code) => {
            const { ruby } = await convert(code);
            expect(ruby).toBe(code);
        });
    });
});
