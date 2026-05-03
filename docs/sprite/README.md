# スプライト

> **⬆️ upstream そのまま** — upstream の実装をほぼそのまま利用

## 概要

Scratch プロジェクトに登場する**キャラクター（スプライト）**の追加・選択・配置・属性編集を扱う機能群。スプライトライブラリからの選択、自分で描く、ファイルから取り込む、ステージ上のドラッグでの配置、座標・向き・サイズの編集など、upstream Scratch から継承する機能をそのまま提供している。

## ユーザーストーリー

- **小学生**として、ライブラリから猫やボールなどのキャラクターを選んで作品に追加したい
- **オリジナル作品を作る子**として、自分で描いたスプライトを使いたい
- **発表会の出展者**として、複数のキャラクターを配置して画面構成を作りたい
- **作品制作中の子**として、スプライトの座標・向き・サイズを GUI で直接調整したい

## UI / 操作フロー

エディタ右下の **スプライトペイン** で操作：

| 操作 | UI |
|---|---|
| スプライト追加 | 「+」ボタン → スプライトライブラリ / カメラ撮影 / ファイル / 自分で描く |
| スプライト選択 | スプライト一覧をクリック |
| スプライト削除 | スプライトカードの「×」 |
| 座標設定 | スプライト情報の x, y 入力欄 |
| 向き設定 | direction-picker (時計型 UI) |
| サイズ設定 | size 入力欄 |
| 表示/非表示 | show/hide トグル |
| ロック | スプライトをドラッグ移動できないようにロック |

## 主要ファイル

### scratch-gui

#### コンポーネント / コンテナ

| ファイル | 役割 |
|---|---|
| `packages/scratch-gui/src/containers/sprite-info.jsx` | スプライト情報パネル (座標・向き・サイズ・表示) |
| `packages/scratch-gui/src/components/sprite-info/` | UI コンポーネント |
| `packages/scratch-gui/src/containers/sprite-selector-item.jsx` | スプライト一覧の各カード |
| `packages/scratch-gui/src/components/sprite-selector/` | スプライト一覧 UI |
| `packages/scratch-gui/src/components/sprite-selector-item/` | カード UI |
| `packages/scratch-gui/src/containers/sprite-library.jsx` | スプライトライブラリモーダル |
| `packages/scratch-gui/src/containers/target-pane.jsx` | スプライトペイン全体 |
| `packages/scratch-gui/src/containers/target-highlight.jsx` | 選択中スプライトのハイライト |

#### 向き・方向

- `packages/scratch-gui/src/containers/direction-picker.jsx` — 向き選択 UI

#### State 管理

- `packages/scratch-gui/src/reducers/targets.js` — スプライト一覧 / 選択中ターゲット
- `packages/scratch-gui/src/reducers/hovered-target.js` — ホバー中ターゲット

### scratch-vm

`packages/scratch-vm/src/sprites/` — Sprite, RenderedTarget の実装。

### infra

なし。

## 関連ブロック

スプライト自体の操作に関連するブロック：

| ブロック | 説明 |
|---|---|
| `motion_gotoxy` | 指定座標へ移動 |
| `motion_setx` / `motion_sety` | x / y 座標設定 |
| `motion_changexby` / `motion_changeyby` | 座標変化 |
| `motion_pointindirection` | 向き設定 |
| `motion_movesteps` | 歩数移動 |
| `looks_changesizeby` / `looks_setsizeto` | サイズ変更 |
| `control_create_clone_of` | クローン作成 |
| `control_delete_this_clone` | クローン削除 |

> 各ブロックの Ruby 表現は [`docs/smalruby-language-spec.ja.md`](../smalruby-language-spec.ja.md) を参照。
> 「見た目」関連のブロック (`looks_say`, `looks_show` など) は将来 `docs/looks/` を作る場合に分離可能。

## 設定・データ永続化

### Redux state

- `targets` — スプライト一覧 / 編集中ターゲット
- `hovered-target` — ホバー中
- `asset-drag` — アセットドラッグ状態
- `dynamic-assets` — 動的アセット

## 関連ドキュメント

- [`docs/costume/`](../costume/) — スプライトのコスチューム編集
- [`docs/sound/`](../sound/) — スプライトのサウンド編集
- [`docs/stage/`](../stage/) — ステージ全体

## 関連 Issue / PR

upstream そのままの機能のため、Smalruby 固有の Issue はほとんどなし。
