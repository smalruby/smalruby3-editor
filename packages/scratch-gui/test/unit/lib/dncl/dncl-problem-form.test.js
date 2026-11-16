import { tidyPastedDncl } from '../../../../src/lib/dncl/dncl-paste-tidy';
import { layoutProblemForm, problemFormLabel, problemFormText } from '../../../../src/lib/dncl/dncl-problem-form';
import { dnclToRuby } from '../../../../src/lib/dncl/dncl-to-ruby';

// The programs are written for these tests in the style of the 共通テスト
// notation; no question of the test is used (docs/dncl/policy.md).
const rulesOf = (code) => layoutProblemForm(code).map((line) => line.rules.map((rule) => rule.kind).join(' '));

describe('problemFormLabel', () => {
    test('pads the number to 2 digits', () => {
        expect(problemFormLabel(1, 9)).toBe('(01)');
        expect(problemFormLabel(12, 30)).toBe('(12)');
    });

    test('pads to 3 digits when the program has 100 lines or more', () => {
        expect(problemFormLabel(7, 120)).toBe('(007)');
        expect(problemFormLabel(120, 120)).toBe('(120)');
    });
});

describe('layoutProblemForm', () => {
    test('a line out of any block has no rules', () => {
        expect(layoutProblemForm('kazu = 3\n表示する(kazu)')).toEqual([
            { lineNumber: 1, label: '(01)', indent: 0, rules: [] },
            { lineNumber: 2, label: '(02)', indent: 0, rules: [] },
        ]);
    });

    test('the lines of a block have a bar and the last one an L', () => {
        const code = [
            'i を 1 から 3 まで 1 ずつ増やしながら繰り返す:',
            '    goukei = goukei + i',
            '    表示する(goukei)',
            '表示する("おわり")',
        ].join('\n');
        expect(rulesOf(code)).toEqual(['', 'bar', 'end', '']);
    });

    test('the rule is drawn at the indent of the header', () => {
        const code = ['もし x > 0 ならば:', '    もし y > 0 ならば:', '        z = 1'].join('\n');
        expect(layoutProblemForm(code)[2].rules).toEqual([
            { column: 0, kind: 'end' },
            { column: 4, kind: 'end' },
        ]);
    });

    test('an inner block that ends keeps the bar of the outer one', () => {
        const code = [
            'i を 1 から 3 まで 1 ずつ増やしながら繰り返す:',
            '    もし i > 1 ならば:',
            '        表示する(i)',
            '    kaisu = kaisu + 1',
        ].join('\n');
        expect(rulesOf(code)).toEqual(['', 'bar', 'bar end', 'end']);
    });

    test('only the last branch of if/else ends with an L', () => {
        const code = [
            'もし ten >= 80 ならば:',
            '    hyouka = "A"',
            'そうでなくもし ten >= 60 ならば:',
            '    hyouka = "B"',
            'そうでなければ:',
            '    hyouka = "C"',
        ].join('\n');
        expect(rulesOf(code)).toEqual(['', 'bar', '', 'bar', '', 'end']);
    });

    test('a branch of an inner if keeps the bar of the outer block', () => {
        const code = [
            'i を 1 から 3 まで 1 ずつ増やしながら繰り返す:',
            '    もし i % 2 == 0 ならば:',
            '        表示する(i)',
            '    そうでなければ:',
            '        表示する(0)',
        ].join('\n');
        expect(rulesOf(code)).toEqual(['', 'bar', 'bar bar', 'bar', 'end end']);
    });

    test('two blocks one after another are not joined', () => {
        const code = ['もし a ならば:', '    x = 1', 'もし b ならば:', '    y = 1'].join('\n');
        expect(rulesOf(code)).toEqual(['', 'end', '', 'end']);
    });

    test('takes any width of indent (2 spaces as well as 4)', () => {
        const code = ['もし a ならば:', '  もし b ならば:', '    x = 1', '  y = 1'].join('\n');
        expect(rulesOf(code)).toEqual(['', 'bar', 'bar end', 'end']);
        expect(layoutProblemForm(code)[2].rules.map((rule) => rule.column)).toEqual([0, 2]);
    });

    test('a blank line in a block keeps the bars of the blocks that go on', () => {
        const code = ['もし a ならば:', '    x = 1', '', '    y = 1', 'z = 1'].join('\n');
        expect(rulesOf(code)).toEqual(['', 'bar', 'bar', 'end', '']);
    });

    test('a blank line after a block has no rules', () => {
        const code = ['もし a ならば:', '    x = 1', '', 'z = 1'].join('\n');
        expect(rulesOf(code)).toEqual(['', 'end', '', '']);
    });

    test('the last line of the program ends every block', () => {
        const code = ['関数 nibai(n):', '    もし n > 0 ならば:', '        n * 2 を返す'].join('\n');
        expect(rulesOf(code)).toEqual(['', 'bar', 'end end']);
    });

    test('a tab counts as 4 spaces', () => {
        const code = 'もし a ならば:\n\tx = 1';
        expect(layoutProblemForm(code)[1]).toEqual({
            lineNumber: 2,
            label: '(02)',
            indent: 1,
            rules: [{ column: 0, kind: 'end' }],
        });
    });
});

describe('problemFormText', () => {
    test('puts the line number and the rules in front of each line', () => {
        const code = [
            'i を 1 から 3 まで 1 ずつ増やしながら繰り返す:',
            '    もし i % 2 == 0 ならば:',
            '        表示する(i)',
            '    そうでなければ:',
            '        表示する(0)',
        ].join('\n');
        expect(problemFormText(code)).toBe(
            [
                '(01) i を 1 から 3 まで 1 ずつ増やしながら繰り返す:',
                '(02) ｜ もし i % 2 == 0 ならば:',
                '(03) ｜ ｜ 表示する(i)',
                '(04) ｜ そうでなければ:',
                '(05) ⎿ ⎿ 表示する(0)',
            ].join('\n'),
        );
    });

    test('a blank line keeps its number and the bars', () => {
        const code = ['もし a ならば:', '    x = 1', '', '    y = 1'].join('\n');
        expect(problemFormText(code)).toBe(
            ['(01) もし a ならば:', '(02) ｜ x = 1', '(03) ｜', '(04) ⎿ y = 1'].join('\n'),
        );
    });

    test('ends with a newline when the text does', () => {
        expect(problemFormText('a = 1\n')).toBe('(01) a = 1\n');
    });
});

describe('problemFormText pasted back', () => {
    test('runs as the same program as the text', () => {
        const code = [
            'goukei = 0',
            'i を 1 から 5 まで 1 ずつ増やしながら繰り返す:',
            '    もし i % 2 == 0 ならば:',
            '        goukei = goukei + i',
            '    そうでなければ:',
            '        表示する(i)',
            '表示する(goukei)',
        ].join('\n');
        const pasted = tidyPastedDncl(problemFormText(code));
        expect(dnclToRuby(code).ruby).toContain('@goukei = @goukei + @i');
        expect(dnclToRuby(pasted).ruby).toBe(dnclToRuby(code).ruby);
    });
});
