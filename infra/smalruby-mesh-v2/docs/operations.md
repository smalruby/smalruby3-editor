# Mesh v2 運用ガイド

このドキュメントは、Mesh v2 の運用に関する情報を提供します。モニタリング、アラート、コスト管理、スケーリング、バックアップ、トラブルシューティングについて説明します。

## モニタリング設定

### CloudWatch Metrics

AWS AppSync と DynamoDB は自動的に CloudWatch にメトリクスを送信します。

#### AppSync API メトリクス

| メトリクス名 | 説明 | 推奨閾値 |
|------------|------|---------|
| `4XXError` | クライアントエラー数 | < 1% of total requests |
| `5XXError` | サーバーエラー数 | < 0.1% of total requests |
| `Latency` | API レイテンシ | p99 < 1000ms |
| `ConnectSuccess` | WebSocket 接続成功数 | モニタリングのみ |
| `ConnectClientError` | WebSocket 接続クライアントエラー | < 1% of connections |
| `ConnectServerError` | WebSocket 接続サーバーエラー | < 0.1% of connections |
| `SubscribeSuccess` | Subscription 成功数 | モニタリングのみ |
| `PublishDataMessageSuccess` | メッセージ配信成功数 | モニタリングのみ |

#### DynamoDB テーブルメトリクス

| メトリクス名 | 説明 | 推奨閾値 |
|------------|------|---------|
| `ConsumedReadCapacityUnits` | 消費された読み取りキャパシティ | オンデマンドモードでは不要 |
| `ConsumedWriteCapacityUnits` | 消費された書き込みキャパシティ | オンデマンドモードでは不要 |
| `UserErrors` | クライアントエラー数 | < 1% of total requests |
| `SystemErrors` | システムエラー数 | 0 (即座に調査) |
| `ThrottledRequests` | スロットリングされたリクエスト数 | 0 (キャパシティ不足) |

#### Lambda 関数メトリクス

| メトリクス名 | 説明 | 推奨閾値 |
|------------|------|---------|
| `Invocations` | 呼び出し数 | モニタリングのみ |
| `Errors` | エラー数 | < 0.1% of invocations |
| `Duration` | 実行時間 | p99 < 3000ms |
| `Throttles` | スロットリング数 | 0 (同時実行数制限) |
| `ConcurrentExecutions` | 同時実行数 | < 予約済み同時実行数 |

---

### CloudWatch Logs

#### AppSync ログ

**設定**: CDK スタックで自動的に有効化

```typescript
// lib/mesh-v2-stack.ts
api.addLogConfig({
  fieldLogLevel: appsync.FieldLogLevel.ALL,
  excludeVerboseContent: false,
});
```

**ログの種類**:
- リクエストログ（Request ID、クエリ、変数）
- リゾルバーログ（入力、出力、エラー）
- Subscription ログ（接続、切断、配信）

**ログ検索例**:

```bash
# エラーログの検索
aws logs filter-log-events \
  --log-group-name /aws/appsync/apis/xxx-xxx-xxx \
  --filter-pattern "ERROR"

# 特定の mutation のログ
aws logs filter-log-events \
  --log-group-name /aws/appsync/apis/xxx-xxx-xxx \
  --filter-pattern "createGroup"
```

---

#### プロトコルログ

`createGroup` および `joinGroup` mutation 実行時に、クライアントが WebSocket と HTTPS ポーリングのどちらを使用しているかを CloudWatch に記録する。運用担当者がプロトコル別の利用状況を集計できる。

**実装場所**:
- `js/functions/createGroupIfNotExists.js` - 新規グループ作成時のみ記録（既存グループ再利用時は記録しない）
- `js/functions/joinGroupFunction.js` - 全ノード参加時に記録

**ログレベル設計**:

prod の AppSync `fieldLogLevel` は `ERROR` に固定（コスト最小化）。プロトコル別にログレベルを使い分けて、prod でも必要なログだけ取得する:

| protocol | 想定される状況 | ログ関数 | ログレベル | prod 記録 | stg 記録 |
|----------|----------------|----------|------------|-----------|----------|
| `Polling` | WebSocket が使えずフォールバック（警告相当） | `console.error` | ERROR | ✅ | ✅ |
| `WebSocket` | 正常（フォールバックなし） | `console.log` | INFO | ❌ | ✅ |
| `unknown` | 旧クライアント（`joinGroup` のみ） | `console.log` | INFO | ❌ | ✅ |

