// Standard-form notations found on the ICTL 共通テスト sample pages (Issue #1186)
//
// The sample programs on https://nodai2hitc.github.io/ictl_example/ use a
// few notations the pre-processor did not handle, so the generated Ruby was
// syntactically broken (e.g. `end が足りません`). Each block below pins one
// notation; the end-to-end cases check that whole programs in those notations
// become Ruby that prism parses without errors. The programs are our own,
// written in the same notations: the tests do not use the problems of the
// 大学入試センター (docs/dncl/policy.md).
import { dnclToRuby } from '../../../../src/lib/dncl/dncl-to-ruby';
import { loadPrism } from '../../../../src/lib/prism-parser';

/**
 * Strip string literals and comments, then report whether any non-ASCII
 * character (= an untranslated Japanese keyword) survived in the code.
 * @param {string} ruby - Generated Ruby source.
 * @returns {boolean} True when untranslated Japanese remains in code.
 */
const hasUntranslatedJapanese = (ruby) => /[\u0080-\uffff]/.test(ruby.replace(/"[^"]*"/g, '').replace(/#.*$/gm, ''));

describe('the standard form: ICTL sample notations (Issue #1186)', () => {
    // `//` is always integer division; 共通テスト `//` comments are turned
    // into `#` when pasted (see dncl-paste-tidy.test.js, Issue #1192).

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
            '    console.puts("a" + @t.to_s + "b")',
            '  end',
            '  @t += 1',
            'end',
            // The marker-only line closes the blocks; the Ruby keeps its line at the end.
            '',
        ]);
    });
});

describe('DNCLv2 input forms (Issue #1186)', () => {
    test('`【整数を入力】` asks and converts the answer to an integer', () => {
        expect(dnclToRuby('n =【整数を入力】').ruby).toBe('@n = console.gets.to_i');
    });

    test('`【文字列を入力】` asks and keeps the answer as a string', () => {
        expect(dnclToRuby('meishou =【文字列を入力】').ruby).toBe('@meishou = console.gets');
    });
});

