// Tidying DNCL code pasted into the Japanese mode editor (Issue #1192)

import {tidyPastedDncl} from '../../../../src/lib/dncl/dncl-paste-tidy';
import {dnclToRuby} from '../../../../src/lib/dncl/dncl-to-ruby';

describe('tidyPastedDncl', () => {
    test('removes line numbers, including the hyphenated form', () => {
        expect(tidyPastedDncl('(00-1) a = 1\n(01) b = 2\n(02)  ｜ c = 3')).toBe('a = 1\nb = 2\n｜ c = 3');
    });

    test('turns a `//` comment on a numbered line into `#`', () => {
        expect(tidyPastedDncl('(00) n = 1 // 生徒番号')).toBe('n = 1 # 生徒番号');
    });

    test('turns a `//` comment into `#` when the line numbers were already removed', () => {
        expect(tidyPastedDncl('n = 1 // 生徒番号')).toBe('n = 1 # 生徒番号');
    });

    test('a `//` with nothing after it is a comment', () => {
        expect(tidyPastedDncl('n = 1 //')).toBe('n = 1 #');
    });

    test('keeps `//` between ASCII operands as integer division', () => {
        expect(tidyPastedDncl('a = 10 // 3')).toBe('a = 10 // 3');
        expect(tidyPastedDncl('(1) a = x // y')).toBe('a = x // y');
        expect(tidyPastedDncl('a = x // (n + 1)')).toBe('a = x // (n + 1)');
    });

    test('keeps `//` as integer division when a Japanese name is a variable of the program', () => {
        expect(tidyPastedDncl('個数 = 3\n合計 = 10\na = 合計 // 個数')).toBe('個数 = 3\n合計 = 10\na = 合計 // 個数');
        // The variable may be defined in the code already in the editor.
        expect(tidyPastedDncl('a = 合計 // 個数', '合計 = 10\n個数 = 3')).toBe('a = 合計 // 個数');
    });

    test('a Japanese name used nowhere else is comment text (cannot be told apart from `n = 1 // 生徒番号`)', () => {
        expect(tidyPastedDncl('a = 合計 // 個数')).toBe('a = 合計 # 個数');
        expect(tidyPastedDncl('合計 = 10\na = 合計 // 個数')).toBe('合計 = 10\na = 合計 # 個数');
    });

    test('a name only used inside a string or comment is not a variable', () => {
        expect(tidyPastedDncl('表示する("生徒番号") # 生徒番号\nn = 1 // 生徒番号')).toBe(
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
