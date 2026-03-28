# Smalruby 言語仕様

このドキュメントは、smalrubyで対応しているRuby構文とメソッドを定義します。
ソースコードの `packages/scratch-gui/src/lib/ruby-to-blocks-converter/`（Ruby→ブロック変換）と `packages/scratch-gui/src/lib/ruby-generator/`（ブロック→Ruby生成）に基づいています。

- English version: [smalruby-language-spec.md](./smalruby-language-spec.md)
- 拡張機能メソッド: [smalruby-language-spec-extensions.ja.md](./smalruby-language-spec-extensions.ja.md)
- Version 1 API との差分: [smalruby-language-spec-v1-diff.ja.md](./smalruby-language-spec-v1-diff.ja.md)

> **注意**: このドキュメントは **Version 2** API をベースに記載しています。Version 1 との差分は [v1 差分](./smalruby-language-spec-v1-diff.ja.md) を参照してください。

## 1. 概要

smalrubyはRubyのサブセットで、MIT Scratch 3.0のビジュアルプログラミングブロックに対応したメソッドを持つ言語です。

**重要**: smalrubyのRubyコードは内部的にScratchブロックに変換されて実行されます。そのため、対応していないRuby構文やメソッドは使用できません。

### 標準Rubyとの主な違い

- クラス定義は限定的（スプライトの設定にのみ使用）
- **`module` と `include` に対応** — `def` メソッドを複数のスプライトで共有可能
- ループは `loop do...end`、`N.times do...end`、`while...end`、`until...end`（`for`/`each` は不可）
- 変数: インスタンス変数（`@score`）、グローバル変数（`$score`）、ローカル変数（`score`）
- 文字列の式展開（`"#{var}"`）は不可
- `require`、`puts`/`print`/`p`、例外処理（`begin/rescue`）は不可
- 複合代入演算子 `+=`, `-=`, `*=`, `/=`, `%=` に対応
- 再帰呼び出しは不可

## 2. プログラム構造

### トップレベル構造

smalrubyのプログラムは、以下の2つの形式で記述できます。

#### 形式1: classなし（推奨・簡易形式）

```ruby
# イベントハンドラとメソッド定義をトップレベルに記述する
# 内部的には class Sprite1 ... end でラップされて処理される

self.rotation_style = "left-right"

when_flag_clicked do
  loop do
    move(10)
    bounce_if_on_edge
  end
end

def my_method(a, b)
  a + b
end
```

#### 形式2: class定義あり

```ruby
class Cat
  # class定義内でのみ使用可能な設定メソッド
  set_name "ネコ"
  set_x 100
  set_y -50

  when_flag_clicked do
    move(10)
  end
end
```

### class定義の制限

- クラス名に名前空間は指定できません（`Foo::Bar` は不可）
- クラス継承 (`class Foo < Bar`) は構文上は許容されますが、親クラスは無視されます
- class定義のトップレベルに置けるのは、**イベントハンドラ**（`when_xxx`）、**メソッド定義**（`def`）、**`include`** のみです

### module定義とinclude

`module` を定義し、`include` でクラスに取り込むことで、メソッドを複数のスプライトで共有できます。

```ruby
module Utils
  def add(a, b)
    a + b
  end

  def greet
    say("hello")
  end
end

class Sprite1
  include Utils

  when_flag_clicked do
    say(add(1, 5))
  end
end
```

別のスプライトでも同じモジュールを `include` して、メソッドを再利用できます。

```ruby
class Sprite2
  include Utils

  when_flag_clicked do
    say(add(10, 20))
  end
end
```

**制限事項**:
- `module` 内に置けるのは **メソッド定義（`def`）のみ** です（変数代入やネストした `module` は不可）
- `module_function` や `extend` は使用できません
- ステージ（`class Stage`）では `module` 定義や `include` は使用できません

### class定義のみで使えるメソッド

以下の `set_xxx` メソッドは **class定義のトップレベルでのみ** 使用できます（イベントハンドラの中では使用できません）。

#### スプライト用（`class Sprite1` / `class Cat` など）

