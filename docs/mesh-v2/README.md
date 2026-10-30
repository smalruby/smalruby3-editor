# Mesh v2

> **🆕 Smalruby 独自** — upstream に存在しない、Smalruby のために新規追加された機能

## 概要

複数の Smalruby インスタンス間で **broadcast event** と **グローバル変数** をリアルタイム共有する機能。子供たちが教室や家庭でネットワークを通じて連携した作品（複数人で協力するゲーム、リレー型のお絵描きなど）を作れるようにする。

旧 Mesh (v1) は外部サービス Skyway に依存していたが、v1 のサービス停止に伴い、AWS AppSync + DynamoDB をバックエンドに自社で再構築したのが Mesh v2。

## ユーザーストーリー

- **小学生**として、友達のスモウルビーと自分のスモウルビーで「メッセージを送る」「相手の変数を読む」をして、複数人で動くゲームを作りたい
- **教師**として、教室全員がインターネット越しに簡単な合言葉でグループに入れて、リアルタイム通信を体験させたい
- **家庭学習中の子**として、別の場所にいる家族や友達と画面を分けて協力プレイができる作品を作りたい

## UI / 操作フロー

1. ブロックパレットの「拡張機能を追加」から **Mesh** を選ぶ
2. 接続モーダル (`connection-modal`) が開く。**ホスト**として新しいグループを作るか、**メンバー**として既存グループ名で参加するかを選択

   ![接続モーダル初期画面](screenshots/0101-modal-initial-1280x800.png)

3. ホスト選択時：自動的にランダムグループ名（例: `【いきたにんた】`）が割り当てられて登録完了

   ![ホスト登録完了](screenshots/0102-modal-host-created-1280x800.png)

4. 「エディターへ行く」でブロックパレットに戻ると、メッシュカテゴリに緑チェックが付く

   ![ブロックパレット - mesh 接続済み](screenshots/0201-block-palette-active-1280x800.png)

5. メニューバーの「メッシュ」をクリックすると、ドメイン / グループ名 / **接続期限のカウントダウン** が確認できる

   ![メッシュメニューの接続状態](screenshots/0202-menu-status-with-timer-1280x800.png)

   メッシュカテゴリのブロックは少なく、`センサーの値` で他ノードのグローバル変数を読み取るのが基本。

   ![メッシュ ブロックパレット](screenshots/0301-block-palette-only-1280x800.png)

6. 接続後、`broadcast` ブロックでイベント送信、グローバル変数の自動同期、`mesh.sensor_value(name)` で他ノードの値読み取りが可能に
7. グループの最大接続時間は **35 分**（`MESH_MAX_CONNECTION_TIME_SECONDS`）

通信モードは環境に応じて自動選択される：

| モード | リアルタイム配信 | 環境制約 |
|---|---|---|
| **WebSocket** | AppSync subscription | プロキシ/フィルタが WebSocket を許可 |
| **Polling** | 2 秒周期の query | フォールバック（403/503 で WebSocket 不可な環境）|

URL パラメータ `?force_polling=1` でクライアント側から強制 polling 化できる。

### クラス管理との連動

クラスに参加中（生徒）または先生がクラス管理でクラスを選択中の場合、**Mesh ドメインはそのクラスの参加コードに自動で固定される**。

- 例: 参加コードが `xuzk93` のクラスに参加中 → Mesh ドメインの初期値・固定値は `xuzk93`
- 接続モーダルのドメイン入力欄は読み取り専用になる（クラスを抜けると編集可能に戻る）
- 同じクラスの先生・生徒は自動的に同じドメインに集まるため、グループ検索・参加が容易になる
- 先生の「選択中のクラス」は Redux 上に保持される（モーダルを閉じても維持／ページリロードでクリア。先生 idToken のキャッシュ仕様と整合）
- **連動解除時の挙動**: 生徒がクラスから退出 / 先生がログアウトすると、Mesh ドメインは**連動前の値に戻る**（連動開始時にスタッシュ）。連動前にユーザーが手動で設定したドメインや URL `?mesh=` のデフォルト値が復元される

