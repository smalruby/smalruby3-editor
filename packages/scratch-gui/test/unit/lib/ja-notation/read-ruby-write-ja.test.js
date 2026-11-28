/**
 * Ruby → Japanese through ja-notation (J4 of docs/ruby-editor/converter-roadmap.md): prism's
 * syntax tree is read into a JaAST (`readRuby`) and written in the standard form (`writeJa`).
 * The output for every program of the corpus is in the golden (golden.test.js); these are the
 * rules of the two steps with the table of Smalruby and the round trip. The library with no
 * table is tested in packages/ja-notation/ (its JSON test data).
 */
import fs from 'fs';
import path from 'path';
import { dnclToRuby } from '../../../../src/lib/dncl/dncl-to-ruby';
import { rubyToDncl } from '../../../../src/lib/dncl/ruby-to-dncl';
import { loadPrism } from '../../../../src/lib/prism-parser';

const FIXTURES = path.resolve(__dirname, '../../../fixtures/ja-notation');
const readJson = (file) => JSON.parse(fs.readFileSync(path.join(FIXTURES, file), 'utf8'));
const lines = (...ls) => ls.join('\n');

let prism;
beforeAll(async () => {
    prism = await loadPrism();
});

describe('writeJa through rubyToDncl', () => {
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
        const { dncl, errors } = rubyToDncl(lines('def greet', '  console.puts("hi")', 'end', '', 'greet'));
        expect(errors).toEqual([]);
        expect(dncl).toBe(lines('関数 greet():', '    表示する("hi")', '', 'greet'));
        expect(dnclToRuby(dncl).ruby).toBe(lines('def greet()', '  console.puts("hi")', 'end', '', 'greet'));
    });

    // A sign binds tighter than `÷` (`-7 ÷ 2` is `-4`, docs/smalruby-dncl-spec.ja.md, #2548).
    test.each([
        ['b = 7 ÷ 2', '@b = (7 / 2).to_i', 'b = 7 ÷ 2'],
        ['b = -7 ÷ 2', '@b = (-7 / 2).to_i', 'b = -7 ÷ 2'],
        ['b = -a ÷ 2', '@b = (-@a / 2).to_i', 'b = (-a) ÷ 2'],
        ['b = (-a) ÷ 2', '@b = (-@a / 2).to_i', 'b = (-a) ÷ 2'],
        ['b = -(a ÷ 2)', '@b = -((@a / 2).to_i)', 'b = -(a ÷ 2)'],
    ])('the quotient with a sign keeps its meaning both ways: %s', (ja, ruby, back) => {
        expect(dnclToRuby(ja).ruby).toBe(ruby);
        expect(rubyToDncl(ruby).dncl).toBe(back);
        expect(dnclToRuby(back).ruby).toBe(ruby);
    });

    test('a sign before the quotient written in Ruby without parentheses is outside the quotient', () => {
        expect(rubyToDncl('@b = -(@a / 2).to_i').dncl).toBe('b = -(a ÷ 2)');
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
