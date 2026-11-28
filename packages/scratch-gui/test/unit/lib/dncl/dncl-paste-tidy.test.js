// Tidying DNCL code pasted into the Japanese mode editor (Issue #1192)
import {
    hasDoubleSlash,
    slashCommentRows,
    tidyPastedDncl,
    withDoubleSlashHint,
} from '../../../../src/lib/dncl/dncl-paste-tidy';
import { problemFormText } from '../../../../src/lib/dncl/dncl-problem-form';
import { dnclToRuby } from '../../../../src/lib/dncl/dncl-to-ruby';

describe('tidyPastedDncl', () => {
    test('removes line numbers, including the hyphenated form', () => {
        expect(tidyPastedDncl('(00-1) a = 1\n(01) b = 2\n(02)  ｜ c = 3')).toBe('a = 1\nb = 2\n｜ c = 3');
    });

    test('keeps the indent after the line number of indentation-only blocks (Issue #1718)', () => {
        expect(tidyPastedDncl('(1) もし x > 0 ならば:\n(2)     y = 1\n(3) z = 2')).toBe(
            'もし x > 0 ならば:\n    y = 1\nz = 2',
        );
        expect(tidyPastedDncl('(00-1) a = 1\n(01) もし a ならば:\n(02)   b = 2')).toBe(
            'a = 1\nもし a ならば:\n  b = 2',
        );
        expect(tidyPastedDncl('1: もし a ならば:\n2:     b = 2')).toBe('もし a ならば:\n    b = 2');
    });

    test('takes off the padding of aligned line numbers (`(9)  x` / `(10) x`) (Issue #1718)', () => {
        expect(tidyPastedDncl('(9)  もし x > 0 ならば:\n(10)     y = 1\n(11) z = 2')).toBe(
            'もし x > 0 ならば:\n    y = 1\nz = 2',
        );
        expect(tidyPastedDncl('(1)  a = 1\n(2)   ｜ b = 2\n(10) c = 3')).toBe('a = 1\n｜ b = 2\nc = 3');
    });

    test('turns a `//` comment on a numbered line into `#`', () => {
        expect(tidyPastedDncl('(00) n = 1 // 生徒番号')).toBe('n = 1 # 生徒番号');
    });

    test('removes `1:` style line numbers', () => {
        expect(tidyPastedDncl('1: n = 1 // 生徒番号\n2:  ｜ 表示する(n)\n10: 表示する(n)')).toBe(
            'n = 1 # 生徒番号\n｜ 表示する(n)\n表示する(n)',
        );
        // `10:30` is not a line number.
        expect(tidyPastedDncl('10:30')).toBe('10:30');
    });

    test('leaves text without line numbers unchanged, `//` included (`//` is never a comment)', () => {
        expect(tidyPastedDncl('n = 1 // 生徒番号')).toBe('n = 1 // 生徒番号');
        expect(tidyPastedDncl('a = 合計 // 個数')).toBe('a = 合計 // 個数');
        expect(tidyPastedDncl('a = 10 // 3')).toBe('a = 10 // 3');
    });

    test('a `//` with nothing after it is a comment', () => {
        expect(tidyPastedDncl('(01) n = 1 //')).toBe('n = 1 #');
    });

    test('keeps `//` followed by a number or an ASCII name as integer division', () => {
        expect(tidyPastedDncl('(1) a = 10 // 3')).toBe('a = 10 // 3');
        expect(tidyPastedDncl('(1) a = x // y')).toBe('a = x // y');
        expect(tidyPastedDncl('(1) a = x // (n + 1)')).toBe('a = x // (n + 1)');
    });

    test('keeps `//` as integer division when a Japanese name is a variable of the program', () => {
        expect(tidyPastedDncl('(01) 個数 = 3\n(02) 合計 = 10\n(03) a = 合計 // 個数')).toBe(
            '個数 = 3\n合計 = 10\na = 合計 // 個数',
        );
        // The variable may be defined in the code already in the editor.
        expect(tidyPastedDncl('(01) a = 合計 // 個数', '合計 = 10\n個数 = 3')).toBe('a = 合計 // 個数');
    });

    test('keeps `//` as integer division when an operator follows it', () => {
        expect(tidyPastedDncl('(01) a = 合計 // 個数 + 1')).toBe('a = 合計 // 個数 + 1');
        expect(tidyPastedDncl('(01) a = 合計 // 個数 * 2')).toBe('a = 合計 // 個数 * 2');
        expect(tidyPastedDncl('(01) もし 合計 // 個数 ≧ 3 ならば:')).toBe('もし 合計 // 個数 ≧ 3 ならば:');
        expect(tidyPastedDncl('(01) もし 合計 // 個数 かつ 点 ならば:')).toBe('もし 合計 // 個数 かつ 点 ならば:');
    });

    test('keeps `//` inside brackets as integer division', () => {
        expect(tidyPastedDncl('(01) 表示する(合計 // 個数)')).toBe('表示する(合計 // 個数)');
        expect(tidyPastedDncl('(01) a = Tokuten[合計 // 個数]')).toBe('a = Tokuten[合計 // 個数]');
    });

    test('a `//` followed by neither a variable nor an operator is a comment', () => {
        // Cannot be told apart from `n = 1 // 生徒番号` (a known limitation).
        expect(tidyPastedDncl('(01) a = 合計 // 個数')).toBe('a = 合計 # 個数');
        expect(tidyPastedDncl('(01) n = 1 // 生徒番号（1から）、名前')).toBe('n = 1 # 生徒番号（1から）、名前');
        // Balanced brackets in the comment text are not operators.
        expect(tidyPastedDncl('(01) n = 1 // 生徒番号 (1から)')).toBe('n = 1 # 生徒番号 (1から)');
        // Operators inside a string or after a `#` do not count.
        expect(tidyPastedDncl('(01) n = 1 // 生徒番号 "a+b" # x+1')).toBe('n = 1 # 生徒番号 "a+b" # x+1');
    });

    test('a name only used inside a string or comment is not a variable', () => {
        expect(tidyPastedDncl('(01) 表示する("生徒番号") # 生徒番号\n(02) n = 1 // 生徒番号')).toBe(
            '表示する("生徒番号") # 生徒番号\nn = 1 # 生徒番号',
        );
    });

    test('does not touch `//` inside a string literal', () => {
        expect(tidyPastedDncl('表示する("http://example.com")')).toBe('表示する("http://example.com")');
        expect(tidyPastedDncl('(01) 表示する("http://x") // 説明')).toBe('表示する("http://x") # 説明');
    });

    test('leaves ordinary Smalruby DNCL code unchanged', () => {
        const code = 'もし x > 1 ならば\n  表示する(x)  # コメント\nを実行する';
        expect(tidyPastedDncl(code)).toBe(code);
    });

    test('keeps CRLF line endings', () => {
        expect(tidyPastedDncl('(01) a = 1 // 説明\r\n(02) b = 2')).toBe('a = 1 # 説明\r\nb = 2');
    });

    test('joins a statement wrapped onto unnumbered lines and closes the block at its `⎿`', () => {
        expect(
            tidyPastedDncl(
                [
                    '(01) i を 1 から 3 まで 1 ずつ増やしながら繰り返す:',
                    '(02)  ｜ 表示する(i, "人目：",',
                    '      ⎿          i * 2, "分間")',
                    '(03) 表示する("おわり")',
                ].join('\n'),
            ),
        ).toBe(
            [
                'i を 1 から 3 まで 1 ずつ増やしながら繰り返す:',
                '    表示する(i, "人目：", i * 2, "分間")',
                '表示する("おわり")',
            ].join('\n'),
        );
    });

    test('joins a statement wrapped onto unnumbered lines with `1:` line numbers', () => {
        expect(tidyPastedDncl('1: もし x > 1 ならば:\n2:  ｜ 表示する(x,\n   ⎿   "です")\n3: 表示する(x)')).toBe(
            'もし x > 1 ならば:\n    表示する(x, "です")\n表示する(x)',
        );
    });

    test('a tidied 共通テスト sample converts like the numbered original', () => {
        const sample = [
            '(00) n = 1 // 生徒番号',
            '(01) Namae = ["可燃ごみ", "不燃ごみ", "ペットボトル"]',
            '(02) shuruisu = 3',
            '(03) j を 1 から shuruisu まで 1 ずつ増やしながら繰り返す:',
            '(04)  ｜ 表示する(j, "番目：",',
            '      ⎿          Namae[j])',
            '(05) 表示する(n)',
        ].join('\n');
        const tidied = tidyPastedDncl(sample);
        expect(tidied.split('\n')[0]).toBe('n = 1 # 生徒番号');
        const result = dnclToRuby(tidied);
        expect(result.errors || []).toEqual([]);
        expect(result.ruby).toContain('# 生徒番号');
        expect(result.ruby).toContain('@_array_Namae_[@j].to_s');
    });
});

