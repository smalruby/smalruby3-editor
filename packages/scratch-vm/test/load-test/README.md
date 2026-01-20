# MESH v2 Load Testing

Load testing scripts for the MESH v2 GraphQL/AppSync backend.

## Setup

```bash
cd test/load-test
npm install
```

## Environment Variables

Set the following environment variables before running tests:

```bash
export MESH_GRAPHQL_ENDPOINT="https://your-appsync-endpoint.amazonaws.com/graphql"
export MESH_API_KEY="your-api-key"

# Alternative variable names (also supported)
export APPSYNC_ENDPOINT="https://your-appsync-endpoint.amazonaws.com/graphql"
export APPSYNC_API_KEY="your-api-key"
```

## Running Tests

### Individual Tests

```bash
# Data update load test (4 nodes, 4 updates/sec/node, 1 minute)
npm run test:data-update

# Event notification load test (4 nodes, 4 events/sec/node, 1 minute)
npm run test:event

# Multi-group load test (2 groups by default)
npm run test:multi-group

# Multi-group with custom group count
npm run test:multi-group -- --groups=10
```

### Run All Tests

```bash
npm run test:all
```

## Test Descriptions

### 1. Data Update Load Test (`mesh-v2-data-update-load.js`)

Tests the performance of data update operations:

- Creates a single group with 4 nodes
- Each node sends data updates at 4 updates/second
- Runs for 1 minute
- Measures TPS, latency (P50, P95, P99), and error rates

**Expected Results**: ~16 TPS (4 nodes × 4 updates/sec)

### 2. Event Notification Load Test (`mesh-v2-event-load.js`)

Tests event publishing and delivery performance:

- Creates a single group with 4 nodes
- Each node publishes events at 4 events/second
- Runs for 1 minute
- Measures event delivery delay and error rates

**Expected Results**: ~16 TPS (4 nodes × 4 events/sec)

### 3. Multi-Group Load Test (`mesh-v2-multi-group-load.js`)

Tests concurrent group operations:

- Creates multiple groups (default: 2, configurable with `--groups=N`)
- Each group has 4 nodes
- Each node sends 2 data updates/sec + 2 events/sec
- Runs for 1 minute
- Detects crosstalk between groups

**Expected Results**: ~32 TPS for 2 groups (8 nodes × 4 ops/sec)

## Test Results

Results are output to console in JSON format and include:

- **Summary**: Duration, total requests, success/error counts, TPS
- **Latency**: Average, P50, P95, P99, Max (in milliseconds)
- **Events**: Delivered count, average delivery delay
- **Crosstalk**: Detection of messages crossing between groups

### Example Output

```json
{
  "summary": {
    "durationSeconds": 61.28,
    "totalRequests": 959,
    "successCount": 959,
    "errorCount": 0,
    "errorRate": "0.00%",
    "tps": "15.65"
  },
  "latency": {
    "avg": "109.36",
    "p50": 106,
    "p95": 163,
    "p99": 193,
    "max": 374
  },
  "events": {
    "delivered": 0,
    "avgDeliveryDelay": 0
  },
  "crosstalk": {
    "count": 0,
    "details": []
  }
}
```

## Performance Targets

Based on [GitHub Issue #68](https://github.com/smalruby/scratch-vm/issues/68):

- **Target**: 100 groups × 4 nodes = 400 total nodes
- **Operations**: 4 data updates/sec + 4 events/sec per node
- **Expected TPS**: 3,200 TPS (400 nodes × 8 ops/sec)
- **Platform**: MacBook Air M3 32GB RAM

## Architecture

### Group Lifecycle

1. **Create**: First client (host) creates group with `maxConnectionTimeSeconds=600`
2. **Heartbeat**: Host sends initial heartbeat to keep group alive
3. **Join**: Remaining clients join the group
4. **Subscribe**: All clients subscribe to data updates and events
5. **Test**: Clients send data updates and publish events
6. **Cleanup**: Members leave group, host dissolves group

### Key Features

- **Unique identifiers**: Group names and domains use timestamps for uniqueness
- **Heartbeat management**: Automatic heartbeat sending by hosts
- **Proper cleanup**: dissolveGroup for hosts, leaveGroup for members
- **Error handling**: Comprehensive error logging and null-checking
- **Metrics collection**: TPS, latency percentiles, event delivery tracking

## DynamoDB Performance Monitoring

### Checking DynamoDB Metrics

Use the provided script to check DynamoDB performance and throttling:

```bash
# 基本的な使い方（過去1時間のメトリクスを確認）
./check-dynamodb-metrics.sh <テーブル名>

# 過去2時間のメトリクスを確認
./check-dynamodb-metrics.sh <テーブル名> 2

# 例：mesh-v2-groups-table の確認
./check-dynamodb-metrics.sh mesh-v2-groups-table
```

### 確認項目

スクリプトは以下のメトリクスを自動的にチェックします：

1. **スロットリング発生数** (ThrottledRequests) - 最重要
   - 期待値: 0（スロットリングなし）
   - 0より大きい場合、キャパシティ不足を示す

2. **読み込みキャパシティ消費量** (ConsumedReadCapacityUnits)
   - 平均値と最大値を表示
   - 負荷テスト中の読み取り負荷を確認

3. **書き込みキャパシティ消費量** (ConsumedWriteCapacityUnits)
   - 平均値と最大値を表示
   - 負荷テスト中の書き込み負荷を確認

4. **システムエラー** (SystemErrors)
   - 期待値: 0
   - DynamoDB側の問題を示す

5. **ユーザーエラー** (UserErrors)
   - 期待値: 0または非常に少ない
   - アプリケーション側のエラーを示す

### テーブル名の確認方法

```bash
# 利用可能なDynamoDBテーブル一覧を表示
aws dynamodb list-tables --output table

# CloudFormationスタックからテーブル名を取得
aws cloudformation describe-stacks \
  --stack-name <スタック名> \
  --query 'Stacks[0].Outputs[?OutputKey==`GroupsTableName`].OutputValue' \
  --output text
```

### オンデマンドモードの確認

スクリプトは自動的に課金モードを表示します。期待される出力：

```
BillingMode: PAY_PER_REQUEST
```

## Troubleshooting

### Error: "maxConnectionTimeSeconds cannot exceed 600"

The server limits group lifetime to 10 minutes (600 seconds). This is the maximum value.

### Error: "Group not found (heartbeat expired)"

Groups require periodic heartbeats. The implementation automatically sends an initial heartbeat after group creation.

### Error: "Group not found" with old UUID

If tests are reusing the same domain name, stale groups may cause conflicts. The tests now use unique domain names per run: `test-domain-${Date.now()}`

### DynamoDB Throttling Detected

If `check-dynamodb-metrics.sh` reports throttled requests:

1. Check if on-demand mode is enabled (should be `PAY_PER_REQUEST`)
2. Review the load pattern - sudden spikes may cause temporary throttling
3. Consider implementing exponential backoff in client code
4. Check AWS Service Quotas for DynamoDB limits

## Report Generation

Generate a Markdown report from test results:

```bash
# Run a test and save output to JSON
npm run test:data-update > results.json

# Generate report (requires manual JSON extraction from console output)
npm run report -- --input=results.json
```

Note: Currently, you need to manually extract the JSON result from console output and save it to a file.

## Related Documentation

- [GitHub Issue #68](https://github.com/smalruby/scratch-vm/issues/68) - Load test implementation
- [GitHub Issue #454](https://github.com/smalruby/smalruby3-gui/issues/454) - MESH v2 specification
