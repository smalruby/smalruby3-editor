---
paths:
  - "ruby/rsdl/**"
---

# rsdl Development

## Overview

rsdl は macOS で Ruby + SDL2 を使う際に必要なコマンド。GC/メインスレッド問題を回避するラッパー。
smalruby/rsdl は knu/rsdl の fork で、Ruby 4.0 対応を行っている。

## Git Submodule

`ruby/rsdl` は git submodule として管理されている。

```
origin:   https://github.com/smalruby/rsdl.git   (fork)
upstream: https://github.com/knu/rsdl.git         (オリジナル)
```

### ブランチ構成

| ブランチ | 内容 |
|---|---|
| `master` | upstream の master と同期 |
| `smalruby/ruby-4.0-support` | ERB.new API 修正（Ruby 4.0 対応） |

### PR 作成ルール

1. **まず origin (smalruby/rsdl) に PR を作成**して動作確認
2. 動作確認後、**upstream (knu/rsdl) にも PR を作成**
3. upstream への PR を想定して、**機能ごとに細かくブランチ/PR を分ける**

## ビルド

```bash
cd ruby/rsdl
rbenv local 4.0.2   # or 3.3.9, 3.4.9
ruby extconf.rb && make
```

## smalruby3 gem からの使い方

```bash
cd ruby/smalruby3
../rsdl/rsdl -I../ruby-sdl2 -I../ruby-sdl2/lib -Ilib examples/01_move.rb
```

## 主な変更点（upstream との差分）

- `extconf.rb`: `ERB.new(str, nil, '%')` → `ERB.new(str, trim_mode: '%')`
- `extconf.rb`: `open(file, 'w')` → `File.open(file, 'w')`
- `extconf.rb`: `file_in.result` → `file_in.result(binding)`
