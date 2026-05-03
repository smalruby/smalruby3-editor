# コスチューム

> **⬆️ upstream そのまま** — upstream の実装をほぼそのまま利用

## 概要

スプライトの見た目（**コスチューム**）の編集機能。コスチュームライブラリからの選択、自分で描く（**ペイントエディタ**）、ファイルから取り込む、コスチューム間の切替を行う。upstream Scratch から継承しており、Smalruby 固有の改良はない。

ステージの**背景 (backdrop)** も技術的にはコスチュームの一種で、同じ仕組みで管理される（[`docs/stage/`](../stage/) 参照）。

## ユーザーストーリー

- **小学生**として、スプライトに複数のコスチュームを持たせて、アニメーションのように切替えたい
- **作品を作る子**として、自分で描いた絵（PNG / SVG）をコスチュームとして使いたい
- **発表会の出展者**として、ライブラリの素材を組み合わせて見栄えのするキャラクターを作りたい

## UI / 操作フロー

エディタ上部のタブで **コスチューム** タブを選択：

1. 左カラムにコスチューム一覧
2. 右カラムにペイントエディタ
3. 「+」ボタン → コスチュームライブラリ / カメラ / ファイル / 自分で描く

ペイントエディタは upstream の [`scratch-paint`](https://github.com/scratchfoundation/scratch-paint) を統合。

## 主要ファイル

### scratch-gui

| ファイル | 役割 |
|---|---|
| `packages/scratch-gui/src/containers/costume-tab.jsx` | コスチュームタブのメインコンテナ |
| `packages/scratch-gui/src/containers/costume-library.jsx` | コスチュームライブラリモーダル |
| `packages/scratch-gui/src/containers/paint-editor-wrapper.jsx` | ペイントエディタのラッパー |
| `packages/scratch-gui/src/components/asset-panel/` | アセット (コスチューム/サウンド) パネル UI |
| `packages/scratch-gui/src/lib/get-costume-url.js` | コスチューム URL の生成 |
| `packages/scratch-gui/src/lib/empty-assets.js` | 空コスチュームの定義 |

#### 関連ライブラリ

- `packages/scratch-gui/src/lib/bmp-converter.js` — BMP → PNG 変換
- `packages/scratch-gui/src/lib/data-uri-to-blob.js` — Data URI → Blob 変換
- `packages/scratch-gui/src/lib/gif-decoder.js` — アニメーション GIF 分解
- `packages/scratch-gui/src/lib/import-csv.js` — CSV インポート（リスト用、コスチュームと共通）

### scratch-svg-renderer

`packages/scratch-svg-renderer/` — SVG 処理（描画前処理、サイズ計測など）

### scratch-render

`packages/scratch-render/` — WebGL レンダリング

### infra

なし。

## 関連ブロック

コスチューム自体を**操作する**ブロックのみ列挙（見た目全般のブロックは含めない）：

| ブロック | 説明 |
|---|---|
| `looks_switchcostumeto` | 指定コスチュームに切替 |
| `looks_nextcostume` | 次のコスチュームに切替 |
| `looks_costume` | コスチューム選択メニュー（引数用）|
| `looks_costumenumbername` | 現在のコスチュームの番号 / 名前を取得 |

> 「見た目」全般（`looks_say`, `looks_show`, `looks_changesizeby` など）はコスチュームに直接関係しないため含めない。各ブロックの Ruby 表現は [`docs/smalruby-language-spec.ja.md`](../smalruby-language-spec.ja.md) を参照。

## 設定・データ永続化

なし（コスチュームデータはプロジェクトの一部として `.sb3` に保存される）。

## ペイントエディタ

ペイントエディタは別パッケージ ([scratch-paint](https://github.com/scratchfoundation/scratch-paint)) を統合している。本リポジトリでは管理外。

## 関連ドキュメント

- [`docs/sprite/`](../sprite/) — コスチュームを持つスプライト
- [`docs/stage/`](../stage/) — 背景もコスチュームの一種
- [`docs/sound/`](../sound/) — サウンドも同じアセットパネル

## 関連 Issue / PR

upstream そのままの機能のため、Smalruby 固有の Issue はほとんどなし。
