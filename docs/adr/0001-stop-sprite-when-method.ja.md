# Stop using self.when, don't use reserve words

- User Story: smalruby/smalruby3-gui#309
- Status: accepted
- Deciders: takaokouji
- Date: 2023-01-02T05:05:45:29+0900

Sorry, this is written in Japanese.

# self.whenからself.を取り除いたRubyの命令を検討する

イベントカテゴリの `フラグが押されたとき` 、 `[スペース▼]キーが押されたとき` などの各種イベントに対応したブロック(以下、イベントブロック)は、`self.when(:flag_clicked) do ~ end` のように Ruby では `Sprite#when` メソッドにマッピングされる。

```ruby
# フラグが押されたとき
self.when(:flag_clicked) do
end

# [スペース▼]キーが押されたとき
self.when(:key_pressed, "space") do
end

# [音量▼] > (10) のとき
self.when(:greater_than, "loudness", 10) do
end
```

`self.when` には次の課題がある。

- Ruby では、publicなメソッドの呼び出しは通常は `self.` を省略するが、`when` は予約語であるため、常に `self.` を記述する必要がある
- Ruby では、予約語をメソッド名に使うことはできるが、それを推奨するといった説明はどこにもない

イベントブロックは多用されるため、これが不自然なものであれば、スモウルビーを通じてRubyの文法を学習するときに問題となることを懸念している。

そこで、イベントブロックから Ruby の命令へのマッピングとして `self.when` ではない別の選択肢を検討する。

## 判断基準や制限

* Rubyの文法を自然に学べること
* Rubyの初学者に受け入れられるように入門書で扱うRubyの文法や仕組みを使うこと
  * 現状の「予約語 when を上書きする」というのは中級者以上を想定したものだと認識している
* ブロックとRubyの相互変換処理の実装が簡単であること
  * 前後の状態に依存したものは実装が大変
* 文字のタイプ数が少ないこと
* 記号のタイプ数が少ないこと
* ブロックの英語表現に似たRubyの命令であること

## 選択肢

* `when_%event_type%(%args%)`
* `When(:%event_type%, %args%)`
* `_when(:%event_type%, %args%)`
* `on(:%event_type%, %args%)`

## 決定

**採用:** `when_%event_type%(%args%)`

```ruby
# フラグが押されたとき
when_flag_clicked do
end

# [スペース▼]キーが押されたとき
when_key_pressed("space") do
end

# [音量▼] > (10) のとき
when_greater_than("loudness", 10) do # 省略形 when_gt(...)
end
```

* `on(:%event_type%, %args%)` と迷った
* 決め手は「メソッド名がブロックの英語表現と類似している」こと
* スモウルビーは、先生やメンターなどの指導者がいない状況でRubyの文法を学ぶことを想定しているため、ブロックを英語(English)表記にするだけでRubyの文法をほとんど学べている、というのは魅力的

## 各選択肢の良い点と悪い点

### `when_%event_type%(%args%)`

```ruby
# フラグが押されたとき
when_flag_clicked do
end

# [スペース▼]キーが押されたとき
when_key_pressed("space") do
end

# [音量▼] > (10) のとき
when_greater_than("loudness", 10) do # 省略形 when_gt(...)
end
```

* `+` 増えた記号が `_` で減った記号が `:` なので+-0
* `+` `self.`分、タイプ数が減る
* `+` メソッド名がブロックの英語表現と類似している
  * ただし、引数まで考慮すると違和感がある。`when [loudness▼] > 10` が `when_greater_than("loudness", 10) do`
* `+` メソッドが分かれるのでRubyからブロックへの変換処理の実装が簡単になる
* `-` メソッドが増える
  * `self.when` の場合は `when` メソッドのみだった

### `When(:%event_type%, %args%)`

```ruby
# フラグが押されたとき
When(:flag_clicked) do
end

# [スペース▼]キーが押されたとき
When(:key_pressed, "space") do
end

# [音量▼] > (10) のとき
When(:greater_than, "loudness", 10) do
end
```

* `+` `self.` を記述しなくてよい
* `+` `self.when` からの変更が少ない
* `-` Ruby にはメソッド名を大文字から始める習慣がないため、Rubyの初学者に誤った知識を与える可能性がある
* `-` Rubyの初学者がまったく動作の異なる予約語 `when` をこの When メソッドだと勘違いして覚えてしまう可能性がある

### `_when(:%event_type%, %args%)`

```ruby
# フラグが押されたとき
_when(:flag_clicked) do
end

# [スペース▼]キーが押されたとき
_when(:key_pressed, "space") do
end

# [音量▼] > (10) のとき
_when(:greater_than, "loudness", 10) do
end
```

* `+` `self.` を記述しなくてよい
* `+` `self.when` からの変更が少ない
* `-` ( `When` と同様に ) Ruby にはメソッド名を `_` から始める習慣がないため、Rubyの初学者に誤った知識を与える可能性がある
* `-` ( `When` と同様に ) Rubyの初学者がまったく動作の異なる予約語 `when` をこの When メソッドだと勘違いして覚えてしまう可能性がある

### `on(:%event_type%, %args%)`

```ruby
# フラグが押されたとき
on(:flag_clicked) do
end

# [スペース▼]キーが押されたとき
on(:key_pressed, "space") do
end

# [音量▼] > (10) のとき
on(:greater_than, "loudness", 10) do
end
```

* `+` `self.` を記述しなくてよい
* `+` `self.when` からの変更が少ない
* `+` `on` はイベントハンドラとして違和感がないメソッド名である
  - Rubyだけでなく各種言語やライブラリでこのような用途として使われているという実績がある
* `+` タイプ数が少ない
* `-` メソッド名がブロックの英語表現とは異なる
  * ブロックの英語表現は、 `when :flags: clicked` 、 `when [loudness▼] > 10` など。
