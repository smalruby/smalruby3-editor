# アラート / エラー通知

> **⬆️ upstream そのまま** — upstream の実装をほぼそのまま利用

## 概要

ユーザーへの**通知・アラート・エラー表示**を扱う UI 機能群。upstream Scratch の `alerts` システムを継承し、各種モーダル（クラッシュ、未対応ブラウザ、WebGL 未対応、近日公開）を含む。Smalruby 固有の独自追加はないが、Smalruby 独自機能（Mesh v2、Rubytee 等）からも本仕組みを通じてアラートを発信する。

## ユーザーステップ

- **作品制作中の小学生**として、エラーが起きたら何が問題か分かるようにメッセージで通知してほしい
- **未対応ブラウザを使っている子**として、Smalruby が動かない理由がわかるようにしてほしい
- **作品が壊れてしまった子**として、クラッシュ時にもなるべく作業内容を保存できるよう案内してほしい

## UI / 操作フロー

### Alert

ステージ上部に滑り込むようにバナー表示される（自動消滅、もしくはクリックで閉じる）。

### Modal

| モーダル | 役割 |
|---|---|
| `crash-message` | クラッシュ時の致命的エラー画面 |
| `error-boundary` | React Error Boundary によるエラーキャッチ |
| `coming-soon` | 「近日公開」表示（一部 placeholder 機能用）|
| `browser-modal` | 未対応ブラウザ警告 |
| `webgl-modal` | WebGL 未対応警告 |

## 主要ファイル

### scratch-gui

#### コンテナ

| ファイル | 役割 |
|---|---|
| `packages/scratch-gui/src/containers/alerts.jsx` | アラート一覧コンテナ |
| `packages/scratch-gui/src/containers/alert.jsx` | 単一アラート |
| `packages/scratch-gui/src/containers/inline-messages.jsx` | インラインメッセージ |
| `packages/scratch-gui/src/containers/error-boundary.jsx` | Error Boundary HOC |

#### コンポーネント

- `packages/scratch-gui/src/components/alerts/`
- `packages/scratch-gui/src/components/crash-message/`
- `packages/scratch-gui/src/components/coming-soon/`
- `packages/scratch-gui/src/components/browser-modal/`
- `packages/scratch-gui/src/components/webgl-modal/`

#### State 管理

- `packages/scratch-gui/src/reducers/alerts.js` — アラートキュー
- `packages/scratch-gui/src/reducers/modals.js` — モーダル開閉
- `packages/scratch-gui/src/lib/alerts/` — アラート定義
- `packages/scratch-gui/src/lib/error-boundary-hoc.jsx` — Error Boundary HOC

### scratch-vm

VM のランタイムエラーや拡張機能エラーは `runtime.emit('PROJECT_ERROR', ...)` などで通知される。

### infra

なし。

## 関連ブロック

なし。

## 設定・データ永続化

### Redux state

- `alerts` — 表示中アラートのキュー
- `modals` — 各モーダルの開閉状態

## 関連ドキュメント

- [`docs/project-management/`](../project-management/) — クラッシュ時の自動保存
- 上流: [scratch-gui のドキュメント](https://github.com/scratchfoundation/scratch-gui)
