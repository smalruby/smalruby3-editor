---
paths:
  - "infra/"
  - "infra/*"
  - "infra/Dockerfile"
---

# Infrastructure Development (infra/)

AWS CDK infrastructure projects live in `infra/`. Each project is independent from npm workspaces.

## Projects

| Project | Path | Description |
|---------|------|-------------|
| smalruby-mesh-v2 | `infra/smalruby-mesh-v2/` | Mesh v2 networking service (AppSync + DynamoDB) |
| smalruby-rubytee-relay | `infra/smalruby-rubytee-relay/` | Rubytee AI relay (API Gateway + Lambda + DynamoDB) |
| smalruby-classroom | `infra/smalruby-classroom/` | Classroom service (API Gateway + Lambda + DynamoDB + S3) |
| smalruby-api | `infra/smalruby-api/` | Smalruby API endpoints (HTTP API v2 + Lambda): cors-proxy, mesh-domain, scratch-api-proxy/* |
| smalruby-bug-report | `infra/smalruby-bug-report/` | Program bug report service (HTTP API v2 + Lambda + DynamoDB + S3): 作品添付つき不具合報告 + 管理者レジストリ |

See project-specific rules for details:
- `.claude/rules/infra/smalruby-mesh-v2.md`
- `.claude/rules/infra/smalruby-classroom.md`
- `.claude/rules/infra/smalruby-rubytee-relay.md`
- `.claude/rules/infra/smalruby-api.md`
- `.claude/rules/infra/smalruby-bug-report.md`

## Docker Service

Use the `infra` service for all CDK operations:

- Service name: `infra`
- Default working directory: `/app/infra/smalruby-mesh-v2`
- Includes: Node.js 24 + AWS CLI v2

For projects other than mesh-v2, override the working directory with `-w`:

```bash
docker compose run --rm -w /app/infra/<project-name> infra <command>
```

## cdk.context.json

CDK のコンテキストキャッシュファイル `cdk.context.json` は **コミットする**。CDK のガイドラインに従い、デプロイの再現性を保証する。Route53 ホストゾーン ID など、CDK が自動的にキャッシュした値を含む。

- `cdk.context.json` は `.gitignore` に追加**しない**
- デプロイ後に生成・更新された場合はコミットする

## AWS Credentials

Set credentials via environment variables before running infra commands:

```bash
export AWS_ACCESS_KEY_ID=your-key-id
export AWS_SECRET_ACCESS_KEY=your-secret-key
export AWS_DEFAULT_REGION=ap-northeast-1
# or
export AWS_PROFILE=your-profile
```

## Stage Switching via `.env` Symlink

Both projects use the same pattern: per-stage `.env` files (`.env.stg`, `.env.stg2`, `.env.prod`) with a `.env` symlink pointing to the active stage.

```bash
cd infra/<project-name>

# Switch to staging
rm .env && ln -s .env.stg .env

# Switch to production
rm .env && ln -s .env.prod .env

# Verify current stage
ls -la .env
```

The `STAGE` value in the linked `.env` file determines the deployment target. It can also be overridden with `--context stage=...`.

**CRITICAL**: Always use `.env` symlink switching for deployments. Never override environment variables (e.g., `APPSYNC_CUSTOM_DOMAIN=false`) directly on the command line — this can delete custom domains or other critical resources from the stack.

## Post-Deploy Verification

After deploying to `stg` or `prod`, verify that custom domains are intact:

```bash
# Check all AppSync custom domains
aws appsync list-domain-names --query "domainNameConfigs[].domainName" --output table

# Expected domains:
#   graphql.api.smalruby.app        (prod)
#   stg.graphql.api.smalruby.app    (stg)
#   stg2.graphql.api.smalruby.app   (stg2)

# Verify DNS resolution
dig stg.graphql.api.smalruby.app A +short
dig graphql.api.smalruby.app A +short
```

If a custom domain is missing, redeploy the affected stage with the correct `.env` symlink.

## CDK 化 / 旧スタック → CDK 移行のチェックリスト (汎用)

`smalruby-infra` (旧 SAM) → `infra/smalruby-api/` (CDK) のような移行を行う際の
共通チェックポイント。詳細な実例は `.claude/rules/infra/smalruby-api.md` の
「ハマりポイント / 学び」を参照。

### 事前

1. **Lambda 関数名の衝突回避**: 旧スタックと新スタックを並走させる前提で、
   CDK 側の関数名にプロジェクト固有のプレフィックス (`smalruby-<project>-`) を
   付ける。同名にすると CFN が `already exists` で deploy 失敗する。
2. **既存カスタムドメインは作り直さず import**: `apigatewayv2.DomainName.fromDomainNameAttributes()`
   などで参照。ACM 証明書や Route53 レコードを再利用してダウンタイムを
   数分に圧縮する。
3. **既存 secret/config 値の引き継ぎ**: ハードコードされていた値があれば
   prod 環境変数で **同じ値を再使用** する。CRC32 キーのような互換性
   クリティカルな値は変えると既存ユーザーが壊れる。

### カットオーバー手順

1. stg を CDK で先に立てて `npm run test:integration` を pass させる
2. 旧スタックの **base path mapping だけ** 解除 (custom domain は残す):
   `aws apigateway delete-base-path-mapping --domain-name <FQDN> --base-path '(none)'`
3. 即座に `cdk deploy --context stage=prod`
4. curl + Playwright で全エンドポイント検証 (CORS preflight、status passthrough、
   バイナリレスポンス等)
5. 旧 CFN スタック削除 (`aws cloudformation delete-stack --stack-name ...`)

### Integration test の Origin

両環境 (stg / prod) で実行する integration test の CORS preflight は、
両方で許可される Origin (`https://smalruby.app` など) を使う。`localhost` は
prod の CORS 許可リストに入れていないので、テストで期待値にすると prod 実行で
fail する。

### 検証ハマり

- `cdk deploy` 直後の API Gateway は数十秒〜数分のルーティング反映待ちがある。
  curl が一時的に 403 (`Forbidden`) を返したら polling で待つ。
- ブラウザの `response.headers.get('access-control-allow-origin')` は Fetch
  spec の制約で `null` に見える。fetch 自体が成功している事実が CORS preflight
  成功の証拠。生のヘッダー値を見たいときは `curl -i -X OPTIONS` で確認する。
