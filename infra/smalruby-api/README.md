# smalruby-api

CDK project for Smalruby's API Gateway endpoints (HTTP API v2 + Lambda).

旧 SAM 実装 (`smalruby/smalruby-infra`) の置き換え。4 つのエンドポイントを TypeScript Lambda + HTTP API v2 (built-in CORS) に移行する。

## Endpoints

| Path | Method | Lambda | 説明 |
|------|--------|--------|------|
| `/cors-proxy` | GET | `smalruby-cors-proxy` | 任意 URL のフェッチ + Google Drive URL 変換 + バイナリ Base64 化 |
| `/mesh-domain` | GET | `smalruby-mesh-zone-get` | source IP から Mesh ドメイン (CRC32) を生成 |
| `/scratch-api-proxy/projects/{projectId}` | GET | `smalruby-scratch-api-projects` | Scratch API のプロジェクト情報取得プロキシ (status pass-through) |
| `/scratch-api-proxy/translate` | GET | `smalruby-scratch-api-translate` | Scratch translate サービスプロキシ |

OPTIONS は API Gateway HTTP API v2 の built-in CORS で処理 (旧 `cors-for-smalruby` Lambda は不要)。

## Custom Domain

| Stage | Domain |
|-------|--------|
| stg | `stg.api.smalruby.app` |
| prod | `api.smalruby.app` |

prod ドメインへのカットオーバーは旧 SAM スタック (`smalruby-infra-prod`) のドメイン解放後に実施する。

## Commands

```bash
# Install dependencies
docker compose run --rm -w /app/infra/smalruby-api infra npm install

# Synthesize CloudFormation template
docker compose run --rm -w /app/infra/smalruby-api infra npx cdk synth

# Show diff against deployed stack
docker compose run --rm -w /app/infra/smalruby-api infra npx cdk diff

# Deploy (uses STAGE from .env symlink)
docker compose run --rm -w /app/infra/smalruby-api infra npx cdk deploy

# Run unit tests
docker compose run --rm -w /app/infra/smalruby-api infra npm test
```

## Stage Switching

```bash
cd infra/smalruby-api
rm .env && ln -s .env.stg .env    # → stg
rm .env && ln -s .env.prod .env   # → prod
```

## Environment Variables

| Variable | Description |
|----------|-------------|
| `STAGE` | Deployment stage (`stg`, `stg2`, `prod`) |
| `CORS_ALLOWED_ORIGINS` | Comma-separated allowed origins |
| `ROUTE53_PARENT_ZONE_NAME` | Parent zone for custom domain (default: `api.smalruby.app`) |
| `SMALRUBY_API_CUSTOM_DOMAIN` | Override custom domain. Set `false` to disable |
| `MESH_ZONE_SECRET_KEY` | Secret key used to derive Mesh group identity from source IP |

## Migration Notes

旧 SAM スタックとの主な差分:

1. **REST API v1 → HTTP API v2** へ変更。built-in CORS で `cors-for-smalruby` Lambda 不要に
2. **Ruby 3.3 → Node.js 20.x (TypeScript)** で他 infra プロジェクトと言語を統一
3. **`scratch-api-proxy/projects/{projectId}` のステータスコード透過** バグ修正 — 旧実装は `Net::HTTP.get` でボディだけ取得 → 常に 200 を返していた
4. **`mesh-zone-get` の secret key を環境変数化** — 旧実装はハードコード
5. **stg 環境を新設** — 旧実装は prod のみ

## Cutover (prod) — 後続作業

1. stg で動作確認 + frontend を `stg.api.smalruby.app` で結合テスト
2. SAM スタック (`smalruby-infra-prod`) のドメイン マッピング解除
3. `.env.prod` を作成 → `cdk deploy` で `api.smalruby.app` を新スタックに紐付け
4. SAM スタック (`smalruby-infra-prod`) を削除
