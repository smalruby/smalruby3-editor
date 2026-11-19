# ja-notation

日本語のプログラムの書き方（大学入学共通テスト「情報」の **共通テスト用プログラム表記** と、**DNCL 風の形**）と
Ruby を、構文木を通して両方向に変換するライブラリです。スモウルビーの日本語モードがこれを使います。

- ライセンス: **MIT**（[`LICENSE`](LICENSE)。リポジトリのほかの部分は AGPL-3.0）
- 依存: なし（Node の標準と、呼ぶ側が渡す関数だけ）。ESM の JavaScript で、ビルドは要りません（`src/` がそのままパッケージ）
- パッケージ名: `@smalruby/ja-notation`（仮。いまは `private`。公開と名前の見直し、Ruby での実装は別の作業）

設計は [`docs/ruby-editor/converter-roadmap.md`](../../docs/ruby-editor/converter-roadmap.md) の 2 章
「ライブラリにするときの約束」、記法は [`docs/dncl/policy.md`](../../docs/dncl/policy.md) が正です。

## 使い方

```js
// ruby: 'x = 1\nputs(x)'、jaLines: [1, 2]（Ruby の行ごとの日本語の行）、errors: []
// Ruby → 日本語。prism の解析の関数を呼ぶ側が渡します（ライブラリは wasm を持ちません）。
import { loadPrism } from '@ruby/prism';
import { jaToRuby, rubyToJa } from '@smalruby/ja-notation';

// 日本語 → Ruby。表を渡さないと、名前はローカル変数で、関数はありません。
const table = {
    functions: { 表示する: { build: (args, ruby) => ruby.send(null, 'puts', args) } },
};
const { ruby, jaLines, errors } = jaToRuby('x = 1\n表示する(x)', table);

const parse = await loadPrism();
const { ja } = rubyToJa('x = 1\nwhile x < 10\n  x += 2\nend', { parse });
// ja: 'x = 1\nx < 10 の間繰り返す:\n    x += 2'
```

| 関数                                                          | すること                                                                                                         |
| ------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `jaToRuby(source, table)`                                     | 日本語 → Ruby。`{ruby, jaLines, errors, program}`（誤りがあれば `ruby` は null。誤りは日本語の行・列）           |
| `rubyToJa(source, {parse, ...table})`                         | Ruby → 日本語（標準の形）。`{ja, errors, program}`（誤りがあっても書けるところは書く。誤りは Ruby の行・列）     |
| `parse(source)`                                               | 日本語 → JaAST（標準の形と DNCL 風の形を同じ JaAST に読む）                                                      |
| `buildRuby(program, table)` / `writeRuby(...)`                | JaAST → RubyAST → Ruby のテキスト                                                                                |
| `readRuby(result, source, table)` / `writeJa()`               | prism の構文木 → JaAST → 日本語のテキスト                                                                        |
| `readSettings(comments)` / `settingsSentences`                | 冒頭の説明文 ⇔ 設定（`indexBase`・`commentMarker`・`logicNote`）                                                 |
| `settingsOfSource(source)` / `withSettings(source, settings)` | テキストの冒頭から設定を読む ／ 冒頭の説明文を書きかえる（ほかのコメントとコードはそのまま。添字は書きかえない） |
| `SETTINGS_PATTERNS`                                           | よくある設定のパターン（`example` = 例示の形、`indexFromOne` = 添字が 1 から始まる問題）                         |

表（`table`）の欄は `src/build-ruby.js`（日本語 → Ruby）と `src/read-ruby.js`（Ruby → 日本語）の JSDoc にあります。
スモウルビーの表は `packages/scratch-gui/src/lib/dncl/ja-notation-table.js` です（このパッケージには入れません）。

## JaAST の形

JaAST はただの JSON（クラスなし）なので、ほかの言語の実装とテストのデータを分け合えます。正は [`src/ja-ast.js`](src/ja-ast.js) です。

- どのノードも `type`・`line`（日本語の行。1 から）・`column`（0 から）を持ちます。
- `Program { settings, body, lineCount?, blankLines? }`。`settings` は冒頭の説明文から読んだ設定。
  `lineCount` / `blankLines` は `readRuby` が付け、`writeJa` が空行を保つのに使います。
- 文: `Assign`・`OpAssign`・`MultiAssign`・`Input`・`ExpressionStatement`・`If`・`While`・`For`・`FunctionDef`・`Return`・`Append`・`Comment`・`RubyCode`。
  `Append { target, value }` は `A に 値 を追加する`（配列の最後に足す。Ruby は `A.push(値)`、`A << 値` も読む）。
  ブロックの文は `closeLine`・`closeAfter`、自分の行で閉じたもの（DNCL 風の形）は `closeOwnLine`・`closeComment` も持ちます。
- 式: `Number`・`String`・`Boolean`・`Name`・`Index`・`ArrayLiteral`・`Call`・`Unary`（`parens?`）・`Binary`・`RubyCode`。
- `RubyCode { text }` は日本語の形が無い Ruby をそのまま持ちます（`readRuby` だけが作ります）。

## テスト

```bash
npm test --workspace=packages/ja-notation        # lint と node --test
npm run test:unit --workspace=packages/ja-notation
```

テストのデータは [`test/data/`](test/data/) の JSON です。のちの Ruby の実装も同じデータを流せるように、
入力と期待する出力だけを持ちます（JS のテストはそれを読んで比べるだけ）。

| ファイル          | 中身                                                                                                                                 |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `parse.json`      | `programs`（日本語 → JaAST の全体）、`same`（同じ JaAST に読む 2 つの書き方。`positionKeys` の位置を除いて比べる）、`errors`（誤り） |
| `ja-to-ruby.json` | 日本語 → Ruby と行の対応（`jaLines`）、または誤り                                                                                    |
| `ruby-to-ja.json` | Ruby → 日本語と誤り（Ruby は prism で解析する）                                                                                      |
| `write-ja.json`   | JaAST → 日本語（式の括弧・演算子の書き方）                                                                                           |
| `settings.json`   | 設定の読み書き（`read`・`sentences`・`programs`）と、設定のある Ruby ⇔ 日本語の両方向（`jaToRuby`・`rubyToJa`）                      |

データの中の `table` は、各実装がテストの中で作る表の名前です:

- `none`: 表なし（名前はローカル変数、関数なし）
- `plain`: `表示する` だけが `puts`
- `gets`: 入力が `gets` だけの値（`x = gets`、`【整数を入力】` は `gets.to_i`）。Ruby → 日本語では、入力だけを代入する行を入力として読む（表の `input.kindOfAlone`）

誤りは `{code, message, line, column, name?}` をそのまま比べます（`message` もライブラリの出力です）。

### 守ること

- データは **自作のプログラムだけ** にします。**大学入試センターの問題は使いません**（`docs/dncl/policy.md`）。
- AGPL のコードを写しません（MIT で出すため）。ファイルの先頭に `// SPDX-License-Identifier: MIT` を書きます（`test/boundary.test.js` が確かめます）。
- `src/` は `src/` の中だけを import します（拡張子 `.js` 付き）。
- 構文木をたどる処理は再帰で書かず、ジェネレーターにして `src/run.js` の `run` で動かします（子をたどるところで `yield`）。数千項の式や深いブロックでも呼び出しのスタックが尽きないように（`test/deep.test.js`）。
- スモウルビーの表を通した記録（コーパスとゴールデン）は scratch-gui の `test/fixtures/ja-notation/` にあります。
