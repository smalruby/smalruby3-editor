import {
    dnclSettingsPatternId,
    dnclWithIndexFromOne,
    dnclWithSettingsPattern,
} from '../../../../src/lib/dncl/dncl-settings';
import { loadPrism } from '../../../../src/lib/prism-parser';

beforeAll(() => loadPrism());

const INDEX_FROM_ONE = '# すべての配列の添字は 1 から始まる。';
const LOGIC_NOTES = [
    '# 「and」は「かつ」を意味する論理演算子であり，左右の式がともに真のときにだけ真となる。',
    '# 「or」は「または」を意味する論理演算子であり，左右の式の少なくとも一方が真のときに真となる。',
    '# 「not」は「でない」を意味する論理演算子であり，右の式が偽のときにだけ真となる。',
];

describe('dnclSettingsPatternId', () => {
    test.each([
        ['no sentence: the form of 例示', 'A = [1, 2]', 'example'],
        [
            'indexes from 1 and the logical operators',
            [INDEX_FROM_ONE, ...LOGIC_NOTES, 'A = [1]'].join('\n'),
            'indexFromOne',
        ],
        ['indexes from 1 alone is no pattern', `${INDEX_FROM_ONE}\nA = [1]`, null],
        ['the comment mark // is no pattern', '# 「//」から行の終わりまでは，処理の対象とならない。', null],
    ])('%s', (_title, dncl, id) => {
        expect(dnclSettingsPatternId(dncl)).toBe(id);
    });
});

describe('dnclWithSettingsPattern', () => {
    test('writes the sentences of indexes from 1 and the same program by them', () => {
        const out = dnclWithSettingsPattern('# 問題\nA = [5, 6]\n表示する(A[0])', 'indexFromOne');
        expect(out).toBe([INDEX_FROM_ONE, ...LOGIC_NOTES, '# 問題', 'A = [5, 6]', '表示する(A[1])'].join('\n'));
        expect(dnclSettingsPatternId(out)).toBe('indexFromOne');
    });

    test('goes back to the form of 例示', () => {
        const dncl = [INDEX_FROM_ONE, ...LOGIC_NOTES, 'A = [5, 6]', 'i = 2', '表示する(A[i])'].join('\n');
        expect(dnclWithSettingsPattern(dncl, 'example')).toBe('A = [5, 6]\ni = 2\n表示する(A[i - 1])');
    });

    test('a program written by the pattern stays the same', () => {
        const dncl = [INDEX_FROM_ONE, ...LOGIC_NOTES, 'A = [5, 6]', '表示する(A[2])'].join('\n');
        expect(dnclWithSettingsPattern(dncl, 'indexFromOne')).toBe(dncl);
    });

    test('a program that cannot become Ruby keeps its code, only the sentences change', () => {
        const dncl = 'A = [5, 6]\nもし A[0] ならば';
        expect(dnclWithSettingsPattern(dncl, 'indexFromOne')).toBe([INDEX_FROM_ONE, ...LOGIC_NOTES, dncl].join('\n'));
    });

    test('an unknown pattern changes nothing', () => {
        expect(dnclWithSettingsPattern('A = [1]', 'nothing')).toBe('A = [1]');
    });
});

describe('dnclWithIndexFromOne', () => {
    test('writes the sentence at the top and keeps the indexes', () => {
        expect(dnclWithIndexFromOne('# 配列の添字は1から始まるものとする\nA = [1, 2]\n表示する(A[1])')).toBe(
            `${INDEX_FROM_ONE}\n# 配列の添字は1から始まるものとする\nA = [1, 2]\n表示する(A[1])`,
        );
    });

    test('a sentence of the setting at the top is the setting already', () => {
        expect(dnclWithIndexFromOne('# 配列の添字は1から始まる\nA = [1]')).toBeNull();
    });

    test('keeps the other settings', () => {
        const dncl = '# 「//」から行の終わりまでは，処理の対象とならない。\na = 1 // c';
        expect(dnclWithIndexFromOne(dncl)).toBe(`${INDEX_FROM_ONE}\n${dncl}`);
    });

    test('nothing to do when the indexes start at 1 already', () => {
        expect(dnclWithIndexFromOne(`${INDEX_FROM_ONE}\nA = [1]`)).toBeNull();
    });
});
