# smalruby3 gem の拡張機能

scratch-vm の拡張機能のうち、smalruby3 gem (Ruby SDL2 ランタイム) で実装されているのは **Pen** と **Music** の 2 つのみ。本ドキュメントでは両者の実装と、新しい拡張機能を追加する方法を解説する。

## Smalruby ランタイム対応の判断基準

scratch-vm 全 22 拡張機能のうち、gem で対応しているのは **2 件のみ**。残り 20 件はブラウザ専用 API (Web Bluetooth, Web Serial, getUserMedia, AppSync 等) に依存しているため対応不可：

| 拡張機能 | gem 対応 | 対応不可の理由 |
|---|---|---|
| Pen | ✅ | SDL2 で描画レイヤー実装可 |
| Music | ✅ | SDL2_mixer で実装可 |
| Video Sensing | ❌ | getUserMedia (ブラウザ専用) |
| Face Sensing | ❌ | TensorFlow.js + getUserMedia |
| Text to Speech | ❌ | AWS Polly (HTTP API、認証込み) |
| Translate | ❌ | Google Translate API |
| Makey Makey | ❌ | USB HID キーボード (ブラウザ独自) |
| micro:bit / micro:bit More | ❌ | Web Bluetooth |
| GdxFor / EV3 / BOOST / WeDo 2.0 | ❌ | Web Bluetooth |
| Mesh v2 | ❌ | AWS AppSync subscription |
| Smalrubot S1 / G2S | ❌ | Web Serial |
| TM2Scratch | ❌ | TensorFlow.js |
| Koshien | ❌ | WebSocket (Smalruby 競技サーバ) |
| Smalruby Ruby | ❌ | （Ruby ランタイム上では Ruby 標準ライブラリで代替可だが gem 拡張としては未実装） |

→ `lib/smalruby3/extension/` 配下に存在するのは `pen.rb` と `music.rb` のみ。

## 拡張機能の登録パターン

```ruby
# lib/smalruby3/extension/pen.rb (抜粋)
module Smalruby3
  module Extension
    class Pen
      def initialize(sprite)
        @sprite = sprite
        @is_down = false
        @color_h = 66.66
        @color_s = 100
        @color_b = 100
        @transparency = 0
        @size = 1
        @last_x = nil
        @last_y = nil
      end

      def down; @is_down = true; end
      def up;   @is_down = false; end
      def down?; @is_down; end

      def on_move(x, y)
        return unless @is_down
        # @sprite.runtime.pen_skin に線を描画
      end

      def clear
        # ペンレイヤー全消去
      end

      # ...
    end
  end
end
```

Sprite クラス側で **遅延インスタンス化**：

```ruby
# lib/smalruby3/sprite.rb (抜粋)
class Sprite < Target
  def pen
    @pen ||= Extension::Pen.new(self)
  end
end
```

→ ペンを使わないスプライトは Pen インスタンスを持たない。

## Pen 拡張

`lib/smalruby3/extension/pen.rb`:

### 状態

| 属性 | デフォルト | 説明 |
|---|---|---|
| `@is_down` | `false` | ペンが下りているか |
| `@color_h` | `66.66` | 色相 (HSB) — Scratch デフォルトの青 |
| `@color_s` | `100` | 彩度 |
| `@color_b` | `100` | 明度 |
| `@transparency` | `0` | 透明度 (0=不透明) |
| `@size` | `1` | 線の太さ (px) |
| `@last_x`, `@last_y` | `nil` | 直前位置 (連続線用) |

### 主要メソッド

| メソッド | 用途 |
|---|---|
| `down` / `up` / `down?` | ペンの上げ下げ |
| `clear` | ペンレイヤー全消去 |
| `stamp` | スプライトの現在見た目をペンレイヤーにスタンプ |
| `set_color(rgb)` / `change_color(amount)` | 色変更 |
| `set_transparency(n)` / `change_transparency(n)` | 透明度変更 |
| `set_size(n)` / `change_size(n)` | 太さ変更 |

### 描画タイミング

`Sprite#x=`, `y=`, `direction=` 等で位置・向きが変わるたびに `@pen&.on_move()` が呼ばれる。down 中なら `@last_x, @last_y` から新位置への線分を **Renderer の pen_skin** (SDL2 の独立した surface レイヤー) に描画。

### ステージとの統合

ペンレイヤーは **背景の上、スプライトの下** に描画される (`Runtime#draw_frame` 参照)。

### 衝突判定

スタンプ済みのペンレイヤーもスプライト衝突判定の対象 (silhouette ベース)。

## Music 拡張

