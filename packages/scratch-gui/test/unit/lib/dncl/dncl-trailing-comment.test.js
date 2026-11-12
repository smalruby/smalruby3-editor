// Issue #1696: a `# comment` at the end of a line that opens, continues or
// closes a block must not stop the line from being converted, in both
// directions (DNCL → Ruby and Ruby → DNCL), and the comment stays at the
// end of the line.
import dedent from 'dedent';
import { dnclToRuby } from '../../../../src/lib/dncl/dncl-to-ruby';
import { codeOfLine } from '../../../../src/lib/dncl/dncl-trailing-comment';
import { dnclV2Preprocess } from '../../../../src/lib/dncl/dncl-v2-preprocessor';
import { isDoBlockLine } from '../../../../src/lib/dncl/dncl-validator';
import { rubyToDncl } from '../../../../src/lib/dncl/ruby-to-dncl';

const toRuby = (dncl) => {
    const result = dnclToRuby(dncl);
    expect(result.errors).toEqual([]);
    expect(result.blockErrors).toEqual([]);
    return result.ruby;
};
const toDncl = (ruby) => rubyToDncl(ruby).dncl;

// [DNCL, Ruby] pairs that must convert into each other both ways.
const PAIRS = [
    [
        'if opener',
        dedent`
            もし a > 0 ならば # c
              表示する(a)
            を実行する
        `,
        dedent`
            if @a > 0 # c
              puts(@a)
            end
        `,
    ],
    [
        'if closer',
        dedent`
            もし a > 0 ならば
              表示する(a)
            を実行する # c
        `,
        dedent`
            if @a > 0
              puts(@a)
            end # c
        `,
    ],
    [
        'else and elsif',
        dedent`
            もし a > 0 ならば # c1
              表示する(a)
            そうでなくもし a < 0 ならば # c2
              表示する(b)
            そうでなければ # c3
              表示する(c)
            を実行する # c4
        `,
        dedent`
            if @a > 0 # c1
              puts(@a)
            elsif @a < 0 # c2
              puts(@b)
            else # c3
              puts(@c)
            end # c4
        `,
    ],
    [
        'while loop',
        dedent`
            a < 3 の間 # c
              a = a + 1
            を繰り返す # d
        `,
        dedent`
            while @a < 3 # c
              @a = @a + 1
            end # d
        `,
    ],
    [
        'counting loop',
        dedent`
            i を 1 から 3 まで 1 ずつ増やしながら # c
              表示する(i)
            を繰り返す # d
        `,
        dedent`
            @i = 1
            while @i <= 3 # c
              puts(@i)
              @i += 1
            end # d
        `,
    ],
    [
        'function',
        dedent`
            関数 f(x) # c
              返す x + 1
            と定義する # d
        `,
        dedent`
            def f(x) # c
              return x + 1
            end # d
        `,
    ],
    [
        'nested blocks',
        dedent`
            a < 3 の間 # loop
              もし a > 1 ならば # if
                表示する(a)
              を実行する # end if
              a = a + 1 # step
            を繰り返す # end loop
        `,
        dedent`
            while @a < 3 # loop
              if @a > 1 # if
                puts(@a)
              end # end if
              @a = @a + 1 # step
            end # end loop
        `,
    ],
    [
        'comment-only lines',
        dedent`
            # はじめ
            もし a > 0 ならば # c
              # なか
              表示する(a)
            を実行する
            # おわり
        `,
        dedent`
            # はじめ
            if @a > 0 # c
              # なか
              puts(@a)
            end
            # おわり
        `,
    ],
];

