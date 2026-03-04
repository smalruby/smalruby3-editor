---
paths:
  - "infra/"
  - "infra/*"
  - "infra/**"
  - "infra/**/*"
---

# Infrastructure Development (infra/)

AWS CDK infrastructure projects live in `infra/`. Each project is independent from npm workspaces.

## Docker Service

Use the `infra` service for all CDK operations:

- Service name: `infra`
- Default working directory: `/app/infra/smalruby-mesh-v2`
- Includes: Node.js 24 + AWS CLI v2

## AWS Credentials

Set credentials via environment variables before running infra commands:

```bash
export AWS_ACCESS_KEY_ID=your-key-id
export AWS_SECRET_ACCESS_KEY=your-secret-key
export AWS_DEFAULT_REGION=ap-northeast-1
# or
export AWS_PROFILE=your-profile
```

## smalruby-mesh-v2

CDK project for the Mesh v2 networking service (AppSync + DynamoDB).

### Commands

```bash
# Install dependencies
docker compose run --rm infra npm install

# Synthesize CloudFormation template
docker compose run --rm infra npx cdk synth

# Show diff against deployed stack
docker compose run --rm infra npx cdk diff --context stage=stg

# Deploy to staging
docker compose run --rm infra npx cdk deploy --context stage=stg

# Deploy to production
docker compose run --rm infra npx cdk deploy --context stage=prod
```

### Root-level shortcuts

```bash
docker compose run --rm infra npm run -w /app infra:mesh-v2:synth
docker compose run --rm infra npm run -w /app infra:mesh-v2:diff
docker compose run --rm infra npm run -w /app infra:mesh-v2:deploy
```

### Environment Variables

| Variable | Description |
|----------|-------------|
| `STAGE` | Deployment stage (`stg` or `prod`) |
| `MESH_SECRET_KEY` | Secret key for domain validation |
| `MESH_HOST_HEARTBEAT_INTERVAL_SECONDS` | Host heartbeat interval |
| `MESH_HOST_HEARTBEAT_TTL_SECONDS` | Host group TTL |
| `MESH_MEMBER_HEARTBEAT_INTERVAL_SECONDS` | Member heartbeat interval |
| `MESH_MEMBER_HEARTBEAT_TTL_SECONDS` | Member node TTL |
| `MESH_MAX_CONNECTION_TIME_SECONDS` | Max connection time per group |

Copy `.env.example` to `.env` inside `infra/smalruby-mesh-v2/` for local values.

See `infra/smalruby-mesh-v2/CLAUDE.md` for detailed TDD workflow, architecture, and troubleshooting.
