# smalruby-api

CDK project for Smalruby's API Gateway endpoints (HTTP API v2 + Lambda).

旧 SAM 実装 (`smalruby/smalruby-infra` リポジトリ) の置き換え。
4 エンドポイントを TypeScript Lambda + HTTP API v2 (built-in CORS) に移行する。

## Endpoints

| Path | Method | Lambda 関数名 (prod) | 説明 |
|------|--------|----------------------|------|
| `/cors-proxy` | GET | `smalruby-cors-proxy` | 任意 URL のフェッチ + Google Drive URL 変換 + バイナリ Base64 化 |
| `/mesh-domain` | GET | `smalruby-mesh-zone-get` | source IP から Mesh ドメイン (CRC32) を生成 |
| `/scratch-api-proxy/projects/{projectId}` | GET | `smalruby-scratch-api-projects` | Scratch API のプロジェクト情報取得プロキシ (status pass-through) |
| `/scratch-api-proxy/translate` | GET | `smalruby-scratch-api-translate` | Scratch translate サービスプロキシ |

stg では Lambda 関数名に `-stg` サフィックスが付く。
OPTIONS (preflight) は HTTP API v2 の built-in CORS で自動処理 — 旧 `cors-for-smalruby` Lambda は不要。

## Custom Domains

| Stage | Domain |
|-------|--------|
| stg | `stg.api.smalruby.app` |
| prod | `api.smalruby.app` |

prod ドメインは旧 SAM スタック (`smalruby-infra-prod`) が現在保持しているため、
prod カットオーバーは旧スタックのドメイン解放と協調が必要 (後続作業)。

## Commands

```bash
# Install
docker compose run --rm -w /app/infra/smalruby-api infra npm install

# Synth / diff / deploy
docker compose run --rm -w /app/infra/smalruby-api infra npx cdk synth
docker compose run --rm -w /app/infra/smalruby-api infra npx cdk diff
docker compose run --rm -w /app/infra/smalruby-api infra npx cdk deploy

# Unit tests
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
| `MESH_ZONE_SECRET_KEY` | **Secret** — used to derive Mesh group identity from source IP |

## Migration Notes

旧 SAM スタックとの主な差分:

1. **REST API v1 → HTTP API v2** へ変更。built-in CORS で OPTIONS Lambda 不要に
2. **Ruby 3.3 → Node.js 20.x (TypeScript)** で他 infra プロジェクトと言語を統一
3. **`scratch-api-proxy/projects/{projectId}` のステータスコード透過** — 旧実装は `Net::HTTP.get` でボディだけ取得 → 常に 200 を返していた (関連 Issue #573)
4. **`mesh-zone-get` の secret key を環境変数化** — 旧実装はハードコード
5. **stg 環境を新設** — 旧実装は prod のみ

## Cutover (prod) 手順 — 後続作業

1. stg で動作確認 + frontend を `stg.api.smalruby.app` で結合テスト
2. `MESH_ZONE_SECRET_KEY` を旧実装と同値で `.env.prod` に設定 (mesh ドメインが既存ユーザーで変わらないようにする)
3. SAM スタック (`smalruby-infra-prod`) のドメインマッピング解除 (`api.smalruby.app`)
4. `cdk deploy --context stage=prod` で新スタックに `api.smalruby.app` を紐付け
5. 動作確認後、SAM スタック (`smalruby-infra-prod`) を CloudFormation から削除
6. smalruby/smalruby-infra リポジトリの該当ファイルを deprecate

## Source

実装場所: `lambda/*.ts`, `lib/smalruby-api-stack.ts`, `bin/smalruby-api.ts`
ユニットテスト: `lambda/tests/*.test.ts`
