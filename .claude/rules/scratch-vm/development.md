---
paths:
  - "packages/scratch-vm/**/*.js"
  - "packages/scratch-vm/package.json"
---

# scratch-vm Development

**CRITICAL**: All npm commands for scratch-vm MUST be run inside Docker containers using the `app` service.

## Package Commands

All commands are run from `/app/packages/scratch-vm` inside the container.

### Installation

```bash
docker compose run --rm app bash -c "cd /app/packages/scratch-vm && npm install"
```

### Development Server with Playground

Start the VM playground (development interface):

```bash
docker compose run --rm app bash -c "cd /app/packages/scratch-vm && npm start"
```

The playground provides a standalone testing environment for VM features.

### Build

```bash
# Build VM for Node.js and browser environments
docker compose run --rm app bash -c "cd /app/packages/scratch-vm && npm run build"

# Development build with watch mode
docker compose run --rm app bash -c "cd /app/packages/scratch-vm && npm run watch"
```

The build creates:
- `dist/node/scratch-vm.js`: Node.js version
- `dist/web/scratch-vm.js`: Browser version

### Documentation

Generate JSDoc documentation:

```bash
docker compose run --rm app bash -c "cd /app/packages/scratch-vm && npm run docs"
```

Documentation is output to the `docs/` directory.

### Testing

```bash
# All tests (lint + unit + integration)
docker compose run --rm app bash -c "cd /app/packages/scratch-vm && npm test"

# Lint only
docker compose run --rm app bash -c "cd /app/packages/scratch-vm && npm run lint"

# Unit tests only
docker compose run --rm app bash -c "cd /app/packages/scratch-vm && npm run test:unit"

# Integration tests only
docker compose run --rm app bash -c "cd /app/packages/scratch-vm && npm run test:integration"

# Run with coverage
docker compose run --rm app bash -c "cd /app/packages/scratch-vm && npm run coverage"
```

The VM uses the `tap` test framework.

### テストの配置・命名（現行実装からの規約）

- **`test:unit` の glob は `./test/unit/*.js`（非再帰）**。`test/unit/` の**サブディレクトリに
  置いたテストは標準スクリプトでは実行されない**（`test:integration` は `**/*.js` で再帰）。
  新しい unit テストは `test/unit/` 直下に置くこと。
- unit テストの命名は **アンダースコア形式・`.test.js` サフィックス無し**が慣例
  （`extension_koshien.js`, `mesh_service_v2_polling.js`, `smalruby_migration.js` 等）。
  integration（`test/integration/extensions/`）は **ダッシュ + `.test.js`**
  （`mesh-v2-data-merge.test.js` 等）。
- 新しい Smalruby テストファイルは `packages/scratch-vm/.prettierignore` の
  ホワイトリストにも追加する。

### Local vs CI Testing Policy

- **ローカル**: 変更に直接関係するテストファイルのみ実行 + lint を通す。それが通ったら commit & push してよい。
- **CI**: push 時に全テスト（unit + integration）が自動実行される。全体のリグレッション検出は CI に任せる。
- ローカルで全テストスイートを実行する必要はない。

## Key Directories

