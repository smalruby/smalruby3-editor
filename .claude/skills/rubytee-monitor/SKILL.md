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
- **ステージ**: `prod`, `stg`（デフォルト: `prod`）

例:
- `/rubytee-monitor` → prod の直近 24 時間
- `/rubytee-monitor 6h stg` → stg の直近 6 時間
- `/rubytee-monitor 7d` → prod の直近 7 日間

---

## Phase 1: ログの取得

relay で Claude を呼ぶのは「ルビティーにまかせる」の **worker** だけ（Ruby タブの旧チャットは止めた）。ログは 2 つのロググループにある:

- worker `/aws/lambda/RubyteeRelayTakeoverWorker<suffix>`: Claude の呼び出しごとの `rubytee_takeover_response`（JSON）と、Claude のエラー
- 受け口 `/aws/lambda/RubyteeRelayHandler<suffix>`: レート制限で断った記録（`[RateLimit] Takeover blocked`）など。Claude は呼ばない

コンテナ内では AWS CLI を直接実行する（`AWS_PROFILE=smalruby AWS_REGION=ap-northeast-1`）。

**ログ取得用の AWS CLI コマンド**:

```bash
# Claude の呼び出し（1 回 1 行の JSON）
aws logs filter-log-events \
  --log-group-name "/aws/lambda/RubyteeRelayTakeoverWorker<suffix>" \
  --start-time <epoch_ms> \
  --filter-pattern '"rubytee_takeover_response"' \
  --query 'events[].message' --output text

# Claude のエラー
aws logs filter-log-events \
  --log-group-name "/aws/lambda/RubyteeRelayTakeoverWorker<suffix>" \
  --start-time <epoch_ms> \
  --filter-pattern '"[Takeover] Claude call failed"' \
  --query 'events[].message' --output text

# レート制限で断った記録（席 / IP）
aws logs filter-log-events \
  --log-group-name "/aws/lambda/RubyteeRelayHandler<suffix>" \
  --start-time <epoch_ms> \
  --filter-pattern '"[RateLimit] Takeover blocked"' \
  --query 'events[].message' --output text
```

**ロググループ名のサフィックス**: prod は無し、stg は `-stg`。

**epoch_ms の計算**:

```bash
date -d '24 hours ago' +%s000   # Linux（コンテナ内）
date -v-24H +%s000              # macOS
```

席ごと・日ごとの回数とトークンは、集計表 `RubyteeRelayUsage<suffix>` にもある（`docs/rubytee/README.md` の「利用の集計・席ごとの状況」）。

---

## Phase 2: ログの分析

取得したログを以下の観点で分析する。`rubytee_takeover_response` の項目は `model` / `status` / `inputTokens` / `outputTokens` /
`cacheCreationTokens` / `cacheReadTokens` / `userMessageLength` / `purpose` / `classroom` / `seat`。

### 2a. 利用統計サマリー

```
## 利用統計（<期間>、<ステージ>）

- Claude の呼び出し数: N（status ごと: done / error）
- クラス数・席数: N / N（classroom / seat があるもの）
- レート制限で断った回数: N（席 / IP）
- Claude のエラー数: N
- 平均出力トークン: N
- 平均入力トークン: N（input + cacheCreation + cacheRead）
```

### 2b. キャッシュ効率分析

```
## キャッシュ効率

- キャッシュヒット率: N%（cacheReadTokens > 0 の呼び出し / 総数）
- キャッシュ作成回数: N（cacheCreationTokens > 0）
- キャッシュミス回数: N（両方 0）

⚠️ キャッシュミスが多い場合: system の固定部分が、モデルのキャッシュの最小トークン数を下回っている可能性。
キャッシュの TTL は 1 時間（ttl: '1h'）なので、利用がまばらな時間帯の作成は正常
```

### 2c. コスト推定

ログの `model` の料金で計算する。料金は変わるので、この文書に単価を書かない。最新の料金表（claude-api の skill か
Anthropic の公式の料金ページ）で、input / output / cache write（1 時間 TTL の単価）/ cache read の単価を確かめて使う。

```
## コスト推定（<model>）

- Input / Output / Cache write / Cache read の各トークン数 × 単価
- **合計: $X.XX**
- 1 回あたり平均: $X.XXXX
```

### 2d. 不適切な利用パターンの検出

以下のパターンを検出し、フラグを立てる（上限は `lambda/takeover.ts`: 入力 10000 字・出力 8192 トークン・1 席 40 回 / 35 分）:

1. **上限に近い長さの入力**: `userMessageLength` が 8000 を超える呼び出し
2. **上限に近い出力**: `outputTokens` が 7000 を超える呼び出し（作品が大きすぎる・答えが暴走している）
3. **同じ席の集中**: 1 つの `classroom` + `seat` の回数が、席の上限（40 回 / 35 分）に何度も届いている
4. **Claude のエラーの集中**: 短期間にエラーが集中している場合
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

- **キャッシュヒット率が低い場合**: 「system の固定部分のトークン数が、モデルのキャッシュの最小トークン数を超えているか確認してください」
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
- **ロググループが見つからない場合**: ステージ名が正しいか確認を促す（prod, stg）
