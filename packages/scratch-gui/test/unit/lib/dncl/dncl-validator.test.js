/**
 * A missing or wrong closer of a DNCL block is said in the words of DNCL (#1419), not as
 * the Ruby converter's missing `end`.
 */
import { dnclToRuby } from '../../../../src/lib/dncl/dncl-to-ruby';
import { FORBIDDEN_PREFIX_ERROR_ID } from '../../../../src/lib/dncl/dncl-validator';

// A program with a block error makes no Ruby; the block error is one of its errors.
const errorsOf = (lines) => dnclToRuby(lines.join('\n')).errors;
const errorsOfLine = (line) => dnclToRuby(line).errors;

describe('block errors of the DNCL-like form', () => {
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

    test('a reading comma after the words of a block line is read (#2274)', () => {
        expect(
            errorsOf([
                'x < 3 の間，',
                '  もし x > 1 ならば、',
                '    x ← x + 2',
                '  そうでなければ,',
                '    x ← x + 1',
                '  を実行する',
                'を繰り返す',
                'i を 1 から 3 まで 1 ずつ増やしながら，繰り返す:',
                '    表示する(i)',
            ]),
        ).toEqual([]);
        expect(errorsOf(['x < 3 の間，', '  x ← x + 1'])[0].message).toBe(
            '「〜の間」を「を繰り返す」で閉じてください',
        );
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

    // A closer of another kind of block is an error even when the Ruby would be good (W3 of #1731).
    test('a wrong closer is reported with the closer of the block', () => {
        expect(errorsOf(['もし x > 0 ならば', '  表示する(x)', 'を繰り返す'])).toEqual([
            {
                line: 3,
                column: 1,
                message: '「もし〜ならば」は「を繰り返す」ではなく「を実行する」で閉じてください',
            },
        ]);
    });

    test('a counting loop closed with another closer is reported', () => {
        expect(errorsOf(['i を 1 から 3 まで 1 ずつ増やしながら', '  表示する(i)', 'を実行する'])).toEqual([
            {
                line: 3,
                column: 1,
                message: '「〜ずつ増やしながら」は「を実行する」ではなく「を繰り返す」で閉じてください',
            },
        ]);
    });

    test('a block opened with : closed by a line of another kind names the standard form', () => {
        expect(errorsOf(['x < 3 の間繰り返す:', '    x = x + 1', 'と定義する'])).toEqual([
            {
                line: 3,
                column: 1,
                message: '「〜の間繰り返す:」は「と定義する」ではなく「を繰り返す」で閉じてください',
            },
        ]);
    });

    test('end still closes any kind of block', () => {
        expect(errorsOf(['x < 3 の間', '  x ← x + 1', 'end'])).toEqual([]);
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
    test('makes no Ruby and gives the DNCL error on the DNCL line', () => {
        const result = dnclToRuby(['表示する(1)', 'もし x > 0 ならば', '  表示する(x)'].join('\n'));
        expect(result.ruby).toBeNull();
        expect(result.errors).toEqual([
            {
                line: 2,
                column: 1,
                message: '「もし〜ならば」を「を実行する」で閉じてください',
            },
        ]);
    });

    test('the DNCLv2 forms closed by ⎿ and by indentation have no block error', () => {
        expect(dnclToRuby(['もし x > 0 ならば:', '｜ 表示する(x)', '⎿ 表示する(1)'].join('\n')).errors).toEqual([]);
        expect(dnclToRuby(['もし x > 0 ならば:', '  表示する(x)', '表示する(1)'].join('\n')).errors).toEqual([]);
    });

    test('an error on a line after a DNCLv2 multi-assignment is on the line written', () => {
        const result = dnclToRuby(['a ← 1, b ← 2', 'もし a > 0 ならば', '  表示する(a)'].join('\n'));
        expect(result.errors.map((err) => err.line)).toEqual([2]);
    });
});

/**
 * A `#` in a string is text, not a comment, so the `@` / `$` after it is still found
 * (#1709). A `#` outside a string starts the comment, and an `@` in it is no error.
 */
describe('the errors of dnclToRuby and a # in a string', () => {
    const atError = (column) => ({
        line: 1,
        column,
        id: FORBIDDEN_PREFIX_ERROR_ID,
        name: '@',
        message: '日本語タブでは変数に「@」は使えません',
    });

    test.each([
        ['x ← "#" + @y', 11],
        ["x ← '#' + @y", 11],
        ['x ← 「#」 + @y', 11],
        ['x ← "a#b" + $y', 13],
    ])('%s is an error at the @ / $', (line, column) => {
        const errors = errorsOfLine(line);
        expect(errors).toHaveLength(1);
        expect(errors[0].line).toBe(1);
        expect(errors[0].column).toBe(column);
        expect(errors[0].message).toMatch(/日本語タブでは変数に「[@$]」は使えません/);
    });

    test('the error stops the conversion of the line from the issue', () => {
        const result = dnclToRuby('x ← "#" + @y');
        expect(result.errors).toEqual([atError(11)]);
        expect(result.ruby).toBeNull();
    });

    test.each(['x ← 1 # @y', 'x ← "#" # @y', 'x ← 「#」 # $y', "x ← '#' # @y", '# @y'])(
        'an @ / $ in the comment of %s is no error',
        (line) => {
            expect(errorsOfLine(line)).toEqual([]);
        },
    );

    test('an @ in 「...」 is text, not a variable', () => {
        expect(errorsOfLine('x ← 「@y」')).toEqual([]);
    });

    test('a string after which the comment starts converts with the comment', () => {
        const result = dnclToRuby('x ← "#" # @y');
        expect(result.errors).toEqual([]);
        expect(result.ruby).toBe('@x = "#" # @y');
    });
});

// `@` / `$` are told by an id the editor translates, with the mark at the `@` / `$` (issue #1674).
describe('the error of @ / $ is translated and marks the character (issue #1674)', () => {
    test.each([
        ['@x = 1', '@', 1],
        ['$x = 1', '$', 1],
        ['y = 2 + @x', '@', 9],
        ['(1) もし x > 0 ならば:\n(2) ⎿ y = $z', '$', 11],
    ])('%s has the id and the name, at the column of the character', (dncl, name, column) => {
        const { ruby, errors } = dnclToRuby(dncl);
        expect(ruby).toBeNull();
        expect(errors).toHaveLength(1);
        expect(errors[0]).toMatchObject({ id: FORBIDDEN_PREFIX_ERROR_ID, name, column });
    });
});
