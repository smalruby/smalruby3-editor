import {
    findOneBasedSuspects,
    hasOneBasedIndexNote,
    shiftArrayIndexes,
} from '../../../../src/lib/dncl/dncl-paste-index-shift';

// The 2025 共通テスト「情報I」第3問 program with its 1-based note
// (Issues #1357 / #1366).
const KOUGEIHIN = [
    '# 配列の添字は1から始まる',
    'Nissu = [4, 1, 3, 1, 3, 4, 2, 4, 3]',
    'kougeihinsu = 9',
    'Akibi = [1, 1, 1]',
    'buinsu = 3',
    'kougeihin を 1 から kougeihinsu まで 1 ずつ増やしながら',
    '  tantou = 1',
    '  buin を 2 から buinsu まで 1 ずつ増やしながら',
    '    もし Akibi[buin] < Akibi[tantou] ならば',
    '      tantou = buin',
    '    を実行する',
    '  を繰り返す',
    '  表示する("工芸品" + 文字列(kougeihin) + "日目~" + 文字列(Nissu[kougeihin]))',
    '  Akibi[tantou] = Akibi[tantou] + Nissu[kougeihin]',
    'を繰り返す',
].join('\n');

describe('hasOneBasedIndexNote', () => {
    test.each([
        '# 配列の添字は1から始まる',
        '# 添字は1から',
        '#（添字は1から始まる．）',
        '# 配列 Akibi の添字は１から始まる。',
        'Nissu = [4, 1, 3] # 添え字は 1 から',
        '// 添字は1から始まる',
        '# インデックスは1から',
    ])('finds the note in %p', (text) => {
        expect(hasOneBasedIndexNote(`a = 1\n${text}\nb = 2`)).toBe(true);
    });

    test.each([
        'Akibi[1] = 3',
        '# 添字は0から始まる',
        '# 添字は10から',
        '表示する("添字は1から始まる")',
        '# 1から10まで足す',
    ])('ignores %p', (text) => {
        expect(hasOneBasedIndexNote(text)).toBe(false);
    });

    test('finds the note in the 共通テスト sample', () => {
        expect(hasOneBasedIndexNote(KOUGEIHIN)).toBe(true);
    });
});

describe('shiftArrayIndexes', () => {
    const shift = (text) => shiftArrayIndexes(text).text;

    test('subtracts 1 from a number index', () => {
        expect(shift('Akibi[1] = 3')).toBe('Akibi[0] = 3');
    });

    test('adds - 1 to an expression index', () => {
        expect(shift('x = Akibi[tantou]')).toBe('x = Akibi[tantou - 1]');
    });

    test('folds + 1 and - k', () => {
        expect(shift('x = Nissu[i + 1] + Nissu[i - 1]')).toBe('x = Nissu[i] + Nissu[i - 2]');
    });

    test('shifts each index of a 2-dimensional array', () => {
        expect(shift('Data[i, 2] = Data[1, j]')).toBe('Data[i - 1, 1] = Data[0, j - 1]');
    });

    test('shifts chained and nested accesses', () => {
        expect(shift('x = Data[i][j]')).toBe('x = Data[i - 1][j - 1]');
        expect(shift('x = A[B[i]]')).toBe('x = A[B[i - 1] - 1]');
    });

    test('keeps array literals, strings and comments', () => {
        expect(shift('Nissu = [4, 1, 3]')).toBe('Nissu = [4, 1, 3]');
        expect(shift('Data = [[1, 2], [3, 4]]')).toBe('Data = [[1, 2], [3, 4]]');
        expect(shift('表示する("A[1]", Akibi[1]) # Akibi[1] は最初')).toBe('表示する("A[1]", Akibi[0]) # Akibi[1] は最初');
        expect(shift('表示する(「A[1]」)')).toBe('表示する(「A[1]」)');
    });

    test('keeps the DNCLv2 block markers and the line ending', () => {
        expect(shift('｜ Akibi[tantou] = 0\r\n⎿ x = Akibi[2]')).toBe('｜ Akibi[tantou - 1] = 0\r\n⎿ x = Akibi[1]');
    });

    test('reports where it rewrote', () => {
        const { text, changes } = shiftArrayIndexes('y = 1\n  Akibi[tantou] = Nissu[i + 1]');
        expect(text).toBe('y = 1\n  Akibi[tantou - 1] = Nissu[i]');
        expect(changes).toEqual([
            { line: 2, start: 2, end: 19, before: 'Akibi[tantou]', after: 'Akibi[tantou - 1]' },
            { line: 2, start: 22, end: 30, before: 'Nissu[i + 1]', after: 'Nissu[i]' },
        ]);
        const line = text.split('\n')[1];
        for (const change of changes) {
            expect(line.substring(change.start, change.end)).toBe(change.after);
        }
    });

    test('reports nested accesses at their place in the rewritten line', () => {
        const { text, changes } = shiftArrayIndexes('x = A[B[i]] + C[1][2]');
        expect(text).toBe('x = A[B[i - 1] - 1] + C[0][1]');
        for (const change of changes) {
            expect(text.substring(change.start, change.end)).toBe(change.after);
        }
        expect(changes.map((c) => c.before)).toEqual(['B[i]', 'A[B[i]]', 'C[1][2]']);
    });

    test('shifts the 共通テスト sample', () => {
        const { text, changes } = shiftArrayIndexes(KOUGEIHIN);
        const lines = text.split('\n');
        expect(lines[0]).toBe('# 配列の添字は1から始まる');
        expect(lines[1]).toBe('Nissu = [4, 1, 3, 1, 3, 4, 2, 4, 3]');
        expect(lines[8]).toBe('    もし Akibi[buin - 1] < Akibi[tantou - 1] ならば');
        expect(lines[12]).toBe('  表示する("工芸品" + 文字列(kougeihin) + "日目~" + 文字列(Nissu[kougeihin - 1]))');
        expect(lines[13]).toBe('  Akibi[tantou - 1] = Akibi[tantou - 1] + Nissu[kougeihin - 1]');
        expect(changes).toHaveLength(6);
    });

    test('leaves text without arrays unchanged', () => {
        expect(shiftArrayIndexes('a = 1\nb = 2')).toEqual({ text: 'a = 1\nb = 2', changes: [] });
    });

    test('does not report accesses that were left unchanged', () => {
        expect(shiftArrayIndexes('x = A["k"] + B[]')).toEqual({ text: 'x = A["k"] + B[]', changes: [] });
    });

    test('reports a chain once even when its first index is a string key', () => {
        const { text, changes } = shiftArrayIndexes('x = A["k"][1] + B[2]["k"]');
        expect(text).toBe('x = A["k"][0] + B[1]["k"]');
        expect(changes.map((c) => [c.before, c.after])).toEqual([
            ['A["k"][1]', 'A["k"][0]'],
            ['B[2]["k"]', 'B[1]["k"]'],
        ]);
    });
});

