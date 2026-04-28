# Mesh v2 API Reference

このドキュメントは、Mesh v2 GraphQL API の完全なリファレンスです。

## 概要

Mesh v2 は AWS AppSync を使用した GraphQL API を提供します。

- **プロトコル**: GraphQL over HTTPS (Queries/Mutations), WebSocket (Subscriptions)
- **認証**: API Key
- **エンドポイント**: デプロイ後に CloudFormation の Outputs で確認
- **言語**: GraphQL Schema Definition Language (SDL)

## GraphQL Schema 概要

### 主要な型定義

#### Group

```graphql
type Group {
  id: ID!           # group_id のみ
  domain: String!   # グローバル IP またはカスタム文字列（最大 256 文字）
  fullId: String!   # {id}@{domain}
  name: String!
  hostId: ID!       # 作成者ノード ID
  createdAt: AWSDateTime!
  expiresAt: AWSDateTime!  # グループの有効期限
  heartbeatIntervalSeconds: Int
  useWebSocket: Boolean!       # NEW: WebSocket 使用フラグ
  pollingIntervalSeconds: Int  # NEW: ポーリング間隔（useWebSocket=false の場合のみ）
}
```

#### Node

```graphql
type Node {
  id: ID!
  name: String!
  groupId: ID
  domain: String  # 所属しているdomain
  expiresAt: AWSDateTime
  heartbeatIntervalSeconds: Int
  useWebSocket: Boolean        # NEW: グループの設定を継承
  pollingIntervalSeconds: Int  # NEW: ポーリング間隔（useWebSocket=false の場合のみ）
}
```

#### SensorData

```graphql
type SensorData {
  key: String!
  value: String!
}
```

#### Event

```graphql
type Event {
  name: String!
  firedByNodeId: ID!
  groupId: ID!
  domain: String!
  payload: String
  timestamp: AWSDateTime!
  cursor: String           # NEW: ポーリング用のカーソル（SK）
  orderKey: String         # NEW (issue #556): クライアント側ソートキー
}
```

##### `orderKey` フィールド (issue #556)

クライアントが `EventInput.orderKey` を送信していたイベントの場合、サーバーは
DynamoDB の Sort Key と属性に保存し、`Event.orderKey` で返却します。
ポーリング (`getEventsSince`) や Subscription (`onMessageInGroup` の
`batchEvent.events`) 経由で受信したクライアントは、同一タイムスタンプの
イベントを `orderKey` の辞書順でソートすることで送信順を再現できます。

旧クライアントが送信していない場合は `null` が返ります（後方互換）。

##### `EventInput.orderKey` フォーマット

クライアントから送信する場合のフォーマット: `<YYYYMMDDHHMMSS>-<NNNNNNN>`

- `YYYYMMDDHHMMSS`: 14 桁のローカル時刻（人間可読、デバッグ用）
- `NNNNNNN`: 7 桁 0 詰め連番。クライアントがグループ作成/参加直後に 0 リセット、`fireEvent()` 呼び出しごとに +1
- 例: `20260428090000-0000001`, `20260428090000-9999999`

**桁数の根拠**: 接続上限 35 分 × min batch interval 100ms × queue 100 件 = **2.1M 件**が理論最大スループット。7 桁 (max 9,999,999) で約 4.7x の余裕。3 桁では 1000 件目で `"1000" < "999"` 辞書順となり順序保証が破綻するため不可。

**サーバー側の扱い**: サーバーは `orderKey` を opaque な文字列として保存します。`#` を含む値も受け付けますが、クライアント側で生成する場合は上記フォーマットに従ってください。同一バッチ内に同じ `orderKey` が複数あっても、SK 末尾の short UUID で一意性が確保されます。

#### NodeStatus

```graphql
type NodeStatus {
  nodeId: ID!
  groupId: ID!
  domain: String!
  data: [SensorData!]!
  timestamp: AWSDateTime!
}
```

#### BatchEvent

```graphql
type BatchEvent {
  events: [Event!]!
  firedByNodeId: ID!
  groupId: ID!
  domain: String!
  timestamp: AWSDateTime!
}
```

#### GroupDissolvePayload

```graphql
type GroupDissolvePayload {
  groupId: ID!
  domain: String!
  message: String!
}
```

#### MeshMessage

```graphql
type MeshMessage {
  groupId: ID!
  domain: String!
  nodeStatus: NodeStatus
  batchEvent: BatchEvent
  groupDissolve: GroupDissolvePayload
}
```

