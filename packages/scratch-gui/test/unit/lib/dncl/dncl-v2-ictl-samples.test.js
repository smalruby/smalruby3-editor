// === Smalruby: DNCLv2 forms used by the ICTL 共通テスト samples (Issue #1186) ===
//
// The sample programs on https://nodai2hitc.github.io/ictl_example/ use a
// few DNCLv2 notations the pre-processor did not handle, so the generated
// Ruby was syntactically broken (e.g. `end が足りません`). Each block below
// pins one notation; the end-to-end cases check that whole (shortened)
// sample programs become Ruby that prism parses without errors.

import { loadPrism } from '../../../../src/lib/prism-parser';
import { dnclToRuby } from '../../../../src/lib/dncl/dncl-to-ruby';
import { dnclV2Preprocess } from '../../../../src/lib/dncl/dncl-v2-preprocessor';

/**
 * Strip string literals and comments, then report whether any non-ASCII
 * character (= an untranslated Japanese keyword) survived in the code.
 * @param {string} ruby - Generated Ruby source.
 * @returns {boolean} True when untranslated Japanese remains in code.
 */
const hasUntranslatedJapanese = (ruby) =>
    /[\u0080-\uffff]/.test(ruby.replace(/"[^"]*"/g, '').replace(/#.*$/gm, ''));

describe('DNCLv2 pre-processor: ICTL sample notations (Issue #1186)', () => {
    test('`もし(` and `)ならば` without surrounding spaces become an if opener', () => {
        expect(dnclV2Preprocess('もし( a < b ) and ( c == 0 )ならば:')).toBe(
            'もし ( a < b ) かつ ( c == 0 ) ならば',
        );
        expect(dnclToRuby('もし( a < b )ならば:\n ⎿ a = 1').ruby).toBe(
            'if ( @a < @b )\n  @a = 1\nend',
        );
    });

    test('`そうでなくもし(` and `)の間` without spaces are recognized', () => {
        expect(dnclV2Preprocess('そうでなくもし(a == 1)ならば')).toBe(
            'そうでなくもし (a == 1) ならば',
        );
        expect(dnclV2Preprocess('(a < 3)の間繰り返す:')).toBe('(a < 3) の間');
    });

    test('hyphenated line numbers like `(00-1)` are stripped', () => {
        expect(dnclV2Preprocess('(00-1) Iremono = [2,2,1]')).toBe(
            'Iremono = [2,2,1]',
        );
        expect(dnclV2Preprocess('(00) n = 1')).toBe('n = 1');
    });

    test('a full-width colon `：` after a control-flow keyword is stripped', () => {
        expect(
            dnclV2Preprocess('i を 2 から n まで 1 ずつ増やしながら繰り返す：'),
        ).toBe('i を 2 から n まで 1 ずつ増やしながら');
        expect(dnclV2Preprocess('もし a < 10 ならば：')).toBe(
            'もし a < 10 ならば',
        );
    });

    test('a full-width colon inside a string is left alone', () => {
        expect(dnclV2Preprocess('表示する("待ち時間：")')).toBe(
            '表示する("待ち時間：")',
        );
    });

    test('`//` comments become `#` comments (but not inside strings)', () => {
        expect(dnclV2Preprocess('(00) n = 1 // 生徒番号')).toBe(
            'n = 1 # 生徒番号',
        );
        expect(dnclV2Preprocess('表示する("http://x")')).toBe(
            '表示する("http://x")',
        );
        // `//` between ASCII operands stays the integer-division operator.
        expect(dnclV2Preprocess('(1) a = 10 // 3')).toBe('a = 10 // 3');
    });

    test('un-numbered lines keep `//` as integer division', () => {
        expect(dnclV2Preprocess('a = 合計 // 個数')).toBe('a = 合計 // 個数');
        expect(dnclToRuby('a = 合計 // 個数').ruby).toBe(
            '@a = (@合計 / @個数).to_i',
        );
    });

    test('an unclosed bracket in un-numbered code does not swallow later lines', () => {
        expect(
            dnclV2Preprocess('表示する("a"\nx = 1\ny = 2').split('\n'),
        ).toEqual(['表示する("a"', 'x = 1', 'y = 2']);
    });

    test('a statement continued on an unnumbered line is joined', () => {
        const source = [
            '(1) i を 1 から 3 まで 1 ずつ増やしながら繰り返す:',
            '(2)  ｜ 表示する(i, "人目の",',
            '      ⎿          i * 2, "分間")',
            '(3) 表示する("end")',
        ].join('\n');
        expect(dnclV2Preprocess(source).split('\n')).toEqual([
            'i を 1 から 3 まで 1 ずつ増やしながら',
            '  表示する(i, "人目の", i * 2, "分間")',
            'を繰り返す',
            '表示する("end")',
        ]);
    });

    test('`⎿` markers on continuation lines and a marker-only line both close blocks', () => {
        const source = [
            '(1) t を 1 から 2 まで 1 ずつ増やしながら繰り返す：',
            '(2)  ｜ もし t < 10 ならば：',
            '(3)  ｜  ｜ 表示する("a", t,',
            '      ｜  ⎿          "b")',
            '      ⎿ ',
        ].join('\n');
        expect(dnclToRuby(source).ruby.split('\n')).toEqual([
            '@t = 1',
            'while @t <= 2',
            '  if @t < 10',
            '    puts("a" + @t.to_s + "b")',
            '  end',
            '  ',
            '  @t += 1',
            'end',
        ]);
    });
});

describe('DNCLv2 array declaration (Issue #1186)', () => {
    test('`配列変数 X を初期化する` becomes an empty array', () => {
        expect(dnclV2Preprocess('(02) 配列変数 Hirabun を初期化する')).toBe(
            'Hirabun = []',
        );
        expect(
            dnclToRuby('配列変数 Hirabun を初期化する\nHirabun[0] = 1').ruby,
        ).toBe('@_array_Hirabun_ = []\n@_array_Hirabun_[0] = 1');
    });
});

describe('DNCLv2 input forms (Issue #1186)', () => {
    test('`【整数を入力】` asks and converts the answer to an integer', () => {
        expect(dnclToRuby('n =【整数を入力】').ruby).toBe(
            'ask("")\n@n = answer.to_i',
        );
    });

    test('`【文字列を入力】` asks and keeps the answer as a string', () => {
        expect(dnclToRuby('meishou =【文字列を入力】').ruby).toBe(
            'ask("")\n@meishou = answer',
        );
    });
});

describe('ICTL sample programs convert to valid Ruby (Issue #1186)', () => {
    let prism;
    beforeAll(async () => {
        prism = await loadPrism();
    });

    const expectValidRuby = (source) => {
        const result = dnclToRuby(source);
        expect(result.errors).toEqual([]);
        expect(prism.parse(result.ruby).errors).toEqual([]);
        expect(hasUntranslatedJapanese(result.ruby)).toBe(false);
        return result.ruby;
    };

    test('R8 追・再試験: 問題が重複しない四つのクイズ集を作るプログラム', () => {
        expectValidRuby(
            [
                '(01) Bunya = [2, 0, 2, 2, 1, 2, 0, 1]',
                '(02) saidai = 5',
                '(03) Saiyou = [0, 0, 0, 0, 0, 0, 0, 0]',
                '(04) c を 1 から 4 まで 1 ずつ増やしながら繰り返す:',
                '(05)  ｜ Mondaisu = [0, 0, 0, 0, 0, 0]',
                '(06)  ｜ i を 0 から 要素数(Bunya) - 1 まで 1 ずつ増やしながら繰り返す:',
                '(07)  ｜  ｜ b = Bunya[i]',
                '(08)  ｜  ｜ もし( Mondaisu[b] < saidai ) and ( Saiyou[i] == 0 )ならば:',
                '(09)  ｜  ｜  ｜ Saiyou[i] = c',
                '(10)  ⎿  ⎿  ⎿ Mondaisu[b] = Mondaisu[b] + 1',
                '(11) i を 0 から 要素数(Bunya) - 1 まで 1 ずつ増やしながら繰り返す:',
                '(12)  ｜ もし Saiyou[i] > 0 ならば:',
                '(13)  ｜  ｜ 表示する("番号", i, "の問題を",',
                '      ⎿  ⎿ Saiyou[i], "番のクイズ集に入れる")',
            ].join('\n'),
        );
    });

    test('R7 追・再試験: ごみの総重量を計算するプログラム', () => {
        expectValidRuby(
            [
                '(00-1) Iremono = [2,2,1,1]',
                '(00-2) Shurui  = [1,1,2,1]',
                '(00-3) Keiryou = [112,1139,717,1206]',
                '(01) ninzu = 3',
                '(02) kanen = 0, funen = 0',
                '(03) i を 1 から ninzu まで 1 ずつ増やしながら繰り返す:',
                '(04)  ｜ もし Iremono[i] == 1 ならば:',
                '(05)  ｜  ｜ gomi = Keiryou[i] - 350',
                '(06)  ｜ そうでなければ:',
                '(07)  ｜  ⎿ gomi = Keiryou[i]',
                '(08)  ｜ もし Shurui[i] == 1 ならば:',
                '(09)  ｜  ｜ kanen = kanen + gomi',
                '(10)  ｜ そうでなければ:',
                '(11)  ⎿  ⎿ funen = funen + gomi',
                '(12) 表示する("可燃ごみの総重量は", kanen, "g")',
                '(13) 表示する("不燃ごみの総重量は", funen, "g")',
            ].join('\n'),
        );
    });

    test('R7 追・再試験: ごみ拾いの結果を入力するプログラム改', () => {
        expectValidRuby(
            [
                '(00) n = 1 // 生徒番号',
                '(01) Namae = ["可燃ごみ", "不燃ごみ", "ペットボトル"]',
                '(02) shuruisu = 3',
                '(03) 表示する("ごみの種類の名称は？")',
                '(04) meishou =【文字列を入力】',
                '(05) j を 1 から shuruisu まで 1 ずつ増やしながら繰り返す:',
                '(06) もし Namae[j] == meishou ならば:',
                '(07) ⎿⎿ Shurui[n] = j',
            ].join('\n'),
        );
    });

    test('R7 本試験: 各工芸品の担当と期間の一覧を表示するプログラム', () => {
        expectValidRuby(
            [
                '(01) Nissu = [4, 1, 3, 1, 3, 4, 2, 4, 3]',
                '(02) kougeihinsu = 9',
                '(03) Akibi = [1, 1, 1]',
                '(04) buinsu = 3',
                '(05) kougeihin を 1 から kougeihinsu まで 1 ずつ増やしながら繰り返す:',
                '(06)  ｜ tantou = 1',
                '(07)  ｜ buin を 2 から buinsu まで 1 ずつ増やしながら繰り返す:',
                '(08)  ｜  ｜ もし Akibi[buin] < Akibi[tantou] ならば:',
                '(09)  ｜  ⎿  ⎿ tantou = buin',
                '(10)  ｜ 表示する("工芸品", kougeihin, " … ",',
                '      ｜          "部員", tantou, "：",',
                '      ｜          Akibi[tantou], "日目～",',
                '      ｜          Akibi[tantou] + Nissu[kougeihin] - 1, "日目")',
                '(11)  ⎿ Akibi[tantou] = Akibi[tantou] + Nissu[kougeihin]',
            ].join('\n'),
        );
    });

    test('試作問題2022: 目標の金額ちょうどになる最小の硬貨枚数を計算するプログラム', () => {
        expectValidRuby(
            [
                '(1) Kouka = [1,5,10,50,100]',
                '(2) kingaku = 46',
                '(3) maisu = 0, nokori = kingaku',
                '(4) i を 4 から 0 まで 1 ずつ減らしながら繰り返す：',
                '(5)  ｜ maisu = maisu + nokori ÷ Kouka[i]',
                '(6)  ⎿ nokori = nokori % Kouka[i]',
                '(7) 表示する(maisu)',
            ].join('\n'),
        );
    });
});
