# ruby-sdl2 API Reference (smalruby3 で使用する範囲)

Source: https://ohai.github.io/ruby-sdl2/doc-en/

## SDL2 (Module)

```ruby
SDL2.init(flags)                        # → nil   SDL を初期化
SDL2.delay(ms)                          # → nil   ms ミリ秒待つ
SDL2.get_ticks                          # → Integer  init() からの経過ミリ秒
```

### 初期化フラグ

```ruby
SDL2::INIT_VIDEO    # ビデオサブシステム
SDL2::INIT_AUDIO    # オーディオサブシステム
SDL2::INIT_TIMER    # タイマーサブシステム
```

---

## SDL2::Window

```ruby
# 生成
window = SDL2::Window.create(title, x, y, w, h, flags)  # → SDL2::Window

# 定数
SDL2::Window::POS_CENTERED   # 中央配置
SDL2::Window::POS_UNDEFINED  # 位置指定なし

# Flags
SDL2::Window::Flags::FULLSCREEN
SDL2::Window::Flags::SHOWN
SDL2::Window::Flags::HIDDEN
SDL2::Window::Flags::RESIZABLE

# メソッド
window.create_renderer(index, flags)    # → SDL2::Renderer  (-1 で自動選択)
window.renderer                         # → SDL2::Renderer or nil
window.title / window.title=            # → String
window.size / window.size=              # → [w, h]
window.position / window.position=      # → [x, y]
window.icon = surface                   # → SDL2::Surface を設定
window.show / window.hide
window.maximize / window.minimize / window.restore
window.destroy / window.destroy?
window.window_id                        # → Integer  ウィンドウ ID
```

---

## SDL2::Renderer

```ruby
# 生成は Window#create_renderer で行う
renderer = window.create_renderer(-1, SDL2::Renderer::Flags::ACCELERATED)

# Flags
SDL2::Renderer::Flags::SOFTWARE
SDL2::Renderer::Flags::ACCELERATED
SDL2::Renderer::Flags::PRESENTVSYNC
SDL2::Renderer::Flags::TARGETTEXTURE

# Flip 定数 (copy_ex 用)
SDL2::Renderer::FLIP_NONE
SDL2::Renderer::FLIP_HORIZONTAL
SDL2::Renderer::FLIP_VERTICAL
```

### 描画操作

```ruby
renderer.draw_color = [r, g, b, a]       # 描画色を設定 (0-255)
renderer.draw_color                       # → [r, g, b, a]
renderer.clear                            # 描画色でクリア
renderer.present                          # 画面に反映
renderer.draw_line(x1, y1, x2, y2)       # 線を描画
renderer.draw_point(x, y)                 # 点を描画
renderer.draw_rect(rect)                  # 矩形の枠を描画
renderer.fill_rect(rect)                  # 塗りつぶし矩形を描画
```

### テクスチャ操作

```ruby
renderer.copy(texture, srcrect, dstrect)                          # テクスチャをコピー
renderer.copy_ex(texture, srcrect, dstrect, angle, center, flip)  # 回転・反転付きコピー
renderer.create_texture(format, access, w, h)                     # テクスチャ生成
renderer.create_texture_from(surface)                             # Surface → Texture
renderer.load_texture(file)                                       # ファイル → Texture
```

### レンダーターゲット

```ruby
renderer.render_target                    # → SDL2::Texture or nil (nil=画面)
renderer.render_target = texture          # ACCESS_TARGET のテクスチャを設定
renderer.reset_render_target              # 画面に戻す
renderer.support_render_target?           # → Boolean
```

### 表示プロパティ

```ruby
renderer.viewport / renderer.viewport=    # → SDL2::Rect
renderer.output_size                      # → [w, h]
renderer.logical_size / renderer.logical_size=  # → [w, h]
renderer.scale / renderer.scale=          # → [sx, sy]
renderer.clip_rect / renderer.clip_rect=  # → SDL2::Rect
renderer.clip_enabled?                    # → Boolean
renderer.info                             # → SDL2::Renderer::Info
renderer.draw_blend_mode / renderer.draw_blend_mode=
renderer.destroy / renderer.destroy?
```

---

## SDL2::Surface

### クラスメソッド

```ruby
SDL2::Surface.new(width, height, depth)                       # 空の Surface を生成
SDL2::Surface.new(width, height, depth, rmask, gmask, bmask, amask)
SDL2::Surface.load(file)                                      # ファイルから読み込み (PNG/JPG/BMP等)
SDL2::Surface.load_bmp(path)                                  # BMP ファイルから読み込み
SDL2::Surface.save_bmp(surface, path)                         # ★ BMP ファイルに保存
SDL2::Surface.blit(src, srcrect, dst, dstrect)                # Surface 間コピー
SDL2::Surface.from_string(string, width, height, depth, ...)  # バイト列から生成
```

