# Ruby → ブロック変換器の 4 段の構造（設計）

> **🆕 Smalruby 独自** — upstream に存在しない、Smalruby のために新規追加された機能

Ruby → ブロックの変換器（`packages/scratch-gui/src/lib/ruby-to-blocks-converter/`）を、
**解析・分析・変換・仕上げ** の 4 段に分ける設計。変換器を直す人・作り直す人向け。

- 何をどのブロックと注釈 `@ruby:*` で表すか（橋渡しの決まり）は [`bridging-patterns.md`](bridging-patterns.md)。この文書は「どこで・どの順に」それを決めるかを扱う。
- 振る舞いを固定するテストは、ブロック ⇔ Ruby の表（[`bridging-patterns.md`](bridging-patterns.md) の「表のテスト」）と往復テスト。

## ねらい

1. **変換の前に一度だけ調べる**。変数・リスト・ハッシュの種類、ローカル変数の名前、class / module / initialize の構造、
   手続きの呼び出しと戻り値の使われ方は、変換を始める前に構文木全体から決める（分析）。変換はその結果を **読むだけ** にする。
   変換の順番で結果が変わる不具合（後ろの行で `@a = "abc"` と決まるのに、前の行の `@a.length` を先に変換する、など）を形として起きなくする。
2. **構文木をたどる処理を 1 か所にする**。子のノードの取り方を間違えて一部を読み落とす不具合（`case` / `when` の中など）を、たどる処理ごとに直さなくてよいようにする。
3. **呼び出しの登録をデータの表にする**。1 対 1 でブロックになるメソッドは「メソッド・opcode・引数」の行で書き、テストや一覧が表を読めるようにする。
4. **長いコードでも速く変換する**。いまは長さの 2 乗に近い速さで遅くなる（「実行の効率」）。

## いまの作り

| 項目               | いま                                                                                                                                                                                                                   |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 大きさ             | 69 ファイル・約 20,200 行（`ast-handlers/` と `send-table.js` を含む）                                                                                                                                                 |
| クラス             | `RubyToBlocksConverter`（prism の `Visitor` を継承）1 つに、14 の部品を `Object.assign` で混ぜる                                                                                                                       |
| 呼び出しの登録     | `converter.registerOnSend(` 386 か所・`converter.registerOnSendWithBlock(` 57 か所・`converter.registerOnSendMyBlock(` 1 か所。ほかに `send-table.js` の表の行が 12                                                    |
| 構文の登録         | `converter.registerOnIf(` / `OnUntil` / `OnOpAsgn` / `OnAnd` / `OnOr` / `OnVar` / `OnVasgn` / `OnDefs`（13 か所）                                                                                                      |
| 古い `onXxx` 形式  | `_callConvertersHandler` が 11 個の変換器オブジェクトを毎回調べる。いま中身があるのは `pen.onOpAsgn` と `makeymakey.onSend` の 2 つだけで、残り 9 個は名前だけ残っている                                               |
| 変換の前の下調べ   | `_countProcedureCallsInNode`（手続きの呼び出しの数）、`_collectVariableUses`（変数の使い方・ローカル変数の範囲）、`_rejectRubyNameOfVariableAndList`                                                                   |
| 変換のあとの仕上げ | 素のリテラルを代入に変える、`ruby_*` ブロックを断る、拡張機能の ID を集める、`_dropUnusedHashVariables`、`_rejectVariableAndListOfSameName`、`$_symbols_` を作る、コメントを結びつける、`target-applier.js` で書きこむ |

数え方: `ruby-to-blocks-converter/` の下の `.js`（`ast-handlers/` を含む）を対象に、ファイルの数と行の数（`wc -l`）、登録は `converter.registerOnXxx(` と書かれた所の数を数えた（`grep -roF`）。`converter-registry.js` の中の定義と、`receiver` の `self` / `any` / 配列を広げるための呼び直しは数えない。`forEach` の中の 1 か所は、いくつのメソッドを登録していても 1 と数える（実際に登録される数はこれより多い）。`send-table.js` の中の `registerOnSend(` 1 か所も 386 に入る。

下調べと仕上げは、すでに `targetCodeToBlocks`（`index.js`）の前と後ろにある。4 段の構造は、これを名前のある段として切り出し、段の間で渡すものを決めることにあたる。

