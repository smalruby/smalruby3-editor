# デバイス接続 (Connection Modal)

> **🔧 upstream 改良** — upstream にあるが Smalruby で機能を改良・拡張している
> **改良点**: ① Mesh v2 専用ステップ（`mesh-v2-*-step.jsx`）。② Smalrubot S1 専用フロー（`smalrubot-s1-*-step.jsx` × 5）。③ ファームウェアフラッシュ起動の差し込み。④ ネットワークフィルター検出。⑤ 接続済みメッセージのカスタマイズ。

## 概要

外部デバイス（micro:bit, Smalrubot S1, EV3, BOOST, WeDo, Mesh v2 など）への接続を管理する**共通基盤**。upstream の `connection-modal` を継承しつつ、Smalruby は Mesh v2 / Smalrubot S1 / micro:bit More 等の独自・改良デバイス用にステップを追加している。

各デバイスごとの機能詳細は対応する拡張機能ドキュメントを参照（[`docs/extension-mesh-v2/`](../extension-mesh-v2/), [`docs/extension-smalrubot-s1/`](../extension-smalrubot-s1/) など）。

## ユーザーストーリー

- **デバイスを持っている小学生**として、Smalruby を開いてデバイスに接続するまでの手順を一貫した UI で行いたい
- **教室の生徒**として、教師の指示通りにペアリング・接続できるようガイド付きの画面で進めたい
- **接続失敗時の子**として、エラー時に何をすべきか（ファームウェア書き込み、ネットワーク確認等）が画面で示されてほしい

## UI / 操作フロー

接続モーダルは **共通のフェーズ管理** で動作し、選んだ拡張機能に応じて表示するステップが切り替わる：

| フェーズ | 説明 | UI コンポーネント |
|---|---|---|
| initial | 初期画面 | `*-initial-step.jsx` |
| scanning | デバイススキャン中 | `*-scanning-step.jsx` |
| connecting | 接続試行中 | `*-connecting-step.jsx` |
| connected | 接続成功 | `*-connected-step.jsx` / `connected-step.jsx` |
| error | エラー | `*-error-step.jsx` / `error-step.jsx` |
| unsupported | 環境非対応 | `*-unsupported-step.jsx` / `unsupported-browser-step.jsx` |

## 主要ファイル

### scratch-gui

#### コンテナ / 共通 UI

- `packages/scratch-gui/src/containers/connection-modal.jsx` — 接続モーダルコンテナ（フェーズ振り分け、Smalruby マーカーで Smalrubot/Mesh v2 フロー追加）
- `packages/scratch-gui/src/components/connection-modal/` — 共通ステップ UI

#### Smalruby 独自ステップ

- `packages/scratch-gui/src/components/connection-modal/mesh-v2-initial-step.jsx`
- `packages/scratch-gui/src/components/connection-modal/mesh-v2-network-filtered-step.jsx` — ネットワークフィルター検出
- `packages/scratch-gui/src/components/connection-modal/mesh-v2-scanning-step.jsx`
- `packages/scratch-gui/src/components/connection-modal/smalrubot-s1-initial-step.jsx`
- `packages/scratch-gui/src/components/connection-modal/smalrubot-s1-connecting-step.jsx`
- `packages/scratch-gui/src/components/connection-modal/smalrubot-s1-connected-step.jsx`
- `packages/scratch-gui/src/components/connection-modal/smalrubot-s1-error-step.jsx`
- `packages/scratch-gui/src/components/connection-modal/smalrubot-s1-unsupported-step.jsx`

#### Smalruby マーカー (upstream への埋め込み)

`src/components/connection-modal/connection-modal.jsx` 内：
- meshV2 initial step
- network filter detection
- smalrubotS1 dedicated flow (PHASES, ステップ振り分け, propTypes)

`src/containers/connection-modal.jsx` 内：
- smalrubot firmware flash 起動
- smalrubotS1 dedicated flow handlers
- meshV2 initial step / connected message / back button

`src/components/connection-modal/error-step.jsx` 内：
- smalrubot firmware flash button

`src/components/connection-modal/connected-step.jsx` 内：
- meshV2 connected message

詳細マーカー一覧: `.claude/rules/scratch-gui/smalruby-markers.md`

#### State 管理

- `packages/scratch-gui/src/reducers/connection-modal.js` — 接続モーダル state

### scratch-vm

各拡張機能の VM 側実装が **PeripheralEvents** (`extension-support/peripheral-events.js`) を発行し、それをコネクションモーダルが購読する形。

### infra

なし（接続はクライアント側で完結）。

## 関連ブロック

なし（接続管理 UI のため）。

## 設定・データ永続化

なし（接続情報は揮発的）。

## 関連ドキュメント

- [`docs/extension-mesh-v2/`](../extension-mesh-v2/), [`docs/mesh-v2/`](../mesh-v2/) — Mesh v2 接続詳細
- [`docs/extension-smalrubot-s1/`](../extension-smalrubot-s1/) — Smalrubot S1 接続 + ファームウェアフラッシュ
- [`docs/extension-microbit-more/`](../extension-microbit-more/) — micro:bit More 接続
- [`docs/extension-microbit/`](../extension-microbit/) — 標準 micro:bit 接続
- [`docs/extension-ev3/`](../extension-ev3/), [`docs/extension-boost/`](../extension-boost/), [`docs/extension-wedo2/`](../extension-wedo2/) — LEGO 系接続
- [`docs/extension-gdxfor/`](../extension-gdxfor/) — Vernier センサ接続
- `.claude/rules/scratch-gui/smalruby-markers.md` — upstream マーカー一覧

## 関連 Issue / PR

主要 PR は履歴を参照（`feat:.*connection|feat:.*smalrubot.*flow` で grep）。
