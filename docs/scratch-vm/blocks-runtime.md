# ブロック実行モデル (blocks-runtime)

scratch-vm がブロックをどう実行するか — Runtime / Sequencer / Thread / execute / 各 primitive の協調モデルを詳説する。

## 全体フロー: 1 フレームで何が起きるか

```
Runtime._step()                                ← setInterval で呼ばれる
  ├─ Sequencer.stepThreads()                   ← 時間予算 = currentStepTime × 0.75
  │     └─ for thread of runtime.threads:
  │           Sequencer.stepThread(thread)
  │             └─ while thread.stack 非空:
  │                   execute(sequencer, thread)
  │                     └─ block.opcode を _ops 配列で 1 件ずつ実行
  │                           └─ blockFunction(args, blockUtility)
  │                                 ├─ return value      → Reporter / Boolean (parent input に格納)
  │                                 ├─ return Promise    → thread.status = PROMISE_WAIT
  │                                 ├─ void              → Command (次のブロックへ)
  │                                 └─ Hat 評価 → edge-activate 判定
  │           ↓ stepThread 完了後の status 別処理
  │           ├─ STATUS_YIELD       → 次フレームで再開 (warp なら時間内に即再実行)
  │           ├─ STATUS_PROMISE_WAIT → return; promise.then() で RUNNING に戻る
  │           ├─ STATUS_YIELD_TICK  → 1 tick 待つ (自動 clear)
  │           └─ それ以外           → goToNextBlock() / popStack()
  │     └─ DONE thread を runtime.threads から in-place 削除
  ├─ Runtime._renderInterpolatedPositions()    ← 補間
  └─ Renderer.draw()                            ← ステージ再描画
```

主要ファイル: `packages/scratch-vm/src/engine/{runtime,sequencer,thread,execute,block-utility}.js`

## Thread と StackFrame

### Thread の状態

`packages/scratch-vm/src/engine/thread.js`:

```js
Thread.STATUS_RUNNING       = 0   // 通常実行
Thread.STATUS_PROMISE_WAIT  = 1   // Promise 解決待ち
Thread.STATUS_YIELD         = 2   // この tick は中断、次 tick で再開
Thread.STATUS_YIELD_TICK    = 3   // 1 frame 待つ (stepThreads で自動 clear)
Thread.STATUS_DONE          = 4   // 完了 (削除予定)
```

各 Thread が持つもの:

| プロパティ | 内容 |
|---|---|
| `target` | 実行対象 RenderedTarget |
| `topBlock` | この thread の起点 block ID (Hat または topLevel block) |
| `stack` | block ID の配列 (現在実行中のチェーン) |
| `stackFrames` | 各 stack 要素に対応する `_StackFrame` |
| `status` | 上記 STATUS_* |
| `warpTimer` | warp mode の時間管理 |
| `requestScriptGlowInFrame` | UI ハイライト要求 |

### _StackFrame

`stack` の各要素に対応する**実行コンテキスト**。プールから再利用される（GC 圧迫を避けるため）。

```js
_StackFrame {
    isLoop: false,           // ループブロック (repeat / forever / if-else 等)
    warpMode: false,         // warp 中か
    justReported: null,      // 直前 reporter の戻り値
    reporting: '',           // 非同期 reporting 中の input 名
    reported: null,          // 非同期 reporter から戻った値の一時保持
    waitingReporter: '',     // 非同期 input 名
    params: null,            // procedure call の引数 (key-value)
    executionContext: null   // primitive が自由に使える state
                             //   例: scratch3_control.js の wait は
                             //       util.stackFrame.timer に Timer を保存
                             //       util.stackFrame.duration に残時間を保存
}
```

**重要**: `util.stackFrame` 経由で primitive が**自身のループ状態・タイマー**等を保存できる。プールから再利用されるため初回呼び出しで初期化する。

## execute() の中身

`packages/scratch-vm/src/engine/execute.js`:

### ブロック実行ステップ

1. **ブロックの取得**: `BlocksExecuteCache` から (なければ flyoutBlocks から) 該当ブロックを引く
2. **`_ops` 配列の構築**: ブロック自体 + その input に繋がっている reporter blocks をフラットに展開した実行リスト
3. **各 op を順番に実行**:
   - `runtime._primitives[op.opcode]` で primitive 関数を取得
   - `argValues` を組み立て (`fields` + `inputs` の評価済み値)
   - `blockFunction(argValues, blockUtility)` を呼ぶ
4. **戻り値の処理**:
   - **`undefined` (void)**: Command。`goToNextBlock()` で次へ
   - **値**: Reporter / Boolean。親 input の `argValues` に格納 (またはハット判定へ)
   - **Promise**: thread → `STATUS_PROMISE_WAIT`、`.then(handleReport)` で復帰
   - **Hat の場合**: `runtime.getIsEdgeActivatedHat(opcode)` を確認し、edge 判定 (後述)

### 引数の構築

