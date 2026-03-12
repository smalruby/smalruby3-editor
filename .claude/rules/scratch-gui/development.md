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

### Local vs CI Testing Policy

- **ローカル**: 変更に直接関係するテストファイルのみ実行 + lint を通す。それが通ったら commit & push してよい。
- **CI**: push 時に全テスト（unit + integration）が自動実行される。全体のリグレッション検出は CI に任せる。
- ローカルで全テストスイートを実行する必要はない。

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

### 拡張機能の Ruby メソッド定義方針

拡張機能のブロックを Ruby で表現する際の設計方針。

#### 事前定義レシーバーパターン

拡張機能は `拡張名.メソッド名(...)` の形式で表現する。`拡張名` はスクリプト上で変数として定義されず、prism では **レシーバーなしの `CallNode`** として解析される。

```ruby
# face_sensing は変数定義なしで直接使う
face_sensing.go_to("nose")
face_sensing.when_face_tilted("left") do
end

# pen も同様
pen.down
pen.size = 3
```

**AST 構造**: `face_sensing.go_to("nose")` は以下のように解析される:
- 外側: `CallNode(name=go_to, receiver=CallNode(name=face_sensing, receiver=nil))`
- 内側の `face_sensing`: レシーバーなし・引数なしの `CallNode`

**対応済み拡張機能**:
| 拡張名 | Ruby レシーバー | 状態 |
|--------|----------------|------|
| ペン | `pen` | 対応済み |
| 顔認識 | `face_sensing` | 対応済み |
| メッシュ | `mesh` | 未対応（今後移行予定） |
| micro:bit | `microbit` | 未対応（今後移行予定） |

**旧 API との互換性**: 既存の `Keyboard.pressed?`, `Timer.value`, `Pen.clear` などの定数レシーバー（`ConstantReadNode`）パターンは互換性のために残すが、将来的に `keyboard.pressed?` 等の事前定義レシーバーパターンに刷新予定。

#### 実装に必要なファイル

拡張機能の Ruby 対応を追加する際に作成・修正するファイル:

| ファイル | 役割 |
|---------|------|
| `src/lib/ruby-generator/<extension>.js` | Blocks → Ruby 生成 |
| `src/lib/ruby-generator/index.js` | ジェネレーター登録 |
| `src/lib/ruby-to-blocks-converter/<extension>.js` | Ruby → Blocks 変換 |
| `src/lib/ruby-to-blocks-converter/register-converters.js` | コンバーター登録 |
| `src/lib/furigana-annotator.js` | ふりがな対応 |
| `src/locales/ja.js` | 日本語翻訳 |
| `src/locales/ja-Hira.js` | ひらがな翻訳 |
| `test/unit/lib/ruby-generator/<extension>.test.js` | ジェネレーターテスト |
| `test/unit/lib/ruby-to-blocks-converter/<extension>.test.js` | コンバーターテスト |
| `test/unit/lib/furigana-annotator.test.js` | ふりがなテスト |
| `docs/furigana-mapping.md` | ふりがな対応表（ドキュメント） |

### Ruby ふりがな方針

Ruby tab の「ふりがな」機能で表示される注釈の設計方針。

実装: `src/lib/furigana-annotator.js`
対応表: `docs/furigana-mapping.md`

#### 基本原則

1. **ふりがなは命令ブロックの日本語ラベルに準拠する** — `ja.js` の翻訳キーを参照元とする
2. **prism AST のノードタイプは `node.toJSON().type` で判定** — `node.constructor.name` はプロダクションビルドで minify されるため使用禁止
3. **テストでは変数定義なしのコードを使う** — 事前定義レシーバーは `CallNode` として解析されるため、`pen = 1\npen.xxx` のようなテストは書かない

#### 拡張機能のふりがなパターン

事前定義レシーバーの拡張機能は以下の 3 層でふりがなを付与する:

```ruby
# ①レシーバー  ②メソッド  ③引数
# 顔認識        行く       鼻
  face_sensing.go_to("nose")
```

| 層 | 対象 | ふりがなの決め方 |
|----|------|----------------|
| ① レシーバー | `face_sensing`, `pen` 等 | 拡張機能のカテゴリ名（`顔認識`, `ペン`） |
| ② メソッド名 | `go_to`, `stamp` 等 | ブロックラベルから `[MENU]` 部分を除いた形 |
| ③ メニュー引数 | `"nose"`, `"left"` 等 | ブロックのメニュー項目の日本語ラベル |

#### メニュー引数のスコープ管理

メニュー引数の文字列ラベル（例: `"nose"` → `鼻`）は **拡張機能専用のコンテキスト限定ラベル** として実装する。グローバルの `_SPECIAL_STRING_LABELS` には追加しない。

**理由**: `"left"` や `"right"` のような汎用的な文字列は、他のコンテキスト（キー名、方向等）でも使われるため、グローバルに設定するとラベルが衝突する。

**実装パターン**:
1. `_FACE_SENSING_PART_LABELS`, `_FACE_SENSING_DIRECTION_LABELS` のような静的マップを定義
2. `_FACE_SENSING_STRING_MAP` でメソッド名 → ラベルマップの対応を定義
3. `_handleCallNode` の引数 walk 直前に `_stringLabelMap` を設定、walk 後にクリア
4. `_handleStringNode` で `_stringLabelMap` を優先チェック

#### `_handleCallNode` での事前定義レシーバー検出

```
receiverType === 'CallNode' && !node.receiver.receiver && node.receiver.name === '拡張名'
```

