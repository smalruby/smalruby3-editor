// Warn on arithmetic other than `+` with a string in the Japanese mode (Issue #1465)
//
// `+` joins strings and is worked out from the left, so in
// `"残り" + a - 1 + "日"` the `- 1` is taken from a string. The order is not
// changed; the editor warns on such lines instead.
import { hasStringArithmetic, stringArithmeticRows } from '../../../../src/lib/dncl/dncl-string-arithmetic-hint';

describe('hasStringArithmetic (Issue #1465)', () => {
    test.each([
        ['a `-` after a string joined with `+`', '表示する("残り" + a - 1 + "日")'],
        ['a `-` after 文字列(...)', '表示する(文字列(a) + b - 1)'],
        ['a `-` after `.to_s`', '表示する((a).to_s + "日" + b - c)'],
        ['a string on the right of `-`', '表示する(a - 文字列(1))'],
        ['a string literal on the right of `-`', 'x = a - "1"'],
        ['`*` on a string', 'x = "a" * 2'],
        ['`/` on 文字列(...)', 'x = 文字列(a) / 2'],
        ['a string in 「...」', '表示する(「残り」 + a - 1)'],
        ['a `-` after a string in parentheses', '表示する(("a" + b) - 1)'],
        ['a full-width minus', '表示する("残り" + a − 1)'],
        ['a full-width hyphen-minus', '表示する("残り" + a － 1)'],
        ['a full-width `＊`', 'x = "a" ＊ 2'],
        ['a full-width `／` and `－` after `＋`', 'x = "a" ＋ b ／ 2 ＋ "c" － 1'],
        ['a `-` after a call joined to a string', '表示する("a" + f(b) - 1)'],
        ['`.to_s` after a call', '表示する(f(a).to_s - 1)'],
        ['`.to_s` after a method', '表示する("残り" + a.length.to_s - 1)'],
    ])('warns on %s', (_name, code) => {
        expect(hasStringArithmetic(code)).toBe(true);
    });

    test.each([
        ['numbers only', 'x = a + b - 1'],
        ['the number part in parentheses', '表示する("残り" + (a - 1) + "日")'],
        ['the number part as 文字列(...)', '表示する("残り" + 文字列(a - 1) + "日")'],
        ['`*` inside the `+` chain', '表示する("残り" + a * 2)'],
        ['a new argument after `,`', '表示する("残り", a - 1)'],
        ['a new expression after a comparison', 'もし s == "a" かつ n - 1 > 0 ならば:'],
        ['a sign after `+`', '表示する("残り" + -1)'],
        ['an index', '表示する(Data[n - 1] + "個")'],
        ['a `-` in a string', '表示する("a - b")'],
        ['an assignment of a number', 'kosu = kosu - 1'],
        ['a call with a string argument', 'n = 整数(文字列(a) + "0") - 1'],
        ['a call of a function with a string', 'n = 要素数("abc") - 1'],
        ['a method other than `.to_s` on a string', 'n = "12".to_i - 1'],
        ['a method after `.to_s`', 'n = 文字列(a).length - 1'],
        ['`.length` on a string', 'x = "abc".length - 1'],
        ['a method other than `.to_s` on 文字列(...)', 'x = 文字列(a).length * 2'],
        ['a method other than `.to_s` on a string group', 'x = ("a" + b).length - 1'],
    ])('does not warn on %s', (_name, code) => {
        expect(hasStringArithmetic(code)).toBe(false);
    });
});

describe('stringArithmeticRows (Issue #1465)', () => {
    test('returns the 0-based rows to warn on', () => {
        const lines = [
            'nokori = 3',
            'i を 1 から 2 まで 1 ずつ増やしながら繰り返す:',
            '｜ 表示する("あと" + nokori - i + "回") # ここ',
            '⎿ 表示する("あと" + (nokori - i) + "回")',
        ];
        expect(stringArithmeticRows(lines)).toEqual([2]);
    });

    test('a `-` only in the comment does not warn', () => {
        expect(stringArithmeticRows(['表示する("a") # "a" - 1'])).toEqual([]);
    });
});
