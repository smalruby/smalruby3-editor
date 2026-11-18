// A block left open is said in the words of the form it is written in (Issue #2035)
//
// The standard form shows the inside of a block by its indent, not by a
// closer line, so a block whose inside is not indented is told to indent
// it. A block of the DNCL 風の形 is still told to be closed by its closer.
// The programs are made up for the tests.
import { dnclToRuby } from '../../../../src/lib/dncl/dncl-to-ruby';

const lines = (...ls) => ls.join('\n');
const blockErrorsOf = (japanese) => dnclToRuby(japanese).blockErrors.map(({ line, message }) => ({ line, message }));

describe('block errors of the standard form: indent the inside (Issue #2035)', () => {
    test.each([
        ['an if', lines('もし a > 0 ならば:', 'b = 1'), '「もし〜ならば:」の中の行を字下げしてください'],
        [
            'an if with a full-width colon',
            lines('もし a > 0 ならば：', 'b = 1'),
            '「もし〜ならば:」の中の行を字下げしてください',
        ],
        [
            'an if with a comment',
            lines('もし a > 0 ならば: # c', 'b = 1'),
            '「もし〜ならば:」の中の行を字下げしてください',
        ],
        [
            'a counting loop up',
            lines('i を 1 から 3 まで 1 ずつ増やしながら繰り返す:', 'b = i'),
            '「〜ずつ増やしながら繰り返す:」の中の行を字下げしてください',
        ],
        [
            'a counting loop down',
            lines('i を 3 から 1 まで 1 ずつ減らしながら繰り返す:', 'b = i'),
            '「〜ずつ減らしながら繰り返す:」の中の行を字下げしてください',
        ],
        [
            'a loop while',
            lines('a < 10 の間繰り返す:', 'a = a + 1'),
            '「〜の間繰り返す:」の中の行を字下げしてください',
        ],
        ['a function', lines('関数 f(x):', 'b = x'), '「関数 〜(…):」の中の行を字下げしてください'],
        [
            'a line number',
            lines('(01) もし a > 0 ならば:', '(02) b = 1'),
            '「もし〜ならば:」の中の行を字下げしてください',
        ],
    ])('%s', (_name, japanese, message) => {
        expect(blockErrorsOf(japanese)).toEqual([{ line: 1, message }]);
    });

    test('an else at a shallower indent than its if is told to line up with it', () => {
        expect(
            blockErrorsOf(
                lines('x の間繰り返す:', '    もし a ならば:', '        b = 1', 'そうでなければ:', '    b = 2'),
            ),
        ).toEqual([{ line: 4, message: '「そうでなければ:」は、「もし〜ならば:」と同じ字下げで書いてください' }]);
    });

    test('an else-if at a shallower indent than its if is told to line up with it', () => {
        expect(
            blockErrorsOf(
                lines(
                    'x の間繰り返す:',
                    '    もし a ならば:',
                    '        b = 1',
                    'そうでなくもし c ならば:',
                    '    b = 2',
                ),
            ),
        ).toEqual([
            { line: 4, message: '「そうでなくもし〜ならば:」は、「もし〜ならば:」と同じ字下げで書いてください' },
        ]);
    });

    test('a block written right has no error', () => {
        expect(blockErrorsOf(lines('もし a > 0 ならば:', '    b = 1', 'c = 1'))).toEqual([]);
    });
});

describe('block errors of the DNCL 風の形 keep the closer (Issue #2035)', () => {
    test.each([
        ['an if', lines('もし a > 0 ならば', 'b = 1'), '「もし〜ならば」を「を実行する」で閉じてください'],
        ['a loop while', lines('a < 10 の間', 'a = a + 1'), '「〜の間」を「を繰り返す」で閉じてください'],
        ['a function', lines('関数 f(x)', 'b = x'), '「関数」を「と定義する」で閉じてください'],
    ])('%s', (_name, japanese, message) => {
        expect(blockErrorsOf(japanese)).toEqual([{ line: 1, message }]);
    });

    test('an else with no if', () => {
        expect(blockErrorsOf(lines('a = 1', 'そうでなければ', 'b = 1', 'を実行する'))).toEqual(
            expect.arrayContaining([{ line: 2, message: '「そうでなければ」の前に「もし〜ならば」がありません' }]),
        );
    });
});
