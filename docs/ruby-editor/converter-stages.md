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

| 項目               | いま                                                                                                                                                                                                                                                                |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 大きさ             | 72 ファイル・約 20,500 行（`ast-handlers/` と `send-table.js` を含む）                                                                                                                                                                                              |
| クラス             | `RubyToBlocksConverter`（prism の `Visitor` を継承）1 つに、14 の部品を `Object.assign` で混ぜる                                                                                                                                                                    |
| 呼び出しの登録     | 呼び出しの表（`send-table.js`）の行が 95（motion 12・looks 25・sound 8・control 5・event 6・sensing 16・operators 6・pen 17）。ほかに `converter.registerOnSend(` 324 か所・`converter.registerOnSendWithBlock(` 53 か所・`converter.registerOnSendMyBlock(` 1 か所 |
| 構文の登録         | `converter.registerOnIf(` / `OnUntil` / `OnOpAsgn` / `OnAnd` / `OnOr` / `OnVar` / `OnVasgn` / `OnDefs`（13 か所）                                                                                                                                                   |
| 古い `onXxx` 形式  | なくした。`_callConvertersHandler` は `registerOnXxx` で登録した配列だけを見る                                                                                                                                                                                      |
| 変換の前の分析     | `analysis.js` の `analyze`（変数の使い方・ローカル変数の範囲・値として呼ばれる手続きの数）。変換器は結果の表を `_context.analysis` に置いて読む。`_rejectRubyNameOfVariableAndList` は表の `errors` を見て断る                                                      |
| 変換のあとの仕上げ | 素のリテラルを代入に変える、`ruby_*` ブロックを断る、拡張機能の ID を集める、`_dropUnusedHashVariables`、`_rejectVariableAndListOfSameName`、`$_symbols_` を作る、コメントを結びつける、`target-applier.js` で書きこむ                                              |

数え方: `ruby-to-blocks-converter/` の下の `.js`（`ast-handlers/` を含む）を対象に、ファイルの数と行の数（`wc -l`）、登録は `converter.registerOnXxx(` と書かれた所の数を数えた（`grep -roF`）。`converter-registry.js` の中の定義と、`receiver` の `self` / `any` / 配列を広げるための呼び直しは数えない。`forEach` の中の 1 か所は、いくつのメソッドを登録していても 1 と数える（実際に登録される数はこれより多い）。`send-table.js` の中の `registerOnSend(` / `registerOnSendWithBlock(` 1 か所ずつもこの数に入る。表の行は、`map` で広げたあとの数（各変換器の `sends`）。

分析と仕上げは、`targetCodeToBlocks`（`index.js`）の前と後ろにある。分析は名前のある段（`analysis.js`）になった。仕上げも同じように段として切り出し、段の間で渡すものを決めるのが残りの仕事。

### 構文木をたどる処理

| たどる処理                                              | 子の取り方                                                            |
| ------------------------------------------------------- | --------------------------------------------------------------------- |
| 変換そのもの（`visit` と `visitXxxNode`）               | ノードの種類ごとに手で書く                                            |
| 分析（`analyze`）                                       | `forEachNode`（`node-walk.js`。prism の `childNodes()` のすべての子） |
| `_statementNodeOf`（エラーで文を指す）                  | `_childNodesOf`。エラーのたびに根からたどる                           |
| `_associateSourceComments` の一部、`_nodeContainsSuper` | `_childNodesOf`                                                       |

手続きの呼び出しを数える下調べ（もとの `_countProcedureCallsInNode`）は、子を手で並べたプロパティ名でたどっていた。並べた名前に `CaseNode` の `conditions`（`when` の並び）や
`elseClause` が無く、`case` の中の手続きの呼び出しを数えていなかった。
このような読み落としは、子の取り方をノードごとに手で書くかぎり、たどる処理の数だけ起きうる。分析はすべて `forEachNode` でたどるので、この形の読み落としは起きない。

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
- ノードの種類名は、本番のビルドでクラス名が変わるので `accept()` で調べる。`node-walk.js` の `nodeTypeName` が、ノードのクラスごとに一度だけ調べて覚える。変換（`visit` が呼ぶ `visitXxxNode` を決めるところも）と分析は、どちらもこれを使う。
- 出すもの: `{ root, source, index, comments, errors }`。ブロックはまだ作らない。

### 2. 分析（analyze）

構文木を **1 つのたどり方**（すべての子を見る `forEachNode(root, { enter, leave })`）で 1 回たどり、次を決める。
分析の結果は `Object.freeze` した表にし、変換は書きかえない。