### 構文木をたどる処理

| たどる処理                                              | 子の取り方                                                                            |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| 変換そのもの（`visit` と `visitXxxNode`）               | ノードの種類ごとに手で書く                                                            |
| `_collectVariableUses`                                  | `_childNodesOf`（prism の `childNodes()`。すべての子）                                |
| `_countProcedureCallsInNode` / `_countCallsInValueNode` | **手で並べたプロパティ名**（`statements` / `body` / `then` / `else` / `condition` …） |
| `_statementNodeOf`（エラーで文を指す）                  | `_childNodesOf`。エラーのたびに根からたどる                                           |
| `_associateSourceComments` の一部、`_nodeContainsSuper` | `_childNodesOf`                                                                       |

`_countProcedureCallsInNode` の並べた名前には、prism に無い名前（`then` / `else` / `condition` / `consequent` / `alternative`）があり、
`CaseNode` の `conditions`（`when` の並び）や `elseClause` が無い。そのため `case` の中の手続きの呼び出しは数えられていない。
このような読み落としは、子の取り方をノードごとに手で書くかぎり、たどる処理の数だけ起きうる。

## 4 段の形

```
Ruby のコード
  │ 1. 解析   prism で構文木にする。ソースの索引（バイト → 文字・行）を作る
  ▼
ParseResult { root, source, index, comments, errors }
  │ 2. 分析   構文木を 1 回たどり、変換に要る事実を決める（読み取り専用の表）
  ▼
Analysis（凍結した表）
  │ 3. 変換   ノードごとにブロックを作る。Analysis を読むだけ。呼び出しは表で引く
  ▼
BlockStore（ブロック・変数・リスト・コメント。巻き戻せる）
  │ 4. 仕上げ 全体を見てはじめて決まる処理・検査をして、スプライトへ書きこむ
  ▼
Scratch のブロック
```

### 1. 解析（parse）

- prism の `parse` と、その構文エラーの翻訳（`prism-error-translator.js`）。
- ソースの索引を **1 回だけ** 作る: バイト → 文字の表（いまの `_buildByteToCharMap`）、改行のバイト位置の表（行番号を二分探索で引く。試作で入れた `_newlineByteOffsets`）。
- ノードの種類名（`_getNodeTypeName`）は、本番のビルドでクラス名が変わるので `accept()` で調べている。段を分けるときに、ノードのクラスごとに一度だけ調べて覚える形にする。
- 出すもの: `{ root, source, index, comments, errors }`。ブロックはまだ作らない。

### 2. 分析（analyze）

構文木を **1 つのたどり方**（すべての子を見る `forEachNode(root, { enter, leave })`）で 1 回たどり、次を決める。
分析の結果は `Object.freeze` した表にし、変換は書きかえない。

| 表           | 中身                                                                                             | いまの場所                                                                      |
| ------------ | ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------- |
| `variables`  | Ruby の名前（`@a` / `$a` / `a`）ごとの使い方（リスト・ハッシュ・値・文字列か）、最初に使われた行 | `_collectVariableUses` の `variableUses` / `firstVariableUses`                  |
| `locals`     | ローカル変数の範囲（メソッド・スクリプトのブロックごと）と、範囲ごとの名前（`_x_1_`）            | `localVariableUnits`、`_localScopeIndex`                                        |
| `procedures` | `def` の名前・引数・戻り値を返すか、値として呼ばれる数                                           | `_countProcedureCallsInNode`、`my-blocks.js` の一部                             |
| `classes`    | class / module / initialize / super / attr_accessor の構造                                       | `class-visitor.js` / `module-visitor.js` / `initialize-handler.js` の判断の部分 |
| `symbols`    | シンボルの一覧（`$_symbols_` リストのもと）                                                      | 変換の途中で集めている                                                          |
| `errors`     | 変換の前に断れる誤り（同じ `@a` を変数とリストに使う、など）                                     | `_rejectRubyNameOfVariableAndList`                                              |

分析で決めたことは、[`bridging-patterns.md`](bridging-patterns.md) の P1（ローカル変数）・P2（戻り値）・P4/P5（配列・ハッシュ）・P6（class）・P15（変数の種類）に対応する。
新しい橋渡しの工夫で「変換の前に全体を見ないと決まらないこと」が出たら、変換の途中で決めずに分析の表に足す。

