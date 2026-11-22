import { hasOneBasedIndexNote } from '../../../../src/lib/dncl/dncl-index-note';

// A program made for the test in the notation of the problems, with its note.
const SAMPLE = [
    '# 配列の添字は1から始まる',
    'Kosu = [3, 1, 2]',
    'goukei = 0',
    'i を 1 から 3 まで 1 ずつ増やしながら繰り返す:',
    '    goukei = goukei + Kosu[i]',
    '表示する(goukei)',
].join('\n');

describe('hasOneBasedIndexNote', () => {
    test.each([
        '# 配列の添字は1から始まる',
        '# 添字は1から',
        '#（添字は1から始まる．）',
        '# 配列 Kiroku の添字は１から始まる。',
        'Ten = [7, 3, 9] # 添え字は 1 から',
        '// 添字は1から始まる',
        '# インデックスは1から',
    ])('finds the note in %p', (text) => {
        expect(hasOneBasedIndexNote(`a = 1\n${text}\nb = 2`)).toBe(true);
    });

    test.each([
        'Kiroku[1] = 3',
        '# 添字は0から始まる',
        '# 添字は10から',
        '表示する("添字は1から始まる")',
        '# 1から10まで足す',
    ])('ignores %p', (text) => {
        expect(hasOneBasedIndexNote(text)).toBe(false);
    });

    test('finds the note in a program', () => {
        expect(hasOneBasedIndexNote(SAMPLE)).toBe(true);
    });
});
