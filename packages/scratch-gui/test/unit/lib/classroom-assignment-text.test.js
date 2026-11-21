import { parseAssignmentText, parseInline, plainAssignmentLine } from '../../../src/lib/classroom-assignment-text.js';

const text = (t) => ({ type: 'text', text: t });
const hl = (t) => ({ type: 'highlight', text: t });
const label = (t) => ({ type: 'label', text: t });

describe('parseInline', () => {
    test('plain text stays one piece', () => {
        expect(parseInline('ねこをうごかそう')).toEqual([text('ねこをうごかそう')]);
    });

    test('empty line has no pieces', () => {
        expect(parseInline('')).toEqual([]);
        expect(parseInline(null)).toEqual([]);
    });

    test('*words* is highlighted', () => {
        expect(parseInline('まず *旗* を押す')).toEqual([text('まず '), hl('旗'), text(' を押す')]);
    });

    test('**words** is highlighted too (markdown habit)', () => {
        expect(parseInline('**かならず**提出')).toEqual([hl('かならず'), text('提出')]);
    });

    test('several highlights on one line', () => {
        expect(parseInline('*a*と*b*')).toEqual([hl('a'), text('と'), hl('b')]);
    });

    test('a lone * stays literal', () => {
        expect(parseInline('2 * 3')).toEqual([text('2 * 3')]);
        expect(parseInline('*')).toEqual([text('*')]);
    });

    test('** with nothing inside stays literal', () => {
        expect(parseInline('**')).toEqual([text('**')]);
        expect(parseInline('a ** b')).toEqual([text('a ** b')]);
    });

    test('an unclosed * stays literal', () => {
        expect(parseInline('*ひらいたまま')).toEqual([text('*ひらいたまま')]);
    });

    test('words that start or end with a space are not highlighted (2 * 3 * 4)', () => {
        expect(parseInline('2 * 3 * 4')).toEqual([text('2 * 3 * 4')]);
    });

    test('【…】 is a label', () => {
        expect(parseInline('【ポイント】よく見よう')).toEqual([label('ポイント'), text('よく見よう')]);
    });

    test('empty 【】 stays literal', () => {
        expect(parseInline('【】')).toEqual([text('【】')]);
    });

    test('marks inside a label stay literal', () => {
        expect(parseInline('【*注意*】')).toEqual([label('*注意*')]);
    });

    test('HTML is just text', () => {
        expect(parseInline('<b>x</b> <a href="y">z</a>')).toEqual([text('<b>x</b> <a href="y">z</a>')]);
    });
});

describe('parseAssignmentText', () => {
    test('empty text has no heading and no blocks', () => {
        expect(parseAssignmentText('')).toEqual({ heading: null, blocks: [] });
        expect(parseAssignmentText(null)).toEqual({ heading: null, blocks: [] });
        expect(parseAssignmentText('\n  \n')).toEqual({ heading: null, blocks: [] });
    });

    test('a one-line text is only a heading', () => {
        expect(parseAssignmentText('ねこを歩かせよう')).toEqual({
            heading: [text('ねこを歩かせよう')],
            blocks: [],
        });
    });

    test('first line is the heading, the rest a paragraph', () => {
        expect(parseAssignmentText('タイトル\n1 行目\n2 行目')).toEqual({
            heading: [text('タイトル')],
            blocks: [{ type: 'paragraph', lines: [[text('1 行目')], [text('2 行目')]] }],
        });
    });

    test('leading blank lines are skipped before the heading', () => {
        expect(parseAssignmentText('\n\nタイトル').heading).toEqual([text('タイトル')]);
    });

    test('a blank line breaks paragraphs', () => {
        expect(parseAssignmentText('見出し\nあ\n\nい').blocks).toEqual([
            { type: 'paragraph', lines: [[text('あ')]] },
            { type: 'paragraph', lines: [[text('い')]] },
        ]);
    });

    test('CRLF and CR are line breaks', () => {
        expect(parseAssignmentText('見出し\r\nあ\r\n\r\nい\rう').blocks).toEqual([
            { type: 'paragraph', lines: [[text('あ')]] },
            { type: 'paragraph', lines: [[text('い')], [text('う')]] },
        ]);
    });

    test('numbered lines are an ordered list with the teacher numbers', () => {
        expect(parseAssignmentText('やること\n1. ねこを出す\n2.旗を押す\n10．おわり').blocks).toEqual([
            {
                type: 'list',
                ordered: true,
                items: [
                    { number: 1, pieces: [text('ねこを出す')] },
                    { number: 2, pieces: [text('旗を押す')] },
                    { number: 10, pieces: [text('おわり')] },
                ],
            },
        ]);
    });

    test('full-width digits are numbers', () => {
        expect(parseAssignmentText('見出し\n１．ひとつめ').blocks[0].items[0].number).toBe(1);
    });

    test('a decimal like 1.5 is not a list item', () => {
        expect(parseAssignmentText('見出し\n1.5 秒まつ').blocks).toEqual([
            { type: 'paragraph', lines: [[text('1.5 秒まつ')]] },
        ]);
    });

    test('・ and "- " lines are a bulleted list', () => {
        expect(parseAssignmentText('見出し\n・あ\n- い').blocks).toEqual([
            {
                type: 'list',
                ordered: false,
                items: [
                    { number: null, pieces: [text('あ')] },
                    { number: null, pieces: [text('い')] },
                ],
            },
        ]);
    });

    test('"-" without a space is not a bullet (e.g. -1)', () => {
        expect(parseAssignmentText('見出し\n-1 にする').blocks[0].type).toBe('paragraph');
    });

    test('a different kind of list starts a new list; text after a list is a paragraph', () => {
        const { blocks } = parseAssignmentText('見出し\n1. a\n・b\nc');
        expect(blocks.map((b) => (b.type === 'list' ? `list:${b.ordered}` : b.type))).toEqual([
            'list:true',
            'list:false',
            'paragraph',
        ]);
    });

    test('a first line that is a list item is not a heading', () => {
        expect(parseAssignmentText('・あ\n・い')).toEqual({
            heading: null,
            blocks: [
                {
                    type: 'list',
                    ordered: false,
                    items: [
                        { number: null, pieces: [text('あ')] },
                        { number: null, pieces: [text('い')] },
                    ],
                },
            ],
        });
    });

    test('marks inside the heading and list items', () => {
        const parsed = parseAssignmentText('【課題】*ねこ*を動かす\n・*旗*を押す');
        expect(parsed.heading).toEqual([label('課題'), hl('ねこ'), text('を動かす')]);
        expect(parsed.blocks[0].items[0].pieces).toEqual([hl('旗'), text('を押す')]);
    });

    test('a highlight does not span lines', () => {
        expect(parseAssignmentText('見出し\n*あ\nい*').blocks[0].lines).toEqual([[text('*あ')], [text('い*')]]);
    });
});

describe('plainAssignmentLine', () => {
    test('drops the highlight marks and keeps the label brackets', () => {
        expect(plainAssignmentLine('【課題】*ねこ*を動かす')).toBe('【課題】ねこを動かす');
    });

    test('literal text stays as it is', () => {
        expect(plainAssignmentLine('2 * 3')).toBe('2 * 3');
    });
});
