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

/**
 * A negative number literal is one number in Ruby: `-5.abs` is `(-5).abs`
 * (5), not `-(5.abs)`. Ruby → DNCL keeps the `-` inside the built-in, so
 * the DNCL reads as the same value. A `-` before a name, or a `-` with a
 * space after it, negates the result as before. (Issue #1700)
 */
describe('Ruby → DNCL with a negative number receiver (Issue #1700)', () => {
    const toDncl = (ruby) => rubyToDncl(ruby).dncl;
    const toRuby = (dncl) => dnclToRuby(dncl).ruby;

    test.each([
        ['@b = -5.abs', 'b = 絶対値(-5)'],
        ['@b = -1.to_s', 'b = 文字列(-1)'],
        ['@b = -1.5.abs', 'b = 絶対値(-1.5)'],
        ['@b = -2.5.round', 'b = 四捨五入(-2.5)'],
        ['@b = 3 * -5.abs', 'b = 3 * 絶対値(-5)'],
        ['@b = (-5.abs + 1)', 'b = (絶対値(-5) + 1)'],
        ['puts(-1.to_s + "個")', '表示する(-1, "個")'],
        ['@b = @a && -5.abs', 'b = a かつ 絶対値(-5)'],
        ['@b = (@a > 0 || -1.to_s == "x")', 'b = (a > 0 または 文字列(-1) == "x")'],
        ['@b = (@a > 0 and -5.abs > 1)', 'b = (a > 0 and 絶対値(-5) > 1)'],
    ])('%s → %s', (ruby, dncl) => {
        expect(toDncl(ruby)).toBe(dncl);
    });

    test.each([
        ['@b = -@a.abs', 'b = -絶対値(a)'],
        ['@b = - 5.abs', 'b = - 絶対値(5)'],
        ['@b = @a - 5.abs', 'b = a - 絶対値(5)'],
        ['@b = @a -5.abs', 'b = a -絶対値(5)'],
        ['@b = 3 -5.abs', 'b = 3 -絶対値(5)'],
    ])('a `-` that is not part of the number stays outside: %s', (ruby, dncl) => {
        expect(toDncl(ruby)).toBe(dncl);
    });

    test.each(['b = 絶対値(-5)', 'b = 文字列(-1)', 'b = -絶対値(a)', '表示する(-1, "個")'])(
        'DNCL → Ruby → DNCL: %s',
        (dncl) => {
            expect(toDncl(toRuby(dncl))).toBe(dncl);
        },
    );
});

/**
 * A `-` before a built-in negates the result of the built-in (`-絶対値(5)` is
 * -5). Ruby reads `-5.abs` as `(-5).abs` (5), so DNCL → Ruby puts the method
 * call in parentheses (`-(5.abs)`), as the generator does for a unary minus.
 * Ruby → DNCL drops them again. (Issue #1744)
 */
describe('DNCL → Ruby with a `-` before a built-in (Issue #1744)', () => {
    const toDncl = (ruby) => rubyToDncl(ruby).dncl;
    const toRuby = (dncl) => dnclToRuby(dncl).ruby;

    test.each([
        ['b = -絶対値(5)', '@b = -(5.abs)'],
        ['b = -文字列(1)', '@b = -(1.to_s)'],
        ['b = -四捨五入(2.5)', '@b = -(2.5.round)'],
        ['b = -切り捨て(2.5)', '@b = -(2.5.floor)'],
        ['b = -切り上げ(2.5)', '@b = -(2.5.ceil)'],
        ['b = -整数(x)', '@b = -(@x.to_i)'],
        ['b = -要素数(A)', '@b = -(@_array_A_.length)'],
        ['b = -絶対値(a)', '@b = -(@a.abs)'],
        ['b = -絶対値(a - c)', '@b = -((@a - @c).abs)'],
        ['b = -絶対値(-5)', '@b = -(-5.abs)'],
        ['b = 3 * -絶対値(5)', '@b = 3 * -(5.abs)'],
        ['b = -絶対値(整数(x))', '@b = -(@x.to_i.abs)'],
        ['表示する(-絶対値(5))', 'puts(-(5.abs))'],
    ])('%s → %s', (dncl, ruby) => {
        expect(toRuby(dncl)).toBe(ruby);
    });

    test.each([
        ['b = a - 絶対値(5)', '@b = @a - 5.abs'],
        ['b = a -絶対値(5)', '@b = @a -5.abs'],
        ['b = -x', '@b = -@x'],
        ['b = -(a + 1)', '@b = -(@a + 1)'],
        ['b = 絶対値(-5)', '@b = -5.abs'],
        ['b = -乱数(1..10)', '@b = -rand(1..10)'],
        ['b = -平方根(4)', '@b = -Math.sqrt(4)'],
    ])('other `-` are left as they are: %s', (dncl, ruby) => {
        expect(toRuby(dncl)).toBe(ruby);
    });

    test.each([
        'b = -絶対値(5)',
        'b = -文字列(1)',
        'b = -四捨五入(2.5)',
        'b = -整数(x)',
        'b = -要素数(A)',
        'b = -絶対値(a - c)',
        'b = 3 * -絶対値(5)',
        'b = a - 絶対値(5)',
        'b = 絶対値(-5)',
        'b = -(a + 1)',
    ])('DNCL → Ruby → DNCL: %s', (dncl) => {
        expect(toDncl(toRuby(dncl))).toBe(dncl);
    });

    test.each([
        '@b = -(5.abs)',
        '@b = -5.abs',
        '@b = -@a.abs',
        '@b = -(@x.to_i)',
        '@b = -(1.to_s)',
        '@b = @a - 5.abs',
        '@b = -(@a + 1)',
    ])('Ruby → DNCL → Ruby keeps the value: %s', (ruby) => {
        const back = toRuby(toDncl(ruby));
        // `-@a.abs` and `-(@a.abs)` are the same in Ruby, so the text may differ.
        expect(back.replace(/-\((@\w+\.\w+)\)/g, '-$1')).toBe(ruby.replace(/-\((@\w+\.\w+)\)/g, '-$1'));
    });
});
