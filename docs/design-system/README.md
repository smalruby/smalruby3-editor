# デザインシステム

> **🔧 upstream 改良** — 上流（Scratch）の GUI のデザインのきまりをそのまま記録する
> **改良点**: 上流の値は変えずに、独自の画面のための意味の名前の別名（`smalruby-tokens.css`）を足す

## 概要

スモウルビーのデザインシステム。上流の GUI から**デザイントークン**（色・大きさ・余白・角丸・文字・影・重なり順）と部品の形を取り出し、表とスクリーンショットにまとめる。

**目的**: Scratch に由来するデザインのきまりをはっきりさせ、スモウルビー独自の機能（レッスン・クラス管理など）の UI を速く、Scratch の画面とずれずに作れるようにする。いまは独自の画面ごとに色や大きさを決めていて、Scratch の画面と少しずつずれている（独自の画面の CSS には 16 進の色の直書きが約 700 か所ある）。

設計の出発点は EPIC [#1809](https://github.com/smalruby/smalruby3-editor/issues/1809)。

## 方針

| 項目 | 決めたこと |
|---|---|
| 名前 | 上流の Sass（PostCSS）の変数名をそのまま残し、意味の名前の別名を足す |
| 独自の画面での使い方 | 新しい `packages/scratch-gui/src/css/smalruby-tokens.css` を `@import` する |
| 値の正 | 上流 scratch-editor tag `v13.7.2` の CSS（基準は `.claude/rules/upstream-tracking.md`）。実際の画面の計算済みの値はスモウルビーの変更が混ざるので、見本の画像と確かめにだけ使う |
| 見本の形 | Markdown の表とスクリーンショットだけ（HTML の見本は作らない） |
| ダーク・高コントラスト | 上流と同じく、ブロックの色だけ記録する（GUI の枠は色のモードで変わらない） |
| 見つけたずれ | マーカーの無い上流ファイルの変更などは、この文書とは別の小さな Issue で直す |

## 対象（上流の Scratch 由来の画面）

- メイン画面のメニューバー:「ロゴ」「ファイル」「編集」「チュートリアル」「デバッグ」
- コードタブのすべて（ブロックパレット・カテゴリ・スクリプトエリア・ステージ・スプライトの情報・ターゲットの一覧）
- コスチュームタブのすべて（ペイントエディター）
- 音タブのすべて（音のエディター）
- 拡張機能のモーダル
- デバッグのモーダル
- チュートリアルのモーダル
- スプライト・ステージ（背景）・コスチューム・音を選ぶモーダル（ライブラリ）
- スプライトを削除するときの確認
- 変数・リスト・関数（ブロック定義）を作るモーダル
- micro:bit のような標準の拡張機能の、機器と接続するモーダル

## 対象外（スモウルビー独自）

レッスン、クラス管理、クラス（生徒の画面）、設定メニュー、SP（スマホ）用の画面、Ruby タブ・日本語タブなど、スモウルビーで独自に作ったもの。上流の画面の中にあるスモウルビーの変更（`=== Smalruby: ... ===` のマーカーの付いたところ）も記録しない。

これらは**トークンを使う側**。このデザインシステムに合わせて作る。

## 文書の地図

| ファイル | 中身 |
|---|---|
| [`tokens.md`](tokens.md) | 上流のトークン（色・大きさ・文字・重なり順）の一覧、くり返し出る直書きの値、意味の名前の別名 |
| [`blocks.md`](blocks.md) | ブロックのカテゴリの色（3 つの色のモード）と形の寸法 |
| [`paint.md`](paint.md) | ペイントエディター（scratch-paint）の値と、GUI との食い違い |
| [`components/`](components/) | 共通部品（ボタン・入力欄・メニュー・モーダル・タブ・カード・確認・アラート）の状態の表 |
| [`screenshots/`](screenshots/) | 見本の画像（名前の付け方は [`../_screenshot-guidelines.md`](../_screenshot-guidelines.md)） |

## 独自の画面でトークンを使う

独自の画面の CSS の先頭で `smalruby-tokens.css` を読み込み、意味の名前で書く。`smalruby-tokens.css` は上流の `colors.css`・`units.css`・`z-index.css` を読み込むので、上流の名前もそのまま使える。

```css
/* packages/scratch-gui/src/components/my-modal/my-modal.css */
@import '../../css/smalruby-tokens.css';

.body {
    /* モーダルの本文には必ず不透明な背景を付ける（.claude/rules/scratch-gui/modals.md） */
    background-color: $color-surface;
    color: $color-text;
    padding: $space-large;
    font-size: $font-size-dialog;
}

.ok-button {
    background-color: $color-primary;
    color: $color-surface;
    border: 1px solid $color-primary-dark;
    border-radius: $radius-small;
    font-weight: $font-weight-bold;
    transition: $transition-standard;
}

.ok-button:focus-visible {
    box-shadow: 0 0 0 0.25rem $color-primary-transparent;
}
```

- `@import` の道すじは、その CSS から `src/css/` への相対パス（ほかの CSS が `colors.css` を読み込むときと同じ）。ビルドでは `postcss-import` が中身を埋め込み、`postcss-simple-vars` が変数を値に置きかえる。
- `colors.css` などをほかに読み込んでいても、いっしょに読み込んでよい。
- 直書きの値を足したくなったら、まず [`tokens.md`](tokens.md) にトークンが無いか見る。無くて、ほかの画面でもくり返し使うなら別名を足す（下の「文書を新しく保つ」）。

## 主要ファイル

- `packages/scratch-gui/src/css/colors.css`・`units.css`・`typography.css`・`z-index.css` — 上流のトークン（変えない）
- `packages/scratch-gui/src/css/smalruby-tokens.css` — スモウルビーの別名（独自のファイル。Prettier の対象）
- `packages/scratch-gui/src/lib/settings/color-mode/` — ブロックの 3 つの色のモード（[`blocks.md`](blocks.md)）

## 文書を新しく保つ

- **upstream のマージのとき**: `src/css/` の 4 つのファイルが変わったら、[`tokens.md`](tokens.md) の表と基準のタグ（このページと `tokens.md` の `v13.7.2`）を直す。部品の CSS が変わったら、`components/` と各画面の文書を見直す。
- **別名を足す・変えるとき**: `smalruby-tokens.css` に 1 行のコメント付きで足し、`tokens.md` の「意味の名前の別名」の表にも足す（両方をいっしょに直す）。上流にトークンがあるときは、それを指す別名にする（値を写さない）。
- **上流のトークンのファイルを変えるとき**: 原則として変えない。どうしても変えるときは、マーカーを付けて `docs/maintenance/smalruby-markers-gui.md` に載せ、`tokens.md` の「スモウルビーとの差」にも書く。
- **スクリーンショット**: 上流の値の見本なので、スモウルビーの吹き出しなどが写らないようにして撮る。撮り直しはファイル名を変えない（[`../_screenshot-guidelines.md`](../_screenshot-guidelines.md)）。
