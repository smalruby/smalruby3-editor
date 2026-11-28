// An else or a closing line goes back to the depth of its block as it is
// typed (Issue #2554). The programs are written for this test.
import { completesOutdentWord, outdentIndent } from '../../../../src/containers/ruby-tab/dncl-auto-outdent';

const at = (text) => {
    const lines = text.split('\n');
    return outdentIndent(lines, lines.length - 1);
};

describe('outdentIndent', () => {
    test.each([
        ['そうでなければ:', ['もし x > 1 ならば:', '    表示する(x)', '    そうでなければ:'], ''],
        ['そうでなくもし', ['もし x > 1 ならば:', '    表示する(x)', '    そうでなくもし x > 0 ならば:'], ''],
        [
            'そうでなければ after そうでなくもし',
            [
                'もし x > 1 ならば:',
                '    表示する(x)',
                'そうでなくもし x > 0 ならば:',
                '    表示する(1)',
                '    そうでなければ:',
            ],
            '',
        ],
        ['を実行する', ['もし x > 1 ならば', '    表示する(x)', '    を実行する'], ''],
        ['を繰り返す', ['i < 3 の間', '    i = i + 1', '    を繰り返す'], ''],
        ['と定義する', ['関数 twice(x):', '    x * 2 を返す', '    と定義する'], ''],
        [
            'the inner if',
            ['i < 3 の間繰り返す:', '    もし i > 1 ならば:', '        表示する(i)', '        そうでなければ:'],
            '    ',
        ],
        [
            'the closer of the outer block after a closed inner block',
            ['i < 3 の間', '    もし i > 1 ならば', '        表示する(i)', '    を実行する', '    を繰り返す'],
            '',
        ],
        [
            'past blank lines and comments',
            ['もし x > 1 ならば:', '    表示する(x)', '', '# メモ', '    そうでなければ:'],
            '',
        ],
        ['a tab', ['\tもし x > 1 ならば:', '\t\t表示する(x)', '\t\tそうでなければ:'], '\t'],
    ])('takes %s back', (_name, lines, indent) => {
        expect(at(lines.join('\n'))).toBe(indent);
    });

    test.each([
        ['already at the depth of もし', ['もし x > 1 ならば:', '    表示する(x)', 'そうでなければ:']],
        [
            'an else of the inner if written there',
            ['もし a ならば:', '    もし b ならば:', '        x = 1', '    そうでなければ:'],
        ],
        ['an else with no もし', ['x = 1', '    そうでなければ:']],
        ['an else above a closed もし only', ['i < 3 の間', '    x = 1', '    そうでなければ']],
        ['another line', ['もし x > 1 ならば:', '    表示する(x)']],
    ])('leaves %s', (_name, lines) => {
        expect(at(lines.join('\n'))).toBeNull();
    });
});

describe('completesOutdentWord', () => {
    test('a word that comes in at once from the IME', () => {
        expect(completesOutdentWord('    そうでなければ', 5, 'そうでなければ')).toBe(true);
    });

    test('the last character of the word typed alone', () => {
        expect(completesOutdentWord('    を実行する', 9, 'る')).toBe(true);
    });

    test.each([
        ['the `:` after the word', '    そうでなければ:', 12, ':'],
        ['a change of the indent', '    そうでなければ:', 1, '    '],
        ['the condition after the word', '    そうでなくもし x', 13, 'x'],
        ['a line break', '    そうでなければ', 5, 'そうでなければ\n'],
        ['another word', '    表示する(x)', 5, '表示する(x)'],
    ])('not %s', (_name, line, column, text) => {
        expect(completesOutdentWord(line, column, text)).toBe(false);
    });
});