prod では Polling 件数 = 「WebSocket が使えなかった環境のクライアント数」として運用監視できる。

**ログフォーマット**:

```
ERROR - code.js:NN:N: "createGroup fallback to Polling" {"action":"createGroup","groupId":"...","domain":"...","hostId":"...","protocol":"Polling"}
ERROR - code.js:NN:N: "joinGroup fallback to Polling" {"action":"joinGroup","groupId":"...","domain":"...","nodeId":"...","protocol":"Polling"}
INFO  - code.js:NN:N: "createGroup" {"action":"createGroup","groupId":"...","domain":"...","hostId":"...","protocol":"WebSocket"}
INFO  - code.js:NN:N: "joinGroup" {"action":"joinGroup","groupId":"...","domain":"...","nodeId":"...","protocol":"WebSocket|unknown"}
```

**`protocol` フィールドの値**:

| 値 | 説明 |
|----|------|
| `WebSocket` | クライアントが `useWebSocket: true` を送信 |
| `Polling` | クライアントが `useWebSocket: false` を送信（WebSocket フォールバック想定） |
| `unknown` | 旧クライアントが `useWebSocket` を送信していない（`joinGroup` のみ） |

**ログ取得例**:

```bash
# 直近 1 時間の Polling フォールバック件数（prod でも使える）
aws logs filter-log-events \
  --log-group-name /aws/appsync/apis/xxx-xxx-xxx \
  --start-time $(($(date +%s) - 3600))000 \
  --filter-pattern '"fallback to Polling"' \
  --query 'events[].message' \
  --output text

# stg のみ: WebSocket / unknown を含む全プロトコルログ
aws logs filter-log-events \
  --log-group-name /aws/appsync/apis/xxx-xxx-xxx \
  --start-time $(($(date +%s) - 3600))000 \
  --filter-pattern 'protocol' \
  --query 'events[].message' \
  --output text
```

##### 集計クエリ（CloudWatch Logs Insights）

**Polling フォールバック件数の集計（prod 用、最重要）**:

```
fields @message
| filter @message like /"protocol":"Polling"/
| parse @message /"action":"(?<action>[^"]+)"/
| parse @message /"domain":"(?<domain>[^"]+)"/
| stats count(*) as fallback_count by action
| sort action
```

**期間別の Polling フォールバック推移（日次、prod 用）**:

```
fields @timestamp, @message
| filter @message like /"protocol":"Polling"/
| parse @message /"action":"(?<action>[^"]+)"/
| stats count(*) as fallback_count by bin(1d), action
| sort @timestamp desc
```

**ドメイン別の Polling フォールバック分布（どのネットワークが WebSocket をブロックしているか調査用）**:

```
fields @message
| filter @message like /"protocol":"Polling"/
| parse @message /"domain":"(?<domain>[^"]+)"/
| stats count(*) as count by domain
| sort count desc
| limit 20
```

**プロトコル別の集計（stg のみ、全プロトコル）**:

```
fields @message
| filter @message like /"action":"createGroup"/ or @message like /"action":"joinGroup"/
| parse @message /"action":"(?<action>[^"]+)"/
| parse @message /"protocol":"(?<protocol>[^"]+)"/
| stats count(*) as count by action, protocol
| sort action, protocol
```

集計結果例 (stg):

| action | protocol | count |
|--------|----------|-------|
| createGroup | WebSocket | 8 |
| createGroup | Polling | 4 |
| joinGroup | WebSocket | 2 |
| joinGroup | Polling | 2 |
| joinGroup | unknown | 4 |

**注意事項**:

- prod の `fieldLogLevel` は `ERROR` のため、prod では **Polling のログのみ**が CloudWatch に記録される
  - WebSocket・unknown のログは prod では記録されない（ログコスト削減のため意図的）
  - stg は `fieldLogLevel: ALL` のため全プロトコルが記録される
- AppSync JS resolver では以下の console 関数のみ利用可能:
  - `console.log()` → INFO レベル
  - `console.error()` → ERROR レベル
  - `console.info()`, `console.warn()` は**サポート外**（"Invalid function" エラー）
- WebSocket / unknown も prod で記録したい場合は `fieldLogLevel` を `INFO` または `ALL` に変更（CloudWatch 取り込み量とコストが大幅に増える点に注意）

