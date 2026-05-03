# scratch-vm アーキテクチャ

scratch-vm の中核オブジェクトと、プロジェクトロード〜実行〜描画までのデータフロー。

## クラス階層と所有関係

```
VirtualMachine (EventEmitter, public API)
  └─ runtime: Runtime
        ├─ targets: Target[]                ← Stage + Sprite (RenderedTarget)
        │     └─ blocks: Blocks            ← opcode/inputs/fields の dict
        │           └─ comments, variables
        ├─ threads: Thread[]                ← 実行中のスクリプト
        │     ├─ stack: blockId[]
        │     ├─ stackFrames: StackFrame[] ← ループ状態, 報告値
        │     └─ status: RUNNING / PROMISE_WAIT / DONE / ...
        ├─ sequencer: Sequencer            ← フレームごとに threads を進める
        ├─ ioDevices                        ← clock / keyboard / mouse / video / cloud
        ├─ _primitives: Map<opcode, fn>    ← ブロック関数の解決辞書
        └─ _hats: Map<opcode, HatMeta>      ← Hat ブロック metadata
```

主要な「**所有 (owns)**」関係：

- `VirtualMachine` は `Runtime` を 1 つ所有
- `Runtime` は **すべての** Targets / Threads / Sequencer / IO デバイスを所有
- 各 `Target` は **自身の** `Blocks` と `Variables` を所有
- 各 `Thread` は実行コンテキスト (`Target` への参照、`Block` の stack、状態) を持つ
- `Sequencer` は `Runtime` を参照し、`Runtime.threads` を時分割で進める

## データフロー: プロジェクトロード → 実行 → 描画

### 1. ロード

```
vm.loadProject(json)
  → VirtualMachine.loadProject (virtual-machine.js)
  → sb3.deserialize(json) (serialization/sb3.js)
       → Targets を生成、各 Target に Blocks を生成
       → Variables を初期化
  → Smalruby マイグレーション (smalruby-migration.js)
       → mesh_* opcode を meshV2_* に書き換え
       → koshien 拡張使用を検出 (必要なら追加ロード)
  → ExtensionManager がプロジェクト依存の拡張機能をロード
  → PROJECT_LOADED イベント発火
```

### 2. 編集 (オプション)

エディタが `vm.setEditingTarget(targetId)` で編集対象を切替。Blocks の追加・削除・接続変更は `editingTarget.blocks` を直接編集する。**Runtime の実行とは独立**して編集できる（実行中も含む）。

### 3. 実行開始

```
vm.greenFlag()
  → Runtime.start() / startHats('event_whenflagclicked')
  → 該当 Hat ブロックを持つすべての Thread を生成
  → Runtime.threads に push
  → PROJECT_START イベント発火
```

### 4. ステップ (フレームごと)

```
Runtime._step() が requestAnimationFrame で呼ばれる
  → Sequencer.stepThreads()
       → 時間予算 (currentStepTime × 0.75) 内で
       → for thread of runtime.threads:
            execute(sequencer, thread)
              → 現在の blockId を thread.peekStack() で取得
              → primitive = runtime._primitives[block.opcode]
              → result = primitive(args, blockUtility)
              → Promise なら thread.status = PROMISE_WAIT、resolve で続行
              → Reporter なら値を stack frame に push
              → Hat なら edge-trigger 判定
              → 次の blockId に移動 or 親 stack に戻る or DONE
       → DONE thread を runtime.threads から削除
  → Runtime._renderInterpolatedPositions() で補間
  → Renderer がステージを再描画
  → 必要なら新しい Hat を起動
```

### 5. 停止

```
vm.stopAll()
  → Runtime.stopAll()
       → すべての thread.status = DONE
       → ioDevices をリセット (timer 等)
       → PROJECT_RUN_STOP イベント発火
```

## 役割分担: 編集 vs 実行

scratch-vm の **重要な設計判断**は、データ (Blocks / Targets / Variables) と実行 (Sequencer / Thread / execute) を**分離**していること：

