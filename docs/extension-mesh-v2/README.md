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
| `meshV2_getSensorValue` | グローバル変数を読み取り（**自ノードを含む**全ノードの同名変数の最新値） |

> 各ブロックの Ruby 表現は [`docs/smalruby-language-spec-extensions.ja.md`](../smalruby-language-spec-extensions.ja.md) を参照。

## センサーの値の自己参照（自分のグローバル変数も読む）

`meshV2_getSensorValue` は、**自ノードを含む**全ノードの同名グローバル変数のうち、最新タイムスタンプの値を返す。

- **仕組み**: AppSync は送信者にも自分の更新をエコーする。`handleDataUpdate`（`subscription-manager.js`）は自ノードのエコーも `remoteData` に取り込む（自ノード除外なし）。自分も他ノードも**サーバータイムスタンプで同列**に扱うため、クライアント/サーバー間のクロック不整合が起きない（ローカルシードはしない）。`getRemoteVariable` は `remoteData` を全ノード横断で最新勝ちで読む。
- **ドロップダウン候補**: `getVariableNamesMenuItems`（`index.js`）は、ネットワーク受信名（`remoteData`）に加えて**自プロジェクトのグローバルスカラー変数名**（`getGlobalVariables()`）を合算する。これにより、起動直後・接続前でもプリセット変数を含む自分の変数が候補に出る（ネットワーク往復に依存しない）。
- **broadcast は対象外**: メッセージ（`meshV2_broadcast` 系）は従来どおり自ノードを除外する（自分が送ったメッセージは自分には届かない）。変数とメッセージで非対称。

### 後方互換性と一度きりの通知

「同一グローバル変数名を複数ノードで共有しない」前提のもとでは、他ノード変数の読み取り（本来の用途）は不変で、変わるのは「自分の変数を読むと空文字ではなく自分の値が返る」点のみ。

唯一挙動が変わりうるのは **グローバル変数名とセンサーの値の指定が重複** しているプロジェクト。これを検出したとき、**ブラウザで一度だけ**「動作が変わった」ことを非ブロッキングのバナーで知らせる（`localStorage: smalruby:meshSelfSensorNoticeShown`）。重複は読込・変数追加・リネーム・ドロップダウン変更・Ruby 編集のいずれでも生じうるため、全経路が集約される `PROJECT_LOADED` / `PROJECT_CHANGED` を監視して検出する。

関連実装（scratch-gui）:

- `src/lib/mesh-v2-sensor-collision.js` — 重複検出（センサーの値の名前はメニュー shadow ブロック `meshV2_menu_variableNames` の `variableNames` フィールドに入る）
- `src/components/mesh-self-sensor-notice/` — バナー / `src/containers/mesh-self-sensor-notice.jsx` — 監視と初回ガード
- `pages/mesh-self-sensor.html` — 解説ページ（バナーの「くわしくはこちら」から開く）

> 詳細経緯は Issue #707。実装回帰の確認は `packages/scratch-vm/test/unit/mesh_service_v2_timestamp.js`、`packages/scratch-gui/test/unit/lib/mesh-v2-sensor-collision.test.js`、`tools/playwright-verify/verify-mesh-collision-paths.mjs` を参照。

## 関連ドキュメント

- **[`docs/mesh-v2/`](../mesh-v2/)** — システム全体（**本拡張の親ドキュメント**）
- `.claude/rules/scratch-gui/mesh.md` — クライアント側開発ルール
- `.claude/rules/infra/smalruby-mesh-v2.md` — サーバ側開発ルール