describe('hasDoubleSlash', () => {
    test('finds a `//` in the code part of a line', () => {
        expect(hasDoubleSlash('n = 1 // 生徒番号')).toBe(true);
        expect(hasDoubleSlash('a = 10 // 3')).toBe(true);
    });

    test('ignores `//` inside a string literal or a `#` comment', () => {
        expect(hasDoubleSlash('表示する("http://example.com")')).toBe(false);
        expect(hasDoubleSlash('n = 1 # 生徒番号 // 説明')).toBe(false);
        expect(hasDoubleSlash('a = 10 / 3')).toBe(false);
    });
});

describe('withDoubleSlashHint', () => {
    test('adds the hint only to errors on lines with a `//`', () => {
        const lines = ['a = 1', 'n = 1 // 生徒番号', '表示する("http://x")'];
        const errors = [
            { row: 0, column: 0, text: 'e0' },
            { row: 1, column: 0, text: 'e1' },
            { row: 2, column: 0, text: 'e2' },
            { row: 5, column: 0, text: 'e5' },
        ];
        expect(withDoubleSlashHint(errors, lines, 'use #').map((err) => err.text)).toEqual([
            'e0',
            'use #\ne1',
            'e2',
            'e5',
        ]);
    });
});

// `a = 1 // 生徒番号` now converts (to `(1 / @生徒番号).to_i`), so a `//`
// comment is found by how the line looks, not by a conversion error.
// (Issue #1711)
describe('slashCommentRows', () => {
    test('finds the lines whose `//` looks like a comment', () => {
        const lines = ['a = 1 // 生徒番号', 'b = 10 // 3', '表示する(a) // 答えを表示', 'c = 2'];
        expect(slashCommentRows(lines)).toEqual([0, 2]);
    });

    test('a `//` before a name the program uses is the quotient', () => {
        const lines = ['個数 = 2', '合計 = 7', 'a = 合計 // 個数'];
        expect(slashCommentRows(lines)).toEqual([]);
    });

    test('a `//` with an operator after it or inside brackets is the quotient', () => {
        expect(slashCommentRows(['a = 合計 // 個数 + 1', 'a = (合計 // 個数)', 'a = x // y'])).toEqual([]);
    });

    test('ignores `//` in strings and `#` comments', () => {
        expect(slashCommentRows(['表示する("http://x")', 'a = 1 # 説明 // です'])).toEqual([]);
    });
});