#### `Analysis` の形（`analysis.js` の `analyze(root, { source })`）

たどり方は `node-walk.js` の `forEachNode(root, { enter(node, type, parent), leave(node, type, parent) })`。
prism の `childNodes()` のすべての子を、ソースの順に（親を子より先に）1 回ずつ見る。再帰しないので長いコードでもスタックがあふれない。
ノードの種類名は `nodeTypeName(node)` で、ノードのクラスごとに 1 回だけ `accept()` で調べて覚える。
`analyze` は構文木とソースだけを読む純粋な関数で、変換器や VM を読まない。結果は `Object.freeze` する（中の prism のノードは凍らせない。`Map` は読むだけの形 `{ get, has, size }` にする）。

| 表                           | 形                                                                                                                                            | いまの変換器の値                                                                 |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| `variables.uses`             | `{ [Ruby の名前]: { list, scalar, hash, string, notString } }`                                                                                | `_context.variableUses`                                                          |
| `variables.firstUses`        | `{ ['@a' / '$a']: { list?: { line, node }, scalar?: { line, node } } }`（いちばん前の行）                                                     | `_context.firstVariableUses`                                                     |
| `variables.rubyNames`        | コードが読み書きする `@a` / `$a` の並び                                                                                                       | `_context.rubyVariableNames`                                                     |
| `locals`                     | `unitOfNode`（範囲を始めるノード → 範囲の番号）、`uses[範囲][名前]`、`groups[範囲]`（メソッドは自分、スクリプトのブロックは 0）、`splitNames` | `_context.localVariableUnits`（`scopeIndexes` は変換の途中で決まるので含めない） |
| `procedures.valueCallCounts` | `{ [メソッド名]: 値として呼ばれる数 }`。`case` / `when` / `else` の中も数える                                                                 | `_context.methodCallCounts`（`case` の中は 0）                                   |
| `procedures.definitions`     | `def` ごとの `{ name, line, onSelf, requireds, optionals, returnsValue, usesSuper, node }`                                                    | `my-blocks.js` と `class-visitor.js` がその場で調べている                        |
| `classes`                    | `classes`: `{ name, superclass, line, attrs, includes, methods, hasInitialize, node }`、`modules`: `{ name, line, methods, node }`            | `class-visitor.js` / `module-visitor.js` の本体の下調べ                          |
| `symbols`                    | コードに書かれたシンボル（`:name`）の並び。`$_symbols_` に入る候補（変換で使われたものだけが入る）                                            | `_context.symbols`（変換の途中で集める）                                         |
| `errors`                     | `{ kind: 'variableAndList', name, listLine, variableLine, node }` を変数としての行の順に                                                      | `_rejectRubyNameOfVariableAndList`（最初の 1 つで止める）                        |

「値として呼ばれる」は、いまの `_countProcedureCallsInNode` と同じ決まりで決める。
ノードごとに「文として見る」「値として見る」を子に配り、値として見た `CallNode` を数える
（引数・レシーバー・条件・`x = ...` の値・`return` の値が値、`do ... end` の中・`if` の中が文）。
これに `case` の決まり（`case x` と `when x` の `x` が値、`when` と `else` の中が文）を足した。

表がいまの変換器と同じであることは `test/unit/lib/ruby-to-blocks-converter/analysis.test.js` で確かめる。
変換器と往復のテストに書かれた Ruby（約 3,500 個）で、変換器の下調べの結果と表を比べる。違ってよいのは `case` の中の呼び出しの数だけ。

### 3. 変換（convert）

- `visitXxxNode` がノードごとにブロックを作る（prism の `Visitor` の形はそのまま）。
- メソッド呼び出しは、登録の表（次の節）を `receiver → 名前 → 引数の数 → ブロック引数の数` で引く（いまの `callMethod` の引き方と同じ）。
- 変数の種類・ローカル変数の名前・手続きの数は `Analysis` を読む。変換の途中でこれらを決めない。
- 作ったものは `BlockStore` に入れる。うまく変換できなかった試み（いまの `_saveContext` / `_restoreContext`）は、
  **書いたものの記録（journal）を巻き戻す** 形にする。いまは試みのたびに、それまでに作ったすべてのブロック・コメント・変数の表を写しており、これが長いコードでいちばん遅い（「実行の効率」）。