describe('trailing # comment on block lines (Issue #1696)', () => {
    describe.each(PAIRS)('%s', (name, dncl, ruby) => {
        test('DNCL → Ruby', () => {
            expect(toRuby(dncl)).toBe(ruby);
        });

        test('Ruby → DNCL', () => {
            expect(toDncl(ruby)).toBe(dncl);
        });

        test('DNCL → Ruby → DNCL', () => {
            expect(toDncl(toRuby(dncl))).toBe(dncl);
        });

        test('Ruby → DNCL → Ruby', () => {
            expect(toRuby(toDncl(ruby))).toBe(ruby);
        });
    });

    describe('a # inside a string is not a comment', () => {
        test.each([
            ['"#"', '"#"'],
            ["'#'", "'#'"],
            ['「#」', '"#"'],
        ])('もし a == %s ならば', (dnclString, rubyString) => {
            const dncl = `もし a == ${dnclString} ならば\n  表示する(a)\nを実行する`;
            expect(toRuby(dncl)).toBe(`if @a == ${rubyString}\n  puts(@a)\nend`);
        });

        test('a string with # and a trailing comment', () => {
            expect(toRuby('もし a == "#" ならば # c\nを実行する')).toBe('if @a == "#" # c\nend');
        });

        test('Ruby → DNCL keeps # inside a string', () => {
            expect(toDncl('if @a == "#" # c\n  puts(@a)\nend')).toBe(
                'もし a == "#" ならば # c\n  表示する(a)\nを実行する',
            );
        });
    });

    test('input keeps the comment both ways', () => {
        expect(toRuby('x ← 【外部からの入力】 # c')).toBe('ask("")\n@x = answer # c');
        expect(toDncl('ask("")\n@x = answer # c')).toBe('x = 【外部からの入力】 # c');
    });

    describe('two Ruby lines that become one DNCL line keep both comments', () => {
        // Each case: Ruby, the DNCL it becomes, and the Ruby that DNCL becomes.
        // The comments move to one line once, and then stay put: converting
        // back and forth again does not add or move them.
        test.each([
            [
                'counting loop',
                '@i = 1 # a\nwhile @i <= 3 # b\n  puts(@i) # p\n  @i += 1 # inc\nend # e',
                'i を 1 から 3 まで 1 ずつ増やしながら # a # b\n  表示する(i) # p\nを繰り返す # inc # e',
                '@i = 1\nwhile @i <= 3 # a # b\n  puts(@i) # p\n  @i += 1\nend # inc # e',
            ],
            [
                'input',
                'ask("") # q\n@x = answer # a',
                'x = 【外部からの入力】 # q # a',
                'ask("")\n@x = answer # q # a',
            ],
        ])('%s', (name, ruby, dncl, rubyBack) => {
            expect(toDncl(ruby)).toBe(dncl);
            expect(toRuby(dncl)).toBe(rubyBack);
            expect(toDncl(rubyBack)).toBe(dncl);
            expect(toRuby(toDncl(rubyBack))).toBe(rubyBack);
        });
    });

    describe('strings that are not plain', () => {
        test.each([
            ['an escaped quote', 'x ← "a\\"#b" # c', '@x = "a\\"#b" # c'],
            ['two strings', 'x ← "a" + "#b" # c', '@x = "a" + "#b" # c'],
            ['an unclosed string is all code', 'x ← "abc # c', '@x = "abc # c'],
        ])('%s', (name, dncl, ruby) => {
            expect(toRuby(dncl)).toBe(ruby);
        });
    });

    test('the source map still points at the DNCL lines', () => {
        const { sourceMap } = dnclToRuby(
            'x ← 【外部からの入力】 # c\nもし x > 0 ならば: # d\n    表示する(x) # e\n表示する(0)',
        );
        // ask("") / @x = answer # c / if @x > 0 # d / puts(@x) # e / end / puts(0)
        expect([1, 2, 3, 4, 5, 6].map((line) => sourceMap.rubyLineToDnclLine(line))).toEqual([1, 1, 2, 3, 3, 4]);
    });

    test('Ruby → DNCL: a command in a comment is not an unsupported command', () => {
        expect(rubyToDncl('puts(1) # move(2)').errors).toEqual([]);
        const { errors } = rubyToDncl('@i = 1 # a\nwhile @i <= 3 # b\n  @i += 1 # c\nend # d\nmove(2) # e');
        expect(errors.map(({ line, column, name }) => ({ line, column, name }))).toEqual([
            { line: 5, column: 1, name: 'move' },
        ]);
    });

    describe('codeOfLine / isDoBlockLine', () => {
        test.each([
            ['loop do # c', 'loop do'],
            ['# loop do', ''],
            ['puts("#") # c', 'puts("#")'],
            ['puts(「#」) # c', 'puts(「#」)'],
            ['x = 1', 'x = 1'],
        ])('codeOfLine(%j)', (line, code) => {
            expect(codeOfLine(line)).toBe(code);
        });

        test.each([
            ['loop do # c', true],
            ['# loop do', false],
            ['move(1) # what to do', false],
            ['say(「#」) do', true],
            ['say(「# do」)', false],
        ])('isDoBlockLine(%j)', (line, expected) => {
            expect(isDoBlockLine(line)).toBe(expected);
        });
    });

    test('a keyword inside a comment does not open a block', () => {
        expect(toRuby('x ← 1 # もし a ならば')).toBe('@x = 1 # もし a ならば');
        expect(toRuby('x ← 1 # a の間')).toBe('@x = 1 # a の間');
    });

    describe('DNCLv2', () => {
        test('colon opener with a trailing comment closes by indent', () => {
            const dncl = dedent`
                もし a > 0 ならば: # c
                    表示する(a)
                表示する(b)
            `;
            expect(toRuby(dncl)).toBe('if @a > 0 # c\n    puts(@a)\nend\nputs(@b)');
        });

        test('pre-processor strips the colon before the comment', () => {
            expect(dnclV2Preprocess('もし a > 0 ならば: # c\n    表示する(a)')).toBe(
                'もし a > 0 ならば # c\n    表示する(a)\nを実行する',
            );
        });

        test('の間繰り返す: with a trailing comment', () => {
            expect(dnclV2Preprocess('a < 3 の間繰り返す: # c\n    a = a + 1')).toBe(
                'a < 3 の間 # c\n    a = a + 1\nを繰り返す',
            );
        });

        test('そうでなければ: with a trailing comment stays in the if block', () => {
            const dncl = dedent`
                もし a > 0 ならば: # c1
                    表示する(a)
                そうでなければ: # c2
                    表示する(b)
                表示する(c)
            `;
            expect(toRuby(dncl)).toBe('if @a > 0 # c1\n    puts(@a)\nelse # c2\n    puts(@b)\nend\nputs(@c)');
        });

        test('multi-assignment keeps the comment on the last piece', () => {
            expect(dnclV2Preprocess('a = 1, b = 2 # c')).toBe('a = 1\nb = 2 # c');
        });

        test('｜ / ⎿ markers with trailing comments', () => {
            const dncl = dedent`
                もし a > 0 ならば: # c
                ⎿ 表示する(a) # d
            `;
            expect(toRuby(dncl)).toBe('if @a > 0 # c\n  puts(@a) # d\nend');
        });
    });
});
