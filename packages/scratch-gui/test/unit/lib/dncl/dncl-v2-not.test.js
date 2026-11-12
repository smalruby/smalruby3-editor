// DNCLv2 (共通テスト用プログラム表記) の否定 `not` を Smalruby DNCL の
// 後置 `でない` に直す前処理のテスト (Issue #1671)。
// `not` の優先順位は Python と同じ: 比較演算より弱く、`and` / `or` より強い。
import { dnclToRuby } from '../../../../src/lib/dncl/dncl-to-ruby';
import { dnclV2Preprocess } from '../../../../src/lib/dncl/dncl-v2-preprocessor';

const toRuby = (dncl) => dnclToRuby(dncl).ruby;

describe('DNCLv2 pre-processor: not → でない', () => {
    test('not x', () => {
        expect(dnclV2Preprocess('b = not x')).toBe('b = x でない');
    });

    test('not binds looser than a comparison', () => {
        expect(dnclV2Preprocess('b = not a > 10')).toBe('b = a > 10 でない');
    });

    test('x and not y', () => {
        expect(dnclV2Preprocess('b = x and not y')).toBe('b = x かつ y でない');
    });

    test('not binds tighter than and', () => {
        expect(dnclV2Preprocess('b = not a and b')).toBe('b = a でない かつ b');
    });

    test('not (a or b)', () => {
        expect(dnclV2Preprocess('b = not (a or b)')).toBe('b = (a または b) でない');
    });

    test('not not x', () => {
        expect(dnclV2Preprocess('b = not not x')).toBe('b = x でない でない');
    });

    test('もし not x ならば', () => {
        expect(dnclV2Preprocess('もし not x ならば:')).toBe('もし x でない ならば');
    });

    test('not x の間', () => {
        expect(dnclV2Preprocess('not x の間繰り返す:')).toBe('x でない の間');
    });

    test('not inside a call argument', () => {
        expect(dnclV2Preprocess('表示する(not x, y)')).toBe('表示する(x でない, y)');
    });

    test('not inside a string is left alone', () => {
        expect(dnclV2Preprocess('a = "not x"')).toBe('a = "not x"');
    });

    test('not inside an identifier is left alone', () => {
        expect(dnclV2Preprocess('nothing = knot + not_yet')).toBe('nothing = knot + not_yet');
    });

    test('not next to Japanese letters is part of the name', () => {
        expect(dnclV2Preprocess('notフラグ = 値not + 1')).toBe('notフラグ = 値not + 1');
    });

    test('not in a comment is left alone', () => {
        expect(dnclV2Preprocess('b = not x # not now')).toBe('b = x でない # not now');
    });

    test('a lone not is left alone', () => {
        expect(dnclV2Preprocess('not = 1')).toBe('not = 1');
    });

    test('a string in the operand of not is kept', () => {
        expect(dnclV2Preprocess('b = not s == "a, or b"')).toBe('b = s == "a, or b" でない');
    });
});

describe('DNCLv2 not → Ruby', () => {
    test('b = not x', () => {
        expect(toRuby('b = not x')).toBe('@b = !@x');
    });

    test('not a > 10', () => {
        expect(toRuby('b = not a > 10')).toBe('@b = !(@a > 10)');
    });

    test('x and not y', () => {
        expect(toRuby('b = x and not y')).toBe('@b = @x && !@y');
    });

    test('not a and b', () => {
        expect(toRuby('c = not a and b')).toBe('@c = !@a && @b');
    });

    test('not (a or b)', () => {
        expect(toRuby('c = not (a or b)')).toBe('@c = !(@a || @b)');
    });

    test('もし not x ならば', () => {
        expect(toRuby('もし not x ならば:\n  表示する(1)')).toBe('if !@x\n  puts(1)\nend');
    });

    test('not x の間', () => {
        expect(toRuby('not x の間繰り返す:\n  x = 真')).toBe('until @x\n  @x = true\nend');
    });

    test('not in a string stays in the string', () => {
        expect(toRuby('表示する("not x")')).toBe('puts("not x")');
    });

    test('identifiers containing not are kept', () => {
        expect(toRuby('nothing = knot')).toBe('@nothing = @knot');
    });
});