### 4. 仕上げ（finish）

全体を作り終えてはじめて決まる処理と検査。いまの `targetCodeToBlocks` の後半をそのまま移す。

- 素のリテラルの行を代入に変える（P18）、トップレベルの印、`ruby_*` ブロックを断る（P17）、拡張機能の ID を集める
- 使われなかったハッシュの変数を消す、同じ名前の変数とリストを断る、`$_symbols_` リストを作る（P7）
- ソースのコメントをブロックに結びつける（P14）
- `target-applier.js` でスプライト（ステージ）へ書きこむ（いまと同じ。書きこみの途中で失敗したら戻す）

## 呼び出しの登録を表にする

### 表の形（試作: `send-table.js`）

1 対 1 でブロックになる呼び出しは、行で書く。

```js
const MOTION_SENDS = [
    {
        receiver: "sprite",
        name: "move",
        opcode: "motion_movesteps",
        args: [numberArg("STEPS", 10)],
    },
    {
        receiver: "sprite",
        name: "point_towards",
        opcode: "motion_pointtowards",
        args: [menuArg("TOWARDS", "motion_pointtowards_menu")],
    },
    {
        receiver: "sprite",
        name: "rotation_style=",
        opcode: "motion_setrotationstyle",
        args: [fieldArg("STYLE", RotationStyle)],
    },
    {
        receiver: "sprite",
        name: "x",
        opcode: "motion_xposition",
        type: "value",
    },
];
registerSendTable(converter, MOTION_SENDS);
```

| 引数の種類                                 | 受けつけるもの                         | ブロックへの入れ方                                      |
| ------------------------------------------ | -------------------------------------- | ------------------------------------------------------- |
| `numberArg(input, 既定値, 影の opcode)`    | 数・値のブロック（`_isNumberOrBlock`） | 数の影つきの入力（`_addNumberInput`）                   |
| `menuArg(input, メニューの opcode, field)` | 文字列                                 | メニューのブロックを入力に入れる（`_createFieldBlock`） |
| `fieldArg(field, 選べる値)`                | 文字列（選べる値があればその中のもの） | ブロックのフィールド（`_addField`）                     |

- 行の引数の種類に合わない呼び出しは `null` を返し、同じメソッドの次の登録に譲る（いまの `registerOnSend` の handler と同じ決まり）。
- 表で書けない形（`go_to([x, y])` の配列、`glide(..., secs: 1)` のキーワード引数、引数で opcode を選ぶもの、ハット、`self.x += 1` のような演算代入）は、いまの handler のまま表の横に置く。
- 表はデータなので、テストが読める。試作では「表の opcode にはすべて生成器がある」ことを確かめている（`send-table.test.js`）。同じ表から、補完の一覧やふりがなの一覧を作ることもできる。

motion では、呼び出しの登録 14 のうち 12 が表になった（残りは `go_to` / `glide`。演算代入は `registerOnOpAsgn` のまま）。ほかの領域も、まず表で書ける行を移し、残りを handler のまま残す。

### 表に足していく列（実装のときに決める）

| 列                | 使い道                                                          | 例                               |
| ----------------- | --------------------------------------------------------------- | -------------------------------- |
| `rubyBlock: 0`    | `do ... end` を取る呼び出し（いまの `registerOnSendWithBlock`） | `forever do`                     |
| `hat: true`       | ハット（ブロックの中身を下につなぐ）                            | `when_flag_clicked do`           |
| `stage: false`    | ステージでは使えない（エラーにする）                            | 動きのブロック                   |
| `versions: ['2']` | Ruby のバージョンで形が違う                                     | v1 の `self.when(:flag_clicked)` |

### 古い `onXxx` 形式をなくす道すじ

1. `pen.onOpAsgn` を `registerOnOpAsgn` に、`makeymakey.onSend`（v1 の `self.when(:makey_key_pressed, ...)`）を `registerOnSendWithBlock('self', 'when', 2, 0, ...)` に移す。
   いまは `callMethod` の登録が先に試され、`onSend` はその後なので、`event.js` の `when` の登録より **後に** 登録して順番を保つ。
2. `_callConvertersHandler` から 11 個の変換器オブジェクトを調べる部分を消し、`register-converters.js` の export も消す。
3. 「新しい変換は registerOnXxx か表で書く」をそのまま決まりにする（`.claude/rules/scratch-gui/ruby-mode.md`）。

