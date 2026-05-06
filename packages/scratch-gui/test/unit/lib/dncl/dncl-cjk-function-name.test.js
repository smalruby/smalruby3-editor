// === Smalruby: Tests for CJK function names in DNCL→Ruby ===
//
// Issue #643: `関数 最大値(a, b)` (and similar with hiragana/katakana
// names) was failing the funcMatch regex `(\w+)` (ASCII-only) and
// falling through to identifier conversion, producing the broken
// `関数 @最大値(@a, @b)` instead of `def 最大値(a, b)`.
//
// `detectFunctionNames` had the same bug, so call sites for CJK
// function names were also being prefixed: `@答え = @最大値(@x, @y)`
// instead of `@答え = 最大値(@x, @y)`.

import { dnclToRuby } from '../../../../src/lib/dncl/dncl-to-ruby';

const dToR = (src) => dnclToRuby(src).ruby;

describe('CJK function names: definition', () => {
    test('kanji name (関数 最大値)', () => {
        const dncl = ['関数 最大値(a, b)', '  返す a', 'と定義する'].join('\n');
        const ruby = ['def 最大値(a, b)', '  return a', 'end'].join('\n');
        expect(dToR(dncl)).toBe(ruby);
    });

    test('hiragana name (関数 たしざん)', () => {
        const dncl = ['関数 たしざん(a, b)', '  返す a + b', 'と定義する'].join(
            '\n',
        );
        const ruby = ['def たしざん(a, b)', '  return a + b', 'end'].join('\n');
        expect(dToR(dncl)).toBe(ruby);
    });

    test('katakana name (関数 ハロー)', () => {
        const dncl = ['関数 ハロー()', '  返す 1', 'と定義する'].join('\n');
        const ruby = ['def ハロー()', '  return 1', 'end'].join('\n');
        expect(dToR(dncl)).toBe(ruby);
    });

    test('mixed CJK + ASCII underscore + digit (関数 add_2つ)', () => {
        const dncl = ['関数 add_2つ(a)', '  返す a', 'と定義する'].join('\n');
        const ruby = ['def add_2つ(a)', '  return a', 'end'].join('\n');
        expect(dToR(dncl)).toBe(ruby);
    });
});

describe('CJK function names: call site', () => {
    test('call CJK function: name has no @ prefix', () => {
        const dncl = [
            '関数 最大値(a, b)',
            '  返す a',
            'と定義する',
            '答え = 最大値(5, 8)',
        ].join('\n');
        const ruby = [
            'def 最大値(a, b)',
            '  return a',
            'end',
            '@答え = 最大値(5, 8)',
        ].join('\n');
        expect(dToR(dncl)).toBe(ruby);
    });

    test('forward reference: call before definition still works', () => {
        // detectFunctionNames runs before line conversion, so the call
        // site at line 1 should already know `たしざん` is a function.
        const dncl = [
            '答え = たしざん(3, 4)',
            '関数 たしざん(a, b)',
            '  返す a + b',
            'と定義する',
        ].join('\n');
        const ruby = [
            '@答え = たしざん(3, 4)',
            'def たしざん(a, b)',
            '  return a + b',
            'end',
        ].join('\n');
        expect(dToR(dncl)).toBe(ruby);
    });

    test('CJK function call inside 表示する argument', () => {
        const dncl = [
            '関数 にばい(x)',
            '  返す x * 2',
            'と定義する',
            '表示する(にばい(5))',
        ].join('\n');
        const ruby = [
            'def にばい(x)',
            '  return x * 2',
            'end',
            'puts(にばい(5))',
        ].join('\n');
        expect(dToR(dncl)).toBe(ruby);
    });
});

describe('CJK function names: ASCII still works (no regression)', () => {
    test('ASCII-only name still converts (regression check)', () => {
        const dncl = ['関数 add(a, b)', '  返す a + b', 'と定義する'].join('\n');
        const ruby = ['def add(a, b)', '  return a + b', 'end'].join('\n');
        expect(dToR(dncl)).toBe(ruby);
    });
});
