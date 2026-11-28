import { findArrayIndexHints } from '../../../../src/lib/dncl/dncl-array-index-hint';

// A program typed with 1-based indices (Issue #1357): the loops run the index up
// to the array length, as in a problem that says the indexes start at 1. It is our
// own program, not a problem of the 大学入試センター (docs/dncl/policy.md).
const ONE_BASED = [
    'Ten = [7, 3, 9, 5, 6, 2]',
    'kazu = 6',
    'Kiroku = [0, 0, 0]',
    'kaisu = 3',
    'i を 1 から kazu まで 1 ずつ増やしながら',
    '  saikou = 0',
    '  j を 2 から kaisu まで 1 ずつ増やしながら',
    '    もし Kiroku[j] > Kiroku[saikou] ならば',
    '      saikou = j',
    '    を実行する',
    '  を繰り返す',
    '  表示する("番号" + 文字列(i) + "の点数は" + 文字列(Ten[i]))',
    '  Kiroku[saikou] = Kiroku[saikou] + Ten[i]',
    'を繰り返す',
].join('\n');

describe('findArrayIndexHints', () => {
    test('warns about loops that run the index up to the array length', () => {
        expect(findArrayIndexHints(ONE_BASED)).toEqual([
            {
                line: 8,
                access: 'Kiroku[j]',
                array: 'Kiroku',
                last: 2,
                fixed: 'Kiroku[j - 1]',
            },
            {
                line: 12,
                access: 'Ten[i]',
                array: 'Ten',
                last: 5,
                fixed: 'Ten[i - 1]',
            },
        ]);
    });

    test('says nothing when the sentence at the top says the indexes start at 1', () => {
        expect(findArrayIndexHints(`# すべての配列の添字は 1 から始まる。\n${ONE_BASED}`)).toEqual([]);
    });

    test('accepts a 0-based loop', () => {
        const src = [
            'Kouka = [1, 5, 10]',
            'i を 0 から 2 まで 1 ずつ増やしながら',
            '  表示する(Kouka[i])',
            'を繰り返す',
        ].join('\n');
        expect(findArrayIndexHints(src)).toEqual([]);
    });

    test('accepts a loop up to 要素数(X) - 1', () => {
        const src = [
            'Kouka = [1, 5, 10]',
            'i を 0 から 要素数(Kouka) - 1 まで 1 ずつ増やしながら',
            '  表示する(Kouka[i])',
            'を繰り返す',
        ].join('\n');
        expect(findArrayIndexHints(src)).toEqual([]);
    });

    test('warns about a loop up to 要素数(X)', () => {
        const src = [
            'Kouka = [1, 5, 10]',
            'i を 1 から 要素数(Kouka) まで 1 ずつ増やしながら',
            '  表示する(Kouka[i])',
            'を繰り返す',
        ].join('\n');
        expect(findArrayIndexHints(src)).toEqual([
            {
                line: 3,
                access: 'Kouka[i]',
                array: 'Kouka',
                last: 2,
                fixed: 'Kouka[i - 1]',
            },
        ]);
    });

    test('warns about a counting-down loop that starts at the length', () => {
        const src = [
            'Kouka = [1, 5, 10]',
            'i を 3 から 1 まで 1 ずつ減らしながら',
            '  表示する(Kouka[i])',
            'を繰り返す',
        ].join('\n');
        expect(findArrayIndexHints(src)).toHaveLength(1);
    });

    test('ignores the loop variable after the loop ends', () => {
        const src = [
            'Kouka = [1, 5, 10]',
            'i を 1 から 3 まで 1 ずつ増やしながら',
            '  表示する(i)',
            'を繰り返す',
            'i = 0',
            '表示する(Kouka[i])',
        ].join('\n');
        expect(findArrayIndexHints(src)).toEqual([]);
    });

    test('warns about a constant index past the end', () => {
        const src = ['Kouka = [1, 5, 10]', '表示する(Kouka[3])'].join('\n');
        expect(findArrayIndexHints(src)).toEqual([
            {
                line: 2,
                access: 'Kouka[3]',
                array: 'Kouka',
                last: 2,
                fixed: 'Kouka[2]',
            },
        ]);
    });

    test('accepts a constant index inside the array', () => {
        const src = ['Kouka = [1, 5, 10]', 'Kouka[2] = 100'].join('\n');
        expect(findArrayIndexHints(src)).toEqual([]);
    });

    test('ignores accesses inside strings and comments', () => {
        const src = ['Kouka = [1, 5, 10]', '表示する("Kouka[3]") # Kouka[3]'].join('\n');
        expect(findArrayIndexHints(src)).toEqual([]);
    });

    test('does not guess the length of an array an element is added to (#1759)', () => {
        const src = ['Kouka = [1, 5, 10]', 'Kouka に 20 を追加する', '表示する(Kouka[3])'].join('\n');
        expect(findArrayIndexHints(src)).toEqual([]);
    });

    test('does not guess the length of an array assigned twice', () => {
        const src = ['Kouka = [1, 5, 10]', 'Kouka = [1, 5, 10, 20]', '表示する(Kouka[3])'].join('\n');
        expect(findArrayIndexHints(src)).toEqual([]);
    });

    test('does not treat a reassigned variable as a constant bound', () => {
        const src = [
            'Kouka = [1, 5, 10]',
            'n = 3',
            'n = n - 1',
            'i を 0 から n まで 1 ずつ増やしながら',
            '  表示する(Kouka[i])',
            'を繰り返す',
        ].join('\n');
        expect(findArrayIndexHints(src)).toEqual([]);
    });

    test('uses the last value a loop with a larger step reaches', () => {
        const src = [
            'Kouka = [1, 5, 10, 20, 30, 40, 50, 60, 70, 80]',
            'i を 0 から 10 まで 3 ずつ増やしながら',
            '  表示する(Kouka[i])',
            'を繰り返す',
        ].join('\n');
        expect(findArrayIndexHints(src)).toEqual([]);
    });

    test('warns when a loop with a larger step reaches the length', () => {
        const src = [
            'Kouka = [1, 5, 10]',
            'i を 1 から 3 まで 2 ずつ増やしながら',
            '  表示する(Kouka[i])',
            'を繰り返す',
        ].join('\n');
        expect(findArrayIndexHints(src)).toHaveLength(1);
    });

    test('ignores a loop that never runs', () => {
        const src = [
            'Kouka = [1, 5, 10]',
            'i を 5 から 3 まで 1 ずつ増やしながら',
            '  表示する(Kouka[i])',
            'を繰り返す',
            'j を 1 から 3 まで 1 ずつ減らしながら',
            '  表示する(Kouka[j])',
            'を繰り返す',
        ].join('\n');
        expect(findArrayIndexHints(src)).toEqual([]);
    });

    test('does not guess the last value when the step is not known', () => {
        const src = [
            'Kouka = [1, 5, 10]',
            'i を 0 から 3 まで s ずつ増やしながら',
            '  表示する(Kouka[i])',
            'を繰り返す',
        ].join('\n');
        expect(findArrayIndexHints(src)).toEqual([]);
    });

    test('does not check an array that a function parameter shadows', () => {
        const src = ['X = [1, 2, 3]', '関数 f(Y, X)', '  表示する(X[5])', 'と定義する', '表示する(X[5])'].join('\n');
        expect(findArrayIndexHints(src).map((h) => h.line)).toEqual([5]);
    });

    test('does not check an array that a DNCLv2 function parameter shadows', () => {
        const src = ['X = [1, 2, 3]', 'f(X) を定義する', '  表示する(X[5])', 'と定義する'].join('\n');
        expect(findArrayIndexHints(src)).toEqual([]);
    });

    test('does not use a loop bound that a function parameter shadows', () => {
        const src = [
            'n = 5',
            'X = [1, 2, 3]',
            '関数 f(n)',
            '  i を 0 から n まで 1 ずつ増やしながら',
            '    表示する(X[i])',
            '  を繰り返す',
            'と定義する',
            'j を 0 から n まで 1 ずつ増やしながら',
            '  表示する(X[j])',
            'を繰り返す',
        ].join('\n');
        expect(findArrayIndexHints(src).map((h) => h.line)).toEqual([9]);
    });

    test.each([
        ['push', 'X.push(i)'],
        ['insert', 'X.insert(0, i)'],
        ['delete_at', 'X.delete_at(0)'],
        ['clear', 'X.clear'],
    ])('does not check an array whose length changes (%s)', (_, call) => {
        const src = [
            'X = [0]',
            'i を 1 から 5 まで 1 ずつ増やしながら',
            `  ${call}`,
            'を繰り返す',
            'i を 0 から 5 まで 1 ずつ増やしながら',
            '  表示する(X[i])',
            'を繰り返す',
            '表示する(X[3])',
        ].join('\n');
        expect(findArrayIndexHints(src)).toEqual([]);
    });

    test('reports source lines of DNCLv2 code with line numbers', () => {
        const src = ['(01) Kouka = [1, 5, 10]', '(02) 表示する(Kouka[3])'].join('\n');
        expect(findArrayIndexHints(src).map((h) => h.line)).toEqual([2]);
    });
});
