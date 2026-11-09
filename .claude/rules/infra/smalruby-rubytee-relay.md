---
paths:
  - "infra/smalruby-rubytee-relay/"
  - "infra/smalruby-rubytee-relay/**"
  - "infra/smalruby-rubytee-relay/**/*"
---

# smalruby-rubytee-relay

CDK project for the Rubytee AI relay service (Anthropic Claude) (API Gateway + Lambda + DynamoDB).
Proxies requests from the Ruby tab's AI chat to the Anthropic Claude API with rate limiting and input validation.

## Architecture

- **API Gateway HTTP API v2**（stage スロットリング: prod 10rps/burst 30、stg 5/10）
  - `POST /generate` — 従来の同期チャット。`purpose: "genai-takeover"`（ルビティーにまかせる）のときだけ
    非同期ジョブを作って `202 { jobId, status: "pending" }` を返す
  - `GET /jobs/{jobId}` — takeover ジョブの結果の問い合わせ（ルート単位のスロットリング: prod 40/80、stg 10/20。
    レート制限の回数には数えない）
- **Lambda (Node.js 22)** 2 つ
  - `RubyteeRelayHandler{suffix}` — 入力チェック・レート制限・同期の Claude 呼び出し・takeover ジョブの作成と照会
  - `RubyteeRelayTakeoverWorker{suffix}` — takeover の Claude 呼び出し。**HTTP ルートなし**（API Lambda から非同期
    invoke のみ）・再試行 0 回・`maxEventAge` 60 秒・同時実行数の上限あり（Claude の二重呼び出しと費用の青天井を防ぐ）
- **DynamoDB** 3 つ
  - `RubyteeRelayRateLimit{suffix}` — IP / 席ごとのレート制限（固定窓・TTL）。席ごとの「今の状況」1 行もここに置く
    （クラス管理が読み取り専用で読む）。DESTROY
  - `RubyteeJobs{suffix}` — takeover ジョブの状態と答え（入力は保存しない）。TTL 1 時間。DESTROY
  - `RubyteeRelayUsage{suffix}` — classroom / seat / 日 / purpose ごとの利用集計。**RETAIN・TTL なし**（集計の元データ）。
    名前・IP・入力は残さない

takeover の上限・ジョブの流れ・集計表のキーの正準は `docs/rubytee/README.md`（「ルビティーにまかせる」「利用の集計」）。

### 認可モデル / 防御（実装事実）

- **ID Token 認証は無い**（子供が匿名で利用するサービス）。防御は
  入力バリデーション（長さ・`DANGEROUS_PATTERNS` によるプロンプトインジェクション対策）+
  IP レート制限 + API Gateway スロットリングの 3 層。
- **レート制限は fail-open**: DynamoDB 障害時はリクエストを**許可**する（可用性優先の意図的
  設計。fail-close に変えるときはこの前提を確認する）。
- **席（classroom / 出席番号）は `sessionToken` で確かめたものだけを信じる**。リクエストの
  `classroom` / `seat` は自己申告なので使わない（送られても無視）。API Lambda がクラス管理の
  `ClassroomMemberships{suffix}` の GSI `sessionToken-index` を読み取り専用で Query し（IAM もこの GSI への
  `dynamodb:Query` だけ）、kicked の行は認めない。確かめた席だけを takeover の席の上限・`seat#...#current`・
  集計表・ログに使う。**確かめられないとき（Query の失敗を含む）は席として数えず IP だけの上限**にする
  （不正防止なので fail-open の例外。答えは返す）。純粋な判定は `lambda/seat-session.ts`、I/O は
  `handler.ts` の `verifySeatSession`。
