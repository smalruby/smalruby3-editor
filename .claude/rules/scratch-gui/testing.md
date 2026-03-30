---
paths:
  - "packages/scratch-gui/test/**"
  - "packages/scratch-gui/src/lib/ruby-to-blocks-converter/**"
  - "packages/scratch-gui/src/lib/ruby-generator/**"
  - "packages/scratch-gui/src/containers/ruby-tab/**"
  - "packages/scratch-gui/src/playground/**"
  - "packages/scratch-gui/src/lib/url-params*"
description: "scratch-gui のテスト方針、テスト実行コマンド、integration/unit テストの使い分け、Playwright MCP テスト用 URL パラメーター。"
---

# Testing

## Test Commands

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

## Local vs CI Testing Policy

- **ローカル**: 変更に直接関係するテストファイルのみ実行 + lint を通す。それが通ったら commit & push してよい。
- **CI**: push 時に全テスト（unit + integration）が自動実行される。全体のリグレッション検出は CI に任せる。
- ローカルで全テストスイートを実行する必要はない。

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

## Integration Test Development Workflow

**重要**: Integration tests では `data-testid` を優先的に使用する。
詳細は `.claude/rules/scratch-gui/e2e-test.md` を参照。

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

5. **Lint + affected tests が通ったら** commit and push。全テストは CI が実行する。

## Playwright MCP Testing with URL Parameters

When verifying behavior in the browser using Playwright MCP, use the following URL parameters to streamline testing:

```
http://localhost:8601?no_beforeunload=1&tab=ruby&ruby_version=2
```

| Parameter | Values | Description |
|-----------|--------|-------------|
| `no_beforeunload` | `1`, `true` | Disable the beforeunload confirmation dialog. **Always use this** in Playwright tests to prevent navigation being blocked. |
| `tab` | `code`, `blocks`, `costumes`, `sounds`, `ruby` | Activate a specific tab on startup. Use `tab=ruby` to skip manual navigation to the Ruby tab. |
| `ruby_version` | `1`, `2` | Set the Ruby version, overriding localStorage. Use this to ensure consistent test behavior regardless of previous test runs. |

Invalid parameter values are silently ignored (falls back to defaults).

**Implementation**: `src/lib/url-params.js` — cached URL parameter parser used by playground entry points, reducers, and HOCs.