| メソッド | 説明 | デフォルト値 |
|---|---|---|
| `set_name "名前"` | スプライト名を設定 | - |
| `set_sprite "名前"` | スプライトライブラリから読み込み | - |
| `set_x 数値` | X座標を設定 | 0 |
| `set_y 数値` | Y座標を設定 | 0 |
| `set_direction 数値` | 向きを設定 | 90 |
| `set_visible true/false` | 表示/非表示を設定 | true |
| `set_size 数値` | 大きさ(%)を設定 | 100 |
| `set_current_costume 数値` | コスチューム番号を設定 | 0 |
| `set_rotation_style "スタイル"` | 回転スタイルを設定 | "all around" |
| `set_costumes ["名前1", "名前2"]` | コスチュームをライブラリから設定 | - |
| `set_sounds ["名前1", "名前2"]` | 音をライブラリから設定 | - |

#### ステージ用（`class Stage`）

| メソッド | 説明 | デフォルト値 |
|---|---|---|
| `set_name "名前"` | ステージ名を設定 | - |
| `set_current_backdrop 数値` | 現在の背景番号を設定 | 0 |
| `set_backdrops ["名前1", "名前2"]` | 背景をライブラリから設定 | - |
| `set_sounds ["名前1", "名前2"]` | 音をライブラリから設定 | - |

**注意**:
- スプライト用メソッド（`set_x`, `set_y` など）は `class Stage` では使えません。
- ステージ用メソッド（`set_current_backdrop`, `set_backdrops`）はスプライトクラスでは使えません。
- トップレベル（classなし形式）では `set_xxx` は使えませんが、代わりに `self.属性 = 値` 形式で設定を変更できます（例: `self.rotation_style = "left-right"`）。

### ステージのclass定義

ステージは `class Stage` で設定を記述できます。

```ruby
class Stage
  set_current_backdrop 1
  set_backdrops ["Arctic", "Blue Sky"]
  set_sounds ["pop"]

  when_flag_clicked do
    switch_backdrop("Blue Sky")
  end
end
```

**注意**: ステージの `class Stage` が省略された場合、ファイル保存時に自動的に `class Stage ... end` で補完されます。

## 3. 対応しているRuby構文

### リテラル

| 構文 | 例 | 備考 |
|---|---|---|
| 整数 | `42`, `-5`, `0` | |
| 浮動小数点数 | `3.14`, `1.0` | |
| 文字列 | `"hello"`, `"ネコ"` | **ダブルクォートのみ**。式展開(`#{}`)は不可 |
| シンボル | `:symbol` | 限定的な用途（ハッシュのキー等） |
| 配列 | `[1, 2, 3]`, `[x, y]` | `go_to` の座標指定、変数への格納に使用 |
| ハッシュ | `{key: val}` | キーワード引数、ハッシュ変数の格納に使用 |
| 範囲 | `1..10`, `1...10` | `rand()` の引数等に使用 |
| true / false | `true`, `false` | |
| nil | `nil` | |
| 正規表現 | `/^hello/i` | `=~`/`!~` 演算子の引数、変数への代入に使用 |

### 変数

| 種類 | 記法 | 説明 |
|---|---|---|
| インスタンス変数 | `@score` | スプライトの変数（各スプライト固有） |
| グローバル変数 | `$global_score` | ステージの変数（全スプライト共有） |
| ローカル変数 | `score` | ローカルスコープの変数 |

```ruby
# インスタンス変数（スプライトの変数）
@score = 0
@score += 1
@score -= 1
@score *= 2
@score /= 2
@score %= 3

# グローバル変数（ステージの変数）
$high_score = 100

# ローカル変数
count = 0
count += 1

# 文字列変数の結合
@name = "He"
@name += "llo"  # @name は "Hello" になる
```

### 代入演算子

| 演算子 | 例 | 備考 |
|---|---|---|
| `=` | `@score = 10` | 変数に値を代入 |
| `+=` | `@score += 1` | 数値の場合は増加、文字列の場合は結合 |
| `-=` | `@score -= 1` | 変数の値を減少 |
| `*=` | `@score *= 2` | 変数の値を乗算 |
| `/=` | `@score /= 2` | 変数の値を除算 |
| `%=` | `@score %= 3` | 変数の値の剰余 |

### 条件分岐

