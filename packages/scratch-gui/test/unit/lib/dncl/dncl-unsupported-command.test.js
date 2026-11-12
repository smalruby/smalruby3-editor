/**
 * Ruby commands and method calls that have no form in the Japanese mode
 * (issue #1679). Converting such DNCL to Ruby once put `@` on them
 * (`@move(2)`, `@with_screen_refresh do`, `|@x|`), which is broken Ruby.
 * Now they stop with an error on their line, and the calls the Japanese mode
 * has (the built-in functions and the functions the program defines) still
 * go back and forth.
 */
import { dnclToRuby, rubyForLeavingDncl } from '../../../../src/lib/dncl/dncl-to-ruby';
import {
    isRubyCommandName,
    UNSUPPORTED_COMMAND_ERROR_ID,
    validateDncl,
} from '../../../../src/lib/dncl/dncl-validator';
import { rubyToDncl } from '../../../../src/lib/dncl/ruby-to-dncl';

const lines = (...ls) => ls.join('\n');

const roundtrip = (dncl) => {
    const { ruby, errors } = dnclToRuby(dncl);
    expect(errors).toEqual([]);
    return rubyToDncl(ruby).dncl;
};

const commandErrors = (dncl) =>
    dnclToRuby(dncl)
        .errors.filter((err) => err.id === UNSUPPORTED_COMMAND_ERROR_ID)
        .map(({ line, column, name }) => ({ line, column, name }));

describe('DNCL → Ruby → DNCL: calls the Japanese mode has (issue #1679)', () => {
    test('a call of a defined function with arguments', () => {
        const dncl = lines('関数 足す1(a)', '  返す a + 1', 'と定義する', 'b = 足す1(2)');
        expect(roundtrip(dncl)).toBe(dncl);
        expect(dnclToRuby(dncl).ruby).toContain('@b = 足す1(2)');
    });

    test('a call of a defined function without arguments', () => {
        const dncl = lines('関数 あいさつ()', '  表示する("こんにちは")', 'と定義する', 'あいさつ()');
        expect(roundtrip(dncl)).toBe(dncl);
        expect(dnclToRuby(dncl).ruby.split('\n')[3]).toBe('あいさつ()');
    });

    test('a call of a defined function without parentheses', () => {
        const dncl = lines('関数 greet()', '  表示する("hi")', 'と定義する', 'greet');
        expect(roundtrip(dncl)).toBe(dncl);
        expect(dnclToRuby(dncl).ruby.split('\n')[3]).toBe('greet');
    });

    test('a variable with the name of a command', () => {
        const dncl = lines('move = 1', '表示する(move)');
        expect(roundtrip(dncl)).toBe(dncl);
        expect(dnclToRuby(dncl).ruby).toBe(lines('@move = 1', 'puts(@move)'));
    });

    test('calls in an expression', () => {
        const dncl = lines('関数 f(a)', '  返す a * 2', 'と定義する', 'b = 1 + f(2) * 要素数(Kazu) + 整数(x)');
        expect(roundtrip(dncl)).toBe(dncl);
        expect(commandErrors(dncl)).toEqual([]);
    });

    test('a name with ( in a string or a comment is not a command', () => {
        const dncl = lines('表示する("move(2)")', 'a = 1 # move(2)', '表示する(「step()」)');
        expect(commandErrors(dncl)).toEqual([]);
    });
});