## 1 領域ずつ移す順番

どの段階でも、移す領域の **ブロック ⇔ Ruby の表**（`test/unit/lib/ruby-roundtrip/<category>-table.test.js`）を先に作るか足して、移す前に通ることを確かめてから移す。
表が無い領域は、まず既存のテストを表へ移す（`.claude/rules/scratch-gui/testing.md` の「新しい opcode はブロック ⇔ Ruby の表から」）。

| 順  | すること                                                                                                                                                                                           | 振る舞いを固定するテスト                                                                             | 効率                         |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- | ---------------------------- |
| 1   | 解析の索引: 行の表（試作で済み）、ノードの種類名をクラスごとに覚える                                                                                                                               | 表のテストすべて、`line-for-offset.test.js`、`multibyte-offset.test.js`                              | 小                           |
| 2   | 変換の巻き戻しを journal に（`_saveContext` を写さない）                                                                                                                                           | 表のテストすべて、`orphan-blocks.test.js`、`target-applier-transaction.test.js`、往復テスト          | **大**（いま最も時間を使う） |
| 3   | 分析の段: `forEachNode` を作り、`_collectVariableUses` と `_countProcedureCallsInNode` を移して凍結した `Analysis` を出す。`case` の中の呼び出しも数えるようになるので、その行を表に足してから移す | 分析の結果の表のテスト（Ruby → `Analysis`）、表のテストすべて                                        | 小                           |
| 4   | 呼び出しの表: motion（試作で済み）→ looks → sound → control / event → sensing → operators → data → 拡張機能。古い `onXxx` 2 つもここで移す                                                         | その領域の表のテスト                                                                                 | なし                         |
| 5   | 仕上げの段: `targetCodeToBlocks` の後半を `finish()` へ。`targetCodeToBlocks` は 4 段を順に呼ぶだけにする                                                                                          | 表のテストすべて、往復テスト                                                                         | なし                         |
| 6   | class / module / initialize の判断を分析へ移す                                                                                                                                                     | `class.test.js`、`module.test.js`、`initialize-round-trip.test.js`、`ruby-roundtrip-class-*.test.js` | なし                         |

1・2 は振る舞いを変えずに速くするだけなので先に行う。3 以降は、分析の表ができると変換の部品が `_context` を書きかえなくなり、`Object.assign` で混ぜている部品を段ごとのモジュールへ分けられるようになる（14 の部品を分けるのは 6 のあと）。

## 実行の効率

`test/unit/lib/ruby-to-blocks-converter/conversion-speed.test.js` で測る（ふだんは流れない。`RUBY_CONVERTER_BENCH=1` を付けて流す）。
同じ単位（戻り値のあるメソッド、繰り返し・`if`・`case`・リストを使うイベント）を `n` 回並べたコードを変換する。

関数ごとの時間（1,922 行、試作の前。共用のコンテナなので値は揺れる。割合で見る）:

| 処理                                 | 時間        | 呼ばれた数 | わけ                                                                                            |
| ------------------------------------ | ----------- | ---------- | ----------------------------------------------------------------------------------------------- |
| 変換全体                             | 約 2,200 ms | —          |                                                                                                 |
| `_saveContext`                       | 約 1,570 ms | 1,441      | 試みのたびに、それまでのブロック・コメント・変数の表を全部写す。コードが長いほど 1 回が重くなる |
| `_getLineForOffset`                  | 約 290 ms   | 8,008      | 行番号を引くたびにソースの先頭から数えていた。試作で改行の表を引く形にした                      |
| `_collectVariableUses`（下調べ）     | 約 30 ms    | 1          |                                                                                                 |
| `callMethod`（呼び出しの登録を引く） | 約 35 ms    | 960        | 登録の表の引き方は遅くない                                                                      |

行の数を 4 倍にすると（242 行 → 962 行）、時間は 8 倍ほどになる（約 50 ms → 約 400〜500 ms）。
長さの 2 乗に近く遅くなるのは、上の 2 つのように「1 回の処理がそれまでに作ったもの全体を見る」ため。段を分ける作業の中で、この 2 つは先に直す。

## License

The documentation is under the same license as the repository.