##### 集計時の注意点

集計値を解釈する際、以下の挙動に注意:

1. **`forcePolling` URL パラメータによる Polling は「フォールバック」ではない**
   - クライアント側で `?force_polling=1` を指定すると `useWebSocket: false` が送信される（テスト用機能）
   - サーバー側ではフォールバックと明示的選択を区別できないため、`fallback to Polling` ログメッセージは「protocol=Polling として接続した」と解釈する
   - 通常の prod 運用では `force_polling` は使われないため、ほぼ「実際のフォールバック件数」と等しい
2. **Polling 件数 ≠ Polling グループ数**
   - Polling のグループでは host (createGroup) で 1 件 + 各 member (joinGroup) で 1 件ずつログが出る
   - 5 メンバーグループが Polling の場合、合計 5 件 (createGroup x 1 + joinGroup x 4) のログが出る
   - グループ単位で集計したい場合は `groupId` で `dedup` するか `count_distinct(groupId)` を使う:
     ```
     fields @message
     | filter @message like /"protocol":"Polling"/
     | parse @message /"groupId":"(?<groupId>[^"]+)"/
     | stats count_distinct(groupId) as polling_groups
     ```
3. **`createGroup` の冪等性によるログ欠落**
   - 同じ `hostId + domain` で `createGroup` を再呼び出ししても、既存グループ再利用時 (`ctx.stash.existingGroup`) はログされない
   - そのため `createGroup` 件数 = host 接続試行回数ではなく **新規グループ作成回数**
   - 接続試行回数を見たい場合は `joinGroup` ログを使う（host 自身は joinGroup を呼ばないため、host 数は別途カウントが必要）

---

#### Lambda ログ

**設定**: 自動的に有効化

**ログの種類**:
- リクエスト/レスポンス
- Ruby 例外スタックトレース
- カスタムログ（`puts` ステートメント）

**ログ検索例**:

```bash
# Lambda エラーログの検索
aws logs filter-log-events \
  --log-group-name /aws/lambda/MeshV2Stack-stg-LambdaFunction \
  --filter-pattern "ERROR"

# 特定のグループ ID のログ
aws logs filter-log-events \
  --log-group-name /aws/lambda/MeshV2Stack-stg-LambdaFunction \
  --filter-pattern "groupId: abc123"
```

---

### X-Ray トレーシング

**設定**: AppSync で有効化（CDK スタックで設定）

**利点**:
- エンドツーエンドのリクエストトレース
- レイテンシのボトルネック特定
- サービス間の依存関係の可視化

**トレース例**:
```
AppSync API → JS Resolver → DynamoDB (50ms)
                           → DynamoDB (30ms)
Total: 150ms
```

**分析コマンド**:

```bash
# トレースの取得
aws xray get-trace-summaries \
  --start-time $(date -u -d '1 hour ago' +%s) \
  --end-time $(date -u +%s)

# サービスグラフの取得
aws xray get-service-graph \
  --start-time $(date -u -d '1 hour ago' +%s) \
  --end-time $(date -u +%s)
```

---

## アラート設定推奨事項

### CloudWatch Alarms

#### 高優先度アラート（即座に対応が必要）

1. **5XX エラー率が閾値超過**

```bash
aws cloudwatch put-metric-alarm \
  --alarm-name "MeshV2-5XXError-High" \
  --alarm-description "AppSync 5XX error rate exceeded 0.1%" \
  --metric-name 5XXError \
  --namespace AWS/AppSync \
  --statistic Sum \
  --period 300 \
  --threshold 10 \
  --comparison-operator GreaterThanThreshold \
  --evaluation-periods 2 \
  --dimensions Name=GraphQLAPIId,Value=xxx-xxx-xxx
```

2. **DynamoDB システムエラー発生**

```bash
aws cloudwatch put-metric-alarm \
  --alarm-name "MeshV2-DynamoDB-SystemErrors" \
  --alarm-description "DynamoDB system errors detected" \
  --metric-name SystemErrors \
  --namespace AWS/DynamoDB \
  --statistic Sum \
  --period 60 \
  --threshold 1 \
  --comparison-operator GreaterThanOrEqualToThreshold \
  --evaluation-periods 1 \
  --dimensions Name=TableName,Value=MeshV2Table-stg
```