// A `#` or `//` in a 「...」 string is text, as in `"..."` (#1709).
describe('tidyPastedDncl and 「...」', () => {
    test('a `//` comment after a 「#」 becomes `#`', () => {
        expect(tidyPastedDncl('(00) 表示する(「#」) // 表示')).toBe('表示する(「#」) # 表示');
    });

    test('a `//` in 「...」 is not a comment', () => {
        expect(tidyPastedDncl('(00) 表示する(「a // b」)')).toBe('表示する(「a // b」)');
        expect(hasDoubleSlash('表示する(「//」)')).toBe(false);
    });

    test('a bracket in 「...」 does not join the next line', () => {
        expect(tidyPastedDncl('(00) 表示する(「(」)\n      x = 1')).toBe('表示する(「(」)\n      x = 1');
    });

    test('a # comment on a wrapped statement moves to the end of the joined line (Issue #1710)', () => {
        expect(tidyPastedDncl('(00) x = f(1, # c\n      2)\n(01) 表示する(x)')).toBe('x = f(1, 2) # c\n表示する(x)');
        expect(tidyPastedDncl('(00) 表示する(a,\n      # メモ\n      b)')).toBe('表示する(a, b) # メモ');
    });
});

// The ways other texts (a PDF, a web page, a textbook) write the line numbers and the marks
// differ only in how they look, so a paste takes them all (Issue #1756).
describe('tidyPastedDncl: the line numbers and the marks of other texts (Issue #1756)', () => {
    test('removes line numbers with spaces in the parentheses (`( 1 )`)', () => {
        expect(tidyPastedDncl('( 1 ) a = 1\n( 2 ) ｜ b = 2\n( 10 ) c = 3')).toBe('a = 1\n｜ b = 2\nc = 3');
    });

    test('removes bare line numbers (`01`, `1`) when every line has one', () => {
        expect(tidyPastedDncl('01 a = 1\n02 もし a > 0 ならば:\n03     b = 2')).toBe(
            'a = 1\nもし a > 0 ならば:\n    b = 2',
        );
        expect(tidyPastedDncl('1 a = 1\n2\n3 表示する(a,\n     2)')).toBe('a = 1\n\n表示する(a, 2)');
    });

    test('keeps a line that starts with a number when not every line has one', () => {
        expect(tidyPastedDncl('a = 1\n10 回')).toBe('a = 1\n10 回');
        expect(tidyPastedDncl('1 + 2')).toBe('1 + 2');
    });

    test('reads `L` as the L shape where it closes a block, never a variable `L`', () => {
        expect(tidyPastedDncl('(1) もし x > 0 ならば:\n(2) | y = 1\n(3) L z = 2')).toBe(
            'もし x > 0 ならば:\n    y = 1\n    z = 2',
        );
        expect(tidyPastedDncl('もし x > 0 ならば:\nL y = 1')).toBe('もし x > 0 ならば:\n⎿ y = 1');
        expect(tidyPastedDncl('もし x > 0 ならば:\n｜ もし y > 0 ならば:\n｜ L y = 1\nL z = 2')).toBe(
            'もし x > 0 ならば:\n｜ もし y > 0 ならば:\n｜ ⎿ y = 1\n⎿ z = 2',
        );
        expect(tidyPastedDncl('L = 1\nL を 1 から 3 まで 1 ずつ増やしながら繰り返す:\n    表示する(L)')).toBe(
            'L = 1\nL を 1 から 3 まで 1 ずつ増やしながら繰り返す:\n    表示する(L)',
        );
    });

    test.each([
        ['( 1 ) もし x > 0 ならば:\n( 2 ) │ y = 1\n( 3 ) └ z = 2'],
        ['01 もし x > 0 ならば:\n02 | y = 1\n03 L z = 2'],
        ['(01) もし x > 0 ならば:\n(02) ｜ y = 1\n(03) ⎿ z = 2'],
        ['もし x ＞ ０ ならば：\n　　y ＝ １\n　　z ＝ ２'],
    ])('the pasted program reads as the same Ruby: %s', (pasted) => {
        const { ruby, errors } = dnclToRuby(tidyPastedDncl(pasted));
        expect(errors).toEqual([]);
        expect(ruby).toBe('if @x > 0\n  @y = 1\n  @z = 2\nend');
    });
});

