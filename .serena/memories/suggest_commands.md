# Suggested Commands

**IMPORTANT**: All npm commands MUST be run inside the Docker container.

## Monorepo Root Commands
```bash
# Install dependencies
docker compose run --rm app npm install

# Build all packages (production)
docker compose run --rm app npm run build

# Build in development mode (faster, with source maps)
docker compose run --rm app npm run build:dev

# Run all tests (lint + unit + integration)
docker compose run --rm app npm test

# Run unit tests only
docker compose run --rm app npm run test:unit

# Run integration tests only
docker compose run --rm app npm run test:integration

# Run lint for all packages
docker compose run --rm app npm run lint
```

## Package-Specific Commands

### Scratch VM (unit tests use tap)
```bash
# Run all VM tests
docker compose run --rm app bash -c "cd /app/packages/scratch-vm && npm test"

# Run a specific unit test file
docker compose run --rm app bash -c "cd /app/packages/scratch-vm && npm exec tap test/unit/specific-file.js"
```

### Scratch GUI (unit and integration tests use jest)
```bash
# Run GUI unit tests
docker compose run --rm app bash -c "cd /app/packages/scratch-gui && npm run test:unit"

# Run a specific unit test file
docker compose run --rm app bash -c "cd /app/packages/scratch-gui && npm exec jest test/unit/path/to/test.test.js"

# Run GUI integration tests (requires build:dev first)
docker compose run --rm app bash -c "cd /app/packages/scratch-gui && npm run build:dev"
docker compose run --rm app bash -c "cd /app/packages/scratch-gui && npm run test:integration"

# Run a specific integration test file
docker compose run --rm app bash -c "cd /app/packages/scratch-gui && npm exec jest test/integration/specific.test.js"
```

## System Utilities (Darwin)
- Standard Unix commands apply: `ls`, `cd`, `grep`, `find`, `git`, `cat`, `tail`, `head`.
- `docker compose` is used to manage the dev environment.