describe('findOneBasedSuspects', () => {
    test('finds the 1-based lines of the 共通テスト sample', () => {
        const suspects = findOneBasedSuspects(shiftArrayIndexes(KOUGEIHIN).text);
        expect(suspects.map(({ line, text, reasons, usedAsIndex }) => ({ line, text, reasons, usedAsIndex }))).toEqual([
            {
                line: 6,
                text: 'kougeihin を 1 から kougeihinsu まで 1 ずつ増やしながら',
                reasons: ['loopFromOne'],
                usedAsIndex: true,
            },
            { line: 7, text: 'tantou = 1', reasons: ['assignOne'], usedAsIndex: true },
            {
                line: 8,
                text: 'buin を 2 から buinsu まで 1 ずつ増やしながら',
                reasons: ['loopFromN'],
                usedAsIndex: true,
            },
        ]);
    });

    test('gives the columns of the statement', () => {
        const [suspect] = findOneBasedSuspects('｜ tantou = 1');
        expect(suspect).toMatchObject({ line: 1, start: 2, end: 12 });
    });

    test('finds a loop up to 要素数(X)', () => {
        const src = ['i を 0 から 要素数(Kouka) まで 1 ずつ増やしながら', '  表示する(Kouka[i])', 'を繰り返す'].join('\n');
        expect(findOneBasedSuspects(src)).toMatchObject([{ line: 1, reasons: ['loopToLength'] }]);
    });

    test('finds <= bounds of index variables', () => {
        const src = ['i = 0', 'i <= 要素数(Kouka) の間', '  表示する(Kouka[i])', '  i = i + 1', 'を繰り返す'].join('\n');
        expect(findOneBasedSuspects(src)).toMatchObject([{ line: 2, reasons: ['lessEqual'], usedAsIndex: true }]);
        expect(findOneBasedSuspects('もし a <= b ならば')).toEqual([]);
    });

    test('ignores 0-based code', () => {
        const src = [
            'Kouka = [1, 5, 10]',
            'i を 0 から 要素数(Kouka) - 1 まで 1 ずつ増やしながら',
            '  表示する(Kouka[i])',
            'を繰り返す',
        ].join('\n');
        expect(findOneBasedSuspects(src)).toEqual([]);
    });

    test('ignores strings and comments', () => {
        expect(findOneBasedSuspects('表示する("i = 1") # i を 1 から n まで')).toEqual([]);
    });
});
