---
paths:
  - "ruby/ruby-sdl2/**"
---

# ruby-sdl2 Development

## Overview

ruby-sdl2 は SDL2 の Ruby バインディング。smalruby3 gem が SDL2 を使うために必要。
smalruby/ruby-sdl2 は ohai/ruby-sdl2 の fork で、Ruby 3.4/4.0 対応と `read_pixels` 追加を行っている。

## Git Submodule

`ruby/ruby-sdl2` は git submodule として管理されている。

```
origin:   https://github.com/smalruby/ruby-sdl2.git   (fork)
upstream: https://github.com/ohai/ruby-sdl2.git        (オリジナル)
```

### ブランチ構成

| ブランチ | 内容 |
|---|---|
| `master` | upstream の master と同期 |
| `smalruby/ruby-3.4-support` | TypedData 移行（Ruby 3.4/4.0 対応） |
| `smalruby/add-read-pixels` | read_pixels 追加（ruby-3.4-support ベース） |

### PR 作成ルール

1. **まず origin (smalruby/ruby-sdl2) に PR を作成**して動作確認
2. 動作確認後、**upstream (ohai/ruby-sdl2) にも PR を作成**
3. upstream への PR を想定して、**機能ごとに細かくブランチ/PR を分ける**
   - 例: TypedData 移行と read_pixels は別 PR

## ビルド

```bash
cd ruby/ruby-sdl2
rbenv local 3.3.9   # or 3.4.9, 4.0.2
m4 video.c.m4 > video.c   # m4 プリプロセス（.c.m4 ファイル変更時）
ruby extconf.rb && make
```

**注意**: `.c.m4` ファイルを編集したら `m4 xxx.c.m4 > xxx.c` で再生成が必要。

## smalruby3 gem からの使い方

```bash
cd ruby/smalruby3
rsdl -I../ruby-sdl2 -I../ruby-sdl2/lib -Ilib examples/01_move.rb
```

## 主な変更点（upstream との差分）

- `rubysdl2_internal.h`: `DEFINE_DATA_TYPE` マクロ追加、`DEFINE_GETTER` を TypedData 化
- `video.c.m4`: 全ラッパーを TypedData 化 + `SDL2::Renderer#read_pixels` 追加
- `event.c`, `mixer.c.m4`, `ttf.c.m4`, `joystick.c.m4`, `gamecontroller.c.m4`, `gl.c.m4`: TypedData 化