実装: `packages/scratch-gui/src/lib/mesh-v2-classroom-binding.jsx`

#### 出席番号（グループ名・ノード ID）

クラス参加中は、出席番号をグループ名とノード ID に入れる。**メッシュのサーバーは変えない**（名前はただの文字列として保存され、ノード ID は `GROUP#<groupId>#NODE#<nodeId>` のキーの一部になるだけ）。

- **ノード ID**: 生徒は末尾に `s<2 桁以上の番号>` が付く（例 `…s07`）。先生とクラス外では付かない。元の ID は uuid の hex なので `s` で区別できる。グループ内のノード一覧 `listNodesInGroup`（`MeshV2Service#listNodesInGroup`）を読めば、何番が参加したかが分かる。ノード ID はグループに入っている間は変えない（接続中に `setClassroomSeat` で番号が変わったら覚えておき、次の接続の開始時（`connect`）に反映する。どの経路から接続しても最新の番号になる）。
- **グループ名**: 先頭はホストのノード ID のまま、うしろに `|` 区切りで番号の情報を足す。

  | 場面 | グループ名 |
  |---|---|
  | クラス外 | `<hostNodeId>`（従来どおり） |
  | 生徒が「ホストになる」 | `<hostNodeId>\|host=7` |
  | 先生が「ホストになる」 | `<hostNodeId>\|host=teacher` |
  | 番号を選んだグループ | `<hostNodeId>\|seats=3,7,12\|host=3` |

  先頭 6 文字から作る合言葉（`makeMeshIdLabel`）と、名前の前方一致で探す `searchGroupsByNamePrefix` は変わらないので、古いクライアントには従来どおりの名前に見える。壊れた名前や古い名前は「番号の情報なし」として扱う。
- **名前を信じすぎない**: グループ名とノード ID はほかのクライアントが自由に決められ、サーバーは長さも文字も検査しない。そのため読み取り（`parseGroupName`）は厳しくし、次のどれかに当たる名前は「番号の情報なし」（従来の「【…】」表示）にする: 名前が 512 文字を超える / 先頭がノード ID の形（16 進 + 任意の `s<番号>`）でない / 番号が 1〜999 の範囲外・重複・100 個超 / `host=<番号>` が先頭のノード ID の番号と一致しない / `host=teacher` なのに先頭に番号が付いている / 先頭がサーバーに記録されたホスト（`hostId`）と一致しない。それでも番号の情報は**ホストの自己申告**であり、本人確認ではない（「先生のグループ」と名乗ることは、合言葉＝ドメインを知っていれば誰でもできる）。一覧の表示と参加前の確認にだけ使い、権限の判断には使わない。
- **一覧の表示**（クラス参加中のみ）: 「3・7・12番のグループ（ほしくま）」「7番がホストのグループ（…）」「先生のグループ（…）」。番号の情報が無いグループとクラス外では従来の「【…】」のまま。
- **選ばれていない番号での参加**: `seats=` のグループに含まれない番号の生徒が入ろうとすると、確認（「このグループは 3・7・12番用です。あなた（20番）は選ばれていません。それでも参加しますか？」）を出す。

実装: `packages/scratch-vm/src/extensions/scratch3_mesh_v2/seat-naming.js`（名前の組み立て・読み取りの純粋関数）、`packages/scratch-gui/src/lib/mesh-v2-seat-label.js`（一覧の表示と確認の判定）

end-to-end 動作確認: [`tools/playwright-verify/mesh-v2-classroom-binding.mjs`](../../tools/playwright-verify/README.md) — 2 タブ (教師 + 生徒) を自動で操作してドメイン連動を検証する手動 E2E スクリプト。

### クラスで読み込んだ作品の接続モーダル自動表示

生徒がクラスの流れで作品を読み込んだとき、次の 3 つがすべて当てはまれば、拡張の接続ボタンと同じ接続モーダル（`meshV2`）を**自動で開く**。授業で生徒が接続ボタンを探して止まらないようにするため。

