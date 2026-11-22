// The spaces after `｜` that are not lined up from line to line (Issue #2030)
//
// The spaces after the `｜` / `⎿` markers are an indent, and an indent that
// differs, even by one space, is another depth. So a `そうでなければ:` whose
// spaces after `｜` do not line up with its `もし` is an error on its line,
// not an `else` of another block (the answer D2 of #1731: an error that
// says the line is safer than another program made without a word).
// The programs are made up for the tests.
import { dnclToRuby } from '../../../../src/lib/dncl/dncl-to-ruby';

const convert = (lines) => {
    const { ruby, errors } = dnclToRuby(lines.join('\n'));
    return { ruby, errors: errors.map(({ line, message }) => ({ line, message })) };
};

const ELSE_ERROR = '「そうでなければ:」は、「もし〜ならば:」と同じ字下げで書いてください';
const ELSE_IF_ERROR = '「そうでなくもし〜ならば:」は、「もし〜ならば:」と同じ字下げで書いてください';

const IF_ELSE_IN_LOOP = [
    '@i = 1',
    'while @i <= 3',
    '  if @i > 1',
    '    console.puts(@i)',
    '  else',
    '    console.puts(0)',
    '  end',
    '  console.puts(9)',
    '  @i += 1',
    'end',
].join('\n');

describe('spaces after `｜` that do not line up (Issue #2030)', () => {
    test('an else with one space less than its if is an error on its line', () => {
        expect(
            convert([
                'i を 1 から 3 まで 1 ずつ増やしながら繰り返す:',
                '｜  もし i > 1 ならば:',
                '｜     表示する(i)',
                '｜ そうでなければ:',
                '｜     表示する(0)',
                '⎿ 表示する(9)',
            ]),
        ).toEqual({ ruby: null, errors: [{ line: 4, message: ELSE_ERROR }] });
    });

    test('an else with one space more than its if is an error on its line', () => {
        expect(
            convert([
                'i を 1 から 3 まで 1 ずつ増やしながら繰り返す:',
                '｜ もし i > 1 ならば:',
                '｜     表示する(i)',
                '｜  そうでなければ:',
                '｜     表示する(0)',
                '⎿ 表示する(9)',
            ]),
        ).toEqual({ ruby: null, errors: [{ line: 4, message: ELSE_ERROR }] });
    });

    test('an else-if with one space less than its if is an error on its line', () => {
        expect(
            convert([
                'i を 1 から 3 まで 1 ずつ増やしながら繰り返す:',
                '｜  もし i > 2 ならば:',
                '｜     表示する(i)',
                '｜ そうでなくもし i > 1 ならば:',
                '｜     表示する(0)',
                '⎿ 表示する(9)',
            ]).errors,
        ).toEqual([{ line: 4, message: ELSE_IF_ERROR }]);
    });

    test('on numbered lines, the error is on the line of the else', () => {
        expect(
            convert([
                '(01) i を 1 から 3 まで 1 ずつ増やしながら繰り返す:',
                '(02) ｜  もし i > 1 ならば:',
                '(03) ｜     表示する(i)',
                '(04) ｜ そうでなければ:',
                '(05) ｜     表示する(0)',
                '(06) ⎿ 表示する(9)',
            ]).errors,
        ).toEqual([{ line: 4, message: ELSE_ERROR }]);
    });

    test('the same program with the spaces lined up keeps the else in the loop', () => {
        expect(
            convert([
                'i を 1 から 3 まで 1 ずつ増やしながら繰り返す:',
                '｜ もし i > 1 ならば:',
                '｜     表示する(i)',
                '｜ そうでなければ:',
                '｜     表示する(0)',
                '⎿ 表示する(9)',
            ]),
        ).toEqual({ ruby: IF_ELSE_IN_LOOP, errors: [] });
    });

    test('the problem form (a rule for each depth) keeps the else in the loop', () => {
        expect(
            convert([
                'i を 1 から 3 まで 1 ずつ増やしながら繰り返す:',
                '｜ もし i > 1 ならば:',
                '｜ ｜ 表示する(i)',
                '｜ そうでなければ:',
                '｜ ⎿ 表示する(0)',
                '⎿ 表示する(9)',
            ]),
        ).toEqual({ ruby: IF_ELSE_IN_LOOP, errors: [] });
    });
});
