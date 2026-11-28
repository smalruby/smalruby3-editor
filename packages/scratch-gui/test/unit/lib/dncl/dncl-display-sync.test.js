// Issue #2576: selecting a target without a program empties the Japanese tab, as the Ruby tab does.
import { japaneseTextForRuby } from '../../../../src/lib/dncl/dncl-display-sync';

describe('japaneseTextForRuby', () => {
    const toJapanese = (ruby) => `JA(${ruby})`;

    test('a target without a program empties the editor when the target changed', () => {
        expect(
            japaneseTextForRuby({ editorRuby: 'x = 3\nputs(x)\n', ruby: '', targetChanged: true, toJapanese }),
        ).toBe('');
    });

    test('the text is kept when the Ruby is empty but the target is the same', () => {
        expect(japaneseTextForRuby({ editorRuby: 'x = 3\n', ruby: '', targetChanged: false, toJapanese })).toBeNull();
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
