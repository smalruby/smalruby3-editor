# Suggested Commands

**IMPORTANT**: All npm commands MUST be run inside the Docker container.

## Monorepo Root Commands
```bash
# Install dependencies
docker compose run --rm app bash -c "npm install"

# Build all packages
docker compose run --rm app bash -c "npm run build"

# Build in development mode
docker compose run --rm app bash -c "npm run build:dev"

# Run all tests (unit and integration)
docker compose run --rm app bash -c "npm test"

# Run unit tests only
docker compose run --rm app bash -c "npm run test:unit"

# Run integration tests only
docker compose run --rm app bash -c "npm run test:integration"

# Run lint for all packages
docker compose run --rm app bash -c "npm run lint"
```

## Package-Specific Commands
You can run commands for specific packages by changing to their directory.

### Scratch VM
```bash
# Run VM tests
docker compose run --rm app bash -c "cd /app/packages/scratch-vm && npm test"

# Run specific tap tests
docker compose run --rm app bash -c "cd /app/packages/scratch-vm && npm run tap:unit"
```

### Scratch GUI
```bash
# Run GUI unit tests
docker compose run --rm app bash -c "cd /app/packages/scratch-gui && npm run test:unit"

# Run GUI integration tests (requires build:dev first)
docker compose run --rm app bash -c "cd /app/packages/scratch-gui && npm run build:dev && npm run test:integration"
```

## System Utilities (Darwin)
- Standard Unix commands apply: `ls`, `cd`, `grep`, `find`, `git`, `cat`, `tail`, `head`.
- `docker compose` is used to manage the dev environment.
