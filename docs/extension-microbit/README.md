# 拡張機能: micro:bit

> **⬆️ upstream そのまま** — upstream の実装をほぼそのまま利用

- **Smalruby ランタイム対応**: ❌（smalruby3 gem 未対応。Web Bluetooth または WebUSB を使うため）
- **デフォルト表示**: ❌（`defaultHidden: true`）— 拡張機能ライブラリで「見る」ボタンを押すと表示
- **collaborator**: micro:bit

## 概要

micro:bit（マイクロビット）デバイスを Smalruby から制御する**標準**拡張機能。基本機能（ボタン、LED マトリクス、加速度、傾き）のみ。upstream Scratch 標準。

> より多くのセンサ・I/O を扱いたい場合は **Smalruby 独自の [`extension-microbit-more/`](../extension-microbit-more/)** を使う。

## ユーザーストーリー

- **micro:bit を持っている小学生**として、ボタンや LED の基本機能を Smalruby から使いたい
- **教師**として、追加ファームウェア書き込み不要の標準 micro:bit 環境をすぐに使わせたい

## 主要ファイル

- 拡張機能登録: `packages/scratch-gui/src/lib/libraries/extensions/index.jsx` の `extensionId: 'microbit'` (`defaultHidden: true`)
- VM 実装: `packages/scratch-vm/src/extensions/scratch3_microbit/`

## 関連ブロック（主要 opcode）

| opcode | 説明 |
|---|---|
| `microbit_whenButtonPressed` | ボタンが押されたとき |
| `microbit_isButtonPressed` | ボタンが押されているか |
| `microbit_displaySymbol` | LED マトリクスにシンボル表示 |
| `microbit_displayText` | テキスト流し表示 |
| `microbit_displayClear` | 表示クリア |
| `microbit_whenTilted` | 傾いたとき |
| `microbit_whenGesture` | ジェスチャ（振る、論理ロゴアップ等）|

## 動作環境

- **対応ブラウザ**: Chrome / Edge (Web Bluetooth サポート)
- micro:bit 標準ファームウェア

## 関連ドキュメント

- 上流: [scratch-vm のドキュメント](https://github.com/scratchfoundation/scratch-vm)
- [`docs/extension-microbit-more/`](../extension-microbit-more/) — Smalruby 独自の機能拡張版
