/**
 * A Smalruby method without parentheses in an expression (`x_position`,
 * `costume_number`) has the form of a variable in the Japanese mode, so going
 * back to Ruby put `@` on it (`@x_position`) and the program silently read a
 * variable instead (issue #1694). The Japanese mode cannot tell it from a
 * variable, so Ruby → DNCL stops on it with the unsupported command error.
 * Ruby's local variables (assigned, block and method parameters) and the
 * names the Japanese mode has (`answer`, `rand`, ...) are not taken.
 */
import { UNSUPPORTED_COMMAND_ERROR_ID } from '../../../../src/lib/dncl/dncl-validator';
import { rubyToDncl } from '../../../../src/lib/dncl/ruby-to-dncl';

const lines = (...ls) => ls.join('\n');

const rubyErrors = (ruby) =>
    rubyToDncl(ruby)
        .errors.filter((err) => err.id === UNSUPPORTED_COMMAND_ERROR_ID)
        .map(({ line, column, name }) => ({ line, column, name }));

describe('Ruby → DNCL: a method without parentheses in an expression (issue #1694)', () => {
    test('a method in an assignment', () => {
        expect(rubyErrors('@a = 1 + x_position')).toEqual([{ line: 1, column: 10, name: 'x_position' }]);
    });

    test('a method in an argument', () => {
        expect(rubyErrors('puts(costume_number)')).toEqual([{ line: 1, column: 6, name: 'costume_number' }]);
    });

    test('a method in a condition and with a method of its value', () => {
        expect(rubyErrors(lines('if direction > 90', '  puts(y_position.to_s)', 'end'))).toEqual([
            { line: 1, column: 4, name: 'direction' },
            { line: 2, column: 8, name: 'y_position' },
        ]);
    });

    test('a method in the bound or the step of a counting loop', () => {
        // The `while` and the increment are written in the header made from `@i = 1`.
        expect(
            rubyErrors(lines('@i = 1', 'while @i <= x_position', '  puts(@i)', '  @i += costume_number', 'end')),
        ).toEqual([
            { line: 2, column: 13, name: 'x_position' },
            { line: 4, column: 9, name: 'costume_number' },
        ]);
    });

    test('the error message points to the Ruby mode', () => {
        const [err] = rubyToDncl('@a = x_position').errors;
        expect(err.message).toContain('x_position');
        expect(err.message).toContain('Ruby モード');
    });

    test('a name alone on a line is told once', () => {
        expect(rubyErrors('bounce_if_on_edge')).toEqual([{ line: 1, column: 1, name: 'bounce_if_on_edge' }]);
    });

    test('a name in a string or a comment is not taken', () => {
        expect(rubyErrors(lines('puts("x_position")', '@a = 1 # x_position'))).toEqual([]);
    });
});

describe('Ruby → DNCL: names that stay as they are (issue #1694)', () => {
    test('a Ruby local variable', () => {
        expect(rubyErrors(lines('b = 2', '@a = 1 + b'))).toEqual([]);
    });

    test('Ruby local variables assigned together', () => {
        expect(rubyErrors(lines('a, b = 1, 2', 'puts(a + b)'))).toEqual([]);
    });

    test('a method parameter', () => {
        expect(rubyErrors(lines('def f(x)', '  return x * 2', 'end', '@a = f(3)'))).toEqual([]);
    });

    test('a block parameter', () => {
        const errors = rubyErrors(lines('(1..3).step(1) do |i|', '  puts(i)', 'end'));
        expect(errors).toEqual([]);
    });

    test('a defined function called without parentheses', () => {
        expect(rubyErrors(lines('def greet', '  puts("hi")', 'end', '@a = greet'))).toEqual([]);
    });

    test('answer, rand and the built-in functions', () => {
        expect(
            rubyErrors(
                lines(
                    'ask("")',
                    '@a = answer',
                    '@b = rand(1..6)',
                    '@c = @a.to_i + @b.length',
                    'puts(true && !false)',
                ),
            ),
        ).toEqual([]);
    });

    test('instance and global variables, constants and keywords', () => {
        expect(
            rubyErrors(lines('@a = $b + @_var_c_ + Math.sqrt(4)', 'if @a > 1 and not @a == 2', '  @a = nil', 'end')),
        ).toEqual([]);
    });

    test('wait until', () => {
        expect(rubyErrors(lines('@a = 1', 'wait until @a > 0'))).toEqual([]);
    });
});
