# Ruby → Scratch 橋渡しパターン集

> **🆕 Smalruby 独自** — upstream に存在しない、Smalruby のために新規追加された機能
> Scratch のブロックに無い Ruby の考え方（ローカル変数・戻り値・ハッシュ・class など）を、ブロックと注釈 `@ruby:*` でどう表し、どう Ruby に戻すかをまとめる。

変換器（Ruby → ブロック）と生成器（ブロック → Ruby）を直す人のための文書。ブロック ⇔ Ruby の変換器の設計の見直し（EPIC #1826）で、コードの中にしか無かった工夫を言葉にするために作った。

## この文書の役割（言語仕様との分担）

| 文書 | 書くこと | 読む人 |
|---|---|---|
| [`docs/smalruby-language-spec.ja.md`](../smalruby-language-spec.ja.md) | **何が書けるか**（使える構文・メソッド・書けないものの一覧） | 利用者・教材を作る人・AI の質問文 |
| この文書 | **どう橋渡しするか**（Ruby の考え方をどのブロック・名前・注釈で表し、どう戻すか、なぜそうしたか） | 変換器・生成器を直す人 |
| [`docs/ruby-editor/README.md`](README.md) | Ruby タブの機能・主要ファイル・設定 | 機能の全体を知りたい人 |

