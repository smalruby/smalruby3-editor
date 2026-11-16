// The editor indents the line after an opener of both forms (Issue #1754).
import { dnclLanguage, dnclLanguageConfiguration } from '../../../../src/containers/ruby-tab/dncl-mode';

const { increaseIndentPattern } = dnclLanguageConfiguration.indentationRules;

describe('DNCL mode: indent after an opener (Issue #1754)', () => {
    test.each([
        'もし a > 0 ならば:',
        'もし a > 0 ならば：',
        'もし a > 0 ならば: # 正のとき',
        'そうでなくもし a < 0 ならば:',
        'そうでなければ:',
        'a < 10 の間繰り返す:',
        'i を 1 から 10 まで 1 ずつ増やしながら繰り返す:',
        '関数 twice(x):',
        // DNCL 風の形
        'もし a > 0 ならば',
        'a < 10 の間',
        'i を 1 から 10 まで 1 ずつ増やしながら',
    ])('indents after %s', (line) => {
        expect(increaseIndentPattern.test(line)).toBe(true);
    });

    test.each(['a = 1', '表示する(a)', 'x * 2 を返す', 'を実行する'])('does not indent after %s', (line) => {
        expect(increaseIndentPattern.test(line)).toBe(false);
    });
});

describe('DNCL mode: the words of the standard form are colored (Issue #2035)', () => {
    test.each(['and', 'or', 'not', 'かつ', 'または', 'でない'])('%s is an operator', (word) => {
        expect(dnclLanguage.operators).toContain(word);
    });

    test.each(['の間繰り返す', 'ずつ増やしながら繰り返す', 'ずつ減らしながら繰り返す', 'を返す'])(
        '%s is a keyword',
        (word) => {
            expect(dnclLanguage.controlKeywords).toContain(word);
        },
    );

    test('the full-width ％ is an operator symbol', () => {
        expect(dnclLanguage.symbols.test('％')).toBe(true);
    });
});
