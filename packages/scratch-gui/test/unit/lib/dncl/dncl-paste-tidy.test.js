// Tidying DNCL code pasted into the Japanese mode editor (Issue #1192)

import {hasDoubleSlash, tidyPastedDncl, withDoubleSlashHint} from '../../../../src/lib/dncl/dncl-paste-tidy';
import {dnclToRuby} from '../../../../src/lib/dncl/dncl-to-ruby';

describe('tidyPastedDncl', () => {
    test('removes line numbers, including the hyphenated form', () => {
        expect(tidyPastedDncl('(00-1) a = 1\n(01) b = 2\n(02)  ｜ c = 3')).toBe('a = 1\nb = 2\n｜ c = 3');
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

    test('joins a statement wrapped onto unnumbered lines and keeps its `⎿`', () => {
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
                '⎿ 表示する(i, "人目：", i * 2, "分間")',
                '表示する("おわり")',
            ].join('\n'),
        );
    });

    test('joins a statement wrapped onto unnumbered lines with `1:` line numbers', () => {
        expect(tidyPastedDncl('1: もし x > 1 ならば:\n2:  ｜ 表示する(x,\n   ⎿   "です")\n3: 表示する(x)')).toBe(
            'もし x > 1 ならば:\n⎿ 表示する(x, "です")\n表示する(x)',
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
            {row: 0, column: 0, text: 'e0'},
            {row: 1, column: 0, text: 'e1'},
            {row: 2, column: 0, text: 'e2'},
            {row: 5, column: 0, text: 'e5'},
        ];
        expect(withDoubleSlashHint(errors, lines, 'use #').map(err => err.text)).toEqual([
            'e0',
            'use #\ne1',
            'e2',
            'e5',
        ]);
    });
});
