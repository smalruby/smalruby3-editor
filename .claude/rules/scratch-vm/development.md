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

## Key Directories

- `src/`: VM source code
  - `engine/`: Core execution engine (runtime, sequencer, thread management)
  - `blocks/`: Block implementations for all categories
  - `extensions/`: Extension implementations
    - `koshien/`: Smalruby Koshien support
    - `microbitMore/`: Enhanced micro:bit integration
    - `scratch3_mesh/`: Mesh networking (deprecated)
    - `scratch3_mesh_v2/`: Mesh networking v2 with AWS AppSync
    - `scratch3_music/`: Music blocks
    - `scratch3_pen/`: Pen drawing blocks
  - `io/`: I/O handlers (mouse, keyboard, clock, video, etc.)
  - `serialization/`: Project loading and saving
  - `sprites/`: Sprite and target management
  - `util/`: Utility functions
- `test/`: Test files
  - `unit/`: Unit tests
  - `integration/`: Integration tests
  - `fixtures/`: Test fixtures and project files
- `playground/`: Development playground interface

## Ruby Integration with Opal

The VM executes Ruby code transpiled by Opal. Key files:

- Ruby execution is handled through Opal runtime integration
- The VM expects `Opal` to be available globally
- Ruby blocks are converted to JavaScript via Opal before execution

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

### Custom Smalruby Extensions

- **koshien**: Competition support extension
- **microbitMore**: Extended micro:bit functionality beyond standard scratch3_microbit
- **scratch3_mesh_v2**: Real-time collaboration using AWS AppSync GraphQL subscriptions

## Mesh Networking v2

The mesh v2 extension uses AWS AppSync for real-time collaboration:

- GraphQL endpoint for data sync
- WebSocket subscriptions for events
- Configured via environment variables:
  - `MESH_GRAPHQL_ENDPOINT`
  - `MESH_API_KEY`
  - `MESH_AWS_REGION`
  - `MESH_DATA_UPDATE_INTERVAL_MS`
  - `MESH_EVENT_BATCH_INTERVAL_MS`

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

4. **Run all tests**:
   ```bash
   docker compose run --rm app bash -c "cd /app/packages/scratch-vm && npm test"
   ```

5. **Only after all tests pass and lint is clean**, commit and push.

## Smalruby Marker Blocks

Smalruby のカスタムコードは upstream ファイルの中に **マーカーコメント** で囲んで配置する。
upstream merge 時にコンフリクトを解決しやすくするための仕組み。

### マーカーの書式

```javascript
// === Smalruby: Start of <機能名> ===
// ... Smalruby 固有のコード ...
// === Smalruby: End of <機能名> ===
```

### ルール

1. **upstream ファイルに Smalruby コードを追加するときは必ずマーカーで囲む**
2. **マーカー内のコードだけを変更する** — マーカー外は upstream の管轄
3. **新しいマーカーを追加したら、このセクションに記載する**
4. **マーカーを削除する場合は、このセクションからも削除する**

### 現在のマーカー一覧

| ファイル | 機能名 | 説明 |
|----------|--------|------|
| `src/extension-support/extension-manager.js` | extension registration | Smalruby 拡張機能の登録 |

### 関連ファイル

マーカーで囲まれたコードが参照するファイル:
- `src/extension-support/smalruby-extensions.js` — extension-manager.js のマーカーから参照

## Development Notes

- The VM exports both Node.js and browser builds
- `src/index.js` is the main entry point
- Extensions are loaded dynamically
- The VM uses Immutable.js for state management
- Scratch projects are loaded via scratch-parser and scratch-storage