| 表           | 中身                                                                                             | 決める場所                                                                         |
| ------------ | ------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------- |
| `variables`  | Ruby の名前（`@a` / `$a` / `a`）ごとの使い方（リスト・ハッシュ・値・文字列か）、最初に使われた行 | `analysis.js`（もとは `_collectVariableUses`）。済み                               |
| `locals`     | ローカル変数の範囲（メソッド・スクリプトのブロックごと）と、範囲ごとの名前（`_x_1_`）            | `analysis.js`（もとは `_collectVariableUses`）。済み                               |
| `procedures` | `def` の名前・引数・戻り値を返すか、値として呼ばれる数                                           | 数は `analysis.js`（もとは `_countProcedureCallsInNode`）。`def` は `my-blocks.js` |
| `classes`    | class / module / initialize / super / attr_accessor の構造                                       | `class-visitor.js` / `module-visitor.js` / `initialize-handler.js` の判断の部分    |
| `symbols`    | シンボルの一覧（`$_symbols_` リストのもと）                                                      | 変換の途中で集めている                                                             |
| `errors`     | 変換の前に断れる誤り（同じ `@a` を変数とリストに使う、など）                                     | `analysis.js`。断るのは `_rejectRubyNameOfVariableAndList`。済み                   |

分析で決めたことは、[`bridging-patterns.md`](bridging-patterns.md) の P1（ローカル変数）・P2（戻り値）・P4/P5（配列・ハッシュ）・P6（class）・P15（変数の種類）に対応する。
新しい橋渡しの工夫で「変換の前に全体を見ないと決まらないこと」が出たら、変換の途中で決めずに分析の表に足す。

#### `Analysis` の形（`analysis.js` の `analyze(root, { source })`）

たどり方は `node-walk.js` の `forEachNode(root, { enter(node, type, parent), leave(node, type, parent) })`。
prism の `childNodes()` のすべての子を、ソースの順に（親を子より先に）1 回ずつ見る。再帰しないので長いコードでもスタックがあふれない。
ノードの種類名は `nodeTypeName(node)` で、ノードのクラスごとに 1 回だけ `accept()` で調べて覚える。
`analyze` は構文木とソースだけを読む純粋な関数で、変換器や VM を読まない。結果は `Object.freeze` する（中の prism のノードは凍らせない。`Map` は読むだけの形 `{ get, has, size }` にする）。
Ruby の名前をキーにする表（`variables.uses`・`locals.uses`・`procedures.valueCallCounts` など）は `Object.create(null)` で作る。`__proto__` や `constructor` も、ほかの名前と同じに扱うため。

| 表                           | 形                                                                                                                                            | 変換器で読むところ                                                                                                                           |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `variables.uses`             | `{ [Ruby の名前]: { list, scalar, hash, string, notString } }`                                                                                | `_variableUsesOf`・`_kindOfRubyName`・`_listNameOfAlias`（`variable-utils.js`）                                                              |
| `variables.firstUses`        | `{ ['@a' / '$a']: { list?: { line, node }, scalar?: { line, node } } }`（いちばん前の行）                                                     | （`errors` のもと）                                                                                                                          |
| `variables.rubyNames`        | コードが読み書きする `@a` / `$a` の並び                                                                                                       | `_kindOfRubyName`・`_listNameOfAlias`                                                                                                        |
| `locals`                     | `unitOfNode`（範囲を始めるノード → 範囲の番号）、`uses[範囲][名前]`、`groups[範囲]`（メソッドは自分、スクリプトのブロックは 0）、`splitNames` | `_enterLocalUnit`・`_localScopeIndex`・`_variableUsesOf`（範囲ごとの名前の番号は変換の途中で決まるので `_context.localScopeIndexes` に置く） |
| `procedures.valueCallCounts` | `{ [メソッド名]: 値として呼ばれる数 }`                                                                                                        | `my-blocks.js`（戻り値を入れる変数の番号）                                                                                                   |
| `procedures.definitions`     | `def` ごとの `{ name, line, onSelf, requireds, optionals, returnsValue, usesSuper, node }`                                                    | まだ読まない（`my-blocks.js` と `class-visitor.js` がその場で調べている）                                                                    |
| `classes`                    | `classes`: `{ name, superclass, line, attrs, includes, methods, hasInitialize, node }`、`modules`: `{ name, line, methods, node }`            | まだ読まない（`class-visitor.js` / `module-visitor.js` の本体の下調べ）                                                                      |
| `symbols`                    | コードに書かれたシンボル（`:name`）の並び。`$_symbols_` に入る候補（変換で使われたものだけが入る）                                            | まだ読まない（`_context.symbols` は変換の途中で集める）                                                                                      |
| `errors`                     | `{ kind: 'variableAndList', name, listLine, variableLine, node }` を変数としての行の順に                                                      | `_rejectRubyNameOfVariableAndList`（最初の 1 つで止める）                                                                                    |

