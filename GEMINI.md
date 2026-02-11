# Smalruby 3 Editor Monorepo Guide

This directory (`gui/smalruby3-editor`) is the monorepo root for the Smalruby 3 Editor, utilizing `npm workspaces` to manage the core packages of the visual programming environment.

## Project Overview

Smalruby 3 is a fork of Scratch 3.0 that introduces Ruby programming capabilities. This monorepo aggregates the following key packages:

*   **`packages/scratch-gui`**: The React-based user interface. It includes the Ruby code editor (Ace Editor), the Opal transpiler configuration, and Smalruby-specific UI extensions.
*   **`packages/scratch-vm`**: The execution engine. It has been modified to support the execution of Ruby code transpiled to JavaScript via Opal.
*   **`packages/scratch-render`**: WebGL-based rendering engine.
*   **`packages/scratch-svg-renderer`**: SVG handling and rendering.

## Development Environment

**CRITICAL: Docker Usage**
As per the project's global mandates, **ALL npm commands and development tasks must be performed within the Docker container (service name: `app`)**. Do not run `npm install` or build commands directly on the host machine to ensure environment consistency.

## Workspaces & Architecture

This project uses `npm workspaces`. The root `package.json` orchestrates commands across all packages.

### Key Packages & Locations

*   **GUI**: `packages/scratch-gui`
    *   Contains `opal/` directory for Opal Ruby transpiler integration.
    *   `scripts/make-setup-opal.js`: Critical script for setting up Opal.
*   **VM**: `packages/scratch-vm`
    *   Handles the runtime logic for blocks and Ruby execution.

## Common Commands (Run inside Docker)

**IMPORTANT**: All npm commands MUST be run inside the Docker container using `docker compose run --rm app`.

### Installation
Install dependencies for all workspaces:
```bash
docker compose run --rm app npm install
```

### Building
Build all packages:
```bash
docker compose run --rm app npm run build
```
Build in development mode (faster, source maps):
```bash
docker compose run --rm app npm run build:dev
```

### Testing
Run all tests (Unit + Integration) across all workspaces:
```bash
docker compose run --rm app npm test
```

Run only unit tests:
```bash
docker compose run --rm app npm run test:unit
```

Run only integration tests:
```bash
docker compose run --rm app npm run test:integration
```

### Linting
Run ESLint across all workspaces:
```bash
docker compose run --rm app npm run lint
```

## Package-Specific Commands (Run inside Docker)

### `scratch-vm`
```bash
# Run VM tests
docker compose run --rm app bash -c "cd packages/scratch-vm && npm test"

# Run specific tap tests
docker compose run --rm app bash -c "cd packages/scratch-vm && npm run tap:unit"

# Run a specific test
docker compose run --rm app bash -c "cd packages/scratch-vm && npx tap path/to/test"
```

### `scratch-gui`
```bash
# Run GUI unit tests (runs ALL unit tests in the package)
docker compose run --rm app bash -c "cd packages/scratch-gui && npm run test:unit"

# Run a specific unit test
docker compose run --rm app bash -c "cd packages/scratch-gui && npx jest test/unit/components/action-menu.test.jsx"

# Run GUI integration tests (requires build:dev first; runs ALL integration tests)
docker compose run --rm app bash -c "cd packages/scratch-gui && npm run build:dev && npm run test:integration"

# Run a specific integration test (requires build:dev first)
docker compose run --rm app bash -c "cd packages/scratch-gui && npx jest test/integration/your-test.test.js"
```

## Package-Specific Details

### `scratch-gui` (@smalruby/scratch-gui)
*   **Framework**: React, Redux.
*   **Tests**: Uses **Jest** for both unit and integration tests.
*   **Special Build Step**: `npm run setup:opal` (runs automatically before build) prepares the Opal transpiler environment.
*   **Ruby Integration**: Logic for the "Ruby" tab and code editor resides here.

### `scratch-vm` (@smalruby/scratch-vm)
*   **Tests**: Uses **Tap** for unit and integration tests.
*   **Linting**: Uses `eslint` and `format-message`.
*   **Extension Support**: Smalruby-specific extensions (like hardware support) are integrated here.

## Task Completion Workflow

Before considering a task complete and preparing a Pull Request, follow these steps inside the Docker container:

1.  **Verify Functionality**: Ensure the changes work as expected and add new tests if applicable.
2.  **Run Lint Checks**:
    ```bash
    docker compose run --rm app npm run lint
    ```
3.  **Run Unit Tests**:
    ```bash
    # all tests
    docker compose run --rm app npm run test:unit
    # run specific test (scratch-vm or scratch-gui)
    docker compose run --rm app bash -c "cd /app/packages/scratch-vm && npm exec tap test/path/to/your-test.js"
    docker compose run --rm app bash -c "cd /app/packages/scratch-gui && npm exec jest test/path/to/your-test.js"
    ```
4.  **Build the application**:
    ```bash
    docker compose run --rm app bash -c "cd /app/packages/scratch-gui && npm run build:dev"
    ```
5.  **Run Integration Tests** (if applicable):
    ```bash
    # all tests
    docker compose run --rm app npm run test:integration
    # run specific test (scratch-vm or scratch-gui)
    docker compose run --rm app bash -c "cd /app/packages/scratch-vm && npm exec tap test/path/to/your-test.js"
    docker compose run --rm app bash -c "cd /app/packages/scratch-gui && npm exec jest test/path/to/your-test.js"
    ```
6.  **Debug with browser logs**:
    ```javascript
    import SeleniumHelper from '../helpers/selenium-helper';
    const { getLogs } = new SeleniumHelper();

    test('Your test', async () => {
        // ... test code ...

        // Get all logs (INFO, WARNING, SEVERE)
        const logs = await getLogs({ includeAllLevels: true });
        console.log('Browser logs:', logs);
    });
    ```
7.  **Build Check**: Ensure the project builds successfully.
    ```bash
    docker compose run --rm app npm run build
    ```
8.  **Git Status**: Check for untracked files and ensure all changes are staged.
9.  **Commit**: Use Conventional Commits and ensure you are NOT on the `develop` branch.

## Contribution Guidelines

*   **Branching Strategy**:
    *   The default branch is `develop`.
    *   **NEVER commit directly to `develop`**.
    *   Create feature branches from `develop` (e.g., `fix/issue-description`, `feature/new-functionality`).
    *   All Pull Requests should target the `develop` branch.
*   **Commit Messages**: This project enforces **Conventional Commits** (e.g., `feat:`, `fix:`, `chore:`, `refactor:`, `docs:`, `test:`).
*   **GitHub Operations**:
    *   Use the `gh` command for GitHub access (issues, PRs).
    *   Always target the **Smalruby organization** repositories, not upstream Scratch Foundation.
    *   For complex messages, use `gh ... -F <file>` to avoid shell escaping issues.
*   **Linting**: Ensure `npm run lint` passes before committing.
*   **Lockfile**: `package-lock.json` is maintained at the root level.
