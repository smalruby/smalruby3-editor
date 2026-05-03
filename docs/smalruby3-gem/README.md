# smalruby3 gem (Ruby SDL2 デスクトップランタイム)

> **🆕 Smalruby 独自** — scratch-vm の Ruby + SDL2 実装。ブラウザの代わりにネイティブ macOS / Docker (Xvfb) で動かす。

`ruby/smalruby3/` は Smalruby のプロジェクトを **Ruby スクリプトとして実行**できるデスクトップランタイム。Web ブラウザ版 (scratch-vm) と並列に存在し、同じ Smalruby Ruby DSL で書かれたプログラムを SDL2 経由でネイティブ描画する。

## 対象読者

- **smalruby3 gem の保守・改良**を行う開発者
- **scratch-vm 側との挙動差**を埋めたい人 (例: 拡張機能の対応)
- **デスクトップ実行**を試したいユーザー (smalruby コマンド)

## ドキュメント一覧

| ドキュメント | 内容 |
|---|---|
| [`architecture.md`](architecture.md) | Runtime / Renderer / Fiber / Asset / 座標系 |
| [`extensions.md`](extensions.md) | 拡張機能の仕組み (Pen / Music) と新規追加方法 |

外部参照:
- [`ruby/smalruby3/README.md`](../../ruby/smalruby3/README.md) — gem の README (インストール手順)
- [`ruby/smalruby3/docs/ruby-sdl2-api.md`](../../ruby/smalruby3/docs/ruby-sdl2-api.md) — 使用している SDL2 API のリファレンス
- `.claude/rules/ruby/ruby-sdl2.md` — ruby-sdl2 submodule 運用
- `.claude/rules/ruby/rsdl.md` — rsdl ラッパー運用

## ざっくり概要

| 項目 | 値 |
|---|---|
| Ruby バージョン | ≥ 3.3 |
| SDL2 依存 | `ruby-sdl2 ~> 0.3` (smalruby fork、submodule) |
| ステージサイズ | 480 × 360 (Scratch 互換) |
| FPS | 30 (FRAME_TIME = 33.33ms) |
| 最大クローン数 | 300 |
| バージョニング | `YY.MR.DDR` (Year.Month×10+Release.Day×10+Release) |
| ライセンス | MIT (resvg は MPL-2.0、ruby-sdl2 は LGPL-3.0) |

## クイックスタート

```bash
# Docker 実行 (Xvfb で headless、スクリーンショット取得用)
docker compose run --rm smalruby3 bundle exec ruby -Ilib examples/01_move.rb

# macOS ネイティブ実行 (smalruby3_launcher 必須)
cd ruby/smalruby3
bundle install
rake compile           # Rust + Swift 拡張をビルド
exe/smalruby examples/01_move.rb
```