- `CallNode` branch 内で、receiver が「レシーバーなし・引数なし」の CallNode かを確認
- no-receiver branch で `拡張名` 自体のふりがな（カテゴリ名）を付与
- `_isPredefinedReceiver(node, '拡張名')` ヘルパーで `LocalVariableReadNode`（互換）と `CallNode` の両方を判定

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

5. **Lint + affected tests が通ったら** commit and push。全テストは CI が実行する。

## PWA (Progressive Web App)

The GUI is built as a PWA. Assets and manifest are generated by:
- `scripts/makePWAAssetsManifest.js` (prebuild)
- `webpack-pwa-manifest` plugin (build)
- `workbox-webpack-plugin` (build)

## Smalruby Marker Blocks

Smalruby のカスタムコードは upstream ファイルの中に **マーカーコメント** で囲んで配置する。
upstream merge 時にコンフリクトを解決しやすくするための仕組み。

### マーカーの書式

```javascript
// === Smalruby: Start of <機能名> ===
// ... Smalruby 固有のコード ...
// === Smalruby: End of <機能名> ===
```

ファイル全体が Smalruby 固有の場合:
```javascript
// === Smalruby: This file is Smalruby-specific (<説明>) ===
```

### ルール

1. **upstream ファイルに Smalruby コードを追加するときは必ずマーカーで囲む**
2. **マーカー内のコードだけを変更する** — マーカー外は upstream の管轄
3. **新しいマーカーを追加したら、このセクションに記載する**
4. **マーカーを削除する場合は、このセクションからも削除する**

### 現在のマーカー一覧

| ファイル | 機能名 | 説明 |
|----------|--------|------|
| `src/reducers/gui.ts` | Redux state registry | Smalruby reducer の import |
| `src/reducers/gui.ts` | initial state | Smalruby 初期 state の展開 |
| `src/reducers/gui.ts` | reducers | Smalruby reducer の登録 |
| `src/containers/cards.jsx` | tutorial glow animation | チュートリアルのハイライトアニメーション |
| `src/containers/connection-modal.jsx` | meshV2 initial step feature | Mesh v2 接続初期ステップ |
| `src/containers/connection-modal.jsx` | meshV2 connected message feature | Mesh v2 接続済みメッセージ |
| `src/containers/connection-modal.jsx` | meshV2 back button feature | Mesh v2 戻るボタン |
| `src/components/cards/cards.jsx` | tutorial glow animation | チュートリアル UI のハイライト |
| `src/components/connection-modal/connection-modal.jsx` | network filter detection feature | ネットワークフィルター検出 |
| `src/components/connection-modal/connection-modal.jsx` | meshV2 initial step feature | Mesh v2 初期ステップ UI |
| `src/components/connection-modal/connected-step.jsx` | meshV2 connected message feature | Mesh v2 接続済みステップ UI |
| `src/components/gui/gui.jsx` | Redux action props prevention | Redux action props の伝播防止 |
| `src/lib/blocks.js` | gesture recovery import | ジェスチャー復旧モジュールの import |
| `src/lib/blocks.js` | gesture recovery | ジェスチャー復旧ハンドラーのインストール |
| `src/playground/render-gui.jsx` | URL params for Playwright | URL パラメーター import |
| `src/playground/render-gui.jsx` | no_beforeunload URL param | beforeunload 無効化 |
| `src/playground/render-gui-standalone.jsx` | URL params for Playwright | URL パラメーター import |
| `src/playground/render-gui-standalone.jsx` | no_beforeunload URL param | beforeunload 無効化 |
| `src/playground/player.jsx` | URL params for Playwright | URL パラメーター import |
| `src/playground/player.jsx` | no_beforeunload URL param | beforeunload 無効化 |
| `src/lib/project-saver-hoc.jsx` | URL params for Playwright | URL パラメーター import |
| `src/lib/project-saver-hoc.jsx` | no_beforeunload URL param | beforeunload 無効化 |
| `src/lib/project-fetcher-hoc.jsx` | URL params for Playwright | URL パラメーター import |
| `src/lib/project-fetcher-hoc.jsx` | initial tab from URL param | 初期タブ URL パラメーター |
| `src/reducers/editor-tab.js` | initial tab from URL param | 初期タブ URL パラメーター |
| `src/reducers/settings.js` | URL params for Playwright | URL パラメーター import |
| `src/reducers/settings.js` | ruby_version URL param | Ruby バージョン URL パラメーター |

### Smalruby 固有ファイル（ファイル全体がマーカー）

| ファイル | 説明 |
|----------|------|
| `src/components/connection-modal/mesh-v2-initial-step.jsx` | Mesh v2 初期接続ステップコンポーネント |
| `src/components/connection-modal/mesh-v2-network-filtered-step.jsx` | Mesh v2 ネットワークフィルター検出コンポーネント |
| `src/reducers/smalruby-registry.ts` | Smalruby reducer/state の一括エクスポート |
| `src/lib/blocks-gesture-recovery.js` | ジェスチャー復旧ハンドラー（ブロックドラッグのスタック防止） |
| `src/lib/url-params.js` | Playwright テスト用 URL パラメーター解析ユーティリティ |
| `src/containers/ruby-tab/debug-globals.js` | Playwright MCP 用デバッググローバル変数 |

### 関連ファイル

マーカーで囲まれたコードが参照するファイル:
- `src/reducers/smalruby-registry.ts` — gui.ts のマーカーから参照

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

## Development Notes

- The webpack config loads environment variables from monorepo root `.env` file
- Hot module replacement (HMR) is enabled in development mode
- The app uses scratch-blocks (Blockly fork) for visual block programming
- CSS modules are used for styling (except raw.css files and driver.js)
- Unit tests use jest with jsdom environment (configured in `package.json`)
- The `@ruby/prism` WASM module requires special jest transform configuration (see `package.json`)
