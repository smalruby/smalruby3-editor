# Contributing to smalruby3-editor

Welcome! This guide is the entry point for new contributors to the Smalruby 3 Editor monorepo.

If you're an AI assistant (Claude Code, etc.), see also `CLAUDE.md` and `.claude/rules/` for additional context.

## Quick links

- [Repository overview](#repository-overview)
- [Environment setup](#environment-setup)
- [Common workflows](#common-workflows)
- [Documentation map](#documentation-map)
- [Where to ask questions](#where-to-ask-questions)

## Repository overview

Smalruby 3 is a Ruby-based visual programming environment, forked from MIT's [Scratch 3.0](https://github.com/scratchfoundation/scratch-editor). This monorepo contains:

- **Web frontend & VM** (`packages/`) — npm workspaces
- **AWS infrastructure** (`infra/`) — independent CDK projects
- **Ruby SDL2 desktop runtime** (`ruby/smalruby3/`) — Ruby gem with submodules

For a complete architectural overview, see [`docs/architecture-overview.md`](docs/architecture-overview.md).

## Environment setup

### Prerequisites

- **Docker** (recommended for all development)
- Git with submodule support
- (Optional) Node.js 22.x for host-only commands like husky hooks

### One-time setup

```bash
# Clone with submodules
git clone --recurse-submodules git@github.com:smalruby/smalruby3-editor.git
cd smalruby3-editor

# Install all npm workspace dependencies (in Docker)
docker compose run --rm app npm install

# Build all packages (development mode)
docker compose run --rm app npm run build:dev
```

### `.env` file

Copy `.env.example` to `.env` and fill in required keys:

```bash
cp .env.example .env
```

Required keys (for full functionality):
- `GOOGLE_CLIENT_ID` / `GOOGLE_API_KEY` — Google Drive integration
- `MESH_GRAPHQL_ENDPOINT` / `MESH_API_KEY` / `MESH_AWS_REGION` — Mesh v2
- `RUBYTEE_RELAY_ENDPOINT` — Rubytee AI assistant
- `CLASSROOM_API_ENDPOINT` / `MICROSOFT_CLIENT_ID` / `DEV_BYPASS_TOKEN` — Classroom

For local development, point to **stg** endpoints. See `.claude/rules/env-file.md`.

> **CRITICAL**: Never delete `.env` — secrets are not recoverable from git. See `.claude/rules/env-file.md` for backup/recovery.

### Worktrees (optional, for parallel development)

```bash
git worktree add ../smalruby3-editor-<feature> -b <type>/<branch-name> develop
cd ../smalruby3-editor-<feature>
bin/setup-worktree   # all-in-one: env files + node_modules + dist/
```

Details: `.claude/rules/git-workflow.md` ("Git Worktree Setup")

## Common workflows

### Start the dev server

```bash
docker compose up app          # Foreground (with logs)
docker compose up -d app       # Background
docker compose logs -f app     # Tail logs
```

Open http://localhost:8601

### Run tests

```bash
# Lint (must pass with zero warnings before commit)
docker compose run --rm app npm run lint

# Specific unit test
docker compose run --rm app bash -c "cd packages/scratch-gui && npm exec jest test/unit/your-test.test.js"

# Specific integration test
docker compose run --rm app bash -c "cd packages/scratch-gui && npm exec jest test/integration/your-test.test.js"

# All tests (CI runs this on push)
docker compose run --rm app npm test
```

### Branch & PR

- **Default branch**: `develop` (NOT `main`)
- Branch naming:
  - `feature/<descriptive-name>`
  - `fix/<issue-description>`
  - `docs/<descriptive-name>`
  - `refactor/<descriptive-name>`
- **Commit messages**: Conventional Commits (`feat:`, `fix:`, `docs:`, `refactor:`, `chore:`, etc.)
- **PR target**: `develop`
- **Merge style**: `--merge` (NOT squash)

```bash
git checkout -b feature/my-feature develop
# ... make changes, commit ...
git push -u origin feature/my-feature
gh pr create --base develop --title "feat: ..." --body-file /tmp/pr-body.md
```

### PR checklist

Before creating a PR, verify:

1. ✅ All tests pass (lint + affected unit/integration tests)
2. ✅ Build succeeds (`npm run build:dev`)
3. ✅ Code follows existing patterns in the modified files
4. ✅ **Documentation updated** if behavior / files / settings / blocks / markers changed
5. ✅ **Screenshots updated** if UI changed visually
6. ✅ Commit messages follow Conventional Commits

For UI changes, update `docs/<feature>/README.md` and `docs/<feature>/screenshots/`. See `.claude/rules/documentation.md` "開発ワークフローの DoD".

### Upstream sync

The repo is forked from upstream Scratch Foundation. When syncing upstream:

```bash
# Use the slash command (recommended)
/upstream:merge

# Or manually fetch only the develop branch (gh-pages is huge)
git fetch -p upstream develop
```

Details: `.claude/skills/upstream-merge/SKILL.md`

## Documentation map

The repository has comprehensive documentation. **Start at `docs/README.md`** for the index.

### For end users / feature understanding

- **`docs/<feature>/`** — User-story-based feature documentation (42+ features)
  - Examples: `docs/classroom/`, `docs/rubytee/`, `docs/mesh-v2/`, `docs/mobile-ui/`, `docs/extension-*/`
  - Each has README + screenshots + integrated view across packages

### For developers

- **`docs/scratch-vm/`** — VM internal architecture (Runtime / Sequencer / Thread / Target / Blocks / Extensions / Serialization)
- **`docs/infra/`** — AWS CDK infrastructure cross-cutting overview
- **`docs/smalruby3-gem/`** — Ruby SDL2 desktop runtime
- **`docs/architecture-overview.md`** — Whole-monorepo architecture (where to add what)

### For language users

- `docs/smalruby-language-spec.ja.md` — Ruby language specification for Smalruby
- `docs/smalruby-language-spec-extensions.ja.md` — Extension blocks reference
- `docs/smalruby-dncl-spec.ja.md` — DNCL (Japanese programming) mode spec

### Project-specific rules (for AI agents)

- `CLAUDE.md` — Top-level Claude Code guidance
- `.claude/rules/` — Detailed per-package rules
  - `code-style.md`, `git-workflow.md`, `documentation.md`, `supply-chain-security.md`
  - `scratch-gui/`, `scratch-vm/`, `infra/`, `ruby/` subdirectories

## Coding conventions

- **JavaScript/TypeScript**: ESLint with `eslint-config-scratch` (zero warnings policy)
- **Prettier** applied to **Smalruby-specific files only** (whitelist in `.prettierignore`)
- **Smalruby marker comments** (`// === Smalruby: Start of <feature> ===`) for code added to upstream files
- **kebab-case** for files (`my-component.jsx`), **PascalCase** for components, **camelCase** for variables

Full guide: `.claude/rules/code-style.md`

## Need help?

- **GitHub Issues**: https://github.com/smalruby/smalruby3-editor/issues
- **Discussions**: https://github.com/smalruby/smalruby3-editor/discussions (for feedback / questions)
- **Documentation index**: [`docs/README.md`](docs/README.md)
- **Architectural questions**: Read [`docs/architecture-overview.md`](docs/architecture-overview.md) first
- **Smalruby website**: https://smalruby.app

## License

Smalruby 3 is open source. See individual package LICENSE files.

This project is based on Scratch from the Scratch Foundation. Thank you for contributions and support!
