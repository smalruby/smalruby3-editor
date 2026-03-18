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
| smalruby-gemini-relay | `infra/smalruby-gemini-relay/` | Smalruby Teacher AI relay (API Gateway + Lambda + DynamoDB) |

See project-specific rules for details:
- `.claude/rules/infra/smalruby-mesh-v2.md`
- `.claude/rules/infra/smalruby-gemini-relay.md`

## Docker Service

Use the `infra` service for all CDK operations:

- Service name: `infra`
- Default working directory: `/app/infra/smalruby-mesh-v2`
- Includes: Node.js 24 + AWS CLI v2

For projects other than mesh-v2, override the working directory with `-w`:

```bash
docker compose run --rm -w /app/infra/<project-name> infra <command>
```

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