describe('DNCL → Ruby: a command the Japanese mode does not have stops with an error (issue #1679)', () => {
    test('a command with arguments', () => {
        const result = dnclToRuby('move(2)');
        expect(result.ruby).toBeNull();
        expect(commandErrors('move(2)')).toEqual([{ line: 1, column: 1, name: 'move' }]);
        expect(result.errors[0].message).toContain('move');
    });

    test('a command without arguments', () => {
        expect(commandErrors(lines('a = 1', '  bounce_if_on_edge'))).toEqual([
            { line: 2, column: 3, name: 'bounce_if_on_edge' },
        ]);
    });

    test('a command with the name of a variable', () => {
        expect(commandErrors(lines('move = 1', 'move(move)'))).toEqual([{ line: 2, column: 1, name: 'move' }]);
    });

    test('a command in an expression', () => {
        expect(commandErrors('a = 1 + distance("_mouse_") * 2')).toEqual([{ line: 1, column: 9, name: 'distance' }]);
    });

    test('a command in a condition', () => {
        expect(commandErrors(lines('もし touching("_edge_") ならば', '  a = 1', 'を実行する'))).toEqual([
            { line: 1, column: 4, name: 'touching' },
        ]);
    });

    test('a predicate or bang method keeps its ? / !', () => {
        expect(commandErrors(lines('もし key_pressed?("space") ならば', '  stop!()', 'を実行する'))).toEqual([
            { line: 1, column: 4, name: 'key_pressed?' },
            { line: 2, column: 3, name: 'stop!' },
        ]);
        expect(commandErrors('stop!')).toEqual([{ line: 1, column: 1, name: 'stop!' }]);
        expect(dnclToRuby('表示する(touching?("_mouse_"))').ruby).toBeNull();
    });

    test('the examples of the issue: a do block, a command in it and a block parameter', () => {
        const dncl = lines(
            'with_screen_refresh do',
            '  move(2)',
            'を実行する',
            '[1, 2].each do |x|',
            '  表示する(x)',
            'を実行する',
        );
        const result = dnclToRuby(dncl);
        expect(result.ruby).toBeNull();
        expect(commandErrors(dncl)).toEqual([
            { line: 1, column: 1, name: 'with_screen_refresh' },
            { line: 2, column: 3, name: 'move' },
            { line: 4, column: 8, name: 'each' },
        ]);
    });

    test('a do block whose command has arguments is told once', () => {
        expect(commandErrors(lines('when_key_pressed("space") do', 'を実行する'))).toEqual([
            { line: 1, column: 1, name: 'when_key_pressed' },
        ]);
    });

    test('a Ruby name points to the Ruby mode', () => {
        expect(dnclToRuby('move(2)').errors[0].message).toBe(
            '「move」は日本語モードでは書けない命令です。Ruby モードでは書けます。',
        );
    });

    test('a Japanese name asks to define the function', () => {
        const result = dnclToRuby('a = 差分(1, 2)');
        expect(result.ruby).toBeNull();
        expect(result.errors[0]).toMatchObject({ id: UNSUPPORTED_COMMAND_ERROR_ID, name: '差分' });
        expect(result.errors[0].message).toBe(
            '「差分」は定義されていない関数です。「関数 差分(…)」で定義してください。',
        );
    });

    test('isRubyCommandName tells a Ruby name from a Japanese one', () => {
        expect(['move', 'key_pressed?', '_x', 'Move'].map(isRubyCommandName)).toEqual([true, true, true, true]);
        expect(['差分', 'あいさつ', 'カウント'].map(isRubyCommandName)).toEqual([false, false, false]);
    });

    test('validateDncl tells it too', () => {
        expect(validateDncl('move(2)').map((err) => err.id)).toEqual([UNSUPPORTED_COMMAND_ERROR_ID]);
    });

    test('leaving the Japanese mode keeps the last Ruby', () => {
        expect(rubyForLeavingDncl('move(2)', 'move(2)')).toBe('move(2)');
    });

    test('a DNCLv2 line number does not hide the command', () => {
        expect(commandErrors(lines('(01) a ← 1', '(02) move(a)'))).toEqual([{ line: 2, column: 1, name: 'move' }]);
    });
});

describe('Ruby → DNCL: a command the Japanese mode does not have is told on its Ruby line (issue #1679)', () => {
    const rubyErrors = (ruby) =>
        rubyToDncl(ruby)
            .errors.filter((err) => err.id === UNSUPPORTED_COMMAND_ERROR_ID)
            .map(({ line, column, name }) => ({ line, column, name }));

    test('a command with and without arguments', () => {
        expect(rubyErrors(lines('@a = 1', 'move(@a)', 'bounce_if_on_edge'))).toEqual([
            { line: 2, column: 1, name: 'move' },
            { line: 3, column: 1, name: 'bounce_if_on_edge' },
        ]);
    });

    test('a do block and the command in it', () => {
        expect(rubyErrors(lines('while @a < 1', '  with_screen_refresh do', '    move(2)', '  end', 'end'))).toEqual([
            { line: 2, column: 3, name: 'with_screen_refresh' },
            { line: 3, column: 5, name: 'move' },
        ]);
    });

    test('the line after a counting loop that became one DNCL line', () => {
        expect(rubyErrors(lines('@i = 1', 'while @i <= 3', '  turn_right(@i)', '  @i += 1', 'end'))).toEqual([
            { line: 3, column: 3, name: 'turn_right' },
        ]);
    });

    test('a predicate method is told on its column', () => {
        expect(rubyErrors(lines('if key_pressed?("space")', '  puts(1)', 'end'))).toEqual([
            { line: 1, column: 4, name: 'key_pressed?' },
        ]);
    });

    test('code the Japanese mode has has no error', () => {
        expect(rubyToDncl(lines('@x = 10', 'say("hello", 1)', 'puts(rand(1..6))')).errors).toEqual([]);
    });
});

describe('a name alone on a line (issue #1679)', () => {
    test('a declared or uppercase variable alone is not a command', () => {
        expect(
            commandErrors(lines('a ← 1', 'a', 'NG', 'i を 0 から 2 まで 1 ずつ増やしながら', '  i', 'を繰り返す')),
        ).toEqual([]);
    });

    test('a function parameter alone is not a command', () => {
        expect(commandErrors(lines('関数 f(x)', '  x', 'と定義する'))).toEqual([]);
    });
});
