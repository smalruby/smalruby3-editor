# smalruby3 gem アーキテクチャ

`ruby/smalruby3/` の中核オブジェクトと、プログラム実行・描画・入力処理のフロー。

## クラス階層と所有関係

```
Smalruby3 (top-level module)
  ├─ Runtime (singleton, lib/smalruby3/runtime.rb)
  │     ├─ targets[]           ← Stage + Sprite サブクラス群
  │     ├─ fibers[]            ← 各 when_* ブロックの実行 Fiber
  │     ├─ renderer: Renderer  ← SDL2 描画
  │     ├─ asset_manager: AssetManager
  │     ├─ keyboard, mouse, clock (io/)
  │     └─ event_queue
  │
  └─ Target (lib/smalruby3/target.rb, abstract)
        ├─ Sprite (lib/smalruby3/sprite.rb)
        │    ├─ x, y, direction, size, rotation_style
        │    ├─ costumes[], current_costume
        │    ├─ sounds[]
        │    ├─ visible, drag_mode
        │    ├─ @is_clone (300 体上限)
        │    └─ @pen, @music (Extension モジュール mixin)
        │
        └─ Stage (lib/smalruby3/stage.rb, singleton)
             ├─ backdrops[], current_backdrop
             ├─ sounds[]
             └─ tempo, video_state
```

主な「**所有 (owns)**」:

- `Smalruby3` モジュールは `Runtime.instance` を 1 つ所有 (singleton)
- `Runtime` は **すべての** targets / fibers / renderer / io デバイスを所有
- 各 `Sprite` は自身のコスチューム・サウンド・状態を所有、必要に応じて Pen / Music 拡張をインスタンス化
- `Stage` は singleton (1 プロジェクト = 1 ステージ)

## 実行モデル: 1 メインスレッド + Fiber 並列

scratch-vm のスレッド/シーケンサーモデルとは異なり、smalruby3 は **Ruby Fiber** で並列スクリプトを表現する：

```
main thread (SDL2 event loop)
  │
  ├─ 各 when_* ブロックを Fiber として登録
  │
  └─ 30 FPS のメインループ:
        ├─ SDL2 イベント取得 (key down/up, mouse, quit)
        ├─ for fiber of fibers:
        │     fiber.resume   ← 1 ステップ実行
        │     ↓ Fiber 内で .with_screen_refresh / Fiber.yield されるとここに戻る
        ├─ レンダラーで全 Drawable を draw
        ├─ 必要に応じてイベント発火
        │     - when_key_pressed
        │     - when_receive (broadcast)
        │     - when_greater_than
        │     - when_backdrop_switches
        └─ FRAME_TIME (33.33ms) になるまで sleep
```

### フレーム同期の仕組み

```ruby
loop.with_screen_refresh do   # = loop { ... ; Fiber.yield }
  self.x += 5
  bounce_if_on_edge
end
```

`with_screen_refresh` は **各イテレーションで `Fiber.yield`** を入れる。これによりメインループに制御が戻り、レンダリング → 次フレームで Fiber.resume となる。

### 非同期メソッド

| メソッド | 動作 |
|---|---|
| `wait(seconds)` | Clock 経由で `seconds` 経過まで Fiber.yield |
| `say(message, seconds:)` | 吹き出し表示 + 待ち |
| `broadcast_and_wait(name)` | 全 `when_receive` Fiber 完了まで yield |
| `switch_backdrop_and_wait(name)` | 全 `when_backdrop_switches` Fiber 完了まで yield |

## データフロー: スクリプト → 実行 → 描画

### 1. ロード (Ruby ファイルの require)

```
ruby script_file.rb
  → Smalruby3 モジュール load
  → Sprite サブクラスが定義されると inherited フックで Smalruby3.register_sprite(klass)
  → DSL (set_sprite, set_x, when_*) はクラス定義時に評価され、metadata 蓄積
  → at_exit で Smalruby3.start (明示的に呼ばれない場合)
```

### 2. 起動 (Smalruby3.start)

