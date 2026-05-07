# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is the **Smalruby 3 Editor** monorepo - a Ruby-based visual programming environment forked from MIT's Scratch 3.0. The monorepo contains all packages needed to build and run the Smalruby editor.

## Monorepo Structure

This project uses npm workspaces with the following packages:

- **`packages/scratch-gui`**: React-based web interface with Ruby mode, custom extensions, and Google Drive integration
- **`packages/scratch-vm`**: Virtual machine that executes projects and manages blocks
- **`packages/scratch-render`**: WebGL-based rendering engine for sprites and backdrops
- **`packages/scratch-svg-renderer`**: SVG processing for vector images
- **`packages/task-herder`**: Asynchronous task queue with throttling and concurrency control

The `infra/` directory contains AWS CDK infrastructure projects (independent from npm workspaces):

- **`infra/smalruby-mesh-v2`**: AWS CDK project for the Mesh v2 networking service (AppSync + DynamoDB)
- **`infra/smalruby-rubytee-relay`**: AWS CDK project for the Rubytee AI relay service (Anthropic Claude API + DynamoDB)
- **`infra/smalruby-classroom`**: AWS CDK project for the Classroom service (API Gateway + Lambda + DynamoDB)
- **`infra/smalruby-api`**: AWS CDK project for general API endpoints (HTTP API v2 + Lambda): cors-proxy, mesh-domain, scratch-api-proxy

The `ruby/` directory contains the smalruby3 Ruby gem and its native dependencies (git submodules):

