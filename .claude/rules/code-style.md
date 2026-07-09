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
- **`.prettierignore`**: ホワイトリスト方式 — デフォルトで全ファイルを無視し、Smalruby 固有ファイルのみ対象に含める。**Prettier 対象ファイルの唯一の真実は各パッケージの `.prettierignore`**（旧 `smalruby-prettier-files.md` ミラーは二重管理だったため廃止 #820）

**新しい Smalruby 固有ファイルを追加する際は、該当パッケージの `.prettierignore`（ホワイトリスト）に追加すること。** これだけで Prettier 対象になる（別途の一覧ファイルは持たない）。

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

### マーカーが必要なファイル / 不要なファイルの判定

**Smalruby 固有ファイル（＝ Prettier 対象ファイル）にはマーカー原則不要。**

- Prettier 対象ファイル（各パッケージの `.prettierignore` のホワイトリストに含まれるファイル）は Smalruby 独自ファイルで、マーカーは**必須ではない**
- upstream（Scratch）のファイルを修正する際は、修正箇所に**必ず**マーカーコメントを付ける
- 例外（実装済みの慣行）: Smalruby 固有ファイル内でも、**取り外し可能な拡張機能のコード**
  （tm2scratch / g2s / smalruby-ruby 等）を区別する目的で Start/End ペアを使ってよい
  （`register-converters.js` / `ruby-generator/index.js` / `url-params.js` 等に実在する）。
  この用途のマーカーは Smalruby 固有ファイル内なのでマーカー一覧 doc には**載せない**

### マーカーの 3 形式（実コードで使われている形）

1. **ブロックペア**（upstream ファイルへの挿入は必ずこれ）:

```javascript
// === Smalruby: Start of <機能名> ===
// ... Smalruby 固有のコード ...
// === Smalruby: End of <機能名> ===
```

2. **ファイルヘッダ**（Smalruby 固有ファイルの冒頭宣言。任意）:
   `// === Smalruby: This file is Smalruby-specific (<説明>) ===`
3. **単一行インライン**（1 行だけの軽微な挿入に一部で使用）: `// === Smalruby: <説明> ===`。
   ただし **grep でペア整合を検査できなくなる**ため、upstream ファイルでは 1 行の挿入でも
   ブロックペアを推奨（Start だけの bare 形式は Start/End 数の不一致を生む — 実際に
   `blocks.jsx` で発生している既知の表記ゆれ）

- Start と End は必ずペアにする（`grep -c 'Smalruby: Start'` と `'Smalruby: End'` が一致すること）
- `<機能名>` は英語で、何の機能かわかる名前にする
- **upstream ファイル**のマーカーを追加・削除したら、該当パッケージのマーカー一覧を更新する

マーカー一覧（`.claude/` の外に置く。実装時に編集しても確認プロンプトで止まらないため #820）:
- `docs/maintenance/smalruby-markers-gui.md` — scratch-gui のマーカー一覧
- `docs/maintenance/smalruby-markers-vm.md` — scratch-vm のマーカー一覧

## Documentation

### docs/ には git log / git blame で取れる情報を書かない

`docs/` 配下のドキュメントには、**PR 一覧・特定 PR への参照・コミット履歴・「誰がいつ何を変えたか」など、`git log` / `git blame` から取れる情報を書かない**。理由は二つ:

1. **メンテ漏れによりドキュメントが信用できなくなる**: 追加開発のたびに「関連 PR」表を更新しないと、古い情報が残って読者が混乱する。
2. **二重管理になる**: コミットメッセージや PR description に既に書かれている情報を docs にも書くと、片方だけ更新されて齟齬が出る。

#### 書かない例

- 「## 関連 PR」のような表 (例: `| #581 | スケルトン | / #582 | ボトムタブ |`)
- 「PR #606 で〜を廃止」「PR-2J で〜に統合」のような **個別 PR 番号への inline 参照**
- 「(issue #572 Phase 3-C で 768→744 拡張)」のような **コード変遷の経緯** を表す注釈
- 「最近のコミット」「直近の変更点」のセクション

#### 書いてよい例

- **設計意図の説明** (なぜ閾値が 743px なのか、なぜ MobileGui を別コンポーネントにしたのか) — git blame でコードに辿り着いても読み取りにくい情報
- **元 issue の参照** が概念的コンテキストとして必要なとき (例: 「設計の出発点となった問題」) は本文に 1 箇所だけ残してよい。歴史記述ではなく **問題定義の参照** として書く
- **API リファレンス・data-testid 一覧・操作手順** など、現在のコードベースの状態を反映する情報

#### 例外

`.claude/rules/` は CLAUDE 用の運用ルールなので docs ではないが、同じ原則を踏襲する (PR 番号を inline で挿入しない)。issue/PR の引用が必要な場合は、コミットメッセージ・PR description・コードコメントのどれかに残すこと。

### JSDoc Comments

Use JSDoc for functions and classes:

```javascript
/**
 * Parse Ruby code into an AST using @ruby/prism.
 * @param {string} rubyCode - The Ruby source code to parse.
 * @param {object} options - Parser options.
 * @param {boolean} options.verbose - Whether to include verbose output.
 * @returns {object} The parsed AST node.
 */
function parseRuby(rubyCode, options = {}) {
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