#### RecordEventsPayload

```graphql
type RecordEventsPayload {
  groupId: ID!
  domain: String!
  recordedCount: Int!
  nextSince: String!
}
```

#### HeartbeatPayload

```graphql
type HeartbeatPayload {
  groupId: ID!
  domain: String!
  expiresAt: AWSDateTime!
  heartbeatIntervalSeconds: Int
}
```

#### MemberHeartbeatPayload

```graphql
type MemberHeartbeatPayload {
  nodeId: ID!
  groupId: ID!
  domain: String!
  expiresAt: AWSDateTime!
  heartbeatIntervalSeconds: Int
}
```

#### LeaveGroupPayload

```graphql
type LeaveGroupPayload {
  peerId: ID!
  groupId: ID!
  domain: String!
  message: String!
}
```

## Queries

### listGroupsByDomain

ドメイン内のすべてのグループを一覧表示します。

```graphql
query ListGroupsByDomain($domain: String!) {
  listGroupsByDomain(domain: $domain) {
    id
    domain
    fullId
    name
    hostId
    expiresAt
    heartbeatIntervalSeconds
    useWebSocket
    pollingIntervalSeconds
  }
}
```

### getNodeStatus

ノード ID でノードのステータス（センサーデータ）を取得します。

```graphql
query GetNodeStatus($nodeId: ID!) {
  getNodeStatus(nodeId: $nodeId) {
    nodeId
    groupId
    domain
    data {
      key
      value
    }
    timestamp
  }
}
```

**戻り値**: ノードのセンサーデータ。ノードが存在しない場合は `null`。

### listGroupStatuses

グループ内のすべてのノードのステータスを取得します。

```graphql
query ListGroupStatuses($groupId: ID!, $domain: String!) {
  listGroupStatuses(groupId: $groupId, domain: $domain) {
    nodeId
    groupId
    domain
    data {
      key
      value
    }
    timestamp
  }
}
```

**用途**: グループ内の全ノードの最新センサーデータを一括取得。

### listNodesInGroup

グループに参加しているすべてのノードを一覧表示します。

```graphql
query ListNodesInGroup($groupId: ID!, $domain: String!) {
  listNodesInGroup(groupId: $groupId, domain: $domain) {
    id
    name
    groupId
    domain
    heartbeatIntervalSeconds
  }
}
```

**用途**: グループメンバーの一覧取得。

### searchGroupsByNamePrefix

グループ名のプレフィックスで全ドメイン横断検索します。

```graphql
query SearchGroupsByNamePrefix($namePrefix: String!, $limit: Int) {
  searchGroupsByNamePrefix(namePrefix: $namePrefix, limit: $limit) {
    id
    domain
    fullId
    name
    hostId
    expiresAt
    useWebSocket
  }
}
```

**パラメータ**:
- `namePrefix: String!` - hostId の先頭数文字（16進数小文字）
- `limit: Int` - 取得件数の上限（オプション）

**用途**: hostId のプレフィックスを使ったグループ検索。ドメインをまたいで検索可能。

### getEventsSince

前回取得日時以降のイベントを取得します（ポーリング用）。

```graphql
query GetEventsSince($groupId: ID!, $domain: String!, $since: String!) {
  getEventsSince(groupId: $groupId, domain: $domain, since: $since) {
    name
    firedByNodeId
    groupId
    domain
    payload
    timestamp
    cursor
    orderKey
  }
}
```

**パラメータ**:
- `since: String!` - 前回の `nextSince` または最後に取得したイベントの `cursor` を指定します。

**戻り値**: イベントの配列。最大 100 件まで取得されます。100 件超の場合は最後のイベントの `cursor` を `since` に指定して再 query することでページングできます。