```ruby
# if文
if x > 10
  say("大きい")
end

# if-else文
if touching?("_edge_")
  bounce_if_on_edge
else
  move(10)
end

# if-elsif-else文
if x > 100
  say("とても大きい")
elsif x > 50
  say("大きい")
else
  say("小さい")
end

# unless文
unless touching?("_edge_")
  move(10)
end

# case-when文
case @direction
when 1
  move(10)
when 2
  turn_right(90)
else
  say("不明")
end

# 修飾子if / unless
move(10) if keyboard.pressed?("space")
say("セーフ") unless touching?("_edge_")
```

### ループ

```ruby
# 永久ループ
loop do
  move(1)
end

# 回数指定ループ
10.times do
  move(10)
  turn_right(36)
end

# 条件ループ（条件が真である限り繰り返す）
i = 0
while i < 5
  move(5)
  i += 1
end

# 条件ループ（条件が真になるまで繰り返す）
until touching?("_edge_")
  move(5)
end
```

**注意**: `for`, `each` ループはサポートされていません。

**重要 — ループの自動1フレーム待機**:
`loop do...end`、`N.times do...end`、`while...end`、`until...end` はすべて、**毎ループ終端で自動的に1フレーム（約33ms、30fps相当）待機**します。
これはScratchのブロック実行モデルに由来する仕様で、CPUを占有しないよう設計されています。

- FPS調整のために `sleep(0.05)` のような小さな値を入れる必要は**ありません**（むしろ動作が遅くなります）
- `sleep` は `sleep(1)` のように意図的に長い待機が必要な場合のみ使ってください

### 論理演算子

| 演算子 | 例 | 備考 |
|---|---|---|
| `&&` / `and` | `a && b` | かつ |
| `\|\|` / `or` | `a \|\| b` | または |
| `!` | `!touching?("_edge_")` | でない |

### 正規表現マッチ演算子

| 演算子 | 例 | 備考 |
|---|---|---|
| `=~` | `"hello" =~ /^he/` | マッチする場合は真 |
| `!~` | `"hello" !~ /world/` | マッチしない場合は真 |

正規表現リテラルは変数に代入することもできます。

```ruby
r = /^hello/i
if @name =~ r
  say("マッチ!")
end
```

**対応するフラグ**: `i`（大文字小文字を無視）、`m`（複数行モード）、`x`（拡張モード）

**注意**: 正規表現の内部的な仕組みとして、`=~`/`!~` は「〇〇に△△が含まれる」ブロック（`operator_contains`）に変換されます。`STRING2` に `/pattern/` 形式の文字列が設定された場合、VMが正規表現として解釈します。

### 比較演算子

| 演算子 | 例 |
|---|---|
| `==` | `@score == 10` |
| `!=` | `@score != 0` |
| `>` | `x > 100` |
| `<` | `x < -100` |
| `>=` | `@score >= 100` |
| `<=` | `timer.value <= 0` |

### 算術演算子

| 演算子 | 例 |
|---|---|
| `+` | `@score + 1` |
| `-` | `x - 10` |
| `*` | `@speed * 2` |
| `/` | `360 / 10` |
| `%` | `@count % 2` |
| `**` | `10 ** 2`（10のn乗） |

### メソッド定義

```ruby
# メソッド定義
def greet(name)
  say(name)
end

# メソッド呼び出し
greet("こんにちは")
```

**制限事項**:
- キーワード引数には対応していません（`def foo(name:)` は不可）
- クラスメソッド（`def self.method`）は定義できません
- `attr_accessor`/`attr_reader`/`attr_writer` は使えません
- メソッドのオーバーロードはできません
- 再帰呼び出しはできません

### 戻り値

```ruby
def add(a, b)
  a + b  # 最後の式が戻り値になる（暗黙の戻り値）
end

def check(x)
  return true if x > 0  # 明示的なreturn
  false
end
```

### super

`module` で定義したメソッドを `class` で `include` し、同名のメソッドでオーバーライドしている場合、`super` でモジュール側のメソッドを呼び出せます。

```ruby
module Utils
  def greet
    say("こんにちは")
  end
end

class Sprite1
  include Utils

  def greet
    super        # Utils の greet を呼ぶ（引数をそのまま渡す）
    say("さようなら")
  end

  when_flag_clicked do
    greet
  end
end
```