```js
// fields (固定値) と inputs (繋いだブロックの戻り値) をマージ
argValues = {
    SUBSTACK: branchOpStackId,    // C-shape ブロックの中身
    NUMBER: 10,                    // input の reported value
    DIRECTION: 'right',            // field の value
    mutation: { ... }              // mutation (custom block) があれば
}
```

## BlockUtility: primitive の API

`packages/scratch-vm/src/engine/block-utility.js`:

```js
util = {
    thread, sequencer, runtime,
    target,           // = thread.target
    stackFrame,       // = thread.peekStackFrame().executionContext
    ioQuery(deviceName, query, args),

    // フロー制御
    yield(),                              // status → STATUS_YIELD
    yieldTick(),                          // status → STATUS_YIELD_TICK
    startBranch(branchNum, isLoop),       // C-shape の中に降りる
    startProcedure(procCode),             // 自分定義ブロックを呼ぶ
    stopAll(), stopOtherTargetThreads(), stopThisScript(),

    // タイマー (wait などで使う)
    startStackTimer(duration),

    // Hat の起動 (broadcast 等で他の thread を起動)
    startHats(opcode, optMatchFields, optTarget)
}
```

## ループ / 非同期 / プロシージャの実装

### ループ (repeat / forever / if-else)

例: `control_repeat`

```js
// scratch3_control.js
repeat(args, util) {
    if (typeof util.stackFrame.loopCounter === 'undefined') {
        util.stackFrame.loopCounter = Math.round(Cast.toNumber(args.TIMES));
    }
    // 残回数があれば中身に降りる、なければ抜ける
    if (util.stackFrame.loopCounter > 0) {
        util.stackFrame.loopCounter--;
        util.startBranch(1, true);   // SUBSTACK = 1, isLoop = true
    }
}
```

`startBranch(1, true)` → Sequencer が `SUBSTACK` の子チェーンを stack に push、`isLoop: true` のフレームを作る。子チェーンが終わると stack を pop するが、`isLoop` のため**親 (repeat ブロック) を再呼び出し**する。

### 非同期 (Promise)

例: `control_wait`

```js
wait(args, util) {
    if (util.stackFrame.timer) {
        // 2 回目以降の呼び出し: 残時間チェック
        const elapsed = util.stackFrame.timer.timeElapsed();
        if (elapsed >= util.stackFrame.duration * 1000) return;
        util.yield();
    } else {
        // 初回: timer を作って yield
        util.stackFrame.timer = new Timer();
        util.stackFrame.timer.start();
        util.stackFrame.duration = Cast.toNumber(args.DURATION);
        util.yield();
    }
}
```

または **直接 Promise を返す**ことも可能：

```js
sayForSecs(args, util) {
    return new Promise(resolve => {
        // ...
        setTimeout(resolve, args.SECS * 1000);
    });
}
```

→ `STATUS_PROMISE_WAIT` になり、resolve で `handleReport()` が呼ばれて RUNNING に戻る。

### プロシージャ (custom blocks / 自分定義ブロック)

`procedures_call` ブロック内で `util.startProcedure(procCode)` が呼ばれる：

1. `target.blocks.getProcedureDefinition(procCode)` で定義を引く
2. 引数を `_StackFrame.params` にセット
3. 定義 stack を thread.stack に push
4. **Recursive call** の場合は yield (無限ループ防止)
5. **Warp procedure** (`run without screen refresh` チェック) の場合、warpTimer 開始

子 frame の `params` を `getParam(name)` で取得 — 内側の frame から外側へ検索する。

## Warp Mode (run without screen refresh)

**有効化条件**:
- カスタムブロック定義の「画面を再描画せずに実行する」チェック
- プロジェクト全体の **turbo mode**

**効果**:
```js
// sequencer.js: stepThread の warp 処理
if (currentBlockId === null && thread.status === STATUS_RUNNING) {
    if (thread.warpTimer.timeElapsed() < Sequencer.WARP_TIME /* = 500 */) {
        // まだ 500ms 経過していない → 即座に再実行
        continue;
    }
    // 500ms 超過 → yield (1 tick 待つ)
    thread.status = STATUS_YIELD;
}
```

→ 通常はフレームごとに 1 ステップずつ進むのを、**最大 500ms まで連続実行**できる。重い計算をフレームを止めずに走らせるため。

**Sequencer.WARP_TIME**: `500` (ms)、`sequencer.js:62-64`

## Edge-Activated Hats

`event_whentouchingobject`, `event_whengreaterthan`, `event_whenkeypressed` のような **「条件が偽→真に変わったとき」だけ発火**する Hat。

### 仕組み

各 Target が `_edgeActivatedHatValues[blockId]` を保持し、前回の評価値を記録する：

```js
// execute.js: Hat 実行時
if (runtime.getIsEdgeActivatedHat(opcode)) {
    const oldVal = target.updateEdgeActivatedValue(blockId, newVal);
    // 偽 → 真 の transition 時のみ続行
    if (!(oldVal === undefined ? !newVal : oldVal === false) || !newVal) {
        // 条件: (前回 false or undefined) AND (今回 true)
        return; // thread retire
    }
    // → 真への遷移なので thread を起動
}
```

