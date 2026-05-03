# ステージ

> **🔧 upstream 改良** — upstream にあるが Smalruby で機能を改良・拡張している
> **改良点**: ① iPad portrait での **stage size を small に強制** (`narrow-desktop` 対応、issue #572 / #599)。② モバイル UI 向けの調整（`mobile-ui/` 参照）。

## 概要

Scratch プロジェクトの実行結果を表示する**ステージ**領域。緑旗 (実行)、赤い停止ボタン、ステージサイズ切替、背景 (backdrop) ライブラリ、表示モード (90s, oldtimey, prehistoric) など、upstream Scratch から継承する機能群。

Smalruby は基本的に upstream のステージをそのまま使用しているが、**iPad portrait** などの狭い viewport で stage を `small` サイズに強制する独自対応がある（[`docs/mobile-ui/`](../mobile-ui/) と連動）。

## ユーザーストーリー

- **作品制作中の小学生**として、緑旗をクリックしてプログラムを実行したい
- **発表会の出展者**として、フルスクリーンモードで作品を見せたい
- **iPad portrait のユーザー**として、画面が狭くてもブロックエディタが圧迫されないように stage が自動でコンパクトになってほしい
- **ターボモードを使う子**として、計算重視のプログラムを高速で動かしたい

## UI / 操作フロー

### コントロール

| 要素 | 機能 |
|---|---|
| 緑旗 | 全スプライトの `when_flag_clicked` を発火 |
| 停止ボタン | 全スクリプト停止 |
| ステージサイズ切替 | small / large / fullscreen |
| watermark | プロジェクトロード中の透かし表示 |

### 表示モード

特殊な表示モード（メニューから起動）：
- 90s モード (`nineties-mode`)
- oldtimey モード
- prehistoric モード
- ターボモード (`turbo-mode`)

### 背景 (Backdrop)

ステージ自身の「コスチューム」相当。`backdrop-library` から選択。

## 主要ファイル

### scratch-gui

#### ステージ本体

| ファイル | 役割 |
|---|---|
| `packages/scratch-gui/src/containers/stage.jsx` | ステージのメインコンテナ |
| `packages/scratch-gui/src/containers/stage-wrapper.jsx` | ステージラッパー |
| `packages/scratch-gui/src/containers/stage-header.jsx` | ステージヘッダー (size 切替、フルスクリーン) |
| `packages/scratch-gui/src/containers/stage-selector.jsx` | ステージ自体の選択 (sprite-pane の "Stage") |

#### コントロール

| ファイル | 役割 |
|---|---|
| `packages/scratch-gui/src/containers/controls.jsx` | 緑旗 + 停止ボタン |
| `packages/scratch-gui/src/components/green-flag/` | 緑旗 UI |
| `packages/scratch-gui/src/components/stop-all/` | 停止ボタン UI |

#### 表示モード

| ファイル | 役割 |
|---|---|
| `packages/scratch-gui/src/components/turbo-mode/` | ターボモード表示 |
| `packages/scratch-gui/src/components/nineties-mode/` | 90s モード |
| `packages/scratch-gui/src/components/oldtimey-mode/` | oldtimey モード |
| `packages/scratch-gui/src/components/prehistoric-mode/` | prehistoric モード |
| `packages/scratch-gui/src/containers/turbo-mode.jsx` | ターボモード コンテナ |

#### 背景

- `packages/scratch-gui/src/containers/backdrop-library.jsx` — 背景ライブラリ

#### Smalruby マーカー (upstream への埋め込み)

`packages/scratch-gui/src/components/gui/gui.jsx` 内：
- "iPad portrait narrow desktop stage size" — 744〜1023px viewport で `stageSize` を `'small'` に強制（issue #572 Phase 3-C, #599）

#### State 管理

- `packages/scratch-gui/src/reducers/stage-size.js`
- `packages/scratch-gui/src/reducers/mode.js` — 表示モード
- `packages/scratch-gui/src/reducers/vm-status.js` — VM 実行状態

### scratch-vm / scratch-render

ステージ描画は `scratch-render` (WebGL) を使用。

### infra

なし。

## 関連ブロック

ステージは特定のブロックに紐づかないが、以下が関連：

| ブロック | 説明 |
|---|---|
| `event_whenflagclicked` | 緑旗クリックで発火 |
| `event_whenstageclicked` | ステージクリックで発火 |
| `event_whenbackdropswitchesto` | 背景切替時 |
| `looks_switchbackdropto` | 背景切替 |
| `looks_nextbackdrop` | 次の背景 |

> 各ブロックの Ruby 表現は [`docs/smalruby-language-spec.ja.md`](../smalruby-language-spec.ja.md) を参照。

## 設定・データ永続化

### Redux state

- `stage-size` — small / large / fullscreen
- `mode` — 表示モード
- `vm-status` — running / stopped

### Smalruby 独自 narrow-desktop ロジック

`@media (max-width: 1023px) and (min-width: 744px)` で stage を `'small'` に強制。詳細は [`docs/mobile-ui/`](../mobile-ui/) 参照。

## 関連ドキュメント

- [`docs/sprite/`](../sprite/) — スプライト管理
- [`docs/costume/`](../costume/) — 背景はコスチュームの一種
- [`docs/mobile-ui/`](../mobile-ui/) — iPad portrait での stage size 調整

## 関連 Issue / PR

- Issue #572 Phase 3-C — iPad portrait narrow desktop stage size
- Issue #599 — 768→744px へのしきい値拡張
- Issue #602 — Ruby tab の column overflow
