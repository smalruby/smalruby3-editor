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
}
```

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
    createdAt
    expiresAt
    heartbeatIntervalSeconds
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
  }
}
```

**パラメータ**:
- `since: String!` - 前回の `nextSince` または最後に取得したイベントの `cursor` を指定します。

**戻り値**: イベントの配列。最大 100 件まで取得されます。

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
mutation CreateGroup($name: String!, $hostId: ID!, $domain: String!) {
  createGroup(name: $name, hostId: $hostId, domain: $domain) {
    id
    domain
    fullId
    name
    hostId
    createdAt
    expiresAt
    heartbeatIntervalSeconds
  }
}
```

**冪等性**: 同じ `hostId` + `domain` で呼び出すと、既存のグループを返します。

### joinGroup

ノードがグループに参加します。

```graphql
mutation JoinGroup($groupId: ID!, $nodeId: ID!, $domain: String!) {
  joinGroup(groupId: $groupId, nodeId: $nodeId, domain: $domain) {
    id
    name
    groupId
    domain
    expiresAt
    heartbeatIntervalSeconds
  }
}
```

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
}
```

### recordEventsByNode

ノードが複数のイベントを一度に送信し、DynamoDB に保存します（ポーリング用）。

```graphql
mutation RecordEventsByNode(
  $nodeId: ID!
  $groupId: ID!
  $domain: String!
  $events: [EventInput!]!
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
    message
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

---

**Last Updated**: 2026-01-03
**Phase**: 3 - Documentation Consolidation
**Status**: ✅ Subscription を `onMessageInGroup` に統合（Issue smalruby/smalruby3-gui#500 関連）
