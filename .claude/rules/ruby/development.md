---
paths:
  - "ruby/smalruby3/**/*.rb"
  - "ruby/smalruby3/Gemfile"
  - "ruby/smalruby3/Rakefile"
  - "ruby/smalruby3/smalruby3.gemspec"
---

# smalruby3 gem Development

## Overview

smalruby3 は scratch-vm の Ruby 実装。smalruby3-editor で生成した Ruby スクリプトをデスクトップでネイティブ実行する。

## Tech Stack

- **Ruby**: 3.3+ (`rbenv local 3.3.9` が設定済み)
- **SDL2**: ruby-sdl2 gem (0.3.6) + rsdl (macOS)
- **並行実行**: Thread + Mutex + Fiber
  - メインスレッド: SDL2 イベントループ + 描画
  - 各スクリプト: Fiber で実行、`Fiber.yield` でフレーム同期
  - `loop do...end` は自動 `Fiber.yield`（Scratch 互換）
  - `N.times(screen_refresh: true) do...end` で自動 `Fiber.yield`

## Commands

### Run Tests

```bash
cd ruby/smalruby3
ruby -Ilib -Itest -e 'Dir["test/**/*_test.rb"].each { |f| require_relative f }'
```

個別テスト:

```bash
ruby -Ilib -Itest test/sprite_test.rb
```

### Run Examples

macOS では `rsdl` コマンド経由で実行する（GC/SDL2 メインスレッド問題の回避）:

```bash
cd ruby/smalruby3
rsdl -Ilib examples/01_move.rb
```

**CRITICAL**: `ruby` コマンドでは SDL2 が segfault する。必ず `rsdl` を使うこと。

### Lint (Standard Ruby)

```bash
cd ruby/smalruby3
bundle exec standardrb
bundle exec standardrb --fix  # 自動修正
```

## Coding Conventions

### Style: Standard Ruby (standardrb)

