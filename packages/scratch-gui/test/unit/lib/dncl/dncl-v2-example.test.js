// === Smalruby: End-to-end test for the DNCLv2 example program from Issue #640 ===
//
// Verifies that the linear-search example from
// https://nodai2hitc.github.io/ictl_example/ — the canonical "can the
// editor accept a paste-and-run DNCLv2 program?" example — converts
// through the full pipeline:
//
//   DNCLv2 source → dncl-v2-preprocessor → existing DNCL → Ruby
//
// The expected Ruby output matches what was agreed in Issue #640's
// design discussion. After turn-around (blocks → Ruby → DNCL) the
// output is allowed to be the Smalruby DNCL form (i.e. NOT preserve
// `(N)`, `｜`, `⎿`, trailing `:` — those are unidirectional).

import { dnclToRuby } from '../../../../src/lib/dncl/dncl-to-ruby';
import { dnclV2Preprocess } from '../../../../src/lib/dncl/dncl-v2-preprocessor';

describe('DNCLv2 end-to-end: linear search example (Issue #640)', () => {
    const dnclv2Source = [
        '(1)  Data = [3,18,29,33,48,52,62,77,89,97]',
        '(2)  kazu = 要素数(Data)',
        '(3)  表示する("0～99の数字を入力してください")',
        '(4)  atai = 【外部からの入力】',
        '(5)  hidari = 0 , migi = kazu - 1',
        '(6)  owari = 0',
        '(7)  hidari <= migi and owari == 0 の間繰り返す:',
        '(8)   ｜ aida = (hidari+migi) ÷ 2 # 演算子÷は商の整数値を返す',
        '(9)   ｜ もし Data[aida] == atai ならば:',
        '(10)  ｜  ｜ 表示する(atai, "は", aida, "番目にありました")',
        '(11)  ｜  ｜ owari = 1',
        '(12)  ｜ そうでなくもし Data[aida] < atai ならば:',
        '(13)  ｜  ｜ hidari = aida + 1',
        '(14)  ｜ そうでなければ:',
        '(15)  ⎿  ⎿ migi = aida - 1',
        '(16) もし owari == 0 ならば:',
        '(17)  ⎿ 表示する(atai, "は見つかりませんでした")',
        '(18) 表示する("添字", " ", "要素")',
        '(19) i を 0 から kazu - 1 まで 1 ずつ増やしながら繰り返す:',
        '(20)  ⎿ 表示する(i, " ", Data[i])',
    ].join('\n');

    test('pre-processor produces well-formed Smalruby DNCL', () => {
        const out = dnclV2Preprocess(dnclv2Source);
        const lines = out.split('\n');
        // Spot-check key lines: line numbers gone, markers expanded,
        // colons stripped, end inserts present.
        expect(lines).toEqual([
            'Data = [3,18,29,33,48,52,62,77,89,97]',
            'kazu = 要素数(Data)',
            '表示する("0～99の数字を入力してください")',
            'atai = 【外部からの入力】',
            'hidari = 0',
            'migi = kazu - 1',
            'owari = 0',
            'hidari <= migi かつ owari == 0 の間',
            '  aida = (hidari+migi) ÷ 2 # 演算子÷は商の整数値を返す',
            '  もし Data[aida] == atai ならば',
            '    表示する(atai, "は", aida, "番目にありました")',
            '    owari = 1',
            '  そうでなくもし Data[aida] < atai ならば',
            '    hidari = aida + 1',
            '  そうでなければ',
            '    migi = aida - 1',
            '  を実行する',
            'を繰り返す',
            'もし owari == 0 ならば',
            '  表示する(atai, "は見つかりませんでした")',
            'を実行する',
            '表示する("添字", " ", "要素")',
            'i を 0 から kazu - 1 まで 1 ずつ増やしながら',
            '  表示する(i, " ", Data[i])',
            'を繰り返す',
        ]);
    });

    test('dnclToRuby produces the Ruby code agreed in the design', () => {
        const result = dnclToRuby(dnclv2Source);
        expect(result.errors).toEqual([]);
        // Note: the existing DNCL → Ruby converter preserves the original
        // spacing inside expressions (no automatic spaces around operators
        // or commas), so we keep the same spacing as the source.
        const expected = [
            '@_array_Data_ = [3,18,29,33,48,52,62,77,89,97]',
            '@kazu = @_array_Data_.length',
            'puts("0～99の数字を入力してください")',
            'ask("")',
            '@atai = answer',
            '@hidari = 0',
            '@migi = @kazu - 1',
            '@owari = 0',
            'while @hidari <= @migi && @owari == 0',
            '  @aida = (@hidari+@migi) / 2 # 演算子÷は商の整数値を返す',
            '  if @_array_Data_[@aida] == @atai',
            '    puts(@atai.to_s + "は" + @aida.to_s + "番目にありました")',
            '    @owari = 1',
            '  elsif @_array_Data_[@aida] < @atai',
            '    @hidari = @aida + 1',
            '  else',
            '    @migi = @aida - 1',
            '  end',
            'end',
            'if @owari == 0',
            '  puts(@atai.to_s + "は見つかりませんでした")',
            'end',
            'puts("添字" + " " + "要素")',
            '@i = 0',
            'while @i <= @kazu - 1',
            '  puts(@i.to_s + " " + @_array_Data_[@i].to_s)',
            '  @i += 1',
            'end',
        ].join('\n');
        expect(result.ruby).toBe(expected);
    });
});