`super(引数)` で明示的に引数を渡すこともできます。

```ruby
module Utils
  def add(a, b)
    a + b
  end
end

class Sprite1
  include Utils

  def add(a, b)
    result = super(a, b)  # Utils の add を呼ぶ
    result * 2
  end
end
```

**制限事項**:
- `super` は `def` メソッド内でのみ使用できます
- `include` したモジュールに同名メソッドが存在する必要があります
- ステージ（`class Stage`）では使用できません

## 4. 対応しているメソッド一覧

### 動き（Motion）

| メソッド | 説明 | 例 |
|---|---|---|
| `move(歩数)` | 向いている方向に移動 | `move(10)` |
| `turn_right(度数)` | 右に回転 | `turn_right(15)` |
| `turn_left(度数)` | 左に回転 | `turn_left(15)` |
| `go_to("場所")` | 指定の場所に移動 | `go_to("_mouse_")`, `go_to("_random_")` |
| `go_to([x, y])` | 指定の座標に移動 | `go_to([0, 0])` |
| `glide("場所", secs: 秒数)` | 場所に滑らかに移動 | `glide("_mouse_", secs: 1)` |
| `glide([x, y], secs: 秒数)` | 座標に滑らかに移動 | `glide([100, 50], secs: 2)` |
| `point_towards("対象")` | 対象の方向を向く | `point_towards("_mouse_")` |
| `bounce_if_on_edge` | 端に触れたら跳ね返る | `bounce_if_on_edge` |
| `self.direction = 度数` | 向きを設定 | `self.direction = 90` |
| `self.x = 数値` | X座標を設定 | `self.x = 0` |
| `self.y = 数値` | Y座標を設定 | `self.y = 0` |
| `self.x += 数値` | X座標を変化させる | `self.x += 10` |
| `self.y += 数値` | Y座標を変化させる | `self.y += -10` |
| `self.rotation_style = "スタイル"` | 回転スタイルを設定 | `self.rotation_style = "left-right"` |
| `x` | 現在のX座標を取得 | `x` |
| `y` | 現在のY座標を取得 | `y` |
| `direction` | 現在の向きを取得 | `direction` |

**go_to / point_towards の対象名**:
- `"_mouse_"` — マウスポインター
- `"_random_"` — ランダムな位置

**rotation_style の値**:
- `"all around"` — 自由に回転
- `"left-right"` — 左右のみ
- `"don't rotate"` — 回転しない

### 見た目（Looks）

| メソッド | 説明 | 例 |
|---|---|---|
| `say(メッセージ)` | 吹き出しでメッセージを表示 | `say("こんにちは")` |
| `say(メッセージ, 秒数)` | 秒数だけ吹き出しを表示 | `say("やあ", 2)` |
| `think(メッセージ)` | 考え中の吹き出しを表示 | `think("うーん")` |
| `think(メッセージ, 秒数)` | 秒数だけ考え中の吹き出しを表示 | `think("うーん", 2)` |
| `switch_costume("名前")` | 指定のコスチュームに変更 | `switch_costume("costume2")` |
| `next_costume` | 次のコスチュームに変更 | `next_costume` |
| `switch_backdrop("名前")` | 背景を変更 | `switch_backdrop("backdrop2")` |
| `switch_backdrop_and_wait("名前")` | 背景を変更して完了を待つ | `switch_backdrop_and_wait("backdrop2")` |
| `next_backdrop` | 次の背景に変更 | `next_backdrop` |
| `self.size = パーセント` | 大きさを設定 | `self.size = 200` |
| `self.size += 変化量` | 大きさを変化させる | `self.size += 10` |
| `set_effect("効果名", 値)` | 画像効果を設定 | `set_effect("color", 25)` |
| `change_effect_by("効果名", 変化量)` | 画像効果を変化させる | `change_effect_by("color", 10)` |
| `clear_graphic_effects` | すべての画像効果をクリア | `clear_graphic_effects` |
| `show` | スプライトを表示 | `show` |
| `hide` | スプライトを非表示 | `hide` |
| `go_to_layer("front")` | 最前面に移動 | `go_to_layer("front")` |
| `go_to_layer("back")` | 最背面に移動 | `go_to_layer("back")` |
| `go_layers(数, "forward")` | 前に数レイヤー移動 | `go_layers(1, "forward")` |
| `go_layers(数, "backward")` | 後ろに数レイヤー移動 | `go_layers(1, "backward")` |
| `costume_number` | コスチューム番号を取得 | `costume_number` |
| `costume_name` | コスチューム名を取得 | `costume_name` |
| `backdrop_number` | 背景番号を取得 | `backdrop_number` |
| `backdrop_name` | 背景名を取得 | `backdrop_name` |
| `size` | 大きさ(%)を取得 | `size` |