- `src/`: VM source code
  - `engine/`: Core execution engine (runtime, sequencer, thread management)
  - `blocks/`: Block implementations for all categories
  - `extensions/`: Extension implementations（**Smalruby 独自拡張の正典は
    `packages/scratch-vm/.prettierignore` のホワイトリスト**。現在 8 ディレクトリ）
    - `koshien/`: スマルビー甲子園（練習用モックゲーム内蔵。下記「koshien の構造」）
    - `microbitMore/`: Enhanced micro:bit integration
    - `scratch3_mesh/`: Mesh networking v1（**サービスは廃止だが登録は残る**。
      `builtinExtensions.mesh` としてロード可能で、プロジェクトロード時に v1→v2 opcode
      自動移行される — 下記 smalruby-migration）
    - `scratch3_mesh_v2/`: Mesh networking v2 with AWS AppSync（構成・mixin 規約は
      `.claude/rules/scratch-gui/mesh.md` が正典）
    - `scratch3_smalrubot_s1/`: スマルロボ S1
    - `scratch3_g2s/`: G2S（AkaDako）
    - `scratch3_tm2scratch/`: TM2Scratch（Teachable Machine）
    - `smalruby_ruby/`: Ruby の String/Array/Hash/Number メソッド意味論を実行時に再現する
      ブロック群（id=`smalrubyRuby`。`util.thread._smalrubyReturnValue` /
      `_smalrubyBlockParams` のスレッドローカル機構、アイコンは
      `scripts/generate-ruby-icon-uri.js` で生成）
  - `io/`: I/O handlers (mouse, keyboard, clock, video, etc.)
  - `serialization/`: Project loading and saving
    - `smalruby-migration.js`: Smalruby 固有。mesh v1→v2 opcode 移行
      （`mesh_` → `meshV2_` prefix 書き換え）と koshien 検出（`detectKoshien`）。
      `virtual-machine.js` のロード/バックパック経路から呼ばれる
  - `sprites/`: Sprite and target management
  - `util/`: Utility functions
- `test/`: Test files
  - `unit/`: Unit tests
  - `integration/`: Integration tests
  - `fixtures/`: Test fixtures and project files
- `playground/`: Development playground interface

## Ruby Integration with @ruby/prism

Ruby code is parsed by @ruby/prism (WebAssembly) in the browser and converted to/from Scratch blocks:

- Ruby parsing is handled by @ruby/prism in scratch-gui
- Ruby-to-blocks conversion: `scratch-gui/src/lib/ruby-to-blocks-converter/`
- Blocks-to-Ruby generation: `scratch-gui/src/lib/ruby-generator/`

## Extension Development

### Creating Extensions

Extensions are in `src/extensions/`. Each extension:

1. Exports a class with `getInfo()` method
2. Returns block definitions, opcodes, and implementation
3. Can use `BlockType` constants (COMMAND, REPORTER, BOOLEAN, HAT, etc.)

Example structure:

```javascript
class MyExtension {
    getInfo() {
        return {
            id: 'myExtension',
            name: 'My Extension',
            blocks: [
                {
                    opcode: 'myBlock',
                    blockType: BlockType.COMMAND,
                    text: 'do something'
                }
            ]
        };
    }

    myBlock() {
        // Implementation
    }
}
```

### Smalruby 拡張の登録（2 系統ある）

Smalruby 拡張の `builtinExtensions` への登録経路は **2 系統**存在する:

1. **`src/extension-support/smalruby-extensions.js` 経由（新規追加はこちら）** —
   upstream の `extension-manager.js` には `=== Smalruby: Start of extension registration ===`
   マーカーで囲んだ `registerSmalrubyExtensions(builtinExtensions)` の呼び出しだけがあり、
   実際の登録は Smalruby 固有ファイル `smalruby-extensions.js` に集約されている。
   現在の登録: `microbitMore` / `koshien` / `tm2scratch` / `g2s` / `smalrubyRuby`。
   **新しい拡張を追加するときは `smalruby-extensions.js` に登録ロジックを足す**
   （`extension-manager.js` は変更不要 = upstream 差分が増えない）。
   - export 形式により 2 パターン: ES6 `export {... as blockClass}` の拡張は
     `require(...).blockClass`、CommonJS `module.exports = Class` は `require(...)` 直接。
   - いずれも `blockClass.formatMessage = require('format-message')` を注入してから返す。
2. **`extension-manager.js` の `builtinExtensions` オブジェクトリテラル直書き（歴史的経緯）** —
   `mesh` / `meshV2` / `smalrubotS1` の 3 つだけは upstream のオブジェクトリテラル内に
   直接書かれている（`=== Smalruby: Start of builtin extension entries ===` マーカーで
   囲んである。upstream マージ時にこの 3 行を消さないこと）。**この形式を真似て新規追加しない**
   （1. の経由にする）。