- エラーレスポンスは `{ "error": "<CODE>" }` 形式。主なコード: `INVALID_JSON` / `INPUT_MISSING` /
  `INPUT_TOO_SHORT` / `INPUT_TOO_LONG` / `INVALID_INPUT` / `INVALID_STATE_CONTEXT` / `HISTORY_TOO_LONG` /
  `RATE_LIMIT_EXCEEDED`(429) / `AI_OVERLOADED`(502, Anthropic 529) / `AI_API_ERROR`(502) /
  `INTERNAL_ERROR`(500)。takeover で増えるもの: `INVALID_JOB_ID`(400) / `JOB_NOT_FOUND`(404)、
  ジョブの `status: "error"` として返る `JOB_TIMEOUT` / `AI_TIMEOUT`。フロントはこのコードで分岐するため、
  変更は互換性破壊。
- **混雑時は一時的な劣化を許容する**（fail-open の方針。`development.md`「混雑・障害時の劣化」）。

## Custom Domains

| Stage | Domain |
|-------|--------|
| stg | `stg.rubytee.api.smalruby.app` |
| prod | `rubytee.api.smalruby.app` |

`RUBYTEE_CUSTOM_DOMAIN` で上書き、`false` で無効化（親ゾーンは `ROUTE53_PARENT_ZONE_NAME`、
既定 `api.smalruby.app`）。

## Commands

Since the `infra` Docker service defaults to `smalruby-mesh-v2`, use `-w` to override the working directory:

```bash
# Install dependencies
docker compose run --rm -w /app/infra/smalruby-rubytee-relay infra npm install

# Synthesize CloudFormation template
docker compose run --rm -w /app/infra/smalruby-rubytee-relay infra npx cdk synth

# Show diff against deployed stack
docker compose run --rm -w /app/infra/smalruby-rubytee-relay infra npx cdk diff

# Deploy (uses STAGE from .env symlink)
docker compose run --rm -w /app/infra/smalruby-rubytee-relay infra npx cdk deploy

# Deploy with explicit stage override
docker compose run --rm -w /app/infra/smalruby-rubytee-relay infra npx cdk deploy --context stage=stg
```

**Note**: There is no dedicated Docker volume for `smalruby-rubytee-relay/node_modules`, so `npm install` runs inside the bind-mounted directory. This is fine because rubytee-relay has fewer dependencies than mesh-v2.

## Environment Variables

| Variable | Description |
|----------|-------------|
| `STAGE` | Deployment stage (`stg` or `prod`) |
| `ANTHROPIC_FEDERATION_RULE_ID` / `ANTHROPIC_ORGANIZATION_ID` / `ANTHROPIC_SERVICE_ACCOUNT_ID` / `ANTHROPIC_WORKSPACE_ID` | Claude を WIF で呼ぶ値（worker だけ。静的な API キーは使わない。`docs/infra/claude-api-wif.md`） |
| `CLAUDE_TAKEOVER_MODEL` | 「ルビティーにまかせる」（worker）で使うモデル（default: `claude-sonnet-5-5`） |
| `CLASSROOM_MEMBERSHIPS_TABLE_NAME` | 席を確かめるクラス管理の memberships 表名（既定 `ClassroomMemberships{suffix}`） |
| `RATE_LIMIT_WINDOW_MINUTES` | Rate limit window in minutes (default: 35) |
| `RATE_LIMIT_MAX_REQUESTS` | Max requests per window (default: 40) |
| `MIN_USER_MESSAGE_LENGTH` | Min user message length (default: 10) |
| `CORS_ALLOWED_ORIGINS` | Comma-separated allowed origins |
| `RUBYTEE_CUSTOM_DOMAIN` | Override custom domain. Set `false` to disable |
| `ROUTE53_PARENT_ZONE_NAME` | Parent zone for custom domain (default: `api.smalruby.app`) |
| `RUBYTEE_RELAY_ENDPOINT` | Integration テスト用（デプロイ済み stg エンドポイント） |

## Typical Deployment Flow

1. **Switch to target stage**: `cd infra/smalruby-rubytee-relay && rm .env && ln -s .env.stg .env`
2. **Check diff**: `docker compose run --rm -w /app/infra/smalruby-rubytee-relay infra npx cdk diff`
3. **Deploy**: `docker compose run --rm -w /app/infra/smalruby-rubytee-relay infra npx cdk deploy`
4. **Verify**: Test the deployed endpoint
5. **Repeat for prod**: `rm .env && ln -s .env.prod .env` → diff → deploy