- **Linter**: [Standard Ruby](https://github.com/standardrb/standard) に従う
- **CI**: `.github/workflows/ci-ruby.yml` で `ruby/**` 変更時に自動実行
- **コミット前に必ず `bundle exec standardrb` を実行して 0 violations であること**
- 自動修正: `bundle exec standardrb --fix`（安全な修正のみ）
- 強制修正: `bundle exec standardrb --fix-unsafely`（動作確認が必要）

### ファイルサイズ

- **1 ファイルは 250 行以下** にすること
- 超過する場合はクラス/モジュールを分割する
- テストファイルも同様（テスト対象を分割してファイルを分ける）

### 主要なルール

- ダブルクォート `"string"` を使用（シングルクォート不可）
- セミコロン不使用
- 末尾カンマなし
- `frozen_string_literal: true` を各ファイル先頭に記載
- インデント: 2 スペース
- 1 行の最大長: 120 文字（Standard Ruby デフォルト）
- `rescue` modifier は使わない → `begin ... rescue ... end` を使う
- `$stderr.puts` は使わない → `warn` を使う
- `[[val, min].max, max_val].min` は使わない → `val.clamp(min, max_val)` を使う
- `a >= min && a <= max` は使わない → `a.between?(min, max)` を使う
- float の `==` / `!=` 比較は使わない → `(a - b).abs < Float::EPSILON` を使う
- trivial な getter は `def foo; @foo; end` ではなく `attr_reader :foo` を使う
- 三項演算子の複雑な条件にはカッコを付ける
- `case ... end` の `end` は `case` の行頭に揃える（代入時も同様）
- `if ... end` の代入: `x = if cond` の `else`/`end` は `x` ではなく `if` に揃える

### 負の数リテラルの注意

メソッド引数に負の数リテラルを渡す場合、カッコが必要:

```ruby
# NG: Lint/AmbiguousOperator
set_y -50

# OK
set_y(-50)
```

### Naming

- **ファイル**: snake_case (`sprite.rb`, `bitmap_skin.rb`)
- **クラス**: PascalCase (`Sprite`, `BitmapSkin`, `EffectTransform`)
- **メソッド/変数**: snake_case (`move_steps`, `rotation_center_x`)
- **定数**: UPPER_SNAKE_CASE (`STAGE_WIDTH`, `MAX_CLONES`, `FPS`)
- **モジュール**: PascalCase (`Smalruby3::Render`, `Smalruby3::IO`)

### Directory Structure

```
ruby/smalruby3/
├── lib/smalruby3/
│   ├── render/      # SDL2 描画 (Renderer, Drawable, Skin, Silhouette, Collision)
│   ├── io/          # 入出力 (Keyboard, Mouse, Clock)
│   └── extension/   # 拡張機能 (Pen, Music)
├── test/            # minitest
├── examples/        # サンプルプログラム
└── assets/          # テスト用アセット
```

## TDD (Test-Driven Development)

1. **RED**: 失敗するテストを先に書く
2. **GREEN**: テストが通る最小実装
3. **REFACTOR**: テストを維持しながらリファクタリング

- テストフレームワーク: **minitest**
- SDL2 依存のテスト: モックを使用（SDL2 は rsdl 経由でないと動作しない）
- テストファイル: `test/**/*_test.rb`

## Performance Requirements

### 30 FPS (33.33ms per frame)

- フレームレート: **30 FPS**（Scratch 互換モード相当）
- フレーム時間: **33.33ms**
- WORK_TIME: フレーム時間の **75%** (25ms) をスクリプト実行に配分
- 残り 25% を描画 + イベント処理に使用

### Pixel Collision Budget

- 480×360 全ピクセル走査: **10.9ms** (計測済み、60fps でも余裕)
- `Surface.pixels` の `getbyte` でアルファチャンネルを直接参照
- Silhouette キャッシュ: コスチュームごとに 1 回だけ生成

### Rendering

- SDL2 Metal レンダラー（macOS）でハードウェアアクセラレーション
- テクスチャキャッシュ: コスチュームパスをキーにしてテクスチャを再利用
- ghost エフェクト: `Texture#alpha_mod` で GPU 処理（Surface 操作不要）
- エフェクト適用済み Surface: effects hash が変わったときだけ再生成

## Security Requirements

新しいコードを書く際・レビューする際は、以下のチェックリストを必ず確認すること。

### チェックリスト

1. **Path traversal**: 外部由来の値（カタログ JSON、ユーザー DSL）からファイルパスを構築する箇所では:
   - `File.expand_path` 後に期待ディレクトリ配下であることを検証する
   - ファイル名は安全なパターン（`/\A[a-f0-9]+\.[a-z]+\z/` 等）で検証する
   - `../` やスラッシュを含む値は拒否する

2. **Symlink attack**: ファイルを読み書きする前に:
   - `File.symlink?` で symlink でないことを確認する
   - 書き込みは Tempfile + `File.rename` でアトミックに行う（TOCTOU 防止）
   - `File.exist?` → `File.binwrite` のような check-then-act パターンを避ける

3. **HTTP ダウンロード**:
   - **HTTPS のみ** 許可する（`validate_uri!` で URI スキームを検証）
   - リダイレクト先も HTTPS のみ許可する
   - `rawURL` 等のカタログ由来値が絶対 URL の場合は拒否する（`URI.join` バイパス防止）
   - ダウンロードサイズに上限を設ける（`MAX_ASSET_SIZE = 10MB`）
   - タイムアウトを設定する（`open_timeout: 10`, `read_timeout: 30`）

4. **内部状態の保護**:
   - `Target#variable(name)` のように外部から変数名を指定できる API では、内部 ivar（`@runtime`, `@sounds` 等）をブロックリスト（`INTERNAL_IVARS`）で隠蔽する
   - 新しい内部 ivar を追加したら `INTERNAL_IVARS` に追加すること

5. **環境変数由来のパス**:
   - `SMALRUBY3_HOME`, `SMALRUBY3_SCREENSHOT_PATH` 等の env 変数から得たパスに書き込む前に、symlink でないことを確認する

### Asset Loading

- `Smalruby3.home` (デフォルト `~/.smalruby3/`、`SMALRUBY3_HOME` で変更可能) を起点とする
- アセットキャッシュ: `$SMALRUBY3_HOME/cache/assets/` に保存
- アセット解決順序: プリセット → キャッシュ → HTTP ダウンロード
- `md5ext` の検証: `/\A[a-f0-9]+\.(png|svg|wav|mp3|jpg)\z/` のみ許可
- `sprite_name` の検証: `/\A[\w\- ]+\z/` のみ許可

### User Input

- SDL2 イベントはポーリングベース（コールバック注入のリスクなし）
- `ask()` で受け取ったユーザー入力は文字列としてのみ使用（`eval` 禁止）
- ファイル I/O は gem 内部でのアセット読み込みのみ（ユーザースクリプトからの直接 I/O はなし）

### Dependencies

- 依存 gem は最小限に保つ（ruby-sdl2 + rsvg2）
- ネイティブ拡張（SDL2）はシステムライブラリに依存 — バージョン互換性に注意

## Debugging with Screenshots

### SDL2 スクリーンショットキャプチャ

rsdl で起動した SDL2 ウィンドウの描画結果を BMP ファイルとしてキャプチャできる。
**デバッグ時は必ずこの機能を使って画面の状態を確認すること。**

```bash
# N フレーム目のスクリーンショットを保存
SMALRUBY3_SCREENSHOT=3 rsdl -Ilib examples/01_move.rb
# → /tmp/smalruby3_screenshot.bmp

# 保存先を指定
SMALRUBY3_SCREENSHOT=5 SMALRUBY3_SCREENSHOT_PATH=/tmp/debug.bmp rsdl -Ilib examples/01_move.rb
```

### BMP → PNG 変換（Claude Code で確認するため）

Claude Code の Read ツールは BMP を直接表示できないため、PNG に変換する。

```bash
ruby -e '
require "zlib"
bmp = File.binread("/tmp/smalruby3_screenshot.bmp")
offset = bmp[10..13].unpack1("V")
width = bmp[18..21].unpack1("V")
height = bmp[22..25].unpack1("V")
bpp = bmp[28..29].unpack1("v")
row_size = ((bpp * width + 31) / 32) * 4
raw = String.new(encoding: "ASCII-8BIT")
(height - 1).downto(0) do |y|
  raw << "\x00".b
  width.times do |x|
    pos = offset + y * row_size + x * (bpp / 8)
    b = bmp.getbyte(pos); g = bmp.getbyte(pos + 1); r = bmp.getbyte(pos + 2)
    a = bpp == 32 ? bmp.getbyte(pos + 3) : 255
    raw << [r, g, b, a].pack("C4")
  end
end
def png_chunk(type, data)
  [data.length].pack("N") + type.b + data + [Zlib.crc32(type.b + data)].pack("N")
end
ihdr = [width, height, 8, 6, 0, 0, 0].pack("NNCCCCC")
idat = Zlib::Deflate.deflate(raw)
png = "\x89PNG\r\n\x1A\n".b
png << png_chunk("IHDR", ihdr)
png << png_chunk("IDAT", idat)
png << png_chunk("IEND", "".b)
File.binwrite("/tmp/smalruby3_screenshot.png", png)
'
```

その後 Read ツールで `/tmp/smalruby3_screenshot.png` を開いて確認する。

### 実装の注意点

- `Surface.pixels` は**毎回コピーを返す**ため、書き込みに使えない
- Surface への描画は `Surface.blit(src, srcrect, dst, dstrect)` を使う
- 白い Surface の生成は `Surface.from_string(white_data, w, h, 32)` を使う
- `Surface.save_bmp(surface, path)` はクラスメソッド

### デバッグ手順

1. `SMALRUBY3_SCREENSHOT=N` でスクリーンショットを取得
2. BMP → PNG 変換
3. Read ツールで PNG を確認
4. 問題があればコードを修正して再度スクリーンショット

## Architecture Notes

### Scratch Coordinate System

- 原点: ステージ中央 (0, 0)
- X: -240（左）〜 +240（右）
- Y: -180（下）〜 +180（上）
- SDL2 座標への変換: `screen_x = 240 + scratch_x`, `screen_y = 180 - scratch_y`

### Event System

- Hat ブロック: `when_flag_clicked`, `when_key_pressed`, `when_receive` 等
- `restartExistingThreads`: green flag は既存スレッドを再起動
- `edgeActivated`: `when_greater_than` は閾値を超えた瞬間のみ発火
- `broadcast_and_wait`: 全起動 Fiber が完了するまで yield

### Clone System

- 上限: **300 クローン**
- 共有: blocks（コスチューム配列）、sounds
- コピー: 位置、方向、サイズ、エフェクト、変数
- `when_start_as_a_clone` はクローン対象の Fiber のみ起動
