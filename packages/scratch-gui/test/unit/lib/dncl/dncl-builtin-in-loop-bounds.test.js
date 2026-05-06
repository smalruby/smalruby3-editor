// === Smalruby: Tests for builtin function calls in for/while bounds ===
//
// Issue #644: `i を 0 から 要素数(Data) - 1 まで 1 ずつ増やしながら`
// produced `while @i <= 要素数(@_array_Data_) - 1` because the for-loop
// handler ran `processSegments` on the bound expression but skipped
// `convertBuiltinFunctions` — leaving `要素数(...)` unconverted.
//
// The same bug affected:
//   - decreasing for-loop (`ずつ減らしながら`)
//   - while-loop (`の間` condition) — actually OK (already calls
//     convertBuiltinFunctions on its condition), but tested for
//     completeness
//   - any builtin: `要素数`, `整数`, `文字列`, `乱数`, `四捨五入`,
//     `切り捨て`, `切り上げ`, `絶対値`, `平方根`, `含む`

import { dnclToRuby } from '../../../../src/lib/dncl/dncl-to-ruby';

const dToR = (src) => dnclToRuby(src).ruby;

describe('Builtin in for-loop bounds: 要素数()', () => {
    test('要素数(Data) in `to` bound', () => {
        const dncl = [
            'Data = [1, 2, 3]',
            'i を 0 から 要素数(Data) - 1 まで 1 ずつ増やしながら',
            '  a = i',
            'を繰り返す',
        ].join('\n');
        const out = dToR(dncl);
        expect(out).toContain('while @i <= @_array_Data_.length - 1');
        expect(out).not.toContain('要素数(');
    });

    test('要素数(Data) in `from` bound', () => {
        const dncl = [
            'Data = [1, 2, 3]',
            'i を 要素数(Data) から 1 まで 1 ずつ減らしながら',
            '  a = i',
            'を繰り返す',
        ].join('\n');
        const out = dToR(dncl);
        expect(out).toContain('@i = @_array_Data_.length');
        expect(out).not.toContain('要素数(');
    });
});

describe('Builtin in for-loop bounds: 整数() / 乱数()', () => {
    test('整数(x) in `to` bound', () => {
        const dncl = [
            'x = "5"',
            'i を 1 から 整数(x) まで 1 ずつ増やしながら',
            '  a = i',
            'を繰り返す',
        ].join('\n');
        const out = dToR(dncl);
        expect(out).toContain('while @i <= @x.to_i');
        expect(out).not.toContain('整数(');
    });

    test('乱数(10) in `to` bound', () => {
        const dncl = [
            'i を 1 から 乱数(10) まで 1 ずつ増やしながら',
            '  a = i',
            'を繰り返す',
        ].join('\n');
        const out = dToR(dncl);
        expect(out).toContain('while @i <= rand(10)');
        expect(out).not.toContain('乱数(');
    });

    test('整数(乱数(10)) — nested builtins', () => {
        const dncl = [
            'i を 1 から 整数(乱数(10)) まで 1 ずつ増やしながら',
            '  a = i',
            'を繰り返す',
        ].join('\n');
        const out = dToR(dncl);
        expect(out).toContain('while @i <= rand(10).to_i');
        expect(out).not.toContain('整数(');
        expect(out).not.toContain('乱数(');
    });
});

describe('Builtin in for-loop bounds: descending', () => {
    test('要素数(Data) in `from` of descending loop', () => {
        const dncl = [
            'Data = [1, 2, 3]',
            'i を 要素数(Data) - 1 から 0 まで 1 ずつ減らしながら',
            '  a = i',
            'を繰り返す',
        ].join('\n');
        const out = dToR(dncl);
        expect(out).toContain('@i = @_array_Data_.length - 1');
        expect(out).toContain('while @i >= 0');
    });
});

describe('Builtin in for-loop bounds: step', () => {
    test('整数(s) as step value', () => {
        const dncl = [
            's = "2"',
            'i を 0 から 10 まで 整数(s) ずつ増やしながら',
            '  a = i',
            'を繰り返す',
        ].join('\n');
        const out = dToR(dncl);
        // The step is added at end of loop as `@i += @s.to_i`
        expect(out).toContain('@i += @s.to_i');
    });
});

describe('Builtin in while-loop condition: regression check', () => {
    // While-loop already calls convertBuiltinFunctions on its condition.
    // Check that it stays working.
    test('要素数(Data) > 0 の間 stays converted', () => {
        const dncl = [
            'Data = [1, 2, 3]',
            '要素数(Data) > 0 の間',
            '  a = 1',
            'を繰り返す',
        ].join('\n');
        const out = dToR(dncl);
        expect(out).toContain('while @_array_Data_.length > 0');
        expect(out).not.toContain('要素数(');
    });
});

describe('Regression: literal bounds still work', () => {
    test('plain literal bounds (no builtin)', () => {
        const dncl = [
            'i を 1 から 10 まで 1 ずつ増やしながら',
            '  a = i',
            'を繰り返す',
        ].join('\n');
        expect(dToR(dncl)).toBe(
            ['@i = 1', 'while @i <= 10', '  @a = @i', '  @i += 1', 'end'].join(
                '\n',
            ),
        );
    });

    test('expression with variable (no builtin)', () => {
        const dncl = [
            'n = 10',
            'i を 0 から n - 1 まで 1 ずつ増やしながら',
            '  a = i',
            'を繰り返す',
        ].join('\n');
        const out = dToR(dncl);
        expect(out).toContain('while @i <= @n - 1');
    });
});