「値として呼ばれる」は、変換が値として変換する所で決める。
ノードごとに「文として見る」「値として見る」を子に配り、値として見た `CallNode` を数える
（引数・レシーバー・条件・`x = ...` の値・`return` の値が値、`do ... end` の中・`if` の中が文。ほかのノードは、すべての子を親と同じに見る）。

変換器は `targetCodeToBlocks` で `analyze` を 1 回呼び、表を `_context.analysis` に置いて読む（変換の前の下調べ `_collectVariableUses` / `_countProcedureCallsInNode` は消した）。
消す前に、変換器と往復のテストに書かれた Ruby（約 3,500 個）で下調べの結果と表を比べ、すべて一致することを確かめた。
いまは `test/unit/lib/ruby-to-blocks-converter/analysis.test.js` が表の中身を、変換器と往復のテストが表を読んだ変換の結果を確かめる。
文字列の値か（`isStringValueNode`）と多重代入の組（`multiWritePairs`）は `analysis.js` の 1 か所にあり、変換（`visitMultiWriteNode`）も同じものを使う。

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

### 表の形（`send-table.js`）

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

| 引数の種類                                                                               | 受けつけるもの                                                                          | ブロックへの入れ方                                      |
| ---------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| `numberArg(input, 既定値, 影の opcode)`                                                  | 数・値のブロック（`_isNumberOrBlock`）                                                  | 数の影つきの入力（`_addNumberInput`）                   |
| `textArg(input, 既定値)`                                                                 | 文字列・値のブロック（`_isStringOrBlock`）                                              | 文字の影つきの入力（`_addTextInput`）                   |
| `menuArg(input, メニューの opcode, field, { validate })`                                 | 文字列                                                                                  | メニューのブロックを入力に入れる（`_createFieldBlock`） |
| `menuInputArg(input, メニューの opcode, field, 既定値, { choices, validate, anyBlock })` | 文字列（`choices` があればその中のもの）・値のブロック（`anyBlock` ならどのブロックも） | メニューの影つきの入力（`_addFieldInput`）              |
| `colorArg(input, 既定値)`                                                                | 色・値のブロック（`_isColorOrBlock`）                                                   | 色の入力（`_addColorFieldInput`）                       |
| `fieldArg(field, 選べる値, { normalize })`                                               | 文字列（選べる値があれば、`normalize` したものがその中にあるもの）                      | ブロックのフィールド（`_addField`）                     |

`validate(converter, arg, params)` は、すべての引数を受けつけたあと、ブロックを作る前に呼ぶ（衣装・背景・音が無いときのエラー。ブロックを作ってから断ると、作りかけのブロックが残る）。

- 行の引数の種類に合わない呼び出しは `null` を返し、同じメソッドの次の登録に譲る（いまの `registerOnSend` の handler と同じ決まり）。
- 表で書けない形（`go_to([x, y])` の配列、`glide(..., secs: 1)` のキーワード引数、引数で opcode を選ぶもの、`self.x += 1` のような演算代入、変数・リストを引く呼び出し）は、いまの handler のまま表の横に置く。
- 同じキー（レシーバー・名前・引数の数・ブロック引数の数）に handler がいくつかあると、登録した順に試す。表へ移すときは、同じキーの中の順番を変えない。キーの違う handler との前後は結果に関わらないので、表は `register` の中のどこで登録してもよい（sensing と control は先頭で登録している）。
- 表はデータなので、テストが読める（`send-table.test.js` は「表の opcode にはすべて生成器がある」ことを確かめる）。同じ表から、補完の一覧やふりがなの一覧を作ることもできる。

領域ごとの表（各変換器の `sends` が表。`send-table.test.js` は、すべての表の opcode とメニューの opcode に生成器があることを確かめる）:

