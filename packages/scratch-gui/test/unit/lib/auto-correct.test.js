import { autoCorrect, defaultSettings } from '../../../src/lib/auto-correct';

describe('autoCorrect', () => {
    const allOn = defaultSettings;
    const allOff = {
        fullwidthNumbers: false,
        fullwidthAlpha: false,
        fullwidthSymbols: false,
        fullwidthSpace: false,
        replaceInStrings: true,
    };

    describe('fullwidth numbers', () => {
        test('should convert fullwidth digits to halfwidth', () => {
            expect(autoCorrect('０１２３４５６７８９', allOn)).toBe('0123456789');
        });

        test('should not convert when fullwidthNumbers is off', () => {
            const settings = { ...allOn, fullwidthNumbers: false };
            expect(autoCorrect('ｘ = ０', settings)).toBe('x = ０');
        });
    });

    describe('fullwidth alphabet', () => {
        test('should convert fullwidth uppercase to halfwidth', () => {
            expect(autoCorrect('ＡＢＣＸＹＺ', allOn)).toBe('ABCXYZ');
        });

        test('should convert fullwidth lowercase to halfwidth', () => {
            expect(autoCorrect('ａｂｃｘｙｚ', allOn)).toBe('abcxyz');
        });

        test('should not convert when fullwidthAlpha is off', () => {
            const settings = { ...allOn, fullwidthAlpha: false };
            expect(autoCorrect('ｘ = 1', settings)).toBe('ｘ = 1');
        });
    });

    describe('fullwidth symbols', () => {
        test('should convert fullwidth double quote', () => {
            expect(autoCorrect('＂hello＂', allOn)).toBe('"hello"');
        });

        test('should convert fullwidth single quote', () => {
            expect(autoCorrect('＇hello＇', allOn)).toBe("'hello'");
        });

        test('should convert fullwidth parentheses', () => {
            expect(autoCorrect('（１＋２）', allOn)).toBe('(1+2)');
        });

        test('should convert fullwidth brackets and braces', () => {
            expect(autoCorrect('［１，２，３］', allOn)).toBe('[1,2,3]');
            expect(autoCorrect('｛ａ：１｝', allOn)).toBe('{a:1}');
        });

        test('should convert fullwidth arithmetic operators', () => {
            expect(autoCorrect('１＋２－３＊４／５', allOn)).toBe('1+2-3*4/5');
        });

        test('should convert fullwidth comparison operators', () => {
            expect(autoCorrect('ｘ＜１０', allOn)).toBe('x<10');
            expect(autoCorrect('ｘ＞＝５', allOn)).toBe('x>=5');
            expect(autoCorrect('ｘ＝＝１', allOn)).toBe('x==1');
        });

        test('should convert fullwidth miscellaneous symbols', () => {
            // `＃` starts a comment, so it is the last (see "comments" below).
            expect(autoCorrect('！＠＄％＾＆＿～｜＃', allOn)).toBe('!@$%^&_~|#');
        });

        test('should convert fullwidth dot, comma, colon, semicolon', () => {
            expect(autoCorrect('ａ．ｂ，ｃ：ｄ；ｅ', allOn)).toBe('a.b,c:d;e');
        });

        test('should convert fullwidth backslash and backtick', () => {
            expect(autoCorrect('＼ｎ', allOn)).toBe('\\n');
            expect(autoCorrect('｀ｈｅｌｌｏ｀', allOn)).toBe('`hello`');
        });

        test('should convert fullwidth question mark and exclamation', () => {
            expect(autoCorrect('ｐｕｔｓ？', allOn)).toBe('puts?');
        });

        test('should not convert when fullwidthSymbols is off', () => {
            const settings = { ...allOn, fullwidthSymbols: false };
            expect(autoCorrect('（１）', settings)).toBe('（1）');
        });

        test('should convert smart double quotes to halfwidth', () => {
            expect(autoCorrect('puts \u201Cハロー\u201D', allOn)).toBe('puts "ハロー"');
        });

        test('should convert smart single quotes to halfwidth', () => {
            expect(autoCorrect('puts \u2018hello\u2019', allOn)).toBe("puts 'hello'");
        });

        test('should convert minus sign U+2212 to halfwidth hyphen', () => {
            expect(autoCorrect('x = 10 \u2212 5', allOn)).toBe('x = 10 - 5');
        });

        test('should not convert smart quotes when fullwidthSymbols is off', () => {
            const settings = { ...allOn, fullwidthSymbols: false };
            expect(autoCorrect('puts \u201Cハロー\u201D', settings)).toBe('puts \u201Cハロー\u201D');
        });
    });

    describe('fullwidth space', () => {
        test('should convert fullwidth space to halfwidth', () => {
            expect(autoCorrect('ｘ　＝　１', allOn)).toBe('x = 1');
        });

        test('should not convert when fullwidthSpace is off', () => {
            const settings = { ...allOn, fullwidthSpace: false };
            expect(autoCorrect('x　= 1', settings)).toBe('x　= 1');
        });
    });

    describe('string handling (replaceInStrings)', () => {
        test('should replace inside double-quoted strings when replaceInStrings is on', () => {
            expect(autoCorrect('"ＡＢＣ"', allOn)).toBe('"ABC"');
        });

        test('should replace inside single-quoted strings when replaceInStrings is on', () => {
            expect(autoCorrect("'１２３'", allOn)).toBe("'123'");
        });

        test('should NOT replace inside double-quoted strings when replaceInStrings is off', () => {
            const settings = { ...allOn, replaceInStrings: false };
            expect(autoCorrect('x = "ＡＢＣ"', settings)).toBe('x = "ＡＢＣ"');
        });

        test('should NOT replace inside single-quoted strings when replaceInStrings is off', () => {
            const settings = { ...allOn, replaceInStrings: false };
            expect(autoCorrect("x = '１２３'", settings)).toBe("x = '１２３'");
        });

        test('should still replace outside strings when replaceInStrings is off', () => {
            const settings = { ...allOn, replaceInStrings: false };
            expect(autoCorrect('ｘ = "ＡＢＣ"', settings)).toBe('x = "ＡＢＣ"');
        });

        test('should handle escaped fullwidth chars in strings (keep original)', () => {
            // \１ should NOT be replaced even when replaceInStrings is on
            expect(autoCorrect('"\\１\\２"', allOn)).toBe('"\\１\\２"');
        });

        test('should replace non-escaped fullwidth but keep escaped ones in same string', () => {
            expect(autoCorrect('"Ａ\\１Ｂ"', allOn)).toBe('"A\\１B"');
        });

        test('should handle strings with escaped backslash before fullwidth', () => {
            // \\\１ means escaped backslash followed by fullwidth 1, so １ should be replaced
            expect(autoCorrect('"\\\\１"', allOn)).toBe('"\\\\1"');
        });
    });

    describe('multiline code', () => {
        test('should handle multiline Ruby code', () => {
            const input = 'ｘ　＝　１０\nｐｕｔｓ（ｘ）';
            const expected = 'x = 10\nputs(x)';
            expect(autoCorrect(input, allOn)).toBe(expected);
        });

        test('should handle string spanning context with code around it', () => {
            const settings = { ...allOn, replaceInStrings: false };
            const input = 'ｘ = "ＡＢＣ"\nｙ = １';
            const expected = 'x = "ＡＢＣ"\ny = 1';
            expect(autoCorrect(input, settings)).toBe(expected);
        });
    });

    describe('no-op cases', () => {
        test('should return unchanged text when no fullwidth chars', () => {
            const input = 'x = 10\nputs(x)';
            expect(autoCorrect(input, allOn)).toBe(input);
        });

        test('should return empty string unchanged', () => {
            expect(autoCorrect('', allOn)).toBe('');
        });

        test('should not affect Japanese characters (hiragana, katakana, kanji)', () => {
            const input = 'puts "こんにちは世界"';
            expect(autoCorrect(input, allOn)).toBe(input);
        });

        test('should return unchanged when all settings are off', () => {
            const input = 'ｘ　＝　１０';
            expect(autoCorrect(input, allOff)).toBe(input);
        });
    });

    describe('edge cases', () => {
        test('should handle unclosed string at end of input', () => {
            const settings = { ...allOn, replaceInStrings: false };
            // Unclosed string - treat rest as string, don't replace inside
            const input = 'x = "ＡＢＣ';
            expect(autoCorrect(input, settings)).toBe('x = "ＡＢＣ');
        });

        test('should handle escaped quote inside string', () => {
            const settings = { ...allOn, replaceInStrings: false };
            const input = 'x = "hello\\"ＡＢＣ"';
            expect(autoCorrect(input, settings)).toBe('x = "hello\\"ＡＢＣ"');
        });

        test('should handle mixed fullwidth and halfwidth', () => {
            expect(autoCorrect('x = １0 + ２0', allOn)).toBe('x = 10 + 20');
        });
    });

    describe('comments (kept as they are written)', () => {
        test('should keep what is written in a Ruby comment', () => {
            expect(autoCorrect('# ＡＢＣ１２３，（注）', allOn)).toBe('# ＡＢＣ１２３，（注）');
        });

        test('should correct the code before a comment on the same line', () => {
            expect(autoCorrect('x = １　# 値は１，２', allOn)).toBe('x = 1 # 値は１，２');
        });

        test('should make the full-width mark of a comment half-width and keep the rest', () => {
            expect(autoCorrect('＃ 説明，です', allOn)).toBe('# 説明，です');
        });

        test('should correct the next line after a comment', () => {
            expect(autoCorrect('# 説明，です\nx（１）', allOn)).toBe('# 説明，です\nx(1)');
        });

        test('should not take a # in a string as a comment', () => {
            expect(autoCorrect('puts("#１")　＋ １', allOn)).toBe('puts("#1") + 1');
        });

        test('should keep comments also when replaceInStrings is off', () => {
            const settings = { ...allOn, replaceInStrings: false };
            expect(autoCorrect('"ＡＢ" ＋ １ # ，', settings)).toBe('"ＡＢ" + 1 # ，');
        });

        test('should not take // as a comment in Ruby', () => {
            expect(autoCorrect('x = 7 // ２', allOn)).toBe('x = 7 // 2');
        });

        test('should keep the sentences at the top of the Japanese tab', () => {
            const code = ['# 「and」は「かつ」を意味する論理演算子であり，', '表示する（Ａ［１］）'].join('\n');
            expect(autoCorrect(code, allOn, { japanese: true })).toBe(
                ['# 「and」は「かつ」を意味する論理演算子であり，', '表示する(A[1])'].join('\n'),
            );
        });

        test('should keep a // comment of the Japanese tab when its settings say so', () => {
            const options = { japanese: true, slashComments: true };
            expect(autoCorrect('x ＝ １ // 値，１', allOn, options)).toBe('x = 1 // 値，１');
            expect(autoCorrect('x ＝ １ ／／ 値，１', allOn, options)).toBe('x = 1 // 値，１');
        });

        test('should not take a # in a 「…」 of the Japanese tab as a comment', () => {
            expect(autoCorrect('表示する（「#１」）', allOn, { japanese: true })).toBe('表示する(「#1」)');
        });

        test('should end a string of the Japanese tab at the end of its line', () => {
            expect(autoCorrect('表示する（「あ\n# 説明，', allOn, { japanese: true })).toBe(
                '表示する(「あ\n# 説明，',
            );
        });
    });

    describe('defaultSettings', () => {
        test('should have all options enabled by default', () => {
            expect(defaultSettings).toEqual({
                fullwidthNumbers: true,
                fullwidthAlpha: true,
                fullwidthSymbols: true,
                fullwidthSpace: true,
                replaceInStrings: true,
            });
        });
    });
});
