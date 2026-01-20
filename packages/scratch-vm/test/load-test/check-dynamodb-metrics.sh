#!/bin/bash
# DynamoDB メトリクス確認スクリプト
# MESH v2 負荷テスト用 - DynamoDBのスロットリングとパフォーマンスを確認

set -e

TABLE_NAME="${1:-}"
HOURS_AGO="${2:-1}"

if [ -z "$TABLE_NAME" ]; then
  echo "使用方法: $0 <テーブル名> [時間前(デフォルト:1)]"
  echo ""
  echo "例:"
  echo "  $0 mesh-v2-groups-table       # 過去1時間のメトリクスを表示"
  echo "  $0 mesh-v2-groups-table 2     # 過去2時間のメトリクスを表示"
  echo ""
  echo "利用可能なテーブル一覧:"
  aws dynamodb list-tables --query 'TableNames' --output table 2>/dev/null || echo "  (AWS CLIでテーブル一覧を取得できませんでした)"
  exit 1
fi

# macOS/Linux 互換の日付計算
if date --version >/dev/null 2>&1; then
  # GNU date (Linux)
  START_TIME=$(date -u -d "$HOURS_AGO hours ago" +"%Y-%m-%dT%H:%M:%SZ")
  END_TIME=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
else
  # BSD date (macOS)
  START_TIME=$(date -u -v-${HOURS_AGO}H +"%Y-%m-%dT%H:%M:%SZ")
  END_TIME=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
fi

echo "========================================="
echo "DynamoDB メトリクス確認"
echo "========================================="
echo "テーブル名: $TABLE_NAME"
echo "期間: $START_TIME ～ $END_TIME"
echo "========================================="
echo ""

# テーブルの課金モードを確認
echo "【課金モード】"
aws dynamodb describe-table \
  --table-name "$TABLE_NAME" \
  --query 'Table.BillingModeSummary' \
  --output table 2>/dev/null || echo "  テーブル情報を取得できませんでした"
echo ""

# 1. スロットリング確認（最重要）
echo "【1. スロットリング発生数】★最重要★"
echo "   期待値: 0 (スロットリングが発生していないこと)"
THROTTLED=$(aws cloudwatch get-metric-statistics \
  --namespace AWS/DynamoDB \
  --metric-name ThrottledRequests \
  --dimensions Name=TableName,Value="$TABLE_NAME" \
  --start-time "$START_TIME" \
  --end-time "$END_TIME" \
  --period 300 \
  --statistics Sum \
  --query 'Datapoints[*].[Timestamp,Sum]' \
  --output table 2>/dev/null)

if [ -z "$THROTTLED" ] || echo "$THROTTLED" | grep -q "None"; then
  echo "   ✅ データなし（スロットリングなし）"
else
  echo "$THROTTLED"
  # スロットリングがあるか確認
  if echo "$THROTTLED" | grep -q "|.*[1-9]"; then
    echo "   ⚠️  警告: スロットリングが発生しています！"
  else
    echo "   ✅ スロットリングなし"
  fi
fi
echo ""

# 2. 読み込みキャパシティ
echo "【2. 読み込みキャパシティ消費量】"
aws cloudwatch get-metric-statistics \
  --namespace AWS/DynamoDB \
  --metric-name ConsumedReadCapacityUnits \
  --dimensions Name=TableName,Value="$TABLE_NAME" \
  --start-time "$START_TIME" \
  --end-time "$END_TIME" \
  --period 300 \
  --statistics Average,Maximum \
  --query 'Datapoints[*].[Timestamp,Average,Maximum]' \
  --output table 2>/dev/null || echo "   データなし"
echo ""

# 3. 書き込みキャパシティ
echo "【3. 書き込みキャパシティ消費量】"
aws cloudwatch get-metric-statistics \
  --namespace AWS/DynamoDB \
  --metric-name ConsumedWriteCapacityUnits \
  --dimensions Name=TableName,Value="$TABLE_NAME" \
  --start-time "$START_TIME" \
  --end-time "$END_TIME" \
  --period 300 \
  --statistics Average,Maximum \
  --query 'Datapoints[*].[Timestamp,Average,Maximum]' \
  --output table 2>/dev/null || echo "   データなし"
echo ""

# 4. システムエラー
echo "【4. システムエラー】"
echo "   期待値: 0"
SYSTEM_ERRORS=$(aws cloudwatch get-metric-statistics \
  --namespace AWS/DynamoDB \
  --metric-name SystemErrors \
  --dimensions Name=TableName,Value="$TABLE_NAME" \
  --start-time "$START_TIME" \
  --end-time "$END_TIME" \
  --period 300 \
  --statistics Sum \
  --query 'Datapoints[*].[Timestamp,Sum]' \
  --output table 2>/dev/null)

if [ -z "$SYSTEM_ERRORS" ] || echo "$SYSTEM_ERRORS" | grep -q "None"; then
  echo "   ✅ データなし（エラーなし）"
else
  echo "$SYSTEM_ERRORS"
fi
echo ""

# 5. ユーザーエラー
echo "【5. ユーザーエラー】"
echo "   期待値: 0 または 非常に少ない"
USER_ERRORS=$(aws cloudwatch get-metric-statistics \
  --namespace AWS/DynamoDB \
  --metric-name UserErrors \
  --dimensions Name=TableName,Value="$TABLE_NAME" \
  --start-time "$START_TIME" \
  --end-time "$END_TIME" \
  --period 300 \
  --statistics Sum \
  --query 'Datapoints[*].[Timestamp,Sum]' \
  --output table 2>/dev/null)

if [ -z "$USER_ERRORS" ] || echo "$USER_ERRORS" | grep -q "None"; then
  echo "   ✅ データなし（エラーなし）"
else
  echo "$USER_ERRORS"
fi
echo ""

echo "========================================="
echo "確認完了"
echo "========================================="
