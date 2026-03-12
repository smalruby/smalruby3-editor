---
paths:
  - "packages/scratch-gui/src/lib/ruby-to-blocks-converter/**"
  - "packages/scratch-gui/src/lib/ruby-generator/**"
  - "packages/scratch-gui/src/lib/prism-parser*"
  - "packages/scratch-gui/src/lib/ruby-parser*"
  - "packages/scratch-gui/src/containers/ruby-tab/**"
  - "packages/scratch-gui/src/containers/ruby-tab*"
description: "Ruby ↔ Blocks 変換、prism パーサー、Monaco Editor 統合のアーキテクチャ。Ruby コード変換の仕組みを理解する際に使用。"
---

# Ruby Mode Integration

## Parser: @ruby/prism

Ruby code is parsed using [@ruby/prism](https://github.com/ruby/prism), a WebAssembly-based Ruby parser. The WASM module runs both in the browser and in Node.js (for tests).

- **Entry point**: `src/lib/prism-parser.js` — loads the WASM module and caches the prism instance
- **High-level API**: `src/lib/ruby-parser.js` — wraps prism-parser for use by converters

## Ruby ↔ Blocks Conversion

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

## Monaco Editor

Ruby code editing uses Monaco Editor (`@monaco-editor/react`). The Ruby editor is integrated in `src/containers/ruby-tab/`.
