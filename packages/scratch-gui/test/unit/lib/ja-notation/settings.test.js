/**
 * The settings of a program (J5 of docs/ruby-editor/converter-roadmap.md, docs/dncl/design.md 4 章):
 * read from the sentences at the top, kept in the JaAST (`program.settings`), and done on the
 * syntax tree when the Ruby is built (`A[i]` → `@A[i - 1]` with indexes from 1) and read back.
 * Each table is checked in both ways and for the round trip, wherever the index is.
 */
import { dnclToRuby } from '../../../../src/lib/dncl/dncl-to-ruby';
import { SMALRUBY_JA_NOTATION } from '../../../../src/lib/dncl/ja-notation-table';
import { rubyToDncl } from '../../../../src/lib/dncl/ruby-to-dncl';
import { DEFAULT_SETTINGS, jaToRuby, parse, readSettings, settingsSentences } from '../../../../src/lib/ja-notation';
import { loadPrism } from '../../../../src/lib/prism-parser';
import { recordJa } from './golden-record';

const lines = (...ls) => ls.join('\n');
const ONE = '# すべての配列の添字は 1 から始まる。';
const SLASH = '// 「//」から行の終わりまでは，処理の対象とならない。';
const RUBY_ONE = ONE;
const RUBY_SLASH = '# 「//」から行の終わりまでは，処理の対象とならない。';

beforeAll(() => loadPrism());

describe('readSettings: only the sentences of the settings are read', () => {
    test.each([
        [[], DEFAULT_SETTINGS],
        [[ONE], { ...DEFAULT_SETTINGS, indexBase: 1 }],
        [['# すべての配列の添字は０から始まる。'], DEFAULT_SETTINGS],
        [['#配列の添え字は １ から始まる'], { ...DEFAULT_SETTINGS, indexBase: 1 }],
        [[SLASH], { ...DEFAULT_SETTINGS, commentMarker: '//' }],
        [['# 「#」から行の終わりまでは，処理の対象とならない。'], DEFAULT_SETTINGS],
        [
            ['# 「and」は「かつ」を意味する論理演算子であり，左右の式がともに真のときにだけ真となる。'],
            { ...DEFAULT_SETTINGS, logicNote: true },
        ],
        // A comment that only talks about the indexes is a plain comment.
        [['# 添字は 1 から始まる（Nissu[1] が 1 月）'], DEFAULT_SETTINGS],
        [['# すべての配列の添字は 1 から始まる。と書く問題もある'], DEFAULT_SETTINGS],
    ])('%j', (comments, settings) => {
        expect(readSettings(comments)).toEqual(settings);
    });

    test('the settings are only read from the comments before the first line of code', () => {
        expect(parse(lines('(01) x = 1', ONE)).program.settings.indexBase).toBe(0);
        expect(parse(lines('', '(01) ' + ONE, '(02) x = 1')).program.settings.indexBase).toBe(1);
    });

    test('settingsSentences writes the sentences that read back as the same settings', () => {
        const settings = { indexBase: 1, commentMarker: '//', logicNote: true };
        const sentences = settingsSentences(settings);
        expect(sentences[0]).toBe(ONE);
        expect(readSettings(sentences)).toEqual(settings);
        expect(settingsSentences(DEFAULT_SETTINGS)).toEqual([]);
    });
});

describe('indexes from 1: Japanese → Ruby → Japanese', () => {
    // [the Japanese, the Ruby]: wherever the index is, the Ruby counts from 0.
    test.each([
        ['x = A[i]', '@x = @_array_A_[@i - 1]'],
        ['x = A[1]', '@x = @_array_A_[0]'],
        ['x = A[0]', '@x = @_array_A_[-1]'],
        ['x = A[i + 1]', '@x = @_array_A_[@i]'],
        // Only `+ 1` is taken off: `- 1` is added to any other index (the Ruby is read back the same).
        ['x = A[i - 1]', '@x = @_array_A_[@i - 1 - 1]'],
        ['x = A[i * 2]', '@x = @_array_A_[@i * 2 - 1]'],
        ['x = A[B[i]]', '@x = @_array_A_[@_array_B_[@i - 1] - 1]'],
        ['A[i] = 5', '@_array_A_[@i - 1] = 5'],
        ['A[i] += 5', '@_array_A_[@i - 1] += 5'],
        ['表示する(A[n] + 要素数(A))', 'puts(@_array_A_[@n - 1] + @_array_A_.length)'],
        ['もし A[i] > A[i + 1] ならば:\n    x = 1', 'if @_array_A_[@i - 1] > @_array_A_[@i]\n  @x = 1\nend'],
        ['x = A[2 + 1]', '@x = @_array_A_[2 + 1 - 1]'],
        ['x = A[i - 1 + 1]', '@x = @_array_A_[@i - 1 + 1 - 1]'],
    ])('%s', (ja, ruby) => {
        const source = lines(ONE, ja);
        const made = dnclToRuby(source);
        expect(made.errors).toEqual([]);
        expect(made.ruby).toBe(lines(RUBY_ONE, ruby));
        // ... and back: the same Japanese.
        expect(rubyToDncl(made.ruby).dncl).toBe(source);
    });

    test('without the sentence, the indexes are as written (from 0)', () => {
        expect(dnclToRuby('x = A[i]').ruby).toBe('@x = @_array_A_[@i]');
    });
});

