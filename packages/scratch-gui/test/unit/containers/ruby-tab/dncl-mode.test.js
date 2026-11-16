// The editor indents the line after an opener of both forms (Issue #1754).
import { dnclLanguageConfiguration } from '../../../../src/containers/ruby-tab/dncl-mode';

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