3. **Lambda 関数エラー率超過**

```bash
aws cloudwatch put-metric-alarm \
  --alarm-name "MeshV2-Lambda-Errors" \
  --alarm-description "Lambda error rate exceeded 0.1%" \
  --metric-name Errors \
  --namespace AWS/Lambda \
  --statistic Sum \
  --period 300 \
  --threshold 10 \
  --comparison-operator GreaterThanThreshold \
  --evaluation-periods 2 \
  --dimensions Name=FunctionName,Value=MeshV2Stack-stg-LambdaFunction
```

---

#### 中優先度アラート（監視が必要）

4. **AppSync レイテンシが閾値超過**

```bash
aws cloudwatch put-metric-alarm \
  --alarm-name "MeshV2-Latency-High" \
  --alarm-description "AppSync p99 latency exceeded 1000ms" \
  --metric-name Latency \
  --namespace AWS/AppSync \
  --statistic ExtendedStatistics \
  --extended-statistic p99 \
  --period 300 \
  --threshold 1000 \
  --comparison-operator GreaterThanThreshold \
  --evaluation-periods 3 \
  --dimensions Name=GraphQLAPIId,Value=xxx-xxx-xxx
```

5. **DynamoDB スロットリング発生**

```bash
aws cloudwatch put-metric-alarm \
  --alarm-name "MeshV2-DynamoDB-Throttled" \
  --alarm-description "DynamoDB requests are being throttled" \
  --metric-name ThrottledRequests \
  --namespace AWS/DynamoDB \
  --statistic Sum \
  --period 300 \
  --threshold 1 \
  --comparison-operator GreaterThanOrEqualToThreshold \
  --evaluation-periods 2 \
  --dimensions Name=TableName,Value=MeshV2Table-stg
```

---

### SNS トピック設定

アラーム通知用の SNS トピックを作成:

```bash
# SNS トピック作成
aws sns create-topic --name MeshV2-Alerts

# メールサブスクリプション追加
aws sns subscribe \
  --topic-arn arn:aws:sns:ap-northeast-1:123456789012:MeshV2-Alerts \
  --protocol email \
  --notification-endpoint your-email@example.com
```

アラームに SNS トピックを追加:

```bash
aws cloudwatch put-metric-alarm \
  --alarm-name "MeshV2-5XXError-High" \
  --alarm-actions arn:aws:sns:ap-northeast-1:123456789012:MeshV2-Alerts \
  # ... 他のパラメータ
```

---

## コスト見積もり

### AWS 料金の構成要素

#### AppSync

| 項目 | 単価 | 備考 |
|------|------|------|
| Query/Mutation リクエスト | $4.00 / 100万リクエスト | 最初の 2.5 億リクエストまで |
| リアルタイム更新 | $2.00 / 100万メッセージ | Subscription 配信 |
| 接続時間 | $0.08 / 100万接続分 | WebSocket 接続 |

#### DynamoDB (オンデマンドモード)

| 項目 | 単価 | 備考 |
|------|------|------|
| 書き込みリクエスト | $1.25 / 100万リクエスト | - |
| 読み取りリクエスト | $0.25 / 100万リクエスト | - |
| ストレージ | $0.25 / GB / 月 | 最初の 25 GB は無料 |

#### Lambda

| 項目 | 単価 | 備考 |
|------|------|------|
| リクエスト | $0.20 / 100万リクエスト | - |
| 実行時間 | $0.0000166667 / GB-秒 | 128MB = $0.0000002083 / 秒 |

#### CloudWatch

| 項目 | 単価 | 備考 |
|------|------|------|
| ログ取り込み | $0.50 / GB | - |
| ログ保存 | $0.03 / GB / 月 | - |
| カスタムメトリクス | $0.30 / メトリクス / 月 | 最初の 10,000 まで |

---

### 想定負荷での月額コスト試算

#### シナリオ 1: 小規模（100 同時接続、1,000 グループ/日）

