# Monorepo Root `.env` File

## Overview

The monorepo root `.env` file contains secrets and configuration for all services (Google API keys, AWS endpoints, dev bypass tokens, etc.). It is loaded by webpack via `dotenv` in `packages/scratch-gui/webpack.config.js`.

## Critical Rules

- **NEVER delete or overwrite `.env`** — it contains secrets that are not recoverable from git
- **NEVER commit `.env` to git** — it is in `.gitignore`
- **NEVER create `.env` as a symlink** — the Write tool and other operations may break symlinks by writing to the target file instead
- **Backup before modifying**: `cp .env .env.$(date +%Y%m%d)` before any changes
- `.env.*` (except `.env.example`) is gitignored for backup safety

## Recovery

If `.env` is lost:
1. Check for dated backups: `ls .env.*`
2. Copy from `smalruby3-develop`: `cp ~/work/smalruby/smalruby3-develop/.env .env`
3. Cross-reference with `infra/*/.env.stg` for service-specific values
4. Check `.env.example` for the required key names

## Required Keys

See `.env.example` for the full list. Key groups:
- **Google**: `GOOGLE_CLIENT_ID`, `GOOGLE_API_KEY`
- **Mesh v2**: `MESH_GRAPHQL_ENDPOINT`, `MESH_API_KEY`, `MESH_AWS_REGION`
- **Rubytee**: `RUBYTEE_RELAY_ENDPOINT`
- **Classroom**: `CLASSROOM_API_ENDPOINT`, `DEV_BYPASS_TOKEN`
