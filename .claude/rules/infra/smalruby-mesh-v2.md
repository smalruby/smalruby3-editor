---
paths:
  - "infra/smalruby-mesh-v2/"
  - "infra/smalruby-mesh-v2/**"
  - "infra/smalruby-mesh-v2/**/*"
---

# smalruby-mesh-v2

CDK project for the Mesh v2 networking service (AppSync + DynamoDB).

## Commands

The `infra` Docker service defaults to this project's working directory, so no `-w` override is needed:

```bash
# Install dependencies
docker compose run --rm infra npm install

# Synthesize CloudFormation template
docker compose run --rm infra npx cdk synth

# Show diff against deployed stack
docker compose run --rm infra npx cdk diff

# Deploy (uses STAGE from .env symlink)
docker compose run --rm infra npx cdk deploy

# Deploy with explicit stage override
docker compose run --rm infra npx cdk deploy --context stage=stg
```

### Root-level shortcuts

```bash
docker compose run --rm infra npm run -w /app infra:mesh-v2:synth
docker compose run --rm infra npm run -w /app infra:mesh-v2:diff
docker compose run --rm infra npm run -w /app infra:mesh-v2:deploy
```

## Environment Variables

| Variable | Description |
|----------|-------------|
| `STAGE` | Deployment stage (`stg`, `stg2`, or `prod`) |
| `MESH_SECRET_KEY` | Secret key for domain validation。⚠️ **未設定だと stack 既定の固定弱鍵 `'default-secret-key'` になる** — `.env.<stage>` で必ず設定する |
| `MESH_HOST_HEARTBEAT_INTERVAL_SECONDS` | Host heartbeat interval |
| `MESH_HOST_HEARTBEAT_TTL_SECONDS` | Host group TTL |
| `MESH_MEMBER_HEARTBEAT_INTERVAL_SECONDS` | Member heartbeat interval |
| `MESH_MEMBER_HEARTBEAT_TTL_SECONDS` | Member node TTL |
| `MESH_MAX_CONNECTION_TIME_SECONDS` | Max connection time per group（stack 既定: prod 1500 / 他 300） |
| `MESH_EVENT_TTL_SECONDS` | イベントの TTL（既定 10） |
| `MESH_POLLING_INTERVAL_SECONDS` | Polling モードの周期（既定 2） |
| `APPSYNC_CUSTOM_DOMAIN` | カスタムドメイン上書き。`false` で無効化 |
| `ROUTE53_PARENT_ZONE_NAME` | 親ゾーン（既定 `api.smalruby.app`） |

Copy `.env.example` to `.env` inside `infra/smalruby-mesh-v2/` for local values.

## Custom Domains

Each stage has a custom domain for the AppSync GraphQL API:

| Stage | Custom Domain |
|-------|--------------|
| `prod` | `graphql.api.smalruby.app` |
| `stg` | `stg.graphql.api.smalruby.app` |
| `stg2` | `stg2.graphql.api.smalruby.app` |

**CRITICAL**: The local dev server (`localhost:8601`) connects to the **stg** endpoint. If `stg.graphql.api.smalruby.app` is broken, mesh v2 will not work locally. After every stg/prod deploy, verify custom domains exist (see `development.md` Post-Deploy Verification).

## Architecture

Hexagonal Architecture (Ports & Adapters) with four layers:

| Layer | Directory | Role |
|-------|-----------|------|
| Domain | `lambda/domain/` | Entities and validation (pure Ruby, no external deps) |
| Application | `lambda/use_cases/` | Business logic orchestration |
| Infrastructure | `lambda/repositories/` | DynamoDB data access |
| Adapter | `lambda/handlers/` | AppSync event handling (entry point) |

AppSync JavaScript resolvers (`js/resolvers/`, `js/functions/`) handle most operations directly. Ruby Lambda is used for complex business logic (e.g., group dissolution, domain creation).