describe('programs in the notations of the ICTL samples convert to valid Ruby (Issue #1186)', () => {
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

    test('three nested blocks, `もし( … ) and ( … )ならば:` and a print over two lines', () => {
        expectValidRuby(
            [
                '(01) Kazu = [3, 7, 2, 8, 5]',
                '(02) saisho = 10',
                '(03) Shirushi = [0, 0, 0, 0, 0]',
                '(04) kai を 1 から 2 まで 1 ずつ増やしながら繰り返す:',
                '(05)  ｜ Kosuu = [0, 0]',
                '(06)  ｜ i を 0 から 要素数(Kazu) - 1 まで 1 ずつ増やしながら繰り返す:',
                '(07)  ｜  ｜ g = Kazu[i] % 2',
                '(08)  ｜  ｜ もし( Kosuu[g] < kai ) and ( Kazu[i] * kai < saisho )ならば:',
                '(09)  ｜  ｜  ｜ Shirushi[i] = kai',
                '(10)  ⎿  ⎿  ⎿ Kosuu[g] = Kosuu[g] + 1',
                '(11) i を 0 から 要素数(Kazu) - 1 まで 1 ずつ増やしながら繰り返す:',
                '(12)  ｜ もし Shirushi[i] > 0 ならば:',
                '(13)  ｜  ｜ 表示する(Kazu[i], "には",',
                '      ⎿  ⎿ Shirushi[i], "回目に印を付けた")',
            ].join('\n'),
        );
    });

    test('`(00-1)` line numbers, aligned `=`, two assignments on a line and two if-else in a loop', () => {
        expectValidRuby(
            [
                '(00-1) Shurui = [1,2,2,1]',
                '(00-2) Kaisuu  = [3,1,2,4]',
                '(00-3) Kingaku = [150,120,200,90]',
                '(01) ninzu = 3',
                '(02) nomimono = 0, okashi = 0',
                '(03) i を 1 から ninzu まで 1 ずつ増やしながら繰り返す:',
                '(04)  ｜ もし Kaisuu[i] >= 3 ならば:',
                '(05)  ｜  ｜ nedan = Kingaku[i] - 30',
                '(06)  ｜ そうでなければ:',
                '(07)  ｜  ⎿ nedan = Kingaku[i]',
                '(08)  ｜ もし Shurui[i] == 1 ならば:',
                '(09)  ｜  ｜ nomimono = nomimono + nedan',
                '(10)  ｜ そうでなければ:',
                '(11)  ⎿  ⎿ okashi = okashi + nedan',
                '(12) 表示する("飲み物の合計は", nomimono, "円")',
                '(13) 表示する("お菓子の合計は", okashi, "円")',
            ].join('\n'),
        );
    });

    test('`(00)` with a comment, `=【文字列を入力】` and a block body without `｜`', () => {
        expectValidRuby(
            [
                '(00) n = 2 # 班の番号',
                '(01) Kamoku = ["国語", "数学", "英語"]',
                '(02) kamokusu = 3',
                '(03) 表示する("好きな教科は？")',
                '(04) suki =【文字列を入力】',
                '(05) j を 1 から kamokusu まで 1 ずつ増やしながら繰り返す:',
                '(06) もし Kamoku[j] == suki ならば:',
                '(07) ⎿⎿ Sentaku[n] = j',
            ].join('\n'),
        );
    });

    test('a print over four lines continued with `｜` inside nested loops', () => {
        expectValidRuby(
            [
                '(01) Ten = [6, 8, 5, 9, 7, 4]',
                '(02) goukei = 0',
                '(03) kumi を 1 から 3 まで 1 ずつ増やしながら繰り返す:',
                '(04)  ｜ saikou = 0',
                '(05)  ｜ i を kumi * 2 - 2 から kumi * 2 - 1 まで 1 ずつ増やしながら繰り返す:',
                '(06)  ｜  ｜ もし Ten[i] > saikou ならば:',
                '(07)  ｜  ⎿  ⎿ saikou = Ten[i]',
                '(08)  ｜ 表示する("第", kumi, "組 … ",',
                '      ｜          "最高点：", saikou, "点～",',
                '      ｜          "それまでの合計：",',
                '      ｜          goukei + saikou, "点")',
                '(09)  ⎿ goukei = goukei + saikou',
            ].join('\n'),
        );
    });

    test('a full-width `：`, `減らしながら`, `÷` and `%`', () => {
        expectValidRuby(
            [
                '(1) Tani = [1,60,3600]',
                '(2) byousu = 4000',
                '(3) kazu = 0, nokori = byousu',
                '(4) i を 2 から 0 まで 1 ずつ減らしながら繰り返す：',
                '(5)  ｜ kazu = nokori ÷ Tani[i]',
                '(6)  ｜ nokori = nokori % Tani[i]',
                '(7)  ⎿ 表示する(kazu)',
                '(8) 表示する(nokori)',
            ].join('\n'),
        );
    });
});

describe('DNCLv2 blocks written with indentation only (Issue #1186)', () => {
    let prism;
    beforeAll(async () => {
        prism = await loadPrism();
    });

    test('a program with no line numbers / ｜ / ⎿ gets its ends', () => {
        const result = dnclToRuby(
            [
                'Kazu = [3, 7, 2, 8, 5]',
                'saidai = 2',
                'Shirushi = [0, 0, 0, 0, 0]',
                'Kosuu = [0, 0]',
                'i を 0 から 要素数(Kazu) - 1 まで 1 ずつ増やしながら繰り返す:',
                '    g = Kazu[i] % 2',
                '    もし Kosuu[g] < saidai ならば:',
                '        Shirushi[i] = 1',
                '        Kosuu[g] = Kosuu[g] + 1',
            ].join('\n'),
        );
        expect(result.errors).toEqual([]);
        expect(prism.parse(result.ruby).errors).toEqual([]);
        expect(result.ruby.match(/^\s*end$/gm)).toHaveLength(2);
    });
});