**画像効果名**: `"color"`, `"fisheye"`, `"whirl"`, `"pixelate"`, `"mosaic"`, `"brightness"`, `"ghost"`

### 音（Sound）

| メソッド | 説明 | 例 |
|---|---|---|
| `play("音の名前")` | 音を再生（待たない） | `play("ニャー")` |
| `play_until_done("音の名前")` | 音が終わるまで待って再生 | `play_until_done("ニャー")` |
| `stop_all_sounds` | すべての音を止める | `stop_all_sounds` |
| `change_sound_effect_by("効果名", 変化量)` | 音の効果を変化させる | `change_sound_effect_by("PITCH", 10)` |
| `set_sound_effect("効果名", 値)` | 音の効果を設定 | `set_sound_effect("PITCH", 100)` |
| `clear_sound_effects` | 音の効果をクリア | `clear_sound_effects` |
| `self.volume = 値` | 音量を設定 | `self.volume = 50` |
| `self.volume += 変化量` | 音量を変化させる | `self.volume += -10` |
| `volume` | 現在の音量を取得 | `volume` |

**音の効果名**: `"PITCH"`, `"PAN"`

### イベント（Events）

| メソッド | 説明 | 例 |
|---|---|---|
| `when_flag_clicked do...end` | 旗が押されたとき | `when_flag_clicked do ... end` |
| `when_key_pressed("キー") do...end` | キーが押されたとき | `when_key_pressed("space") do ... end` |
| `when_clicked do...end` | スプライトがクリックされたとき | `when_clicked do ... end` |
| `when_backdrop_switches("名前") do...end` | 背景が切り替わったとき | `when_backdrop_switches("backdrop2") do ... end` |
| `when_greater_than("種類", 値) do...end` | 値が超えたとき | `when_greater_than("LOUDNESS", 10) do ... end` |
| `when_receive("メッセージ") do...end` | メッセージを受け取ったとき | `when_receive("start") do ... end` |
| `broadcast("メッセージ")` | メッセージを送る | `broadcast("start")` |
| `broadcast_and_wait("メッセージ")` | メッセージを送って待つ | `broadcast_and_wait("start")` |

**キー名**: `"space"`, `"left arrow"`, `"right arrow"`, `"up arrow"`, `"down arrow"`, `"any"`, `"a"`〜`"z"`, `"0"`〜`"9"`

**when_greater_than の種類**: `"LOUDNESS"`, `"TIMER"`

### 制御（Control）

| メソッド | 説明 | 例 |
|---|---|---|
| `sleep(秒数)` | 指定秒数待つ | `sleep(1)` |
| `loop do...end` | ずっと繰り返す | `loop do ... end` |
| `数値.times do...end` | 指定回数繰り返す | `10.times do ... end` |
| `if 条件...end` | もし〜なら | `if x > 0 ... end` |
| `if 条件...else...end` | もし〜でなければ | `if x > 0 ... else ... end` |
| `until 条件 do...end` | 〜まで繰り返す | `until touching?("_edge_") do ... end` |
| `while 条件 do...end` | 〜である間繰り返す | `while @score < 100 ... end` |
| `stop("対象")` | 実行を止める | `stop("all")` |
| `create_clone("対象")` | クローンを作る | `create_clone("_myself_")` |
| `delete_this_clone` | このクローンを削除 | `delete_this_clone` |
| `when_start_as_a_clone do...end` | クローンされたとき | `when_start_as_a_clone do ... end` |

**stop の対象**: `"all"`, `"this script"`, `"other scripts in sprite"`

