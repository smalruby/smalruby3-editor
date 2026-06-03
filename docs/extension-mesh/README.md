# 拡張機能: Mesh（旧 Mesh / mesh）

> **🆕 Smalruby 独自** — upstream に存在しない、Smalruby のために追加された拡張機能

> **⚠️ レガシー** — 外部サービス **SkyWay (skyway-js)** に依存する旧実装。SkyWay の旧 API 終了に伴い実質的に動作しないため、後継の [Mesh v2](../extension-mesh-v2/) に置き換えられている。本ドキュメントは**仕様調査・後継機能設計の参照用**に残す。

- **拡張機能 ID**: `mesh`（カテゴリ表示名は "Old Mesh"）
- **Smalruby ランタイム対応**: ❌（ブラウザ専用。WebRTC / SkyWay を利用）
- **デフォルト表示**: 状況により非表示（後継の `meshV2` が既定）

## 概要

複数の Smalruby インスタンス間で、**broadcast イベント**と**グローバル変数**をリアルタイム共有するネットワーク拡張機能。SkyWay の P2P ルーム（`Room`）を使い、ホスト 1 台に各メンバーが接続する star 型トポロジで通信する。

ピアのいずれかがグローバル変数を変更すると、その値が他ピアに伝播し、受信側は **`センサーの値`ブロック (`mesh_getSensorValue`)** で参照できる。

> 後継の Mesh v2（AppSync + DynamoDB バックエンド）の全体像は [`docs/mesh-v2/`](../mesh-v2/) および [`docs/extension-mesh-v2/`](../extension-mesh-v2/) を参照。

## ユーザーストーリー

- **小学生**として、友達のスモウルビーと自分のスモウルビーで「メッセージを送る」「相手の変数を読む」をして、複数人で動くゲームを作りたい
- **教師**として、教室の全員を簡単な合言葉（メッシュ ID）で 1 つのグループに入れたい

## 主要ファイル

### scratch-vm

`packages/scratch-vm/src/extensions/scratch3_mesh/`

| ファイル | 役割 |
|---|---|
| `index.js` | 拡張機能本体。ブロック定義、ランタイム関数の差し替え（HOC）、`getSensorValue` |
| `mesh-service.js` | 通信の中核。SkyWay の `Peer` / `Room` 管理、変数・イベントの送受信、受信値ストア |
| `mesh-host.js` | ホスト役のサービス（`MeshService` を継承） |
| `mesh-peer.js` | メンバー役のサービス（`MeshService` を継承） |

## 関連ブロック

| ブロック ID | 説明 |
|---|---|
| `mesh_getSensorValue` | **他ノード**のグローバル変数を読み取る（`センサーの値`） |

> broadcast とグローバル変数の同期は専用ブロックではなく、標準の `event_broadcast` / `data_setvariableto` 等の**ランタイム関数を差し替えて**実現している（後述）。

## 変数同期とセンサーの値の仕組み

### 標準ブロックの差し替え（HOC）

接続時 (`connect`) に `setOpcodeFunctionHOC` / `setVariableFunctionHOC` が呼ばれ、Scratch 標準の以下の関数を拡張機能側のラッパーに差し替える（`index.js:202-304`）。

- `event_broadcast` / `event_broadcastandwait` → ローカル実行 **＋** `meshService.sendBroadcastMessage(name)`
- `data_setvariableto` / `data_changevariableby` → ローカル実行 **＋** `sendVariableByOpcodeFunction(args)`
- `runtime.createNewGlobalVariable`、`stage.createVariable` / `setVariableValue` / `renameVariable` / `lookupOrCreateVariable` → ローカル実行 **＋** `meshService.sendVariableMessage(name, value)`

つまり「自分が変数を変更する」操作はすべて、**`sendVariableMessage` で他ピアに送信するだけ**で、ローカルには Scratch のステージ変数として残る。

### 受信値の格納

受信側は `onRoomData` → `variableAction` / `variablesAction` → **`setVariable(name, value, owner)`** で、サービス内の専用ストア `this.variables`（`{name: {name, value, owner}}`）に格納する（`mesh-service.js:369-395, 446-463`）。

### センサーの値の読み取り

`getSensorValue(args)` は `meshService.getVariable(args.NAME)` を呼び、この**受信専用ストア `this.variables` だけ**を読む（`index.js:122-124`、`mesh-service.js:389-395`）。メニュー候補 `getVariableNamesMenuItems` も `meshService.variableNames`（= 受信した名前のみ）を返す。

```
[自分のステージ変数] --(set)--> sendVariableMessage --(SkyWay)--> 他ピア
                                                                    └─> setVariable
                                                                          └─> this.variables (受信ストア)
                                                                                └─> getVariable / getSensorValue
```

## 調査結果: 自身のグローバル変数はセンサーの値で参照できるか → **参照できない**

**結論: 旧 Mesh では、`センサーの値`ブロックで自分自身が設定したグローバル変数を読み取ることはできない。**

理由（コードレベル）:

1. 自分が変数を設定する経路（差し替えた `setVariableTo` 等 → `sendVariableMessage`）は、**送信するだけ**で受信ストア `this.variables` には一切書き込まない。
2. `this.variables` への書き込みは `setVariable()` だけが行い、それは `variableAction` / `variablesAction`、すなわち **`onRoomData`（他ピアからの受信）経由でしか呼ばれない**。
3. `getVariable(name)` は `this.variables[name]` が無ければ空文字 `''` を返す（`mesh-service.js:389-395`）。

したがって、自分の変数名を `センサーの値`に指定しても、

- 同名の変数を**他のピアが設定して送ってきた場合のみ**その値が返る（= 他人の値で上書きされる）。
- 誰も送ってきていなければ `''` が返る。

メニュー候補にも自分の変数名は現れない（受信した名前しか出ない）。

> 補足: ピア参加時 (`onRoomPeerJoin`) に `getGlobalVariables()` で自分の全グローバル変数を相手へ一括送信するが (`mesh-service.js:294-319`)、これも**送信側自身の受信ストアには入らない**ため、自分での参照可否には影響しない。

## 後継 Mesh v2 との関係

Mesh v2 も**同じ設計思想**（送信専用 / 受信専用ストアを分離し、自ノードを参照対象から除外）を踏襲しており、`meshV2_getSensorValue` でも**自身のグローバル変数は参照できない**。詳細と、自身の変数も参照可能にする拡張案は [`docs/extension-mesh-v2/`](../extension-mesh-v2/) を参照。

## 関連ドキュメント

- **[`docs/extension-mesh-v2/`](../extension-mesh-v2/)** — 後継拡張機能（推奨）
- **[`docs/mesh-v2/`](../mesh-v2/)** — Mesh v2 のシステム全体像
- [`docs/smalruby-language-spec-extensions.ja.md`](../smalruby-language-spec-extensions.ja.md) — 各ブロックの Ruby 表現（`mesh.sensor_value(名前)`）
