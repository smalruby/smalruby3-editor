---
name: rubytee-monitor
description: Rubytee の CloudWatch ログを取得し、不適切な利用パターンやコスト異常を検出する。
argument-hint: "[期間: 1h, 6h, 24h, 7d など（デフォルト: 24h）] [ステージ: prod, stg（デフォルト: prod）]"
---

# /rubytee-monitor - Rubytee CloudWatch モニタリング

Rubytee relay の CloudWatch ログを取得・分析し、不適切な利用パターン、コスト異常、システムエラーを検出する。

## 引数の解析

`$ARGUMENTS` から以下を解析する（すべてオプション）:

- **期間**: `1h`, `6h`, `24h`, `7d` など（デフォルト: `24h`）
- **ステージ**: `prod`, `stg`, `stg2`（デフォルト: `prod`）

例:
- `/rubytee-monitor` → prod の直近 24 時間
- `/rubytee-monitor 6h stg` → stg の直近 6 時間
- `/rubytee-monitor 7d` → prod の直近 7 日間

---

## Phase 1: ログの取得

### ログの取得

CloudWatch Logs Insights を使用してログを取得する。`docker compose run` の `infra` サービスで AWS CLI を実行する。

**ログ取得用の AWS CLI コマンド**:

```bash
# 全 rubytee_response イベント
docker compose run --rm -w /app/infra/smalruby-rubytee-relay infra \
  aws logs filter-log-events \
    --log-group-name "/aws/lambda/RubyteeRelayHandler<suffix>" \
    --start-time <epoch_ms> \
    --filter-pattern '"rubytee_response"' \
    --query 'events[].message' \
    --output text

# レートリミット（ブロック）イベント
docker compose run --rm -w /app/infra/smalruby-rubytee-relay infra \
  aws logs filter-log-events \
    --log-group-name "/aws/lambda/RubyteeRelayHandler<suffix>" \
    --start-time <epoch_ms> \
    --filter-pattern '"[RateLimit] Blocked"' \
    --query 'events[].message' \
    --output text

# Claude API エラー
docker compose run --rm -w /app/infra/smalruby-rubytee-relay infra \
  aws logs filter-log-events \
    --log-group-name "/aws/lambda/RubyteeRelayHandler<suffix>" \
    --start-time <epoch_ms> \
    --filter-pattern '"[Claude] API error"' \
    --query 'events[].message' \
    --output text
```

**ロググループ名のサフィックス**:

| ステージ | サフィックス |
|---------|------------|
| prod | （なし） → `/aws/lambda/RubyteeRelayHandler` |
| stg | `-stg` → `/aws/lambda/RubyteeRelayHandler-stg` |
| stg2 | `-stg2` → `/aws/lambda/RubyteeRelayHandler-stg2` |

**epoch_ms の計算**:

```bash
# macOS
date -v-24H +%s000    # 24時間前
date -v-7d +%s000     # 7日前
date -v-1H +%s000     # 1時間前
```

---

## Phase 2: ログの分析

取得したログを以下の観点で分析する。

### 2a. 利用統計サマリー

```
## 利用統計（<期間>、<ステージ>）

- 総リクエスト数: N
- ユニーク IP 数: N（stg のみ、prod は sourceIp なし）
- レートリミット発動回数: N
- Claude API エラー数: N
- 平均出力トークン: N
- 平均入力トークン: N
```

### 2b. キャッシュ効率分析

```
## キャッシュ効率

- キャッシュヒット率: N%（cacheReadTokens > 0 のリクエスト / 総リクエスト）
- キャッシュ作成回数: N（cacheCreationTokens > 0）
- キャッシュヒット回数: N（cacheReadTokens > 0）
- キャッシュミス回数: N（両方 0）

⚠️ キャッシュミスが多い場合: システムプロンプトのトークン数が 4,096 を下回っている可能性
```

### 2c. コスト推定

Claude Haiku 4.5 の料金で概算する:

| 項目 | 単価（1M トークン） |
|------|-------------------|
| Input tokens | $1.00 |
| Output tokens | $5.00 |
| Cache write | $1.25 |
| Cache read | $0.10 |

```
## コスト推定

- Input: $X.XX（N tokens × $1.00/1M）
- Output: $X.XX（N tokens × $5.00/1M）
- Cache write: $X.XX（N tokens × $1.25/1M）
- Cache read: $X.XX（N tokens × $0.10/1M）
- **合計: $X.XX**
- 1リクエストあたり平均: $X.XXXX
```

### 2d. 不適切な利用パターンの検出

以下のパターンを検出し、フラグを立てる:

1. **異常に長いユーザーメッセージ**: `userMessageLength` が 200 を超えるリクエスト
2. **レートリミット頻発**: 同一 IP（stg のみ）からの連続ブロック
3. **異常に高い出力トークン**: `outputTokens` が 1000 を超えるリクエスト
4. **Claude API エラー集中**: 短期間にエラーが集中している場合
5. **529 (Overloaded) エラー**: Anthropic API の過負荷

---

## Phase 3: レポート生成

分析結果をまとめてユーザーに報告する。

```markdown
# Rubytee モニタリングレポート

**期間**: YYYY-MM-DD HH:MM 〜 YYYY-MM-DD HH:MM（JST）
**ステージ**: prod / stg

## 利用統計
（Phase 2a の内容）

## キャッシュ効率
（Phase 2b の内容）

## コスト推定
（Phase 2c の内容）

## 検出されたアラート
（Phase 2d で検出されたもの、なければ「アラートなし」）

## 推奨アクション
（検出内容に基づく対応案）
```

### 推奨アクションの例

- **キャッシュヒット率が低い場合**: 「システムプロンプトのトークン数を確認してください（最小 4,096 トークン）」
- **レートリミット頻発の場合**: 「レートリミットの閾値調整を検討してください（現在: RATE_LIMIT_MAX_REQUESTS/RATE_LIMIT_WINDOW_MINUTES）」
- **529 エラーが多い場合**: 「Anthropic のステータスページを確認してください: https://status.anthropic.com」
- **コストが想定を超える場合**: 「1日あたりのコスト上限アラートの設定を検討してください」

---

## Phase 4: レポートの蓄積

### 4a. Secret Gist に保存

レポートを `/tmp/rubytee-monitor-report-YYYY-MM-DD.md` に書き出し、Secret Gist として作成する:

```bash
gh gist create /tmp/rubytee-monitor-report-YYYY-MM-DD.md \
  -d "Rubytee monitoring report - <stage> - YYYY-MM-DD"
rm /tmp/rubytee-monitor-report-YYYY-MM-DD.md
```

### 4b. Claude プロジェクトメモリを更新

`reference_rubytee_monitoring.md` メモリの「レポート一覧」テーブルに新しい行を追加し、「前回チェック」セクションを更新する。

これにより次回 `/rubytee-monitor` 実行時に前回チェック日とレポート URL を参照できる。

---

## Phase 5: 前回チェックからの差分（オプション）

Claude メモリ `reference_rubytee_monitoring` から前回チェック情報を読み取り、前回からの変化をハイライトする:

- リクエスト数の増減
- コストの推移
- 新しいアラートの有無
- キャッシュ効率の変化

---

## エラーハンドリング

- **AWS 認証エラー**: `AWS_PROFILE` や `AWS_ACCESS_KEY_ID` が設定されているか確認を促す
- **ログが空の場合**: 指定期間にリクエストがなかった旨を報告し、期間の拡大を提案する
- **ロググループが見つからない場合**: ステージ名が正しいか確認を促す（prod, stg, stg2）