| サービス | 項目 | 数量 | 単価 | 月額 |
|---------|------|------|------|------|
| AppSync | Query/Mutation | 500万リクエスト | $4/100万 | $20 |
| AppSync | Subscription メッセージ | 1,000万メッセージ | $2/100万 | $20 |
| AppSync | 接続時間 | 300万接続分 | $0.08/100万 | $0.24 |
| DynamoDB | 書き込み | 1,000万リクエスト | $1.25/100万 | $12.50 |
| DynamoDB | 読み取り | 5,000万リクエスト | $0.25/100万 | $12.50 |
| DynamoDB | ストレージ | 1 GB | $0.25/GB | $0.25 |
| Lambda | リクエスト | 500万リクエスト | $0.20/100万 | $1.00 |
| Lambda | 実行時間 | 50万 GB-秒 | $0.0000166667/GB-秒 | $8.33 |
| CloudWatch | ログ | 10 GB | $0.50/GB | $5.00 |
| **合計** | | | | **$79.82** |

---

#### シナリオ 2: 中規模（1,000 同時接続、10,000 グループ/日）

| サービス | 項目 | 数量 | 単価 | 月額 |
|---------|------|------|------|------|
| AppSync | Query/Mutation | 5,000万リクエスト | $4/100万 | $200 |
| AppSync | Subscription メッセージ | 1億メッセージ | $2/100万 | $200 |
| AppSync | 接続時間 | 3,000万接続分 | $0.08/100万 | $2.40 |
| DynamoDB | 書き込み | 1億リクエスト | $1.25/100万 | $125 |
| DynamoDB | 読み取り | 5億リクエスト | $0.25/100万 | $125 |
| DynamoDB | ストレージ | 10 GB | $0.25/GB | $2.50 |
| Lambda | リクエスト | 5,000万リクエスト | $0.20/100万 | $10.00 |
| Lambda | 実行時間 | 500万 GB-秒 | $0.0000166667/GB-秒 | $83.33 |
| CloudWatch | ログ | 100 GB | $0.50/GB | $50.00 |
| **合計** | | | | **$798.23** |

---

### コスト最適化のヒント

1. **ハートビート間隔の調整**
   - 本番環境: メンバーハートビート 120秒（~70% コスト削減）
   - 開発環境: 高速間隔でデバッグ容易性を優先

2. **不要な接続のクローズ**
   - クライアント側で未使用の WebSocket 接続を閉じる
   - グループ解散後は即座に切断

3. **イベントバッチング**
   - 複数イベントを 1 回の mutation で送信（`fireEventsByNode`）
   - クライアント側で 50ms バッファリング

4. **ログレベルの調整**
   - 本番環境: ERROR と WARN のみ
   - 開発環境: ALL で詳細ログ

5. **TTL による自動削除**
   - 期限切れデータを DynamoDB TTL で自動削除
   - 手動削除の API 呼び出しコスト削減

---

## スケーリング考慮事項

### DynamoDB スケーリング

#### オンデマンドモード（推奨）

- **利点**:
  - トラフィックの急増に自動対応
  - キャパシティプランニング不要
  - スロットリングのリスクが低い

- **欠点**:
  - プロビジョニングモードより高コスト（予測可能な負荷の場合）

#### プロビジョニングモード（オプション）

予測可能な負荷の場合、プロビジョニングモードでコスト削減可能:

```typescript
// CDK スタックでプロビジョニングモード設定
table.addGlobalSecondaryIndex({
  indexName: 'GSI1',
  partitionKey: { name: 'GSI1PK', type: dynamodb.AttributeType.STRING },
  sortKey: { name: 'GSI1SK', type: dynamodb.AttributeType.STRING },
  billingMode: dynamodb.BillingMode.PROVISIONED,
  readCapacity: 100,
  writeCapacity: 50,
});
```

**オートスケーリング設定**:

```typescript
const readScaling = table.autoScaleReadCapacity({
  minCapacity: 5,
  maxCapacity: 500,
});

readScaling.scaleOnUtilization({
  targetUtilizationPercent: 70,
});
```

---

### AppSync スケーリング

#### API 呼び出しスケーリング

- **自動**: AWS が管理（ユーザー設定不要）
- **制限**: アカウントごとに秒間 1,000 リクエスト（デフォルト）
- **引き上げ**: AWS サポートに連絡して制限引き上げ可能

#### WebSocket 接続スケーリング

- **制限**: アカウントごと、リージョンごとに 100,000 接続
- **監視**: `ConnectSuccess` メトリクスで接続数を監視
- **対策**: 複数リージョンへの分散、または AWS サポートに連絡

---

### Lambda スケーリング

#### 同時実行数

