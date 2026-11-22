// End-to-end test for a whole program in the standard form (Issue #640).
//
// A binary search written for Smalruby in the notation of the 共通テスト用プログラム表記
// (line numbers, `｜` / `⎿`, trailing `:`, `÷`, a comma between two assignments, the
// input and a print with many arguments). It is our own program: the tests do not use
// the problems of the 大学入試センター (docs/dncl/policy.md).
//
//   standard form → ja-notation → Ruby
//
// After turn-around (blocks → Ruby → Japanese) the output is allowed to be the
// DNCL-like form (i.e. NOT preserve `(N)`, `｜`, `⎿`, trailing `:` — those are
// unidirectional).
import { dnclToRuby } from '../../../../src/lib/dncl/dncl-to-ruby';

describe('the standard form end-to-end: a binary search (Issue #640)', () => {
    const dnclv2Source = [
        '(1)  Shincho = [128,135,141,146,150,157,163,170]',
        '(2)  ninzu = 要素数(Shincho)',
        '(3)  表示する("さがす身長を入力してください")',
        '(4)  sagasu = 【外部からの入力】',
        '(5)  sita = 0 , ue = ninzu - 1',
        '(6)  mitsuketa = 0',
        '(7)  sita <= ue and mitsuketa == 0 の間繰り返す:',
        '(8)   ｜ naka = (sita+ue) ÷ 2 # まん中の番号',
        '(9)   ｜ もし Shincho[naka] == sagasu ならば:',
        '(10)  ｜  ｜ 表示する(sagasu, "cmは", naka, "番の人です")',
        '(11)  ｜  ｜ mitsuketa = 1',
        '(12)  ｜ そうでなくもし Shincho[naka] < sagasu ならば:',
        '(13)  ｜  ｜ sita = naka + 1',
        '(14)  ｜ そうでなければ:',
        '(15)  ⎿  ⎿ ue = naka - 1',
        '(16) もし mitsuketa == 0 ならば:',
        '(17)  ⎿ 表示する(sagasu, "cmの人はいませんでした")',
        '(18) 表示する("番号", " ", "身長")',
        '(19) i を 0 から ninzu - 1 まで 1 ずつ増やしながら繰り返す:',
        '(20)  ⎿ 表示する(i, " ", Shincho[i])',
    ].join('\n');

    test('dnclToRuby produces the Ruby code agreed in the design', () => {
        const result = dnclToRuby(dnclv2Source);
        expect(result.errors).toEqual([]);
        const expected = [
            '@_array_Shincho_ = [128, 135, 141, 146, 150, 157, 163, 170]',
            '@ninzu = @_array_Shincho_.length',
            'console.puts("さがす身長を入力してください")',
            '@sagasu = console.gets',
            '@sita = 0',
            '@ue = @ninzu - 1',
            '@mitsuketa = 0',
            'while @sita <= @ue && @mitsuketa == 0',
            '  @naka = ((@sita + @ue) / 2).to_i # まん中の番号',
            '  if @_array_Shincho_[@naka] == @sagasu',
            '    console.puts(@sagasu.to_s + "cmは" + @naka.to_s + "番の人です")',
            '    @mitsuketa = 1',
            '  elsif @_array_Shincho_[@naka] < @sagasu',
            '    @sita = @naka + 1',
            '  else',
            '    @ue = @naka - 1',
            '  end',
            'end',
            'if @mitsuketa == 0',
            '  console.puts(@sagasu.to_s + "cmの人はいませんでした")',
            'end',
            'console.puts("番号" + " " + "身長")',
            '@i = 0',
            'while @i <= @ninzu - 1',
            '  console.puts(@i.to_s + " " + @_array_Shincho_[@i].to_s)',
            '  @i += 1',
            'end',
        ].join('\n');
        expect(result.ruby).toBe(expected);
    });
});
