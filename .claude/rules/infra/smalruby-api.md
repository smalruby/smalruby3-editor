# smalruby-api

CDK project for Smalruby's API Gateway endpoints (HTTP API v2 + Lambda).

旧 SAM 実装 (`smalruby/smalruby-infra` リポジトリ) の置き換え。
4 エンドポイントを TypeScript Lambda + HTTP API v2 (built-in CORS) に移行する。

## Endpoints

| Path | Method | Lambda 関数名 (prod) | 説明 |
|------|--------|----------------------|------|
| `/cors-proxy` | GET | `smalruby-api-cors-proxy` | 任意 URL のフェッチ + Google Drive URL 変換 + バイナリ Base64 化 |
| `/mesh-domain` | GET | `smalruby-api-mesh-zone` | source IP から Mesh ドメイン (CRC32) を生成 |
| `/scratch-api-proxy/projects/{projectId}` | GET | `smalruby-api-scratch-projects` | Scratch API のプロジェクト情報取得プロキシ (status pass-through) |
| `/scratch-api-proxy/translate` | GET | `smalruby-api-scratch-translate` | Scratch translate サービスプロキシ |

stg では Lambda 関数名に `-stg` サフィックスが付く (`smalruby-api-cors-proxy-stg` 等)。
OPTIONS (preflight) は HTTP API v2 の built-in CORS で自動処理 — 旧 `cors-for-smalruby` Lambda は不要。

**Lambda 関数名の `smalruby-api-` プレフィックス**: 旧 SAM スタックの `smalruby-cors-proxy` などと衝突しないよう、CDK 側はすべて `smalruby-api-` で始まる名前に統一している。

## Custom Domains

| Stage | Domain |
|-------|--------|
| stg | `stg.api.smalruby.app` (CDK が ACM 証明書 + Route53 レコードも管理) |
| prod | `api.smalruby.app` (既存ドメインを **import** して再利用、ACM/Route53 は別管理) |

prod カットオーバー (2026-04-29 完了) では、旧 SAM スタック `smalruby-infra-prod`
が保持していた `api.smalruby.app` カスタムドメインを CDK スタックから
`apigatewayv2.DomainName.fromDomainNameAttributes()` で **import** する方式を採用。
これにより:

- 既存 ACM 証明書 (`b813732a-...`) と Route53 A レコードを再利用、
  証明書再発行や DNS 切り替えの待ち時間が発生しない
- ダウンタイムは「base path mapping を SAM から CDK へ切り替える数分」のみ
- import 設定は `.env.prod` の以下 3 環境変数で制御:
  ```
  IMPORT_EXISTING_CUSTOM_DOMAIN=true
  IMPORTED_REGIONAL_DOMAIN_NAME=d-8g2cqu3hqg.execute-api.ap-northeast-1.amazonaws.com
  IMPORTED_REGIONAL_HOSTED_ZONE_ID=Z1YSHQZHG15GKL
  ```

## Commands

```bash
# Install
docker compose run --rm -w /app/infra/smalruby-api infra npm install

# Synth / diff / deploy
docker compose run --rm -w /app/infra/smalruby-api infra npx cdk synth
docker compose run --rm -w /app/infra/smalruby-api infra npx cdk diff
docker compose run --rm -w /app/infra/smalruby-api infra npx cdk deploy

# Unit tests (mocked fetch, fast)
docker compose run --rm -w /app/infra/smalruby-api infra npm test

# Integration tests (実際の stg エンドポイントへ HTTP 送信)
docker compose run --rm -w /app/infra/smalruby-api infra npm run test:integration
```

## Integration Tests

`lambda/tests/*.integration.test.ts` は **デプロイ済み stg エンドポイント** に対して
実際の HTTP リクエストを送信して動作を検証する。コーナーケース確認とデグレ防止が目的。

- Issue #573 の **404 透過バグ再発防止** が最重要のテストケース
- 必要な環境変数: `SMALRUBY_API_ENDPOINT` (`.env.stg` で設定済み、デフォルト `https://stg.api.smalruby.app`)
- デプロイ後は必ず `npm run test:integration` を実行して 18 テストすべて緑であることを確認する
- CI では実行しない (npm test のユニットテストとは独立。ローカル/手動運用)

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

## Cutover (prod) 手順 — 完了済み (2026-04-29)

完了済みの手順を記録として残す:

1. ✅ stg で動作確認 + frontend を `stg.api.smalruby.app` で結合テスト
2. ✅ `.env.prod` 作成 (`MESH_ZONE_SECRET_KEY` を旧実装と同値、import 設定 3 環境変数)
3. ✅ SAM スタックのドメインマッピング解除: `aws apigateway delete-base-path-mapping --domain-name api.smalruby.app --base-path '(none)'`
4. ✅ CDK deploy: `cdk deploy --context stage=prod` で新スタックに mapping 追加
5. ✅ 動作確認: 全 4 endpoint + CORS + integration tests (18 件) prod で pass
6. ✅ SAM スタック削除: `aws cloudformation delete-stack --stack-name smalruby-infra-prod`
7. ⏳ smalruby/smalruby-infra リポジトリの該当ファイルを deprecate (後続作業)

ダウンタイム実測: 約 5 分 (CDK deploy + HTTP API mapping 反映待ち)

## Source

実装場所: `lambda/*.ts`, `lib/smalruby-api-stack.ts`, `bin/smalruby-api.ts`
ユニットテスト: `lambda/tests/*.test.ts`
