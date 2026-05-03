# scratch-vm 内部仕様

> **対象読者**: 新しく `packages/scratch-vm/` を触る開発者、AI アシスタント (Claude Code 等)、upstream マージ時に差分を判断する人

scratch-vm は **Scratch プロジェクトを実行する仮想マシン**。プロジェクトをロードして、ブロックを並列のスレッドとして実行し、レンダリングを通じてステージに反映する。Scratch Foundation の [`scratch-vm`](https://github.com/scratchfoundation/scratch-vm) を fork し、Smalruby 独自の拡張機能 (Mesh v2, Smalrubot S1, Koshien 等) と Mesh v1 マイグレーションを追加している。

このディレクトリは **Smalruby が VM の理解を深めるために書いた独自ドキュメント**。upstream の既存ドキュメント (`packages/scratch-vm/docs/extensions.md`) は別途参照する。

## ドキュメント一覧

| ドキュメント | 内容 | 状態 |
|---|---|---|
| [`architecture.md`](architecture.md) | Runtime / Sequencer / Thread / Target / Blocks の関係、データフロー | ✅ |
| [`extensions.md`](extensions.md) | 拡張機能の仕組み + Smalruby 独自追加 (`smalruby-extensions.js`) | ✅ |
| [`serialization.md`](serialization.md) | `.sb3` フォーマット + Smalruby マイグレーション (`smalruby-migration.js`) | ⏳ |
| [`blocks-runtime.md`](blocks-runtime.md) | ブロック実行モデル (execute / sequencer / thread の協調) | ⏳ |

⏳ は未着手。Issue #620 で順次追加予定。

## 主要ファイルマップ

### Public API

| ファイル | 役割 |
|---|---|
| `packages/scratch-vm/src/index.js` | `VirtualMachine` クラスのみ export |
| `packages/scratch-vm/src/virtual-machine.js` | 公開 API。`loadProject`, `greenFlag`, `setEditingTarget`, イベント発火 |

### Engine（実行エンジン）

| ファイル | 役割 |
|---|---|
| `packages/scratch-vm/src/engine/runtime.js` | 中核。Targets / Threads / Sequencer / IO devices / 拡張プリミティブを保有 |
| `packages/scratch-vm/src/engine/sequencer.js` | スレッドの時分割実行スケジューラ |
| `packages/scratch-vm/src/engine/thread.js` | 1 スクリプトの実行スレッド (status, stack, blockId) |
| `packages/scratch-vm/src/engine/blocks.js` | Target ごとのブロックコンテナ |
| `packages/scratch-vm/src/engine/execute.js` | ブロック関数を呼ぶ実行器 (Command / Reporter / Hat / Boolean) |
| `packages/scratch-vm/src/engine/target.js` | Sprite / Stage の基底クラス |
| `packages/scratch-vm/src/engine/block-utility.js` | ブロック関数に渡される utility (thread, sequencer, runtime, stackFrame) |
| `packages/scratch-vm/src/engine/adapter.js` | Blockly XML/JSON ↔ runtime block 形式 |

### Sprites

| ファイル | 役割 |
|---|---|
| `packages/scratch-vm/src/sprites/sprite.js` | プロトタイプ (コスチューム/サウンド共有資産) |
| `packages/scratch-vm/src/sprites/rendered-target.js` | Target の具象。renderer state を持つ |

### Extension Support

| ファイル | 役割 |
|---|---|
| `packages/scratch-vm/src/extension-support/extension-manager.js` | 拡張機能のロード機構 (built-in + worker) |
| `packages/scratch-vm/src/extension-support/smalruby-extensions.js` | **Smalruby 独自**。microbitMore, koshien, tm2scratch, g2s, smalrubyRuby を built-in として登録 |
| `packages/scratch-vm/src/extension-support/block-type.js` | BlockType enum (COMMAND, REPORTER, BOOLEAN, HAT, EVENT, LOOP) |
| `packages/scratch-vm/src/extension-support/argument-type.js` | ArgumentType enum (NUMBER, STRING, BOOLEAN, COLOR 等) |
| `packages/scratch-vm/src/extension-support/target-type.js` | TargetType enum (SPRITE, STAGE) |

### Serialization

| ファイル | 役割 |
|---|---|
| `packages/scratch-vm/src/serialization/sb3.js` | `.sb3` (zip) のシリアライズ・デシリアライズ |
| `packages/scratch-vm/src/serialization/smalruby-migration.js` | **Smalruby 独自**。Mesh v1 → v2 のオパコード書き換え、koshien 検出 |

### IO Devices

`packages/scratch-vm/src/io/`:
- `clock`, `keyboard`, `mouse`, `mouseWheel`, `video`, `userData`, `cloud`

### Util

`packages/scratch-vm/src/util/`:
- `cast.js` (型強制), `color.js`, `math-util.js`, `string-util.js`, `timer.js`

### Built-in Extensions

`packages/scratch-vm/src/extensions/`:
- upstream: `scratch3_pen`, `scratch3_music`, `scratch3_video_sensing`, `scratch3_face_sensing`, `scratch3_text2speech`, `scratch3_translate`, `scratch3_makeymakey`, `scratch3_microbit`, `scratch3_gdx_for`, `scratch3_ev3`, `scratch3_boost`, `scratch3_wedo2`, `scratch3_mesh` (旧 v1), `scratch3_speech2text`
- Smalruby 独自: `scratch3_mesh_v2`, `scratch3_smalrubot_s1`, `microbitMore`, `koshien`, `scratch3_tm2scratch`, `scratch3_g2s`, `smalruby_ruby`

各拡張機能の詳細は `docs/extension-<name>/` を参照。

## upstream マーカー

upstream ファイルに埋め込んだ Smalruby 固有コードは `=== Smalruby:` マーカーで囲まれている。VM 側のマーカー一覧は **`.claude/rules/scratch-vm/development.md`** を参照。

## 関連ドキュメント

- [`packages/scratch-vm/docs/extensions.md`](../../packages/scratch-vm/docs/extensions.md) — upstream の拡張機能仕様（Scratch 3.0 Extension Specification）
- [`docs/extension-*/`](../) — 各拡張機能のユーザー視点ドキュメント
- `.claude/rules/scratch-vm/development.md` — VM 開発ワークフロー
- `.claude/rules/scratch-vm/smalruby-prettier-files.md` — Smalruby 独自ファイル一覧

## 関連 Issue

- Issue #620 — 本ドキュメント体系の整備 (Open)
- Issue #610 — 機能ドキュメント体系 (Closed)