`lib/smalruby3/extension/music.rb`:

### ドラム

`PLAY_DRUM` ブロック (`music.play_drum(drum: 1, beats: 0.25)` 相当) で 18 種類のドラムを再生：

| 番号 | 名称 | release time (ms) |
|---|---|---|
| 1 | スネアドラム | 250 |
| 2 | バスドラム | 250 |
| 3 | サイドスティック | 100 |
| ... | (合計 18 種) | ... |

### 楽器

`SET_INSTRUMENT` で 21 種類の楽器を選択：

| 番号 | 楽器 |
|---|---|
| 1 | ピアノ |
| 2 | エレクトリックピアノ |
| 3 | オルガン |
| 4 | ギター |
| 5 | エレキギター |
| ... | (合計 21 種) |

各楽器は **複数の MIDI ノートのサンプル**を持ち、近いノートを引き伸ばして使う。

### 音符の再生

`music.play_note(note: 60, beats: 0.5)` (60 = C4):

```ruby
# 擬似コード
def play_note(note:, beats:)
  freq = 440 * 2 ** ((note - 69) / 12.0)   # MIDI note → Hz
  closest_sample = find_closest_instrument_sample(note)
  pitch_ratio = freq / closest_sample.freq
  chunk = SDL2::Mixer.load_with_pitch(closest_sample.path, pitch_ratio)
  channel = SDL2::Mixer.play_channel(-1, chunk)
  schedule_release(channel, beats, instrument.release_time)
  wait(beats * (60.0 / @tempo))   # ビート → 秒
end
```

### テンポ

`set_tempo(120)` でテンポ (BPM) を設定。`play_note` の待ち時間に影響。

## 新しい拡張機能を追加する方法

### 1. クラスを `lib/smalruby3/extension/` に作る

```ruby
# lib/smalruby3/extension/my_extension.rb
module Smalruby3
  module Extension
    class MyExtension
      def initialize(sprite_or_stage)
        @target = sprite_or_stage
        # ... 状態の初期化
      end

      def my_block(args)
        # 実装
      end
    end
  end
end
```

### 2. Target / Sprite / Stage に accessor を追加

```ruby
# lib/smalruby3/sprite.rb
class Sprite < Target
  def my_extension
    @my_extension ||= Extension::MyExtension.new(self)
  end
end
```

### 3. Runtime に必要なら統合フック

例: フレーム前処理 (描画前) や後処理 (描画後) が必要なら `Runtime#main_loop` にフックを追加。

例: スプライトがコピーされたとき (clone) に状態を引き継ぐなら `Sprite#clone` で `@my_extension.dup` を呼ぶ。

### 4. テスト追加

`test/my_extension_test.rb` で minitest で書く。SDL2 直接呼び出しは避ける (mock 中心)。

### 5. examples 追加

`examples/XX_my_extension_demo.rb` で動作確認用のサンプルを追加。

### 6. ドキュメント更新

- 本ドキュメント (`docs/smalruby3-gem/extensions.md`) のセクション追加
- 該当 `docs/extension-<name>/README.md` の **Smalruby ランタイム対応** バッジを ✅ に更新

## scratch-vm の拡張機能との対応関係

両者で実装する場合は **同じ DSL / opcode** で書けるようにする。例: pen の場合：

| scratch-vm | smalruby3 gem |
|---|---|
| ブロックパレット: 「ペンを下ろす」 | DSL: `pen.down` |
| opcode: `pen_penDown` | メソッド: `Pen#down` |
| ブロックパレット: 「ペンの色を ... にする」 | DSL: `pen.set_color(rgb)` |
| opcode: `pen_setPenColorToColor` | メソッド: `Pen#set_color(rgb)` |

→ Ruby ↔ Blocks 変換 (scratch-gui の ruby-generator / ruby-to-blocks-converter) でこの対応を維持する必要がある。詳細は [`docs/extension-pen/`](../extension-pen/) や [`docs/extension-music/`](../extension-music/) を参照。

## 関連ドキュメント

- [`README.md`](README.md) — gem 全体ナビゲーション
- [`architecture.md`](architecture.md) — Runtime / Renderer / Fiber / Asset
- [`docs/extension-pen/`](../extension-pen/) — ペン拡張のユーザー視点ドキュメント (Smalruby ランタイム ✅)
- [`docs/extension-music/`](../extension-music/) — 音楽拡張のユーザー視点ドキュメント (Smalruby ランタイム ✅)
- [`docs/scratch-vm/extensions.md`](../scratch-vm/extensions.md) — ブラウザ側 VM の拡張機能の仕組み (対比)
