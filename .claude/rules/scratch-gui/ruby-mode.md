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

## converter の実装規約（現行実装から）

- **正典形**: 各 converter ファイルは `const XxxConverter = { register: function (converter) {...} }`
  を default export する（全 converter がこの形）。
- **登録は `register-converters.js` の 2 箇所**: ① import を追加、② 実行配列
  （`[...].forEach(x => x.register(converter))`）に追加。
- **登録 API**（`converter-registry.js` の mixin が提供）: `registerOnSend(receiver, name,
  numArgs, fn)` / `registerOnSendWithBlock`（`do...end` ブロック付き呼び出し）/
  `registerOnSendMyBlock` / `registerOnIf` / `registerOnUntil` / `registerOnOpAsgn` /
  `registerOnAnd` / `registerOnOr` / `registerOnVar` / `registerOnVasgn` / `registerOnDefs`。
  - receiver の特殊値: `'self'` → sprite + stage に展開、`'any'` → 全 receiver、配列指定も可。
  - handler は `{receiver, receiverName, name, args, rubyBlockArgs, rubyBlock, node}` の
    params オブジェクトで受ける。文字列/数値は `new Primitive('str', value, node)` でラップ。
- **レガシー二重ディスパッチ**: `onIf` / `onOpAsgn` 等は「registerOnXxx で登録された配列」に
  加えて「converter オブジェクトが直接持つ `onXxx` プロパティ」（Music / Pen / EV3 等の
  旧 converter 11 個）も呼ばれる（`_callConvertersHandler`）。**新規実装は registerOnXxx 形式**
  を使う（レガシー形式を増やさない）。
- **opcode prefix の不変条件**: 拡張ブロックの opcode は `<extensionId>_<camelCase>` 形式で、
  **最初の `_` より前が拡張機能 ID と一致**しなければならない。`converter-errors.js` の
  `getExtensionIdForOpcode` が prefix から「ロードが必要な拡張」を導いてエラー帰属するため、
  不一致だとエラーメッセージが壊れる（`CORE_EXTENSIONS` = argument/colour/control/data/event/
  looks/math/motion/operator/procedures/**ruby**/sensing/sound は拡張扱いしない）。

## generator の実装規約（現行実装から）

- **正典形**: 各 generator ファイルは `export default function (Generator) {
  Generator.<opcode> = function (block) {...}; return Generator; }`。
- **登録は `ruby-generator/index.js` の 2 箇所**: ① import、② `XxxBlocks(RubyGenerator);` の
  適用呼び出し。`RubyGenerator` は単一インスタンス。
- **戻り値規約**: statement ブロックは `` `code\n` `` 文字列（HAT/wrapper は
  `block.isStatement = true`）、値ブロックは `[code, Generator.ORDER_xxx]` タプル
  （ORDER 定数は `index.js` に定義）。
- **converter ⇔ generator の対称性**: 同一 opcode（メニュー opcode 含む）を必ず両側で扱う。
  片側だけの追加はラウンドトリップ（Ruby → Blocks → Ruby）を壊すので逸脱。
  テストは `test/helpers/expect-to-equal-blocks.js` のヘルパー
  （`convertAndExpectToEqualBlocks` / `rubyToExpected` 等）を使う（`testing.md` 参照）。

converter/generator 追加の全体手順（VM 拡張との対応関係）は
`.claude/rules/scratch-gui/extension-ruby-policy.md` と
`.claude/rules/scratch-vm/development.md` の「Ruby ラウンドトリップとの整合」も参照。

## Monaco Editor

Ruby code editing uses Monaco Editor (`@monaco-editor/react`). The Ruby editor is integrated in `src/containers/ruby-tab/`.
