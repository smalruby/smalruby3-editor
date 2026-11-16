// Symbols written inside a string literal (Issue #2031)
//
// The DNCL `←` becomes Ruby `=`, but a `←` inside a string (「...」, "...",
// '...') is the text of the string, so it must be kept: `表示する(「x←1」)`
// had become `puts("x = 1")`. The other symbols the converters rewrite
// (`≦` / `≧` / `÷` / `//`, `真` / `偽`, `かつ` / `または` / `でない`,
// `and` / `or` / `not`, the built-in names) are kept in strings and in
// comments too; these tests make sure of that in both directions.
import { dnclToRuby } from '../../../../src/lib/dncl/dncl-to-ruby';
import { rubyToDncl } from '../../../../src/lib/dncl/ruby-to-dncl';

const dToR = (src) => dnclToRuby(src).ruby;
const rToD = (src) => rubyToDncl(src).dncl;

describe('DNCL → Ruby: ← inside a string is kept (Issue #2031)', () => {
    test.each([
        ['表示する(「x←1」)', 'puts("x←1")'],
        ['表示する("x←1")', 'puts("x←1")'],
        ["表示する('x←1')", "puts('x←1')"],
        ['表示する(「x ← 1」)', 'puts("x ← 1")'],
        ['表示する(「名前」, 「x←1」)', 'puts("名前" + "x←1")'],
        ['表示する(「a」 + "x←1")', 'puts("a" + "x←1")'],
    ])('%s', (dncl, ruby) => {
        expect(dToR(dncl)).toBe(ruby);
    });

    test('an assignment keeps the ← of its string and converts its own', () => {
        expect(dToR('a ← 「x←1」')).toBe('@a = "x←1"');
        expect(dToR('a ← "b ← c"')).toBe('@a = "b ← c"');
        expect(dToR('a = 「x←1」')).toBe('@a = "x←1"');
        expect(dToR('x ← 「a」 + 「←」')).toBe('@x = "a" + "←"');
    });

    test('a ← outside a string next to one is still an assignment', () => {
        expect(dToR('a←「x」')).toBe('@a = "x"');
        expect(dToR('kekka ← 「x←1」 + 文字列(a)')).toBe('@kekka = "x←1" + @a.to_s');
    });

    test('inside a block body', () => {
        expect(dToR('もし a > 1 ならば\n  b ← 「p←q」\nを実行する')).toBe('if @a > 1\n  @b = "p←q"\nend');
        expect(dToR('a ← 0\na < 3 の間\n  b ← 「i←i+1」\n  a ← a + 1\nを繰り返す')).toBe(
            '@a = 0\nwhile @a < 3\n  @b = "i←i+1"\n  @a = @a + 1\nend',
        );
    });

    test('in a condition and a return value', () => {
        expect(dToR('もし b == 「x←1」 ならば\n  表示する(b)\nを実行する')).toBe('if @b == "x←1"\n  puts(@b)\nend');
        expect(dToR('そうでなくもし b == 「x←1」 ならば')).toBe('elsif @b == "x←1"');
        expect(dToR('b != 「x←1」 の間\n  b ← 「x←1」\nを繰り返す')).toBe('while @b != "x←1"\n  @b = "x←1"\nend');
        expect(dToR('関数 shiki(x)\n  返す 「x←1」\nと定義する')).toBe('def shiki(x)\n  return "x←1"\nend');
    });

    test('in the standard form (line numbers and 罫線)', () => {
        expect(dToR('(1) もし a > 1 ならば:\n(2) ⎿ 表示する(「a←1」)')).toBe('if @a > 1\n  puts("a←1")\nend');
    });

    test('a ← in a comment is kept', () => {
        expect(dToR('a ← 1 # x←1')).toBe('@a = 1 # x←1');
        expect(dToR('表示する(「x←1」) # c←d')).toBe('puts("x←1") # c←d');
        expect(dToR('# x←1')).toBe('# x←1');
    });
});

describe('DNCL → Ruby: the other symbols inside a string are kept (Issue #2031)', () => {
    test.each([
        ['表示する(「a ≦ b ≧ c」)', 'puts("a ≦ b ≧ c")'],
        ['表示する(「7 ÷ 2」)', 'puts("7 ÷ 2")'],
        ['表示する(「7 // 2」)', 'puts("7 // 2")'],
        ['表示する(「真 と 偽」)', 'puts("真 と 偽")'],
        ['表示する(「a かつ b または c」)', 'puts("a かつ b または c")'],
        ['表示する(「x でない」)', 'puts("x でない")'],
        ['表示する(「a and b or not c」)', 'puts("a and b or not c")'],
        ['表示する(「整数(3.5)」)', 'puts("整数(3.5)")'],
        ['表示する("要素数(Tokuten)")', 'puts("要素数(Tokuten)")'],
        ['a = 1, b = 「c = 2, d = 3」', '@a = 1\n@b = "c = 2, d = 3"'],
    ])('%s', (dncl, ruby) => {
        expect(dToR(dncl)).toBe(ruby);
    });

    test('symbols in a comment are kept', () => {
        expect(dToR('a ← 1 # ≦ かつ 真 7 ÷ 2')).toBe('@a = 1 # ≦ かつ 真 7 ÷ 2');
    });
});

describe('Ruby → DNCL: symbols inside a string are kept (Issue #2031)', () => {
    test.each([
        ['puts("x = 1")', '表示する("x = 1")'],
        ['puts("a && b || c")', '表示する("a && b || c")'],
        ['puts("true false")', '表示する("true false")'],
        ['puts("x.to_i")', '表示する("x.to_i")'],
        ['puts("rand(3)")', '表示する("rand(3)")'],
        ['puts("a.include?(b)")', '表示する("a.include?(b)")'],
        ["puts('a.include?(b)')", "表示する('a.include?(b)')"],
    ])('%s', (ruby, dncl) => {
        expect(rToD(ruby)).toBe(dncl);
    });

    test('include? outside the string is still converted', () => {
        expect(rToD('puts("abc".include?("b"))')).toBe('表示する(含む("abc", "b"))');
        expect(rToD('puts(@a.include?("x.include?(y)"))')).toBe('表示する(含む(a, "x.include?(y)"))');
    });

    test('include? in a comment is kept', () => {
        expect(rToD('@a = 1 # s.include?(t)')).toBe('a = 1 # s.include?(t)');
    });
});
