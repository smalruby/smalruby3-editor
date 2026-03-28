# Smalruby 言語仕様 — Version 1 API との差分

このドキュメントは、Version 1 と Version 2 の API の違いを説明します。
メインの仕様書は Version 2 をデフォルトとしています。Version 1 を使用している場合はこのドキュメントを参照してください。

- English version: [smalruby-language-spec-v1-diff.md](./smalruby-language-spec-v1-diff.md)
- コア言語仕様（v2）: [smalruby-language-spec.ja.md](./smalruby-language-spec.ja.md)
- 拡張機能メソッド（v2）: [smalruby-language-spec-extensions.ja.md](./smalruby-language-spec-extensions.ja.md)

## Version 1 では使用できない機能

以下の機能は **Version 2 のみ** で利用できます:

- `module` / `include` — メソッドを複数のスプライトで共有
- `super` — モジュールのメソッドをオーバーライドしたクラスメソッドから呼び出す
- ファイル保存時の `class Stage` 自動補完

## リスト（データ）

| 機能 | Version 2 | Version 1 |
|---|---|---|
| リスト参照 | `@items.push(...)` （配列を直接操作） | `list("@items").push(...)` （ラッパー関数） |
| インデックス | 0起点: `@items[0]` | 1起点: `list("@items")[1]` |
| 初期化 | `@items = [1, 2, 3]` （配列リテラル） | 使用不可 |
| ハッシュ | `$a[:key]`, `$a["key"]` | 使用不可 |
| 空チェック | `@items.empty?` | 使用不可 |

## 調べる（Sensing）

| 機能 | Version 2 | Version 1 |
|---|---|---|
| キーが押されているか | `keyboard.pressed?("space")` | `Keyboard.pressed?("space")` |
| マウスが押されているか | `mouse.down?` | `Mouse.down?` |
| マウスのX座標 | `mouse.x` | `Mouse.x` |
| マウスのY座標 | `mouse.y` | `Mouse.y` |
| タイマーの値 | `timer.value` | `Timer.value` |
| タイマーをリセット | `timer.reset` | `Timer.reset` |

## ペン拡張機能（Pen）

| 機能 | Version 2 | Version 1 |
|---|---|---|
| 全消去 | `pen.clear` | `pen_clear` |
| スタンプ | `pen.stamp` | `pen_stamp` |
| ペンを下ろす | `pen.down` | `pen_down` |
| ペンを上げる | `pen.up` | `pen_up` |
| ペンの色を設定 | `pen.color = "#ff0000"` | `self.pen_color = "#ff0000"` |
| 色パラメータを設定 | `pen.color = 50` | `self.pen_color = 50` |
| 色パラメータを変化 | `pen.color += 10` | `self.pen_color += 10` |
| 彩度を設定 | `pen.saturation = 100` | `self.pen_saturation = 100` |
| 彩度を変化 | `pen.saturation += 10` | `self.pen_saturation += 10` |
| 明るさを設定 | `pen.brightness = 100` | `self.pen_brightness = 100` |
| 明るさを変化 | `pen.brightness += 10` | `self.pen_brightness += 10` |
| 透明度を設定 | `pen.transparency = 50` | `self.pen_transparency = 50` |
| 透明度を変化 | `pen.transparency += 10` | `self.pen_transparency += 10` |
| ペンの太さを設定 | `pen.size = 3` | `self.pen_size = 3` |
| ペンの太さを変化 | `pen.size += 1` | `self.pen_size += 1` |

## 音楽拡張機能（Music）

| 機能 | Version 2 | Version 1 |
|---|---|---|
| ドラムを鳴らす | `music.play_drum(drum: 1, beats: 0.25)` | `play_drum(drum: 1, beats: 0.25)` |
| 休符 | `music.rest(0.25)` | `rest(0.25)` |
| 音符を鳴らす | `music.play_note(note: 60, beats: 0.25)` | `play_note(note: 60, beats: 0.25)` |
| 楽器を設定 | `music.instrument = 1` | `self.instrument = 1` |
| テンポを設定 | `music.tempo = 120` | `self.tempo = 120` |
| テンポを変化 | `music.tempo += 20` | `self.tempo += 20` |
| テンポを取得 | `music.tempo` | `tempo` |

## 翻訳拡張機能（Translate）

| 機能 | Version 2 | Version 1 |
|---|---|---|
| テキストを翻訳 | `translate.call("hello", "ja")` | `translate("hello", "ja")` |
| 閲覧者の言語を取得 | `translate.language` | `language` |

## マイクロビット モア拡張機能（Microbit More）

| 機能 | Version 2 | Version 1 |
|---|---|---|
| LEDパターンを表示 | `microbit.display_pattern(マトリクス)` | `microbit.display(マトリクス)` |

その他のマイクロビット モアのメソッドは、Version 1 と Version 2 で同じです。