| 領域      | 表の行 | handler のまま残したもの                                                                                                                                         |
| --------- | ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| motion    | 12     | `go_to`・`glide`（配列・キーワード引数）、演算代入                                                                                                               |
| looks     | 25     | `say` / `think`（`secs:`・シンボル）、`print` / `puts` / `p`（引数の数が決まらない）、演算代入                                                                   |
| sound     | 8      | 演算代入                                                                                                                                                         |
| control   | 5      | `repeat`・本体のある `loop` / `forever`・`N.times`（`wait` を除く・ブロック引数）、`create_clone` / `clone`、`with_screen_refresh`、`if` / `until`、v1 の `when` |
| event     | 6      | `when_receive`・`broadcast`（メッセージを引く）、v1 の `when`                                                                                                    |
| sensing   | 16     | Ruby の式のレシーバーを使う v2 の形（`mouse.x`・`stage.volume`・`sprite("A").x`・`Time.now.year`）、`gets`、`drag_mode=`                                         |
| operators | 6      | `[]`・`empty?`・`+`・比べる演算・`=~`・算術（`operators-math.js`。`Math.sqrt` など、引数が配列のときがあるもの）                                                 |
| data      | 0      | すべて（変数・リスト・ハッシュを引き、リストに変える。表の 1 行では書けない）                                                                                    |
| pen       | 17     | `pen.color =`（数か色で opcode を選ぶ）、`pen.size += 1` の下ごしらえ、演算代入                                                                                  |

拡張機能は pen だけ移した。残り（music・video・text2speech・translate・ev3・wedo2・microbit・micro:bit More・g2s・koshien・mesh など）は、同じ形（`changesReceiver` と `menus`）で 1 つずつ移す。

### 表の列

| 列                                      | 使い道                                                                                                         | 例                        |
| --------------------------------------- | -------------------------------------------------------------------------------------------------------------- | ------------------------- |
| `type`                                  | ブロックの形（`statement`・`value`・`value_boolean`・`terminate`）                                             | `x` → `value`             |
| `fields: { NAME: 値 }`                  | 決まった値のフィールド                                                                                         | `go_to_front`             |
| `menus: { INPUT: [opcode, field, 値] }` | 決まった値のメニューの入力                                                                                     | `pen.saturation = 50`     |
| `receiverArg`                           | レシーバーを入力に入れる（チェックはしない。行の `receiver` が受けつけるものを決める）                         | `"apple".length`          |
| `changesReceiver: true`                 | レシーバー（Ruby の式）をそのブロックに変える                                                                  | `pen.down`                |
| `hat: true`                             | ハット。`do ... end`（ブロック引数なし）を取り、その中身を下につなぐ（`registerOnSendWithBlock(..., 0, ...)`） | `when_flag_clicked do`    |
| `selfReceiver: true`（`onSelf(rows)`）  | `self.xxx` と `xxx` だけを受けつけ、同じ名前になる Ruby の式（`stage`）は受けつけない                          | `stage.volume` は sensing |

まだ足していない列（要る領域が出たら足す）:

| 列                | 使い道                                   | 例                               |
| ----------------- | ---------------------------------------- | -------------------------------- |
| `rubyBlock: 0`    | ハットでない `do ... end` を取る呼び出し | `forever do`（いまは handler）   |
| `stage: false`    | ステージでは使えない（エラーにする）     | 動きのブロック                   |
| `versions: ['2']` | Ruby のバージョンで形が違う              | v1 の `self.when(:flag_clicked)` |

### 古い `onXxx` 形式（なくした）

- `pen.onOpAsgn` は `registerOnOpAsgn` の handler に、`makeymakey.onSend`（v1 の `self.when(:makey_key_pressed, ...)`）は `registerOnSendWithBlock('self', 'when', 2, 0, ...)` に移した。
  もとの `onSend` は、その呼び出しのすべての handler が譲ったあとに試されていたので、`register-converters.js` がすべての変換器を登録したあとに `MakeyMakeyConverter.registerLast` で登録する。`self.when` の引数 2 つの handler（event・EV3・GdxFor）が先に試される順番はもとのまま。
- `_callConvertersHandler` は `registerOnXxx` で登録した配列だけを見る。11 個の変換器オブジェクトを調べる部分と、`register-converters.js` の export は消した。
- 新しい変換は表か `registerOnXxx` で書く（`.claude/rules/scratch-gui/ruby-mode.md`）。

表へ移すときは、変換器と往復のテストに書かれた Ruby（約 7,100 個）を、スプライト（v2・v1）・ステージ・衣装と音のあるスプライトの 4 通りで変換し、
エラー（行・列・文）、ブロック（opcode・フィールド・入力・mutation・親）、変数・リストが移す前とすべて一致することを確かめた。

## 1 領域ずつ移す順番

どの段階でも、移す領域の **ブロック ⇔ Ruby の表**（`test/unit/lib/ruby-roundtrip/<category>-table.test.js`）を先に作るか足して、移す前に通ることを確かめてから移す。
表が無い領域は、まず既存のテストを表へ移す（`.claude/rules/scratch-gui/testing.md` の「新しい opcode はブロック ⇔ Ruby の表から」）。