> **重要**: macOS では **`smalruby3_launcher` 経由のネイティブバイナリ**を使う必要がある。素の `ruby` から SDL2 を呼ぶと segfault するため。詳細は [architecture.md - 実行環境](architecture.md#実行環境) 参照。

## DSL 例

`examples/01_move.rb` を抜粋：

```ruby
require "smalruby3"

class Player < Smalruby3::Sprite
  set_sprite "Shimaraby"   # AssetManager 経由でコスチュームをロード
  set_x 0
  set_y 0
  set_size 100

  when_flag_clicked do     # Hat ブロック相当
    say("矢印キーで動かしてね！")
    loop.with_screen_refresh do
      self.x += 5 if keyboard.pressed?("right arrow")
      self.x -= 5 if keyboard.pressed?("left arrow")
      bounce_if_on_edge
    end
  end
end

Smalruby3.start  # イベントループ開始 (省略すると at_exit で自動起動)
```

→ 「Sprite を継承するクラスを定義」「`when_*` ブロックでイベント登録」「`Smalruby3.start` でイベントループ起動」の 3 ステップ。

## 主要ファイル一覧

### lib/smalruby3.rb (エントリポイント)

- `Smalruby3.start()` — Runtime.instance.run を起動
- `Smalruby3.register_sprite(klass)` — Sprite サブクラス登録 (継承時自動)
- `Smalruby3.register_stage(klass)` — Stage シングルトン登録
- `Smalruby3.home()` — キャッシュディレクトリ (`$SMALRUBY3_HOME` または `~/.smalruby3/`)
- `at_exit` フック — `start` 未呼出時に自動起動

### lib/smalruby3/

| ファイル | 役割 |
|---|---|
| `target.rb` | Sprite / Stage の基底。共通の DSL (`say`, `ask`, `variable`, `set_variable` 等) |
| `sprite.rb` | スプライト本体 (位置、向き、サイズ、コスチューム、クローン) |
| `stage.rb` | ステージ (背景、broadcast、`when_backdrop_switches`) |
| `costume.rb` | コスチューム (path、回転中心、bitmap_resolution、SDL2::Surface 遅延ロード) |
| `sound.rb` | サウンド (path、name) |
| `runtime.rb` | イベントループ (Fiber スケジューラ + メインループ) |
| `asset_manager.rb` | コスチューム/サウンドの解決 (preset / cache / HTTP download) |
| `asset_manager/svg_converter.rb` | SVG → PNG 変換 (Rust 拡張呼び出し) |
| `version.rb` | バージョン定数 |

### lib/smalruby3/render/

| ファイル | 役割 |
|---|---|
| `renderer.rb` | SDL2 ウィンドウ + アクセラレーテッドレンダラー (Metal on macOS) |
| `bitmap_skin.rb` | コスチューム描画 |
| `pen_skin.rb` | ペンレイヤー描画 |
| `text_bubble.rb` | say/think の吹き出し |
| `effect_transform.rb` | ghost / whirl 等のエフェクト |

### lib/smalruby3/io/

| ファイル | 役割 |
|---|---|
| `clock.rb` | タイマー |
| `keyboard.rb` | キーボード入力 |
| `mouse.rb` | マウス入力 |

### lib/smalruby3/extension/

| ファイル | 役割 |
|---|---|
| `pen.rb` | ペン拡張 (`@sprite.pen` でアクセス) |
| `music.rb` | 音楽拡張 (ドラム + 21 楽器) |

詳細は [`extensions.md`](extensions.md) を参照。

### ext/

| ディレクトリ | 内容 | 言語 |
|---|---|---|
| `smalruby3_imageutil/` | resvg ベースの SVG → PNG 変換 | Rust |
| `smalruby3_launcher/` | macOS 用 SDL2 ネイティブバイナリ | Swift / Obj-C |

### test/

29 ファイルの **minitest** テストスイート。SDL2 直接呼び出しは segfault リスクがあるため mock 中心。

### examples/

10 個のサンプルプログラム (`01_move.rb`, `03_clone.rb`, `04_pen.rb`, ...)。新規ユーザー向けの DSL 学習資料。

## ruby-sdl2 / rsdl との関係

### ruby-sdl2 (submodule: `ruby/ruby-sdl2/`)

- [smalruby/ruby-sdl2](https://github.com/smalruby/ruby-sdl2) fork
- upstream: [ohai/ruby-sdl2](https://github.com/ohai/ruby-sdl2)
- Smalruby 独自パッチ:
  - **`Renderer#read_pixels`** 追加 (衝突判定の silhouette 用)
  - Ruby 3.4+ の TypedData サポート
- ブランチ: `master` (upstream 同期)、`smalruby/ruby-3.4-support`、`smalruby/add-read-pixels`

### rsdl (submodule: `ruby/rsdl/`)

- [smalruby/rsdl](https://github.com/smalruby/rsdl) fork (CLAUDE.md で言及、本リポジトリの `ruby/` 下にあり)
- upstream: [knu/rsdl](https://github.com/knu/rsdl)
- macOS 用の SDL2 Ruby ラッパーコマンド

### 運用ルール

両 submodule の変更時は **smalruby fork に PR → 動作確認後に upstream にも PR**。upstream PR を想定して機能ごとに細かくブランチ/PR を分けること。詳細は `.claude/rules/ruby/ruby-sdl2.md` と `.claude/rules/ruby/rsdl.md` を参照。

## scratch-vm との対応

| 機能 | scratch-vm | smalruby3 gem |
|---|---|---|
| 標準ブロック (motion / looks / control / sensing 等) | ✅ | ✅ (DSL として) |
| **拡張機能 - pen** | ✅ | ✅ (`Extension::Pen`) |
| **拡張機能 - music** | ✅ | ✅ (`Extension::Music`) |
| 拡張機能 - その他 (mesh, smalrubot-s1, koshien 等) | ✅ | ❌ (ブラウザ専用 API 依存) |
| Ruby ↔ Blocks 相互変換 | ❌ | ❌ (gem 単体は Ruby のみ) |
| ふりがな / DNCL | ❌ | ❌ (Ruby ソース直接実行) |

→ smalruby3 gem は **シンプルな Ruby スクリプト実行**にフォーカス。ブラウザ依存の拡張 (Web Bluetooth, Web Serial, AppSync 等) は対象外。

## 関連 Issue / リポジトリ

- 本 gem は `smalruby/smalruby3` (gem 単体) と `smalruby/smalruby3-editor` (本モノレポの ruby submodule) で並行管理
- 詳細は [`ruby/smalruby3/README.md`](../../ruby/smalruby3/README.md)

## 関連ドキュメント

- [`docs/ruby-editor/`](../ruby-editor/) — ブラウザ側の Ruby エディタ
- [`docs/extension-pen/`](../extension-pen/), [`docs/extension-music/`](../extension-music/) — 拡張機能のユーザー視点ドキュメント (両者 Smalruby ランタイム ✅)
- [`docs/scratch-vm/`](../scratch-vm/) — ブラウザ側 VM の内部仕様 (対比)
