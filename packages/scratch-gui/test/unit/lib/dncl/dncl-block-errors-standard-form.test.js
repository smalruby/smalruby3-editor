// A block left open is said in the words of the form it is written in (Issue #2035)
//
// The standard form shows the inside of a block by its indent, not by a
// closer line, so a block whose inside is not indented is told to indent
// it. A block of the DNCL 風の形 is still told to be closed by its closer.
// The programs are made up for the tests.
import { dnclToRuby } from '../../../../src/lib/dncl/dncl-to-ruby';

const lines = (...ls) => ls.join('\n');
// A program with a block error makes no Ruby; the error is one of its errors.
const blockErrorsOf = (japanese) => dnclToRuby(japanese).errors.map(({ line, message }) => ({ line, message }));

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

// A line at no indent of the blocks around it is an error, not read as in the
// nearest block (Issue #2555): the indent says which block a line is in.
describe('a line at an indent that does not line up (Issue #2555)', () => {
    const INDENT_ERROR = '字下げが合いません';

    test('a line shallower than the lines of its block is told', () => {
        expect(blockErrorsOf(lines('もし 1 > 0 ならば:', '    表示する(1)', '  表示する(2)'))).toEqual([
            { line: 3, message: INDENT_ERROR },
        ]);
    });

    test('a line deeper than the line before it outside any block is told', () => {
        expect(blockErrorsOf(lines('a = 1', '    b = 2'))).toEqual([{ line: 2, message: INDENT_ERROR }]);
    });

    test('a line after a block at the indent before it has no error', () => {
        expect(blockErrorsOf(lines('もし 1 > 0 ならば:', '    表示する(1)', '表示する(2)'))).toEqual([]);
    });

    test('the lines of a block closed by a line of its own may be at any indent', () => {
        expect(blockErrorsOf(lines('もし 1 > 0 ならば', '    表示する(1)', '  表示する(2)', 'を実行する'))).toEqual(
            [],
        );
    });
});

describe('a block whose indented line cannot be read is not told to indent it (B20 of #1731)', () => {
    test('only the missing ")" is told', () => {
        expect(blockErrorsOf(lines('もし 1 > 0 ならば:', '    表示する(1'))).toEqual([
            { line: 2, message: '「)」が要ります' },
        ]);
    });

    test('a later indented line that cannot be read is told alone', () => {
        expect(blockErrorsOf(lines('a < 10 の間繰り返す:', '    a = a + 1', '    表示する(a'))).toEqual([
            { line: 3, message: '「)」が要ります' },
        ]);
    });

    test('a block whose lines are not indented is still told to indent them', () => {
        expect(blockErrorsOf(lines('もし 1 > 0 ならば:', '表示する(1'))).toContainEqual({
            line: 1,
            message: '「もし〜ならば:」の中の行を字下げしてください',
        });
    });

    // The indent is read as ja-notation reads it, so a longer line number is not an indent (Issue #2587).
    const numbered = (...ls) => ls.map((l, i) => `(${i + 1})${l}`).join('\n');
    const eight = Array.from({ length: 8 }, (_, i) => ` a = ${i}`);

    test('a line not indented after a longer line number is still told to indent it', () => {
        expect(blockErrorsOf(numbered(...eight, ' もし 1 > 0 ならば:', ' 表示する(1'))).toContainEqual({
            line: 9,
            message: '「もし〜ならば:」の中の行を字下げしてください',
        });
    });

    test('a line indented after the line numbers aligned is told alone', () => {
        const aligned = eight.map((l) => ` ${l}`);
        expect(blockErrorsOf(numbered(...aligned, '  もし 1 > 0 ならば:', '     表示する(1'))).toEqual([
            { line: 10, message: '「)」が要ります' },
        ]);
    });
});