### スタック構成の実装事実

- **DynamoDB** `MeshV2Table{suffix}`（PK `pk` / SK `sk`、PAY_PER_REQUEST、TTL `ttl`、
  GSI `GroupIdIndex` / `GroupNameIndex`）は **RemovalPolicy: DESTROY・PITR 無効** —
  スタック削除・差し替えでデータが消える前提。
- **認証は API_KEY のみ**（キー有効期限 365 日。期限切れは redeploy でローテート）。
  ID Token / IAM 認証は使っていない。
- **Ruby Lambda** `MeshV2-GraphQL{suffix}` は `RUBY_3_4`。マルチバイト対策で
  `LANG` / `LC_ALL=en_US.UTF-8` を注入している（外さない）。担当フィールドは
  `createDomain` / `createGroup` / `dissolveGroup` / `leaveGroup` / `recordEventsByNode`
  （handler の fieldName case 分岐。エラーは rescue せず AppSync に伝播させる方針）。
- カスタムドメインの ACM 証明書は **us-east-1** に発行する（AppSync の要件。HTTP API
  プロジェクトのリージョン内 `acm.Certificate` と異なる）。

## TDD Workflow

Follow RED → GREEN → REFACTOR cycle:

1. **RED**: Write a failing RSpec test in `spec/unit/` or `spec/requests/`
2. **GREEN**: Implement minimal code to make the test pass
3. **REFACTOR**: Improve code while keeping tests green

## Testing

### Ruby Tests (RSpec)

```bash
# Unit tests (pure Ruby, no AWS calls)
docker compose run --rm infra bash -c "bundle exec rspec spec/unit/"

# Integration tests (requires deployed stg stack + env vars)
docker compose run --rm infra bash -c "
  export APPSYNC_ENDPOINT=\$(aws cloudformation describe-stacks \
    --stack-name MeshV2Stack-stg \
    --query 'Stacks[0].Outputs[?OutputKey==\`GraphQLApiEndpoint\`].OutputValue' \
    --output text)
  export APPSYNC_API_KEY=\$(aws cloudformation describe-stacks \
    --stack-name MeshV2Stack-stg \
    --query 'Stacks[0].Outputs[?OutputKey==\`GraphQLApiKey\`].OutputValue' \
    --output text)
  bundle exec rspec spec/requests/
"

# Run a specific test file
docker compose run --rm infra bash -c "bundle exec rspec spec/unit/domain/group_spec.rb"

# Ruby linting
docker compose run --rm infra bash -c "bundle exec standardrb"
```

### CDK Tests (Jest)

```bash
docker compose run --rm infra npx jest
```

## Troubleshooting

### CDK Deploy Issues

- **"No credentials found"**: Set `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` or `AWS_PROFILE` env vars
- **"Toolkit stack must be deployed"**: Run `docker compose run --rm infra npx cdk bootstrap`
- **"MeshV2Table already exists"**: Delete existing stack or change table name
- **"Cannot find module"**: Run `docker compose run --rm infra npm run build` before deploy

### AppSync Issues

- **Custom domain missing after deploy**: Verify `.env` symlink points to correct stage, redeploy
- **Subscription not receiving data**: Check `groupId` and `domain` match between mutation and subscription
- **API Key expired**: Check key expiration in AppSync console, redeploy to rotate

### Ruby Lambda Issues

- **Lambda timeout**: Check DynamoDB table name matches stage (e.g., `MeshV2Table-stg` vs `MeshV2Table`)
- **Permission denied**: Verify Lambda execution role has DynamoDB access

## Documentation

For detailed documentation, see `infra/smalruby-mesh-v2/docs/`:
- `api-reference.md` — Complete GraphQL API reference
- `architecture.md` — System architecture and data flows
- `development.md` — Development workflow and TDD guide
- `deployment.md` — Deployment procedures
- `operations.md` — Monitoring, alerting, cost management
