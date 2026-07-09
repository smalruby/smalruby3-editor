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

- **API Gateway HTTP API v2**: POST `/generate` endpoint（stage スロットリング: prod 10rps/burst 30、stg 5/10）
- **Lambda (Node.js 22)** `RubyteeRelayHandler{suffix}`: Request validation, rate limiting, Anthropic Claude API relay
- **DynamoDB** `RubyteeRelayRateLimit{suffix}`: IP-based rate limiting with TTL (fixed window)

### 認可モデル / 防御（実装事実）

- **ID Token 認証は無い**（子供が匿名で利用するサービス）。防御は
  入力バリデーション（長さ・`DANGEROUS_PATTERNS` によるプロンプトインジェクション対策）+
  IP レート制限 + API Gateway スロットリングの 3 層。
- **レート制限は fail-open**: DynamoDB 障害時はリクエストを**許可**する（可用性優先の意図的
  設計。fail-close に変えるときはこの前提を確認する）。
- エラーレスポンスは `{ "error": "<CODE>" }` 形式。主なコード: `INVALID_JSON` /
  `INPUT_TOO_SHORT` / `INPUT_TOO_LONG` / `INVALID_INPUT` / `HISTORY_TOO_LONG` /
  `RATE_LIMIT_EXCEEDED`(429) / `AI_OVERLOADED`(502, Anthropic 529) / `AI_API_ERROR`(502) /
  `INTERNAL_ERROR`(500)。フロントはこのコードで分岐するため、変更は互換性破壊。

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
| `STAGE` | Deployment stage (`stg`, `stg2`, or `prod`) |
| `ANTHROPIC_API_KEY` | Anthropic API key |
| `CLAUDE_MODEL` | Claude model ID (default: `claude-haiku-4-5-20251001`) |
| `RATE_LIMIT_WINDOW_MINUTES` | Rate limit window in minutes (default: 35) |
| `RATE_LIMIT_MAX_REQUESTS` | Max requests per window (default: 40) |
| `MAX_USER_MESSAGE_LENGTH` | Max user message length (default: 250) |
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

システムプロンプト（`lambda/handler.ts` の `buildSystemInstruction`）を変更する場合の手順:

1. **ローカルで curl テスト**: `handler.ts` を編集 → stg にデプロイ → `curl` でレスポンス品質を確認
2. **改善ループ**: 品質が不十分なら handler.ts を修正 → 再デプロイ → 再テスト（デプロイせずにローカルでの修正・確認ループを優先し、最終確認としてデプロイする）
3. **integration テスト**: `npm run test:integration` で stg エンドポイントに対してバリデーション + 正常系テスト
4. **prod デプロイ**: stg で品質確認後に prod へデプロイ

**CRITICAL**: プロンプト変更時はデプロイ前にローカルで十分にチューニングすること。デプロイのたびに Lambda のコールドスタートが発生し、改善ループが遅くなるため。

### プロンプトチューニングの評価ポイント

- **Smalruby 文法の正確性**: `set_x()` ではなく `self.x =` を使用しているか、正しいメソッド名か
- **スプライト名の正確性**: `"Cat"` は使用不可。`"Shimacat"` / `"Cat 2"` 等のみ使用可
- **複雑さの制御**: 初回は単一スプライト・シンプルな構成。`def`/`module`/`include`/`super`/`clone` はユーザーが明示的に要求した場合のみ
- **コードブロックの分離**: 1 コードブロックに 1 スプライトのみ。複数スプライト時はブロック間に説明文を挿入
- **会話の継続性**: 2回目以降のプロンプトで元のコードを引き継いで発展できるか
- **コスト効率**: システムプロンプトのトークン数がキャッシュ閾値を超えているか

## Prompt Caching (コスト最適化)

Anthropic Claude のプロンプトキャッシュを利用してコストを削減する。

### 仕組み

- `system` パラメータに `cache_control: { type: 'ephemeral' }` を付与
- ヘッダー `anthropic-beta: prompt-caching-2024-07-31` を送信
- キャッシュの TTL は 5 分間（同一内容のシステムプロンプトが 5 分以内に再利用される）

### 最小トークン要件

| モデル | 最小トークン数 |
|--------|-------------|
| Claude Haiku 4.5 | **4,096** |
| Claude Sonnet 4.5 | 1,024 |
| Claude Opus 4.5 | 4,096 |

**CRITICAL**: システムプロンプトが最小トークン数を下回るとキャッシュが効かない。プロンプトを変更する際はトークン数に注意し、CloudWatch ログの `cacheCreationTokens` / `cacheReadTokens` で動作を確認すること。

### コスト比較（Claude Haiku 4.5）

| 条件 | 1やりとり | 40回セッション |
|------|----------|--------------|
| キャッシュなし | ~$0.005 | ~$0.20 |
| キャッシュあり（hit） | ~$0.0016 | ~$0.07 |

### CloudWatch ログでの確認

```bash
aws logs tail /aws/lambda/RubyteeRelayHandler-stg --since 5m --format short | grep "rubytee_response"
```

ログ出力例:
```json
{"event":"rubytee_response","model":"claude-haiku-4-5-20251001","outputTokens":350,"inputTokens":17,"cacheCreationTokens":4964,"cacheReadTokens":0}
```
- `cacheCreationTokens > 0`: キャッシュ作成（初回リクエスト）
- `cacheReadTokens > 0`: キャッシュヒット（2回目以降）
- 両方 0: キャッシュが効いていない（トークン数不足の可能性）

## CORS Configuration

| Stage | Allowed Origins |
|-------|----------------|
| stg | `https://smalruby.app`, `https://smalruby.jp`, `http://localhost:8601` |
| prod | `https://smalruby.app`, `https://smalruby.jp` |

**Note**: prod には `localhost` を含めない。ローカル開発テストでは stg エンドポイントを使用する。

## Anthropic Guidelines Compliance

Rubytee は未成年者（子供）が利用するサービスのため、[Anthropic のガイドライン](https://support.claude.com/en/articles/9307344-responsible-use-of-anthropic-s-models-guidelines-for-organizations-serving-minors)に準拠する必要がある:

1. **年齢確認**: フロントエンドで同意ダイアログ（チェックボックス式）を表示
2. **コンテンツモデレーション**: システムプロンプトに Child Safety Guidelines セクションを含む
3. **AI 開示**: 同意ダイアログとモーダルで AI であることを明示
4. **COPPA 準拠**: 利用規約とプライバシーポリシーに明記