1. 読み込み元がクラスの流れ: スターター（選択肢の「スターターから始める」・課題パネルの「スタータープロジェクトを開く」）、または提出物から続ける（前回 / 今回）
2. 読み込んだ作品がメッシュ拡張を使っている（mesh v1 から v2 へ移行された作品も含む）
3. まだメッシュに接続していない

- **クラスのモーダルと重ねない**: 接続モーダルはクラスのモーダル（生徒・先生とも）が閉じてから開く。選択肢から始めた場合は読み込み直後にクラスのモーダルが閉じるのでそのまま開き、課題パネルの「スタータープロジェクトを開く」でパネルが開いたままの場合は、**パネルを閉じたときに開く**（その場で前面に出すと課題パネルと接続モーダルが重なり、どちらを操作すればよいか分かりにくいため）。
- **出さない**: 上書き確認をキャンセルしたとき、読み込みに失敗したとき、メッシュを使わない作品を読み込んだとき（それ以前の未表示の依頼も取り消す）、表示までの間に接続済みになったとき。
- **1 回だけ**: 依頼は開いた時点で消える。生徒が接続モーダルを閉じても、次にクラスの流れで読み込むまでは再表示しない。
- 対象外: 先生が提出物を開く経路、クラス外でのファイル / URL 読み込み。

実装: 判定 = `packages/scratch-gui/src/lib/classroom-mesh-connect.js`（純粋関数）、依頼 = `src/containers/use-student-assignment.js` → Redux `classroom.meshConnectPending`、表示 = `src/containers/classroom-mesh-connect-prompt.jsx`。

end-to-end 動作確認: [`tools/playwright-verify/verify-classroom-mesh-connect.mjs`](../../tools/playwright-verify/README.md)。

## 主要ファイル

### scratch-gui

- **拡張機能登録**: `packages/scratch-gui/src/lib/libraries/extensions/index.jsx` — `extensionId: 'meshV2'`
- **接続 UI（接続モーダルの mesh-v2 専用ステップ）**:
  - `packages/scratch-gui/src/components/connection-modal/mesh-v2-initial-step.jsx`
  - `packages/scratch-gui/src/components/connection-modal/mesh-v2-network-filtered-step.jsx`
  - `packages/scratch-gui/src/components/connection-modal/mesh-v2-scanning-step.jsx`
- **状態管理**: `packages/scratch-gui/src/reducers/mesh-v2.js`
- **Ruby 連携**:
  - `packages/scratch-gui/src/lib/ruby-generator/mesh_v2.js` — Ruby コード → mesh ブロック変換
  - `packages/scratch-gui/src/lib/ruby-to-blocks-converter/mesh_v2.js` — mesh ブロック → Ruby コード

### scratch-vm（拡張機能本体）

`packages/scratch-vm/src/extensions/scratch3_mesh_v2/`:

| ファイル | 責務 |
|---|---|
| `index.js` | scratch 拡張ブロック定義、UI 連携 |
| `mesh-service.js` | ファサード。各 manager mixin を集約 |
| `mesh-client.js` | Apollo Client、GraphQL endpoint URL |
| `gql-operations.js` | GraphQL queries / mutations / subscription 定義 |
| `network-filter.js` | エラー分類、503 検出、testWebSocket |
| `periodic-sync.js` | WebSocket モード時の 15 秒 fallback (`fetchAllNodesData`) |
| `polling-client.js` | Polling モードの 2 秒周期 (`pollEvents` / `POLL_GROUP_DATA`) |
| `subscription-manager.js` | WebSocket subscription 受信 |
| `heartbeat-manager.js` | host/member heartbeat と接続タイマー |
| `data-sender.js` | グローバル変数送信 (REPORT_DATA) |
| `broadcast-receiver.js` | 受信した event を順序保証して Scratch broadcast に流す |
| `event-sender.js` | `fireEvent` キューイング + バッチ送信 + orderKey 生成 |
| `group-lifecycle.js` | createDomain / createGroup / joinGroup / leaveGroup |
| `rate-limiter.js` | `sendData` の rate limit + マージ |
| `utils.js`, `name-search-utils.js` | URL パラメータ、グループ名検索 |
| `seat-naming.js` | 出席番号入りのグループ名・ノード ID の組み立てと読み取り |

