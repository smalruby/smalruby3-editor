// 標準の形 (共通テスト用プログラム表記) の否定 `not` を Ruby の `!` にするテスト (Issue #1671)。
// `not` の優先順位は Python と同じ: 比較演算より弱く、`and` / `or` より強い。
import { dnclToRuby } from '../../../../src/lib/dncl/dncl-to-ruby';

const toRuby = (dncl) => dnclToRuby(dncl).ruby;

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
