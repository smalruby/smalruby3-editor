# Code Style and Conventions

## JavaScript/TypeScript

### Linting

- **Linter**: ESLint with `eslint-config-scratch`
- **MUST pass with zero errors AND zero warnings before committing**: Always run `npm run lint` before creating commits. The `scratch-gui` package enforces `--max-warnings 0`.
- Fix linting errors and warnings automatically when possible: `npm run lint -- --fix`
- **JSDoc warnings count as failures**: Missing `@param`, `@returns`, unescaped inline tags (`@ruby` → `` `@ruby` ``), and incorrect types (`Object` → `object`) must all be fixed.

### Prettier (Code Formatting)

- **Formatter**: Prettier with `prettierConfigScratch.recommended` from `eslint-config-scratch`
- **対象**: Smalruby 固有ファイルのみ（upstream ファイルは対象外）
- **設定**: `tabWidth: 4`, `semi: true`, `singleQuote: true`, `trailingComma: 'all'`, import sorting 有効
- **`.prettierignore`**: ホワイトリスト方式 — デフォルトで全ファイルを無視し、Smalruby 固有ファイルのみ対象に含める
- **ファイル一覧**: `.claude/rules/scratch-gui/smalruby-prettier-files.md` / `.claude/rules/scratch-vm/smalruby-prettier-files.md`

**新しい Smalruby 固有ファイルを追加する際は、必ず以下の 2 つを更新すること:**
1. 該当パッケージの `.prettierignore`（ホワイトリストに追加）
2. `.claude/rules/<package>/smalruby-prettier-files.md`（一覧に追加）

```bash
# フォーマット実行
docker compose run --rm app npm run format

# フォーマットチェック（lint に含まれる）
docker compose run --rm app npm run format:check

# パッケージ単位
docker compose run --rm app bash -c "cd packages/scratch-gui && npm run format"
```

### Code Style Guidelines

1. **Follow existing patterns**: When modifying code, match the style of surrounding code
2. **Mimic package conventions**: Each package may have slightly different patterns - follow them
3. **ESLint rules are authoritative**: If ESLint doesn't complain, the style is acceptable

### File Structure

- Use ES6 modules (`import`/`export`)
- Group imports logically:
  1. External dependencies
  2. Internal workspace packages
  3. Relative imports
- One React component per file (in GUI package)

### Naming Conventions

- **Files**: kebab-case for files (`my-component.jsx`, `util-function.js`)
- **Components**: PascalCase (`MyComponent`, `RubyEditor`)
- **Functions/variables**: camelCase (`handleClick`, `userName`)
- **Constants**: UPPER_SNAKE_CASE (`API_ENDPOINT`, `MAX_RETRIES`)
- **Private methods**: prefix with underscore (`_handleInternalEvent`)

### React Components (scratch-gui)

```javascript
// Functional components preferred
const MyComponent = ({ prop1, prop2 }) => {
    return (
        <div>
            {/* JSX content */}
        </div>
    );
};

MyComponent.propTypes = {
    prop1: PropTypes.string.isRequired,
    prop2: PropTypes.number
};

export default MyComponent;
```

### Redux Usage (scratch-gui)

- Use Redux Toolkit patterns when adding new features
- Follow existing reducer/action patterns for consistency
- Keep state shape flat when possible

## Smalruby Marker Comments

upstream のファイルに Smalruby 固有のコードを追加する際は、必ず **マーカーコメント** で囲む。

```javascript
// === Smalruby: Start of <機能名> ===
// ... Smalruby 固有のコード ...
// === Smalruby: End of <機能名> ===
```

- Start と End は必ずペアにする
- `<機能名>` は英語で、何の機能かわかる名前にする
- ファイル全体が Smalruby 固有の場合はファイル冒頭に `// === Smalruby: This file is Smalruby-specific (<説明>) ===`
- マーカーを追加・削除したら、該当パッケージの `development.md` のマーカー一覧を更新する

詳細は各パッケージの development.md を参照:
- `.claude/rules/scratch-gui/development.md` — scratch-gui のマーカー一覧
- `.claude/rules/scratch-vm/development.md` — scratch-vm のマーカー一覧

## Documentation

### JSDoc Comments

Use JSDoc for functions and classes:

```javascript
/**
 * Transpile Ruby code to JavaScript using Opal.
 * @param {string} rubyCode - The Ruby source code to transpile.
 * @param {Object} options - Transpilation options.
 * @param {boolean} options.sourceMap - Whether to generate source maps.
 * @returns {string} The transpiled JavaScript code.
 */
function transpileRuby(rubyCode, options = {}) {
    // Implementation
}
```

### Inline Comments

- Use comments to explain **why**, not **what**
- Complex logic should have explanatory comments
- Avoid obvious comments:
  ```javascript
  // ❌ Bad: Obvious comment
  // Set x to 5
  const x = 5;

  // ✅ Good: Explains reasoning
  // Use 5-second timeout to account for slow network conditions
  const timeout = 5000;
  ```

## Testing

### Test File Naming

- Unit tests: `*.test.js` in `test/unit/`
- Integration tests: `*.test.js` in `test/integration/`
- Test files should mirror source file structure

### Test Structure

```javascript
describe('MyComponent', () => {
    test('should render correctly', () => {
        // Arrange
        const props = { ... };

        // Act
        const wrapper = mount(<MyComponent {...props} />);

        // Assert
        expect(wrapper.find('.my-class')).toHaveLength(1);
    });

    test('should handle click events', () => {
        // Test implementation
    });
});
```

### Test Conventions

- Use descriptive test names: `should [expected behavior] when [condition]`
- One assertion per test when possible
- Use AAA pattern: Arrange, Act, Assert
- Mock external dependencies
- Clean up after tests (event listeners, timers, etc.)

## Package-Specific Conventions

### scratch-gui

- React components in `src/components/` (presentational) and `src/containers/` (connected)
- Redux logic in `src/reducers/` and `src/lib/` for middleware
- CSS Modules for styling (`.css` files import as objects)
- Use `classNames` library for conditional classes

### scratch-vm

- Extension classes in `src/extensions/`
- Block implementations return promises or values
- Use `BlockType` constants from `extension-support/block-type`
- Document block opcodes clearly

## Error Handling

- Catch and handle errors appropriately
- Don't swallow errors silently
- Log errors with context:
  ```javascript
  try {
      await someOperation();
  } catch (error) {
      console.error('Failed to complete operation:', error);
      throw error; // Re-throw if caller needs to handle
  }
  ```

## Async/Await

- Prefer `async/await` over `.then()` for readability
- Always handle promise rejections
- Use try/catch for async operations

## Import Organization

```javascript
// 1. External dependencies
import React from 'react';
import PropTypes from 'prop-types';

// 2. Workspace packages
import VM from '@smalruby/scratch-vm';

// 3. Relative imports (grouped by type)
import MyComponent from './my-component.jsx';
import { helper } from '../lib/helpers.js';
import styles from './styles.css';
```

## Build and Dist

- Never commit `build/` or `dist/` directories
- Never commit `node_modules/`
- Always commit `package-lock.json` changes
- Run build before committing to verify no errors
