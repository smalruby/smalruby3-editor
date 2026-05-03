# 拡張機能: 音楽 (Music)

> **⬆️ upstream そのまま** — upstream の実装をほぼそのまま利用

- **Smalruby ランタイム対応**: ✅（`ruby/smalruby3/lib/smalruby3/extension/music.rb` あり）
- **デフォルト表示**: ✅（拡張機能ライブラリにデフォルトで表示される）

## 概要

ドラム・楽器の演奏ブロックを提供する**音楽**拡張機能。upstream Scratch 標準。Smalruby の Ruby SDL2 デスクトップランタイム (smalruby3 gem) でも動作する数少ない拡張機能の 1 つ。

## ユーザーストーリー

- **小学生**として、ドラムの音を作って自分だけのリズムを作りたい
- **ピアノ経験がある子**として、メロディを Scratch ブロックで再現したい

## 主要ファイル

- 拡張機能登録: `packages/scratch-gui/src/lib/libraries/extensions/index.jsx` の `extensionId: 'music'`
- VM 実装: `packages/scratch-vm/src/extensions/scratch3_music/`
- Ruby Generator: `packages/scratch-gui/src/lib/ruby-generator/music.js`
- Ruby ランタイム: `ruby/smalruby3/lib/smalruby3/extension/music.rb`

## 関連ブロック（主要 opcode）

| opcode | 説明 |
|---|---|
| `music_playDrumForBeats` | ドラムを N 拍鳴らす |
| `music_restForBeats` | N 拍休む |
| `music_playNoteForBeats` | 音符を N 拍鳴らす |
| `music_setInstrument` | 楽器を選ぶ |
| `music_setTempo` / `music_changeTempo` | テンポ設定・変更 |
| `music_getTempo` | テンポ取得 |

## 関連ドキュメント

- 上流: [scratch-vm のドキュメント](https://github.com/scratchfoundation/scratch-vm)
- [`docs/sound/`](../sound/) — サウンド (録音再生) との違い
