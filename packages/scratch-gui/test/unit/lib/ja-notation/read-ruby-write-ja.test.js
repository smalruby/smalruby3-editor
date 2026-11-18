/**
 * Ruby → Japanese through ja-notation (J4 of docs/ruby-editor/converter-roadmap.md): prism's
 * syntax tree is read into a JaAST (`readRuby`) and written in the standard form (`writeJa`).
 * The output for every program of the corpus is in the golden (golden.test.js); these are the
 * rules of the two steps and the round trip.
 */
import fs from 'fs';
import path from 'path';
import { dnclToRuby } from '../../../../src/lib/dncl/dncl-to-ruby';
import { rubyToDncl } from '../../../../src/lib/dncl/ruby-to-dncl';
import { rubyToJa, writeJa } from '../../../../src/lib/ja-notation';
import { loadPrism } from '../../../../src/lib/prism-parser';

const FIXTURES = path.resolve(__dirname, '../../../fixtures/ja-notation');
const readJson = (file) => JSON.parse(fs.readFileSync(path.join(FIXTURES, file), 'utf8'));
const lines = (...ls) => ls.join('\n');

let prism;
beforeAll(async () => {
    prism = await loadPrism();
});

describe('readRuby + writeJa without a table of a Ruby system', () => {
    const toJa = (ruby) => rubyToJa(ruby, { parse: (source) => prism.parse(source) });

    test('local variables, blocks and operators are written in the standard form', () => {
        const ruby = lines('x = 1', 'while x < 10 && !(x == 5)', '  x += 2', 'end');
        expect(toJa(ruby).ja).toBe(lines('x = 1', 'x < 10 and not (x == 5) の間繰り返す:', '    x += 2'));
    });

    test('a call the table does not have is told as an error at its name', () => {
        const { ja, errors } = toJa('move(10)');
        expect(ja).toBe('move(10)');
        expect(errors).toEqual([
            expect.objectContaining({ code: 'unknown-command', name: 'move', line: 1, column: 0 }),
        ]);
    });

    test('the post-test loop is told on its begin and while lines', () => {
        const { errors } = toJa(lines('begin', '  x = 1', 'end while x < 3'));
        expect(errors.map((e) => [e.code, e.line])).toEqual([
            ['post-test-loop', 1],
            ['post-test-loop', 3],
        ]);
    });
});

describe('writeJa', () => {
    const at = { line: 0, column: 0 };
    const name = (n) => ({ type: 'Name', name: n, ...at });
    const num = (v) => ({ type: 'Number', value: v, ...at });
    const bin = (operator, left, right) => ({ type: 'Binary', operator, left, right, ...at });
    const neg = (operand) => ({ type: 'Unary', operator: '-', operand, ...at });
    const not = (operand) => ({ type: 'Unary', operator: 'not', operand, ...at });
    const write = (value) => writeJa({ body: [{ type: 'Assign', target: name('x'), value }] });

    test.each([
        [
            'a minus before a quotient is on its left, as the Japanese reads it',
            bin('÷', neg(name('a')), num('2')),
            'x = -a ÷ 2',
        ],
        [
            'a sum under a quotient keeps its parentheses',
            bin('÷', bin('+', name('a'), name('b')), num('2')),
            'x = (a + b) ÷ 2',
        ],
        [
            'the right side of the same operator keeps its parentheses',
            bin('-', name('a'), bin('-', name('b'), name('c'))),
            'x = a - (b - c)',
        ],
        [
            'the left side of the same operator needs none',
            bin('-', bin('-', name('a'), name('b')), name('c')),
            'x = a - b - c',
        ],
        ['the remainder is ％', bin('%', name('a'), num('3')), 'x = a ％ 3'],
        ['not before a comparison inside a comparison', bin('==', not(name('a')), name('b')), 'x = (not a) == b'],
        ['and is tighter than or', bin('or', name('a'), bin('and', name('b'), name('c'))), 'x = a or b and c'],
        [
            'or under and keeps its parentheses',
            bin('and', bin('or', name('a'), name('b')), name('c')),
            'x = (a or b) and c',
        ],
        [
            'a range has no spaces',
            { type: 'Call', name: '乱数', args: [bin('..', num('1'), num('6'))], ...at },
            'x = 乱数(1..6)',
        ],
        ['a minus of a minus is in parentheses', neg(neg(num('1'))), 'x = -(-1)'],
    ])('%s', (_title, value, expected) => {
        expect(write(value)).toBe(expected);
    });

    test('a long chain is written without running out of the stack', () => {
        let value = name('a0');
        for (let i = 1; i < 20000; i++) value = bin('and', value, name(`a${i}`));
        const text = write(value);
        expect(text.startsWith('x = a0 and a1 and a2')).toBe(true);
        expect(text.endsWith('and a19999')).toBe(true);
    });

    test('the closing line is kept only where the indent cannot tell the end of the block', () => {
        const ruby = lines('if @a > 0', 'end', 'while @b', '  @b = 1', 'end # c', 'if @c', '  @d = 1', 'end', '# e');
        expect(rubyToDncl(ruby).dncl).toBe(
            lines(
                'もし a > 0 ならば:',
                'を実行する',
                'b の間繰り返す:',
                '    b = 1',
                'を繰り返す # c',
                'もし c ならば:',
                '    d = 1',
                'を実行する',
                '# e',
            ),
        );
    });
});

describe('the Smalruby Ruby of the Japanese mode', () => {
    test('a function without parameters goes back to `関数 名前():` and its call (#2166)', () => {
        const { dncl, errors } = rubyToDncl(lines('def greet', '  puts("hi")', 'end', '', 'greet'));
        expect(errors).toEqual([]);
        expect(dncl).toBe(lines('関数 greet():', '    表示する("hi")', '', 'greet'));
        expect(dnclToRuby(dncl).ruby).toBe(lines('def greet()', '  puts("hi")', 'end', '', 'greet'));
    });

    test('the quotient with a sign keeps its meaning both ways', () => {
        expect(rubyToDncl('@b = -(@a / 2).to_i').dncl).toBe('b = -a ÷ 2');
        expect(dnclToRuby('b = -a ÷ 2').ruby).toBe('@b = -((@a / 2).to_i)');
        // `(-a / 2).to_i` is not `-a ÷ 2` (the Japanese reads it as `-(a ÷ 2)`).
        expect(rubyToDncl('@b = (-@a / 2).to_i').dncl).toBe('b = 整数(-a / 2)');
    });

    test('rubyToDncl needs prism to be loaded', () => {
        expect(prism).toBeTruthy();
    });
});

describe('Japanese → Ruby → Japanese is stable', () => {
    const corpus = readJson('corpus/ja.json');
    const golden = readJson('golden/ja.json');
    const programs = [
        ...corpus.map((entry) => [entry.id, entry.ja]),
        ...Object.entries(golden)
            .filter(([, record]) => record.shown)
            .map(([id, record]) => [`${id} (shown)`, record.shown.ja]),
    ];

    test('the corpus has the programs', () => {
        expect(programs.length).toBeGreaterThan(1000);
    });

    test.each(programs)('%s', (_id, ja) => {
        const ruby = dnclToRuby(ja).ruby;
        if (ruby === null) return;
        const written = rubyToDncl(ruby);
        expect(written.errors).toEqual([]);
        const again = dnclToRuby(written.dncl).ruby;
        expect(again).not.toBeNull();
        expect(rubyToDncl(again).dncl).toBe(written.dncl);
    });
});
