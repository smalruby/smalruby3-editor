/**
 * The textbook of the course 「ことばを予想する AI をつくろう」 (src/lib/lessons/lm-textbook.js):
 * the rules of docs/lessons/design.md 「教科書の文」 and that the lessons 4-3 / 5-1 work with it.
 */
import { contextBefore, isLearnedText, pairsOf } from '../../../../src/lib/lessons/lm-ngram';
import { LM_END_CHAR, LM_PROMPTS, LM_TEXTBOOK } from '../../../../src/lib/lessons/lm-textbook';

const LOCALES = ['ja', 'ja-Hira', 'en'];

// 書き出しの最後の文脈を学習していれば、AI は文を続けられる
const canContinue = (sentences, prompt, length) => {
    const contexts = new Set(pairsOf(sentences, length).map(([before]) => before.toLowerCase()));
    return contexts.has(contextBefore(prompt, prompt.length, length).toLowerCase());
};

describe('LM_TEXTBOOK', () => {
    test('about 30 sentences, the same number in every locale', () => {
        LOCALES.forEach((locale) => {
            expect(LM_TEXTBOOK[locale].length).toBe(30);
        });
    });

    test.each(LOCALES)('%s: every sentence ends with the end char and has it only at the end', (locale) => {
        const end = LM_END_CHAR[locale];
        LM_TEXTBOOK[locale].forEach((sentence) => {
            expect(sentence.endsWith(end)).toBe(true);
            expect(sentence.indexOf(end)).toBe(sentence.length - 1);
        });
        expect(new Set(LM_TEXTBOOK[locale]).size).toBe(LM_TEXTBOOK[locale].length);
    });

    test('has the example of 4-3', () => {
        expect(LM_TEXTBOOK.ja).toContain('こんにちは、今日はよろしく。');
        expect(LM_TEXTBOOK['ja-Hira']).toContain('こんにちは、きょうはよろしく。');
        expect(LM_TEXTBOOK.en).toContain('Hello, nice to meet you.');
    });

    test('ja-Hira has no kanji', () => {
        LM_TEXTBOOK['ja-Hira'].forEach((sentence) => {
            expect(sentence).not.toMatch(/[一-鿿]/);
        });
    });

    test('4-3: 「こんにちは」 can continue to the example with every length', () => {
        [
            ['ja', 'こんにちは', 'こんにちは、今日はよろしく。'],
            ['ja-Hira', 'こんにちは', 'こんにちは、きょうはよろしく。'],
            ['en', 'Hello', 'Hello, nice to meet you.'],
        ].forEach(([locale, prompt, sentence]) => {
            [1, 2, 3].forEach((length) => {
                const pairs = pairsOf(LM_TEXTBOOK[locale], length);
                const before = pairs.map((p) => p[0]);
                const after = pairs.map((p) => p[1]);
                expect(isLearnedText(sentence, before, after, length, prompt.length)).toBe(true);
            });
        });
    });
});

describe('LM_PROMPTS (5-1)', () => {
    test('10 prompts in every locale', () => {
        LOCALES.forEach((locale) => expect(LM_PROMPTS[locale].length).toBe(10));
    });

    test.each(LOCALES)(
        '%s: with length 2, some prompts continue and some do not until sentences are added',
        (locale) => {
            const count = LM_PROMPTS[locale].filter((prompt) => canContinue(LM_TEXTBOOK[locale], prompt, 2)).length;
            expect(count).toBeGreaterThanOrEqual(5);
            expect(count).toBeLessThanOrEqual(8);
            // a sentence the student adds makes a prompt continue
            const stuck = LM_PROMPTS[locale].find((prompt) => !canContinue(LM_TEXTBOOK[locale], prompt, 2));
            const added = [...LM_TEXTBOOK[locale], `${stuck}${LM_END_CHAR[locale]}`];
            expect(canContinue(added, stuck, 2)).toBe(true);
        },
    );
});
