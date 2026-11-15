// === Smalruby: This file is Smalruby-specific (multiple assignment, issue #1814) ===
/**
 * The blocks have no multiple assignment. `b, c = 1, 2` (values that are literals, as many as the
 * variables) is the same as `b = 1` then `c = 2`, so it becomes those blocks. Any other form (e.g.
 * the swap `a, b = b, a`, which is not the same as `a = b` then `b = a`) is the error of a wrong
 * instruction on its line, not an internal error ("invalid block: undefined"), and a statement
 * in a block body is not dropped silently.
 */
import dedent from 'dedent';
import { dnclToRuby } from '../../../../src/lib/dncl/dncl-to-ruby';
import {
    makeSpriteTarget,
    makeConverter,
    setupRubyGenerator,
    expectRoundTrip,
} from '../../helpers/ruby-roundtrip-helper';

const wrongInstruction = (source) =>
    `"${source}" is the wrong instruction.\nCheck the spelling or use a supported block.`;

describe('Ruby to blocks: multiple assignment (issue #1814)', () => {
    let target, runtime, converter;

    beforeEach(() => {
        ({ target, runtime } = makeSpriteTarget());
        setupRubyGenerator();
        converter = makeConverter(target, runtime, { version: '2' });
    });

    describe('literals, as many as the variables, become one assignment for each', () => {
        test.each([
            ['local variables', 'b, c = 1, 2\nsay(b + c)', 'b = 1\nc = 2\nsay(b + c)'],
            ['instance variables', '@b, @c = 1, "a"', '@b = 1\n@c = "a"'],
            ['global variables', '$b, $c = 1.5, -2', '$b = 1.5\n$c = -2'],
            ['true / false', '@b, @c = true, false', '@b = true\n@c = false'],
            ['three variables', '@a, @b, @c = 1, 2, 3', '@a = 1\n@b = 2\n@c = 3'],
            ['between other statements', 'move(10)\n@b, @c = 1, 2\nmove(20)', 'move(10)\n@b = 1\n@c = 2\nmove(20)'],
            [
                'in an event',
                dedent`
                    when_flag_clicked do
                      @b, @c = 1, 2
                      move(@b)
                    end
                `,
                dedent`
                    when_flag_clicked do
                      @b = 1
                      @c = 2
                      move(@b)
                    end
                `,
            ],
            [
                'in a loop (what DNCL writes for `i, j = 5, 0`)',
                dedent`
                    @i = 1
                    while @i <= 10
                      @i, @j = 5, 0
                      @i += 1
                    end
                `,
                dedent`
                    @i = 1
                    while @i <= 10
                      @i = 5
                      @j = 0
                      @i += 1
                    end
                `,
            ],
        ])('%s', async (_name, code, expected) => {
            await expectRoundTrip(converter, target, code, expected);
        });

        test('the variables are known as numbers and strings, as with one assignment', async () => {
            // `@a.length` is the length of the string (issue #1613), not of a list.
            await expectRoundTrip(
                converter,
                target,
                'when_flag_clicked do\n  say(@a.length)\nend\n\n@a, @b = "abc", 1',
                'when_flag_clicked do\n  say(@a.length)\nend\n\n@a = "abc"\n@b = 1',
            );
        });
    });

    describe('any other form is the error of a wrong instruction on its line', () => {
        test.each([
            ['a swap', 'a, b = b, a'],
            ['a value that is a variable', '@a, @b = @c, 1'],
            ['a value that is a call', '@a, @b = gets, 1'],
            ['a value that is an expression', '@a, @b = 1 + 2, 3'],
            ['fewer values', '@a, @b = 1'],
            ['more values', '@a, @b = 1, 2, 3'],
            ['an array', '@a, @b = [1, 2]'],
            ['a splat on the left', '@a, *@b = 1, 2'],
            ['a splat on the right', '@a, @b = *@c'],
            ['an element of a list', '@a[0], @b = 1, 2'],
            ['nested variables', '(@a, @b), @c = 1, 2'],
            ['a string with #{}', '@a, @b = "#{@c}", 1'],
        ])('%s', async (_name, code) => {
            const result = await converter.targetCodeToBlocks(target, `move(10)\n${code}`);
            expect(result).toBe(false);
            expect(converter.errors).toHaveLength(1);
            expect(converter.errors[0].row).toBe(1);
            expect(converter.errors[0].text).toBe(wrongInstruction(code));
        });

        test('in an event, the statement is not dropped', async () => {
            const code = 'when_flag_clicked do\n  move(10)\n  a, b = b, a\nend';
            const result = await converter.targetCodeToBlocks(target, code);
            expect(result).toBe(false);
            expect(converter.errors).toHaveLength(1);
            expect(converter.errors[0].row).toBe(2);
            expect(converter.errors[0].text).toBe(wrongInstruction('a, b = b, a'));
        });
    });

    describe('DNCL', () => {
        test('`i, j = 5, 0` becomes blocks', async () => {
            const ruby = dnclToRuby('i, j = 5, 0\n表示する(i + j)').ruby;
            expect(ruby).toBe('@i, @j = 5, 0\nputs(@i + @j)');
            await expectRoundTrip(converter, target, ruby, '@i = 5\n@j = 0\nputs(@i + @j)');
        });

        test('the swap `a, b = b, a` is the error of a wrong instruction', async () => {
            const ruby = dnclToRuby('a, b = b, a').ruby;
            const result = await converter.targetCodeToBlocks(target, ruby);
            expect(result).toBe(false);
            expect(converter.errors.map((e) => e.text)).toEqual([wrongInstruction('@a, @b = @b, @a')]);
        });
    });
});

