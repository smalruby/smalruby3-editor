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

## RubyGems 公開

- **gem 名**: `smalruby3`（https://rubygems.org/gems/smalruby3）
- **所有者**: Kouji Takao

### バージョニング: YY.MR.DDR

semantic versioning 互換かつリリース日推測可能な形式:

| フィールド | 意味 | 例 |
|-----------|------|-----|
| `YY` (MAJOR) | 年の下2桁 | `26` = 2026 |
| `MR` (MINOR) | 月 × 10 + 月内リリース番号 | `31` = 3月1回目, `32` = 3月2回目 |
| `DDR` (PATCH) | 日 × 10 + 日内リリース番号 | `291` = 29日1回目, `292` = 29日2回目 |

**例**:
- `26.31.291` — 2026年3月29日、月内1回目、日内1回目
- `26.31.292` — 同日2回目
- `26.32.301` — 3月30日、月内2回目（機能追加）
- `26.41.11` — 4月1日、月内1回目

**CRITICAL**: MINOR を上げても月が変わったことを意味しない。月内の機能リリース回数を表す。

### ライセンス

- **smalruby3 本体**: MIT
- **依存ライブラリ**（LICENSE の Third-Party Notices に記載）:
  - ruby-sdl2: LGPL-3.0（gem 依存、動的リンク）
  - resvg: MPL-2.0（Rust crate、smalruby3_imageutil にコンパイル）
  - rsdl: Ruby's License（smalruby3_launcher の元コード）

### gem ビルド・公開

```bash
# ビルド
cd ruby/smalruby3
gem build smalruby3.gemspec

# 公開
gem push smalruby3-YY.MR.DDR.gem
```

**注意**: `spec.files` は `Dir[...]` で列挙し、`ext/smalruby3_imageutil/target/` を除外する。

## Tech Stack

- **Ruby**: 3.3+ (`rbenv local 3.3.9` が設定済み)
- **SDL2**: ruby-sdl2 gem (0.3.6) + smalruby3 launcher (macOS)
- **並行実行**: Thread + Mutex + Fiber
  - メインスレッド: SDL2 イベントループ + 描画
  - 各スクリプト: Fiber で実行、`Fiber.yield` でフレーム同期
  - `loop do...end` は自動 `Fiber.yield`（Scratch 互換）
  - `N.times(screen_refresh: true) do...end` で自動 `Fiber.yield`

## Execution Environment

### macOS ネイティブ（基本）

**プログラムの実行は macOS ネイティブで行う。** Docker 上では SDL2 の GUI 表示ができないため。

```bash
cd ruby/smalruby3
rake compile  # 初回のみ（ネイティブ拡張ビルド、cargo が必要）
ruby exe/smalruby3 -I../ruby-sdl2 -I../ruby-sdl2/lib -Ilib examples/01_move.rb
```

**CRITICAL**:
- `ruby` コマンドでは SDL2 が segfault する。必ず `smalruby3` ランチャーを使うこと。
- `ruby/ruby-sdl2`（smalruby fork）をビルドして `-I../ruby-sdl2 -I../ruby-sdl2/lib` で読み込む。gem 版の ruby-sdl2 には `read_pixels` 等の smalruby 拡張が含まれない。
- **smalruby3 プログラムは SDL2 ウィンドウを開くため、次の動作確認を行う前に必ず前のプロセスを停止すること。**

### Docker（テスト・CI用）

Docker 環境はテスト実行と CI 用。GUI 表示はできない（ヘッドレス）。

```bash
# テスト実行
docker compose run --rm smalruby3 bundle exec rake test

# lint
docker compose run --rm smalruby3 bundle exec standardrb

# ヘッドレス実行（スクリーンショットで結果確認）
docker compose run --rm -e SMALRUBY3_SCREENSHOT=3 smalruby3 \
  bash -c "timeout 15 ruby -Ilib examples/03_clone.rb"
```

VNC 経由で GUI 確認も可能（macOS の画面共有.app で接続）:

```bash
docker compose run --rm smalruby3-gui ruby -Ilib examples/01_move.rb
# → open vnc://localhost:15900  (password: smalruby)
```

## Commands

### Run Tests

macOS ネイティブ:

```bash
cd ruby/smalruby3
ruby -Ilib -Itest -e 'Dir["test/**/*_test.rb"].each { |f| require_relative f }'
```

個別テスト:

```bash
ruby -Ilib -Itest test/sprite_test.rb
```

Docker:

```bash
docker compose run --rm smalruby3 bundle exec rake test
```

### Run Examples

```bash
cd ruby/smalruby3
ruby exe/smalruby3 -I../ruby-sdl2 -I../ruby-sdl2/lib -Ilib examples/01_move.rb
```

**注意**: 実行するとSDL2ウィンドウが開く。次の動作確認の前に必ずプロセスを停止すること。

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
- SDL2 依存のテスト: モックを使用（SDL2 は smalruby3 ランチャー経由でないと動作しない）
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

- 依存 gem は最小限に保つ（ruby-sdl2 + rb_sys）
- ネイティブ拡張: SDL2（システムライブラリ）+ smalruby3_imageutil（Rust、resvg によるSVG→PNG変換 + PNG保存）

## Debugging with Screenshots

### SDL2 スクリーンショットキャプチャ

SDL2 ウィンドウの描画結果を PNG ファイルとしてキャプチャできる。
**デバッグ時は必ずこの機能を使って画面の状態を確認すること。**

```bash
# N フレーム目のスクリーンショットを保存
SMALRUBY3_SCREENSHOT=3 ruby exe/smalruby3 -I../ruby-sdl2 -I../ruby-sdl2/lib -Ilib examples/01_move.rb
# → /tmp/smalruby3_screenshot.png

# 保存先を指定
SMALRUBY3_SCREENSHOT=5 SMALRUBY3_SCREENSHOT_PATH=/tmp/debug.png ruby exe/smalruby3 -I../ruby-sdl2 -I../ruby-sdl2/lib -Ilib examples/01_move.rb

# Docker でのヘッドレスキャプチャ
docker compose run --rm -e SMALRUBY3_SCREENSHOT=3 smalruby3 \
  bash -c "timeout 15 ruby -Ilib examples/01_move.rb"
```

Read ツールで `/tmp/smalruby3_screenshot.png` を開いて確認する。

### 実装の注意点

- `Surface.pixels` は**毎回コピーを返す**ため、書き込みに使えない
- Surface への描画は `Surface.blit(src, srcrect, dst, dstrect)` を使う
- 白い Surface の生成は `Surface.from_string(white_data, w, h, 32)` を使う
- PNG 保存は Rust 拡張 `Smalruby3::ImageUtil.save_png` を使用（BMP フォールバックあり）

### デバッグ手順

1. `SMALRUBY3_SCREENSHOT=N` でスクリーンショットを取得（PNG 直接保存）
2. Read ツールで PNG を確認
3. 問題があればコードを修正して再度スクリーンショット

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