`defaultHidden`（拡張ライブラリでの非表示）は **scratch-gui 側の概念**
（`src/lib/libraries/extensions/index.jsx`）。VM の `getInfo()` には存在しない。

### opcode / getInfo の規約（現行実装から）

- `getInfo().blocks[].opcode` は短縮形（`connectGame` / `getSensorValue` 等）で書き、
  **実行時の完全 opcode は `<extensionId>_<opcode>`** になる（`koshien_connectGame`,
  `meshV2_getSensorValue`）。gui 側の ruby-generator / ruby-to-blocks-converter や
  `startHats('<extensionId>_<opcode>')` はこの完全形を使う。
- メニュー `menus.<name>.items` は (a) 静的配列、(b) **メソッド名の文字列**（動的メニュー。
  extension-manager がバインドして呼ぶ）の 2 形式。
- ブロック文言は `formatMessage({id, default, description})`。id の名前空間は拡張ごと
  （`koshien.*` / `mesh.*` / `mbitMore.*` 等）。
- 翻訳は拡張ディレクトリの `translations.json`（トップレベルキーは `ja` と `ja-Hira` の 2 つ）
  + `setupTranslations()` イディオム（`formatMessage.setup()` の locale へ `Object.assign`）
  + `getInfo()` に `translationMap: translations`。constructor で
  `if (runtime.formatMessage) formatMessage = runtime.formatMessage` に差し替える。
- スプライト専用ブロックは `filter: [TargetType.SPRITE]` を付ける（koshien 全ブロックの形）。

### koshien の構造

`src/extensions/koshien/` は `index.js`（拡張本体 + `KoshienClient` 基底 + `MockClient`）に
加えて `map-utils.js` / `mock-game.js` / `mock-maps.js` / `mock-rival.js` に分割されている。
バックエンドへは **`KoshienClient` インターフェース越しにのみ**アクセスし、既定実装は
`MockClient`（練習用モックゲーム）。ゲーム状態はランタイムイベント `KOSHIEN_MOCK_STATE` で
GUI へ通知し、緑旗/停止（`PROJECT_START` / `PROJECT_STOP_ALL`）でモック世界をリセットする。
この分離を壊す実装（ブロックから直接ネットワーク/ゲーム状態を触る）は逸脱。

## Mesh Networking v2

mesh v2 の構成・開発フロー・デグレ確認手順の正典は
**`.claude/rules/scratch-gui/mesh.md`**（VM 側ファイル一覧と mixin パターンを含む）。
VM 側の規約の要点のみ:

- `mesh-service.js` は **mixin パターン**: 各責務ファイルが `const XxxMixin = {...}` を
  export し、`Object.assign(MeshV2Service.prototype, XxxMixin)` で合成する。
  **新しい責務ファイルを追加したら require + `Object.assign` の両方に追加する**。
- 環境変数: `MESH_GRAPHQL_ENDPOINT` / `MESH_API_KEY` / `MESH_AWS_REGION` /
  `MESH_DATA_UPDATE_INTERVAL_MS` / `MESH_EVENT_BATCH_INTERVAL_MS`

## Ruby ラウンドトリップとの整合（拡張ブロック追加時の必須事項）

VM 拡張のブロック（opcode）を追加・変更したら、**scratch-gui 側の対応ファイルを必ず更新**
する（Ruby ⇔ ブロックの双方向変換が壊れる）:

- `packages/scratch-gui/src/lib/ruby-generator/<extension>.js`（ブロック → Ruby）
- `packages/scratch-gui/src/lib/ruby-to-blocks-converter/<extension>.js`（Ruby → ブロック）

既存拡張はすべてこの対を持つ（koshien / mesh / mesh_v2 / microbit_more / smalrubot_s1 /
smalruby-ruby / g2s / tm2scratch 等）。片側だけの追加は逸脱。ラウンドトリップの
リグレッションは gui 側の `test/unit/lib/ruby-roundtrip-*.test.js` 系が担保する。

