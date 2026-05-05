// === Smalruby: Tests for `表示する` multi-arg → `puts(... + ...)` mapping ===
//
// DNCLv2 allows `表示する(a, "は", b)` to mean "print all of these as one
// message". We convert this to `puts(a.to_s + "は" + b.to_s)` so that the
// resulting Scratch block is a single `looks_sayforsecs` whose MESSAGE
// input is an `operator_join` chain, producing one bubble.
//
// String literals are kept as-is; non-string args are wrapped in `.to_s`
// so that the `operator_join` converter routes the result correctly
// (block-block `+` would otherwise route to `operator_add`).
//
// See Issue #640.

import { dnclToRuby } from '../../../../src/lib/dncl/dncl-to-ruby';
import { rubyToDncl } from '../../../../src/lib/dncl/ruby-to-dncl';

const dToR = (src) => dnclToRuby(src).ruby;
const rToD = (src) => rubyToDncl(src).dncl;

describe('表示する → puts (single arg)', () => {
    test('表示する(a) → puts(@a)', () => {
        expect(dToR('表示する(a)')).toBe('puts(@a)');
    });

    test('表示する("hello") → puts("hello")', () => {
        expect(dToR('表示する("hello")')).toBe('puts("hello")');
    });

    test('表示する(整数(x)) → puts(@x.to_i)', () => {
        expect(dToR('表示する(整数(x))')).toBe('puts(@x.to_i)');
    });

    test('表示する(乱数(1..10)) → puts(rand(1..10))', () => {
        expect(dToR('表示する(乱数(1..10))')).toBe('puts(rand(1..10))');
    });

    test('表示する(要素数(Kouka)) → puts(@_array_Kouka_.length)', () => {
        const src = 'Kouka = [1, 2]\n表示する(要素数(Kouka))';
        const out = dToR(src);
        expect(out).toContain('puts(@_array_Kouka_.length)');
    });
});

describe('表示する → puts(... + ...) (multi arg)', () => {
    test('表示する("a", "b") → puts("a" + "b")', () => {
        expect(dToR('表示する("a", "b")')).toBe('puts("a" + "b")');
    });

    test('表示する("添字", " ", "要素") → puts("添字" + " " + "要素")', () => {
        expect(dToR('表示する("添字", " ", "要素")')).toBe(
            'puts("添字" + " " + "要素")',
        );
    });

    test('表示する(a, "は", b) → puts(@a.to_s + "は" + @b.to_s)', () => {
        expect(dToR('表示する(a, "は", b)')).toBe(
            'puts(@a.to_s + "は" + @b.to_s)',
        );
    });

    test('表示する(atai, "は", aida, "番目にありました") → puts with all strings/.to_s', () => {
        expect(dToR('表示する(atai, "は", aida, "番目にありました")')).toBe(
            'puts(@atai.to_s + "は" + @aida.to_s + "番目にありました")',
        );
    });

    test('表示する(乱数(1..10), "個") → puts(rand(1..10).to_s + "個")', () => {
        expect(dToR('表示する(乱数(1..10), "個")')).toBe(
            'puts(rand(1..10).to_s + "個")',
        );
    });

    test('表示する with 整数() → wraps with .to_s', () => {
        expect(dToR('表示する(整数(x), "回")')).toBe(
            'puts(@x.to_i.to_s + "回")',
        );
    });
});

describe('Ruby → DNCL: puts(...) flatten + .to_s unwrap', () => {
    test('puts(@a) → 表示する(a)', () => {
        expect(rToD('puts(@a)')).toBe('表示する(a)');
    });

    test('puts("a" + "b" + "c") → 表示する("a", "b", "c")', () => {
        expect(rToD('puts("a" + "b" + "c")')).toBe('表示する("a", "b", "c")');
    });

    test('puts("添字" + " " + "要素") → 表示する("添字", " ", "要素")', () => {
        expect(rToD('puts("添字" + " " + "要素")')).toBe(
            '表示する("添字", " ", "要素")',
        );
    });

    test('puts(@a.to_s + "は" + @b.to_s) → 表示する(a, "は", b)', () => {
        expect(rToD('puts(@a.to_s + "は" + @b.to_s)')).toBe(
            '表示する(a, "は", b)',
        );
    });

    test('puts((@a.to_s + "は") + @b.to_s) → 表示する(a, "は", b) (parens flattened)', () => {
        expect(rToD('puts((@a.to_s + "は") + @b.to_s)')).toBe(
            '表示する(a, "は", b)',
        );
    });

    test('puts(((1.to_s + "は") + 2.to_s) + "番目") → 表示する(1, "は", 2, "番目")', () => {
        expect(rToD('puts(((1.to_s + "は") + 2.to_s) + "番目")')).toBe(
            '表示する(1, "は", 2, "番目")',
        );
    });

    test('puts(@a + @b) — no .to_s, no string literal → NOT flattened', () => {
        // Without `.to_s` markers, we cannot distinguish a multi-arg display
        // from a single arithmetic expression. Default to single-arg form.
        expect(rToD('puts(@a + @b)')).toBe('表示する(a + b)');
    });

    test('puts(@x + 1) → 表示する(x + 1) (numeric arithmetic stays as one arg)', () => {
        expect(rToD('puts(@x + 1)')).toBe('表示する(x + 1)');
    });
});

describe('Ruby → DNCL: say(...) flatten too (for backward compat)', () => {
    test('say(@a, 1) → 表示する(a) (existing behavior)', () => {
        expect(rToD('say(@a, 1)')).toBe('表示する(a)');
    });

    test('say("a" + "b" + "c", 1) → 表示する("a", "b", "c") (NEW: flatten)', () => {
        expect(rToD('say("a" + "b" + "c", 1)')).toBe('表示する("a", "b", "c")');
    });

    test('say(@a, @b, @c, 1) → 表示する(a, b, c) (existing multi-arg comma form)', () => {
        // This existing pre-flatten form still works for backward compatibility
        expect(rToD('say(@a, @b, @c, 1)')).toBe('表示する(a, b, c)');
    });
});
