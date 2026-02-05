# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is the **Smalruby 3 Editor** monorepo - a Ruby-based visual programming environment forked from MIT's Scratch 3.0. The monorepo contains all packages needed to build and run the Smalruby editor.

## Monorepo Structure

This project uses npm workspaces with the following packages:

- **`packages/scratch-gui`**: React-based web interface with Ruby mode, custom extensions, and Google Drive integration
- **`packages/scratch-vm`**: Virtual machine that executes projects, with Opal integration for Ruby execution
- **`packages/scratch-render`**: WebGL-based rendering engine for sprites and backdrops
- **`packages/scratch-svg-renderer`**: SVG processing for vector images
- **`packages/task-herder`**: Asynchronous task queue with throttling and concurrency control

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

### Linting

```bash
docker compose run --rm app npm run lint
```

### Clean

Remove build artifacts from all packages:

```bash
docker compose run --rm app npm run clean
```

## Smalruby-Specific Features

### Ruby Mode with Opal

Smalruby integrates [Opal](https://opalrb.com/) to transpile Ruby code into JavaScript that runs within the Scratch VM. The `scratch-vm` package handles Ruby execution, while `scratch-gui` provides the Ruby code editor (Monaco Editor) and UI.

**Opal Setup**: The `packages/scratch-gui` package runs `npm run setup:opal` automatically before builds to generate `static/javascripts/setup-opal.js` from Opal sources.

### Google Drive Integration

Smalruby supports loading and saving projects to Google Drive. Setup requires:
- Google Cloud Platform project with Drive API and Picker API enabled
- OAuth 2.0 client credentials
- Environment variables: `GOOGLE_CLIENT_ID`, `GOOGLE_API_KEY`

See `packages/scratch-gui/docs/google-drive-setup.md` for detailed setup instructions.

### Custom Extensions

Custom Smalruby extensions are located in `packages/scratch-vm/src/extensions/`:
- `koshien/`: Smalruby Koshien competition support
- `microbitMore/`: Enhanced micro:bit support
- `scratch3_mesh/`: Mesh networking (deprecated)
- `scratch3_mesh_v2/`: Mesh networking v2

## Package-Specific Development

Each package has its own development workflow. See package-specific rules in `.claude/rules/`:

- `.claude/rules/scratch-gui/` - GUI development, Opal integration, testing
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

## Testing Philosophy

Follow TDD (Test-Driven Development) approach:

1. **RED**: Write failing tests first to validate test correctness
2. **GREEN**: Implement code to make tests pass
3. **REFACTOR**: Improve code while keeping tests green (only when needed)

## Key Directories

- `packages/`: All workspace packages
- `scripts/`: Monorepo-level build scripts
- `.github/workflows/`: CI/CD configuration
- `.claude/rules/`: Package-specific development rules

## Cross-Package Dependencies

Packages depend on each other through workspace references:
- `scratch-gui` depends on `scratch-vm`, `scratch-render`, `scratch-svg-renderer`
- `scratch-vm` depends on `scratch-render`, `scratch-svg-renderer`
- All packages are built together in dependency order

When modifying packages that affect others, test compatibility after changes.