### infra/smalruby-mesh-v2 (CDK + AppSync + DynamoDB)

サーバー側実装。詳細は専用ドキュメントを参照：

- [`infra/smalruby-mesh-v2/docs/architecture.md`](../../infra/smalruby-mesh-v2/docs/architecture.md) — システムアーキテクチャ、データフロー、テーブル設計
- [`infra/smalruby-mesh-v2/docs/api-reference.md`](../../infra/smalruby-mesh-v2/docs/api-reference.md) — GraphQL スキーマ完全リファレンス
- [`infra/smalruby-mesh-v2/docs/deployment.md`](../../infra/smalruby-mesh-v2/docs/deployment.md) — デプロイ手順
- [`infra/smalruby-mesh-v2/docs/development.md`](../../infra/smalruby-mesh-v2/docs/development.md) — 開発ガイド
- [`infra/smalruby-mesh-v2/docs/operations.md`](../../infra/smalruby-mesh-v2/docs/operations.md) — モニタリング・コスト・スケーリング

## 関連ブロック

Mesh 拡張機能のブロックは「メッセージ送信」「他ノードの変数読み取り」が中心：

| ブロック ID | 説明 |
|---|---|
| `meshV2_broadcast` | 名前付きイベントを送信 |
| `meshV2_broadcastAndWait` | イベント送信して受信側の処理完了を待つ |
| `meshV2_whenIReceive` | イベント受信時の Hat ブロック |
| `meshV2_getSensorValue` | 他ノードのグローバル変数を読み取り |

> 各ブロックの詳細仕様は [`docs/smalruby-language-spec-extensions.ja.md`](../smalruby-language-spec-extensions.ja.md) を参照。

## 設定・データ永続化

### 環境変数（クライアント側、`.env`）

- `MESH_GRAPHQL_ENDPOINT` — AppSync GraphQL エンドポイント
- `MESH_API_KEY` — API キー
- `MESH_AWS_REGION` — リージョン (`ap-northeast-1`)

### localStorage

- `meshV2:domain` — ユーザー固有のドメイン名（CRC32 ハッシュベース）

### URL パラメータ

- `?force_polling=1` — Polling モード強制
- `?mesh_debug=1` — mesh 通信のデバッグログを表示

## コスト

詳細試算は **[`cost.md`](cost.md)** を参照。AppSync + DynamoDB の per-operation 単価と production 設定での月額試算を網羅。

## 開発・テスト

mesh は最重要機能のため、関連コードを変更したときは必ず **Playwright によるデグレ確認** を実施する。手順は `.claude/rules/scratch-gui/mesh.md` の「デグレ確認手順」を参照（heartbeat TTL の関係で 5 分以内に完了させること）。

```bash
# 単体テスト
bin/dx bash -c "cd packages/scratch-vm && npm exec tap -- test/unit/mesh_service_v2*.js"

# integration test
bin/dx bash -c "cd packages/scratch-vm && npm exec jest test/integration/extensions/mesh-v2-*.test.js"
```

## 関連ドキュメント

- [`cost.md`](cost.md) — AWS コスト試算
- [`docs/extension-mesh-v2/`](../extension-mesh-v2/) — 拡張機能としての観点 (準備中、本ページとの分担は要検討)
- `.claude/rules/scratch-gui/mesh.md` — クライアント側開発ルール、デグレ確認手順
- `.claude/rules/infra/smalruby-mesh-v2.md` — サーバー側開発ルール

## 関連 Issue / PR

- 旧 Mesh (v1) → v2 移行: 複数の関連 Issue
- Issue #554 (pollGroupData 統合) — PR #564
- Issue #555 (プロトコルロギング) — PR #557
- Issue #556 (orderKey によるイベント順序保証) — PR #563
- Issue #566 (mesh-service.js 責務分割) — PR #569
- Issue #592 (Skyway 停止対応によるバックパック自動マイグレーション)
