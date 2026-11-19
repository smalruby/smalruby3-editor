/**
 * Unit tests for the character n-gram of the course 「ことばを予想する AI をつくろう」
 * (src/lib/lessons/lm-ngram.js).
 */
import {
    candidatesFor,
    contextBefore,
    isLearnedText,
    pairsOf,
    samePairs,
    sameMultiset,
} from '../../../../src/lib/lessons/lm-ngram';

describe('lm-ngram', () => {
    test('the context is the last chars before the position, shorter at the start', () => {
        expect(contextBefore('こんにちは', 0, 2)).toBe('');
        expect(contextBefore('こんにちは', 1, 2)).toBe('こ');
        expect(contextBefore('こんにちは', 3, 2)).toBe('んに');
    });

    test('learning makes one pair per char, without counting', () => {
        expect(pairsOf(['ねこ。', 'ねる。'], 1)).toEqual([
            ['', 'ね'],
            ['ね', 'こ'],
            ['こ', '。'],
            ['', 'ね'],
            ['ね', 'る'],
            ['る', '。'],
        ]);
    });

    test('pairs and multisets compare without order', () => {
        expect(
            samePairs(
                [
                    ['a', 'b'],
                    ['', 'a'],
                ],
                [
                    ['', 'a'],
                    ['a', 'b'],
                ],
            ),
        ).toBe(true);
        expect(
            samePairs(
                [['a', 'b']],
                [
                    ['a', 'b'],
                    ['a', 'b'],
                ],
            ),
        ).toBe(false);
        expect(sameMultiset(['ん', 'ん', 'で'], ['で', 'ん', 'ん'])).toBe(true);
        expect(sameMultiset(['ん', 'で'], ['で', 'ん', 'ん'])).toBe(false);
    });

    test('candidates are the next chars of the rows whose context is the same', () => {
        const pairs = pairsOf(['こんにちは。', 'こんばんは。', 'ねこです。'], 1);
        const before = pairs.map((p) => p[0]);
        const after = pairs.map((p) => p[1]);
        expect(candidatesFor(before, after, 'こ', 1)).toEqual(['ん', 'ん', 'で']);
        expect(candidatesFor(before, after, '', 1)).toEqual(['こ', 'こ', 'ね']);
        expect(candidatesFor(before, after, 'ぼ', 1)).toEqual([]);
    });

    test('a text made only of learned pairs is learned', () => {
        const pairs = pairsOf(['こんにちは。', 'こんばんは。'], 2);
        const before = pairs.map((p) => p[0]);
        const after = pairs.map((p) => p[1]);
        expect(isLearnedText('こんばんは。', before, after, 2)).toBe(true);
        expect(isLearnedText('こんには。', before, after, 2)).toBe(false);
        // the prompt typed in does not need to be learned
        expect(isLearnedText('やあこんにちは。', before, after, 2, 2)).toBe(false);
        expect(isLearnedText('こんにちは。', before, after, 2, 5)).toBe(true);
        expect(isLearnedText('こん', before, after, 2, 2)).toBe(false);
    });
});