describe('indexes from 1: Ruby → Japanese → Ruby', () => {
    test.each([
        ['@x = @_array_A_[@i - 1]', 'x = A[i]'],
        ['@x = @_array_A_[@i]', 'x = A[i + 1]'],
        ['@x = @_array_A_[0]', 'x = A[1]'],
        ['@x = @_array_A_[-1]', 'x = A[0]'],
        ['@x = @_array_A_[-3]', 'x = A[-2]'],
        ['@x = @_array_A_[@i + 1]', 'x = A[i + 1 + 1]'],
        ['@x = @_array_A_[@i - 2]', 'x = A[i - 2 + 1]'],
        ['@x = @_array_A_[@i - 1 - 1]', 'x = A[i - 1]'],
        ['@x = @_array_A_[@i + 1 - 1]', 'x = A[i + 1 - 1 + 1]'],
    ])('%s', (ruby, ja) => {
        const source = lines(RUBY_ONE, ruby);
        const back = rubyToDncl(source);
        expect(back.errors).toEqual([]);
        expect(back.dncl).toBe(lines(ONE, ja));
        expect(dnclToRuby(back.dncl).ruby).toBe(source);
    });
});

describe('the comment mark `//`', () => {
    test('`//` starts a comment, and the comments are written back with `//`', () => {
        const source = lines(SLASH, 'x = 7 // 7 を入れる', '// 表示する', '表示する(x ÷ 2)');
        const made = dnclToRuby(source);
        expect(made.ruby).toBe(lines(RUBY_SLASH, '@x = 7 # 7 を入れる', '# 表示する', 'puts((@x / 2).to_i)'));
        expect(rubyToDncl(made.ruby).dncl).toBe(source);
    });

    test('with the mark `#`, `//` is the integer quotient as before', () => {
        expect(dnclToRuby('x = 7 // 2').ruby).toBe('@x = (7 / 2).to_i');
    });

    test('`#` is still read as a comment', () => {
        expect(dnclToRuby(lines(SLASH, 'x = 1 # いち')).ruby).toBe(lines(RUBY_SLASH, '@x = 1 # いち'));
    });

    test('both settings together', () => {
        const source = lines(SLASH, '// すべての配列の添字は 1 から始まる。', 'x = A[i] // 1 番目から');
        const made = dnclToRuby(source);
        expect(made.ruby).toBe(
            lines(RUBY_SLASH, '# すべての配列の添字は 1 から始まる。', '@x = @_array_A_[@i - 1] # 1 番目から'),
        );
        expect(rubyToDncl(made.ruby).dncl).toBe(source);
    });
});

describe('the library without the table of Smalruby', () => {
    test('the settings are in the JaAST', () => {
        const { program, ruby } = jaToRuby(lines(ONE, 'A[i] = A[i + 1]'), {});
        expect(program.settings).toEqual({ ...DEFAULT_SETTINGS, indexBase: 1 });
        expect(ruby).toBe(lines(ONE, 'A[i - 1] = A[i]'));
    });

    test('the table of Smalruby gives no rule of its own about the settings', () => {
        expect(jaToRuby(lines(ONE, 'x = A[1]'), SMALRUBY_JA_NOTATION).ruby).toBe(lines(ONE, '@x = @_array_A_[0]'));
    });
});

describe('through the blocks, as the Japanese mode shows the program again', () => {
    test.each([
        ['indexes from 1', lines(ONE, 'Data = [3, 5, 7]', 'i = 2', '表示する(Data[i])', 'Data[1] = Data[i + 1]')],
        ['the comment mark //', lines(SLASH, 'x = 7 // なな', '表示する(x)')],
    ])('%s: the sentence stays a comment, so the program comes back the same', async (name, ja) => {
        const record = await recordJa(ja);
        expect(record.converterErrors).toEqual([]);
        expect(record.shown.ja).toBe(ja);
    });
});
