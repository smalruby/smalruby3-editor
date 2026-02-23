---
paths:
  - "packages/scratch-gui/"
  - "packages/scratch-gui/*"
  - "packages/scratch-gui/**/*"
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

# Unit tests only (uses jest)
docker compose run --rm app bash -c "cd /app/packages/scratch-gui && npm run test:unit"

# Run specific unit test file
docker compose run --rm app bash -c "cd /app/packages/scratch-gui && npm exec jest test/unit/your-test.test.js"

# Integration tests only (requires build first)
docker compose run --rm app bash -c "cd /app/packages/scratch-gui && npm run build:dev"
docker compose run --rm app bash -c "cd /app/packages/scratch-gui && npm run test:integration"

# Run specific integration test file
docker compose run --rm app bash -c "cd /app/packages/scratch-gui && npm run build:dev"
docker compose run --rm app bash -c "cd /app/packages/scratch-gui && npm exec jest test/integration/your-test.test.js"

# Smoke tests
docker compose run --rm app bash -c "cd /app/packages/scratch-gui && npm run test:smoke"
```

**IMPORTANT**: Integration tests require `npm run build:dev` to be run first.

## Key Directories

- `src/`: React components and application code
  - `containers/ruby-tab/`: Ruby code editor integration (Monaco Editor + tab switching)
  - `lib/ruby-to-blocks-converter/`: Ruby AST → Scratch blocks conversion logic
  - `lib/ruby-generator/`: Scratch blocks → Ruby code generation
  - `lib/prism-parser.js`: `@ruby/prism` WebAssembly loader (browser + Node.js)
  - `lib/ruby-parser.js`: High-level Ruby parsing interface
- `test/`: Test files
  - `test/unit/`: Unit tests (jest)
  - `test/integration/`: Integration tests (jest + Selenium)
  - `test/smoke/`: Smoke tests

## Ruby Mode Integration

### Parser: @ruby/prism

Ruby code is parsed using [@ruby/prism](https://github.com/ruby/prism), a WebAssembly-based Ruby parser. The WASM module runs both in the browser and in Node.js (for tests).

- **Entry point**: `src/lib/prism-parser.js` — loads the WASM module and caches the prism instance
- **High-level API**: `src/lib/ruby-parser.js` — wraps prism-parser for use by converters

### Ruby ↔ Blocks Conversion

| Direction | Directory | Description |
|-----------|-----------|-------------|
| Ruby → Blocks | `src/lib/ruby-to-blocks-converter/` | Walks prism AST, creates Scratch block data |
| Blocks → Ruby | `src/lib/ruby-generator/` | Generates Ruby source from block tree |

**Key files in `ruby-to-blocks-converter/`:**
- `index.js` — entry point, orchestrates conversion
- `ast-handlers/` — handlers for each prism AST node type
- `converter-registry.js` — registry mapping block opcodes to converters
- `register-converters.js` — registers all converter modules
- `target-applier.js` — applies converted blocks to a Scratch target (VM)
- `scope-manager.js` — variable/scope tracking during conversion

### Monaco Editor

Ruby code editing uses Monaco Editor (`@monaco-editor/react`). The Ruby editor is integrated in `src/containers/ruby-tab/`.

## Testing Philosophy for Ruby ↔ Blocks Conversion

### General Policy

- **Unit tests are preferred** for all Ruby ↔ Blocks conversion logic
- A VM mock is available, so most conversion behavior can be tested without a real browser
- Extend the VM mock (add methods/state) as needed to cover new cases
- Integration tests are reserved for behavior that genuinely requires a browser environment

### When to Use Unit Tests (`test/unit/`)

Use unit tests for:
- Ruby → Blocks conversion (`ruby-to-blocks-converter/`)
- Blocks → Ruby generation (`ruby-generator/`)
- Round-trip correctness (Ruby → Blocks → Ruby)
- Individual converter modules (motion, looks, sound, control, etc.)
- Parser behavior (`prism-parser.js`, `ruby-parser.js`)
- Snippet completion logic (`snippets-completer.js`)

**Key unit test directories:**
- `test/unit/lib/ruby-to-blocks-converter/` — converter unit tests
- `test/unit/lib/ruby-generator/` — generator unit tests

### When to Use Integration Tests (`test/integration/`)

Use integration tests **only** for behavior that cannot be tested in unit tests:
- Tab switching timing (Ruby tab ↔ Blocks tab)
- Monaco Editor lifecycle (mount, unmount, editor readiness)
- UI interactions that depend on browser rendering or actual DOM timing
- End-to-end flows requiring a real build (e.g., `ruby-tab.test.js`)

**Key integration test files:**
- `test/integration/ruby-tab.test.js` — tab switching, editor lifecycle
- `test/integration/ruby-tab-completion-and-indent.test.js` — Monaco completion/indent behavior
- `test/integration/ruby-tab/` — additional Ruby tab integration scenarios

### Test Structure Example

```javascript
// Unit test: ruby-to-blocks-converter
import {createRubyToBlocksConverter} from '../../../src/lib/ruby-to-blocks-converter';

describe('motion converter', () => {
    test('should convert move(10) to motion_movesteps block', async () => {
        const converter = createRubyToBlocksConverter(mockVM);
        const blocks = await converter.convertRuby('move(10)');
        expect(blocks).toMatchBlock({ opcode: 'motion_movesteps' });
    });
});
```

## Google Drive Integration

Setup instructions: `docs/google-api-setup.md`

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
- Unit tests use jest with jsdom environment (configured in `package.json`)
- The `@ruby/prism` WASM module requires special jest transform configuration (see `package.json`)
