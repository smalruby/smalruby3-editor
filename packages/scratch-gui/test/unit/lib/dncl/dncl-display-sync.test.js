// Issue #2576: selecting a target without a program empties the Japanese tab, as the Ruby tab does.
// Issue #2583: deleting all the blocks of the target empties it too.
import { japaneseTextForRuby } from '../../../../src/lib/dncl/dncl-display-sync';

describe('japaneseTextForRuby', () => {
    const toJapanese = (ruby) => `JA(${ruby})`;

    test('a target without a program empties the editor when the target changed', () => {
        expect(
            japaneseTextForRuby({ editorRuby: 'x = 3\nputs(x)\n', ruby: '', targetChanged: true, toJapanese }),
        ).toBe('');
    });

    // Issue #2583: the blocks of the target were all deleted in the Code tab.
    test('the editor is emptied when the blocks were deleted and the text makes statements', () => {
        expect(
            japaneseTextForRuby({
                editorRuby: '@x = 3\nconsole.puts(@x)',
                ruby: '',
                targetChanged: false,
                toJapanese,
            }),
        ).toBe('');
    });

    test('the text is kept when the Ruby is empty and the text makes comments only', () => {
        expect(
            japaneseTextForRuby({
                editorRuby: '# メモ\n\n  # もう一つ\n',
                ruby: '',
                targetChanged: false,
                toJapanese,
            }),
        ).toBeNull();
    });

    test('the text is kept when the Ruby is empty and the text makes no Ruby (it has errors)', () => {
        expect(japaneseTextForRuby({ editorRuby: null, ruby: '', targetChanged: false, toJapanese })).toBeNull();
    });

    test('the program of another target is shown when the target changed', () => {
        expect(japaneseTextForRuby({ editorRuby: 'x = 3\n', ruby: 'y = 1\n', targetChanged: true, toJapanese })).toBe(
            'JA(y = 1\n)',
        );
    });

    test('Ruby changed from the blocks is shown', () => {
        expect(
            japaneseTextForRuby({ editorRuby: 'x = 3\n', ruby: 'x = 4\n', targetChanged: false, toJapanese }),
        ).toBe('JA(x = 4\n)');
    });

    test('the text is kept when it already makes the Ruby', () => {
        expect(
            japaneseTextForRuby({ editorRuby: 'x = 3\n', ruby: 'x = 3\n', targetChanged: true, toJapanese }),
        ).toBeNull();
        expect(japaneseTextForRuby({ editorRuby: '', ruby: '', targetChanged: true, toJapanese })).toBeNull();
    });
});
