# 拡張機能: Mesh v2

> **🆕 Smalruby 独自** — upstream に存在しない、Smalruby のために新規追加された拡張機能

- **Smalruby ランタイム対応**: ❌（smalruby3 gem / Ruby SDL2 デスクトップランタイムは未対応。AppSync を介した通信のためブラウザ専用）
- **デフォルト表示**: ✅（拡張機能ライブラリにデフォルトで表示される）

## 概要

複数の Smalruby インスタンス間でリアルタイム通信できるネットワーク拡張機能。`broadcast` イベントの送受信と、グローバル変数の自動同期を提供する。

> **本ドキュメントは拡張機能としての観点を簡潔にまとめたもの**。
> 通信プロトコル、アーキテクチャ、AWS AppSync + DynamoDB バックエンド、コスト試算、運用、デグレ確認手順などの**システム全体像は [`docs/mesh-v2/`](../mesh-v2/) を参照**。

## ユーザーストーリー

詳細は [`docs/mesh-v2/`](../mesh-v2/) 参照。代表例：

- 友達のスモウルビーと自分のスモウルビーで「メッセージを送る」「相手の変数を読む」をして、複数人で動くゲームを作りたい
- 教室全員がインターネット越しに簡単な合言葉でグループに入れるようにしたい

## 主要ファイル

### scratch-gui

- 拡張機能登録: `packages/scratch-gui/src/lib/libraries/extensions/index.jsx` の `extensionId: 'meshV2'` エントリ
- 接続 UI（`mesh-v2-*-step.jsx`）と Redux state は [`docs/mesh-v2/`](../mesh-v2/) 参照

### scratch-vm

- `packages/scratch-vm/src/extensions/scratch3_mesh_v2/` — 拡張機能本体（mixin パターン、約 14 ファイル）

### infra

- `infra/smalruby-mesh-v2/` — AppSync + DynamoDB のサーバ実装

## 関連ブロック

| ブロック ID | 説明 |
|---|---|
| `meshV2_broadcast` | 名前付きイベントを送信 |
| `meshV2_broadcastAndWait` | イベント送信して受信側の処理完了を待つ |
| `meshV2_whenIReceive` | イベント受信時の Hat ブロック |
| `meshV2_getSensorValue` | 他ノードのグローバル変数を読み取り |

> 各ブロックの Ruby 表現は [`docs/smalruby-language-spec-extensions.ja.md`](../smalruby-language-spec-extensions.ja.md) を参照。

## 関連ドキュメント

- **[`docs/mesh-v2/`](../mesh-v2/)** — システム全体（**本拡張の親ドキュメント**）
- `.claude/rules/scratch-gui/mesh.md` — クライアント側開発ルール
- `.claude/rules/infra/smalruby-mesh-v2.md` — サーバ側開発ルール