```
Runtime.instance.run
  ├─ asset_manager.prefetch_all   ← 必要なコスチューム/サウンドを download + cache
  ├─ init_targets                  ← Sprite/Stage インスタンス化
  ├─ init_renderer                 ← SDL2 ウィンドウ作成 + Renderer
  ├─ init_mixer                    ← SDL2_mixer 初期化
  ├─ start_flag_clicked            ← when_flag_clicked Fiber を全件作成して fibers[] に追加
  ├─ main_loop                     ← 30 FPS のメインループ
  └─ shutdown                      ← クリーンアップ
```

### 3. メインループ

```ruby
# 擬似コード
loop do
  next_frame_time = Time.now + FRAME_TIME

  # SDL2 イベント取得
  while event = SDL2::Event.poll
    case event
    when SDL2::Event::Quit then break
    when SDL2::Event::KeyDown then start_when_key_pressed(event.key)
    # ...
    end
  end

  # Fiber を 1 ステップずつ進める
  fibers.each do |fiber|
    next unless fiber.alive?
    fiber.resume
  end
  fibers.delete_if { |f| !f.alive? }

  # 終了したクローンを掃除
  cleanup_clones

  # レンダリング
  renderer.draw_frame(targets)

  # スクリーンショット (SMALRUBY3_SCREENSHOT=N で N フレーム目を保存)
  capture_screenshot if frame_count == ENV['SMALRUBY3_SCREENSHOT']

  # フレームレート同期
  sleep [next_frame_time - Time.now, 0].max
end
```

### 4. 終了

`SDL2::Event::Quit` (ウィンドウクローズ) または `Smalruby3.stop` で main_loop が break、shutdown へ。

## 座標系

Scratch 互換の中央原点座標：

```
   y=180 ↑
        │
 -240 ←─┼─→ x=240
        │
   y=-180 ↓
```

SDL2 の左上原点 (480×360) に変換するときは：

```ruby
screen_x = 240 + scratch_x
screen_y = 180 - scratch_y
```

## アセット解決チェーン

`AssetManager#resolve_costumes(sprite_name)` などの解決ロジック：

```
1. Preset カタログ (lib/smalruby3/asset_catalog.json) で sprite_name を引く
   → 該当する asset id (md5ext) のリストを取得
2. キャッシュ ($SMALRUBY3_HOME/cache/assets/<md5ext>) を確認
   → あれば使う
3. なければ HTTPS で download
   → cache に保存 (md5ext 検証 (path traversal 対策)、MAX_ASSET_SIZE 制限、timeout)
4. SVG の場合は Rust 拡張 (smalruby3_imageutil) で PNG に変換
5. Costume オブジェクトを生成 (path / rotation_center / bitmap_resolution)
   → SDL2::Surface は遅延ロード (使われるまで触らない)
```

セキュリティ: `md5ext` は `/\A[a-f0-9]+\.(png|svg|wav|mp3|jpg)\z/` の正規表現でバリデーション。任意のパス traversal を防ぐ。

## レンダリング

`Renderer` は SDL2 のアクセラレーテッドレンダラー (macOS は Metal バックエンド)：

```ruby
# 擬似コード
def draw_frame(targets)
  renderer.clear

  # Stage の背景描画
  draw_drawable(stage.current_backdrop_skin)

  # 各 Sprite を z-order でソート
  visible_sprites = targets.select(&:visible?).sort_by(&:layer)

  # Pen レイヤー (背景の上、スプライトの下)
  draw_drawable(pen_skin)

  # 各 Sprite を描画
  visible_sprites.each do |sprite|
    apply_effects(sprite.effects)
    draw_drawable(sprite.current_costume.skin)
    draw_drawable(sprite.text_bubble) if sprite.bubble?
  end

  renderer.present
end
```

### Drawable 種別

| Skin | 用途 |
|---|---|
| `BitmapSkin` | コスチューム (PNG/SVG→PNG) |
| `PenSkin` | ペン描画レイヤー |
| `TextBubble` | say/think の吹き出し |

### エフェクト

`color`, `fisheye`, `whirl`, `pixelate`, `mosaic`, `brightness`, `ghost` の 7 種類を `effect_transform.rb` で実装。SDL2 の texture transform で実現。

## 衝突判定

`Costume#silhouette` で SDL2::Surface の **アルファチャネルから silhouette を生成**してキャッシュ。スプライト同士の衝突は silhouette の bounding box → pixel-level の 2 段階チェック。

