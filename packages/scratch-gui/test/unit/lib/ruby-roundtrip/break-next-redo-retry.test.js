/**
 * `break` / `next` / `redo` / `retry` have no block in Scratch (issue #1609).
 * They used to be dropped without an error, so `loop do ... break if x > 3 end` came back
 * as ` if x > 3`. Now they are an error on the line of the keyword, with a hint.
 */
import dedent from 'dedent';
import PrismErrorTranslator from '../../../../src/lib/ruby-to-blocks-converter/prism-error-translator';
import en from '../../../../src/locales/en';
import ja from '../../../../src/locales/ja';
import jaHira from '../../../../src/locales/ja-Hira';
import {
    makeSpriteTarget,
    makeConverter,
    setupRubyGenerator,
    expectRoundTrip,
} from '../../helpers/ruby-roundtrip-helper';

const BAR = dedent`
    def self.bar(a)
      return a
    end
`;

const HINTS = {
    break: /break[\s\S]*until/,
    next: /next[\s\S]*if/,
    redo: /redo[\s\S]*until/,
    retry: /retry[\s\S]*until/,
};

describe('Ruby to blocks: break / next / redo / retry (issue #1609)', () => {
    let target, runtime, converter;

    beforeEach(() => {
        ({ target, runtime } = makeSpriteTarget());
        setupRubyGenerator();
        converter = makeConverter(target, runtime);
    });

    // Converts the code and returns the errors. The line of `keyword` in the code is the expected row.
    const convertErrors = async (code) => {
        const result = await converter.targetCodeToBlocks(target, code);
        expect(result).toBeFalsy();
        return converter.errors;
    };
    const rowOf = (code, text) => code.split('\n').findIndex((line) => line.includes(text));

    describe.each([
        ['break', 'loop do\n  move(10)\n  break if bar(a) > 3\nend', 'break if bar(a) > 3'],
        ['break', 'loop do\n  move(10)\n  break\nend', 'break'],
        ['break', 'loop do\n  if x > 1\n    break\n  end\nend', 'break'],
        ['break', 'loop do\n  break 1\nend', 'break 1'],
        ['break', 'while x < 3\n  move(10)\n  break 1\nend', 'break 1'],
        ['break', 'until x > 3\n  break if x == 2\nend', 'break if x == 2'],
        ['break', '10.times do\n  move(10)\n  break if x > 3\nend', 'break if x > 3'],
        ['break', 'loop do\n  move(10)\n  break unless x > 3\nend', 'break unless x > 3'],
        ['break', 'def self.foo\n  loop do\n    break\n  end\nend', 'break'],
        ['break', 'self.when(:flag_clicked) do\n  loop do\n    break if x > 3\n  end\nend', 'break if x > 3'],
        ['next', '10.times do\n  move(10)\n  next if x > 3\nend', 'next if x > 3'],
        ['next', 'loop do\n  next\nend', 'next'],
        ['next', 'while x < 3\n  next 1\nend', 'next 1'],
        ['next', 'def self.foo\n  10.times do\n    next if x > 3\n  end\nend', 'next if x > 3'],
        ['redo', 'loop do\n  move(10)\n  redo\nend', 'redo'],
        ['redo', '10.times do\n  redo if x > 3\nend', 'redo if x > 3'],
    ])('%s: %j', (keyword, body, line) => {
        const code = `${BAR}\n\na = 0\nx = 0\n${body}`;

        test('is an error on the line of the keyword, with a hint', async () => {
            const errors = await convertErrors(code);
            expect(errors).toHaveLength(1);
            expect(errors[0].row).toBe(rowOf(code, line));
            expect(errors[0].text).toMatch(HINTS[keyword]);
            expect(errors[0].text).toContain(line.trim());
        });
    });

    test('a loop with no break still comes back as written', async () => {
        await expectRoundTrip(converter, target, 'loop do\n  move(10)\nend');
    });

    test('a loop that stops with its condition still comes back as written', async () => {
        await expectRoundTrip(converter, target, '@x = 0\nuntil @x > 3\n  @x += 1\nend');
    });

    test('`break` written as a word in a string is not an error', async () => {
        await expectRoundTrip(converter, target, 'loop do\n  say("break")\nend');
    });
});

describe('Parser errors of break / next / redo / retry outside a loop (issue #1609)', () => {
    let target, runtime, converter;

    beforeEach(() => {
        ({ target, runtime } = makeSpriteTarget());
        setupRubyGenerator();
        converter = makeConverter(target, runtime);
    });

    test.each([
        ['break', 'move(10)\nbreak if x > 1', 1],
        ['break', 'def self.foo\n  break\nend', 1],
        ['next', 'next', 0],
        ['redo', 'redo', 0],
        ['retry', 'retry', 0],
    ])('%s: %j is an error on its line, with a hint', async (keyword, code, row) => {
        await converter.targetCodeToBlocks(target, code);
        expect(converter.errors).toHaveLength(1);
        expect(converter.errors[0].row).toBe(row);
        expect(converter.errors[0].text).toMatch(HINTS[keyword]);
        expect(converter.errors[0].text).not.toMatch(/^Invalid /);
    });

    test.each([
        ['Invalid break', 'break'],
        ['Invalid next', 'next'],
        ['Invalid redo', 'redo'],
        ['Invalid retry without rescue', 'retry'],
        ['Invalid retry after else', 'retry'],
        ['Invalid retry after ensure', 'retry'],
    ])('the translator translates %j', (message, keyword) => {
        const result = new PrismErrorTranslator().translate(message);
        expect(result).not.toBe(message);
        expect(result).toMatch(HINTS[keyword]);
    });
});

describe('Messages of break / next / redo / retry (issue #1609)', () => {
    const KEYWORDS = ['break', 'next', 'redo', 'retry'];
    const capitalize = (w) => w[0].toUpperCase() + w.slice(1);

    test.each([
        ['en', en],
        ['ja', ja],
        ['ja-Hira', jaHira],
    ])('%s has the messages, with the source and the keyword', (_name, locale) => {
        KEYWORDS.forEach((keyword) => {
            const converterMessage = locale[`gui.smalruby3.rubyToBlocksConverter.${keyword}NotSupported`];
            expect(converterMessage).toContain('{ SOURCE }');
            expect(converterMessage).toContain(keyword);
            expect(locale[`gui.smalruby3.prismError.invalid${capitalize(keyword)}`]).toContain(`\`${keyword}\``);
        });
    });
});