### インスタンスメソッド

```ruby
surface.w / surface.h                     # → Integer  幅/高さ
surface.pitch                             # → Integer  1行あたりのバイト数
surface.bits_per_pixel / surface.bytes_per_pixel
surface.pixels                            # → String   ピクセルデータ (バイト列)
surface.pixel(x, y)                       # → Integer  ピクセル値 (raw)
surface.pixel_color(x, y)                 # → [r, g, b, a]  RGBA 値
surface.blend_mode / surface.blend_mode=
surface.color_key / surface.color_key=    # 透過色
surface.unset_color_key
surface.lock / surface.unlock / surface.must_lock?
surface.destroy / surface.destroy?
```

### ★ スクリーンショットの撮り方

```ruby
# 1. Renderer の内容を Surface にコピーするには、
#    render target を使って Surface.blit で取得する。
#    しかし ruby-sdl2 には SDL_RenderReadPixels がないため、
#    以下の方法でキャプチャする:

# 方法: SOFTWARE レンダラーで Surface に直接描画
window = SDL2::Window.create("title", 0, 0, 480, 360, 0)
renderer = window.create_renderer(-1, SDL2::Renderer::Flags::SOFTWARE)
# ... renderer で描画 ...
renderer.present

# Window Surface を取得する方法がないため、
# render target テクスチャ + Surface.blit の組み合わせか、
# 描画内容を同時に Surface にも書き込む方式が必要。

# 最もシンプルな方法: 描画対象の Surface を作成し、
# ピクセルデータを手動で書き込んで save_bmp で保存
surface = SDL2::Surface.new(480, 360, 32)
# ... pixels にデータを書き込む ...
SDL2::Surface.save_bmp(surface, "/tmp/screenshot.bmp")
```

---

## SDL2::Texture

### 定数

```ruby
SDL2::Texture::ACCESS_STATIC     # 変更少ない、ロック不可
SDL2::Texture::ACCESS_STREAMING  # 頻繁に変更、ロック可能
SDL2::Texture::ACCESS_TARGET     # レンダーターゲットとして使用可能
```

### インスタンスメソッド

```ruby
texture.w / texture.h                     # → Integer  幅/高さ
texture.format                            # → SDL2::PixelFormat
texture.access_pattern                    # → Integer  ACCESS_* 定数
texture.blend_mode / texture.blend_mode=  # ブレンドモード
texture.alpha_mod / texture.alpha_mod=    # → Integer  アルファ値 (0-255)
texture.color_mod / texture.color_mod=    # → [r, g, b]  色モジュレーション
texture.destroy / texture.destroy?
texture.inspect / texture.debug_info
```

---

## SDL2::Rect / SDL2::Point

```ruby
SDL2::Rect.new(x, y, w, h)    # 矩形
rect.x / rect.y / rect.w / rect.h

SDL2::Point.new(x, y)          # 点
point.x / point.y
```

---

## SDL2::BlendMode

```ruby
SDL2::BlendMode::NONE    # ブレンドなし
SDL2::BlendMode::BLEND   # アルファブレンド
SDL2::BlendMode::ADD     # 加算ブレンド
SDL2::BlendMode::MOD     # 乗算ブレンド
```

---

## SDL2::PixelFormat

```ruby
SDL2::PixelFormat::RGBA8888
SDL2::PixelFormat::ARGB8888
SDL2::PixelFormat::RGB888
```

---

## SDL2::Event

### ポーリング

```ruby
while (event = SDL2::Event.poll)
  case event
  when SDL2::Event::Quit          then # ウィンドウ閉じる
  when SDL2::Event::KeyDown       then event.scancode, event.repeat
  when SDL2::Event::KeyUp         then event.scancode
  when SDL2::Event::MouseMotion   then event.x, event.y
  when SDL2::Event::MouseButtonDown then event.x, event.y, event.button
  when SDL2::Event::MouseButtonUp   then event.x, event.y, event.button
  when SDL2::Event::MouseWheel    then event.x, event.y
  when SDL2::Event::TextInput     then event.text
  end
end
```

### イベントサブクラス一覧

- `Quit` — ウィンドウ閉じる
- `KeyDown` / `KeyUp` — キーボード (`scancode`, `repeat`)
- `MouseMotion` — マウス移動 (`x`, `y`)
- `MouseButtonDown` / `MouseButtonUp` — マウスボタン
- `MouseWheel` — マウスホイール
- `TextInput` / `TextEditing` — テキスト入力
- `Window` — ウィンドウイベント
- `JoyAxisMotion` / `JoyButtonDown` / `JoyButtonUp` — ジョイスティック
- `ControllerAxisMotion` / `ControllerButtonDown` / `ControllerButtonUp` — ゲームコントローラー
- `FingerDown` / `FingerUp` / `FingerMotion` — タッチ

