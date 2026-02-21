---
paths:
  - "packages/scratch-gui/**/*.{js,jsx,ts,tsx}"
  - "packages/scratch-gui/package.json"
  - "packages/scratch-gui/webpack.config.js"
---

# scratch-gui Development

**CRITICAL**: All npm commands for scratch-gui MUST be run inside Docker containers using the `app` service.

## Package Commands

All commands are run from `/app/packages/scratch-gui` inside the container.

### Installation

```bash
docker compose run --rm app bash -c "cd /app/packages/scratch-gui && npm install"
```

### Development Server

The development server is started automatically via the monorepo root:

```bash
docker compose up app
```

Access at: http://localhost:8601

### Build

```bash
# Development build (faster, for integration testing)
docker compose run --rm app bash -c "cd /app/packages/scratch-gui && npm run build:dev"

# Production build
docker compose run --rm app bash -c "cd /app/packages/scratch-gui && npm run build"

# Standalone build (embeddable version)
docker compose run --rm app bash -c "cd /app/packages/scratch-gui && npm run build:dist-standalone"
```

**Note**: Production builds take ~300 seconds. Use `build:dev` for development and testing.

### Testing

```bash
# All tests (lint + unit + integration)
docker compose run --rm app bash -c "cd /app/packages/scratch-gui && npm test"

# Lint only
docker compose run --rm app bash -c "cd /app/packages/scratch-gui && npm run test:lint"

# Unit tests only
docker compose run --rm app bash -c "cd /app/packages/scratch-gui && npm run test:unit"

# Run specific unit test (does not use tap)
docker compose run --rm app bash -c "cd /app/packages/scratch-gui && npm exec jest test/unit/your-test.test.js"

# Integration tests only (requires build first)
docker compose run --rm app bash -c "cd /app/packages/scratch-gui && npm run test:integration"

# Run specific test (does not use tap)
docker compose run --rm app bash -c "cd /app/packages/scratch-gui && npm exec jest test/integration/your-test.test.js"

# Smoke tests
docker compose run --rm app bash -c "cd /app/packages/scratch-gui && npm run test:smoke"
```

**IMPORTANT**: Integration tests require `npm run build:dev` to be run first.

### Opal Setup

Setup Opal (Ruby-to-JavaScript transpiler):

```bash
docker compose run --rm app bash -c "cd /app/packages/scratch-gui && npm run setup:opal"
```

This concatenates Opal files from `opal/` directory into `static/javascripts/setup-opal.js`. The `prebuild` script runs this automatically before builds.

## Key Directories

- `src/`: React components and application code
  - `containers/ruby-tab/`: Ruby code editor integration
  - `lib/ruby-to-blocks-converter/`: Ruby-to-blocks conversion logic
  - `lib/ruby-generator/`: Blocks-to-Ruby code generation
- `test/`: Test files
  - `test/unit/`: Unit tests
  - `test/integration/`: Integration tests (Selenium-based)
  - `test/smoke/`: Smoke tests
- `opal/`: Opal transpiler files (opal.min.js, opal-parser.min.js, config files)
- `static/`: Static assets
  - `static/javascripts/setup-opal.js`: Generated Opal setup file
- `scripts/`: Build and setup scripts
  - `scripts/make-setup-opal.js`: Generates setup-opal.js
  - `scripts/makePWAAssetsManifest.js`: PWA manifest generation
  - `scripts/postbuild.mjs`: Post-build processing

## Ruby Mode Integration

### Opal Configuration

Opal configuration is in `opal/config-opal.js` and `opal/config-opal-parser.js`. These files configure how Ruby code is transpiled to JavaScript.

### Monaco Editor

Ruby code editing uses Monaco Editor (`@monaco-editor/react`). The Ruby editor is integrated in `src/containers/ruby-tab/`.

### Ruby-to-Blocks Conversion

The `src/lib/ruby-to-blocks-converter/` directory contains logic for converting Ruby code back to Scratch blocks.

## Google Drive Integration

Setup instructions: `docs/google-drive-setup.md`

Required environment variables:
- `GOOGLE_CLIENT_ID`: OAuth 2.0 client ID
- `GOOGLE_API_KEY`: API key for Picker API

Set in `.env` file at project root and restart container:

```bash
docker compose restart app
```

## Testing Workflow

### Integration Test Development

1. **Build the application**:
   ```bash
   docker compose run --rm app bash -c "cd /app/packages/scratch-gui && npm run build:dev"
   ```

2. **Run the test**:
   ```bash
   docker compose run --rm app bash -c "cd /app/packages/scratch-gui && npm exec jest test/integration/your-test.test.js"
   ```

3. **Debug with browser logs**:
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

4. **Run lint**:
   ```bash
   docker compose run --rm app bash -c "cd /app/packages/scratch-gui && npm run test:lint"
   ```

5. **Only after all tests pass and lint is clean**, commit and push.

## PWA (Progressive Web App)

The GUI is built as a PWA. Assets and manifest are generated by:
- `scripts/makePWAAssetsManifest.js` (prebuild)
- `webpack-pwa-manifest` plugin (build)
- `workbox-webpack-plugin` (build)

## Development Notes

- The webpack config loads environment variables from monorepo root `.env` file
- Hot module replacement (HMR) is enabled in development mode
- The app uses scratch-blocks (Blockly fork) for visual block programming
- CSS modules are used for styling (except raw.css files and driver.js)