**create_clone の対象**: `"_myself_"`, スプライト名

### 調べる（Sensing）

| メソッド | 説明 | 例 |
|---|---|---|
| `touching?("対象")` | 対象に触れているか | `touching?("_mouse_")`, `touching?("_edge_")` |
| `touching_color?("色")` | 色に触れているか | `touching_color?("#ff0000")` |
| `color_is_touching_color?("色1", "色2")` | 色が色に触れているか | `color_is_touching_color?("#ff0000", "#00ff00")` |
| `distance("対象")` | 対象までの距離 | `distance("_mouse_")` |
| `ask("質問")` | 質問して答えを待つ | `ask("名前は?")` |
| `answer` | 答えを取得 | `answer` |
| `keyboard.pressed?("キー")` | キーが押されているか | `keyboard.pressed?("space")` |
| `mouse.down?` | マウスが押されているか | `mouse.down?` |
| `mouse.x` | マウスのX座標 | `mouse.x` |
| `mouse.y` | マウスのY座標 | `mouse.y` |
| `self.drag_mode = "モード"` | ドラッグモードを設定 | `self.drag_mode = "draggable"` |
| `loudness` | マイクの音量 | `loudness` |
| `timer.value` | タイマーの値 | `timer.value` |
| `timer.reset` | タイマーをリセット | `timer.reset` |
| `Time.now.year` | 現在の年 | `Time.now.year` |
| `Time.now.month` | 現在の月 | `Time.now.month` |
| `Time.now.day` | 現在の日 | `Time.now.day` |
| `Time.now.hour` | 現在の時 | `Time.now.hour` |
| `Time.now.min` | 現在の分 | `Time.now.min` |
| `Time.now.sec` | 現在の秒 | `Time.now.sec` |
| `Time.now.wday + 1` | 曜日（1=日〜7=土） | `Time.now.wday + 1` |
| `days_since_2000` | 2000年からの日数 | `days_since_2000` |
| `user_name` | ユーザー名 | `user_name` |

**touching? の対象名**:
- `"_mouse_"` — マウスポインター
- `"_edge_"` — 端
- スプライト名 — 他のスプライト

**他のスプライト/ステージの情報を取得する**:

```ruby
sprite("Sprite2").x           # X座標
sprite("Sprite2").y           # Y座標
sprite("Sprite2").direction   # 向き
sprite("Sprite2").costume_number  # コスチューム番号
sprite("Sprite2").costume_name    # コスチューム名
sprite("Sprite2").size        # 大きさ
sprite("Sprite2").volume      # 音量
sprite("Sprite2").variable("@score")  # 変数の値

stage.backdrop_number   # ステージの背景番号
stage.backdrop_name     # ステージの背景名
stage.volume            # ステージの音量
stage.variable("$var")  # ステージの変数の値
```

### 演算（Operators）

| メソッド | 説明 | 例 |
|---|---|---|
| `rand(範囲)` | ランダムな数 | `rand(1..10)` |
| `値.round` | 四捨五入 | `3.7.round` |
| `値.abs` | 絶対値 | `(-5).abs` |
| `値.floor` | 切り捨て | `3.7.floor` |
| `値.ceil` | 切り上げ | `3.2.ceil` |
| `Math.sqrt(数値)` | 平方根 | `Math.sqrt(9)` |
| `Math.sin(数値)` | サイン | `Math.sin(90)` |
| `Math.cos(数値)` | コサイン | `Math.cos(0)` |
| `Math.tan(数値)` | タンジェント | `Math.tan(45)` |
| `Math.asin(数値)` | アークサイン | `Math.asin(1)` |
| `Math.acos(数値)` | アークコサイン | `Math.acos(0)` |
| `Math.atan(数値)` | アークタンジェント | `Math.atan(1)` |
| `Math.log(数値)` | 自然対数 | `Math.log(10)` |
| `Math.log10(数値)` | 常用対数 | `Math.log10(100)` |
| `Math::E ** 数値` | eのn乗 | `Math::E ** 2` |
| `10 ** 数値` | 10のn乗 | `10 ** 3` |
| `文字列.length` | 文字列の長さ | `"hello".length` |
| `文字列.include?(部分文字列)` | 文字列を含むか | `"hello".include?("ell")` |
| `文字列[位置]` | 文字列の文字を取得 | `"hello"[0]` |
| `文字列1 + 文字列2` | 文字列の結合 | `"hello" + " world"` |
| `文字列 =~ /正規表現/` | 正規表現にマッチするか | `"hello" =~ /^he/` |
| `/正規表現/ =~ 文字列` | 正規表現にマッチするか（逆順） | `/^he/ =~ "hello"` |
| `文字列 !~ /正規表現/` | 正規表現にマッチしないか | `"hello" !~ /world/` |
| `/正規表現/ !~ 文字列` | 正規表現にマッチしないか（逆順） | `/world/ !~ "hello"` |