- **デフォルト**: アカウントごとに 1,000 同時実行
- **予約済み同時実行**: 特定の Lambda 関数に予約可能

```bash
aws lambda put-function-concurrency \
  --function-name MeshV2Stack-stg-LambdaFunction \
  --reserved-concurrent-executions 100
```

#### コールドスタート対策

- **Pipeline Resolver 優先**: 軽量な操作は AppSync JS で実装
- **プロビジョニング済み同時実行**: 常に warm な Lambda インスタンスを維持（コスト増）

---

## バックアップ・リカバリ

### DynamoDB バックアップ

#### オンデマンドバックアップ

手動でバックアップを作成:

```bash
aws dynamodb create-backup \
  --table-name MeshV2Table-stg \
  --backup-name MeshV2Table-stg-backup-$(date +%Y%m%d)
```

#### ポイントインタイムリカバリ（PITR）

**推奨**: 本番環境で有効化

```typescript
// CDK スタックで PITR 有効化
const table = new dynamodb.Table(this, 'MeshV2Table', {
  // ...
  pointInTimeRecovery: true,
});
```

**リカバリ**:

```bash
aws dynamodb restore-table-to-point-in-time \
  --source-table-name MeshV2Table \
  --target-table-name MeshV2Table-restored \
  --restore-date-time 2026-01-01T12:00:00Z
```

---

### CloudFormation スタック管理

#### スタックのエクスポート

デプロイ前のテンプレート保存:

```bash
docker compose run --rm infra bash -c "npx cdk synth" > mesh-v2-stack-$(date +%Y%m%d).yaml
```

#### スタックのロールバック

デプロイ失敗時の自動ロールバック:

```bash
docker compose run --rm infra npx cdk deploy --rollback
```

---

## トラブルシューティング

### よくある問題と解決策

#### 問題 1: Subscription が配信されない

**症状**: クライアントが subscription を購読しているが、mutation 実行後にメッセージが届かない。

**原因**:
- subscription パラメータ（groupId、domain）が mutation パラメータと不一致
- WebSocket 接続が切断されている
- mutation が失敗している

**解決策**:

1. **パラメータ確認**:
```javascript
// Subscription
onMessageInGroup(groupId: "abc123", domain: "192.168.1.1")

// Mutation (一致する必要あり)
reportDataByNode(groupId: "abc123", domain: "192.168.1.1", ...)
```

2. **WebSocket 接続確認**:
```bash
# CloudWatch Logs で WebSocket 接続状態を確認
aws logs filter-log-events \
  --log-group-name /aws/appsync/apis/xxx \
  --filter-pattern "subscription"
```

3. **Mutation 成功確認**:
```bash
# mutation のレスポンスで errors フィールドを確認
{
  "data": { "reportDataByNode": { ... } },
  "errors": null  # エラーがないこと
}
```

---

#### 問題 2: GroupNotFound エラーが頻発

**症状**: クライアントが `GroupNotFound` エラーを受信して切断される。

**原因**:
- ホストのハートビートが途絶えてグループが TTL で削除された
- グループが `dissolveGroup` で解散された
- groupId または domain が間違っている

**解決策**:

1. **ハートビート確認**:
```bash
# ホストが renewHeartbeat を定期的に呼び出しているか確認
aws logs filter-log-events \
  --log-group-name /aws/appsync/apis/xxx \
  --filter-pattern "renewHeartbeat"
```

2. **グループ存在確認**:
```bash
# DynamoDB でグループが存在するか確認
aws dynamodb query \
  --table-name MeshV2Table-stg \
  --key-condition-expression 'pk = :pk AND sk = :sk' \
  --expression-attribute-values '{
    ":pk": {"S": "DOMAIN#192.168.1.1"},
    ":sk": {"S": "GROUP#abc123#METADATA"}
  }'
```

3. **TTL 確認**:
```graphql
query {
  listGroupsByDomain(domain: "192.168.1.1") {
    id
    expiresAt  # この時刻を過ぎるとグループは削除される
  }
}
```

---

#### 問題 3: レイテンシが高い

**症状**: API レスポンス時間が 1 秒を超える。

**原因**:
- DynamoDB のホットパーティション
- Lambda のコールドスタート
- 非効率なクエリ

**解決策**:

