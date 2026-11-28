/**
 * Japanese that makes Ruby with no blocks is told on its Japanese line, in
 * Japanese words, while the student writes in the Japanese tab and before the
 * program goes to the Ruby tab (Issue #2547).
 */
import { createIntl } from 'react-intl';
import {
    japaneseBlockErrors,
    joinsStringAndNumber,
    STRING_PLUS_NUMBER_ERROR_ID,
    withStringPlusNumberIds,
} from '../../../../src/lib/dncl/dncl-block-check';
import { loadPrism } from '../../../../src/lib/prism-parser';
import ja from '../../../../src/locales/ja';
import { makeConverter, makeSpriteTarget } from '../../helpers/ruby-roundtrip-helper';

beforeAll(() => loadPrism());

const intl = createIntl({ locale: 'ja', messages: ja });

// The dry run of the editor: convert the Ruby, never apply the blocks.
const convert = async (ruby) => {
    const { target, runtime } = makeSpriteTarget();
    const converter = makeConverter(target, runtime, { version: '2' });
    converter.setTranslatorFunction(intl.formatMessage);
    const result = await converter.targetCodeToBlocks(target, ruby);
    return { result, errors: converter.errors };
};

const errorsOf = (dncl) => japaneseBlockErrors(dncl, convert);

describe('japaneseBlockErrors', () => {
    test('Japanese that becomes blocks has no errors', async () => {
        expect(await errorsOf('a = 3\n表示する("残り" + a)')).toEqual([]);
    });

    test('the way the error of + of a string and a number says becomes blocks', async () => {
        expect(await errorsOf('表示する("残り" + 文字列(3))')).toEqual([]);
        expect(await errorsOf('表示する("残り3")')).toEqual([]);
    });

    test('Japanese that makes no Ruby is left to the errors of dnclToRuby', async () => {
        expect(await errorsOf('もし a > 1 ならば:\n    表示する(a)\nを繰り返す')).toBeNull();
    });

    test.each([
        ['表示する("a" + 1 + 2)', 0],
        ['表示する("残り" + 3)', 0],
        ['s = "a" + 1', 0],
        ['x = 1\n表示する(x)\n表示する(3 + "日")', 2],
    ])('a string and a number literal joined with + (%s)', async (dncl, row) => {
        const errors = await errorsOf(dncl);
        expect(errors).toHaveLength(1);
        expect(errors[0]).toMatchObject({ row, column: 0, id: STRING_PLUS_NUMBER_ERROR_ID });
    });

    test('a multiple assignment that has no blocks, on its Japanese line', async () => {
        const errors = await errorsOf('a = 1\nb = 2\na, b = b, a');
        expect(errors).toHaveLength(1);
        expect(errors[0].row).toBe(2);
        expect(errors[0].id).toBeUndefined();
        expect(errors[0].text).toBe(
            '「a, b = b, a」は命令がまちがっています。\nつづりを確認するか、対応しているブロックを使ってください。',
        );
    });

    test('a change of an argument says the words of the spec (7 章)', async () => {
        const errors = await errorsOf('関数 f(a):\n    a = a + 1\n    表示する(a)\nf(1)');
        expect(errors).toHaveLength(1);
        expect(errors[0].row).toBe(1);
        expect(errors[0].text).toMatch(/^「a」は引数なので、値を変えられません。/);
    });

    test('the line number and the ruled lines of the problem form stay on their line', async () => {
        const errors = await errorsOf('(01) a = 1\n(02) b = 2\n(03) a, b = b, a');
        expect(errors.map((err) => err.row)).toEqual([2]);
        expect(errors[0].text).toMatch(/^「a, b = b, a」は命令がまちがっています。/);
    });
});

describe('joinsStringAndNumber', () => {
    test.each([
        '表示する("a" + 1)',
        "表示する('a' + 1.5)",
        '表示する(「残り」 ＋ ３)',
        '表示する(1 + "a")',
        's = "a" + 1 # comment',
    ])('takes %s', (line) => {
        expect(joinsStringAndNumber(line)).toBe(true);
    });

    test.each([
        '表示する("残り" + a)',
        '表示する("a" + a1)',
        '表示する(a1 + "a")',
        '表示する("a" + "1")',
        '表示する(1 + 2)',
        '表示する("a", 1 + 2)',
        '表示する("a" + 文字列(1))',
        '# "a" + 1',
        '表示する("1 + "a"")',
    ])('does not take %s', (line) => {
        expect(joinsStringAndNumber(line)).toBe(false);
    });
});

// The conversion of the Code tab gives its errors the same id, so it says the same words.
describe('withStringPlusNumberIds', () => {
    test('gives the id only to the errors on a line with such a +', () => {
        const lines = ['a = 1', '表示する("残り" + 3)'];
        const errors = [
            { row: 0, column: 0, text: 'x' },
            { row: 1, column: 0, text: 'y' },
        ];
        expect(withStringPlusNumberIds(errors, lines)).toEqual([
            { row: 0, column: 0, text: 'x' },
            { row: 1, column: 0, text: 'y', id: STRING_PLUS_NUMBER_ERROR_ID },
        ]);
    });
});