describe('Ruby to blocks: a statement that has no block (issue #1814)', () => {
    let target, runtime, converter;

    beforeEach(() => {
        ({ target, runtime } = makeSpriteTarget());
        converter = makeConverter(target, runtime, { version: '2' });
    });

    test.each([
        ['alias', 'alias foo bar'],
        ['undef', 'undef foo'],
        ['for', 'for i in 1..3\n  move(10)\nend'],
        ['BEGIN', 'BEGIN { move(10) }'],
        ['END', 'END { move(10) }'],
    ])('%s is the error of a wrong instruction on its line', async (_name, code) => {
        const result = await converter.targetCodeToBlocks(target, `move(10)\n${code}`);
        expect(result).toBe(false);
        expect(converter.errors).toHaveLength(1);
        expect(converter.errors[0].row).toBe(1);
        expect(converter.errors[0].text).toMatch(/is the wrong instruction/);
    });

    // These were dropped silently, and the rest of the code was converted.
    test.each([
        ['`x ||= 1` in an event', 'when_flag_clicked do\n  x ||= 1\n  move(x)\nend', 'x ||= 1'],
        ['`x ||= 1` in a method', 'def a\n  x ||= 1\nend', 'x ||= 1'],
        ['`@a &&= 1` in an event', 'when_flag_clicked do\n  @a &&= 1\nend', '@a &&= 1'],
        ['`@a[0] += 1` in an event', 'when_flag_clicked do\n  @a[0] += 1\nend', '@a[0] += 1'],
        ['`yield` in a method', 'def a\n  yield\nend', 'yield'],
        ['`FOO = 1` in an event', 'when_flag_clicked do\n  FOO = 1\nend', 'FOO = 1'],
    ])('%s is the error of a wrong instruction, not dropped', async (_name, code, source) => {
        const result = await converter.targetCodeToBlocks(target, code);
        expect(result).toBe(false);
        expect(converter.errors.map((e) => [e.row, e.text])).toEqual([[1, wrongInstruction(source)]]);
    });

    test('in an event, it is not dropped', async () => {
        const code = 'when_flag_clicked do\n  move(10)\n  alias foo bar\nend';
        const result = await converter.targetCodeToBlocks(target, code);
        expect(result).toBe(false);
        expect(converter.errors.map((e) => [e.row, e.text])).toEqual([[2, wrongInstruction('alias foo bar')]]);
    });

    test('directly in a class, it is the error of a statement that cannot be there', async () => {
        const code = 'class Sprite1\n  alias foo bar\nend';
        const result = await converter.targetCodeToBlocks(target, code);
        expect(result).toBe(false);
        expect(converter.errors.map((e) => [e.row, e.text])).toEqual([
            [
                1,
                '"alias foo bar" cannot be placed directly inside a class definition.\n' +
                    'Use it inside an event block (e.g. when_flag_clicked) or a method definition (def).',
            ],
        ]);
    });
});
