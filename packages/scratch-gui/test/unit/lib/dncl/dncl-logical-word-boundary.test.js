// `かつ` / `または` / `でない` を演算子とみなすかは、前後の空白ではなく
// 「名前の一部かどうか」で決める (Issue #1697)。名前の文字は DNCLv2 の
// 前処理の `isIdentChar` と同じ (`\p{L}` / `\p{N}` / `_`)。数値の直後は演算子。
import { dnclToRuby } from '../../../../src/lib/dncl/dncl-to-ruby';
import { dnclV2Preprocess } from '../../../../src/lib/dncl/dncl-v2-preprocessor';
import { rubyToDncl } from '../../../../src/lib/dncl/ruby-to-dncl';

const toRuby = (dncl) => dnclToRuby(dncl).ruby;

describe('かつ / または without spaces around them (Issue #1697)', () => {
    describe('the examples of the issue', () => {
        test('(a > 0)かつ(b > 0)', () => {
            expect(toRuby('x = (a > 0)かつ(b > 0)')).toBe('@x = (@a > 0) && (@b > 0)');
        });

        test('a[1]かつ b', () => {
            expect(toRuby('x = a[1]かつ b')).toBe('@x = @a[1] && @b');
        });

        test('a[1]または b', () => {
            expect(toRuby('x = a[1]または b')).toBe('@x = @a[1] || @b');
        });

        test('(a > 0)または(b > 0) in an if condition', () => {
            expect(toRuby('もし (a > 0)または(b > 0) ならば\n  a = 1\nを実行する')).toBe(
                'if (@a > 0) || (@b > 0)\n  @a = 1\nend',
            );
        });

        test('DNCLv2 (a > 0)and(b > 0)', () => {
            expect(toRuby(dnclV2Preprocess('x = (a > 0)and(b > 0)'))).toBe('@x = (@a > 0) && (@b > 0)');
        });

        test('DNCLv2 (a > 0)or(b > 0)', () => {
            expect(toRuby(dnclV2Preprocess('x = (a > 0)or(b > 0)'))).toBe('@x = (@a > 0) || (@b > 0)');
        });
    });

    describe('after a number or a string', () => {
        test('after a number', () => {
            expect(toRuby('x = a == 1かつ b')).toBe('@x = @a == 1 && @b');
        });

        test('after a string', () => {
            expect(toRuby('x = a == 「はい」かつ b')).toBe('@x = @a == "はい" && @b');
        });

        test('before a string', () => {
            expect(toRuby('x = b かつ"はい" == a')).toBe('@x = @b && "はい" == @a');
        });
    });

    describe('part of a name: kept as it is', () => {
        test('かつお', () => {
            expect(toRuby('かつお = 1')).toBe('@かつお = 1');
        });

        test('または2', () => {
            expect(toRuby('x = または2')).toBe('@x = @または2');
        });

        test('しかつめ', () => {
            expect(toRuby('x = しかつめ')).toBe('@x = @しかつめ');
        });

        test('たかつき (hiragana before and after)', () => {
            expect(toRuby('たかつき = 1')).toBe('@たかつき = 1');
        });

        test('a name ending in かつ, before a bracket', () => {
            expect(toRuby('x = たかつ[1]')).toBe('@x = @たかつ[1]');
        });

        test('a name with a digit before かつ (a1かつ)', () => {
            expect(toRuby('x = a1かつ')).toBe('@x = @a1かつ');
        });

        test('ではない inside a name', () => {
            expect(toRuby('x = できでない')).toBe('@x = @できでない');
        });
    });

    describe('inside strings and comments: kept as it is', () => {
        test('a string', () => {
            expect(toRuby('x = "(a)かつ(b)"')).toBe('@x = "(a)かつ(b)"');
        });

        test('a 「」 string', () => {
            expect(toRuby('x = 「(a)または(b)」')).toBe('@x = "(a)または(b)"');
        });

        test('a trailing comment', () => {
            expect(toRuby('x = a # (a)かつ(b)')).toBe('@x = @a # (a)かつ(b)');
        });

        test('でない in a trailing comment', () => {
            expect(toRuby('x = a # (a)でない')).toBe('@x = @a # (a)でない');
        });
    });

    describe('with spaces: unchanged', () => {
        test('x かつ y', () => {
            expect(toRuby('a = x かつ y')).toBe('@a = @x && @y');
        });

        test('x または y', () => {
            expect(toRuby('a = x または y')).toBe('@a = @x || @y');
        });

        test('(a > 0) かつ (b > 0)', () => {
            expect(toRuby('x = (a > 0) かつ (b > 0)')).toBe('@x = (@a > 0) && (@b > 0)');
        });

        test('x でない かつ y', () => {
            expect(toRuby('a = x でない かつ y')).toBe('@a = !@x && @y');
        });
    });

    describe('でない without spaces', () => {
        test('(a > 0)でない', () => {
            expect(toRuby('x = (a > 0)でない')).toBe('@x = !(@a > 0)');
        });

        test('(a > 0)でない かつ b', () => {
            expect(toRuby('x = (a > 0)でない かつ b')).toBe('@x = !(@a > 0) && @b');
        });

        test('a[1]でない', () => {
            expect(toRuby('x = a[1]でない')).toBe('@x = !@a[1]');
        });
    });

    describe('DNCLv2 not before and / or without spaces', () => {
        // `not` negates only its own operand, up to the `and` / `or` even
        // without spaces, not the operand after it.
        test('not (a > 0)and(b > 0)', () => {
            expect(toRuby('x = not (a > 0)and(b > 0)')).toBe('@x = !(@a > 0) && (@b > 0)');
        });

        test('not a[1]and b', () => {
            expect(toRuby('x = not a[1]and b')).toBe('@x = !@a[1] && @b');
        });

        test('not a or(b)', () => {
            expect(toRuby('x = not a or(b)')).toBe('@x = !@a || (@b)');
        });

        test('in an if condition', () => {
            expect(toRuby('もし not (a > 0)and(b > 0) ならば:\n    x = 1')).toBe(
                'if !(@a > 0) && (@b > 0)\n    @x = 1\nend',
            );
        });

        test('a name containing かつ is still part of the operand', () => {
            expect(toRuby('x = not かつお > 0')).toBe('@x = !(@かつお > 0)');
        });
    });

    describe('Ruby → DNCL → Ruby', () => {
        const roundtrip = (ruby) => toRuby(rubyToDncl(ruby).dncl);

        test('&& between parentheses', () => {
            expect(roundtrip('@x = (@a > 0) && (@b > 0)')).toBe('@x = (@a > 0) && (@b > 0)');
        });

        test('|| between array elements', () => {
            expect(roundtrip('@x = @a[1] || @b')).toBe('@x = @a[1] || @b');
        });

        test('a name containing かつ', () => {
            expect(roundtrip('@たかつき = 1\n@x = @かつお && @たかつき')).toBe(
                '@たかつき = 1\n@x = @かつお && @たかつき',
            );
        });
    });
});