// The copy with line numbers and rules (`problemFormText`) pasted back into the editor comes back
// as the text it was copied from: the rules become the indent again (Issue #2549). The programs
// are written for these tests; no question of the test is used (docs/dncl/policy.md).
describe('tidyPastedDncl: the rules become the indent (Issue #2549)', () => {
    test.each([
        [
            'nested blocks, full-width rules',
            [
                '(01) s = 0',
                '(02) i を 1 から 3 まで 1 ずつ増やしながら繰り返す:',
                '(03) ｜ もし i % 2 == 0 ならば:',
                '(04) ｜ ｜ s = s + i',
                '(05) ⎿ ⎿ 表示する(s)',
                '(06) 表示する("おわり")',
            ],
            [
                's = 0',
                'i を 1 から 3 まで 1 ずつ増やしながら繰り返す:',
                '    もし i % 2 == 0 ならば:',
                '        s = s + i',
                '        表示する(s)',
                '表示する("おわり")',
            ],
        ],
        [
            'half-width rules (`｜` turned into `|` by the auto-correct, `└`)',
            ['(1) もし a > 0 ならば:', '(2) | b = 1', '(3) | # メモ', '(4) └ c = 2'],
            ['もし a > 0 ならば:', '    b = 1', '    # メモ', '    c = 2'],
        ],
        [
            'if / else: the L only on the last branch',
            [
                '(01) もし x > 0 ならば:',
                '(02) ｜ 表示する("正")',
                '(03) そうでなければ:',
                '(04) ⎿ 表示する("0 か負")',
            ],
            ['もし x > 0 ならば:', '    表示する("正")', 'そうでなければ:', '    表示する("0 か負")'],
        ],
        [
            'a blank line with bars',
            ['(01) もし a ならば:', '(02) ｜ x = 1', '(03) ｜', '(04) ⎿ y = 1'],
            ['もし a ならば:', '    x = 1', '', '    y = 1'],
        ],
        [
            'the DNCL-like form closed by its word',
            ['(01) もし a ならば', '(02) ｜ x = 1', '(03) を実行する', '(04) y = 2'],
            ['もし a ならば', '    x = 1', 'を実行する', 'y = 2'],
        ],
    ])('%s', (name, pasted, text) => {
        expect(tidyPastedDncl(pasted.join('\n'))).toBe(text.join('\n'));
    });

    test.each([
        [
            's = 0',
            'i を 1 から 3 まで 1 ずつ増やしながら繰り返す:',
            '    もし i % 2 == 0 ならば:',
            '        s = s + i',
            '    そうでなくもし i == 3 ならば:',
            '        表示する(「| は罫線ではない」)',
            '    そうでなければ:',
            '        表示する(s)',
            '表示する(s)',
        ],
        ['もし a ならば:', '    x = 1', '', '    # コメント', '    y = 1', 'z = 2'],
    ])('the copy pasted back is the text it was copied from', (...code) => {
        const text = code.join('\n');
        expect(tidyPastedDncl(problemFormText(text))).toBe(text);
    });

    test('keeps the rules of a DNCL-like block closed by a `⎿` (the indent would not close it)', () => {
        const pasted = '(01) もし a ならば\n(02) ⎿ x = 1\n(03) y = 2';
        expect(tidyPastedDncl(pasted)).toBe('もし a ならば\n⎿ x = 1\ny = 2');
        expect(dnclToRuby(tidyPastedDncl(pasted)).ruby).toBe('if @a\n  @x = 1\nend\n@y = 2');
    });

    test('keeps the rules that do not draw blocks', () => {
        expect(tidyPastedDncl('(01) a = 1\n(02) ｜ b = 2')).toBe('a = 1\n｜ b = 2');
    });
});