`Renderer#read_pixels` (smalruby fork で追加) を使って描画後の pixel を読み出すこともできる。

## 実行環境

### macOS (ネイティブ)

- **`smalruby3_launcher`** (Swift/Obj-C) を経由する必要がある
- 素の `ruby` から SDL2 を呼ぶと segfault する (macOS 固有の問題)
- `exe/smalruby` ラッパーがこれを exec する

### Docker (Xvfb)

- `Dockerfile` で Xvfb (X virtual framebuffer) + 必要な SDL2 dev ライブラリをインストール
- 環境変数 `SMALRUBY3_SCREENSHOT=N` で N フレーム目の PNG を `/tmp/smalruby3_screenshot.png` に保存
- CI / 自動テスト用途

```bash
docker compose run --rm smalruby3 \
  bash -c "SMALRUBY3_SCREENSHOT=3 timeout 15 ruby -Ilib examples/01_move.rb"
```

## 設定・データ永続化

### 環境変数

| 変数 | デフォルト | 用途 |
|---|---|---|
| `SMALRUBY3_HOME` | `~/.smalruby3/` | キャッシュディレクトリ |
| `SMALRUBY3_SCREENSHOT` | (なし) | 指定フレーム数で PNG 保存 |
| `SMALRUBY3_SCREENSHOT_PATH` | `/tmp/smalruby3_screenshot.png` | スクリーンショット出力先 |

### キャッシュ

- `$SMALRUBY3_HOME/cache/assets/<md5ext>` — ダウンロード済みアセット
- 起動時に prefetch_all で必要なものを download

## 主要 API リファレンス

### モジュールレベル

| メソッド | 用途 |
|---|---|
| `Smalruby3.start()` | イベントループ起動 (省略時は at_exit で自動) |
| `Smalruby3.started?()` | 起動済みか |
| `Smalruby3.home()` | キャッシュディレクトリ |
| `Smalruby3.register_sprite(klass)` | Sprite サブクラス登録 (継承時自動) |
| `Smalruby3.register_stage(klass)` | Stage クラス登録 |

### Sprite DSL

| メソッド | 用途 |
|---|---|
| `set_sprite(name)` | プリセット名でコスチュームをロード |
| `set_costume_names([...])` | 明示的にコスチュームリストを指定 |
| `set_x(n)`, `set_y(n)` | 初期位置 |
| `set_size(n)` | 初期サイズ % |
| `set_direction(deg)` | 初期向き |
| `when_flag_clicked { }` | 緑旗 Hat |
| `when_key_pressed("a") { }` | キー Hat |
| `when_receive("name") { }` | broadcast 受信 Hat |
| `when_start_as_a_clone { }` | クローン開始 Hat |
| `when_backdrop_switches("backdrop1") { }` | 背景切替 Hat |

### インスタンスメソッド (実行時)

| メソッド | 用途 |
|---|---|
| `x`, `x=`, `y`, `y=` | 座標 |
| `direction`, `direction=` | 向き |
| `size`, `size=` | サイズ |
| `say("hello", seconds: 2)` | 吹き出し |
| `think("...")` | 考え事吹き出し |
| `move(steps)` | 向きに従って移動 |
| `bounce_if_on_edge` | 端で跳ね返る |
| `switch_costume("name")` | コスチューム切替 |
| `next_costume` | 次のコスチューム |
| `clone` | 自身のクローン作成 |
| `delete_this_clone` | このクローン削除 |
| `broadcast("name")` | 非同期 broadcast |
| `broadcast_and_wait("name")` | 同期 broadcast |

完全な API は `lib/smalruby3/sprite.rb` と `lib/smalruby3/target.rb` を参照。

## 関連ドキュメント

- [`README.md`](README.md) — gem 全体ナビゲーション
- [`extensions.md`](extensions.md) — 拡張機能 (Pen / Music) の仕組み
- [`ruby/smalruby3/docs/ruby-sdl2-api.md`](../../ruby/smalruby3/docs/ruby-sdl2-api.md) — 使用 SDL2 API
- [`docs/scratch-vm/architecture.md`](../scratch-vm/architecture.md) — ブラウザ側 VM との対比
