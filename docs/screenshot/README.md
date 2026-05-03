# スクリーンショット

> **🆕 Smalruby 独自** — upstream に存在しない、Smalruby のために新規追加された機能

## 概要

ブロックスクリプトや Ruby コードを **画像 (PNG)** として保存する機能。upstream の Scratch にはコードを画像として保存する機能はない。Smalruby は学習・共有・発表会の場で「自分が書いたプログラムを見せる」用途のために独自実装した。

## ユーザーストーリー

- **作品を発表する小学生**として、自分のプログラムをスクリーンショットして印刷物や Web に貼りたい
- **教師**として、生徒のプログラムを画像として記録・共有したい
- **保護者**として、子どもが書いたプログラムを家族や友達に見せたい
- **Ruby を書いている子**として、ブロックではなく Ruby コードのスクリーンショットも撮りたい

## UI / 操作フロー

### ブロックスクリプトのスクリーンショット

1. ブロックを右クリック → 「スクリプトの画像を保存」
2. 選択したスクリプト全体が PNG としてダウンロードされる

### Ruby コードのスクリーンショット

1. Ruby タブの **ruby-toolbar** メニューから「Ruby スクリプトの画像を保存」
2. 現在の Ruby コードが PNG としてダウンロードされる

## 主要ファイル

### scratch-gui

| ファイル | 役割 |
|---|---|
| `packages/scratch-gui/src/lib/blocks-screenshot.js` | ブロックスクリーンショット生成 |
| `packages/scratch-gui/src/components/blocks-screenshot-button/` | スクリーンショットボタン UI |
| `packages/scratch-gui/src/lib/ruby-screenshot.js` | Ruby コードスクリーンショット生成 |
| `packages/scratch-gui/src/lib/backpack/block-to-image.js` | バックパック用のブロック画像化（共通ロジック）|

ブロック画像生成は SVG → PNG 変換で行い、Ruby コードは Monaco の表示状態を canvas に描画する。

### scratch-vm

なし。

### infra

なし。

## 関連ブロック

なし。

## 設定・データ永続化

なし（生成された画像はファイルとしてダウンロードされる）。

## 出力形式

- 形式: PNG
- 解像度: 元の表示サイズに準拠

## テスト

- 単体テスト: `packages/scratch-gui/test/unit/lib/blocks-screenshot.test.js`, `ruby-screenshot.test.js`

## 関連ドキュメント

- [`docs/block-editor/`](../block-editor/) — ブロックエディタ全般
- [`docs/ruby-editor/`](../ruby-editor/) — Ruby エディタ全般

## 関連 Issue / PR

主要 PR は履歴を参照（`feat:.*screenshot` で grep）。
