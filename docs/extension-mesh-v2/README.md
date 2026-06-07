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

- **仕組み**: 自ノード値は 2 経路で `remoteData` に入る。①**ローカルシード**: `sendData`（`data-sender.js`）がデルタフィルタ通過時に自ノード値をクライアントタイムスタンプ付きで即時格納する。ローカルの `broadcast` は同期実行されるため、エコー往復（レートリミット 1 秒 + ネットワーク）を待たずに `when_receive` ハンドラから設定直後の自分の変数を読める。②**エコー**: AppSync は送信者にも自分の更新をエコーし、`handleDataUpdate`（`subscription-manager.js`）が取り込む（自ノード除外なし）。`getRemoteVariable` は `remoteData` を全ノード横断で最新タイムスタンプ勝ちで読むため、常に自分の値を優先するのではなく、他ノードからより新しい値が届けばそちらが返る。
- **クロックずれの自己修復**: シードはクライアント時計、他ノードの値はサーバー時計のため、エコー到着時に正規化する。自ノードのエコーが**シード値と同値**なら timestamp をサーバー時刻に置き換え（時間ドメインを統一）、**異値**なら古い書き込みのエコーなので無視する（連続書き込み時にシード値を保護）。クロックずれによる新旧逆転は最大でも次のエコー到着（1〜2 秒）までに収束する。
- **明示的なセットは同値でも「新しい書き込み」**: ブロック / Ruby からの変数セット（`data_setvariableto` 等の HOC 経路）は、値が前回と同じでも `sendData(data, {force: true})` で送られ、デルタフィルタをバイパスして**シードのタイムスタンプ更新と REPORT_DATA 再送の両方**が起きる。相互送信イディオム（各ノードが `$送信者 = "A"` / `"B"` を再セットしては broadcast し合い、受信側で `sensor_value("送信者") != $送信者` で自他を判別する）を成立させるために必要。接続時の一括同期（`sendAllGlobalVariables`）は従来どおりデルタ抑制される。コスト上限は RateLimiter により最大 1 mutation/秒/ノード。
- **ドロップダウン候補**: `getVariableNamesMenuItems`（`index.js`）は、ネットワーク受信名（`remoteData`）に加えて**自プロジェクトのグローバルスカラー変数名**（`getGlobalVariables()`）を合算する。これにより、起動直後・接続前でもプリセット変数を含む自分の変数が候補に出る（ネットワーク往復に依存しない）。
- **broadcast は対象外**: メッセージ（`meshV2_broadcast` 系）は従来どおり自ノードを除外する（自分が送ったメッセージは自分には届かない）。変数とメッセージで非対称。

### 後方互換性と一度きりの通知

「同一グローバル変数名を複数ノードで共有しない」前提のもとでは、他ノード変数の読み取り（本来の用途）は不変で、変わるのは「自分の変数を読むと空文字ではなく自分の値が返る」点のみ。

唯一挙動が変わりうるのは **グローバル変数名とセンサーの値の指定が重複** しているプロジェクト。これを検出したとき、**ブラウザで一度だけ**「動作が変わった」ことを非ブロッキングのバナーで知らせる（`localStorage: smalruby:meshSelfSensorNoticeShown`）。重複は読込・変数追加・リネーム・ドロップダウン変更・Ruby 編集のいずれでも生じうるため、全経路が集約される `PROJECT_LOADED` / `PROJECT_CHANGED` を監視して検出する。

関連実装（scratch-gui）:

- `src/lib/mesh-v2-sensor-collision.js` — 重複検出（センサーの値の名前はメニュー shadow ブロック `meshV2_menu_variableNames` の `variableNames` フィールドに入る）
- `src/components/mesh-self-sensor-notice/` — バナー / `src/containers/mesh-self-sensor-notice.jsx` — 監視と初回ガード
- `pages/mesh-self-sensor.html` — 解説ページ（バナーの「くわしくはこちら」から開く）

> 詳細経緯は Issue #707（自己参照仕様）と Issue #713（即時参照のローカルシード）。実装回帰の確認は `packages/scratch-vm/test/unit/mesh_service_v2_timestamp.js`、`packages/scratch-vm/test/integration/extensions/mesh-v2-variable-sync.test.js`、`packages/scratch-gui/test/unit/lib/mesh-v2-sensor-collision.test.js`、`tools/playwright-verify/verify-mesh-collision-paths.mjs` を参照。

### 既知の制限（クロスノードのレース）

他ノードが broadcast イベントを変数データより先に受信した場合、**受信側**で同様に「設定直後の変数がまだ届いていない」状態が起きうる（イベントと変数は別経路・別バッチで送信されるため）。解消にはイベントと変数のバンドル送信などプロトコル変更が必要で、本機能のスコープ外。

### 既知の制限（同時書き込みの順序）

各エントリのタイムスタンプは「変数を書いた瞬間」ではなく「REPORT_DATA mutation がサーバーで処理された時刻」になる（レートリミット待ちで最大 +1 秒程度ずれる）。そのため**複数ノードが同じ変数名を約 1〜1.5 秒以内に書き込むと、実際の書き込み順と逆に解決されることがある**。全ノードが同じサーバータイムスタンプで解決するため、ノード間で結果が食い違うことはない（グローバルに一貫した Last-Write-Wins）。人間操作ペース（数秒間隔）のやりとりでは実用上問題にならない。

## 関連ドキュメント

- **[`docs/mesh-v2/`](../mesh-v2/)** — システム全体（**本拡張の親ドキュメント**）
- `.claude/rules/scratch-gui/mesh.md` — クライアント側開発ルール
- `.claude/rules/infra/smalruby-mesh-v2.md` — サーバ側開発ルール