---

## SDL2::Key::Scan (スキャンコード)

```ruby
SDL2::Key::Scan::A       # 4
SDL2::Key::Scan::Z       # 29
SDL2::Key::Scan::K0      # 39  (数字の0)
SDL2::Key::Scan::K1      # 30  (数字の1)
SDL2::Key::Scan::K9      # 38  (数字の9)
SDL2::Key::Scan::SPACE   # 44
SDL2::Key::Scan::RETURN  # 40
SDL2::Key::Scan::ESCAPE  # 41
SDL2::Key::Scan::LEFT    # 80
SDL2::Key::Scan::RIGHT   # 79
SDL2::Key::Scan::UP      # 82
SDL2::Key::Scan::DOWN    # 81
```

---

## SDL2::TTF (フォント)

```ruby
SDL2::TTF.init                              # 初期化
font = SDL2::TTF.open(path, ptsize)         # フォント読み込み
font = SDL2::TTF.open(path, ptsize, index)  # マルチフェースフォント

font.render_solid(text, [r, g, b])          # → SDL2::Surface  高速・低品質
font.render_shaded(text, fg, bg)            # → SDL2::Surface  中品質・背景あり
font.render_blended(text, [r, g, b])        # → SDL2::Surface  高品質・アルファ付き
font.size_text(text)                        # → [w, h]  テキストサイズ計算

font.height                                 # → Integer  フォント高さ
font.style / font.style=                    # Bold/Italic/Underline
font.face_is_fixed_width?                   # → Boolean
font.destroy / font.destroy?
```

---

## SDL2::Mixer (オーディオ)

```ruby
SDL2::Mixer.init(flags)                       # 初期化 (INIT_OGG, INIT_MP3 等)
SDL2::Mixer.open(freq, format, channels, chunksize)  # デバイスを開く
SDL2::Mixer.close                             # デバイスを閉じる
```

### SDL2::Mixer::Chunk (効果音)

```ruby
chunk = SDL2::Mixer::Chunk.load(path)         # WAV/OGG ファイル読み込み
chunk.volume / chunk.volume=                  # → Integer  音量 (0-128)
chunk.filename                                # → String
chunk.destroy / chunk.destroy?
SDL2::Mixer::Chunk.decoders                   # → Array<String>
```

### SDL2::Mixer::Channels (チャンネル)

```ruby
SDL2::Mixer::Channels.allocate(n)             # チャンネル数を設定
SDL2::Mixer::Channels.play(ch, chunk, loops, ticks=-1)  # → Integer  チャンネル番号
SDL2::Mixer::Channels.fade_in(ch, chunk, loops, ms, ticks=-1)  # フェードイン再生
SDL2::Mixer::Channels.halt(ch)                # 停止 (ch=-1 で全チャンネル)
SDL2::Mixer::Channels.pause(ch)               # 一時停止
SDL2::Mixer::Channels.resume(ch)              # 再開
SDL2::Mixer::Channels.fade_out(ch, ms)        # フェードアウト
SDL2::Mixer::Channels.play?(ch)               # → Boolean  再生中か
SDL2::Mixer::Channels.pause?(ch)              # → Boolean  一時停止中か
SDL2::Mixer::Channels.fading(ch)              # → Integer  フェード状態
SDL2::Mixer::Channels.set_volume(ch, vol)     # 音量設定 (0-128, ch=-1 で全体)
SDL2::Mixer::Channels.volume(ch)              # → Integer
SDL2::Mixer::Channels.playing_chunk(ch)       # → Chunk or nil
SDL2::Mixer::Channels.expire(ch, ticks)       # ticks ms 後に停止
SDL2::Mixer::Channels.reserve(n)              # チャンネルを予約
```

### SDL2::Mixer::MusicChannel (音楽)

```ruby
SDL2::Mixer::MusicChannel.play(music, loops)         # 再生
SDL2::Mixer::MusicChannel.fade_in(music, loops, ms)  # フェードイン再生
SDL2::Mixer::MusicChannel.halt                       # 停止
SDL2::Mixer::MusicChannel.pause / .resume / .rewind
SDL2::Mixer::MusicChannel.fade_out(ms)
SDL2::Mixer::MusicChannel.play? / .pause? / .fading
SDL2::Mixer::MusicChannel.volume / .volume=          # 音量 (0-128)
```

### SDL2::Mixer::Music (音楽データ)

```ruby
music = SDL2::Mixer::Music.load(path)         # ファイル読み込み
music.destroy / music.destroy?
SDL2::Mixer::Music.decoders                   # → Array<String>
```

---

## SDL2::IMG (画像)

```ruby
SDL2::IMG.init(flags)    # 初期化 (INIT_JPG, INIT_PNG, INIT_TIF, INIT_WEBP)
# Surface.load や Renderer.load_texture で自動的に使われる
```