## System Prompt Tuning

relay が Claude を呼ぶのは「ルビティーにまかせる」の worker だけ（Ruby タブの旧チャットは止めた。`POST /generate` は
`purpose: "genai-takeover"` 以外を 410 `CHAT_DISCONTINUED` で断る）。システムプロンプトは `lambda/takeover.ts` の
`buildTakeoverSystem`（言語仕様は `lambda/smalruby-reference.ts`）。変える手順:

1. **ローカルで unit テスト**: `lambda/tests/takeover.test.ts` / `takeover-worker.test.ts`
2. **stg で確かめる**: PR に `deploy-stg` ラベルを付けて stg に出し、worker を直接 invoke するか、ブランチプレビューで「ルビティーにまかせる」を動かして答えの形を見る
3. **prod**: develop へのマージで出る

### プロンプトチューニングの評価ポイント

- **Smalruby 文法の正確性**: `set_x()` ではなく `self.x =` を使用しているか、正しいメソッド名か
- **答えの形**: `COPY_START` / `COPY_END` の印のあいだに、そのスプライトの Ruby が 1 つだけあるか（GUI の `checkAnswer` が読む）
- **コスト効率**: system の固定部分が、モデルのキャッシュの最小トークン数を超えているか

## Prompt Caching (コスト最適化)

- system の先頭ブロック（固定部分）に `cache_control: { type: 'ephemeral', ttl: '1h' }` を付ける（`buildTakeoverSystem`）。毎回変わる作品の状態は後ろのブロックに置く。beta ヘッダは付けない
- 最小トークン数を下回るとキャッシュが効かない（Sonnet 系 1,024 / Haiku・Opus 系 4,096）。今の固定部分は約 6,300 トークンで、2 回目から `cacheReadTokens` が付く
- workspace を新しくした直後の 1 回目は `cacheCreationTokens`（workspace ごとにキャッシュが分かれる）

### CloudWatch ログでの確認

```bash
aws logs tail /aws/lambda/RubyteeRelayTakeoverWorker-stg --since 5m --format short | grep "rubytee_takeover_response"
```

- `cacheCreationTokens > 0`: キャッシュ作成（初回）
- `cacheReadTokens > 0`: キャッシュヒット
- 両方 0: キャッシュが効いていない（トークン数不足の可能性）

## CORS Configuration

| Stage | Allowed Origins |
|-------|----------------|
| stg | `https://smalruby.app`, `https://smalruby.jp`, `http://localhost:8601`, `https://preview.smalruby.app` |
| prod | `https://smalruby.app`, `https://smalruby.jp` |

**Note**: prod には `localhost` もブランチプレビューも含めない。ローカル開発テストでは stg エンドポイントを使用する。
`https://preview.smalruby.app`（ブランチプレビュー。stg の API を見る）は、`CORS_ALLOWED_ORIGINS` を
`.env.stg` で指定していても非 prod ではコードが足す（`lib/cors-origins.ts` の `withPreviewOrigins`。正本は `infra/shared/cors-origins.ts`）。

## Anthropic Guidelines Compliance

Rubytee は未成年者（子供）が利用するサービスのため、[Anthropic のガイドライン](https://support.claude.com/en/articles/9307344-responsible-use-of-anthropic-s-models-guidelines-for-organizations-serving-minors)に準拠する必要がある:

1. **利用の条件確認**: クラス管理で先生が条件を確かめてルビティーを有効にしたクラスの生徒だけが使える（生徒の画面では同意を取り直さない）
2. **コンテンツモデレーション**: takeover のシステムプロンプト（`lambda/takeover.ts`）に Child Safety Guidelines セクションを含む
3. **AI 開示**: 画面で AI（ルビティー）であることを明示
4. **COPPA 準拠**: 利用規約とプライバシーポリシーに明記