**`orderKey` フィールド** (issue #556): クライアントが `EventInput.orderKey` を送信していたイベントのみ含まれます。受信側クライアントが同一タイムスタンプのイベントを送信順で並べる安定ソートに使用します。詳細は [EventInput](#eventinput) 参照。

> **注意**: ポーリングモードのクライアントは `getEventsSince` 単体ではなく、
> [`pollGroupData`](#pollgroupdata-issue-554) を 2 秒間隔で呼ぶことで events
> と nodeStatuses を同時取得します。`getEventsSince` は引き続き API として
> 利用可能 (旧クライアントとの後方互換、デバッグ用途)。

### pollGroupData (issue #554)

ポーリング時のイベント取得とノードステータス取得を **1 リクエストに統合**した
Pipeline Resolver。`getEventsSince` (events) + `listGroupStatuses`
(nodeStatuses) を 1 つの AppSync リクエストで返します。

```graphql
query PollGroupData($groupId: ID!, $domain: String!, $since: String!) {
  pollGroupData(groupId: $groupId, domain: $domain, since: $since) {
    events {
      name
      firedByNodeId
      groupId
      domain
      payload
      timestamp
      cursor
      orderKey
    }
    nodeStatuses {
      nodeId
      groupId
      domain
      data { key value }
      timestamp
    }
  }
}
```

**パラメータ**:
- `since: String!` - `getEventsSince` と同じ。前回の `Event.cursor` または空文字 (`""`) を指定。

**戻り値**: `PollGroupData { events, nodeStatuses }`
- `events`: `Event[]` (`getEventsSince` 相当、limit 100、`cursor` でページング可能)
- `nodeStatuses`: `NodeStatus[]` (`listGroupStatuses` 相当、TTL 内のノードのみ)

**用途**:
- ポーリングモード (`useWebSocket=false`) のクライアントが 2 秒間隔で呼び、events 受信とデータ同期を同時に行う
- WebSocket モードでは使わない（subscription + 15 秒間隔の `listGroupStatuses` を使う）

**実装**: AppSync Pipeline Resolver。内部で 2 つの DynamoDB Query を直列実行
（`fetchEventsForPoll` → `fetchNodeStatusesForPoll`）するが、AppSync の課金は
**1 リクエスト = 1 op**。詳細は `docs/architecture.md` および
`/docs/mesh/cost.md` の "Polling Sync (HTTPS Polling Mode)" セクション。

**コスト効果**:
- AppSync requests: 旧 `getEventsSince` (30/min) + `listGroupStatuses`
  (4/min) = 34 → 新 `pollGroupData` (30/min) = **30 (12% 削減)**
- データ同期遅延: **15s → 2s** (約 87% 短縮)

**後方互換性**: 既存の `getEventsSince` / `listGroupStatuses` は変更なし。
旧クライアントは引き続きそれらを使用可能。新クライアント (this PR 以降) は
`pollGroupData` を使用する。

## Mutations

### createDomain

リクエスト元のソース IP からドメインを生成します。

```graphql
mutation CreateDomain {
  createDomain
}
```

**戻り値**: 生成されたドメイン文字列（グローバル IP アドレス）

**用途**: クライアントがドメインを自動生成する場合に使用。グローバル IP を取得して、グループのスコープとして使用します。

---

### createGroup

新しいグループを作成します（冪等性あり）。

```graphql
mutation CreateGroup(
  $name: String!
  $hostId: ID!
  $domain: String!
  $useWebSocket: Boolean!
  $maxConnectionTimeSeconds: Int
) {
  createGroup(
    name: $name
    hostId: $hostId
    domain: $domain
    useWebSocket: $useWebSocket
    maxConnectionTimeSeconds: $maxConnectionTimeSeconds
  ) {
    id
    domain
    fullId
    name
    hostId
    expiresAt
    heartbeatIntervalSeconds
    useWebSocket
    pollingIntervalSeconds
  }
}
```

**パラメータ**:
- `useWebSocket: Boolean!` - WebSocket 使用フラグ。`false` の場合、ポーリングプロトコルを使用
- `maxConnectionTimeSeconds: Int` - グループの最大接続時間（オプション、1以上、環境変数の値以下）

**冪等性**: 同じ `hostId` + `domain` で呼び出すと、既存のグループを返します。

### joinGroup

ノードがグループに参加します。

```graphql
mutation JoinGroup(
  $groupId: ID!
  $nodeId: ID!
  $domain: String!
  $useWebSocket: Boolean
) {
  joinGroup(
    groupId: $groupId
    nodeId: $nodeId
    domain: $domain
    useWebSocket: $useWebSocket
  ) {
    id
    name
    groupId
    domain
    expiresAt
    heartbeatIntervalSeconds
  }
}
```

**パラメータ**:
- `useWebSocket: Boolean` (optional) - クライアントが WebSocket を使用しているかを示すフラグ。サーバー側で CloudWatch ログにプロトコル情報を記録するために使用される。
  - `true`: WebSocket を使用 → INFO レベルで記録（stg のみ）
  - `false`: HTTPS ポーリングを使用 → ERROR レベルで記録（prod でも記録、フォールバック警告として扱う）
  - 省略 / `null`: 旧クライアント互換 — ログには `protocol: "unknown"` と記録される（INFO レベル、stg のみ）

サーバー側のリゾルバーロジック（Node 型の構築、TTL 設定など）には影響しない。詳細は `operations.md` の「プロトコルログ」セクションを参照。

### reportDataByNode

ノードがセンサーデータを報告します（`onMessageInGroup` subscription をトリガー）。

```graphql
mutation ReportDataByNode(
  $nodeId: ID!
  $groupId: ID!
  $domain: String!
  $data: [SensorDataInput!]!
) {
  reportDataByNode(
    nodeId: $nodeId
    groupId: $groupId
    domain: $domain
    data: $data
  ) {
    groupId
    domain
    nodeStatus {
      nodeId
      groupId
      domain
      data {
        key
        value
      }
      timestamp
    }
  }
}
```

**戻り値**: `MeshMessage` — `nodeStatus` フィールドにデータ更新が含まれます。この mutation は `onMessageInGroup` subscription をトリガーします。

### fireEventsByNode

ノードが複数のイベントを一度に送信します（`onMessageInGroup` subscription をトリガー）。

```graphql
mutation FireEventsByNode(
  $nodeId: ID!
  $groupId: ID!
  $domain: String!
  $events: [EventInput!]!
) {
  fireEventsByNode(
    nodeId: $nodeId
    groupId: $groupId
    domain: $domain
    events: $events
  ) {
    groupId
    domain
    batchEvent {
      events {
        name
        firedByNodeId
        payload
        timestamp
        orderKey   # NEW (issue #556)
      }
      firedByNodeId
      groupId
      domain
      timestamp
    }
  }
}
```

**戻り値**: `MeshMessage` — `batchEvent` フィールドにイベントデータが含まれます。この mutation は `onMessageInGroup` subscription をトリガーします。

`EventInput.orderKey` を送信した場合は `batchEvent.events[].orderKey` でパススルーされ、subscription 受信側のクライアントが安定ソートに使えます (issue #556)。

### recordEventsByNode

ノードが複数のイベントを一度に送信し、DynamoDB に保存します（ポーリング用）。

```graphql
mutation RecordEventsByNode(
  $nodeId: ID!
  $groupId: ID!
  $domain: String!
  $events: [EventInput!]!  # EventInput.orderKey で同一バッチ内の順序保証 (#556)
) {
  recordEventsByNode(
    nodeId: $nodeId
    groupId: $groupId
    domain: $domain
    events: $events
  ) {
    groupId
    domain
    recordedCount
    nextSince
  }
}
```

**用途**: WebSocket が使用できない環境でのイベント送信に使用。この mutation は `onMessageInGroup` subscription を**トリガーしません**。

**順序保証** (issue #556): 同一バッチ内のイベントは同じ `server_timestamp` で保存されるため、SK 末尾だけがランダム UUID だと取得時の順序が送信順と一致しません。クライアントは `EventInput.orderKey` (フォーマット: `<YYYYMMDDHHMMSS>-<NNNNNNN>`) を送信することで、SK = `EVENT#<server_timestamp>#<orderKey>#<short_uuid>` 形式で保存され、`getEventsSince` で送信順 = orderKey 辞書順で取得できます。詳細は [Event 型の orderKey](#orderkey-フィールド-issue-556)。

---

### leaveGroup

ノードがグループから退出します。

```graphql
mutation LeaveGroup($groupId: ID!, $domain: String!, $nodeId: ID!) {
  leaveGroup(groupId: $groupId, domain: $domain, nodeId: $nodeId) {
    peerId
    groupId
    domain
    message
  }
}
```

**用途**: メンバーノードがグループから退出する際に使用。

---

### dissolveGroup

グループを解散します（`onMessageInGroup` subscription をトリガー）。

```graphql
mutation DissolveGroup($groupId: ID!, $domain: String!, $hostId: ID!) {
  dissolveGroup(groupId: $groupId, domain: $domain, hostId: $hostId) {
    groupId
    domain
    groupDissolve {
      groupId
      domain
      message
    }
  }
}
```

**用途**: ホストがグループ全体を解散する際に使用。すべてのメンバーに `onMessageInGroup` subscription が配信されます。

**注意**: `dissolveGroup` はホスト専用の操作です。メンバーの退出には `leaveGroup` を使用してください。

---

### renewHeartbeat

ホストがグループのハートビートを更新します。

```graphql
mutation RenewHeartbeat($groupId: ID!, $domain: String!, $hostId: ID!) {
  renewHeartbeat(groupId: $groupId, domain: $domain, hostId: $hostId) {
    groupId
    domain
    expiresAt
    heartbeatIntervalSeconds
  }
}
```

**用途**: ホストが定期的に呼び出して、グループの有効期限を延長します。

**重要**: この mutation はホストのみが実行できます。非ホストが実行すると `Unauthorized` エラーが返されます。

**ハートビート間隔**: 環境変数 `MESH_HOST_HEARTBEAT_INTERVAL_SECONDS` で設定（開発環境: 15秒、本番環境: 60秒）

---

### sendMemberHeartbeat

メンバーノードがハートビートを送信します。

```graphql
mutation SendMemberHeartbeat($groupId: ID!, $domain: String!, $nodeId: ID!) {
  sendMemberHeartbeat(groupId: $groupId, domain: $domain, nodeId: $nodeId) {
    nodeId
    groupId
    domain
    expiresAt
    heartbeatIntervalSeconds
  }
}
```

**用途**: メンバーノードが定期的に呼び出して、ノードの有効期限を延長します。

**ハートビート間隔**: 環境変数 `MESH_MEMBER_HEARTBEAT_INTERVAL_SECONDS` で設定（開発環境: 15秒、本番環境: 120秒）

**TTL**: ハートビートが途絶えると、TTL（Time To Live）が経過した後にノードは自動的にグループから削除されます（開発環境: 60秒、本番環境: 600秒）

## Subscriptions

Mesh v2 は AWS AppSync GraphQL Subscriptions over WebSocket を使用したリアルタイム通知をサポートしています。

### 重要な変更（Issue smalruby/smalruby3-gui#500 関連）

**統合された Subscription**: 以前は個別の subscription (`onDataUpdateInGroup`, `onBatchEventInGroup`, `onGroupDissolve`) がありましたが、現在は **`onMessageInGroup`** という単一の subscription に統合されています。

この変更により:
- WebSocket ストリームが1つになり、送信順序（Mutation実行順序）が受信側でも保証される
- クライアント実装がシンプルになる
- ネットワーク接続数が削減される

### onMessageInGroup

**目的**: グループ内のすべてのメッセージ（データ更新、イベント、解散通知）を統合して購読

**トリガー**: `reportDataByNode`, `fireEventsByNode`, `dissolveGroup` mutation

**パラメータ**:
- `groupId: ID!` - 購読するグループ ID
- `domain: String!` - グループのドメイン

**戻り値**: `MeshMessage!`
```graphql
{
  groupId: ID!              # Subscription フィルタリング用
  domain: String!           # Subscription フィルタリング用
  nodeStatus: NodeStatus    # reportDataByNode からのデータ更新
  batchEvent: BatchEvent    # fireEventsByNode からのイベント
  groupDissolve: GroupDissolvePayload  # dissolveGroup からの解散通知
}
```

**使用例**:
```graphql
subscription {
  onMessageInGroup(groupId: "group-123", domain: "example.com") {
    groupId
    domain
    nodeStatus {
      nodeId
      groupId
      domain
      data {
        key
        value
      }
      timestamp
    }
    batchEvent {
      events {
        name
        firedByNodeId
        payload
        timestamp
      }
      firedByNodeId
      groupId
      domain
      timestamp
    }
    groupDissolve {
      groupId
      domain
      message
    }
  }
}
```

**クライアント実装の注意点**:
- `MeshMessage` は各フィールドがオプショナル（null 可能）です
- 受信したメッセージのどのフィールドが設定されているかを確認して、適切に処理してください
- 例: `nodeStatus` が設定されていればデータ更新、`batchEvent` が設定されていればイベント、`groupDissolve` が設定されていれば解散通知

**JavaScript クライアント実装例**:
```javascript
// Subscription を購読
subscription = client.subscribe({
  query: gql`
    subscription OnMessageInGroup($groupId: ID!, $domain: String!) {
      onMessageInGroup(groupId: $groupId, domain: $domain) {
        nodeStatus { nodeId data { key value } }
        batchEvent { events { name payload } }
        groupDissolve { message }
      }
    }
  `,
  variables: { groupId, domain }
});

subscription.subscribe({
  next: (message) => {
    const { nodeStatus, batchEvent, groupDissolve } = message.data.onMessageInGroup;

    if (nodeStatus) {
      // データ更新を処理
      console.log('Data update:', nodeStatus);
    }

    if (batchEvent) {
      // イベントを処理
      console.log('Batch event:', batchEvent);
    }

    if (groupDissolve) {
      // グループ解散を処理
      console.log('Group dissolved:', groupDissolve);
      // 切断処理など
    }
  }
});
```

---

### Subscription のフィルタリング動作

すべての subscription は `groupId` と `domain` でフィルタリングされます:
- `groupId: "A"` を購読しているクライアントは、`groupId: "B"` の更新を受信**しません**
- このフィルタリングは、subscription パラメータを使用して AppSync が自動的に処理します

---

### Subscription のテスト

#### 自動テスト

統合テストで以下を検証:
- ✅ GraphQL schema に Subscription type が含まれている
- ✅ @aws_subscribe ディレクティブが正しく定義されている
- ✅ Mutations (reportDataByNode, fireEventsByNode, dissolveGroup) が正しく動作する
- ✅ 複数のグループが適切なフィルタリングで共存できる
- ✅ onMessageInGroup (groupDissolve) が正しくトリガーされる

テストを実行:
```bash
export APPSYNC_ENDPOINT=$(aws cloudformation describe-stacks --stack-name MeshV2Stack-stg --query 'Stacks[0].Outputs[?OutputKey==`GraphQLApiEndpoint`].OutputValue' --output text)
export APPSYNC_API_KEY=$(aws cloudformation describe-stacks --stack-name MeshV2Stack-stg --query 'Stacks[0].Outputs[?OutputKey==`GraphQLApiKey`].OutputValue' --output text)

bundle exec rspec spec/requests/subscriptions_spec.rb
```

#### 手動 WebSocket テスト

実際の WebSocket 接続を使用した手動テストには、`wscat` または GraphQL Playground を使用します:

1. **wscat をインストール**:
```bash
npm install -g wscat
```

2. **WebSocket URL を取得**:
```bash
API_URL='https://your-appsync-api.appsync-api.region.amazonaws.com/graphql'
WS_URL=$(echo $API_URL | sed 's/https:/wss:/g' | sed 's/graphql$/graphql\/connect/g')
```

3. **接続して購読**: GraphQL Playground または wscat を適切な AppSync WebSocket プロトコルで使用

4. **Mutations をトリガー**: 別のターミナルで、GraphQL API を使用して mutations を実行

---

### Subscription のパフォーマンス考慮事項

#### 接続制限
- AppSync は、アカウントごと、リージョンごとに最大 100,000 の同時 WebSocket 接続をサポート
- 各 subscription は 1 つの接続としてカウント

#### メッセージ配信
- メッセージはほぼリアルタイムで購読者に配信されます（通常 < 100ms）
- AppSync は最低 1 回の配信を保証
- クライアントは重複メッセージに対して冪等性を実装する必要があります

#### コスト最適化
- Subscriptions はメッセージ送信ごとに課金されます
- 未使用の接続を閉じてコストを削減
- 不要なメッセージを最小限にするために特定のフィルター（groupId、domain）を使用

---

### Subscription のトラブルシューティング

#### 接続の問題
1. API Key が有効で期限切れでないことを確認
2. WebSocket URL の形式を確認: `wss://xxx.appsync-api.region.amazonaws.com/graphql/connect`
3. 適切な WebSocket ヘッダーを確認（AppSync ドキュメント参照）

#### 更新が届かない
1. subscription パラメータが mutation パラメータと一致することを確認（groupId、domain）
2. mutation が正常に完了したことを確認
3. クライアントがまだ接続されていることを確認（WebSocket がタイムアウトしていない）

#### ローカルでのテスト
- AppSync subscriptions は実際の WebSocket 接続が必要
- 単体テストでは完全にテストできない
- 統合テストまたは wscat/GraphQL Playground を使用した手動テストを使用

---

## エラーハンドリング

### GraphQL エラー型

Mesh V2 バックエンドは以下の GraphQL エラー型を返します。

| エラー型 | 説明 | クライアントアクション | 定義場所 |
| :--- | :--- | :--- | :--- |
| `GroupNotFound` | グループが存在しない、期限切れ、またはホストのハートビートがタイムアウトした | **即座に切断** | `js/functions/checkGroupExists.js` |
| `Unauthorized` | 認可されていないノードが操作を試みた（例：非ホストがグループのハートビートを更新しようとした） | **即座に切断** | `js/functions/renewHeartbeatFunction.js` |
| `NodeNotFound` | 指定されたノード（クライアント）がグループに存在しない | **即座に切断** | `js/functions/updateNodeTTL.js` |
| `ValidationError` | 提供されたパラメータが検証に失敗した（例：ドメイン文字列が長すぎる） | エラーをログに記録して続行（切断**しない**） | 各種リゾルバー |

### クライアント実装の詳細

クライアント（`scratch-vm`）は、`MeshV2Service` にこれらのエラーを処理する `shouldDisconnectOnError(error)` ヘルパーメソッドを実装しています。

#### mesh-service.js の切断ロジック

```javascript
const DISCONNECT_ERROR_TYPES = new Set([
    'GroupNotFound',
    'Unauthorized',
    'NodeNotFound'
]);

shouldDisconnectOnError (error) {
    if (!error) return false;

    // 主要なチェック: GraphQL errorType（最も信頼性が高い）
    if (error.graphQLErrors && error.graphQLErrors.length > 0) {
        const errorType = error.graphQLErrors[0].errorType;
        if (DISCONNECT_ERROR_TYPES.has(errorType)) {
            return true;
        }
    }

    // フォールバック: メッセージ文字列をチェック（後方互換性）
    if (error.message) {
        const message = error.message.toLowerCase();
        if (message.includes('not found') ||
            message.includes('expired') ||
            message.includes('unauthorized')) {
            return true;
        }
    }

    return false;
}
```

### 新しいエラー型の追加

クライアントに切断を要求する新しいエラー型をバックエンドに追加する場合:

1. `util.error(message, errorType)` を使用して適切な AppSync 関数でエラーを定義
2. このドキュメントに新しいエラー型を追加
3. `gui/scratch-vm/src/extensions/scratch3_mesh_v2/mesh-service.js` の `DISCONNECT_ERROR_TYPES` セットを更新

---

## 認証・認可

### API Key 認証

現在、Mesh v2 は API Key 認証を使用しています:

```bash
# API Key を取得
aws cloudformation describe-stacks --stack-name MeshV2Stack-stg \
  --query 'Stacks[0].Outputs[?OutputKey==`GraphQLApiKey`].OutputValue' \
  --output text
```

**使用方法**:

```bash
curl -X POST $APPSYNC_ENDPOINT \
  -H "x-api-key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "query { listGroupsByDomain(domain: \"example.com\") { id name } }"
  }'
```

### 将来の拡張

- IAM 認証のサポート予定
- Cognito ユーザープール認証のサポート予定

---

## レート制限

AWS AppSync のデフォルトのレート制限が適用されます:

- リクエスト制限: アカウントごと、リージョンごとに秒間 1,000 リクエスト
- Subscription 接続制限: アカウントごと、リージョンごとに 100,000 接続

詳細は [AWS AppSync のクォータ](https://docs.aws.amazon.com/appsync/latest/devguide/quotas.html) を参照してください。

---

## 関連ファイル

- **Schema**: `graphql/schema.graphql`
- **Subscription テスト**: `spec/requests/subscriptions_spec.rb`
- **Subscription ヘルパー**: `spec/support/appsync_subscription_helper.rb`
- **CDK Stack**: `lib/mesh-v2-stack.ts`

---

## 関連ドキュメント

- [開発ガイド](development.md) - ローカル開発とテスト
- [デプロイ手順](deployment.md) - 初回デプロイから運用まで
- [README.md](../README.md) - プロジェクト概要

---

## 参考資料

- [AWS AppSync Subscriptions](https://docs.aws.amazon.com/appsync/latest/devguide/aws-appsync-real-time-data.html)
- [GraphQL Subscriptions Specification](https://spec.graphql.org/October2021/#sec-Subscription)
- [AppSync @aws_subscribe Directive](https://docs.aws.amazon.com/appsync/latest/devguide/aws-appsync-directives.html#aws-appsync-subscribe)
- [AWS AppSync Quotas](https://docs.aws.amazon.com/appsync/latest/devguide/quotas.html)