- 書ける・書けないが変わったら言語仕様を、表し方が変わったらこの文書を直す。両方変わることが多い。
- 日本語モード（DNCL）の表し方は [`docs/dncl/`](../dncl/) の担当。日本語 ⇔ Ruby の橋渡しは、あとで「[日本語モード側の橋渡し](#日本語モード側の橋渡し)」に足す。

## 全体の流れ

```
Ruby のコード
  │ prism（wasm）で構文木にする
  ▼
変換器 ruby-to-blocks-converter/   ← 構文木をたどり、ブロック・変数・コメント（注釈）を作る
  │ target-applier.js がスプライト（ステージ）へ書きこむ
  ▼
Scratch のブロック ＋ 変数・リスト ＋ コメント
  │
  ▼
生成器 ruby-generator/             ← ブロックと注釈を読んで Ruby に戻す
  │
  ▼
Ruby のコード
```

Scratch のブロックだけでは元の Ruby の形がわからないことがある（`a >= b` は `(a > b) または (a = b)` になる、など）。そのときは、作ったブロックに **注釈**（`@ruby:` で始まるコメント）を残し、生成器がそれを読んで元の形に戻す。

## 注釈 `@ruby:*` の共通の決まり

### 置き場所

| 置き場所 | 使う注釈 | 作り方 |
|---|---|---|
| ブロックのコメント（たたんだ状態） | ほとんどすべて | `_createComment(text, block.id)` |
| スプライト（ステージ）のコメント（どのブロックにも付かない） | `@ruby:class` / `@ruby:initialize` / `@ruby:module:<名前>` | `_createComment(text, null)` |

### 書き方

- 形は `@ruby:<種類>[:<値>...]`。値の区切りは `:`。
- 1 つのブロックに注釈が 2 つ以上あるときは `,` でつなぐ（例: `@ruby:lvar:a:1,@ruby:syntax:+=`）。
  - 例外: 明示の `return` だけは空白でつなぐ（`@ruby:syntax:return @ruby:return:foo`）。
  - `@ruby:list_ref` / `@ruby:block_param` は 1 行に 1 つ（`\n` でつなぐ）。
- 利用者のコメント（`# ...`）があるブロックでは、**利用者の文を先の行に、注釈をそのあとの行に**置く（`comment-handler.js` の `_mergeUserComment`）。たたんだコメントは 1 行目しか見えないので、利用者の文が見えるようにするため。
- 注釈だけのコメントはブロックのコメントのアイコンを出さない（`src/lib/scratch-blocks-comment-icon-patch.js`。空でない行がすべて `@ruby:` で始まるとき）。
- 生成器は `#` のコメントを書くとき `@ruby:` で始まる行を捨てる（`ruby-generator/scrub.js`）。

### 読み方（生成器）

ブロックの注釈を読むのは `src/lib/ruby-markers.js` の `rubyMarkersOf` だけ（生成器のほか、`module-sync.js` と、Ruby v1 に戻せるかを見る `settings-menu.jsx` / `mobile-drawer.jsx` も使う）。`@ruby:` で始まる行を注釈の行とし、行の中は `,` か空白のすぐあとに `@ruby:` が続くところで分ける。利用者のコメントがどこにあっても（前の行・行末・複数行）、注釈が先でも後でも同じ注釈の並びになる。

- 値の中の `,`（`@ruby:class:<=X,name=Cat`）は、すぐあとが `@ruby:` でなければ分けない。
- 値がプログラムの文字（`@ruby:syntax:case` の式、`@ruby:symbol` の名前、`@ruby:module_source` の module 名）の注釈は、行の終わりまでを値にする。`case "a @ruby:b"` の式の中の `@ruby:` で切らないため。ただし、変換器がそのあとに足す注釈（`,@ruby:method:puts`、`,@ruby:begin_loop_body`、ループの注釈）は分ける。
- 同じ種類の注釈が 2 つあるときは、あとのものを使う。変換器は利用者の文のあとに注釈を置くので、利用者が `@ruby:` で始まる行を書いても変換器の注釈が勝つ。

生成器のブロックごとの読み取りは、`scrub.js` が `Generator` に足す次のメソッドを使う。どれも `@ruby:comment_position:*`（利用者のコメントの位置）を除いた注釈を見るので、利用者がコメントを足しても「このブロックの注釈はこれだけ」が変わらない。

| メソッド | 返すもの |
|---|---|
| `getRubyMarkers(block)` | 注釈の配列 |
| `hasRubyMarker(block, '@ruby:method:clone')` | その注釈があるか |
| `findRubyMarker(block, '@ruby:syntax:case:')` / `rubyMarkerValue(block, '@ruby:symbol:')` | その形で始まる最初の注釈 / そのあとの値 |
| `getRubyMarkerText(block)` | 注釈を `,` でつないだ文字列（注釈の組み合わせ全体を正規表現で見る古い読み方のため） |

`getCommentText(block)` の文字列を `startsWith` / `===` / `split` で直接読まない。利用者の文が先に来ると注釈を見落とす。

### 注釈は「形が同じなら戻す」ための手がかり

注釈はブロックの意味を変えない。ブロックの上での動きは、ブロックそのものが決める。生成器は、ブロックが注釈を付けたときの形のままのときだけ注釈を使い、利用者がブロックを書きかえたら、ふつうのブロックとして Ruby にする。

- 例: `nil` を返すメソッドは、返す値を文字列 `""` のブロックにして `@ruby:nil` を付ける。生成器は値がまだ `""` のときだけ `nil` と書く（`data.js` の `data_setvariableto`）。
- 例: `a >= b` の 3 つのブロックには同じ `@ruby:operator:>=:<番号>` を付け、生成器は内側の 2 つが同じ番号の目印を返したときだけ `a >= b` と書く（`operators.js`）。

## 変換器が使う名前（予約された名前）

Scratch の変数・リストの名前で、Ruby の情報を持たせているもの。利用者がこの形の名前を自分で作ると、変換器がその意味に読むことがある。

| 名前（Scratch 上） | Ruby | 置き場所 | 決めているところ |
|---|---|---|---|
| `_<名前>_<番号>_`（例: `_a_1_`） | ローカル変数 `a` | スプライト（ステージ）の変数・リスト | `constants.js` の `LOCAL_VARIABLE_PATTERN`、`variable-utils.js` の `_lookupOrCreateVariableOrList` |
| `_return_<メソッド>_` | メソッドの戻り値 | スプライトの変数 | `my-blocks.js`、`expressions.js` の `visitReturnNode` |
| `_return_<メソッド>_<番号>_` | 同じ行の 2 回目より前の呼び出しの戻り値の控え | スプライトの変数 | `my-blocks.js` |
| `_ret<番号>`（Ruby では `@_ret1`） | メソッドブロック（`"ab".reverse` など）の戻り値の控え | スプライト（ステージ）の変数 | `return-value-temps.js` |
| `_hash_<名前>_keys_` / `_hash_<名前>_values_` | ハッシュ `@<名前>` のキーと値 | リスト 2 つ | `variable-utils.js` の `_hashKeysListName` / `_hashValuesListName` |
| `_<名前>_list_`（`_<名前>_list2_` ...）（Ruby では `@_a_list_`） | 同じ名前の変数のとなりにあるリスト `a` | リスト | 生成器 `variables.js` の `rubyBaseNameOfVariable`、変換器 `variable-utils.js` の `_listNameOfAlias` |
| `_symbols_`（ステージ） | 使われたシンボル | ステージのリスト | `variable-utils.js` の `_symbolToBlock` |
| `__lit_<番号>__1_` | 何もしないリテラルだけの行（`"Jimmy"`） | スプライトの変数・リスト | `index.js` の `_convertBareLiteralToAssignment` |
| `_super_<メソッド>_<番号>_` | `super` で呼ばれる、module 側の同じ名前のメソッド | 定義ブロック（手続き名） | `class-visitor.js` |

生成器だけが使う、出力の途中の目印もある（Ruby には残らない）。

| 目印 | 意味 | 決めているところ |
|---|---|---|
| `_bp_<番号>_` | ブロック引数の値ブロック。最後に `@ruby:block_param` の名前に置きかえる | `ruby-generator/smalruby-ruby.js` |
| `_rv_` / `_rv_truthy_` | 戻り値ブロック（`smalrubyRuby_returnValue`）。直前の行のメソッド呼び出しを埋めこむ | `ruby-generator/smalruby-ruby.js` |
| `@ruby:operator:>=:<番号>` などの文字列 | 2 つ以上のブロックで 1 つの演算子を表すとき、内側のブロックが外側へ返す目印 | `ruby-generator/operators.js` |

## パターン

各パターンは「Ruby で書きたいこと／Scratch での表し方／名前と注釈／往復の例／できないこと／テスト」の順に書く。往復の例は、いまのコードで Ruby → ブロック → Ruby を通したもの。

### P1. ローカル変数

**Ruby で書きたいこと**: `a = 1` のような、メソッドやブロックの中だけの変数。

**Scratch での表し方**: Scratch にローカル変数は無い。スプライトの変数を `_<名前>_<番号>_` の名前で作り、それを読み書きするブロックに `@ruby:lvar:<名前>:<番号>` を付ける。生成器は注釈から元の名前 `a` を戻す。

- **番号（スコープ番号）**: スクリプトの一番上と、その中のイベントのブロックは 1 を共有する。`def` は入るたびに新しい番号になる（`scope-manager.js` の `_enterScope`）。スクリプトの外側で使わない名前を、イベントごとに別のもの（文字列とリストなど）として使うときは、イベントごとに番号を分ける（`variable-utils.js` の `_localScopeIndex`）。
- **メソッドの引数**: 番号を付けない。値は引数のブロック（`argument_reporter_string_number`）で読む。
- **変換のたびに作り直す**: スプライトにある `_x_1_` の形の変数は、変換の前に消してから作り直す（`target-applier.js`）。
- **生成器が名前だけで判断しない理由**: `_x_1_` は利用者が作った `@_x_1_` かもしれない。フィールドに名前しか残らないブロック（`reverse!` の受け手など）では、ほかのブロックに同じ `@ruby:lvar:x:1` があるときだけローカル変数とみなす（`variables.js` の `hasLocalVariableComment`）。

**名前と注釈**: `LOCAL_VARIABLE_PATTERN = /^_(?![A-Z])[\p{L}_][\p{L}\p{N}_]*_\d+_$/u`（変換器 `constants.js` と生成器 `variables.js` の 2 か所）、`@ruby:lvar:<名前>:<番号>`、`+=` などは `@ruby:lvar:a:1,@ruby:syntax:+=`。

**往復の例**:

```ruby
def foo(n)
  a = n * 2
  a
end

when_flag_clicked do
  a = "x"
  say(foo(3))
end
```

- メソッドの中の `a` は `_a_2_`（`@ruby:lvar:a:2`）、イベントの中の `a` は `_a_1_`（`@ruby:lvar:a:1`）になり、別の変数として扱われる。Ruby に戻すと同じコードになる。

**注意**: ローカル変数の正体はスプライトの変数なので、別のスクリプトと値を分けているのは番号だけ。スクリプトの一番上で作ったローカル変数をイベントの中で読む形（`a = 1` のあとに `when_flag_clicked do say(a) end`）は、同じ `_a_1_` を読み、そのまま往復する。番号を同じにするか分けるかを変えるときは、この往復を壊さないこと。

**テスト**: `ruby-to-blocks-converter/local-variable-reuse.test.js`、`ruby-to-blocks-converter/variables/variables-scope.test.js`、`ruby-to-blocks-converter/variables/variables-array-local.test.js`、`ruby-roundtrip/literal-return-and-local-fields.test.js`、`ruby-generator/variables.test.js`。

### P2. メソッドの戻り値

**Ruby で書きたいこと**: 値を返すメソッドと、その値を使う呼び出し（`say(foo(3))`、`return n + 1`）。

**Scratch での表し方**: Scratch の「ブロックを作る」は値を返さない。戻り値はスプライトの変数 `_return_<メソッド>_` に入れて渡す。

- **定義側**: 最後の式は `_return_foo_ = <値>` のブロックになる（`@ruby:return:foo`）。明示の `return x` は `_return_foo_ = x`（`@ruby:syntax:return @ruby:return:foo`）と「このスクリプトを止める」（`@ruby:syntax:return`）の 2 つになり、定義の先頭に `_return_foo_ = ""`（`@ruby:return:foo:initialize`）が入る（前の呼び出しの値が残らないように）。
- **呼び出し側**: 値として使う呼び出しは、呼び出しのブロック（`procedures_call`）を文の前に置き、値の場所では変数 `_return_foo_` を読む。両方に `@ruby:return:foo` を付ける。
- **同じ行で 2 回以上呼ぶとき**（`foo(1) + foo(2)`）: 先の呼び出しの値はあとの呼び出しで上書きされるので、`_return_foo_1_ = _return_foo_` のブロックで控えておき、控えを読む。最後の 1 回より前の呼び出しは `@ruby:return:foo:<番号>` になる。
- **呼び出しのキャッシュ（生成器）**: 生成器は `@ruby:return:foo` の `procedures_call` を書くとき、出力せずに `Generator.returnCallCache_['foo']` へ `foo(3)` を入れる。あとで同じ注釈の変数ブロック（`data_variable`）を書くときにキャッシュから取り出し、変数の代わりに `foo(3)` を書く（`procedure.js` / `data.js`）。控えのブロック（`@ruby:return:foo:1`）と初期化のブロック（`:initialize`）は何も書かない。
- **`nil` / シンボル / 引数なしの `return` / かっこ**: ブロックに無い値は文字列（入力の文字そのもの。文字列のブロックを別に作らない）にして、`,@ruby:nil` / `,@ruby:symbol:a` / `,@ruby:return-bare` / `,@ruby:return-paren` を `@ruby:return` に足す。

**往復の例**:

```ruby
def foo(n)
  return n + 1
end

when_flag_clicked do
  say(foo(1) + foo(2))
end
```

- ブロック: 定義に `_return_foo_ = ""`（`:initialize`）・`_return_foo_ = n + 1`・止める。呼び出し側は `foo(1)`（`@ruby:return:foo:1`）→ `_return_foo_1_ = _return_foo_`（控え）→ `foo(2)`（`@ruby:return:foo`）→ `say(_return_foo_1_ + _return_foo_)`。Ruby に戻すと同じコードになる。

**できないこと**（エラーになる形）:

- 2 つ以上の値を返す `return 1, 2`、配列・ハッシュ・`self` など、ブロックで値にできないものを返す `return [1]`。
- 同じ行で値を控えたあとに、メソッドがそのメソッド自身を呼ぶ形（`return fib(n - 1) + fib(n - 2)`）。中の呼び出しが控えを上書きするので、Ruby と同じ値にならない。
- 1 行の中で値として使う `super` が 2 つ以上ある形。

**テスト**: `ruby-to-blocks-converter/method-return/method-return1.test.js`〜`method-return5.test.js`、`ruby-generator/method-return.test.js`、`ruby-roundtrip/my_blocks.test.js`、`ruby-roundtrip/method-return-value-shapes.test.js`、`ruby-roundtrip/return-literal-no-orphan.test.js`、`ruby-roundtrip/return-value-used-twice.test.js`、`ruby-roundtrip/return-call-paren-list-and-self-line.test.js`。

### P3. メソッドブロックの戻り値（文字列・配列・ハッシュのメソッド）

**Ruby で書きたいこと**: `"abc".reverse.upcase`、`@a.sort` のような、Scratch に無い文字列・配列・ハッシュのメソッド。

**Scratch での表し方**: Smalruby Ruby 拡張のメソッドブロック（`smalrubyRuby_stringMethod` / `smalrubyRuby_arrayMethod` / `smalrubyRuby_hashMethod`）を文として前に置き、値の場所には「戻り値」ブロック（`smalrubyRuby_returnValue`）を置く。戻り値ブロックは、最後に動いたメソッドブロックの値を返す。

- 生成器は戻り値ブロックを `_rv_` と書き、最後に直前の行のメソッド呼び出しを `_rv_` の場所へ埋めこむ（`ruby-generator/smalruby-ruby.js` の後処理）。
- 1 つの文の中で 2 つ以上の値を使うとき（`("ab" * 3).length + "cd".reverse.length`）は「最後に動いた」が正しくないので、それぞれの値をスプライトの変数 `@_ret1` / `@_ret2` に控える（`return-value-temps.js`）。コードで使っている `@_retN` の番号は飛ばす。

**往復の例**:

```ruby
say("abc".reverse.upcase)
```

- 同じコードに戻る。

```ruby
say(("ab" * 3).length + "cd".reverse.length)
```

- Ruby に戻すと次の形になる（往復で形が変わる）。

```ruby
@_ret1 = "ab" * 3
@_ret2 = "cd".reverse
say(@_ret1.length + @_ret2.length)
```

**できないこと**: 配列 `[...]` やハッシュ `{...}` に直接メソッドを使う形（`[1, 2].first`、`{a: 1}.keys`）はエラー。先に変数に入れる。

**テスト**: `ruby-to-blocks-converter/smalruby-ruby.test.js`、`ruby-generator/smalruby-ruby.test.js`、`ruby-roundtrip/smalruby-ruby.test.js`、`ruby-roundtrip/return-value-used-twice.test.js`。

### P4. 配列とリスト

**Ruby で書きたいこと**: `@a = [1, 2, 3]`、`@a.push(4)`、`@a[0]`、`@a.length`。

**Scratch での表し方**: 配列はリスト。名前は `@` / `$` を取ったもの（`@a` → リスト `a`、ローカル変数は `_a_1_`）。

- **配列リテラルの代入**: 「すべて削除」（`@ruby:array:literal:<個数>`）と「追加する」を要素の数だけ（`@ruby:array:literal:element`）。生成器は `@ruby:array:literal:<個数>` から先の個数の「追加する」をまとめて `@a = [1, 2, 3]` に戻す。
- **添字**: Ruby は 0 から、Scratch は 1 から数える。`@a[i]` は「`i + 1` 番目」にし、足し算に `@ruby:array:index` を付ける。生成器は `+ 1` を消して `@a[i]` に戻す。文字の位置（`"abc"[i]`）も同じ。
- **`delete_at(-1)`**: 「（リストの長さ）番目を削除する」にし、`@ruby:array:delete_at:last` を付ける。添字が「リストの長さ」なので、ブロックとして動かしても最後の項目が消える。生成器は、添字が同じリストの長さのブロックなら注釈が無くても `delete_at(-1)` と書く。注釈があって添字が `1` のもの（前の変換器が作った形）も `delete_at(-1)` と書く。利用者が添字をほかの数に書きかえたら、ふつうの `delete_at` として書く。Ruby v1（`list("$a").delete_at(-1)`）も同じで、v1 の `list("$a").delete_at(list("$a").length)` も `delete_at(-1)` に戻る（意味は同じ）。
- **変数とリストが同じ名前のとき**: Scratch では変数 `a` とリスト `a` を同時に持てるが、Ruby の `@a` は 1 つ。生成器はリストの方を `@_a_list_`（それも使われていれば `@_a_list2_` ...）と書き、変換器は `@_a_list_` をリスト `a` に読む（`_listNameOfAlias`）。
- **ブロック付きのメソッド**（`@a.each do |x|`）: `smalrubyRuby_arrayMethodWithBlock`。リストの ID と名前を隠しフィールド `LIST_ID` / `LIST_NAME` に持たせる（→ P13）。

**往復の例**:

```ruby
@a = [1, 2, 3]
@a.push(4)
say(@a[0])
say(@a.length)
```

- 同じコードに戻る。

```ruby
@a = 1
@_a_list_ = [1]
say(@a)
say(@_a_list_[0])
```

- スプライトには変数 `a` とリスト `a` ができ、同じコードに戻る。

```ruby
@a = [1, 2, 3]
@a.delete_at(-1)
```

- 「a の（a の長さ）番目を削除する」になり、動かすと `a` は `1, 2` になる。同じコードに戻る。

**できないこと**: 1 つの名前を変数とリストの両方に使う形（`@a = 0` と `@a.push(1)`）はエラー（`variableAndListSameName`）。配列リテラルに直接メソッドを使う形もエラー（`arrayLiteralReceiver`）。要素は数・文字列（式展開の文字列 `"a#{@x}"` は除く）・値のブロック（`@x`、`1 + 2`、`true` など）だけで、ほかの要素（代入などの命令 `[(@a = 1)]`、シンボル・`nil`・配列・ハッシュ・`self`、値を返すメソッドの呼び出し `[foo(1)]`）はその行の「命令がまちがっています」のエラー（`wrongInstruction`）。リストに入れられないので、黙って `0` にしない。保存済みのプロジェクトの前の形（添字 `1` に `@ruby:array:delete_at:last`）は、読みこんでもブロックは直らず、動かすと 1 番目の項目が消える（Ruby に戻すと `delete_at(-1)` なので、Ruby とブロックの動きが合わない）。Ruby タブで変換し直すと「（リストの長さ）番目」になる。`-1` 以外の負の添字（`@a[-1]`、`@a.delete_at(-2)`）は「`-1 + 1` 番目」のように数えるので、往復はするが、ブロックとして動かすと Ruby と同じ項目にならない。

**テスト**: `ruby-to-blocks-converter/literal-element-not-a-value.test.js`、`ruby-to-blocks-converter/variables/variables-array-global.test.js`、`variables-array-local.test.js`、`ruby-roundtrip/variables-v2-array.test.js`、`ruby-roundtrip/list-index-parens.test.js`、`ruby-roundtrip/list-as-argument.test.js`、`ruby-roundtrip/variable-and-list-same-name.test.js`、`ruby-roundtrip/variable-or-list-kind.test.js`、`ruby-roundtrip/string-letter-index.test.js`、`ruby-roundtrip/list-delete-at-last-vm.test.js`、`ruby-generator/data.test.js`。

### P5. ハッシュ

**Ruby で書きたいこと**: `@h = {a: 1, "b" => 2}`、`@h[:c] = 3`、`@h[:a]`、`@h.length`、`@h.key?(:a)`、`@h.each do |k, v|`。

**Scratch での表し方**: Scratch にハッシュは無い。キーのリスト `_hash_h_keys_` と値のリスト `_hash_h_values_` の 2 つで表す。同じ位置のキーと値が 1 組。シンボルのキーは文字列 `:a`、文字列のキーはそのまま入れる。

| Ruby | ブロック | 注釈 |
|---|---|---|
| `@h = {a: 1}` | キーと値のリストをすべて削除し、組ごとに追加 | `@ruby:hash:literal:<組の数>`（キーの削除）、`@ruby:hash:literal:values`、`@ruby:hash:literal:key:sym` / `key:str`、`@ruby:hash:literal:value` |
| `@h[:a]` | 値のリストの「（キーのリストの中の `:a` の位置）番目」 | `@ruby:hash:get:sym` / `get:str` |
| `@h[:c] = 3` | 値とキーの古い組を削除し、キーと値を追加 | `@ruby:hash:set:sym` / `set:str`、`@ruby:hash:set:delete:key`、`@ruby:hash:set:push:key`、`@ruby:hash:set:push:value` |
| `@h.length` | キーのリストの長さ | `@ruby:hash:length` |
| `@h.key?(:a)` | キーのリストに `:a` があるか | `@ruby:hash:key?:sym` / `key?:str` / `key?` |
| `@h.each do |k, v|` | `smalrubyRuby_hashMethodWithBlock` | `@ruby:list_ref:KEYS:...` / `VALUES:...`、`@ruby:block_param` |

ローカル変数のハッシュは注釈の前に `@ruby:lvar:<名前>:<番号>,` が付く。使われないハッシュの変数（`h`）は最後に消す（`_dropUnusedHashVariables`）。

**往復の例**:

```ruby
@h = {a: 1, "b" => 2}
@h[:c] = 3
say(@h[:a])
say(@h.length)
```

- 同じコードに戻る。

**できないこと**（エラーになる形）: キーがシンボルでも文字列でもない（`hashKeyNotSupported`）、値がハッシュ・配列・`nil`（`@h = {a: {b: 1}}`、`hashValueNotSupported`）、ハッシュのリテラルに直接メソッドを使う（`{a: 1}.keys`、`hashLiteralReceiver`）。値が代入などの命令（`{a: (@a = 1)}`）や値を返すメソッドの呼び出し（`{a: foo(1)}`）のときは、配列の要素と同じく「命令がまちがっています」のエラー（`wrongInstruction`）。

**テスト**: `ruby-to-blocks-converter/variables/variables-hash-global.test.js`、`ruby-roundtrip/variables-v2-hash.test.js`、`variables-v2-hash-methods.test.js`、`variables-v2-hash-methods-vm.test.js`、`variables-v2-hash-unused-variable.test.js`。

### P6. class / module / initialize / super

**Ruby で書きたいこと**: スプライトを `class` で書く、`attr_accessor`、`def initialize` で変数の初期値を決める、`module` と `include` でメソッドを共有する、`super`。

**Scratch での表し方**:

- **class**: class そのものはブロックにならない。`class Cat < ::Smalruby3::Sprite` の情報は、スプライトのコメント `@ruby:class:<部分>,<部分>...` に残す。部分は次のとおり。
  - `<=<親クラス>`（`::` は `/` に、先頭の `::` は `//` にする。例: `<=//Smalruby3/Sprite`）
  - `name=<クラス名>`（`Sprite1` などのスプライト名の形でないとき。スプライトの名前もクラス名に変える）
  - `set_x 10` などで書いた属性の名前（`x` / `y` / `direction` / `visible` / `size` / `current_costume` / `rotation_style` / `costumes` / `sounds`、ステージは `current_backdrop` / `backdrops` / `sounds`）。値はスプライトそのものに入れ、注釈には「書いてあった」ことだけを残す。
  - `attr_accessor=hp+mp` / `attr_reader=...` / `attr_writer=...`
  - `include=<module 名>`（順に）
  - 何も無いときは `@ruby:class` だけ。
- **attr_accessor**: 生成器は注釈の名前を `_attrAccessorNames` に入れ、`@hp` を `hp`、`@hp = 1` を `self.hp = 1` と書く。
- **initialize**: 中の `@x = 10`（ステージは `$x`）は、ブロックではなく変数の初期値になる（`initialize-handler.js`）。引数と `super` はスプライトのコメント `@ruby:initialize:args=(a, b),super` / `super=(1, 2)` に残す。
  - attr_accessor（`attr_reader` / `attr_writer`）の変数は、initialize に書かなくても変数ができるので、生成器はふだん initialize に書かない。initialize で値を入れた attr_accessor の変数だけ、名前を `@ruby:initialize:attr=hp+mp` に残し、生成器はその変数を initialize に書く。
  - 注釈の部分は、かっこの外の `,` で区切って読む（`super=(foo(1)),attr=hp` の `super(foo(1))` もそのまま戻る）。
- **class の中の順**: 生成器は class の中を `set_xxx`・`def initialize`・`include`・`attr_accessor`・スクリプトの順に書く。変換器は書いた順を持たないので、ほかの順に書いたコード（`attr_accessor` を `def initialize` より先に書くなど）は、往復するとこの順になる。この順に書いたコードは同じコードに戻る。
- **module**: module のメソッドは、include したスプライトの定義ブロックとして作り、`@ruby:module_source:<module 名>` を付ける。生成器はこの注釈の定義ブロックを `module ... end` にまとめて書く。ほかのスプライトの同じ module は `module-sync.js` が同じ内容にそろえる。module の前の `#` コメントは、スプライトのコメントに `\n@ruby:module:<module 名>` を付けて残す。
- **super**: スプライトのメソッドが module の同じ名前のメソッドを `super` で呼ぶとき、module 側の定義を `_super_<メソッド>_<番号>_` に名前を変えて作り、`@ruby:module_source:<module 名>:super_of:<元の名前>` を付ける。`super` はその定義の呼び出しブロックになり、`@ruby:super`（引数あり）か `@ruby:super:forwarding`（引数なし）を付ける。値として使う `super` は `,@ruby:return:<名前>` も付く（→ P2）。
- **Ruby v1 に戻せない**: `@ruby:class` / `@ruby:module_source` があるプロジェクトは、設定で Ruby v1 に切りかえられない（`settings-menu.jsx` / `mobile-drawer.jsx`）。

**往復の例**:

```ruby
module Walk
  def walk
    move(10)
  end
end

class Sprite1
  include Walk

  def walk
    super
    move(5)
  end
end
```

- スプライトのコメント `@ruby:class:include=Walk`、module 側の定義に `@ruby:module_source:Walk:super_of:walk`、`super` の呼び出しに `@ruby:super:forwarding`。Ruby に戻すと同じ形になる（class の最後に空行が 1 つ入る）。

```ruby
class Sprite1
  def initialize
    @hp = 3
  end

  when_flag_clicked do
    say(@hp)
  end
end
```

- 変数 `hp` の初期値が 3 になり、同じコードに戻る。

```ruby
class Sprite1
  def initialize
    @hp = 3
  end

  attr_accessor :hp

  when_flag_clicked do
    say(hp)
  end
end
```

- スプライトのコメントは `@ruby:class:attr_accessor=hp` と `@ruby:initialize:attr=hp`。変数 `hp` の初期値が 3 になり、同じコードに戻る。`attr_accessor :hp` を `def initialize` より先に書いても `@hp = 3` は残るが、戻すと上の順になる。

**できないこと**（エラーになる形）: class の中に直接書いた命令（`wrongInstructionInClass`）、ステージの class に別の親クラス（`invalidStageSuperclass`）、`initialize` の中の代入以外の文（`invalidInitializeBody`）、スプライトの `initialize` での `$x =`（`wrongVariableScopeInInitialize`）、入れ子の module、module の中の `def` 以外、`module_function`、`extend`、ステージでの module / include、Ruby v1 での class / module。

**テスト**: `ruby-to-blocks-converter/class.test.js`、`class-error-message.test.js`、`initialize-round-trip.test.js`、`module.test.js`、`super.test.js`、`ruby-generator/class.test.js`、`class-wrapper.test.js`、`code-finisher.test.js`、`module.test.js`、`file-output-patterns.test.js`。

### P7. シンボル

**Ruby で書きたいこと**: `say(:hello)`、`@s = :abc`、ハッシュのキー `:a`、メソッドの戻り値 `:a`。

**Scratch での表し方**: Scratch にシンボルは無い。

- `say(:hello)` のような引数は、文字列 `hello` にしてブロックに `@ruby:symbol:hello` を付ける。
- 値としてのシンボル（`@s = :abc`）は、ステージのリスト `_symbols_` の「`abc` の位置」ブロック（`data_itemnumoflist`）にし、`@ruby:symbol:abc` を付ける。変数がシンボルを持つときの読み出しは `_symbols_` の項目ブロックにして `@ruby:symbol:var` を付ける。
- 生成器は、文字列がまだ注釈の名前のときだけ `:hello` に戻す。

**往復の例**:

```ruby
say(:hello)
@s = :abc
say(@s)
```

- 同じコードに戻る。ステージにリスト `_symbols_` ができる。

**できないこと**（エラーになる形）: シンボルの計算（`:a + 1`、`symbolCannotArithmetic`）・比べる（`symbolCannotCompare`）・文字列として使う（`symbolNeedsToS`。`:a.to_s` と書く）、シンボルだけの行（命令ではない）。

**テスト**: `ruby-to-blocks-converter/looks/symbol-implicit.test.js`、`operators/symbol-arithmetic.test.js`、`operators/symbol-error.test.js`、`operators/symbol-to-s.test.js`、`variables/variables-symbol-list.test.js`、`variables-symbol-ref.test.js`、`variables-symbol-var-say.test.js`、`ruby-generator/symbol-generator.test.js`。

### P8. 正規表現

**Ruby で書きたいこと**: `@r = /ab+c/`、`"abbc" =~ /ab+c/`、`!~`。

**Scratch での表し方**: 正規表現は文字列 `/ab+c/` として持つ。

- 代入は `@ruby:regexp:literal` を付け、生成器は文字列の引用符を外して `/ab+c/` と書く。
- `=~` は「（文字列）に（`/ab+c/`）が含まれる」（`operator_contains`）に `@ruby:operator:=~:<番号>` を付ける。正規表現が左にあるときは `:receiver` を足す。`!~` は「〜ではない」でかこみ、両方に `@ruby:operator:!~:<番号>` を付ける。
- ブロックで動かすとき、文字列の正規表現として調べるのは Smalruby の VM 側の担当。

**往復の例**:

```ruby
@r = /ab+c/
if "abbc" =~ /ab+c/
  say("ok")
end
```

- 同じコードに戻る。

**テスト**: `ruby-to-blocks-converter/operators/regexp.test.js`、`ruby-generator/operators/regexp.test.js`、`ruby-roundtrip/regexp.test.js`。

### P9. true / false・nil・リテラル

**Ruby で書きたいこと**: `@f = true`、`if false`、`nil`。

**Scratch での表し方**: Scratch に真偽値のリテラルは無い。

- `true` は「`1 = 1`」（`@ruby:literal:true:<番号>`）、`false` は「`0 < 0`」（`@ruby:literal:false:<番号>`）。生成器は注釈を見て `true` / `false` に戻す。番号は同じ形が並んでも区別するため。
- 条件に変数だけを書く（`if @f`）と「`(@f = "false")` ではない」（`@ruby:variable_condition`）にする。Ruby では `nil` と `false` だけが偽で、変数をそのまま条件にすると 0 や `""` も偽になるため。注釈は `if` やループではなく、条件の中の「ではない」ブロックに付ける（`while a < 3 && x` のように条件の一部だけが変数のとき、その部分だけを `x` に戻すため）。
- `nil` は形にできるブロックが無い。戻り値では文字列 `""` と `@ruby:nil`（→ P2）。

**往復の例**:

```ruby
@f = true
if @f
  say(1)
end
```

- 戻すと `say("1")` になる（`say` の引数は文字列の入力なので）。ほかは同じ。

**テスト**: `ruby-to-blocks-converter/operators/literals.test.js`、`false-condition.test.js`、`ruby-roundtrip/variable-condition.test.js`、`ruby-generator/operators/operators2.test.js`。

### P10. Scratch に無い演算子

**Ruby で書きたいこと**: `>=` / `<=` / `!=` / `=~` / `!~`、単項の `-`、`empty?`、`to_s` / `to_i`、`self.direction += 15`。

**Scratch での表し方**: いくつかのブロックを組み合わせ、組み合わせたブロックすべてに同じ注釈を付ける。番号（`<番号>`）は同じ演算子が 1 つのスプライトに何度出ても区別するためのもの。

| Ruby | ブロック | 注釈 |
|---|---|---|
| `a >= b` | `(a > b) または (a = b)` | 3 つに `@ruby:operator:>=:<番号>` |
| `a <= b` | `(a < b) または (a = b)` | 3 つに `@ruby:operator:<=:<番号>` |
| `a != b` | `(a = b) ではない` | 2 つに `@ruby:operator:!=:<番号>` |
| `-a` | `0 - a` | `@ruby:unary_minus` |
| `x.empty?` | `(x の長さ) = 0`（リストならリストの長さ） | 2 つに `@ruby:method:empty?:<番号>` |
| `x.to_s` | `x と ""` をつなぐ | `@ruby:method:to_s` |
| `"3".to_i` | `"3"` の切り下げ | `@ruby:method:to_i` |
| `self.direction += 15` / `-= 15` | 右に回す / 左に回す | `@ruby:operator:+=` / `@ruby:operator:-=` |

生成器は、内側のブロックを書くときに注釈の文字列（例: `@ruby:operator:>=:1`）を値として返し、外側のブロックが両方の値がその文字列のときだけ `a >= b` と書く。利用者が片方を書きかえたら、ふつうの `or` などとして書く。

**往復の例**:

```ruby
say(@x >= 3)
say(@x != 3)
say(-@a)
say(@a.to_s)
say("3".to_i)
say(@a.empty?)
```

- 同じコードに戻る。

**テスト**: `ruby-to-blocks-converter/operators/comparison-compound.test.js`、`comparison-not-equals.test.js`、`type-conversion.test.js`、`string.test.js`、`ruby-generator/operators/operators1.test.js`、`operators2.test.js`、`ruby-roundtrip/operators.test.js`、`operator-order.test.js`、`unary-minus.test.js`。

### P11. Scratch に無いメソッド（`@ruby:method`・`@ruby:argument`）

**Ruby で書きたいこと**: `puts(1)` / `print` / `p`、`gets`、`clone`、ループの中の `wait`、`with_screen_refresh`。

**Scratch での表し方**: 近いブロックにして、元のメソッド名を `@ruby:method:<名前>` で残す。

| Ruby | ブロック | 注釈 |
|---|---|---|
| `puts(1)` / `print(x)` / `p(x)` | 「〜と 1 秒言う」 | `@ruby:method:puts`。数の引数は `,@ruby:argument:1:type:Integer`（`Float`）を足し、生成器は引用符を付けずに書く |
| `@a = gets` | 「（空）と聞いて待つ」＋「答え」 | 両方に `@ruby:method:gets` |
| `clone` | 「自分のクローンを作る」 | `@ruby:method:clone` |
| ループの最後の `wait` | （ブロックにしない）ループに | `@ruby:method:wait` |
| `loop.with_screen_refresh do` など | ループに | `@ruby:method:with_screen_refresh` |

**往復の例**:

```ruby
puts(1)
puts("a")
```

- 同じコードに戻る。

**できないこと**: 当たるブロックが無いメソッドの呼び出し（`foo.bar(1)`）はエラー（→ P17）。

**テスト**: `ruby-to-blocks-converter/looks/looks6.test.js`、`gets.test.js`、`ruby-generator/looks.test.js`、`sensing.test.js`、`control-repeat-screen-refresh.test.js`、`ruby-roundtrip/with-screen-refresh.test.js`、`until-while-empty-and-wait.test.js`。

### P12. 構文の形（`@ruby:syntax` など）

**Ruby で書きたいこと**: `elsif`、`unless`、修飾子の `if` / `unless`、`case` / `when`、`while`、`begin ... end while`、`wait until`、`+=` などの代入演算子、`return`。

**Scratch での表し方**: 意味が同じブロックにして、書き方を `@ruby:syntax:<形>` で残す。

| Ruby | ブロック | 注釈 |
|---|---|---|
| `if ... elsif ... else` | 「もし〜なら・でなければ」の入れ子 | 入れ子の各ブロックに `@ruby:syntax:elsif:<番号>` |
| `x if cond` | 「もし〜なら」 | `@ruby:syntax:if_modifier` |
| `unless cond` / `unless ... else` / `x unless cond` | 「もし（〜ではない）なら」 | `@ruby:syntax:unless` / `unless_else` / `unless_modifier` |
| `case @a when 1 ...` | 「もし（`@a = 1`）なら」の入れ子 | 各ブロックと比べるブロックに `@ruby:syntax:case:<比べる式>:<番号>` |
| `while cond` | 「（〜ではない）まで繰り返す」 | `@ruby:syntax:while` |
| `begin ... end while cond` | 中身を 1 回前に置き、「まで繰り返す」 | ループに `@ruby:syntax:begin_end`、前に置いた中身に `@ruby:begin_loop_body` |
| `wait until cond` を値の呼び出し付きで | 「まで繰り返す」 | `@ruby:syntax:wait_until` |
| `a += 1`（`-=` / `*=` / `/=` / `%=`） | 「`a` を `a + 1` にする」 | `@ruby:syntax:+=`（ローカル変数は `@ruby:lvar:a:1,@ruby:syntax:+=`） |
| `return x` | 戻り値の代入＋止める | `@ruby:syntax:return`（→ P2） |

- **ループの条件の中のメソッド呼び出し**（`while bar(@a) < 3`）: 条件の値を作るために、呼び出しを最初の 1 回はループの前、2 回目からはループの中身の最後に置く。中身の最後の分には `@ruby:loop_condition_call` を付け、生成器は書かない（`scrub.js`）。
- **`begin ... end while`**: 前に置いた中身がループの中身と同じときだけ、生成器はそれを書かない。違っていれば（利用者が片方を書きかえた）両方を書く。
- **`case` の式と `when` の値は値だけ**: 比べるブロック（`=`）の入力に入れるので、引数と同じく値として変換する（`_visitAsValue`）。値を返すメソッドの呼び出し（`case foo(1)` / `when foo(1)`）は、呼び出しと戻り値の変数になる（P2）。代入（`when (@a = "abc")`）や命令（`case move(1)`、値を返さないメソッド）は、`case` / `when` から値の終わりまでを 1 行にして示す「命令がまちがっています」のエラーにする（`control-flow.js` の `_rejectNonValueInCase`）。入力に命令のブロックを入れると、生成器が `when @` のような壊れた Ruby を書いていた。
- **`when` の値は 1 つだけ**: `when 1, 2` は同じエラーにする。2 つ目より後の `when` で起きたときも、その `when` から先を黙って捨てない。
- **できないこと**（エラーになる形）: 比べるブロックの入力に入れられるのは数・文字列（式展開を除く）・値のブロック（`@x`、`1 + 2`、`true` など）だけ。シンボル・`nil`・配列・ハッシュ・`self`・式展開の文字列・正規表現・定数を `when` の値や `case` の式に書く形（`when :sym`、`when nil`、`when [1, 2]`、`when "a#{@x}"`、`when /a/`、`when Integer`、`case :a`）は、`case` / `when` の行の「命令がまちがっています」のエラー。主語の無い `case`（`case` / `when @a > 1`）も、`case` の行の同じエラー（比べる値が無い。`if` / `elsif` で書く）。

**往復の例**:

```ruby
case @a
when 1
  say(1)
when 2
  say(2)
end
```

- 同じ形に戻る（`say` の数は文字列になる）。

```ruby
begin
  @a += 1
end while @a < 3
```

- 同じコードに戻る。

**テスト**: `ruby-to-blocks-converter/control/`、`case-when-children.test.js`、`case-when-command.test.js`、`case-when-values.test.js`、`ruby-generator/control/`、`ruby-roundtrip/control_if.test.js`、`elsif-condition-call.test.js`、`while-and-conditions.test.js`、`loop-condition-call.test.js`、`begin-end-while.test.js`、`until-while-empty-and-wait.test.js`、`empty-loop-body.test.js`。

### P13. ブロック引数

**Ruby で書きたいこと**: `3.times do |i|`、`@a.each do |x|`、`@h.each do |k, v|`。

**Scratch での表し方**: Smalruby Ruby 拡張のブロック付きメソッドのブロック（`smalrubyRuby_numberMethodWithBlock` / `arrayMethodWithBlock` / `hashMethodWithBlock`）。中で使う引数は「ブロック引数」ブロック（`smalrubyRuby_blockParam`、フィールド `PARAM` = `_1` など）にする。

- 引数の名前は `@ruby:block_param:<番号>:<名前>` で残す（1 行に 1 つ）。
- 生成器はブロック引数を `_bp_<番号>_` と書き、最後に注釈の名前へ置きかえて `do |i|` を付ける。
- ハッシュの `each` は、キーと値のリストの ID と名前を `@ruby:list_ref:KEYS:<ID>:<名前>` / `@ruby:list_ref:VALUES:<ID>:<名前>` に残す。隠しフィールド（`KEYS_LIST_ID` など）はワークスペースの XML を通ると消えるので、VM（`scratch-vm/src/extensions/smalruby_ruby/block-method-executors.js`）はコメントからリストを探す。

**往復の例**:

```ruby
@h = {a: 1}
@h.each do |k, v|
  say(k)
end
```

- 同じコードに戻る。

**テスト**: `ruby-to-blocks-converter/smalruby-ruby.test.js`、`ruby-generator/smalruby-ruby.test.js`、`ruby-roundtrip/smalruby-ruby.test.js`、`ruby-roundtrip/variables-v2-hash-methods.test.js`。

### P14. コメント

**Ruby で書きたいこと**: `# 前のコメント` と `move(10) # うしろのコメント`。

**Scratch での表し方**: ブロックのコメント。

- 前の行のコメントは次の行のブロックに付ける。続けて書いた行は 1 つにまとめる。
- うしろのコメントは同じ行のブロックに付け、`@ruby:comment_position:inline` を足す。生成器はこの注釈があると行の最後に `# ...` と書く。
- 1 つのブロックに前のコメントとうしろのコメントの両方があるときは、前のコメントの行のあとにうしろのコメントを 1 行で置き、`@ruby:comment_position:inline:last` を足す（`前\nうしろ\n@ruby:comment_position:inline:last`）。生成器は利用者の文の最後の行だけを行の最後に書き、それより前の行は前の行に `# ...` と書く。`inline` だけのときは利用者の文がすべてうしろのコメント。
- class / module の前のコメントはスプライトのコメントにする。module のときは `@ruby:module:<module 名>` を足し、生成器はそのコメントを module の前に書く（`code-finisher.js`）。

**往復の例**:

```ruby
# 前のコメント
move(10)
move(20) # うしろのコメント
# 前
move(30) # うしろ
```

- 同じコードに戻る。`move(30)` のコメントは `前\nうしろ\n@ruby:comment_position:inline:last`。

**できないこと**:

- 利用者のコメントが、Ruby に書かれないブロックや、行の中の値のブロックに付くことがある（変換器がコメントを付けるブロックを、行の始まりの位置で選ぶため）。
  - 配列・ハッシュのリテラルの行末のコメントは消える。`@a = [1, 2] # c` の `# c` は最後の要素を足すブロックに付く。前の行のコメントは代入のうしろに移る。
  - `a += 1 # c` は `# c` が前の行に移る（足し算のブロックに付く）。
  - 値だけの行（P18）のコメントはスプライトのコメントになり、離れた場所に出る。`"Jimmy" # c` は `# c` と `"Jimmy"` が別の段落になる。
  - 明示の `return` のコメントは止めるブロックに付く。行末のコメントは消え、前の行のコメントは `return` のうしろに移る。
  - `case` の前のコメントは比べる値のブロックに付き、`when` の前のコメントは中の最初の命令に付く。
- C ブロック（`loop do` / `if` など、中に命令を入れるブロック）の行末のコメントは、元の行に戻らない。`loop do # y` は `end # y` になる（コメントが `end` の行に移る）。`if touching?("_edge_") # c` は前の行の `# c` になる（コメントが条件のブロックに付くため）。
- 空行で離れた前のコメントは消える。`# a\n\n# b\nmove(10)` の `# a` は残らない。

**テスト**: `ruby-to-blocks-converter/comments.test.js`、`comment-round-trip.test.js`、`ruby-generator/scrub.test.js`、`ruby-generator/ruby-markers.test.js`、`module-sync.test.js`、`ruby-roundtrip/comment-markers-table.test.js`（注釈のあるブロックに利用者のコメントがあるとき）。

### P15. 変数の種類と置き場所

**Ruby で書きたいこと**: インスタンス変数 `@a`、グローバル変数 `$a`、ローカル変数 `a`、定数 `FOO`。

**Scratch での表し方**:

| Ruby | Scratch | 生成器が書く形 |
|---|---|---|
| `@a`（スプライト） | そのスプライトだけの変数 `a` | `@a` |
| `$a` | ステージの変数 `a`（すべてのスプライト用） | `$a` |
| `@a`（ステージのコード） | ステージの変数 `a` | `$a`（ステージの変数はいつも `$`。往復で `@a` が `$a` になる） |
| `a` | `_a_<番号>_`（→ P1） | `a` |
| `attr_accessor :a` の `@a` | スプライトの変数 `a` | `a` / `self.a = ...`（→ P6） |
| 定数 `FOO` | 無い | — |

- 変数の注釈は `@ruby:lvar` だけ（`@ruby:variable` という注釈は無い）。変数の名前と置き場所（スプライトかステージか）で種類がわかるので、インスタンス変数とグローバル変数には注釈を付けない。
- 変換器は、コードがその名前をどう使っているか（`@a = []` や `push` ならリスト、`@a = 0` や `+= 1` なら変数）を変換の前に調べておく（`variable-utils.js` の `_collectVariableUses`）。
- 1 つのスプライトのコードで同じ名前を `@a` と `$a` の両方に使うことはできない。

**往復の例**:

```ruby
@a = 1
@a += 1
```

- ステージのコードとして変換すると、次の形に戻る。

```ruby
$a = 1
$a += 1
```

**できないこと**（エラーになる形）: 同じ名前の変数の種類を変える（`@a = 1` と `$a = 2`、`cannotChangeVariableScope`）、定数への代入（`FOO = 1`）。

**テスト**: `ruby-to-blocks-converter/variables/variables-instance1.test.js`、`variables-instance2.test.js`、`variables-global1.test.js`、`variables-global2.test.js`、`variables-scope.test.js`、`variables-data-type.test.js`、`ruby-roundtrip/variables.test.js`、`ruby-roundtrip/variable-or-list-kind.test.js`、`ruby-generator/variables.test.js`。

### P16. 多重代入

**Ruby で書きたいこと**: `@a, @b = 1, "x"`。

**Scratch での表し方**: ブロックに多重代入は無い。右がすべてリテラル（数・文字列・`true` / `false`）で、左と同じ数のときだけ、`@a = 1` と `@b = "x"` の 2 つの代入にする。左から順に入れても意味が同じだから。

**往復の例**:

```ruby
@a, @b = 1, "x"
```

- 次の形に戻る（往復で形が変わる）。

```ruby
@a = 1
@b = "x"
```

**できないこと**: それ以外の形は、その行の「命令がまちがっています」のエラー。入れかえ `a, b = b, a`（順に入れると意味が変わる）、右が変数・式・呼び出し、数が合わない、配列、スプラット、リストの要素、入れ子。

**テスト**: `ruby-roundtrip/multiple-assignment.test.js`。

### P17. ブロックにできない文とエラー

**Ruby で書きたいこと**: 当たるブロックが無いメソッドや構文。

**Scratch での表し方**: 変換器は、当たる変換が無い呼び出しを、いったん Ruby のコードをそのまま持つブロック（`ruby_statement` / `ruby_statement_with_block` / `ruby_expression`）にする。範囲 `1..6` も `ruby_range` / `ruby_exclude_range` にする。変換の最後に、これらのブロックが残っていたらエラーにする（`index.js`）。

- **`ruby_*` のブロックはエラーの目印**: 残してよいのは `@ruby:return` の付いたものだけ。`ruby_range` は `rand(1..6)` の引数のときだけ「乱数」ブロックに変わって残らない。
- **エラーの文**: 「`「{ SOURCE }」は命令がまちがっています。`」（`wrongInstruction`）。`SOURCE` は、式がほかの式の中にあっても、その式を含む 1 行の文（`_sourceNodeForError`）。
- **値だけの行**: 数・文字列・配列だけの行は代入に変える（→ P18）。シンボルだけの行は「命令ではない」エラー。それ以外の値だけの行は `couldNotConvertPrimitive`。
- **特別な文で知らせるもの**: シンボルの計算・比べる（P7）、配列・ハッシュのリテラルへのメソッド（P4・P5）、戻り値（P2）、変数とリストの名前（P4）、変数の種類（P15）、class / module（P6）、`with_screen_refresh` の場所、v1 で使えない構文など。メッセージは `converter-errors.js` と各変換器ファイルの `defineMessages`、日本語は `src/locales/ja.js`。
- **ブロックにできない構文の例**: `for`、`break` / `next` / `redo` / `retry`、`rescue` / `ensure`、`alias` / `undef` / `BEGIN` / `END`、`||=` / `&&=`、文字列の式展開 `"#{@a}"`、`private` など。一覧は言語仕様の「サポートされていないRuby構文」。

**往復の例**: なし（エラーになり、ブロックは作られない）。

```ruby
foo.bar(1)
```

- エラー: 「「foo.bar(1)」は命令がまちがっています。」

**テスト**: `ruby-to-blocks-converter/error-message-hints.test.js`、`nested-error-statement.test.js`、`orphan-blocks.test.js`、`visibility-modifiers.test.js`、`ruby.test.js`、`ruby-roundtrip/break-next-redo-retry.test.js`、`begin-rescue.test.js`、`multiple-assignment.test.js`。

### P18. 値だけの行（素のリテラル）を代入に変える

**Ruby で書きたいこと**: 文字列や数だけの行（`"Jimmy"`、`42`、`[1, 2]`）。Ruby では何もしないが、書いてあれば消えないようにしたい。

**Scratch での表し方**: 「何もしない値」のブロックは無いので、変数 `__lit_<番号>__1_` への代入にする（内部の名前 `_lit_<番号>_` がローカル変数の名前の形に変わるため、両側に `_` が 2 つ付く）。注釈は `@ruby:literal:string` / `integer` / `float`。配列はリスト `__lit_<番号>__1_` の「すべて削除」（`@ruby:literal:array`）と「追加する」。生成器は値だけを書く。

**往復の例**:

```ruby
"Jimmy"
42
[1, 2]
```

- 同じコードに戻る。

**できないこと**: シンボルだけの行はエラー（P17）。配列だけの行の要素は数・文字列（式展開の文字列は除く）・値のブロック（`[@x, 1 + 2]`）だけで、ほかの要素（`[(@a = 1)]`、`[:a]`、`[nil]`）はその行の「命令がまちがっています」のエラー。

**テスト**: `ruby-to-blocks-converter/index.test.js`、`ruby-to-blocks-converter/orphan-blocks.test.js`、`ruby-to-blocks-converter/literal-element-not-a-value.test.js`。

## 注釈 `@ruby:*` の一覧（仕様）

「書く」はその注釈を作るところ、「読む」は使うところ。変換器・生成器は `packages/scratch-gui/src/lib/` の `ruby-to-blocks-converter/` と `ruby-generator/` のこと。

| 種類 | 形 | 書く | 読む | 例 | パターン |
|---|---|---|---|---|---|
| `@ruby:lvar` | `@ruby:lvar:<名前>:<番号>` | 変換器 `variables.js` / `variable-hash-ops.js` / `smalruby-ruby.js` | 生成器 `data.js` / `data-list.js` / `variables.js` | `@ruby:lvar:a:1` | P1 |
| `@ruby:return` | `@ruby:return:<メソッド>`、`:<番号>`（控え）、`:initialize`（初期化） | 変換器 `my-blocks.js` / `ast-handlers/expressions.js` | 生成器 `data.js` / `procedure.js` / `control.js`、変換器 `index.js`（`ruby_*` を残してよいか） | `@ruby:return:foo:1` | P2 |
| `@ruby:return-bare` | `,@ruby:return-bare`（`@ruby:return` に足す） | 変換器 `expressions.js` | 生成器 `data.js` | `return` | P2 |
| `@ruby:return-paren` | `,@ruby:return-paren` | 変換器 `expressions.js` | 生成器 `data.js` | `return (x + 1)` | P2 |
| `@ruby:nil` | `@ruby:nil`（`@ruby:return` に足す） | 変換器 `my-blocks.js` / `expressions.js` | 生成器 `data.js` | `return nil` | P2・P9 |
| `@ruby:array` | `literal:<個数>` / `literal:element` / `index` / `delete_at:last`（読むだけ: `delete_at:random` / `insert:last` / `insert:random`） | 変換器 `variables.js` / `variable-list-ops.js` / `variable-hash-ops.js` / `operators.js` | 生成器 `data-list.js` / `operators.js` / `operators-math-gen.js` | `@ruby:array:literal:3` | P4 |
| `@ruby:list_ref` | `@ruby:list_ref:KEYS\|VALUES:<リストの ID>:<名前>` | 変換器 `smalruby-ruby.js` | VM `scratch-vm/src/extensions/smalruby_ruby/block-method-executors.js` | `@ruby:list_ref:KEYS:abc:_hash_h_keys_` | P13 |
| `@ruby:hash` | `literal:<組の数>` / `literal:values` / `literal:key:sym\|str` / `literal:value` / `get:sym\|str` / `set:sym\|str` / `set:delete:key` / `set:push:key` / `set:push:value` / `length` / `key?[:sym\|:str]` | 変換器 `variables.js` / `variable-hash-ops.js` / `variable-list-ops.js` | 生成器 `data-list.js` | `@ruby:hash:get:sym` | P5 |
| `@ruby:class` | `@ruby:class` / `@ruby:class:<部分>,...`（`<=親`・`name=`・属性名・`attr_accessor=a+b`・`include=M`） | 変換器 `class-visitor.js`（スプライトのコメント） | 生成器 `index.js` / `class-wrapper.js` / `code-finisher.js`、GUI `settings-menu.jsx` / `mobile-drawer.jsx` | `@ruby:class:<=//Smalruby3/Sprite,name=Cat` | P6 |
| `@ruby:initialize` | `@ruby:initialize:args=(<引数>),super` / `super=(<引数>)` / `attr=<名前>+<名前>`（initialize で値を入れた attr_accessor の変数） | 変換器 `initialize-handler.js`（スプライトのコメント） | 生成器 `class-wrapper.js` / `code-finisher.js` | `@ruby:initialize:args=(a),super` | P6 |
| `@ruby:module_source` | `@ruby:module_source:<module>`、`:super_of:<元の名前>` | 変換器 `class-visitor.js` | 生成器 `procedure.js`、`src/lib/module-sync.js`、変換器 `module-visitor.js`、GUI `settings-menu.jsx` / `mobile-drawer.jsx` | `@ruby:module_source:Walk` | P6 |
| `@ruby:module` | `<利用者の文>\n@ruby:module:<module>` | 変換器 `comment-handler.js`（スプライトのコメント） | 生成器 `code-finisher.js` | `@ruby:module:Walk` | P6・P14 |
| `@ruby:super` | `@ruby:super` / `@ruby:super:forwarding`（値なら `,@ruby:return:<名前>`） | 変換器 `ast-handlers/expressions.js` | 生成器 `procedure.js` / `control.js` | `@ruby:super:forwarding` | P6 |
| `@ruby:symbol` | `@ruby:symbol:<名前>` / `@ruby:symbol:var` | 変換器 `variable-utils.js` / `looks.js` / `operators.js` / `my-blocks.js` / `expressions.js` | 生成器 `looks.js` / `operators.js` / `data.js` / `data-list.js`、変換器 `node-type-checks.js` | `@ruby:symbol:hello` | P7 |
| `@ruby:regexp` | `@ruby:regexp:literal` | 変換器 `variables.js` | 生成器 `data.js` | `@ruby:regexp:literal` | P8 |
| `@ruby:literal` | `true:<番号>` / `false:<番号>` / `string` / `integer` / `float` / `array` | 変換器 `ast-handlers/expressions-literals.js` / `index.js` | 生成器 `operators.js` / `data.js` / `data-list.js`、変換器 `node-type-checks.js` / `block-utils.js` | `@ruby:literal:true:1` | P9・P18 |
| `@ruby:variable_condition` | `@ruby:variable_condition` | 変換器 `node-utils.js` | 生成器 `operators.js` | `if @f` | P9 |
| `@ruby:operator` | `>=:<番号>` / `<=:<番号>` / `!=:<番号>` / `=~:<番号>[:receiver]` / `!~:<番号>[:receiver]` / `+=` / `-=` | 変換器 `operators.js` / `motion.js` | 生成器 `operators.js` / `motion.js` | `@ruby:operator:>=:1` | P8・P10 |
| `@ruby:unary_minus` | `@ruby:unary_minus` | 変換器 `operators-math.js` | 生成器 `operators-math-gen.js` | `-@a` | P10 |
| `@ruby:method` | `@ruby:method:<名前>`（`puts` / `print` / `p` / `gets` / `clone` / `wait` / `with_screen_refresh` / `to_s` / `to_i`）、`@ruby:method:empty?:<番号>` | 変換器 `looks.js` / `sensing.js` / `control.js` / `operators.js` / `variable-list-ops.js` | 生成器 `looks.js` / `sensing.js` / `control.js` / `operators.js` / `operators-math-gen.js` / `data-list.js`、変換器 `node-utils.js`（型の推定） | `@ruby:method:puts` | P10・P11 |
| `@ruby:argument` | `@ruby:argument:1:type:Integer\|Float` | 変換器 `looks.js` | 生成器 `looks.js` | `puts(1)` | P11 |
| `@ruby:syntax` | `+=` / `-=` / `*=` / `/=` / `%=` / `elsif:<番号>` / `if_modifier` / `unless` / `unless_else` / `unless_modifier` / `case:<式>:<番号>` / `while` / `wait_until` / `begin_end` / `return` | 変換器 `variables.js` / `ast-handlers/control-flow.js` / `expressions.js` | 生成器 `data.js` / `control.js` / `scrub.js`、変換器 `my-blocks.js` | `@ruby:syntax:elsif:1` | P2・P12 |
| `@ruby:loop_condition_call` | `@ruby:loop_condition_call` | 変換器 `ast-handlers/control-flow.js` | 生成器 `scrub.js` | `while bar(@a) < 3` | P12 |
| `@ruby:begin_loop_body` | `,@ruby:begin_loop_body`（ほかの注釈に足す） | 変換器 `ast-handlers/control-flow.js` | 生成器 `scrub.js` | `begin ... end while` | P12 |
| `@ruby:block_param` | `@ruby:block_param:<番号>:<名前>`（1 行に 1 つ） | 変換器 `smalruby-ruby.js` / `control.js` | 生成器 `smalruby-ruby.js` | `@ruby:block_param:1:i` | P13 |
| `@ruby:comment_position` | `<利用者の文>\n@ruby:comment_position:inline`、`<前の文>\n<うしろの文>\n@ruby:comment_position:inline:last` | 変換器 `comment-handler.js` | 生成器 `scrub.js`、`src/lib/scratch-blocks-comment-icon-patch.js` | `move(10) # ...` | P14 |

- すべての注釈を読むところ: `src/lib/ruby-markers.js`（ブロックの注釈を読むただ 1 つの関数。生成器・`module-sync.js`・`settings-menu.jsx`・`mobile-drawer.jsx` の「読む」はみなこれを通す。スプライトのコメントの `@ruby:class` / `@ruby:initialize` / `@ruby:module` は生成器がコメント全体の形で読む）、`src/lib/scratch-blocks-comment-icon-patch.js`（注釈だけのコメントのアイコンを隠す）、生成器 `scrub.js`（`#` のコメントから `@ruby:` の行を捨てる）、`scratch-vm/src/engine/comment.js`（注釈のコメントの位置）。
- 一覧がそろっているかは `grep -rhoE "@ruby:[a-z_?-]+" packages/scratch-gui/src packages/scratch-vm/src | sort -u` で確かめる。

## 表のテスト（ブロックの短い記法）

パターンの往復は、ブロックと Ruby を 1 行ずつ並べた表で確かめる。1 行から「ブロック → Ruby」（生成）・「Ruby → ブロック」（変換）・往復の 3 つのテストができるので、新しい形は **先に表に 1 行足して落ちるのを見てから** 変換器・生成器を書く（手順は `.claude/rules/scratch-gui/testing.md` の「新しい opcode はブロック ⇔ Ruby の表から」）。

```js
// packages/scratch-gui/test/unit/lib/ruby-roundtrip/motion-table.test.js
defineBlockRubyTable('Motion blocks ⇔ Ruby', [
    { blocks: 'motion_movesteps(STEPS: 10)', ruby: 'move(10)' },
    { blocks: 'motion_turnright(DEGREES: 10) #"@ruby:operator:+="', ruby: 'self.direction += 10' },
    { blocks: 'data_setvariableto(VARIABLE = @_a_1_, VALUE: "1") #"@ruby:lvar:a:1"', ruby: 'a = 1' },
]);
```

記法の要点（全部は `packages/scratch-gui/test/unit/helpers/block-notation.js` の冒頭）:

| 書き方 | 意味 |
|---|---|
| `opcode(NAME: 値)` | 入力。値はブロック、数（`10`）、文字列（`"hi"`）、変数（`$x` / `@x`） |
| `opcode(NAME = 値)` | フィールド（メニューの値・変数・リスト・メッセージ） |
| `opcode(...) { ... } { ... }` | C 型のブロックの中身（`SUBSTACK`、`SUBSTACK2` の順。`{}` は空） |
| `#"@ruby:..."` | 直前のブロックのコメント（注釈）。行の頭だけに書くとスプライトのコメント |
| `$x` / `@x` | ステージの変数 / スプライトの変数（ローカル変数 `a` は `@_a_1_` と `@ruby:lvar`） |
| 改行・`;` / 空行 | 同じスクリプトの次の文 / 次のスクリプト |
| `math_angle(90)` / `text("hi")` | opcode まで比べる数・文字列（素の `10` はどの `math_*` とも一致） |
| `noshadow <ブロック>` / `shadow <ブロック>` | 影かどうかがふつうと違うブロック（メニュー・数・文字列はふつう影） |

比べないもの: ID、位置、ブロックの後ろに隠れた影、素の数の影の opcode の違い（`math_number` と `math_whole_number` など）。どのスクリプトからもつながらないブロックや、無い変数を指すフィールドがあると、変換の側のテストはその理由で落ちる。カスタムブロック（mutation を持つブロック）とエラーになる形は、いまは `test/helpers/expect-to-equal-blocks.js` で書く。

## 新しい橋渡しパターンを足すときのチェックリスト

- [ ] **先にこの文書を読む**。似たパターンがあれば同じ形（名前・注釈・番号の付け方）にそろえる。
- [ ] **変換器と生成器を対にする**。注釈を書くなら、それを読む生成器を同じ変更で足す。片方だけだと往復が壊れる（`.claude/rules/scratch-gui/ruby-mode.md` の「converter ⇔ generator の対称性」）。
- [ ] **注釈の名前**: `@ruby:<種類>:<値>`。既存の種類に入るなら新しい種類を作らない（例: 演算子は `@ruby:operator`、メソッドは `@ruby:method`、構文は `@ruby:syntax`）。同じ形が 1 つのスプライトに何度も出て区別が要るなら `:<番号>` を付ける。
- [ ] **読む側は `ruby-markers.js` を通す**。コメントの先頭に利用者の文が来ることがあり、ほかの注釈が `,` や空白で続くこともある。生成器は `getCommentText` の文字列を `===` / `startsWith` / `split` で直接読まず、`hasRubyMarker` / `rubyMarkerValue` などで読む（→「[読み方（生成器）](#読み方生成器)」）。表のテストに利用者のコメント付きの行も足す。
- [ ] **形が変わったら注釈を使わない**。利用者がブロックを書きかえたときは、ふつうのブロックとして書く（P2 の `nil`、P10 の `>=` のように、注釈を付けたときの値と比べる）。
- [ ] **名前を予約するなら**: 利用者の名前とぶつからない形にし、この文書の「変換器が使う名前」に足す。変換器と生成器で同じ正規表現を 2 か所に持つときは両方を直す。
- [ ] **できない形はその行のエラーにする**。`ruby_*` のブロックを残さない（P17）。黙って消さない。メッセージは英語と `src/locales/ja.js` の日本語の両方。
- [ ] **テスト**: 先に表（`test/unit/lib/ruby-roundtrip/*-table.test.js`、→「[表のテスト](#表のテストブロックの短い記法)」）に 1 行足し、落ちるのを見てから実装する。表で書けないもの（mutation を持つブロック）は往復（`test/unit/lib/ruby-roundtrip/`）と、変換器・生成器それぞれ（`test/unit/lib/ruby-to-blocks-converter/`・`ruby-generator/`）。エラーになる形もテストにする。
- [ ] **この文書を直す**: パターンを足す・変える・注釈を増やしたら、該当するパターンと「注釈の一覧」を直す。書けることが変わったら言語仕様（`docs/smalruby-language-spec.ja.md`）も直す。不具合を直したときも、考慮漏れだった点をパターンの「できないこと」や説明に足す。

## 日本語モード側の橋渡し

日本語モード（DNCL）⇔ Ruby の変換の工夫は、日本語モードの見直しのときにここへ足す（方針は [`docs/dncl/policy.md`](../dncl/policy.md)）。いまわかっている名前の決まりは次のとおり。

| 日本語モード | Ruby | 決めているところ |
|---|---|---|
| 小文字で始まる名前 `x` | `@x` | `src/lib/dncl/dncl-state.js` の `mapVarName` |
| 大文字で始まり、配列として使う名前 `Data` | `@_array_Data_` | 同上 |
| 大文字で始まる、それ以外の名前 `Kosu` | `@_var_Kosu_` | 同上 |

Ruby から日本語モードに戻すときは `src/lib/dncl/ruby-to-dncl-identifier.js` が元の名前に戻す。

## License

The documentation is under the same license as the repository.