1. **X-Ray でボトルネック特定**:
```bash
# X-Ray トレースでどこに時間がかかっているか確認
aws xray get-trace-summaries \
  --start-time $(date -u -d '1 hour ago' +%s) \
  --end-time $(date -u +%s) \
  --filter-expression 'duration > 1'
```

2. **DynamoDB クエリ最適化**:
   - GSI を使用（`listGroupsByDomain` は GSI1 を使用）
   - Scan を避ける（可能な限り Query を使用）

3. **Lambda 最適化**:
   - Pipeline Resolver に移行（軽量な操作）
   - メモリサイズ増加（CPU パフォーマンス向上）

---

#### 問題 4: 5XX エラーが発生

**症状**: AppSync が 5XX エラーを返す。

**原因**:
- DynamoDB のスロットリング
- Lambda のタイムアウトまたはエラー
- AppSync の内部エラー

**解決策**:

1. **CloudWatch Logs でエラー詳細確認**:
```bash
aws logs filter-log-events \
  --log-group-name /aws/appsync/apis/xxx \
  --filter-pattern "5XX"
```

2. **DynamoDB スロットリング確認**:
```bash
aws cloudwatch get-metric-statistics \
  --namespace AWS/DynamoDB \
  --metric-name ThrottledRequests \
  --dimensions Name=TableName,Value=MeshV2Table-stg \
  --start-time $(date -u -d '1 hour ago' --iso-8601=seconds) \
  --end-time $(date -u --iso-8601=seconds) \
  --period 300 \
  --statistics Sum
```

3. **Lambda エラー確認**:
```bash
aws logs filter-log-events \
  --log-group-name /aws/lambda/MeshV2Stack-stg-LambdaFunction \
  --filter-pattern "ERROR"
```

---

### ログ確認方法

#### リアルタイムログ監視

```bash
# AppSync ログをリアルタイムで監視
aws logs tail /aws/appsync/apis/xxx-xxx-xxx --follow

# Lambda ログをリアルタイムで監視
aws logs tail /aws/lambda/MeshV2Stack-stg-LambdaFunction --follow
```

#### 特定期間のログ取得

```bash
# 過去 1 時間のエラーログを取得
aws logs filter-log-events \
  --log-group-name /aws/appsync/apis/xxx \
  --start-time $(date -u -d '1 hour ago' +%s)000 \
  --filter-pattern "ERROR"
```

---

### ロールバック手順

#### CloudFormation スタックのロールバック

デプロイに問題がある場合、前のバージョンに戻す:

```bash
# 1. 前回の変更セットを確認
aws cloudformation list-change-sets --stack-name MeshV2Stack-stg

# 2. .env symlink を stg に設定してスタックを削除・再デプロイ（注意: データ損失の可能性）
docker compose run --rm infra npx cdk destroy
git checkout <previous-commit>
docker compose run --rm infra npx cdk deploy

# 3. または、手動で前の状態にロールバック
# (DynamoDB のポイントインタイムリカバリを使用)
```

#### DynamoDB テーブルのロールバック

ポイントインタイムリカバリを使用:

```bash
aws dynamodb restore-table-to-point-in-time \
  --source-table-name MeshV2Table-stg \
  --target-table-name MeshV2Table-stg-restored \
  --restore-date-time $(date -u -d '1 hour ago' --iso-8601=seconds)
```

---

## 関連ドキュメント

- [API リファレンス](api-reference.md) - GraphQL API の完全リファレンス
- [アーキテクチャ](architecture.md) - システム構成とデータフロー
- [開発ガイド](development.md) - ローカル開発とテスト
- [デプロイ手順](deployment.md) - 初回デプロイから運用まで
- [README.md](../README.md) - プロジェクト概要

---

## 参考資料

- [AWS AppSync Monitoring](https://docs.aws.amazon.com/appsync/latest/devguide/monitoring.html)
- [Amazon DynamoDB Monitoring](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/monitoring.html)
- [AWS Lambda Monitoring](https://docs.aws.amazon.com/lambda/latest/dg/lambda-monitoring.html)
- [AWS X-Ray](https://docs.aws.amazon.com/xray/latest/devguide/aws-xray.html)
- [AWS Cost Management](https://aws.amazon.com/aws-cost-management/)

---

**Last Updated**: 2026-01-01
**Phase**: 4-3 - Operations Documentation
**Status**: ✅ Complete