| 順  | すること                                                                                                                                                                                      | 振る舞いを固定するテスト                                                                             | 効率                         |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- | ---------------------------- |
| 1   | 解析の索引: 行の表、ノードの種類名をクラスごとに覚える（`nodeTypeName`）。済み                                                                                                                | 表のテストすべて、`line-for-offset.test.js`、`multibyte-offset.test.js`                              | 小                           |
| 2   | 変換の巻き戻しを journal に（`_saveContext` を写さない）。済み                                                                                                                                | 表のテストすべて、`orphan-blocks.test.js`、`target-applier-transaction.test.js`、往復テスト          | **大**（いま最も時間を使う） |
| 3   | 分析の段: `forEachNode` を作り、`_collectVariableUses` と `_countProcedureCallsInNode` を移して凍結した `Analysis` を出す。済み                                                               | 分析の結果の表のテスト（Ruby → `Analysis`）、表のテストすべて                                        | 小                           |
| 4   | 呼び出しの表: motion → looks → sound → control / event → sensing → operators → data（表にできる行なし）→ 拡張機能（pen まで済み）。古い `onXxx` 2 つもここで移した。残りは pen 以外の拡張機能 | その領域の表のテスト                                                                                 | なし                         |
| 5   | 仕上げの段: `targetCodeToBlocks` の後半を `finish()` へ。`targetCodeToBlocks` は 4 段を順に呼ぶだけにする                                                                                     | 表のテストすべて、往復テスト                                                                         | なし                         |
| 6   | class / module / initialize の判断を分析へ移す                                                                                                                                                | `class.test.js`、`module.test.js`、`initialize-round-trip.test.js`、`ruby-roundtrip-class-*.test.js` | なし                         |

1・2 は振る舞いを変えずに速くするだけなので先に行う。3 以降は、分析の表ができると変換の部品が `_context` を書きかえなくなり、`Object.assign` で混ぜている部品を段ごとのモジュールへ分けられるようになる（14 の部品を分けるのは 6 のあと）。

## 実行の効率

`test/unit/lib/ruby-to-blocks-converter/conversion-speed.test.js` で測る（ふだんは流れない。`RUBY_CONVERTER_BENCH=1` を付けて流す）。
同じ単位（戻り値のあるメソッド、繰り返し・`if`・`case`・リストを使うイベント）を `n` 回並べたコードを変換する。

関数ごとの時間（1,922 行、試作の前。共用のコンテナなので値は揺れる。割合で見る）:

| 処理                                 | 時間        | 呼ばれた数 | わけ                                                                                                                |
| ------------------------------------ | ----------- | ---------- | ------------------------------------------------------------------------------------------------------------------- |
| 変換全体                             | 約 2,200 ms | —          |                                                                                                                     |
| `_saveContext`                       | 約 1,570 ms | 1,441      | 試みのたびに、それまでのブロック・コメント・変数の表を全部写していた。書いたものの記録（journal）を巻き戻す形にした |
| `_getLineForOffset`                  | 約 290 ms   | 8,008      | 行番号を引くたびにソースの先頭から数えていた。試作で改行の表を引く形にした                                          |
| `_collectVariableUses`（下調べ）     | 約 30 ms    | 1          |                                                                                                                     |
| `callMethod`（呼び出しの登録を引く） | 約 35 ms    | 960        | 登録の表の引き方は遅くない                                                                                          |

行の数を 4 倍にすると（242 行 → 962 行）、時間は 8 倍ほどになる（約 50 ms → 約 400〜500 ms）。
長さの 2 乗に近く遅くなるのは、上の 2 つのように「1 回の処理がそれまでに作ったもの全体を見る」ため。段を分ける作業の中で、この 2 つは先に直す。

この 2 つを直したあと（中央値。値は揺れる）:

| 行数  | 直す前      | 直したあと     |
| ----- | ----------- | -------------- |
| 242   | 約 37 ms    | 約 16〜28 ms   |
| 962   | 約 555 ms   | 約 60〜70 ms   |
| 1,922 | 約 1,930 ms | 約 180〜210 ms |

`_saveContext` は 1,441 回の合計で 1 ms 未満になった。巻き戻し（`context-journal.js`）は、それぞれの表（`blocks`・`comments`・`variables` など）を、キーを書く・消す直前の値を記録する入れ物にして、記録を新しい順に戻す。戻したあとのキーと値と並びは、写しを戻していたときと同じにしている（消したキーは、残ったキーの後ろに、試みを始めたときの順で足し直す）。

## License

The documentation is under the same license as the repository.
