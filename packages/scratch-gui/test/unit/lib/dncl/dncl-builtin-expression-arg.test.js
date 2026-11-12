import { dnclToRuby } from '../../../../src/lib/dncl/dncl-to-ruby';
import { rubyToDncl } from '../../../../src/lib/dncl/ruby-to-dncl';

/**
 * Built-in functions that become a method call on their argument
 * (`整数(式)` → `式.to_i`, `文字列(式)` → `式.to_s`, `四捨五入(式)` →
 * `式.round`, ...). When the argument is an expression, the method has to
 * apply to the whole argument, so it is put in parentheses first.
 * (Issue #1686)
 */
describe('DNCL built-in with an expression argument (Issue #1686)', () => {
    const toRuby = (dncl) => dnclToRuby(dncl).ruby;
    const roundtrip = (dncl) => rubyToDncl(toRuby(dncl)).dncl;

    describe('DNCL → Ruby', () => {
        test.each([
            ['b = 文字列(a + 1)', '@b = (@a + 1).to_s'],
            ['b = 整数(a + 1)', '@b = (@a + 1).to_i'],
            ['b = 整数(a / 2)', '@b = (@a / 2).to_i'],
            ['b = 文字列(x でない)', '@b = (!@x).to_s'],
            ['表示する(文字列(a + 1))', 'puts((@a + 1).to_s)'],
            ['b = 整数(Data[1] * 3)', '@b = (@_array_Data_[1] * 3).to_i'],
            ['b = 文字列(整数(x / 2))', '@b = (@x / 2).to_i.to_s'],
            ['b = 文字列(a > 1)', '@b = (@a > 1).to_s'],
            ['b = 整数((a + 1) * 2)', '@b = ((@a + 1) * 2).to_i'],
            ['b = 四捨五入(a * 2)', '@b = (@a * 2).round'],
            ['b = 切り捨て(a * 2)', '@b = (@a * 2).floor'],
            ['b = 切り上げ(a * 2)', '@b = (@a * 2).ceil'],
            ['b = 絶対値(a - c)', '@b = (@a - @c).abs'],
            ['b = 含む(s + t, "a")', '@b = (@s + @t).include?("a")'],
            ['b = 整数(乱数(1..10) * 2)', '@b = (rand(1..10) * 2).to_i'],
        ])('%s', (dncl, ruby) => {
            expect(toRuby(dncl)).toBe(ruby);
        });

        test.each([
            ['b = 整数(x)', '@b = @x.to_i'],
            ['b = 文字列(Data[1])', '@b = @_array_Data_[1].to_s'],
            ['b = 文字列(-1)', '@b = -1.to_s'],
            ['b = 文字列("x")', '@b = "x".to_s'],
            ['b = 整数((a + 1))', '@b = (@a + 1).to_i'],
            ['b = 整数(a) + 1', '@b = @a.to_i + 1'],
            ['b = 要素数(Data)', '@b = @_array_Data_.length'],
            ['b = 整数(乱数(1..10))', '@b = rand(1..10).to_i'],
        ])('a single operand is left as it is: %s', (dncl, ruby) => {
            expect(toRuby(dncl)).toBe(ruby);
        });
    });

    describe('DNCL → Ruby → DNCL', () => {
        test.each([
            'b = 文字列(a + 1)',
            'b = 整数(a + 1)',
            'b = 整数(Data[1] * 3)',
            'b = 文字列(a > 1)',
            'b = 整数((a + 1) * 2)',
            'b = 四捨五入(a * 2)',
            'b = 絶対値(a - c)',
            'b = 整数(x)',
            'b = 文字列(Data[1])',
            'b = 整数(a) + 1',
            'b = 整数(乱数(1..10))',
            '表示する(文字列(a + 1))',
            'もし 整数(a + 1) > 3 ならば\n  b = 1\nを実行する',
            // Built-ins in control-flow lines come back too.
            'もし 整数(a) > 3 ならば\n  b = 1\nそうでなくもし 文字列(a) == "1" ならば\n  b = 2\nを実行する',
            '要素数(Data) > i の間\n  i = i + 1\nを繰り返す',
            '関数 f(x)\n  返す 整数(x * 2)\nと定義する',
            'i を 整数(a + 1) から 要素数(Data) まで 1 ずつ増やしながら\n  b = i\nを繰り返す',
        ])('%s', (dncl) => {
            expect(roundtrip(dncl)).toBe(dncl);
        });

        // `整数(x / 2)` is the integer quotient, which DNCL writes `x ÷ 2`
        // (Issue #1701).
        test.each([
            ['y = 整数(x / 2)', 'y = x ÷ 2'],
            ['b = 文字列(整数(x / 2))', 'b = 文字列(x ÷ 2)'],
            ['b = 文字列(x / 2)', 'b = 文字列(x / 2)'],
        ])('%s comes back as %s', (dncl, expected) => {
            expect(roundtrip(dncl)).toBe(expected);
        });

        test('文字列(x でない) keeps the negation inside', () => {
            expect(roundtrip('b = 文字列(x でない)')).toBe('b = 文字列(x でない)');
        });

        test('Ruby → DNCL → Ruby keeps `(式).to_i`', () => {
            const ruby = '@b = (@a + 1).to_i';
            expect(toRuby(rubyToDncl(ruby).dncl)).toBe(ruby);
        });
    });
});
