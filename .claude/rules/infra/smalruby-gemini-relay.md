---
paths:
  - "infra/smalruby-gemini-relay/"
  - "infra/smalruby-gemini-relay/**"
  - "infra/smalruby-gemini-relay/**/*"
---

# smalruby-gemini-relay

CDK project for the Smalruby Teacher AI relay service (API Gateway + Lambda + DynamoDB).
Proxies requests from the Ruby tab's AI chat to the Gemini API with rate limiting and input validation.

## Architecture

- **API Gateway HTTP API**: POST `/generate` endpoint
- **Lambda (Node.js 20)**: Request validation, rate limiting, Gemini API relay
- **DynamoDB**: IP-based rate limiting with TTL

## Commands

Since the `infra` Docker service defaults to `smalruby-mesh-v2`, use `-w` to override the working directory:

```bash
# Install dependencies
docker compose run --rm -w /app/infra/smalruby-gemini-relay infra npm install

# Synthesize CloudFormation template
docker compose run --rm -w /app/infra/smalruby-gemini-relay infra npx cdk synth

# Show diff against deployed stack
docker compose run --rm -w /app/infra/smalruby-gemini-relay infra npx cdk diff

# Deploy (uses STAGE from .env symlink)
docker compose run --rm -w /app/infra/smalruby-gemini-relay infra npx cdk deploy

# Deploy with explicit stage override
docker compose run --rm -w /app/infra/smalruby-gemini-relay infra npx cdk deploy --context stage=stg
```

**Note**: There is no dedicated Docker volume for `smalruby-gemini-relay/node_modules`, so `npm install` runs inside the bind-mounted directory. This is fine because gemini-relay has fewer dependencies than mesh-v2.

## Environment Variables

| Variable | Description |
|----------|-------------|
| `STAGE` | Deployment stage (`stg`, `stg2`, or `prod`) |
| `GEMINI_API_KEY` | Gemini API key |
| `RATE_LIMIT_WINDOW_MINUTES` | Rate limit window in minutes (default: 35) |
| `RATE_LIMIT_MAX_REQUESTS` | Max requests per window (default: 40) |
| `MAX_USER_MESSAGE_LENGTH` | Max user message length (default: 250) |
| `MIN_USER_MESSAGE_LENGTH` | Min user message length (default: 10) |
| `CORS_ALLOWED_ORIGINS` | Comma-separated allowed origins |

## Typical Deployment Flow

1. **Switch to target stage**: `cd infra/smalruby-gemini-relay && rm .env && ln -s .env.stg .env`
2. **Check diff**: `docker compose run --rm -w /app/infra/smalruby-gemini-relay infra npx cdk diff`
3. **Deploy**: `docker compose run --rm -w /app/infra/smalruby-gemini-relay infra npx cdk deploy`
4. **Verify**: Test the deployed endpoint
5. **Repeat for prod**: `rm .env && ln -s .env.prod .env` → diff → deploy
