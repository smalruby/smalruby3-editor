/**
 * A missing or wrong closer of a DNCL block is said in the words of DNCL (#1419), not as
 * the Ruby converter's missing `end`.
 */
import { dnclToRuby } from '../../../../src/lib/dncl/dncl-to-ruby';
import { findDnclBlockErrors, validateDncl } from '../../../../src/lib/dncl/dncl-validator';

const errorsOf = (lines) => findDnclBlockErrors(lines.join('\n'));

describe('findDnclBlockErrors', () => {
    test('balanced blocks have no error', () => {
        expect(
            errorsOf([
                '関数 最大値(a, b)',
                '  もし a > b ならば',
                '    返す a',
                '  そうでなくもし a == b ならば',
                '    返す a',
                '  そうでなければ',
                '    返す b',
                '  を実行する',
                'と定義する',
                'i を 1 から 10 まで 1 ずつ増やしながら',
                '  j を 10 から 1 まで 1 ずつ減らしながら',
                '    x < 3 の間',
                '      x ← x + 1',
                '    を繰り返す',
                '  を繰り返す',
                'を繰り返す',
            ]),
        ).toEqual([]);
    });

    test('an if without を実行する is reported on its line', () => {
        expect(errorsOf(['もし x > 0 ならば', '  表示する(x)'])).toEqual([
            {
                line: 1,
                column: 1,
                message: '「もし〜ならば」を「を実行する」で閉じてください',
            },
        ]);
    });

    test('each kind of block names its own closer', () => {
        expect(errorsOf(['x < 3 の間', '  x ← x + 1'])[0].message).toBe('「〜の間」を「を繰り返す」で閉じてください');
        expect(errorsOf(['i を 1 から 3 まで 1 ずつ増やしながら'])[0].message).toBe(
            '「〜ずつ増やしながら」を「を繰り返す」で閉じてください',
        );
        expect(errorsOf(['i を 3 から 1 まで 1 ずつ減らしながら'])[0].message).toBe(
            '「〜ずつ減らしながら」を「を繰り返す」で閉じてください',
        );
        expect(errorsOf(['関数 f(a)', '  返す a'])[0].message).toBe('「関数」を「と定義する」で閉じてください');
    });

    test('an inner block left open is reported, not the outer one', () => {
        expect(errorsOf(['x < 3 の間', '  もし x > 1 ならば', '    表示する(x)', 'を繰り返す'])).toEqual([
            {
                line: 2,
                column: 1,
                message: '「もし〜ならば」を「を実行する」で閉じてください',
            },
        ]);
    });

    test('a block closed with the wrong closer is reported when the Ruby breaks', () => {
        expect(errorsOf(['もし x > 0 ならば', '  表示する(x)', 'を繰り返す', 'を実行する'])).toEqual([
            {
                line: 3,
                column: 1,
                message: '「もし〜ならば」は「を繰り返す」ではなく「を実行する」で閉じてください',
            },
            {
                line: 4,
                column: 1,
                message: '「を実行する」で閉じるものがありません',
            },
        ]);
    });

    test('a wrong closer that still makes good Ruby is not an error', () => {
        // The editor takes it (every closer becomes `end`), so it is left alone.
        expect(errorsOf(['もし x > 0 ならば', '  表示する(x)', 'を繰り返す'])).toEqual([]);
    });

    test('そうでなければ inside a loop of an if left open names the if', () => {
        expect(
            errorsOf([
                'もし x > 0 ならば',
                '  x < 3 の間',
                '    x ← x + 1',
                'そうでなければ',
                '  表示する(x)',
                'を実行する',
            ]),
        ).toEqual([
            {
                line: 2,
                column: 1,
                message: '「〜の間」を「を繰り返す」で閉じてください',
            },
        ]);
    });

    test('a closer with no block is reported', () => {
        expect(errorsOf(['表示する(1)', 'を実行する'])).toEqual([
            {
                line: 2,
                column: 1,
                message: '「を実行する」で閉じるものがありません',
            },
        ]);
    });

    test('そうでなければ without もし is reported', () => {
        expect(errorsOf(['そうでなければ', '  表示する(1)'])[0]).toEqual({
            line: 1,
            column: 1,
            message: '「そうでなければ」の前に「もし〜ならば」がありません',
        });
    });

    test('a closer in a comment or a string is not a closer', () => {
        expect(errorsOf(['表示する("を実行する")', '# を繰り返す'])).toEqual([]);
    });
});

describe('dnclToRuby with a missing closer', () => {
    test('still makes the Ruby and gives the DNCL error on the DNCL line', () => {
        const result = dnclToRuby(['表示する(1)', 'もし x > 0 ならば', '  表示する(x)'].join('\n'));
        expect(result.ruby).not.toBeNull();
        expect(result.errors).toEqual([]);
        expect(result.blockErrors).toEqual([
            {
                line: 2,
                column: 1,
                message: '「もし〜ならば」を「を実行する」で閉じてください',
            },
        ]);
    });

    test('the DNCLv2 forms closed by ⎿ and by indentation have no block error', () => {
        expect(dnclToRuby(['もし x > 0 ならば:', '｜ 表示する(x)', '⎿ 表示する(1)'].join('\n')).blockErrors).toEqual(
            [],
        );
        expect(dnclToRuby(['もし x > 0 ならば:', '  表示する(x)', '表示する(1)'].join('\n')).blockErrors).toEqual([]);
    });

    test('an error on a line after a DNCLv2 multi-assignment is on the line written', () => {
        const result = dnclToRuby(['a ← 1, b ← 2', 'もし a > 0 ならば', '  表示する(a)'].join('\n'));
        expect(result.blockErrors.map((err) => err.line)).toEqual([2]);
    });
});

/**
 * A `#` in a string is text, not a comment, so the `@` / `$` after it is still found
 * (#1709). A `#` outside a string starts the comment, and an `@` in it is no error.
 */
describe('validateDncl and a # in a string', () => {
    const atError = (column) => ({
        line: 1,
        column,
        message: '日本語モードでは変数に「@」は使えません',
    });

    test.each([
        ['x ← "#" + @y', 11],
        ["x ← '#' + @y", 11],
        ['x ← 「#」 + @y', 11],
        ['x ← "a#b" + $y', 13],
    ])('%s is an error at the @ / $', (line, column) => {
        const errors = validateDncl(line);
        expect(errors).toHaveLength(1);
        expect(errors[0].line).toBe(1);
        expect(errors[0].column).toBe(column);
        expect(errors[0].message).toMatch(/日本語モードでは変数に「[@$]」は使えません/);
    });

    test('the error stops the conversion of the line from the issue', () => {
        const result = dnclToRuby('x ← "#" + @y');
        expect(result.errors).toEqual([atError(11)]);
        expect(result.ruby).toBeNull();
    });

    test.each(['x ← 1 # @y', 'x ← "#" # @y', 'x ← 「#」 # $y', "x ← '#' # @y", '# @y'])(
        'an @ / $ in the comment of %s is no error',
        (line) => {
            expect(validateDncl(line)).toEqual([]);
        },
    );

    test('an @ in 「...」 is text, not a variable', () => {
        expect(validateDncl('x ← 「@y」')).toEqual([]);
    });

    test('a string after which the comment starts converts with the comment', () => {
        const result = dnclToRuby('x ← "#" # @y');
        expect(result.errors).toEqual([]);
        expect(result.ruby).toBe('@x = "#" # @y');
    });
});
