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
- 自己参照アップグレードモーダル: `src/containers/mesh-v2-upgrade-modal.jsx`、`src/components/mesh-v2-upgrade-modal/`、`src/reducers/mesh-v2.js`（`upgradeModalVisible`）、解説ページ `pages/mesh-self-sensor.html`

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

## 変数同期とセンサーの値の仕組み

旧 Mesh (`mesh`) と同様、Mesh v2 も **標準ブロックのランタイム関数を差し替え (HOC)** してグローバル変数と broadcast を伝播する。

### 送信側（自分が変数を変更したとき）

接続時 (`connect`) に `setOpcodeFunctionHOC` / `setVariableFunctionHOC` が以下を差し替える（`index.js:472-615`）。

- `data_setvariableto` / `data_changevariableby` → ローカル実行 ＋ `syncVariable(args)` → `meshService.sendData([{key, value}])`
- `createNewGlobalVariable` / `createVariable` / `setVariableValue` / `renameVariable` / `lookupOrCreateVariable` → ローカル実行 ＋ `sendData(...)`
- `event_broadcast` / `event_broadcastandwait` → ローカル実行 ＋ `meshService.fireEvent(name)`

`sendData` は `reportDataByNode` mutation で AppSync に送る（`data-sender.js:22-55`）。**送信するだけで、自ノードの受信ストアには書き込まない。**

### 受信側（他ノードのデータを受け取ったとき）

受信データは **`remoteData`**（`{ nodeId: { key: { value, timestamp } } }`）に格納される（`mesh-service.js:75`）。書き込みは **`handleDataUpdate(nodeStatus)` の 1 箇所のみ**で、WebSocket subscription / polling (`pollEvents`) / 定期同期 (`fetchAllNodesData`) の 3 経路すべてがここを通る。既定では自ノードのエコーを破棄するが、**`runtime.meshSelfInclusive` が true のときは自ノード分も取り込む**（後述「センサーの値の自己参照」）。

### センサーの値の読み取り

`getSensorValue(args)` → `meshService.getRemoteVariable(args.NAME)`（`index.js:188-192`）。`getRemoteVariable` は **`remoteData` を全ノード横断で走査し、同名キーのうち最新 `timestamp` の値**を返す（`data-sender.js:160-175`）。メニュー候補も `remoteData` のキーから生成される（`index.js:195-200`）。

```
[自分のステージ変数] --(set)--> sendData --(AppSync reportDataByNode)--> 配信
                                                                          └─> handleDataUpdate
                                                                                └─> remoteData (受信ストア)
                                                                                      └─> getRemoteVariable / getSensorValue
```

## センサーの値の自己参照（自分のグローバル変数を読む）

`meshV2_getSensorValue` は、**プロジェクト単位のフラグで切り替わる 2 つの動作**を持つ。

| 動作 | 既定 | 振る舞い |
|------|------|----------|
| **旧動作（自ノード除外）** | ✅ 既定 | `handleDataUpdate` で自ノードのエコーを破棄。`remoteData` には他ノードのデータしか入らず、自分の変数は読めない（同名を他ノードが送ってきた場合のみ返る）。 |
| **新動作（自己参照）** | フラグ true 時 | 自ノードのエコーも `remoteData` に取り込む。自分の変数も他ノードと同列に読める。 |

### 仕組み（新動作）

AppSync は **送信者にも自分の更新を配信する**。新動作では `handleDataUpdate` の自ノード除外を **`runtime.meshSelfInclusive` が true のときだけ撤廃**し（`subscription-manager.js`）、自ノードのエコーを `remoteData` に格納する。

- 自分も他者も **すべてサーバータイムスタンプで `remoteData` に入る** ため、クライアント/サーバー間のクロック不整合が起きない（ローカルシードはしない）。
- `getRemoteVariable` / `getSensorValue` / メニュー生成は変更不要。新動作では自ノードの変数名もメニュー候補に出る（エコー到着後）。
- 自分の変数が読めるのは **送信 → サーバーエコー受信の往復後**（接続時は `sendAllGlobalVariables` で全変数が送られる）。

### フラグの永続化（`meta.smalruby.meshSelfInclusive`）

新動作のオプトインはプロジェクト `meta.smalruby.meshSelfInclusive`（boolean）として保存される（`sb3.js` serialize/deserialize、`runtime.meshSelfInclusive` に保持）。**フィールドが無い／false なら旧動作**（mirrors `origin` の扱い。読み込みのたびにリセット）。

### 旧動作からの切り替え導線（アップグレードモーダル）

mesh 拡張を有効化したとき、フラグが新動作でなければ **毎回** モーダルを表示し、新動作への切り替えを促す（`containers/mesh-v2-upgrade-modal.jsx`、`EXTENSION_ADDED` を監視）。

- **新しい動きに切り替える** → `runtime.meshSelfInclusive = true` を設定しプロジェクトを dirty 化（保存で永続化）。
- **このまま続ける** → 何も保存しない。次回有効化時にまた表示され、常に切り替え導線が残る。
- 「くわしくはこちら」→ `pages/mesh-self-sensor.html`（about.html と同じ流儀の静的解説ページ）。

### 後方互換性

**メッシュは「同一グローバル変数名を複数ノードで共有しない」ことを前提**にしている（同名共有は挙動理解が困難なため）。この前提下では:

| 読み取り対象 | 旧動作 | 新動作 | 影響 |
|---|---|---|---|
| 他ノードの変数（共有しない名前） | 他ノードの最新値 | 同左（自ノードに同名 entry が無い） | **完全互換** |
| 自分の変数（誰も共有しない名前） | 常に `''` | 自分の最新値 | `''` 依存は想定不可 → 実質無害 |
| 同名を複数ノードが共有 | 相手の最新値 | 自分含む最新値 | 唯一の挙動変化（前提により対象外） |

既定は旧動作で挙動が変わらず、新動作は明示オプトインのみ。**broadcast の自ノード除外（`subscription-manager.js`、`polling-client.js`）は本変更の対象外で現状維持**のため、「変数は自分も読めるがメッセージは自分には届かない」非対称が残る。

> 関連: Issue #707。実装回帰の確認は scratch-vm のテスト（`test/unit/mesh_service_v2_timestamp.js`、`test/unit/mesh_v2_self_inclusive_serialization.js`、`test/integration/extensions/mesh-v2-variable-sync.test.js`）と [`docs/mesh-v2/`](../mesh-v2/) のデグレ確認手順を参照。

## 関連ドキュメント

- **[`docs/mesh-v2/`](../mesh-v2/)** — システム全体（**本拡張の親ドキュメント**）
- **[`docs/extension-mesh/`](../extension-mesh/)** — 旧 Mesh（`mesh`, SkyWay 版）拡張機能
- `.claude/rules/scratch-gui/mesh.md` — クライアント側開発ルール
- `.claude/rules/infra/smalruby-mesh-v2.md` — サーバ側開発ルール
