# 日本語モードのコーパスとゴールデン（テストデータ）

日本語モードの変換の作り直し（`ja-notation`。設計は `docs/ruby-editor/converter-roadmap.md` の 2 章・4 章）のための安全網。
いまの `dnclToRuby` / `rubyToDncl` が出すものを記録しておき、新しい変換に切りかえる前に **差が 0** であることを確かめる。

| ファイル | 中身 |
|---|---|
| `corpus/ja.json` | 日本語のプログラム（`{ id, from, ja }`）。`from` は集めた場所（最大 3 つ） |
| `corpus/ruby.json` | 日本語にする Ruby のプログラム（`{ id, from, ruby }`） |
| `golden/ja.json` | 日本語のプログラムごとの、いまの出力（下の表） |
| `golden/ruby.json` | Ruby のプログラムごとの、いまの出力（`ja`・`errors`・`back`） |

`golden/ja.json` の 1 件:

| 項目 | 中身 |
|---|---|
| `ruby` / `errors` / `blockErrors` | `dnclToRuby` の結果（誤りの文と、日本語の行・列） |
| `rubyLines` | Ruby の行ごとの、日本語の行（行の対応） |
| `converterErrors` | その Ruby をブロックにしたときの誤り。日本語モードが見せるとおり、日本語の行に直したもの |
| `blocks` | ブロック（短い記法。`test/unit/helpers/block-notation.js`。カスタムブロックの引数の ID は `arg1`・`arg2` …） |
| `shown` | ブロックから Ruby（生成器）と日本語（`rubyToDncl`）に戻したもの。日本語モードがもう一度見せる形 |

`id` は中身の SHA-1 の先頭 10 文字なので、同じプログラムは何度集めても同じ `id` になる。

## テスト

`test/unit/lib/ja-notation/golden.test.js` が、コーパスのすべてを流してゴールデンと比べる。

- 日本語モードを直して出力が変わるのが正しいときは、ゴールデンを作り直し、差分を読んでからコミットする:
  `UPDATE_JA_GOLDEN=1 npx jest test/unit/lib/ja-notation/golden.test.js`
- 不具合を直したら、その例をテスト（と `test/unit/lib/ruby-roundtrip/japanese-table.test.js` の表）に足し、
  コーパスを集め直す（新しい変換が同じ不具合を持たないように）。

## コーパスの集め方

```bash
cd packages/scratch-gui
node test/ja-notation/collect-corpus.mjs           # 新しいプログラムを足す（今あるものは消さない）
node test/ja-notation/collect-corpus.mjs --fresh   # 集め直す
UPDATE_JA_GOLDEN=1 npx jest test/unit/lib/ja-notation/golden.test.js
```

集める場所:

- 日本語モードの unit テストが `dnclToRuby` / `rubyToDncl` に渡すすべてのコード（`test/ja-notation/record-setup.js` が記録する）。
  テスト・生成AI の答えの例（`genai-dncl-*`）・表のテストを含む。
- `test/fixtures/dncl/` の例（書いてあるとおりのもの。テストは整形してから流すため）。
- `docs/smalruby-dncl-spec.ja.md` のコードのうち、プログラムになっているもの（`条件`・`文...` の雛形は除く）。
- レッスン・課題には、いまは日本語モードのプログラムが無い。

## 守ること

- データは **自作のプログラムだけ**。**大学入試センターの問題は入れない**（`docs/dncl/policy.md`）。
  外の例題のページをもとにしたテスト（`collect-corpus.mjs` の `EXCLUDED_TESTS`）は集めない。
- ライブラリ（`ja-notation`）は MIT で出す予定で、このデータもあとで Node と Ruby の実装が同じものを流す（J6）。
  ほかから写したプログラムを入れない。