### 変数/リスト（Data）

#### 変数の使用

```ruby
# スプライトの変数（インスタンス変数）
@score = 0
@score += 1      # 増加
@score -= 1      # 減少
@score *= 2      # 乗算
@score /= 2      # 除算
@score %= 3      # 剰余

# ステージの変数（グローバル変数）
$high_score = 100

# ローカル変数
count = 0

# 文字列変数の結合
@greeting = "He"
@greeting += "llo"  # "Hello" になる

# 変数の表示/非表示
show_variable("@score")
hide_variable("@score")
```

#### リスト（配列）の使用

```ruby
# 配列リテラルで初期化
@items = ["りんご", "バナナ", "さくらんぼ"]

# 操作（0起点インデックス）
@items.push("りんご")          # 末尾に追加
@items.delete_at(0)            # インデックス指定で削除（0起点）
@items.delete_at(-1)           # 末尾を削除
@items.clear                   # 全削除
@items.insert(0, "バナナ")     # インデックス指定で挿入（0起点）
@items[0] = "みかん"           # インデックス指定で置換（0起点）
@items[0]                      # インデックス指定で取得（0起点）
@items.index("りんご")         # 検索（0起点のインデックスを返す、見つからない場合は0）
@items.length                  # 長さ
@items.include?("りんご")      # 含むか
@items.empty?                  # 空か
show_list("@items")            # リストの表示
hide_list("@items")            # リストの非表示
```

## 5. サポートされていないRuby構文

以下のRuby構文はsmalrubyでは**使用できません**:

- `for` ループ
- `each` メソッド
- `begin`/`rescue`/`ensure`（例外処理）
- `module_function`, `extend`（`module` と `include` はサポート）
- `require` / `require_relative`
- 文字列の式展開 (`"Hello #{name}"`)
- 多重代入 (`a, b = 1, 2`)
- スプラット引数 (`*args`)
- ブロック引数付きのイテレータ（`each { |x| ... }` など）
- プロック / ラムダ
- `yield`
- `open` / ファイルI/O
- `puts` / `print` / `p`（直接は使えません。代わりに `say()` を使ってください）

## 6. よくある間違い

```ruby
# ❌ set_x / change_x は使えません
set_x(100)
change_x(10)

# ✅ self.x = / self.x += を使います
self.x = 100
self.x += 10
```

```ruby
# ❌ mouse_x / mouse_y は使えません
mouse_x
key_pressed?("space")
timer
reset_timer

# ✅ 正しいメソッド名を使います
mouse.x
keyboard.pressed?("space")
timer.value
timer.reset
```

```ruby
# ❌ "_mouse_pointer_" は正しくありません
touching?("_mouse_pointer_")

# ✅ "_mouse_" を使います
touching?("_mouse_")
```

```ruby
# ❌ glide の引数の順序が違います
glide(1, 100, 50)

# ✅ 座標を配列で、秒数をキーワード引数で渡します
glide([100, 50], secs: 1)
```

```ruby
# ❌ play_sound / stop_sounds は正しくありません
play_sound("ニャー")
stop_sounds

# ✅ 正しいメソッド名を使います
play("ニャー")
stop_all_sounds
```

```ruby
# ❌ set_size / change_size は使えません（class定義外）
set_size(200)
change_size(10)

# ✅ self.size = / self.size += を使います
self.size = 200
self.size += 10
```

```ruby
# ❌ each は使えません
[1, 2, 3].each do |n|
  say(n)
end

# ✅ times を使います
3.times do
  say("hello")
end
```