- **`ruby/smalruby3`**: scratch-vm の Ruby 実装。SDL2 ベースのデスクトップランタイム
- **`ruby/ruby-sdl2`**: SDL2 の Ruby バインディング（[smalruby/ruby-sdl2](https://github.com/smalruby/ruby-sdl2) fork、upstream: [ohai/ruby-sdl2](https://github.com/ohai/ruby-sdl2)）
- **`ruby/rsdl`**: macOS 用 SDL2 ラッパーコマンド（[smalruby/rsdl](https://github.com/smalruby/rsdl) fork、upstream: [knu/rsdl](https://github.com/knu/rsdl)）

**ruby-sdl2, rsdl は git submodule**。変更時は origin (smalruby fork) に PR を作成し、動作確認後に upstream にも PR を作成する。upstream への PR を想定して機能ごとに細かくブランチ/PR を分けること。詳細は `.claude/rules/ruby/ruby-sdl2.md` と `.claude/rules/ruby/rsdl.md` を参照。

**CRITICAL**: Before making changes to `infra/` projects, always read the corresponding rules in `.claude/rules/infra/`. In particular:
- `.claude/rules/infra/development.md` — Stage switching via `.env` symlink (MUST use symlink, never override env vars on command line)
- `.claude/rules/infra/smalruby-rubytee-relay.md` — Rubytee relay deployment, prompt tuning, caching, Anthropic compliance
- `.claude/rules/infra/smalruby-mesh-v2.md` — Mesh v2 deployment

## Build & Test Commands

- **Development builds**: Always use `build:dev` for development builds, never the default `build` command.
- **Test runner**: Tests in `scratch-gui` use `jest` (not `tap`). Do not confuse test runners or their assertion APIs (e.g., use `expect().toEqual()` not `t.deepEqual()`). Only `scratch-vm` uses `tap`.

## Docker Environment

**CRITICAL**: All npm commands MUST be run inside Docker containers. Never run npm commands directly on the host.

### Docker Service

- Service name: `app`
- Port: 8601
- Working directory: `/app` (inside container)

### Basic Commands

```bash
# Start development server
docker compose up app

# Run commands in container
docker compose run --rm app bash -c "COMMAND"

# Stop services
docker compose stop app
```

The compose project name is pinned to `smalruby3-editor` (see `name:` at the top of `docker-compose.yml`), so `docker compose run` from a git worktree shares the same image and named volumes as the main checkout — no per-worktree rebuild needed.

After `git worktree add`, run **`bin/sync-worktree-env`** once to copy the gitignored `.env.*` files (root + per-infra) from the main checkout. Without these, CDK deploys, webpack builds, and mesh v2 integration tests fail. See `.claude/rules/git-workflow.md` for full worktree workflow.

### Quick One-Shot Commands: `bin/dx`

For quick lint or single-test invocations, `bin/dx` is a thin `docker run` wrapper that targets the prebuilt `smalruby3-editor-app:latest` image and mounts the same `node_modules` / npm cache volumes used by `docker compose run app`. It bypasses the compose entrypoint (which checks for monorepo setup), so it starts faster than `docker compose run`:

```bash
bin/dx bash -c "cd packages/scratch-vm && npm run lint"
bin/dx bash -c "cd packages/scratch-gui && npm exec jest test/unit/your-test.test.js"
```

`docker compose run` is still preferred when you need the full setup (port mapping, container reuse, etc.). Use `bin/dx` for one-shot commands where startup speed matters.

## Development Commands

### Installation

Install dependencies for all packages:

```bash
docker compose run --rm app npm install
```

### Build

Build all packages:

```bash
# Production build
docker compose run --rm app npm run build

# Development build (faster, with source maps)
docker compose run --rm app npm run build:dev
```

### Development Server

Start the GUI development server (http://localhost:8601):

```bash
docker compose up app
```

Or run in background:

```bash
docker compose up -d app
docker compose logs -f app
```

### Testing

Run all tests (lint + unit + integration):

```bash
docker compose run --rm app npm test
```

Run unit tests only:

```bash
docker compose run --rm app npm run test:unit
```

Run integration tests only:

```bash
docker compose run --rm app npm run test:integration
```

**IMPORTANT**: `test:unit` and `test:integration` commands do NOT accept file arguments. To run individual test files, use `npm exec` (or `npx`):

For unit tests:

```bash
# scratch-vm unit tests (uses tap)
docker compose run --rm app bash -c "cd packages/scratch-vm && npm exec tap test/unit/specific-file.js"

# scratch-gui unit tests (uses jest)
docker compose run --rm app bash -c "cd packages/scratch-gui && npm exec jest test/unit/specific-file.test.js"
```

For integration tests (uses jest):

```bash
docker compose run --rm app bash -c "cd packages/scratch-gui && npm exec jest test/integration/specific-file.test.js"
```

### Linting

```bash
docker compose run --rm app npm run lint
```

**IMPORTANT**: Lint must pass with **zero errors AND zero warnings**. The `scratch-gui` package uses `--max-warnings 0` to enforce this. Fix all warnings (including JSDoc issues) before committing.

### Formatting (Prettier)

Prettier is applied to **Smalruby-specific files only** (not upstream Scratch files). The `lint` script includes `prettier --check .` automatically.

```bash
# Format all Smalruby-specific files
docker compose run --rm app npm run format

# Check formatting without modifying files
docker compose run --rm app npm run format:check
```

**When adding new Smalruby-specific files**, update the `.prettierignore` whitelist and `.claude/rules/<package>/smalruby-prettier-files.md`. See `.claude/rules/code-style.md` for details.

### Clean

Remove build artifacts from all packages:

```bash
docker compose run --rm app npm run clean
```

## Smalruby-Specific Features

### Ruby Mode with @ruby/prism

Smalruby provides a Ruby code editor (Monaco Editor) in `scratch-gui`. Ruby code is parsed using [@ruby/prism](https://github.com/ruby/prism) (a WebAssembly-based Ruby parser) and converted to/from Scratch blocks within the browser.

- **Parser**: `@ruby/prism` — parses Ruby source into an AST (WebAssembly, runs in browser and Node.js)
- **Ruby → Blocks**: `src/lib/ruby-to-blocks-converter/` — converts prism AST nodes into Scratch blocks
- **Blocks → Ruby**: `src/lib/ruby-generator/` — generates Ruby source from Scratch block data
- **Integration**: `src/containers/ruby-tab/` — Monaco Editor integration and tab switching logic

### Google Drive Integration

Smalruby supports loading and saving projects to Google Drive. Setup requires:

- Google Cloud Platform project with Drive API, Picker API, and Generative Language API enabled
- OAuth 2.0 client credentials
- Environment variables: `GOOGLE_CLIENT_ID`, `GOOGLE_API_KEY`

See `docs/google-drive/google-api-setup.md` for detailed setup instructions.

### Custom Extensions

Custom Smalruby extensions are located in `packages/scratch-vm/src/extensions/`:
- `koshien/`: Smalruby Koshien competition support
- `microbitMore/`: Enhanced micro:bit support
- `scratch3_mesh/`: Mesh networking (deprecated)
- `scratch3_mesh_v2/`: Mesh networking v2

## Package-Specific Development

Each package has its own development workflow. See package-specific rules in `.claude/rules/`:

- `.claude/rules/scratch-gui/` - GUI development, Ruby mode, testing
- `.claude/rules/scratch-vm/` - VM development, extensions, playground
- `.claude/rules/scratch-render/` - Rendering engine development
- `.claude/rules/scratch-svg-renderer/` - SVG processing
- `.claude/rules/task-herder/` - Task queue utility

## Environment Variables

Set environment variables in `.env` file at project root:

```bash
# Google Drive Integration
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_API_KEY=your-api-key

# Mesh Networking (optional)
MESH_GRAPHQL_ENDPOINT=https://your-endpoint
MESH_API_KEY=your-key
MESH_AWS_REGION=ap-northeast-1

# Development
NODE_ENV=development
DEBUG=*
```

After changing environment variables, restart the service:

```bash
docker compose restart app
```

## Development Practices

### Scope & Design Discipline

- When fixing a bug pattern (e.g., `set_xxx` methods, log level changes), always check for **ALL instances** of the pattern across the codebase before proposing a fix. Do not fix only the reported instance.
- When designing a fix, consider assignment/usage contexts (e.g., `flag = true`) not just standalone expressions.

### Investigation Approach

- For UI/browser bugs, prefer **reproducing with Playwright first** before deep code exploration. Don't spend extensive time reading code when the bug is visually reproducible.
- When debugging block conversion issues, start from the user-facing symptom and trace inward, rather than guessing at coordinates or layout causes.

## Browser Debugging with Playwright MCP

### URL Parameters for Testing

Always use URL parameters to streamline Playwright MCP testing:

```
http://localhost:8601?no_beforeunload=1&tab=ruby&ruby_version=2
```

| Parameter | Values | Description |
|-----------|--------|-------------|
| `no_beforeunload` | `1`, `true` | **Always use this.** Disables beforeunload dialog that blocks navigation. |
| `tab` | `code`, `costumes`, `sounds`, `ruby` | Activate a specific tab on startup. |
| `ruby_version` | `1`, `2` | Set Ruby version, overriding localStorage. |

### Debug Globals

When verifying behavior in the browser using Playwright MCP, use the `window.smalruby` debug global object exposed by `packages/scratch-gui/src/containers/ruby-tab.jsx`:

```javascript
// Available after visiting the Ruby tab at least once
window.smalruby.vm        // Scratch VM instance
window.smalruby.sprite    // Current editing target (RenderedTarget)
window.smalruby.blocks    // Current target's blocks
window.smalruby.comments  // Current target's comments
window.smalruby.stage     // Stage target
window.smalruby.runtime   // VM runtime

// Monaco editor instance
monaco.editor.getEditors()[0]  // Get the first Monaco editor
```

To access the RubyGenerator (webpack bundled module):

```javascript
// Obtain webpack require via webpackChunkGUI
let req;
window.webpackChunkGUI.push([['__probe__'], {}, r => { req = r; }]);
// Find RubyGenerator
for (const id in req.c) {
    const m = req.c[id]?.exports;
    if (m?.default?.targetsToCode) { /* found RubyGenerator = m.default */ break; }
}
```

## Testing Philosophy

Follow TDD (Test-Driven Development) approach:

1. **RED**: Write failing tests first to validate test correctness
2. **GREEN**: Implement code to make tests pass
3. **REFACTOR**: Improve code while keeping tests green (only when needed)

### Testing Strategy

- UI behavior and features that involve browser interaction should use **integration tests**, not unit tests.
- **Local testing**: Run only the **directly affected test files** and **lint** before committing and pushing. Full test suites (unit + integration) are run by CI.
  - Run lint: `docker compose run --rm app npm run lint`
  - Run specific tests: `docker compose run --rm app bash -c "cd packages/scratch-gui && npm exec jest test/unit/lib/your-test.test.js"`
- **CI testing**: The full test suite runs automatically on push. Do not wait for full local test runs before committing — trust CI for comprehensive regression detection.

## Key Directories

- `packages/`: All workspace packages (npm workspaces)
- `infra/`: AWS CDK infrastructure projects (independent projects, not workspaces)
  - `infra/smalruby-mesh-v2/`: Mesh v2 networking service (AppSync + DynamoDB)
  - `infra/smalruby-rubytee-relay/`: Rubytee AI relay service (Anthropic Claude + DynamoDB)
  - `infra/smalruby-classroom/`: Classroom service (API Gateway + Lambda + DynamoDB)
- `docs/`: **Smalruby 独自の機能ドキュメント**（ユーザーストーリー単位の統合ドキュメント）。配置ルールは `.claude/rules/documentation.md` 参照
- `scripts/`: Monorepo-level build scripts
- `.github/workflows/`: CI/CD configuration
- `.claude/rules/`: Package-specific development rules

### Locale / Translation Files

Japanese locale files are located at:

- `packages/scratch-gui/src/locales/ja.js` — Main Japanese locale (kanji/hiragana)
- `packages/scratch-gui/src/locales/ja-Hira.js` — Hiragana-only (phonetic) locale

Always check these paths first when adding or modifying user-facing strings.

## Cross-Package Dependencies

Packages depend on each other through workspace references:
- `scratch-gui` depends on `scratch-vm`, `scratch-render`, `scratch-svg-renderer`
- `scratch-vm` depends on `scratch-render`, `scratch-svg-renderer`
- All packages are built together in dependency order

When modifying packages that affect others, test compatibility after changes.

## Upstream Integration

This project is a fork of the [Scratch Editor](https://github.com/scratchfoundation/scratch-editor) maintained by the Scratch Foundation.

### Upstream Repository Configuration

- **Upstream remote**: `https://github.com/scratchfoundation/scratch-editor.git`
- **Upstream branch**: `develop` (NOT main or master)
- **Local development branch**: `develop`

### Fetching Upstream Changes

**CRITICAL**: The upstream repository contains a GitHub Pages branch with extremely large changes. Always fetch **only the specific branch** you need to avoid downloading unnecessary data:

```bash
# Fetch only the develop branch from upstream
git fetch -p upstream develop

# DO NOT use bare `git fetch upstream` - it will fetch all branches including gh-pages
```

### Merging Upstream Changes

**Use the `/upstream:merge` slash command for interactive, semi-automated merge workflow**:

```bash
/upstream:merge
```

This command provides:

- Step-by-step guidance for merge execution
- Automatic conflict detection for known areas (gui.ts, extension-manager.js)
- Resolution guidance with code markers
- Automated testing (lint, build, unit, integration)
- Progress tracking and documentation generation
- PR creation with comprehensive summary

**Manual merge is NOT recommended** - use the slash command to ensure consistent process and complete documentation.

See `.claude/skills/upstream-merge/SKILL.md` for detailed workflow documentation.

### Cherry-Picking Individual Upstream Commits

upstream の個別コミットを直接取り込む (cherry-pick) 場合は、**リリース済みかどうかを必ず確認** する。未リリースのコミットを取り込むのは「我々が再現できる致命的なバグ修正であり、取り込まないと壊れる構造的問題に限る」。

判断基準・確認手順・取り込み時の必須事項は `.claude/rules/upstream-cherry-pick.md` を参照。
