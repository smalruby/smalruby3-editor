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
| `MESH_SECRET_KEY` | Secret key for domain validation |
| `MESH_HOST_HEARTBEAT_INTERVAL_SECONDS` | Host heartbeat interval |
| `MESH_HOST_HEARTBEAT_TTL_SECONDS` | Host group TTL |
| `MESH_MEMBER_HEARTBEAT_INTERVAL_SECONDS` | Member heartbeat interval |
| `MESH_MEMBER_HEARTBEAT_TTL_SECONDS` | Member node TTL |
| `MESH_MAX_CONNECTION_TIME_SECONDS` | Max connection time per group |

Copy `.env.example` to `.env` inside `infra/smalruby-mesh-v2/` for local values.

See `infra/smalruby-mesh-v2/CLAUDE.md` for detailed TDD workflow, architecture, and troubleshooting.
