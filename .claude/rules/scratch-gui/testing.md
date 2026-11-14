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
- **ローカルで全テストスイートやディレクトリ全体を流さない**（全体の結果がないと先へ進めないときだけ例外。理由を PR 本文か報告に書く）。正準は `CLAUDE.md` の「ローカルで流すテストの範囲（必ず守る）」。

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

### Test Structure Example（実際の converter テストの形）

ブロックと Ruby の対応を新しく書くときの既定は、下の「ブロック ⇔ Ruby の表」。
表の記法で書けないもの（カスタムブロックなど mutation を持つブロック、エラーになる形）の converter テストは
**`test/helpers/expect-to-equal-blocks.js` のヘルパー経由**で書く（既存の 20 以上のテストファイルもこの形）。
describe 名は `'RubyToBlocksConverter/<Category>'`、
`beforeEach` で `new RubyToBlocksConverter(null, {version: '2'})`、テストは async:

```javascript
// test/unit/lib/ruby-to-blocks-converter/<category>.test.js
import RubyToBlocksConverter from '../../../../src/lib/ruby-to-blocks-converter';
import {
    convertAndExpectToEqualBlocks,
    convertAndExpectRubyBlockError,
    rubyToExpected
} from '../../../helpers/expect-to-equal-blocks';

describe('RubyToBlocksConverter/Event', () => {
    let converter;
    let target;

    beforeEach(() => {
        converter = new RubyToBlocksConverter(null, {version: '2'});
        target = null;
    });

    test('invalid', async () => {
        await convertAndExpectRubyBlockError(converter, target, 'when_flag_clicked');
    });

    // 期待ブロック列との比較は convertAndExpectToEqualBlocks(converter, target, code, expected)
});
```

### 新しい opcode はブロック ⇔ Ruby の表から（テストファースト）

ブロック ⇔ Ruby の変換を足す・直すときは、**先に表に 1 行足して落ちるのを見てから**変換器・生成器を書く。

1. `test/unit/lib/ruby-roundtrip/<category>-table.test.js`（無ければ作る）の `defineBlockRubyTable` に
   `{ blocks: 'motion_movesteps(STEPS: 10)', ruby: 'move(10)' }` を足す。ブロックは短い記法
   （`test/unit/helpers/block-notation.js` の冒頭に書き方）で書く。
2. 流す（`npm exec jest test/unit/lib/ruby-roundtrip/<category>-table.test.js`）。1 行から
   `toRuby`（生成）・`toBlocks`（変換）・`roundTrip`（往復）の 3 つのテストができ、落ちたところが実装する側。
3. 生成器・変換器を書き、3 つとも通す。片方向だけの形は `only: 'toRuby'` / `only: 'toBlocks'`。
4. 注釈 `@ruby:*` を使う形は、ブロックの記法に `#"@ruby:..."` を書いて表に入れる
   （`docs/ruby-editor/bridging-patterns.md` の「表のテスト」）。

- 表の指定: `defineBlockRubyTable(name, rows, { versions: ['1', '2'], stage: true })`。`versions` は流す
  Ruby のバージョン（既定 `['2']`。`version: '1'` も可）、`stage: true` はステージのコードとして流す。
  v1 と v2 で同じになる表は両方で流し、違う行（ハットなど）だけ行に `versions: ['2']` を付ける。
- 複数行の Ruby は、改行で始まるテンプレートリテラルで書く（字下げを外す）。1 行目から始まる文字列は
  そのまま使う（`'3.times do\n  say("hi")\nend'` も書ける）。
- 影（shadow）と数・文字列の opcode: メニューと数・文字列が影かどうかは比べる（影でないメニューは
  `noshadow motion_goto_menu(...)` と出る）。素の `10` はどの `math_*` の影とも一致し、opcode が大事なときだけ
  `math_angle(90)` / `math_whole_number(3)` / `text("hi")` と書いて opcode も比べる。
- 変換の結果に、どのスクリプトからもつながらないブロックや、無い変数・名前の違う変数を指すフィールドがあると、
  `toBlocks` はその理由で落ちる（`readBlocks`）。

既存のヘルパーとの使い分け: 新しい対応は表に書くのが既定。`expect-to-equal-blocks.js` は、表の記法で書けないもの
（カスタムブロックなど mutation を持つブロック、エラーになる形の `convertAndExpectRubyBlockError`）に使う。
既存のテストを全部移す必要はなく、触ったところから表へ移す。

補助ヘルパー: `test/helpers/`（`ruby-helper.js` / `smalruby-mock-state.js`（VM モック状態）/
`intl-helpers.jsx` / `selenium-helper.js`）。round-trip 系は `test/unit/lib/ruby-roundtrip/`。

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

   ログの検査は `expect(await getLogs()).toEqual([])` と書く。`getLogs()` は既定で
   SEVERE だけを返し、既知の無害なログ（`test/helpers/ignorable-severe-logs.js` の
   `isIgnorableSevereLog`。環境由来のノイズと、follow-up 待ちの upstream 由来の警告）を除く。
   無害なログを足すときはこの 1 か所に、部品名や URL まで狭く一致するパターンで足し、
   unit テスト（`test/unit/helpers/ignorable-severe-logs.test.js`）も足す。
   テストごとに同じ除外をコピーしない。

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