| 層 | 役割 | エディタの関与 |
|---|---|---|
| **データ** | Blocks / Targets / Variables | エディタが直接書き換え (CRUD) |
| **実行** | Sequencer / Thread / execute | エディタは `vm.greenFlag()` 等のハイレベル API しか触らない |

→ **編集と実行が共存できる** (ライブコーディング、実行中のブロック追加)。

## ブロック実行モデル (詳細は別 doc)

ブロック関数 (primitive) は以下のシグネチャ：

```js
function blockPrimitive(args, util) {
  // args: { ARGUMENT_NAME: value, ... }
  // util: BlockUtility
  //   util.thread, util.sequencer, util.runtime
  //   util.target (= util.thread.target)
  //   util.stackFrame (= 現在の StackFrame, ループ状態を保持)
  return value;        // Reporter / Boolean
  return Promise;      // 非同期 (status は自動で PROMISE_WAIT に)
  // void                  Command (次のブロックへ)
}
```

詳細は [`blocks-runtime.md`](blocks-runtime.md) (準備中) を参照。

## Smalruby 固有の改良点

upstream `extension-manager.js` の中央付近に以下のマーカー：

```js
// === Smalruby: Start of register Smalruby extensions ===
require('./smalruby-extensions')(builtinExtensions);
// === Smalruby: End of register Smalruby extensions ===
```

→ `smalruby-extensions.js` (Smalruby 独自ファイル) で microbitMore / koshien / tm2scratch / g2s / smalrubyRuby を built-in 拡張として登録。**upstream マージ時の差分は最小** (1 require 行のみ)。詳細は [`extensions.md`](extensions.md) (準備中) を参照。

`virtual-machine.js` の `loadProject` 内では `smalruby-migration.js` が呼ばれて Mesh v1 → v2 のオパコード書き換えが行われる。詳細は [`serialization.md`](serialization.md) (準備中) を参照。

## 主要 API リファレンス（公開メソッド）

`VirtualMachine` クラスから外部に公開されるメソッド：

| メソッド | 用途 |
|---|---|
| `loadProject(json)` | `.sb3` プロジェクトをロード |
| `saveProjectSb3()` | 現プロジェクトを `.sb3` Blob として export |
| `greenFlag()` | 緑旗を発火 (event_whenflagclicked Hat を起動) |
| `stopAll()` | 全スクリプト停止 |
| `setEditingTarget(targetId)` | 編集対象スプライトを切替 |
| `addSprite(spriteJson)`, `deleteSprite(targetId)` | スプライト追加・削除 |
| `addBackdrop(...)`, `addCostume(...)`, `addSound(...)` | アセット追加 |
| `runtime` (getter) | 内部 Runtime への参照 (高度な用途) |

完全な API は `packages/scratch-vm/src/virtual-machine.js` を参照。

## イベント

`VirtualMachine` は EventEmitter として以下を発火：

- `PROJECT_LOADED` — プロジェクトロード完了
- `PROJECT_START` — 緑旗実行開始
- `PROJECT_RUN_STOP` — 全スクリプト停止
- `SCRIPT_GLOW_ON` / `SCRIPT_GLOW_OFF` — 実行中スクリプトのハイライト
- `BLOCK_GLOW_ON` / `BLOCK_GLOW_OFF` — 実行中ブロックのハイライト
- `PROJECT_CHANGED` — プロジェクトに変更があった
- `targetsUpdate` — Targets 一覧が変わった

## 関連ドキュメント

- [`README.md`](README.md) — 主要ファイルマップ
- [`extensions.md`](extensions.md) — 拡張機能の仕組み (準備中)
- [`serialization.md`](serialization.md) — `.sb3` フォーマット (準備中)
- [`blocks-runtime.md`](blocks-runtime.md) — ブロック実行モデル詳細 (準備中)
- 上流: [scratch-vm GitHub](https://github.com/scratchfoundation/scratch-vm)