## VM Architecture

### Core Components

- **Runtime**: Manages sprite execution and state
- **Sequencer**: Schedules and runs threads
- **Blocks**: Block implementations and opcodes
- **Targets**: Sprites and stage
- **Renderer**: Integration with scratch-render for visual output

### Execution Model

1. Blocks are compiled into threads
2. Threads are scheduled by the sequencer
3. Each step executes one block per thread
4. Hat blocks trigger new threads (e.g., "when flag clicked")

## Testing Workflow

1. **Write tests first** (TDD approach):
   ```bash
   docker compose run --rm app bash -c "cd /app/packages/scratch-vm && npm run test:unit -- test/unit/your-test.js"
   ```

2. **Implement feature**

3. **Run lint**:
   ```bash
   docker compose run --rm app bash -c "cd /app/packages/scratch-vm && npm run lint"
   ```

4. **Run lint + affected tests** (full suite is run by CI):
   ```bash
   docker compose run --rm app bash -c "cd /app/packages/scratch-vm && npm run lint"
   docker compose run --rm app bash -c "cd /app/packages/scratch-vm && npm run test:unit -- test/unit/your-test.js"
   ```

5. **Lint + affected tests が通ったら** commit and push。全テストは CI が実行する。

## Smalruby Marker Blocks

マーカーの書式・ルールは `.claude/rules/code-style.md` の「Smalruby Marker Comments」を参照。

**upstream ファイルに埋め込んだ scratch-vm のマーカー一覧は `docs/maintenance/smalruby-markers-vm.md`** に
ある（実装中に頻繁に編集するため、Claude Code の「設定ファイル編集」確認プロンプトで自動実行が
止まらないよう `.claude/` の外に置く）。マーカーを追加・削除したらそのファイルを更新する。

**重要**: Smalruby 固有ファイル（`packages/scratch-vm/.prettierignore` のホワイトリストに含まれるファイル）には
マーカー不要。記録するのは upstream ファイルに埋め込んだマーカーのみ。

## Prettier (Code Formatting)

Smalruby 固有ファイルのみに Prettier を適用。upstream ファイルは `.prettierignore` で除外。

**新しい Smalruby 固有ファイルを追加した場合は、`packages/scratch-vm/.prettierignore` の
ホワイトリストに追加すること**（`.prettierignore` が対象ファイルの唯一の真実）。

```bash
# フォーマット実行
docker compose run --rm app bash -c "cd packages/scratch-vm && npm run format"

# フォーマットチェック
docker compose run --rm app bash -c "cd packages/scratch-vm && npm run format:check"
```

## dist/ と他パッケージからの参照（不変条件）

scratch-gui からの `@smalruby/scratch-vm` 参照は **2 経路**あり、必要な準備が異なる:

- **bare import**（`import VM from '@smalruby/scratch-vm'`）→ `package.json` の
  `main`/`browser`（`dist/node|web/scratch-vm.js`）に解決される。gui の jest / webpack が
  この経路を使うテスト・ビルドは **VM の dist が最新である必要がある**
  （`npm run build:dev` で更新）。
- **サブパス import**（`@smalruby/scratch-vm/src/...`）→ gui の jest `moduleNameMapper`
  （`^@smalruby/scratch-vm/(.*)$` → `../scratch-vm/$1`）で **VM のソースに直接**解決される
  （ビルド不要）。gui の ruby-roundtrip 系テストはこちら。

「VM のソースを直したのに gui のテスト/dev server に反映されない」ときは bare import 経路
（= dist が古い）を疑う。

## Development Notes

- The VM exports both Node.js and browser builds
- `src/index.js` is the main entry point
- Extensions are loaded dynamically
- The VM uses Immutable.js for state management
- Scratch projects are loaded via scratch-parser and scratch-storage