→ 例えば「`x > 50` のとき」のような Hat は、`x` が 50 を超えた**瞬間**だけ発火し、超えたままなら何度もは発火しない。

実装: `target.js:72-112` の `_edgeActivatedHatValues` と `updateEdgeActivatedValue()`。

### Hat metadata

```js
runtime._hats[opcode] = {
    edgeActivated: boolean,                  // edge-activated か
    shouldRestartExistingThreads: boolean    // 既存 thread を再起動するか
}
```

例: `event_whenflagclicked` は `edgeActivated: false`（明示的に `vm.greenFlag()` で起動）。
`event_whengreaterthan` は `edgeActivated: true`。

## startHats: ブロードキャスト / イベント駆動

```js
runtime.startHats('event_whenbroadcastreceived', { BROADCAST_OPTION: 'message1' })
```

→ 全 Target の blocks をスキャンし、`event_whenbroadcastreceived` で `BROADCAST_OPTION === 'message1'` の Hat を探し、**該当する thread をすべて生成**して `runtime.threads` に push。

`shouldRestartExistingThreads: true` の場合、既存の同 hat thread を停止して新しく起動する。

## ブロックキャッシュ

実行ホットパスを軽くするため 2 種類のキャッシュ：

| ファイル | キャッシュ内容 |
|---|---|
| `blocks-execute-cache.js` | block ID → 解析済み実行データ (_ops 配列、primitive 関数の参照) |
| `blocks-runtime-cache.js` | runtime レベルのキャッシュ (block container ごと) |

ブロックが**変更されると invalidate** される。エディタでブロックを編集すると無効化 → 次の execute で再構築。

## Smalruby 独自の影響

execute.js / sequencer.js / thread.js / runtime.js はほぼ upstream そのまま。Smalruby マーカーは限定的で、主に extension 登録時のフック程度。

ただし**実装ファイル数の多い場所**では Smalruby の追加コードが多い：
- 各 Smalruby 独自拡張 (`koshien`, `mesh_v2`, `smalrubot_s1`, `microbitMore`, `tm2scratch`, `g2s`, `smalruby_ruby`) は本ランタイムの上で動作
- マイグレーション (`smalruby-migration.js`) は **load 時の前処理**でランタイムには関与しない (詳細は [`serialization.md`](serialization.md))

## デバッグのヒント

### 実行中の thread を観察

```js
window.smalruby.runtime.threads
    .map(t => ({
        target: t.target.getName(),
        status: t.status,
        stack: t.stack,
        stackFrames: t.stackFrames.length
    }))
```

### Hat metadata 確認

```js
window.smalruby.runtime._hats
```

### Primitive 関数の確認

```js
window.smalruby.runtime._primitives['motion_movesteps']
```

### 全プロジェクト停止

```js
window.smalruby.runtime.stopAll()
```

## 実例で追う: 緑旗 → repeat → wait

ユーザーが緑旗をクリックして、`repeat (3) { wait (1) sec }` を実行するシナリオ：

1. **`vm.greenFlag()` 呼び出し**
   - `runtime.startHats('event_whenflagclicked')`
   - 該当 thread を生成、`stack: ['<flag_clicked>']`
2. **Frame 1: stepThread**
   - execute → `event_whenflagclicked` (impl なし、即座に goToNextBlock)
   - 次は `<repeat>` へ
   - execute → `control_repeat` primitive 呼び出し → `loopCounter = 3`、`startBranch(1, true)` で SUBSTACK の `<wait>` を push
   - execute → `control_wait` primitive 呼び出し → `timer` を作成、`util.yield()` → STATUS_YIELD
   - stepThread から return (warp でないので次フレームへ)
3. **Frame 2-N: stepThread**
   - execute → `control_wait` → 経過時間 < 1000ms → `util.yield()` → return
4. **Frame X (1 秒経過後)**
   - execute → `control_wait` → 経過時間 >= 1000ms → return (void)
   - stepThread → goToNextBlock → wait の次は何もない → popStack
   - 親 frame (`<repeat>`) は `isLoop: true` → repeat を再呼び出し
   - `loopCounter = 2` → 再度 `startBranch(1, true)`
5. **N 回繰り返し → loopCounter = 0 → repeat を抜ける → thread DONE**

## 関連ドキュメント

- [`README.md`](README.md) — scratch-vm 全体ナビゲーション
- [`architecture.md`](architecture.md) — Runtime / Sequencer / Thread / Target / Blocks の関係
- [`extensions.md`](extensions.md) — 拡張機能の仕組み
- [`serialization.md`](serialization.md) — `.sb3` フォーマット
- [`packages/scratch-vm/docs/extensions.md`](../../packages/scratch-vm/docs/extensions.md) — upstream の拡張機能仕様
